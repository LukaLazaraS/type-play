// Capacity measurement of the build check (docs/research/build-capacity-2026-11-07.md): runs one or more
// `packages/agent/tools/check.mjs` jobs at once inside the live runner's limits and samples memory and CPU over time.
// Linux only (this PC's WSL), never the live server. Set up once with scripts/capacity/setup-wsl.sh.
//
// The runner container (deploy/api/compose.yaml: cpus 3.0, mem_limit = memswap_limit 5632m, pids_limit 4096) becomes a
// delegated systemd scope with the same cgroup v2 limits (the mechanism Docker uses); pool.mjs splits it per job as
// runner.mjs does. Every job gets a fresh copy of its game (no import cache: a first build's check). Below-normal
// priority (nice 10) and a CPU cap of a few cores keep this PC usable (CLAUDE.md).
//
//   node measure.mjs --label three-shared --games snow2d,house3d,match3heavy [--stagger 0,20,40]
//        [--pool-mem 5632M] [--pool-cpu 200] [--job-mem 2G] [--browser-mem 1536M] [--lock] [--agent-mb 600]
// --pool-cpu is in % of one of this PC's threads: 200 ≈ the CPX32 runner's 3 vCPU (build-capacity-2026-10-26.md).
// Output: ~/tp-measure/results/<label>/ samples.jsonl (every 0.5 s), jobs.jsonl, <job>.out, summary.txt.
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i < 0 ? def : args[i + 1]; };
const flag = (name) => args.includes(`--${name}`);
const M = join(homedir(), 'tp-measure');
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const label = opt('label', `run-${Date.now()}`).replace(/[^a-z0-9-]/gi, '');
const games = opt('games', 'snow2d').split(',');
const stagger = opt('stagger', '0').split(',').map(Number);
const out = join(M, 'results', label);
// Short paths: Chrome makes a Unix socket under TMPDIR, and those paths stop at 107 characters (a long work folder kept
// the browser from starting; the server's /home/runs/slotN/tmp is short).
const work = join(M, 'w');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const kv = (text) => Object.fromEntries(text.trim().split('\n').filter(Boolean).map((l) => { const [k, v] = l.split(/\s+/); return [k, Number(v)]; }));
const toBytes = (s) => (s ? Number(String(s).replace(/([KMG])$/i, (m) => '')) * ({ K: 1024, M: 1 << 20, G: 1 << 30 }[String(s).slice(-1).toUpperCase()] ?? 1) : 0);

