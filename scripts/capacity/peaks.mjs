// Peak memory per process kind for measure.mjs results (docs/research/build-capacity-2026-11-07.md): for each result
// folder, the pool's peak of memory the kernel can't drop (anon + shmem) and of the page cache, and each kind's peak
// (proportional set size of its private and shared memory, summed over its processes, per sample).
//   node peaks.mjs <label> [...]   (in WSL; results in ~/tp-measure/results)
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const G = (b) => (b / 2 ** 30).toFixed(2);
for (const label of process.argv.slice(2)) {
  let rows;
  try { rows = readFileSync(join(homedir(), 'tp-measure', 'results', label, 'samples.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch { continue; }
  const kinds = {};
  let browsersAtOnce = 0;
  for (const r of rows) {
    const by = {};
    for (const p of r.proc) {
      const k = p.kind.startsWith('chrome') ? 'browser' : p.kind.startsWith('godot') ? 'godot' : p.kind;
      by[k] = (by[k] || 0) + p.anon;
    }
    for (const [k, v] of Object.entries(by)) kinds[k] = Math.max(kinds[k] || 0, v);
    browsersAtOnce = Math.max(browsersAtOnce, r.proc.filter((p) => p.kind === 'chrome:browser').length);
  }
  const anon = Math.max(...rows.map((r) => (r.pool.anon || 0) + (r.pool.shmem || 0)));
  const file = Math.max(...rows.map((r) => r.pool.file || 0));
  const cur = Math.max(...rows.map((r) => r.pool.cur || 0));
  const oom = Math.max(...rows.map((r) => r.pool.oom || 0));
  console.log(`${label}: pool peak ${G(cur)} GB (anon+shmem ${G(anon)}, cache ${G(file)}), OOM kills ${oom}, browsers at once ${browsersAtOnce}; peaks by kind: ${Object.entries(kinds).filter(([, v]) => v > 20e6).map(([k, v]) => `${k} ${G(v)}`).join(', ')}`);
}
