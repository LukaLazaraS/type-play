// The runner (live server only): everything that executes inside a game folder happens here, in its
// own container with no secrets and no internet (deploy/api/compose.yaml). The API asks for jobs
// over a Unix socket only it can open (apps/server/src/runs/runner-client.ts):
//   agent   node packages/agent/run.mjs --dir <game> … (the game agent: Claude Code, Godot, browser)
//   export  Godot import + web export (Godot runs a game's @tool scripts while importing)
//   android Godot Android export of one commit, unsigned, in a scratch copy of the game (one at a
//           time; android-prepare.mjs; docs/android-export-design.md §3). No key ever comes here.
//   git     git in the game folder (its config and hooks are the agent's to write)
//   remove  delete the game folder
// Each job runs as a throwaway user (slot N = uid 10000+N) that owns only that game's folder and an
// empty home while the job lasts. Afterwards every process of that user is killed, its files in
// /tmp are removed, the folder goes back to the API's user (uid 1000) and the home is wiped.
// Runs as root (to switch users, with only the capabilities that needs); refuses to start if a
// server secret is in its environment.
import { spawn } from 'node:child_process';
import {
  appendFileSync, chmodSync, chownSync, closeSync, constants, existsSync, fstatSync, lchownSync, lstatSync, mkdirSync,
  openSync, readFileSync, readSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath } from 'node:url';

const env = process.env;
const DATA = env.DATA_DIR || '/data';
const PROJECTS = join(DATA, 'projects');
const AGENT_LOGS = join(DATA, 'agent-logs');
const SOCKET = env.RUNNER_SOCKET || '/run/typeplay/runner.sock';
const SLOTS = Number(env.RUNNER_SLOTS || 6);
const UID_BASE = Number(env.RUNNER_UID_BASE || 10001);
const OWNER = { uid: Number(env.API_UID || 1000), gid: Number(env.API_GID || 1000) };
const HOMES = env.RUNNER_HOMES || '/home/runs';
const AGENT = env.AGENT_SCRIPT || '/app/packages/agent/run.mjs';
const GODOT = env.GODOT_EXE || '/opt/godot/godot';
const TEMPLATES = env.GODOT_TEMPLATES || '/opt/godot/export_templates';
const TMP_DIRS = ['/tmp', '/var/tmp', '/dev/shm'];
const LIMIT_MS = { agent: (Number(env.RUN_TIMEOUT_MIN || 40) + 5) * 60_000, export: 8 * 60_000, android: 15 * 60_000, git: 2 * 60_000, remove: 2 * 60_000 };
/** Android jobs at once (a Gradle JVM each; the API counts one as two run slots): MAX_ANDROID_JOBS. */
const MAX_ANDROID = Number(env.MAX_ANDROID_JOBS || 1);
/** The Android toolchain the job sees (deploy/api/Dockerfile); the API passes nothing of it. */
const ANDROID = {
  javaHome: env.JAVA_HOME || '/opt/android/jdk',
  androidHome: env.ANDROID_HOME || '/opt/android/sdk',
  gradleSeed: env.GRADLE_SEED || '/opt/android/gradle-home',
  icons: env.ANDROID_ICONS || '/opt/typeplay/android/icons',
};
const PREPARE = join(dirname(fileURLToPath(import.meta.url)), 'android-prepare.mjs');
/** A job body may carry at most one small file (the Android icon), written into the job's home. */
const MAX_BODY = 2 << 20;
const MAX_FILE = 1 << 20;
const GIT_COMMANDS = new Set(['rev-parse', 'reset', 'clean', 'read-tree', 'commit', 'add', 'init', 'status', 'log']);
const PASS_ENV = new Set(['ANTHROPIC_BASE_URL', 'ANTHROPIC_API_KEY', 'AGENT_AUTH']);
/** Processes one job's user may have at once (prlimit --nproc): a fork bomb from an agent's shell
 * can't take the runner-wide pids_limit (compose.yaml) from the other jobs. */