rmSync(out, { recursive: true, force: true });
rmSync(work, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
mkdirSync(join(work, 'lock'), { recursive: true });

// The current check, copied (the repo is on the Windows disk; jobs read it from Linux's).
const tools = join(M, 'agent', 'tools');
rmSync(join(M, 'agent'), { recursive: true, force: true });
mkdirSync(tools, { recursive: true });
for (const f of ['check.mjs', 'web.mjs', 'colours.mjs', 'cpu.mjs']) cpSync(join(REPO, 'packages', 'agent', 'tools', f), join(tools, f));

const jobs = games.map((game, i) => {
  // url:<build id> plays a public build from typeplay.dev (play-public.mjs) instead of checking a game copy.
  const url = game.startsWith('url:') ? game.slice(4) : null;
  const name = `j${i + 1}-${url ? `url-${url}` : game}`;
  const project = join(work, `g${i + 1}`);
  const home = join(work, `h${i + 1}`);
  if (url) mkdirSync(project, { recursive: true });
  else cpSync(join(M, 'games', game), project, { recursive: true });
  mkdirSync(join(home, '.local', 'share', 'godot'), { recursive: true });
  symlinkSync(join(M, 'home', '.local', 'share', 'godot', 'export_templates'), join(home, '.local', 'share', 'godot', 'export_templates'));
  for (const d of ['tmp', 'logs']) mkdirSync(join(home, d), { recursive: true });
  return { name, game, url, project, home, tmp: join(home, 'tmp'), logs: join(home, 'logs'), startAfterSec: stagger[i] ?? stagger.at(-1) ?? 0 };
});

const cfg = {
  outDir: out,
  jobs,
  nodeDir: dirname(process.execPath),
  check: join(tools, 'check.mjs'),
  tools,
  playPublic: join(dirname(fileURLToPath(import.meta.url)), 'play-public.mjs'),
  godot: join(homedir(), 'tp-android', 'godot', 'godot'),
  chrome: opt('chrome', join(M, 'dl', 'cft', 'chrome-linux64', 'chrome')),
  libPath: join(M, 'libs', 'usr', 'lib', 'x86_64-linux-gnu'),
  lock: flag('lock'),
  lockDir: join(work, 'lock'),
  jobMem: opt('job-mem') ? toBytes(opt('job-mem')) : 0,
  browserMem: opt('browser-mem') ? toBytes(opt('browser-mem')) : 0,
  agentMb: Number(opt('agent-mb', 0)),
  browserSlots: Number(opt('browser-slots', 0)),
};
writeFileSync(join(out, 'config.json'), JSON.stringify({ ...cfg, args }, null, 1));

const poolMem = opt('pool-mem', '5632M');
const poolCpu = opt('pool-cpu', '200');
const unit = `tpm-${label}`;
const scope = spawn('systemd-run', ['--user', '--scope', '--quiet', `--unit=${unit}`, '-p', 'Delegate=yes',
  '-p', `MemoryMax=${poolMem}`, '-p', 'MemorySwapMax=0', '-p', `CPUQuota=${poolCpu}%`, '-p', 'TasksMax=4096',
  '--', 'nice', '-n', '10', process.execPath, join(dirname(fileURLToPath(import.meta.url)), 'pool.mjs'), join(out, 'config.json')],
{ stdio: ['ignore', 'inherit', 'inherit'] });
let scopeDone = false;
scope.on('close', () => { scopeDone = true; });

for (let i = 0; i < 100 && !existsSync(join(out, 'pool.json')); i++) await sleep(100);
const { pool: POOL } = JSON.parse(read(join(out, 'pool.json')));

// --- sampling --------------------------------------------------------------------------------------------------------
const kindOf = (cmd) => {
  const a = cmd.split('\0');
  const exe = a[0] || '';
  const s = cmd.replace(/\0/g, ' ');
  if (/godot$/.test(exe)) {
    if (s.includes('--import')) return 'godot:import';
    if (s.includes('--export-release') && s.includes('.stress')) return 'godot:stress-export';
    if (s.includes('--export-release')) return 'godot:export';
    if (s.includes('stress_test.tscn')) return 'godot:stress-test';
    if (s.includes('res://test/')) return 'godot:tests';
    return 'godot:run';
  }
  if (/crashpad/.test(exe)) return 'chrome:crashpad';
  if (/chrome|chromium/.test(exe)) {
    const t = s.match(/--type=([a-z-]+)/);
    return t ? `chrome:${t[1]}` : 'chrome:browser';
  }
  if (s.includes('check.mjs')) return 'node:check';
  if (s.includes('Buffer.alloc')) return 'agent-standin';
  if (/^\/bin\/sh|^sh$/.test(exe)) return 'sh';
  return `other:${exe.split('/').pop()}`;
};
const PAGE = 4096;
const prevCpu = new Map();
const prevCg = new Map();
let prevT = Date.now();
const t0 = Date.now();
const samples = join(out, 'samples.jsonl');

function sample() {
  const now = Date.now();
  const dt = (now - prevT) / 1000;
  prevT = now;
  const row = { t: +((now - t0) / 1000).toFixed(1), pool: {}, cg: {}, proc: [] };
  const ps = kv(read(join(POOL, 'memory.stat')));
  row.pool = { cur: Number(read(join(POOL, 'memory.current')) || 0), anon: ps.anon, file: ps.file, shmem: ps.shmem, kernel: ps.kernel, oom: kv(read(join(POOL, 'memory.events'))).oom_kill ?? 0 };
  let names = [];
  try { names = readdirSync(POOL, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); } catch { return; }
  for (const n of names) {
    const dir = join(POOL, n);
    const st = kv(read(join(dir, 'memory.stat')));
    const usage = kv(read(join(dir, 'cpu.stat'))).usage_usec ?? 0;
    const prev = prevCg.get(n);
    prevCg.set(n, usage);
    row.cg[n] = { cur: Number(read(join(dir, 'memory.current')) || 0), anon: st.anon, file: st.file, shmem: st.shmem, cpu: prev == null ? 0 : +((usage - prev) / 1e6 / dt).toFixed(2), oom: kv(read(join(dir, 'memory.events'))).oom_kill ?? 0 };
    for (const pid of read(join(dir, 'cgroup.procs')).trim().split('\n').filter(Boolean)) {
      const cmd = read(`/proc/${pid}/cmdline`);
      if (!cmd) continue;
      const stat = read(`/proc/${pid}/stat`).split(') ')[1]?.split(' ') ?? [];
      const ticks = Number(stat[11] || 0) + Number(stat[12] || 0);
      const p = prevCpu.get(pid);
      prevCpu.set(pid, ticks);
      const roll = kv(read(`/proc/${pid}/smaps_rollup`).split('\n').slice(1).map((l) => l.replace(/:\s+/, ' ').replace(/ kB$/, '')).join('\n'));
      row.proc.push({ pid: Number(pid), cg: n, kind: kindOf(cmd), pss: (roll.Pss ?? 0) * 1024, anon: ((roll.Pss_Anon ?? 0) + (roll.Pss_Shmem ?? 0)) * 1024, rss: (roll.Rss ?? 0) * 1024, cpu: p == null ? 0 : +((ticks - p) / 100 / dt).toFixed(2) });
    }
  }
  appendFileSync(samples, JSON.stringify(row) + '\n');
}

while (!scopeDone) {
  sample();
  await sleep(500);
}
sample();

// --- summary ---------------------------------------------------------------------------------------------------------
const GB = (b) => (b / (1 << 30)).toFixed(2);
const rows = read(samples).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const ended = read(join(out, 'jobs.jsonl')).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const poolEnd = JSON.parse(read(join(out, 'pool-end.json')) || '{}');
const lines = [];
lines.push(`${label}: games ${games.join(', ')}; pool ${poolMem} / CPU ${poolCpu}%${cfg.lock ? '; one browser at a time' : ''}${cfg.browserSlots ? `; at most ${cfg.browserSlots} browsers at once (flock slots)` : ''}${cfg.jobMem ? `; per job ${opt('job-mem')}` : ''}${cfg.browserMem ? `; per browser ${opt('browser-mem')}` : ''}${cfg.agentMb ? `; agent stand-in ${cfg.agentMb} MB a job` : ''}; stagger ${stagger.join(',')} s`);
const poolPeakSampled = Math.max(...rows.map((r) => r.pool.cur));
const poolAnonPeak = Math.max(...rows.map((r) => (r.pool.anon ?? 0) + (r.pool.shmem ?? 0)));
lines.push(`pool: kernel peak ${GB(poolEnd.peak ?? 0)} GB (sampled ${GB(poolPeakSampled)}; anon+shmem at most ${GB(poolAnonPeak)} GB); OOM kills ${poolEnd.events?.oom_kill ?? '?'}; CPU ${((poolEnd.cpuUsec ?? 0) / 1e6).toFixed(0)} CPU-s over ${rows.at(-1)?.t ?? 0} s`);
for (const j of ended) {
  // The job's stages over time: which process kind held most of its memory in each sample, collapsed into segments.
  const segs = [];
  let browserN = 0;
  const seenBrowser = new Set();
  for (const r of rows) {
    const mine = r.proc.filter((p) => p.cg === j.job || p.cg.startsWith(`${j.job}-b`));
    if (!mine.length) continue;
    for (const p of mine) if (p.kind === 'chrome:browser' && !seenBrowser.has(p.pid)) { seenBrowser.add(p.pid); browserN++; }
    const chrome = mine.filter((p) => p.kind.startsWith('chrome'));
    const godot = mine.find((p) => p.kind.startsWith('godot'));
    const stage = chrome.length ? `browser ${browserN}` : godot ? godot.kind.slice(6) : 'node';
    const memJob = (r.cg[j.job]?.cur ?? 0) + Object.entries(r.cg).filter(([n]) => n.startsWith(`${j.job}-b`)).reduce((s, [, c]) => s + c.cur, 0);
    const anonJob = mine.reduce((s, p) => s + p.anon, 0);
    const chromeAnon = chrome.reduce((s, p) => s + p.anon, 0);
    const cpu = (r.cg[j.job]?.cpu ?? 0) + Object.entries(r.cg).filter(([n]) => n.startsWith(`${j.job}-b`)).reduce((s, [, c]) => s + c.cpu, 0);
    const last = segs.at(-1);
    if (last && last.stage === stage) { last.to = r.t; last.mem = Math.max(last.mem, memJob); last.anon = Math.max(last.anon, anonJob); last.chrome = Math.max(last.chrome, chromeAnon); last.cpu.push(cpu); }
    else segs.push({ stage, from: r.t, to: r.t, mem: memJob, anon: anonJob, chrome: chromeAnon, cpu: [cpu] });
  }
  const bPeaks = j.browsers?.length ? `; browsers' own peaks ${j.browsers.map((b) => `${GB(b.peak)}${b.events?.oom_kill ? ` (OOM ${b.events.oom_kill})` : ''}`).join(', ')} GB` : '';
  lines.push(`\n${j.job}: ${j.verdict} in ${j.wallSec.toFixed(0)} s, exit ${j.code}; job peak ${GB(j.peak)} GB (kernel), OOM kills ${j.events?.oom_kill ?? 0}; ${(j.cpuUsec / 1e6).toFixed(0)} CPU-s${bPeaks}`);
  for (const e of j.errors) lines.push(`   ${e.slice(0, 220)}`);
  for (const s of j.speed) lines.push(`   ${s.slice(0, 220)}`);
  for (const s of segs) {
    const avg = s.cpu.reduce((a, b) => a + b, 0) / s.cpu.length;
    lines.push(`   ${String(s.from).padStart(6)}-${String(s.to).padEnd(6)} s  ${s.stage.padEnd(14)} job ${GB(s.mem)} GB (anon ${GB(s.anon)}, of it browser ${GB(s.chrome)})  CPU avg ${avg.toFixed(2)} max ${Math.max(...s.cpu).toFixed(2)}`);
  }
}
const waits = read(join(out, 'slot-waits.jsonl')).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
if (waits.length) {
  const byJob = {};
  for (const w of waits) (byJob[w.job] ??= []).push(Math.round(w.waitedMs / 1000));
  lines.push(`\nwaits for a browser slot (s): ${Object.entries(byJob).map(([j, ws]) => `${j} ${ws.join('+')}`).join('; ')}`);
}
writeFileSync(join(out, 'summary.txt'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
spawnSync('systemctl', ['--user', 'reset-failed', `${unit}.scope`], { stdio: 'ignore' });
rmSync(work, { recursive: true, force: true });
