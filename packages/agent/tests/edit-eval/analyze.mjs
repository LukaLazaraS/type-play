// What one edit session did, from the game folder's .agent-log.jsonl.
//   node tests/edit-eval/analyze.mjs <gameDir> <session number, 1-based> <git ref the edit started from>
// A session = everything after the Nth `system:init` message (each run has one per attempt).
// Prints one JSON object: API calls, context size per call, tool counts, how much of the code the agent
// viewed (Read, Grep and Bash cat/sed/grep), thinking tokens, whole-file rewrites, checks it ran.
import { readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const [dirArg, sessArg = '1', baseRef = 'HEAD~1'] = process.argv.slice(2);
const dir = resolve(dirArg);
const all = readFileSync(join(dir, '.agent-log.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const starts = all.map((m, i) => (m.type === 'system' && m.subtype === 'init' ? i : -1)).filter((i) => i >= 0);
const n = Number(sessArg) - 1;
const msgs = all.slice(starts[n], starts[n + 1] ?? all.length);
const norm = (p) => relative(dir, resolve(dir, String(p || ''))).replaceAll('\\', '/');
const git = (...a) => spawnSync('git', a, { cwd: dir, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout || '';
const files = git('ls-tree', '-r', '--name-only', baseRef).split('\n').filter(Boolean);
const before = new Set(files);
const projectChars = files.filter((f) => /\.gd$/.test(f) && !f.startsWith('test/')).reduce((s, f) => s + git('show', `${baseRef}:${f}`).length, 0);

const calls = new Map(); const uses = []; const resultLen = new Map();
let thinkTotal = 0, thinkMax = 0, lastEst = 0, result = null;
for (const m of msgs) {
  if (m.type === 'result') result = m;
  if (m.type === 'system' && m.subtype === 'thinking_tokens') { // estimated_tokens counts up within one thought and starts again at the next
    const e = m.estimated_tokens || 0;
    if (e < lastEst) thinkTotal += lastEst;
    lastEst = e; thinkMax = Math.max(thinkMax, e);
  }
  if (m.type === 'assistant') {
    const id = m.message.id; const u = m.message.usage || {};
    if (!calls.has(id)) calls.set(id, (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0));
    for (const b of m.message.content || []) if (b.type === 'tool_use') uses.push({ id: b.id, name: b.name, input: b.input || {} });
  }
  if (m.type === 'user') for (const b of m.message.content || []) if (b.type === 'tool_result') {
    const t = typeof b.content === 'string' ? b.content : (b.content || []).map((x) => x.text || '').join('');
    resultLen.set(b.tool_use_id, t.length);
  }
}
thinkTotal += lastEst;
const ctxs = [...calls.values()];
const byTool = {}; const chars = {};
for (const u of uses) { byTool[u.name] = (byTool[u.name] || 0) + 1; chars[u.name] = (chars[u.name] || 0) + (resultLen.get(u.id) || 0); }
const bash = uses.filter((u) => u.name === 'Bash').map((u) => String(u.input.command || ''));
const isCheck = (c) => /check\.mjs/.test(c);
const isWrite = (c) => /<<\s*'?EOF/.test(c) || /\bcat\s*>/.test(c);
const viewing = uses.filter((u) => u.name === 'Bash' && /\b(cat|sed -n|head|tail|grep|rg|wc|ls)\b/.test(String(u.input.command || '')) && !isCheck(String(u.input.command || '')) && !isWrite(String(u.input.command || '')));
const viewChars = viewing.reduce((s, u) => s + (resultLen.get(u.id) || 0), 0) + (chars.Read || 0) + (chars.Grep || 0);
const edits = uses.filter((u) => u.name === 'Edit'); const writes = uses.filter((u) => u.name === 'Write');
console.log(JSON.stringify({
  apiCalls: calls.size, turns: result?.num_turns, ctxStartK: Math.round(ctxs[0] / 1000), ctxMaxK: Math.round(Math.max(0, ...ctxs) / 1000), over100k: ctxs.filter((c) => c > 100_000).length,
  tools: byTool,
  viewedCharsK: Math.round(viewChars / 1000), projectCharsK: Math.round(projectChars / 1000), viewedShare: projectChars ? +(viewChars / projectChars).toFixed(2) : null,
  editCalls: edits.length, filesEdited: new Set(edits.map((u) => norm(u.input.file_path))).size,
  writeCalls: writes.length, rewrites: writes.filter((u) => before.has(norm(u.input.file_path)) && !/NOTES\.md$/.test(u.input.file_path)).map((u) => norm(u.input.file_path)),
  checksByAgent: bash.filter(isCheck).length,
  thinkingTokens: thinkTotal, biggestThought: thinkMax,
  usd: +(result?.total_cost_usd || 0).toFixed(4), subtype: result?.subtype,
  durationMin: +((result?.duration_ms || 0) / 60000).toFixed(1), apiMin: +((result?.duration_api_ms || 0) / 60000).toFixed(1),
}));