const MAX_PROCS = Number(env.RUNNER_MAX_PROCS || 512);
const PRLIMIT = existsSync('/usr/bin/prlimit') ? '/usr/bin/prlimit' : null;
/** A game folder bigger than this after an agent job fails the job (the API resets the folder). */
const MAX_PROJECT_BYTES = Number(env.RUNNER_MAX_PROJECT_MB || 512) * (1 << 20);
/** A job's output: one line is at most this long, and past MAX_OUTPUT bytes the rest is dropped. */
const MAX_LINE = 64 << 10;
const MAX_OUTPUT = 50 << 20;
const SECRET = /^(DATABASE_URL|DIRECT_URL|SUPABASE_\w+|R2_\w+|CLOUDFLARE_\w+|HETZNER_\w+|GOOGLE_\w+|ANTHROPIC_\w+|CLAUDE_CODE_OAUTH_\w+|ANDROID_KEY_\w+|GODOT_ANDROID_KEYSTORE_\w+|SIGNER_\w+|PADDLE_\w+)$/;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const die = (msg) => { console.error(`runner: ${msg}`); process.exit(1); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- start-up checks -----------------------------------------------------------------------------

if (process.getuid?.() !== 0) die('must run as root: it switches every job to a throwaway user');
const leaked = Object.keys(env).filter((k) => SECRET.test(k));
if (leaked.length) die(`refusing to start: ${leaked.join(', ')} must not be in the runner's environment`);

// /data and /data/projects: the API's, traversable (not listable) by the slot users, who reach only
// the folder they own during their job.
for (const d of [DATA, PROJECTS]) {
  mkdirSync(d, { recursive: true });
  chownSync(d, OWNER.uid, OWNER.gid);
  chmodSync(d, 0o711);
}
// The API's own folders under /data (run records; the run logs, which carry players' prompts):
// the API's, and nobody else's: slot users traverse /data but can't enter these.
for (const d of [AGENT_LOGS, join(DATA, 'logs')]) {
  mkdirSync(d, { recursive: true });
  chownSync(d, OWNER.uid, OWNER.gid);
  chmodSync(d, 0o700);
}
mkdirSync(HOMES, { recursive: true });
chmodSync(HOMES, 0o711);

// --- users, files, processes ---------------------------------------------------------------------

const uidOf = (slot) => UID_BASE + slot - 1;

/** lchown a whole tree without following symlinks. `normalize` (on the way back to the API) also
 * drops setuid/setgid/sticky bits and makes sure the owner can read and enter everything. */
function chownTree(path, uid, gid, normalize = false) {
  let st;
  try { st = lstatSync(path); } catch { return; }
  lchownSync(path, uid, gid);
  if (st.isSymbolicLink()) return;
  if (normalize) chmodSync(path, (st.mode & 0o777) | (st.isDirectory() ? 0o700 : 0o600));
  if (st.isDirectory()) for (const name of readdirSync(path)) chownTree(join(path, name), uid, gid, normalize);
}

function uidsOfProcess(pid) {
  try {
    const line = readFileSync(`/proc/${pid}/status`, 'utf8').match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)/m);
    return line ? line.slice(1, 4).map(Number) : [];
  } catch { return []; }
}

function pidsOf(uid) {
  const pids = [];
  for (const name of readdirSync('/proc')) {
    if (/^\d+$/.test(name) && uidsOfProcess(name).includes(uid)) pids.push(Number(name));
  }
  return pids;
}

/** Freezes (SIGSTOP), then kills every process of `uid` until none is left: a fork bomb can't
 * refill the pids the kills free while it is stopped. True when the uid is clean. */
async function killUser(uid) {
  for (let round = 0; round < 40; round++) {
    let found = 0;
    for (const sig of ['SIGSTOP', 'SIGKILL']) {
      for (const pid of pidsOf(uid)) {
        found++;
        try { process.kill(pid, sig); } catch { /* gone already */ }
      }
    }
    if (!found) return true;
    await sleep(50);
  }
  return pidsOf(uid).length === 0;
}

/** How big a tree is, counted only up to `budget` (symlinks are not followed). */
function treeSize(path, budget) {
  let st;
  try { st = lstatSync(path); } catch { return 0; }
  if (st.isSymbolicLink()) return 0;
  if (!st.isDirectory()) return st.size;
  let total = 0;
  for (const name of readdirSync(path)) {
    total += treeSize(join(path, name), budget - total);
    if (total > budget) break;
  }
  return total;
}

/** A job's stdout as lines, never holding more than MAX_LINE of one line (the rest is dropped,
 * "…[cut]" appended) and reading no more than MAX_OUTPUT in all: a newline-free flood from an
 * agent's shell must not grow this process, which every player's build goes through. Past
 * MAX_OUTPUT, `onOverflow` runs once (the job is stopped: it would otherwise run on to its limit). */
