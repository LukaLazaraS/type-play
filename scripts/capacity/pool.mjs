// The "runner container" for a capacity measurement (scripts/capacity/measure.mjs starts it; docs/research/build-capacity-2026-11-07.md).
// Runs inside a delegated systemd scope that already has the runner's limits (memory.max, no swap, cpu.max, pids.max), as
// Docker gives the runner container in deploy/api/compose.yaml. Here it splits that scope as the runner splits its jobs:
//   <pool>/launcher        this process (cgroup v2 allows processes only in leaves)
//   <pool>/<job>           one check job: `node check.mjs` in its own game copy, oom_score_adj 800 like runner.mjs's jobs,
//                          plus an optional stand-in for the agent process (a few hundred MB held for the job's length)
//   <pool>/<job>-b<pid>    with a per-browser cap: each hidden browser in its own cgroup (memory.max), via a wrapper
// Optional per-job memory.max = "one container per run". Writes pool.json (its cgroup), then one line per job end in
// jobs.jsonl: exit code, wall time, the check's verdict, and the kernel's exact peaks (memory.peak) and OOM kills.
// Usage (from measure.mjs only): node pool.mjs <config.json>
import { spawn } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const out = cfg.outDir;
const cgRel = readFileSync('/proc/self/cgroup', 'utf8').trim().split('\n').find((l) => l.startsWith('0::')).slice(3);
const POOL = join('/sys/fs/cgroup', cgRel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const read = (f) => { try { return readFileSync(f, 'utf8'); } catch { return ''; } };
const kv = (text) => Object.fromEntries(text.trim().split('\n').filter(Boolean).map((l) => { const [k, v] = l.split(/\s+/); return [k, Number(v)]; }));

// Leave the pool's root for a leaf of our own, then hand the controllers down.
mkdirSync(join(POOL, 'launcher'));
writeFileSync(join(POOL, 'launcher', 'cgroup.procs'), String(process.pid));
writeFileSync(join(POOL, 'cgroup.subtree_control'), '+memory +cpu +pids');
writeFileSync(join(out, 'pool.json'), JSON.stringify({ pool: POOL, pid: process.pid, at: Date.now() }));

// BROWSER_EXE is this wrapper when browsers are capped or limited, then becomes the browser (exec keeps the DevTools
// pipes, fds 3 and 4, that web.mjs opened):
// - per-browser cap: it moves itself into a cgroup of its own with memory.max;
// - at most K browsers at once across all jobs: it takes one of K slot files with flock(1) and holds it as fd 9, which
//   the browser inherits; the kernel drops the lock when the browser dies, so a killed job never leaves a stale slot.
const slotsDir = join(out, 'slots');
mkdirSync(slotsDir, { recursive: true });
const wrapper = join(out, 'browser-wrap.sh');
writeFileSync(wrapper, [
  '#!/bin/bash',
  'if [ "$TPM_BROWSER_MEM" != max ]; then',
  '  d="$TPM_POOL/$TPM_JOB-b$$"',
  '  mkdir "$d" && echo 0 > "$d/memory.swap.max" && echo "$TPM_BROWSER_MEM" > "$d/memory.max" && echo $$ > "$d/cgroup.procs"',
  'fi',
  'if [ "${TPM_SLOTS:-0}" -gt 0 ]; then',
  '  t0=$(date +%s%N)',
  '  while :; do',
  '    for i in $(seq 1 "$TPM_SLOTS"); do',
  `      exec 9>"${slotsDir}/slot$i"`,
  '      if flock -n 9; then',
  `        echo "{\\"job\\":\\"$TPM_JOB\\",\\"slot\\":$i,\\"waitedMs\\":$(( ($(date +%s%N) - t0) / 1000000 ))}" >> "${join(out, 'slot-waits.jsonl')}"`,
  '        exec "$TPM_CHROME" "$@"',
  '      fi',
  '      exec 9>&-',
  '    done',
  '    sleep 0.3',
  '  done',
  'fi',
  'exec "$TPM_CHROME" "$@"',
  '',
].join('\n'));
chmodSync(wrapper, 0o755);

function jobStats(dir) {
  return {
    peak: Number(read(join(dir, 'memory.peak')) || 0),
    events: kv(read(join(dir, 'memory.events'))),
    cpuUsec: kv(read(join(dir, 'cpu.stat'))).usage_usec ?? 0,
  };
}

async function runJob(job) {
  await sleep(job.startAfterSec * 1000);
  const dir = join(POOL, job.name);
  mkdirSync(dir);
  writeFileSync(join(dir, 'memory.swap.max'), '0');
  if (cfg.jobMem) writeFileSync(join(dir, 'memory.max'), String(cfg.jobMem));
  const env = {
    PATH: `${cfg.nodeDir}:/usr/local/bin:/usr/bin:/bin`,
    HOME: job.home,
    TMPDIR: job.tmp,
    LANG: 'C.UTF-8',
    GODOT_EXE: cfg.godot,
    BROWSER_EXE: cfg.browserMem || cfg.browserSlots ? wrapper : cfg.chrome,
    BROWSER_ARGS: '--no-sandbox --disable-dev-shm-usage', // as runner.mjs gives every job
    TYPEPLAY_SERVER: '1',
    TYPEPLAY_BROWSER_LOCK: cfg.lock ? '1' : '0',
    BROWSER_LOCK_DIR: cfg.lockDir,
    AGENT_LOG_DIR: job.logs, // never the repo's learn/errors.jsonl
    LD_LIBRARY_PATH: cfg.libPath,
    TPM_POOL: POOL, TPM_JOB: job.name, TPM_SHOTS: out, TPM_CHROME: cfg.chrome, TPM_BROWSER_MEM: String(cfg.browserMem || 'max'), TPM_SLOTS: String(cfg.browserSlots || 0),
  };
  const t0 = Date.now();
  // The shell joins the job's cgroup first, so everything it starts is counted there.
  const enter = `echo $$ > '${dir}/cgroup.procs' && echo 800 > /proc/$$/oom_score_adj && `;
  let agent = null;
  if (cfg.agentMb) {
    // Stand-in for the agent (run.mjs + Claude Code): holds agentMb of touched memory for the job's length.
    agent = spawn('/bin/sh', ['-c', `${enter}exec ${cfg.nodeDir}/node -e "const b=Buffer.alloc(${cfg.agentMb}*1048576,1);setInterval(()=>b[0]++,1e4)"`], { stdio: 'ignore' });
  }
  // A job is the check in its game copy, or (job.url) a public build played by play-public.mjs.
  const run = job.url ? `node '${cfg.playPublic}' '${cfg.tools}' '${job.url}' 45` : `node '${cfg.check}'`;
  const child = spawn('/bin/sh', ['-c', `${enter}exec ${run}`], { cwd: job.project, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let text = '';
  child.stdout.on('data', (d) => { text += d; });
  child.stderr.on('data', (d) => { text += d; });
  appendFileSync(join(out, 'events.jsonl'), JSON.stringify({ t: Date.now(), job: job.name, event: 'start', pid: child.pid }) + '\n');
  const code = await new Promise((r) => child.on('close', (c, s) => r(c ?? s)));
  const wallSec = (Date.now() - t0) / 1000;
  const stats = jobStats(dir);
  const browsers = readdirSync(POOL).filter((n) => n.startsWith(`${job.name}-b`)).map((n) => ({ name: n, ...jobStats(join(POOL, n)) }));
  if (agent) { agent.kill('SIGKILL'); await new Promise((r) => agent.on('close', r)); }
  writeFileSync(join(out, `${job.name}.out`), text);
  const verdict = (text.match(/^CHECK: .*$/m) || ['CHECK: (none: the check died)'])[0];
  const errors = text.split('\n').filter((l) => /^ {2}\[/.test(l)).slice(0, 8);
  const speed = text.split('\n').filter((l) => /^speed at|^start freezes/.test(l));
  appendFileSync(join(out, 'jobs.jsonl'), JSON.stringify({ job: job.name, game: job.game, code, wallSec, verdict, errors, speed, ...stats, browsers }) + '\n');
  appendFileSync(join(out, 'events.jsonl'), JSON.stringify({ t: Date.now(), job: job.name, event: 'end', code }) + '\n');
  for (const b of browsers) { try { rmdirSync(join(POOL, b.name)); } catch {} }
  try { rmdirSync(dir); } catch {}
}

await Promise.all(cfg.jobs.map(runJob));
const pool = { peak: Number(read(join(POOL, 'memory.peak')) || 0), events: kv(read(join(POOL, 'memory.events'))), cpuUsec: kv(read(join(POOL, 'cpu.stat'))).usage_usec ?? 0 };
writeFileSync(join(out, 'pool-end.json'), JSON.stringify(pool));
if (existsSync(join(POOL, 'launcher'))) { /* systemd removes the scope's tree when this process exits */ }
