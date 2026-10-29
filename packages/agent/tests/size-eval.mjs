// Tunes the size check (tools/size-check.mjs) on real words: Haiku calls only, no game builds. Every sample chat message
// is checked as sent to Fast and to Smart (a paid plan: the answer may offer the next AI up), and a markdown table is
// printed (message, Fast verdict, Smart verdict, the check's cost) with each stop's answer under it.
//   node tests/size-eval.mjs [--free]     (--free: the answers as a Free player gets them, with no bigger AI)
// On this PC the calls run on the Claude Code login (Luka's Max); the cost is the API-price estimate the SDK reports.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { limitThisProcess } from '../tools/cpu.mjs';
import { BIGGER, sizeCheck } from '../tools/size-check.mjs';

limitThisProcess();
const free = process.argv.includes('--free');
// run.mjs's ISOLATED options for a no-tools Haiku call.
const OPTIONS = {
  model: 'claude-haiku-5-5', effort: 'low', tools: [], maxTurns: 1,
  settingSources: [], settings: { disableClaudeAiConnectors: true }, strictMcpConfig: true, mcpServers: {}, skills: [],
};

// [kind, message, what Fast should say, what Smart should say]: the range Luka asked for (10-29). "fits?" marks a
// borderline one, where either answer is fine and fits is preferred.
const SAMPLES = [
  ['one tweak', 'Make the robot red', 'fits', 'fits'],
  ['one tweak', 'Make the jump a bit higher', 'fits', 'fits'],
  ['one fix', "The score doesn't reset when I restart, fix it", 'fits', 'fits'],
  ['two tweaks together', 'Make the robot red and a bit faster', 'fits', 'fits'],
  ['two tweaks together', 'Bigger buttons and a darker background', 'fits', 'fits'],
  ['one new feature', 'Add a double jump', 'fits', 'fits'],
  ['one new feature', 'Add a shield power-up that blocks one hit', 'fits', 'fits'],
  ['one new feature', 'Add a shop where you buy hats with coins', 'fits', 'fits'],
  ['one new feature', 'Add 10 new levels', 'fits?', 'fits'],
  ['one new feature (Georgian)', 'დაამატე ბოსი ბოლოს', 'fits', 'fits'],
  ['two features (live case)', 'Add 10 new levels and flying traps', 'too big', 'fits'],
  ['two features (live, other words)', 'can you make 10 new levels with flying traps in them', 'too big', 'fits'],
  ['two features', 'Add a shop and a boss at the end', 'too big', 'fits'],
  ['two features (Russian)', 'Добавь 10 новых уровней и летающие ловушки', 'too big', 'fits'],
  ['three features', 'Add three new enemy types, a level map with 20 levels, and achievements', 'too big', 'fits?'],
  ['several features', 'Add a shop, upgrades, a boss, daily challenges and a night mode', 'too big', 'too big'],
  ['a list of changes', 'Make the background blue, add music, add a high score, make the enemies faster and add a second player', 'too big', 'fits?'],
  ['rework', 'Turn it into a 3D racing game', 'too big', 'too big'],
  ['rework', 'Redo all the graphics in pixel art and change the controls to swipe', 'too big', 'too big?'],
  ['vague', 'Make it better', 'fits', 'fits'],
  ['vague', 'More fun please', 'fits', 'fits'],
];

const cell = async (message, key) => sizeCheck({ request: message, key, bigger: free ? null : BIGGER[key], query, options: OPTIONS });
const rows = [];
// Four at a time: each call starts a Claude Code process.
for (let i = 0; i < SAMPLES.length; i += 4) {
  rows.push(...(await Promise.all(SAMPLES.slice(i, i + 4).map(async ([kind, message, wantFast, wantSmart]) => {
    const [fast, smart] = await Promise.all([cell(message, 'haiku'), cell(message, 'sonnet')]);
    return { kind, message, wantFast, wantSmart, fast, smart };
  }))));
}

const verdict = (r, want) => {
  const got = r.fits ? 'fits' : 'too big';
  const right = want.replace('?', '') === got || want.endsWith('?');
  return `${got}${right ? '' : ' ✗'}`;
};
const usd = (n) => `$${n.toFixed(4)}`;
console.log('| Message | Kind | Fast | Smart | Check cost (Fast / Smart) |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.message} | ${r.kind} | ${verdict(r.fast, r.wantFast)} | ${verdict(r.smart, r.wantSmart)} | ${usd(r.fast.costUsd)} / ${usd(r.smart.costUsd)} |`);
const costs = rows.flatMap((r) => [r.fast.costUsd, r.smart.costUsd]).sort((a, b) => a - b);
const wrong = rows.flatMap((r) => [verdict(r.fast, r.wantFast), verdict(r.smart, r.wantSmart)]).filter((v) => v.endsWith('✗')).length;
console.log(`\n${costs.length} checks: median ${usd(costs[costs.length >> 1])}, max ${usd(costs.at(-1))}, total ${usd(costs.reduce((s, c) => s + c, 0))}; ${wrong} against the expected verdict (✗)`);
console.log(`\nThe stops' answers${free ? ' (Free: no bigger AI)' : ''}:`);
for (const r of rows) {
  for (const [name, c] of [['Fast', r.fast], ['Smart', r.smart]]) if (!c.fits) console.log(`- ${name}, "${r.message}": ${c.reply.replace(/\s*\n\s*/g, ' ')}`);
}
// The jobs the check saw, for every message (where a verdict went wrong, they say why), and answers out of format.
console.log('\nThe jobs (Fast / Smart):');
const jobs = (c) => c.jobs.map((j) => `${j.kind}: ${j.what}`).join(' | ') || '(none)';
for (const r of rows) {
  const marks = [verdict(r.fast, r.wantFast), verdict(r.smart, r.wantSmart)].some((v) => v.endsWith('✗')) ? '✗ ' : '';
  console.log(`- ${marks}"${r.message}": ${jobs(r.fast)} / ${jobs(r.smart)}`);
}
const odd = rows.flatMap((r) => [r.fast, r.smart]).filter((c) => !c.jobs.length || !/^\W*message\W/im.test(c.answer));
if (odd.length) console.log(`\nAnswers out of format (no jobs or no message):\n${odd.map((c) => `- ${JSON.stringify(c.answer.slice(0, 200))}`).join('\n')}`);
