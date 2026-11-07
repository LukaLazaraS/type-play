// A build's timeline from its agent log (docs/research/build-capacity-2026-11-07.md): for each game folder, when the agent
// ran the check (a Bash call to tools/check.mjs, timed from the call to its result), when it ran Godot itself, and how
// much of the session was the AI thinking and writing. Reads <game>/.agent-log.jsonl (the SDK's messages with
// timestamps); run.mjs's own closing check and the asset capture come after the session and are not in it.
//   node scripts/capacity/build-timeline.mjs packages/agent/output/colour-2d-snow [...more folders]
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const rows = [];
for (const dir of process.argv.slice(2)) {
  const file = join(dir, '.agent-log.jsonl');
  if (!existsSync(file)) continue;
  const msgs = readFileSync(file, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  // A folder's log holds every session run in it (a build's steps, then edits): split at each init.
  const sessions = [];
  for (const m of msgs) {
    if (m.type === 'system' && m.subtype === 'init') sessions.push([]);
    sessions.at(-1)?.push(m);
  }
  sessions.forEach((s, i) => {
    const times = s.map((m) => Date.parse(m.timestamp)).filter(Number.isFinite);
    if (!times.length) return;
    const uses = new Map();
    for (const m of s) {
      if (m.type !== 'assistant') continue;
      for (const b of m.message?.content ?? []) {
        if (b.type === 'tool_use' && b.name === 'Bash') uses.set(b.id, { at: Date.parse(m.timestamp), cmd: String(b.input?.command ?? '') });
      }
    }
    const checks = [];
    const godot = [];
    for (const m of s) {
      if (m.type !== 'user') continue;
      for (const b of m.message?.content ?? []) {
        if (b.type !== 'tool_result' || !uses.has(b.tool_use_id)) continue;
        const u = uses.get(b.tool_use_id);
        const sec = (Date.parse(m.timestamp) - u.at) / 1000;
        if (/check\.mjs/.test(u.cmd)) checks.push(sec);
        else if (/godot/i.test(u.cmd)) godot.push(sec);
      }
    }
    const result = s.find((m) => m.type === 'result');
    const wall = (Math.max(...times) - Math.min(...times)) / 1000;
    const inCheck = checks.reduce((a, b) => a + b, 0);
    rows.push({
      game: basename(dir), session: i + 1, model: s[0]?.model, start: new Date(Math.min(...times)).toISOString().slice(0, 16),
      wallMin: +(wall / 60).toFixed(1), checks: checks.length, checkSec: checks.map((x) => Math.round(x)), checkShare: +(inCheck / wall).toFixed(2),
      godotCalls: godot.length, godotSec: Math.round(godot.reduce((a, b) => a + b, 0)), costUsd: result?.total_cost_usd,
    });
  });
}
for (const r of rows) {
  console.log(`${r.game} #${r.session} ${r.model} ${r.start}: ${r.wallMin} min, ${r.checks} checks (${r.checkSec.join(', ')} s) = ${Math.round(r.checkShare * 100)}% of the session; Godot by hand ${r.godotCalls}× ${r.godotSec} s; $${r.costUsd?.toFixed?.(3) ?? '?'}`);
}
if (process.argv.includes('--json')) console.log(JSON.stringify(rows));