function readLines(stream, onLine, onOverflow) {
  const dec = new StringDecoder('utf8');
  let buf = '', dropping = false, total = 0, over = false;
  stream.on('data', (chunk) => {
    total += chunk.length;
    if (total > MAX_OUTPUT) { if (!over) { over = true; onOverflow?.(); } return; }
    let text = dec.write(chunk);
    for (let i; (i = text.indexOf('\n')) >= 0; ) {
      const head = text.slice(0, i);
      text = text.slice(i + 1);
      if (dropping) dropping = false;
      else { onLine(buf + head); buf = ''; }
    }
    if (dropping || !text) return;
    buf += text;
    if (buf.length > MAX_LINE) { onLine(buf.slice(0, MAX_LINE) + '…[cut]'); buf = ''; dropping = true; }
  });
  stream.on('end', () => { buf += dec.end(); if (buf && !dropping && total <= MAX_OUTPUT) onLine(buf); });
}

/** What the user left in the shared temp folders (the hidden-browser lock, browser profiles…). */
function cleanTemp(uid) {
  for (const dir of TMP_DIRS) {
    let names = [];
    try { names = readdirSync(dir); } catch { continue; }
    for (const name of names) {
      const p = join(dir, name);
      try { if (lstatSync(p).uid === uid) rmSync(p, { recursive: true, force: true }); } catch { /* gone already */ }
    }
  }
}

/** A fresh, private home: Godot's export templates (shared, read-only) are linked in. */
function prepareHome(home, uid) {
  rmSync(home, { recursive: true, force: true });
  mkdirSync(join(home, '.local', 'share', 'godot'), { recursive: true });
  symlinkSync(TEMPLATES, join(home, '.local', 'share', 'godot', 'export_templates'));
  mkdirSync(join(home, 'tmp'));
  mkdirSync(join(home, 'logs'));
  chownTree(home, uid, uid);
  chmodSync(home, 0o700);
}

/** Reads a small regular file the job wrote, never following a symlink. */
function readOwnFile(path, max = 5 << 20) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > max) return null;
    const buf = Buffer.alloc(st.size);
    readSync(fd, buf, 0, st.size, 0);
    return buf;
  } catch { return null; } finally { if (fd !== undefined) closeSync(fd); }
}

/** The run's records (runs.jsonl) and check errors (errors.jsonl) into /data/agent-logs. */
function collectLogs(home) {
  try { if (!lstatSync(join(home, 'logs')).isDirectory()) return; } catch { return; }
  for (const f of ['runs.jsonl', 'errors.jsonl']) {
    const buf = readOwnFile(join(home, 'logs', f));
    if (buf?.length) appendFileSync(join(AGENT_LOGS, f), buf.toString('utf8').replace(/\n?$/, '\n'));
  }
}

// --- slots and per-project order ------------------------------------------------------------------

const free = Array.from({ length: SLOTS }, (_, i) => i + 1);
const waiting = [];
const acquire = () => (free.length ? Promise.resolve(free.shift()) : new Promise((r) => waiting.push(r)));
const releaseSlot = (slot) => { const next = waiting.shift(); if (next) next(slot); else free.push(slot); };
/** Slots whose user still had processes after the job: never reused while that is so (they would own
 * the next tenant's folder and home). Tried again every 30 s; back in use once the uid is clean. */
const retired = new Set();
function retireSlot(slot) {
  const uid = uidOf(slot);
  retired.add(slot);
  console.error(`${new Date().toISOString()} slot ${slot} (uid ${uid}) still has processes that would not die: retired until they are gone`);
  const timer = setInterval(async () => {
    if (!(await killUser(uid))) return;
    clearInterval(timer);
    retired.delete(slot);
    cleanTemp(uid);
    log(`slot ${slot} is clean again: back in use`);
    releaseSlot(slot);
  }, 30_000);
}
// Android jobs: at most MAX_ANDROID at once across all projects (a Gradle JVM each), in order of arrival.
let androidActive = 0;
const androidWaiting = [];
const acquireAndroid = () => (androidActive < MAX_ANDROID ? (androidActive++, Promise.resolve()) : new Promise((r) => androidWaiting.push(r)));
const releaseAndroid = () => { const next = androidWaiting.shift(); if (next) next(); else androidActive--; };

