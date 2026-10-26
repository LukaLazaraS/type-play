// The genre and tags measurement's table (markdown): each build's credits as the app charges them (the kept attempts +
// the player message + the ideas, ÷ $0.06, rounded up to 0.1: apps/server credits.ts creditsForUsd), its minutes and
// turns, then each tag against the same genre with no tags.
//   node tests/tags-eval/table.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', '..', 'output', '_tags-eval');
const credits = (usd) => Math.max(1, Math.ceil((usd / 0.06) * 10 - 1e-9)) / 10;

const rows = readdirSync(OUT).filter((f) => f.endsWith('.json')).map((f) => {
  const r = JSON.parse(readFileSync(join(OUT, f), 'utf8'));
  const rec = r.record;
  const ok = !!rec?.ok;
  const usd = ok ? rec.chargeUsd + rec.messageCostUsd + (rec.suggestionsCostUsd ?? 0) : 0;
  return { ...r, ok, credits: ok ? credits(usd) : 0, minutes: rec?.minutes ?? r.wallMinutes, turns: rec?.attempts?.reduce((s, a) => s + (a.turns ?? 0), 0) };
});
const genres = [...new Set(rows.map((r) => r.genre))];
const ways = [...new Set(rows.map((r) => r.way))].sort((a, b) => (a === 'none' ? -1 : b === 'none' ? 1 : a.localeCompare(b)));
rows.sort((x, y) => genres.indexOf(x.genre) - genres.indexOf(y.genre) || ways.indexOf(x.way) - ways.indexOf(y.way));

console.log('| Genre | Tags | Credits | Minutes | Turns |');
console.log('|---|---|--:|--:|--:|');
for (const r of rows) console.log(`| ${r.genre} | ${r.tags.join(' + ') || 'none'} | ${r.ok ? r.credits.toFixed(1) : 'failed'} | ${r.minutes} | ${r.turns ?? ''} |`);

const pct = (x, y) => `${x >= y ? '+' : ''}${Math.round(((x - y) / y) * 100)}%`;
console.log('\n| Tag | Genres | Credits with it | Without | Credits | Minutes with it | Without | Minutes |');
console.log('|---|--:|--:|--:|--:|--:|--:|--:|');
for (const way of ways.filter((w) => w !== 'none')) {
  const pairs = genres.map((g) => [rows.find((r) => r.genre === g && r.way === way), rows.find((r) => r.genre === g && r.way === 'none')]).filter(([a, b]) => a?.ok && b?.ok);
  if (!pairs.length) continue;
  const sum = (i, k) => +pairs.reduce((s, p) => s + p[i][k], 0).toFixed(1);
  const [cw, cn, mw, mn] = [sum(0, 'credits'), sum(1, 'credits'), sum(0, 'minutes'), sum(1, 'minutes')];
  console.log(`| ${way} | ${pairs.length} | ${cw} | ${cn} | ${pct(cw, cn)} | ${mw} | ${mn} | ${pct(mw, mn)} |`);
}
