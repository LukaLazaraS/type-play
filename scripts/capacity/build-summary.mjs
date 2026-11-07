// Summarises a build-sample.ps1 file (docs/research/build-capacity-2026-11-07.md): the build's stages over time (the AI
// working, or the check's Godot or Edge), and the peak and typical memory of each kind of process (private bytes, Windows).
//   node scripts/capacity/build-summary.mjs <samples.jsonl>
import { readFileSync } from 'node:fs';

const rows = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const MB = (b) => Math.round(b / 2 ** 20);
const groupOf = (k) => (k.startsWith('edge') ? 'edge' : k.startsWith('godot') ? 'godot' : k === 'claude' || k === 'node:run' ? 'agent' : k === 'node:check' ? 'check-node' : 'other');
const peak = {}, series = {};
const segs = [];
for (const r of rows) {
  const procs = [].concat(r.proc ?? []);
  const by = {};
  for (const p of procs) by[groupOf(p.kind)] = (by[groupOf(p.kind)] || 0) + p.priv;
  for (const [g, v] of Object.entries(by)) { peak[g] = Math.max(peak[g] || 0, v); (series[g] ??= []).push(v); }
  const stage = by.edge ? 'browser' : by.godot ? procs.find((p) => p.kind.startsWith('godot')).kind.slice(6) : by['check-node'] ? 'check' : 'AI';
  const cpu = procs.reduce((s, p) => s + (p.cpu || 0), 0);
  const last = segs.at(-1);
  if (last && last.stage === stage) { last.to = r.t; last.cpu.push(cpu); last.mem = Math.max(last.mem, Object.values(by).reduce((a, b) => a + b, 0)); }
  else segs.push({ stage, from: r.t, to: r.t, cpu: [cpu], mem: Object.values(by).reduce((a, b) => a + b, 0) });
}
const total = rows.at(-1).t;
const time = {};
for (const s of segs) time[s.stage] = (time[s.stage] || 0) + (s.to - s.from);
console.log(`build: ${(total / 60).toFixed(1)} min sampled; time by stage: ${Object.entries(time).map(([k, v]) => `${k} ${(v / 60).toFixed(1)} min (${Math.round((v / total) * 100)}%)`).join(', ')}`);
for (const [g, v] of Object.entries(series)) {
  const s = [...v].sort((a, b) => a - b);
  console.log(`${g}: peak ${MB(peak[g])} MB, median ${MB(s[s.length >> 1])} MB (private bytes)`);
}
console.log('\nstages (merged when shorter than 5 s):');
for (const s of segs.filter((x) => x.to - x.from >= 5 || x.stage === 'AI')) {
  const avg = s.cpu.reduce((a, b) => a + b, 0) / s.cpu.length;
  console.log(`  ${String(Math.round(s.from)).padStart(5)}-${String(Math.round(s.to)).padEnd(5)} s ${s.stage.padEnd(8)} up to ${MB(s.mem)} MB, CPU avg ${avg.toFixed(2)} cores`);
}