// Jobs on one project run one after another (a cancel's clean-up finishes before the API's git reset).
const projectTail = new Map();
function lockProject(project) {
  const before = projectTail.get(project) ?? Promise.resolve();
  let unlock;
  const mine = new Promise((r) => (unlock = r));
  const tail = before.then(() => mine);
  projectTail.set(project, tail);
  return before.then(() => () => { unlock(); if (projectTail.get(project) === tail) projectTail.delete(project); });
}

// --- jobs -----------------------------------------------------------------------------------------

class JobError extends Error {}

/** Checks the job and gets the folder ready; returns the commands to run, in order. */
function plan(job, dir, uid, home) {
  let args = Array.isArray(job.args) ? job.args : [];
  if (args.length > 24 || !args.every((a) => typeof a === 'string' && a.length <= 8000)) throw new JobError('bad args');
  const git = existsSync(join(dir, '.git'));
  if (job.kind === 'remove') {
    rmSync(dir, { recursive: true, force: true });
    return [];
  }
  if (job.kind === 'agent') {
    // The prompt goes in a file only this job's user can read, not in argv: /proc/<pid>/cmdline is
    // readable by every other job's user. It is moved out first, so the flag checks below look at
    // flags only (a player's prompt may be any text, "--dir" included).
    const at = args.indexOf('--prompt');
    let prompt = null;
    if (at >= 0 && at + 1 < args.length) {
      prompt = args[at + 1];
      args = [...args.slice(0, at), ...args.slice(at + 2)];
    }
    if (args.includes('--dir') || args.includes('--game')) throw new JobError('the runner sets the folder');
    if (args.includes('--prompt-file')) throw new JobError('the runner sets the prompt file');
    if (prompt !== null) {
      const file = join(home, 'prompt.txt');
      writeFileSync(file, prompt, { mode: 0o600 });
      chownSync(file, uid, uid);
      args = ['--prompt-file', file, ...args];
    }
    if (args.includes('--edit')) {
      if (!git) throw new JobError('no game in this project');
      chownTree(dir, uid, uid);
    } else {
      rmSync(dir, { recursive: true, force: true }); // a first build always starts clean
      mkdirSync(dir, { mode: 0o700 });
      chownSync(dir, uid, uid);
    }
    return [{ cmd: process.execPath, args: [AGENT, '--dir', dir, ...args], cwd: dirname(AGENT) }];
  }
  if (job.kind === 'export') {
    if (!existsSync(join(dir, 'project.godot'))) throw new JobError('no game in this project');
    chownTree(dir, uid, uid);
    const godot = (...a) => ({ cmd: GODOT, args: ['--headless', '--path', dir, ...a], cwd: dir });
    // As the job's user, never as root: the folder is the agent's, symlinks included.
    const folders = { cmd: '/bin/sh', args: ['-c', 'mkdir -p export/web && : > export/.gdignore'], cwd: dir };
    return [folders, godot('--import'), godot('--export-release', 'Web', 'export/web/index.html')];
  }
  if (job.kind === 'android') {
    if (!git) throw new JobError('no game in this project');
    const a = androidArgs(args);
    // The icon the API passed (the poster or the user's PNG): into the home, the job user's, before the chown.
    const files = job.files && typeof job.files === 'object' ? Object.entries(job.files) : [];
    if (files.length > 1) throw new JobError('at most one file');
    let icon = '';
    for (const [name, b64] of files) {
      if (name !== 'icon.png' || typeof b64 !== 'string') throw new JobError('bad file');
      const bytes = Buffer.from(b64, 'base64');
      if (bytes.length > MAX_FILE) throw new JobError('file too big');
      mkdirSync(join(home, 'in'));
      icon = join(home, 'in', 'icon.png');
      writeFileSync(icon, bytes, { mode: 0o600 });
      chownTree(join(home, 'in'), uid, uid);
    }
    chownTree(dir, uid, uid);
    const build = join(home, 'build');
    const game = join(build, 'game');
    const out = join(build, 'out', `game.${a.format}`);
    const godot = (...x) => ({ cmd: GODOT, args: ['--headless', '--path', game, ...x], cwd: game });
    // Committed files only (no .godot/, no export/, no hooks run): the agent's folder is never written.
    const archive = { cmd: '/bin/sh', args: ['-c', `mkdir -p "$HOME/build/game" "$HOME/build/out" && git -c safe.directory='*' -C "${dir}" archive --format=tar ${a.commit} | tar -x -C "$HOME/build/game"`], cwd: dir };
    const prepare = { cmd: process.execPath, args: [PREPARE, '--game', game, '--format', a.format, '--package', a.packageName, '--version-code', String(a.versionCode),
      '--version-name', a.versionName, '--app-name', a.appName, '--orientation', a.orientation, '--out', join(build, 'out'), '--icons', ANDROID.icons,
      '--godot', GODOT, '--gradle-seed', ANDROID.gradleSeed, '--gradle-home', join(home, '.gradle'), ...(icon ? ['--icon', icon, '--icon-kind', a.iconKind] : [])], cwd: build };
    const exportFlags = a.format === 'aab' ? ['--install-android-build-template'] : [];
    // The unsigned file goes into the game's gdignored export/ folder, where the API reads it (readGameFile) and removes it.
    const deliver = { cmd: '/bin/sh', args: ['-c', `mkdir -p "${dir}/export/android" && cp "${out}" "${dir}/export/android/unsigned-${a.buildId}.${a.format}"`], cwd: dir };
    return [archive, prepare, godot('--import'), godot(...exportFlags, '--export-release', 'Android', out), deliver];
  }
  if (job.kind === 'git') {
    if (!GIT_COMMANDS.has(args[0])) throw new JobError(`git ${args[0]} is not allowed`);
    if (!existsSync(dir)) throw new JobError('no such project folder');
    chownTree(dir, uid, uid);
    return [{ cmd: 'git', args: ['-c', 'user.name=game-agent', '-c', 'user.email=agent@local', '-c', 'safe.directory=*', ...args], cwd: dir }];
  }
  throw new JobError(`unknown job kind ${job.kind}`);
}

