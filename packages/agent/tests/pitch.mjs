// Checks the public line's rules in code, its file, and how an answer is read, with no model call: node tests/pitch.mjs
// (The words themselves are tried on real NOTES.md with real Haiku calls in tests/pitch-eval.mjs.)
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPitch, cleanPitch, makePitch, nameOf, PITCH_MAX, PITCH_MIN, PITCH_OPTIONS, pitchPrompt, readPitch, savePitch } from '../tools/pitch.mjs';

const good = 'Steer a red racer around a tropical island loop, hit boost pads and fire nitro to beat five rivals over three laps.';

// Tidying: the first line, no wrapping quotes, a full stop at the end, no "!" at the end.
assert.equal(cleanPitch(`"${good}"\nSecond line`), good);
assert.equal(cleanPitch(good.slice(0, -1)), good, 'a missing full stop is added');
assert.equal(cleanPitch(good.slice(0, -1) + '!'), good, 'a closing "!" becomes a full stop');
assert.equal(cleanPitch(`Sentence: ${good}`), good, 'a label before it goes');
assert.equal(cleanPitch('  Jump\u0007  over\t\tcactuses  '), 'Jump over cactuses.');

// The rules the code holds.
assert.deepEqual(checkPitch(good), { ok: true, text: good, why: '' });
const fails = (line, why, name) => {
  const c = checkPitch(line, { name });
  assert.equal(c.ok, false, `should fail (${why}): ${line}`);
  assert.match(c.why, why, line);
};
fails('Jump over cactuses.', /letters/);
fails('Run '.repeat(40), /letters/);
assert.equal(checkPitch('x'.repeat(PITCH_MIN - 2)).ok, false, 'its full stop counts');
assert.equal(checkPitch(`${'A'.repeat(PITCH_MAX - 1)}.`).ok, true, `${PITCH_MAX} letters is the top`);
fails(`${good.slice(0, -1)} at play.example.com.`, /link/);
fails(`${good.slice(0, -1)}, see https://x.gg/abc.`, /link/);
fails(`${good.slice(0, -1)} with @luka_games.`, /handle/);
fails(`${good.slice(0, -1)} #racing #fun.`, /handle/);
fails(`${good.slice(0, -1)} 🏎️.`, /emoji/);
fails('Steer a red racer around a tropical island loop. Hit boost pads and fire nitro to beat five rivals.', /one sentence/);
fails('ჩქარი მანქანით იარე კუნძულის გარშემო, გამოიყენე აჩქარება და აჯობე ხუთ მეტოქეს სამ წრეში ბოლომდე.', /English/);
fails('Steer a red racer around a tropical island loop and beat five AI rivals over three laps with nitro.', /made \("AI"\)/);
fails('Made with TypePlay: steer a red racer around a tropical island loop and beat five rivals over three laps.', /made/);
fails('A racer I built in Godot where you steer around a tropical island loop and beat five rivals over three laps.', /made|personal/);
fails('Steer a red racer around a tropical island loop and beat five rivals, made for my son on his birthday.', /personal/);
fails('Steer a red racer around the island and beat five rivals in the race our whole family loves to play.', /personal/);
fails('The ultimate island racer: steer around a tropical loop and beat five rivals over three laps with nitro.', /hype/);
fails('The best island racer around: steer a tropical loop and beat five rivals over three laps with nitro.', /hype/);
fails('Test your reflexes as you steer a red racer around a tropical island loop against five rivals.', /made \("Test"\)/);
fails('KEEP', /no line/);
// The game's own name may hold any word.
assert.equal(checkPitch('Pilot the AI Wars fleet through asteroid fields and blast enemy drones before your shields run out.', { name: 'AI Wars' }).ok, true);
// Allowed words that look close to the banned ones.
assert.equal(checkPitch('Crack the code of each vault by sliding gears into place before the alarm clock rings out at dawn.').ok, true);
assert.equal(checkPitch('Tap the falling notes in time with the beat to keep a neon city lit through twelve rising songs.').ok, true);
assert.equal(checkPitch('Race to the line through desert canyons and beat your best time on each of the six winding tracks.').ok, true, '"your best time" is no hype');

