// The signer sidecar (live server only; docs/android-export-design.md §7): the one process that ever
// holds a game's upload keystore in the clear, for the seconds a tool runs. Same image as the api,
// its own container with no network, a read-only root, a tmpfs /tmp and no secrets
// (deploy/api/compose.yaml `signer`). It makes keystores (keytool), inspects an unsigned build and
// refuses one that is not what the api asked for, signs it (apksigner / jarsigner) and verifies the
// result (src/android/tools.ts does the work; this file is the socket around it).
// Protocol: POST /jobs {op: "keygen" | "sign", ...} on a Unix socket only the api can open; one JSON
// answer. Files travel through the exports volume (/exports/<buildId>/unsigned.<ext> → signed.<ext>).
import { chmodSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { findToolchain, keygen, signAndInspect, workDir } from '../dist/android/tools.js';

const env = process.env;
const SOCKET = env.SIGNER_SOCKET || '/run/typeplay-signer/signer.sock';
const EXPORTS = env.EXPORTS_DIR || '/exports';
const TMP = env.TMPDIR || '/tmp';
const SECRET = /^(DATABASE_URL|DIRECT_URL|SUPABASE_\w+|R2_\w+|CLOUDFLARE_\w+|HETZNER_\w+|GOOGLE_\w+|ANTHROPIC_\w+|CLAUDE_CODE_OAUTH_\w+|ANDROID_KEY_\w+|PADDLE_\w+)$/;
const MAX_BODY = 1 << 20;
const BUILD_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const PROJECT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const die = (msg) => { console.error(`signer: ${msg}`); process.exit(1); };

const leaked = Object.keys(env).filter((k) => SECRET.test(k));
if (leaked.length) die(`refusing to start: ${leaked.join(', ')} must not be in the signer's environment`);
const tc = findToolchain(env);
if (!tc) die('no toolchain: JAVA_HOME, ANDROID_HOME (with build-tools) and BUNDLETOOL_JAR are needed');
if (!existsSync(EXPORTS)) die(`${EXPORTS} is missing (the exports volume)`);

async function handle(job) {
  if (job.op === 'keygen') {
    if (!PROJECT_ID.test(String(job.projectId ?? ''))) throw new Error('bad project id');
    if (typeof job.password !== 'string' || !/^[A-Za-z0-9]{16,64}$/.test(job.password)) throw new Error('bad password');
    const dir = workDir(TMP, `keygen-${job.projectId}-${Date.now()}`);
    try {
      const r = await keygen(tc, dir, String(job.appName ?? ''), job.password);
      return { ok: true, p12: r.p12.toString('base64'), certSha256: r.certSha256 };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (job.op === 'sign') {
    if (!BUILD_ID.test(String(job.buildId ?? ''))) throw new Error('bad build id');
    if (job.ext !== 'apk' && job.ext !== 'aab') throw new Error('bad ext');
    if (typeof job.p12 !== 'string' || typeof job.password !== 'string' || !job.expect) throw new Error('bad request');
    const dir = join(EXPORTS, job.buildId);
    if (!existsSync(join(dir, `unsigned.${job.ext}`))) throw new Error('no unsigned file');
    const result = await signAndInspect(tc, { ext: job.ext, dir, p12: Buffer.from(job.p12, 'base64'), password: job.password, expect: job.expect });
    return { ok: true, result };
  }
  throw new Error(`unknown op ${job.op}`);
}

const server = createServer((req, res) => {
  const answer = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return answer(200, { ok: true, buildTools: tc.buildTools });
  if (req.method !== 'POST' || req.url !== '/jobs') return answer(404, { ok: false, err: 'not found' });
  const chunks = [];
  let size = 0;
  req.on('data', (c) => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
  req.on('end', () => {
    if (size > MAX_BODY) return answer(413, { ok: false, err: 'too large' });
    let job;
    try { job = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return answer(400, { ok: false, err: 'bad JSON' }); }
    handle(job).then(
      (r) => { log(`${job.op} ${job.buildId ?? job.projectId}: ${r.result ? (r.result.ok ? 'signed' : r.result.problem) : 'ok'}`); answer(200, r); },
      (e) => { log(`${job.op} failed: ${e.message.split('\n')[0]}`); answer(200, { ok: false, err: e.message.slice(0, 2000) }); },
    );
  });
});

mkdirSync(dirname(SOCKET), { recursive: true });
rmSync(SOCKET, { force: true });
server.listen(SOCKET, () => {
  chmodSync(SOCKET, 0o660);
  log(`signer on ${SOCKET}: build-tools ${tc.buildTools}, exports in ${EXPORTS}`);
});
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT', () => { server.close(); process.exit(0); });