/** The Android job's flags, each checked: nothing from them reaches a shell unchecked. */
function androidArgs(args) {
  const flag = (name) => {
    const i = args.indexOf(name);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : '';
  };
  const a = {
    commit: flag('--commit'), format: flag('--format'), packageName: flag('--package'), versionCode: Number(flag('--version-code')),
    versionName: flag('--version-name'), appName: flag('--app-name'), orientation: flag('--orientation') || 'portrait', buildId: flag('--build-id'),
    iconKind: flag('--icon-kind') || 'poster',
  };
  if (!/^[0-9a-f]{40}$/.test(a.commit)) throw new JobError('bad commit');
  if (a.format !== 'apk' && a.format !== 'aab') throw new JobError('bad format');
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(a.packageName) || a.packageName.length > 80) throw new JobError('bad package name');
  if (!Number.isInteger(a.versionCode) || a.versionCode < 1 || a.versionCode > 2100000000) throw new JobError('bad version code');
  if (!/^[0-9][0-9.]{0,30}$/.test(a.versionName)) throw new JobError('bad version name');
  if (!a.appName || a.appName.length > 30 || /[\p{Cc}]/u.test(a.appName)) throw new JobError('bad app name');
  if (a.orientation !== 'portrait' && a.orientation !== 'landscape') throw new JobError('bad orientation');
  if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(a.buildId)) throw new JobError('bad build id');
  if (!['poster', 'own', 'placeholder'].includes(a.iconKind)) throw new JobError('bad icon kind');
  return a;
}