// The file: a plain small file with a line that passes; written and removed by savePitch.
const dir = mkdtempSync(join(tmpdir(), 'pitch-test-'));
try {
  writeFileSync(join(dir, 'project.godot'), 'config_version=5\n[application]\nconfig/name="Island \\"Rush\\""\n');
  assert.equal(nameOf(dir), 'Island "Rush"');
  assert.equal(readPitch(dir), '', 'no file: no line');
  assert.equal(savePitch(dir, good), true);
  assert.equal(readFileSync(join(dir, 'PITCH'), 'utf8'), `${good}\n`);
  assert.equal(savePitch(dir, good), false, 'the same line: unchanged');
  assert.equal(readPitch(dir), good);
  writeFileSync(join(dir, 'PITCH'), 'Visit scam.example.com for free coins in this little racer around a tropical island loop.\n');
  assert.equal(readPitch(dir), '', 'a line that fails the check is no line');
  assert.equal(savePitch(dir, ''), true);
  assert.equal(existsSync(join(dir, 'PITCH')), false, 'none: no file');
  mkdirSync(join(dir, 'PITCH'));
  assert.equal(readPitch(dir), '', 'a folder is no line');
  rmSync(join(dir, 'PITCH'), { recursive: true });

  // The prompt: the notes and the current line, never the player's words (it has no way to get them); KEEP only with a line.
  const p = pitchPrompt({ name: 'Island Rush', genre: 'racer', notes: '# Island Rush\nA racer.', current: good });
  assert.match(p, /"Island Rush", a racing game/);
  assert.match(p, /# Island Rush\nA racer\./);
  assert.ok(p.includes(good) && p.includes('reply KEEP'));
  assert.ok(!pitchPrompt({ name: 'X', genre: '', notes: 'n', current: '' }).includes('KEEP'), 'a game with no line has nothing to keep');
  assert.deepEqual(PITCH_OPTIONS.tools, [], 'no tools');
  assert.equal(PITCH_OPTIONS.maxTurns, 1);
  assert.deepEqual(PITCH_OPTIONS.settingSources, [], 'isolated');

  // How the call's answer is read (a stand-in for the SDK's query).
  const answering = (answer, cost = 0.0004) => async function* () {
    yield { type: 'result', subtype: 'success', result: answer, total_cost_usd: cost, modelUsage: { h: { inputTokens: 1000, outputTokens: 40, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 } } };
  };
  assert.equal((await makePitch({ dir, query: answering(good) })).action, 'skipped', 'no NOTES.md: no call');
  writeFileSync(join(dir, 'NOTES.md'), '# Island Rush\nTop-down racer on a tropical island, 5 rivals, 3 laps, boost pads, nitro.\n');
  let r = await makePitch({ dir, query: answering(`"${good}"`) });
  assert.equal(r.action, 'new');
  assert.equal(r.pitch, good);
  assert.equal(r.costUsd, 0.0004);
  assert.deepEqual(r.tokens, { input: 1000, output: 40, cacheRead: 0, cacheWrite: 0 });
  r = await makePitch({ dir, current: good, query: answering('KEEP') });
  assert.equal(r.action, 'kept');
  assert.equal(r.pitch, good);
  r = await makePitch({ dir, current: good, query: answering(good) });
  assert.equal(r.action, 'kept', 'the same line again is a keep');
  r = await makePitch({ dir, current: good, query: answering('The ultimate racer for my son, with epic boost pads and five rivals on an island loop.') });
  assert.equal(r.action, 'rejected');
  assert.equal(r.pitch, good, 'a rejected answer keeps the old line');
  assert.match(r.why, /personal|hype/);
  r = await makePitch({ dir, query: answering('KEEP') });
  assert.equal(r.action, 'rejected', 'nothing to keep');
  assert.equal(r.pitch, '');
  r = await makePitch({ dir, current: good, query: () => { throw new Error('session limit'); } });
  assert.equal(r.action, 'failed');
  assert.equal(r.pitch, good, 'a failed call keeps the old line');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('pitch: ok');
