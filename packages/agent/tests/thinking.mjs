// Checks the progress line for silent thinking with a fake clock: node tests/thinking.mjs
import assert from 'node:assert/strict';
import { thinkingLine, FIRST_AFTER_MS, EVERY_MS } from '../tools/thinking.mjs';

// What run.mjs does: a thinking event asks for a line; a tool line or text zeroes the thought and, if it
// changes the words on screen, restarts the clock of the line the player sees.
function play(events, isEdit) {
  const thinking = { since: 0 };
  let shown = { text: 'Making your change', since: 0 };
  const lines = [];
  for (const [t, kind, text] of events) {
    if (kind === 'think') {
      const line = thinkingLine(thinking, t, isEdit, shown);
      if (line && line !== shown.text) { shown = { text: line, since: t }; lines.push([Math.round(t / 1000), line]); }
    } else {
      thinking.since = 0;
      if (text && text !== shown.text) shown = { text, since: t };
    }
  }
  return lines;
}
const thinkEvery = (from, to) => { const out = []; for (let t = from; t <= to; t += 250) out.push([t, 'think']); return out; };

// A big Opus build: 12 minutes of thinking in one piece.
const build = play(thinkEvery(1_000, 12 * 60_000), false);
assert.equal(build[0][1], 'Planning your game…');
assert.ok(build[0][0] >= FIRST_AFTER_MS / 1000 && build[0][0] <= FIRST_AFTER_MS / 1000 + 2, 'the first line comes after ~8 s, not at once');
assert.match(build[1][1], /^Still planning: big games take a few minutes$/);
assert.match(build[2][1], /\(1 min so far\)/);
assert.match(build[3][1], /\(2 min so far\)/);
for (let i = 1; i < build.length; i++) assert.ok(build[i][0] - build[i - 1][0] >= EVERY_MS / 1000 - 1, 'a new line at most every ~45 s');
assert.ok(build.length >= 14 && build.length <= 17, `about one line per 45 s over 12 minutes (got ${build.length})`);
assert.equal(new Set(build.map((l) => l[1])).size, build.length, 'every line is different');

// A Haiku edit on a big game: thinking cut into pieces by tool calls that change no line (what the
// player saw before: "Reading the game" for 85 s). The line must still change.
const edit = play([
  [6_000, 'tool', 'Reading the game'], ...thinkEvery(7_000, 16_000), [16_500, 'tool', ''],
  ...thinkEvery(17_000, 47_000), [47_500, 'tool', ''], ...thinkEvery(48_000, 86_000), [86_500, 'tool', 'Changing the board'],
  ...thinkEvery(87_000, 89_000), [89_500, 'tool', 'Writing a test'], ...thinkEvery(90_000, 112_000), [112_500, 'tool', 'Testing the game'],
], true);
assert.deepEqual(edit.map((l) => l[1]), ['Planning your change…', 'Still planning: bigger changes take a few minutes', 'Planning your change…']);
assert.ok(edit[0][0] >= 14 && edit[0][0] <= 17, `planning line at ~14 s (got ${edit[0][0]})`);
assert.ok(edit[1][0] - edit[0][0] >= 44, 'the second line comes ~45 s after the first');
assert.ok(edit[2][0] >= 98 && edit[2][0] <= 101, 'a new planning line 8 s after "Writing a test" (got ' + edit[2][0] + ')');
assert.ok(!edit.some((l) => l[0] >= 87 && l[0] < 98), 'a 2 s thought after a tool line says nothing');

console.log('thinking progress: OK', JSON.stringify(build.slice(0, 4)), JSON.stringify(edit));