function jobEnv(slot, home, extra, kind) {
  const e = {
    PATH: `${dirname(process.execPath)}:/usr/local/bin:/usr/bin:/bin`, // the runner's node first
    HOME: home,
    USER: `run${slot}`,
    LOGNAME: `run${slot}`,
    SHELL: '/bin/bash', // Claude Code's Bash tool
    LANG: 'C.UTF-8',
    TMPDIR: join(home, 'tmp'),
    CLAUDE_CODE_TMPDIR: join(home, 'tmp'),
    GODOT_EXE: GODOT,
    GODOT_VERSION: env.GODOT_VERSION || '4.7.2',
    BROWSER_EXE: env.BROWSER_EXE || '/usr/bin/chromium',
    // In a container Chromium's own sandbox can't start; the job's user and container are the sandbox.
    BROWSER_ARGS: env.BROWSER_ARGS ?? '--no-sandbox --disable-dev-shm-usage',
    ...BROWSER_LOCK_ENV,
    ASSET_LIBRARY: env.ASSET_LIBRARY || '/assets',
    AGENT_LOG_DIR: join(home, 'logs'),
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    DISABLE_AUTOUPDATER: '1',
  };
  for (const [k, v] of Object.entries(extra ?? {})) if (PASS_ENV.has(k) && typeof v === 'string') e[k] = v;
  if (kind === 'android') {
    // Godot's editor settings default to these on a fresh home; Gradle runs from the job's own copy of the seed.
    Object.assign(e, {
      JAVA_HOME: ANDROID.javaHome, ANDROID_HOME: ANDROID.androidHome, GRADLE_SEED: ANDROID.gradleSeed, ANDROID_ICONS: ANDROID.icons,
      GRADLE_USER_HOME: join(home, '.gradle'), GRADLE_OPTS: '-Dorg.gradle.daemon=false', PATH: `${ANDROID.javaHome}/bin:${e.PATH}`,
    });
  }
  return e;
}
// No cross-process browser lock here (packages/agent/tools/web.mjs): the container caps the CPU
// of all jobs together, and a lock in a shared folder is one a dead job's user leaves behind for
// every other job to wait on.
const BROWSER_LOCK_ENV = { TYPEPLAY_BROWSER_LOCK: '0' };

async function runJob(job, req, res) {
  const project = String(job.project ?? '');
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(project)) return answer(res, 400, 'bad project id');
  if (!(job.kind in LIMIT_MS)) return answer(res, 400, 'bad job kind');
  let gone = false;
  let stop = null;
  res.on('close', () => { gone = true; stop?.(); });
  const unlock = await lockProject(project);
  if (job.kind === 'android') await acquireAndroid();
  const slot = await acquire();
  const uid = uidOf(slot);
  const home = join(HOMES, `slot${slot}`);
  const dir = join(PROJECTS, project);
  const t0 = Date.now();
  const send = (o) => { if (!res.destroyed && !res.writableEnded) res.write(JSON.stringify(o) + '\n'); };
  // The answer goes out only after the clean-up: when the API hears "done", the folder is its own again.
  let refusal = null, exit = null;
  try {
    if (gone) return;
    let steps;
    try {
      prepareHome(home, uid);
      steps = plan(job, dir, uid, home);
    } catch (e) {
      refusal = [e instanceof JobError ? 400 : 500, e.message];
      return;
    }
    res.writeHead(200, { 'content-type': 'application/x-ndjson' });
    let code = 0, signal = null;
    const deadline = Date.now() + LIMIT_MS[job.kind];
    for (const step of steps) {
      if (gone) break;
      ({ code, signal } = await runStep(step, slot, home, job.env, send, deadline, (fn) => (stop = fn), job.kind));
      if (code !== 0) break;
    }
    if (gone) return;
    // A game folder that grew past the limit fails the job (the API then resets the folder): there
    // is no disk quota per job, so this is what keeps one run from filling the disk for good.
    if (job.kind === 'agent' && code === 0) {
      const size = treeSize(dir, MAX_PROJECT_BYTES);
      if (size > MAX_PROJECT_BYTES) {
        refusal = [500, `the game folder is over ${Math.round(MAX_PROJECT_BYTES / (1 << 20))} MB (${Math.round(size / (1 << 20))} MB): too big to keep`];
        return;
      }
    }
    exit = { x: code, s: signal };
  } finally {
    stop = null;
    const clean = await killUser(uid);
    cleanTemp(uid);
    if (existsSync(dir)) {
      chownTree(dir, OWNER.uid, OWNER.gid, true);
      chmodSync(dir, 0o700);
    }
    collectLogs(home);
    rmSync(home, { recursive: true, force: true });
    if (clean) releaseSlot(slot);
    else retireSlot(slot);
    if (job.kind === 'android') releaseAndroid();
    unlock();
    if (refusal) answer(res, ...refusal);
    else if (exit) { send(exit); res.end(); }
    log(`${job.kind} ${project} on slot ${slot}: ${((Date.now() - t0) / 1000).toFixed(1)} s` +
      (refusal ? ` (refused: ${refusal[1]})` : exit ? ` (exit ${exit.x ?? exit.s})` : ' (stopped by the API)'));
  }
}

