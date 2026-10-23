// One table of every measured edit (output/_edit-eval/runs/*.json), newest last:
//   node tests/edit-eval/table.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'output', '_edit-eval', 'runs');
const rows = readdirSync(RUNS).filter((f) => f.endsWith('.json') && !f.endsWith('-base.json')).map((f) => JSON.parse(readFileSync(join(RUNS, f), 'utf8'))).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
console.log('| id | model | ok | min | $ | credits | turns | ctx max | calls >100K | viewed | thinking | diff | old tests → after |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const s of rows) {
  const r = s.record || {}; const a = s.analysis || {};
  const d = s.diffTotals ? `${s.diffTotals.files}f +${s.diffTotals.add}/-${s.diffTotals.del}` : '-';
  const t = (o) => Object.entries(o || {}).map(([k, v]) => `${k.replace(/_test\.tscn$/, '')} ${v}`).join(', ');
  console.log(`| ${s.id} | ${s.model} | ${r.ok ? 'OK' : 'FAIL'} | ${r.minutes} | ${r.costUsd} | ${s.credits?.ifSucceeded} | ${r.attempts?.[0]?.turns} | ${a.ctxMaxK}K | ${a.over100k} | ${a.viewedShare} | ${a.thinkingTokens} | ${d} | ${t(s.beforeCheck?.tests)} → ${t(s.check?.tests)} |`);
}
