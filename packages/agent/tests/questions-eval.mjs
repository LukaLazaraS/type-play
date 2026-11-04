// Tries the questions call (tools/questions.mjs) on real words: Haiku calls only, no game builds. Each sample request is
// asked as a new game (with its picks) or as a change (with sample notes), and a markdown table is printed (request,
// what should happen, what did, the call's cost) with the questions under it.
//   node tests/questions-eval.mjs [--only <n,n,…>]
// On this PC the calls run on the Claude Code login (Luka's Max); the cost is the API-price estimate the SDK reports.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { limitThisProcess } from '../tools/cpu.mjs';
import { askQuestions } from '../tools/questions.mjs';

limitThisProcess();
// run.mjs's ISOLATED options for a no-tools Haiku call.
const OPTIONS = {
  model: 'claude-haiku-5-5', effort: 'low', tools: [], maxTurns: 1,
  settingSources: [], settings: { disableClaudeAiConnectors: true }, strictMcpConfig: true, mcpServers: {}, skills: [],
};
const NOTES = '# Robo Run\nAn endless runner: a little robot runs over a desert and jumps over cactuses; it gets faster over time.\n'
  + 'Controls: tap, click or Space to jump.\nScore: distance in metres, best score saved.\nMust not break: the jump, the speed-up, restart after a crash.';

// [kind, request, picks, should it ask: "ask" | "none" | "either"]
const SAMPLES = [
  ['new', 'make a game', {}, 'ask'],
  ['new', 'a space game', {}, 'ask'],
  ['new', 'something with dinosaurs', {}, 'ask'],
  ['new', 'a game for my little sister', {}, 'ask'],
  ['new', 'a game about cats', { genre: 'puzzle' }, 'either'],
  ['new', 'a space game', { genre: 'shooter', tags: ['retro'] }, 'either'],
  ['new', 'Make an endless runner where a little robot jumps over cactuses and it gets faster over time.', {}, 'none'],
  ['new', 'Match-3 with fruit, 10 levels, each with a target score and a move limit', {}, 'none'],
  ['new', 'snake, but you are a cat eating fish', {}, 'none'],
  ['new', 'A tower defence game where you place cannons to stop slimes walking down a path', {}, 'none'],
  ['new', 'игра про драконов', {}, 'ask'],
  ['new', 'თამაში მანქანებზე', {}, 'ask'],
  ['new', 'Un jeu de course de voitures en 3D sur une plage, vue de derrière la voiture', {}, 'none'],
  ['edit', 'add a second player', {}, 'either'],
  ['edit', 'Add a double jump', {}, 'none'],
  ['edit', 'make it better', {}, 'either'],
  ['edit', 'Make the robot red and a bit faster', {}, 'none'],
  ['edit', 'change the controls', {}, 'either'],
];

const only = (() => {
  const i = process.argv.indexOf('--only');
  return i >= 0 ? new Set(process.argv[i + 1].split(',').map(Number)) : null;
})();
const picked = SAMPLES.map((s, n) => [n + 1, ...s]).filter(([n]) => !only || only.has(n));

const rows = [];
// Three at a time: each call starts a Claude Code process (another night may share the PC).
for (let i = 0; i < picked.length; i += 3) {
  rows.push(...(await Promise.all(picked.slice(i, i + 3).map(async ([n, kind, request, picks, want]) => {
    const t0 = Date.now();
    const r = await askQuestions({ request, kind, picks, notes: kind === 'edit' ? NOTES : '', query, options: OPTIONS });
    return { n, kind, request, picks, want, r, s: (Date.now() - t0) / 1000 };
  }))));
}

const usd = (x) => `$${x.toFixed(4)}`;
let wrong = 0;
let total = 0;
console.log('| # | Kind | Request | Picks | Want | Got | Cost | Time |');
console.log('|---|---|---|---|---|---|---|---|');
for (const { n, kind, request, picks, want, r, s } of rows) {
  const got = r.questions ? `ask ${r.questions.items.length}` : 'none';
  const right = want === 'either' || (want === 'ask') === !!r.questions;
  if (!right) wrong++;
  total += r.costUsd;
  const p = [picks.genre, ...(picks.tags ?? [])].filter(Boolean).join(', ') || '';
  console.log(`| ${n} | ${kind} | ${request} | ${p} | ${want} | ${got}${right ? '' : ' ✗'} | ${usd(r.costUsd)} | ${s.toFixed(1)} s |`);
}
console.log(`\n${rows.length - wrong} of ${rows.length} as wanted; ${usd(total)} in all\n`);
for (const { n, request, r } of rows) {
  if (!r.questions) {
    if (!r.answer.includes('"ask": false') && !r.answer.includes('"ask":false')) console.log(`#${n} "${request}": no questions; answer: ${r.answer.slice(0, 300)}\n`);
    continue;
  }
  console.log(`#${n} "${request}" (lang ${r.questions.lang ?? '-'}, own "${r.questions.own ?? '-'}")\n  ${r.questions.intro}`);
  for (const q of r.questions.items) console.log(`  [${q.label}] ${q.text}  ->  ${q.options.join(' | ')} | ${r.questions.decide}`);
  console.log('');
}