function runStep(step, slot, home, extraEnv, send, deadline, setStop, kind) {
  return new Promise((resolve) => {
    const uid = uidOf(slot);
    // prlimit (util-linux, in the image) caps the user's process count, then runs the step.
    const [cmd, args] = PRLIMIT ? [PRLIMIT, [`--nproc=${MAX_PROCS}`, '--', step.cmd, ...step.args]] : [step.cmd, step.args];
    const child = spawn(cmd, args, {
      cwd: step.cwd, env: jobEnv(slot, home, extraEnv, kind), uid, gid: uid, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    // Under memory pressure the kernel kills game work before the runner itself.
    try { writeFileSync(`/proc/${child.pid}/oom_score_adj`, '800'); } catch { /* gone already */ }
    const kill = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone already */ } void killUser(uid); };
    setStop(kill);
    const timer = setTimeout(kill, Math.max(1000, deadline - Date.now()));
    const flood = () => { send({ e: `stopped: the job wrote more than ${MAX_OUTPUT >> 20} MB of output\n` }); kill(); };
    readLines(child.stdout, (line) => send({ o: line }), flood);
    // stderr: the first 1 MB goes to the API; past MAX_OUTPUT the job is stopped, like stdout.
    let stderrBytes = 0, stderrOver = false;
    child.stderr.on('data', (d) => {
      stderrBytes += d.length;
      if (stderrBytes <= 1 << 20) send({ e: String(d) });
      else if (stderrBytes > MAX_OUTPUT && !stderrOver) { stderrOver = true; flood(); }
    });
    child.on('error', (e) => { clearTimeout(timer); send({ e: `could not start ${step.cmd}: ${e.message}\n` }); resolve({ code: 127, signal: null }); });
    child.on('close', (code, signal) => { clearTimeout(timer); resolve({ code, signal }); });
  });
}

function answer(res, status, err) {
  if (res.headersSent) { if (!res.writableEnded) res.end(JSON.stringify({ err }) + '\n'); return; }
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ err }));
}

// --- server ---------------------------------------------------------------------------------------

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, slots: SLOTS, free: free.length, waiting: waiting.length, retired: retired.size, android: androidActive }));
  }
  if (req.method !== 'POST' || req.url !== '/jobs') return answer(res, 404, 'not found');
  const chunks = [];
  let size = 0;
  req.on('data', (c) => { size += c.length; if (size <= MAX_BODY) chunks.push(c); });
  req.on('end', () => {
    let job;
    try { job = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return answer(res, 400, 'bad JSON'); }
    if (size > MAX_BODY) return answer(res, 413, 'too large');
    runJob(job, req, res).catch((e) => { log(`job failed: ${e.stack ?? e}`); answer(res, 500, 'runner error'); });
  });
});

// Left over from a runner that stopped mid-job: no user owns a game folder between jobs, and each
// folder is closed again (0700) as at the normal end of a job: the agent may have opened it up.
for (const name of existsSync(PROJECTS) ? readdirSync(PROJECTS) : []) {
  const p = join(PROJECTS, name);
  try {
    const st = lstatSync(p);
    if (st.uid !== OWNER.uid) chownTree(p, OWNER.uid, OWNER.gid, true);
    if (st.isDirectory()) chmodSync(p, 0o700);
  } catch { /* gone already */ }
}
for (let slot = 1; slot <= SLOTS; slot++) {
  await killUser(uidOf(slot));
  cleanTemp(uidOf(slot));
  rmSync(join(HOMES, `slot${slot}`), { recursive: true, force: true });
}

// The socket: only root and the API's group may open it (not the slot users).
mkdirSync(dirname(SOCKET), { recursive: true });
chownSync(dirname(SOCKET), 0, OWNER.gid);
chmodSync(dirname(SOCKET), 0o750);
rmSync(SOCKET, { force: true });
server.listen(SOCKET, () => {
  chownSync(SOCKET, 0, OWNER.gid);
  chmodSync(SOCKET, 0o660);
  log(`runner on ${SOCKET}: ${SLOTS} slots (uid ${UID_BASE}-${uidOf(SLOTS)}), projects in ${PROJECTS}`);
});

const shutdown = async () => {
  server.close();
  for (let slot = 1; slot <= SLOTS; slot++) await killUser(uidOf(slot));
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
