// The platform measurement's table (markdown): credits as the app charges them (the kept attempts + the player
// message + the ideas, ÷ $0.06, rounded up to 0.1: apps/server credits.ts creditsForUsd), build minutes, and how
// each game works per device (verdicts.json: written by hand after looking at the device sheets, devices.mjs).
//   node tests/platform-eval/table.mjs
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'output', '_platform-eval');
const PROMPTS = JSON.parse(readFileSync(join(HERE, 'prompts.json'), 'utf8'));
const verdicts = existsSync(join(HERE, 'verdicts.json')) ? JSON.parse(readFileSync(join(HERE, 'verdicts.json'), 'utf8')) : {};
const WAY = { a: '(a) today', b: '(b) base rules', c: '(c) fills every screen' };
const credits = (usd) => Math.max(1, Math.ceil((usd / 0.06) * 10 - 1e-9)) / 10;
const MARK = { ok: '✓', part: '~', no: '✗' };

const rows = [];
for (const f of readdirSync(OUT).filter((f) => /^[a-z0-9]+-[abc]\.json$/.test(f))) {
  const r = JSON.parse(readFileSync(join(OUT, f), 'utf8'));
  const rec = r.record;
  const ok = !!rec?.ok;
  const usd = ok ? rec.chargeUsd + rec.messageCostUsd + (rec.suggestionsCostUsd ?? 0) : 0;
  rows.push({ ...r, ok, credits: ok ? credits(usd) : 0, spentUsd: rec ? rec.costUsd + rec.messageCostUsd + (rec.suggestionsCostUsd ?? 0) : 0,
    minutes: rec?.minutes ?? r.wallMinutes, turns: rec?.attempts?.reduce((s, a) => s + (a.turns ?? 0), 0), v: verdicts[r.id] ?? {} });
}
const order = PROMPTS.map((p) => p.id);
rows.sort((x, y) => order.indexOf(x.prompt) - order.indexOf(y.prompt) || x.way.localeCompare(y.way));

const cell = (v, key) => (v[key] ? `${MARK[v[key]] ?? v[key]}` : '');
console.log('| Game | Way | Credits | Minutes | Turns | iPhone | iPad | Laptop | Notes |');
console.log('|---|---|--:|--:|--:|:-:|:-:|:-:|---|');
for (const r of rows) {
  const p = PROMPTS.find((q) => q.id === r.prompt);
  console.log(`| ${r.prompt} (${p.kind}) | ${WAY[r.way]} | ${r.ok ? r.credits.toFixed(1) : `failed (${r.spentUsd ? `$${r.spentUsd.toFixed(2)} spent` : 'no record'})`} | ${r.minutes} | ${r.turns ?? ''} | ${cell(r.v, 'iphone')} | ${cell(r.v, 'ipad')} | ${cell(r.v, 'laptop')} | ${r.v.note ?? ''} |`);
}

// Totals per way: all six, the simple three, the complex three (built games only for credits; minutes for all).
console.log('\n| Way | Built | Credits, simple | Credits, complex | Credits, all | Minutes, all | Works on all three devices |');
console.log('|---|--:|--:|--:|--:|--:|--:|');
const sum = (list, k) => +list.reduce((s, r) => s + r[k], 0).toFixed(1);
const totals = {};
for (const w of ['a', 'b', 'c']) {
  const mine = rows.filter((r) => r.way === w);
  const built = mine.filter((r) => r.ok);
  const kind = (k) => built.filter((r) => PROMPTS.find((p) => p.id === r.prompt).kind === k);
  const works = mine.filter((r) => ['iphone', 'ipad', 'laptop'].every((d) => r.v[d] === 'ok')).length;
  totals[w] = { credits: sum(built, 'credits'), minutes: sum(mine, 'minutes') };
  console.log(`| ${WAY[w]} | ${built.length}/${mine.length} | ${sum(kind('simple'), 'credits')} | ${sum(kind('complex'), 'credits')} | ${totals[w].credits} | ${totals[w].minutes} | ${works}/${mine.length} |`);
}
if (totals.b?.credits && totals.c?.credits) {
  const pct = (x, y) => `${x >= y ? '+' : ''}${Math.round(((x - y) / y) * 100)}%`;
  console.log(`\n(c) against (b): credits ${pct(totals.c.credits, totals.b.credits)}, minutes ${pct(totals.c.minutes, totals.b.minutes)}`);
  if (totals.a?.credits) console.log(`(b) against (a): credits ${pct(totals.b.credits, totals.a.credits)}, minutes ${pct(totals.b.minutes, totals.a.minutes)}`);
}
