// Checks tools/cpu.mjs: a developer PC keeps 4 cores free, the live server (TYPEPLAY_SERVER=1) none, and both lower the
// priority. Each case is a child process that limits itself and reports its cores before and after: node tests/cpu.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { availableParallelism } from 'node:os';

const CPU = new URL('../tools/cpu.mjs', import.meta.url).href;
// The child's allowed cores: Windows' affinity mask, Linux's Cpus_allowed_list (taskset sets both).
const PROBE = `
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getPriority } from 'node:os';
const { limitThisProcess, HEAVY_CORES, ON_SERVER } = await import(${JSON.stringify(CPU)});
const cores = () => {
  if (process.platform === 'win32') {
    const r = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-Process -Id ' + process.pid + ').ProcessorAffinity'], { encoding: 'utf8' });
    return [...BigInt(r.stdout.trim()).toString(2)].filter((b) => b === '1').length;
  }
  const list = /Cpus_allowed_list:\\s*(\\S+)/.exec(readFileSync('/proc/self/status', 'utf8'))[1];
  return list.split(',').reduce((n, part) => { const [a, b = a] = part.split('-').map(Number); return n + b - a + 1; }, 0);
};
const before = cores();
limitThisProcess();
console.log(JSON.stringify({ server: ON_SERVER, heavy: HEAVY_CORES, before, after: cores(), priority: getPriority() }));
`;

function run(env) {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', PROBE], { encoding: 'utf8', env: { ...process.env, TYPEPLAY_SERVER: '', ...env } });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}

const n = availableParallelism();
const pc = run({});
assert.equal(pc.server, false);
assert.equal(pc.heavy, Math.max(1, n - 4), 'a PC keeps 4 cores free');
assert.equal(pc.after, Math.min(pc.before, pc.heavy), `a PC's heavy work is pinned to ${pc.heavy} of ${n} cores`);
assert.equal(pc.priority, 10, 'below normal');

const server = run({ TYPEPLAY_SERVER: '1' });
assert.equal(server.server, true);
assert.equal(server.heavy, n, 'the server keeps none free: the container caps it');
assert.equal(server.after, server.before, 'the server pins nothing');
assert.equal(server.priority, 10, 'below normal on the server too');

// Only the variable says "server", whatever the core count.
assert.equal(run({ TYPEPLAY_SERVER: '0' }).server, false);

console.log(`cpu.mjs: PC ${pc.before} -> ${pc.after} cores, server ${server.before} -> ${server.after}, both below normal (${n} cores here)`);
