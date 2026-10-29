// Checks the size check's rule and how its answer is read, with no model call: node tests/size-check.mjs
// (The words themselves are tuned with real Haiku calls in tests/size-eval.mjs.)
import assert from 'node:assert/strict';
import { BIGGER, fits, NAMES, SIZED, sizePrompt, verdict } from '../tools/size-check.mjs';

const jobs = (...kinds) => kinds.map((kind) => ({ kind, what: kind }));

// Best is never checked; the next AI up is offered from Fast and Smart only.
assert.deepEqual(SIZED, ['haiku', 'sonnet']);
assert.equal(SIZED.includes('opus'), false, 'Best gets no check');
assert.deepEqual(BIGGER, { haiku: 'sonnet', sonnet: 'opus' });

// Fast: one job; every tweak in a message together is one job.
assert.ok(fits(jobs('tweak'), 'haiku'));
assert.ok(fits(jobs('tweak', 'tweak', 'tweak'), 'haiku'), 'tweaks together are one job');
assert.ok(fits(jobs('feature'), 'haiku') && fits(jobs('levels'), 'haiku') && fits(jobs('fix'), 'haiku') && fits(jobs('vague'), 'haiku'));
assert.ok(!fits(jobs('levels', 'feature'), 'haiku'), 'the live case: 10 levels and flying traps');
assert.ok(!fits(jobs('feature', 'tweak'), 'haiku') && !fits(jobs('fix', 'feature'), 'haiku'));
assert.ok(!fits(jobs('rework'), 'haiku'));
// Smart: a few jobs; too big for a rework or three or more features and level sets.
assert.ok(fits(jobs('levels', 'feature'), 'sonnet') && fits(jobs('feature', 'feature', 'tweak', 'fix', 'tweak'), 'sonnet'));
assert.ok(!fits(jobs('feature', 'levels', 'feature'), 'sonnet') && !fits(jobs('rework'), 'sonnet'));

// The answer: a stop needs jobs that break the rule and a message; anything else lets the build go.
const live = 'JOB: levels: 10 new levels\nJOB: feature: flying traps\nLANGUAGE: English\nMESSAGE: Ten new levels and flying traps are two jobs.';
assert.deepEqual(verdict(live, 'haiku'), { fits: false, reply: 'Ten new levels and flying traps are two jobs.', jobs: [{ kind: 'levels', what: '10 new levels' }, { kind: 'feature', what: 'flying traps' }] });
assert.equal(verdict(live, 'sonnet').fits, true, 'two jobs fit Smart');
assert.equal(verdict(live.replace(/MESSAGE:.*/, ''), 'haiku').fits, true, 'no message: it builds');
assert.equal(verdict('', 'haiku').fits, true, 'no answer (a failed call): it builds');
assert.equal(verdict('Sure! This fits.', 'haiku').fits, true, 'out of format: it builds');
assert.equal(verdict('JOB: wizardry: everything\nJOB: magic: more\nMESSAGE: x', 'haiku').fits, true, 'unknown kinds are skipped');
// Markdown around the labels, and a message in another script, kept whole.
const ru = verdict('**JOB:** levels: 10 новых уровней\n- JOB: feature: летающие ловушки\n**MESSAGE:** «Добавь летающие ловушки» — сначала это.', 'haiku');
assert.equal(ru.fits, false);
assert.equal(ru.reply, '«Добавь летающие ловушки» — сначала это.');

// The prompt names the picked AI and offers the bigger one only when the plan has it.
assert.match(sizePrompt('Add a boss', 'haiku', 'sonnet'), /or picking Smart to do more at once/);
assert.doesNotMatch(sizePrompt('Add a boss', 'haiku', null), /picking|pick Smart|pick Best/);
assert.match(sizePrompt('Add a boss', 'sonnet', 'opus'), /too big for Smart[\s\S]*picking Best/);
assert.equal(NAMES.opus, 'Best');

console.log('size check: OK');
