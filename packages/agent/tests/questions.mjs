// Checks how the questions call's answer is read and what its prompt says, with no model call: node tests/questions.mjs
// (The questions themselves are tried with real Haiku calls in tests/questions-eval.mjs.)
import assert from 'node:assert/strict';
import { askPrompt, LIMITS, MAX_QUESTIONS, parseQuestions } from '../tools/questions.mjs';

const json = (o) => JSON.stringify(o);
const q = (label, question, answers) => ({ label, question, answers });

// No questions: ask false, no JSON, junk, a failed call.
assert.equal(parseQuestions(json({ language: 'English', ask: false })), null);
assert.equal(parseQuestions(''), null, 'no answer (a failed call): the build goes on');
assert.equal(parseQuestions('Sure, I would ask about the hero.'), null, 'out of format: the build goes on');
assert.equal(parseQuestions('{"ask": true, "questions": [}'), null, 'broken JSON: the build goes on');
assert.equal(parseQuestions(json({ ask: true, questions: [] })), null, 'ask true with no questions: none');

// A good answer, read whole, with text around it (a model that adds words or a code fence).
const good = {
  language: 'English', ask: true, intro: 'Two quick questions:', decide: 'You decide',
  questions: [q('You play', 'Who do you play as?', ['The dragon', 'A knight', 'A kid']), q('Goal', 'What is the goal?', ['Fly far', 'Defend the castle'])],
};
const read = parseQuestions('```json\n' + json(good) + '\n```');
assert.deepEqual(read, {
  intro: 'Two quick questions:', decide: 'You decide',
  items: [{ label: 'You play', text: 'Who do you play as?', options: ['The dragon', 'A knight', 'A kid'] }, { label: 'Goal', text: 'What is the goal?', options: ['Fly far', 'Defend the castle'] }],
});

// At most 3 questions and 4 answers; "Other" / "You decide" / repeats dropped; a question left with one answer goes.
const many = parseQuestions(json({
  ask: true, intro: 'Hi', decide: 'Du entscheidest',
  questions: [
    q('A', 'One?', ['a', 'b', 'c', 'd', 'e', 'Other']),
    q('B', 'Two?', ['x', 'X', 'du entscheidest']),
    q('C', 'Three?', ['m', 'n']),
    q('D', 'Four?', ['p', 'r']),
    q('E', 'Five?', ['s', 't']),
  ],
}));
assert.equal(many.items.length, MAX_QUESTIONS);
assert.deepEqual(many.items[0].options, ['a', 'b', 'c', 'd'], 'four answers at most, Other dropped');
assert.deepEqual(many.items.map((i) => i.label), ['A', 'C', 'D'], 'B had one answer left after the repeat and You decide: dropped');
assert.equal(many.decide, 'Du entscheidest', 'You decide in the player language');

// Lengths: too long a question or answer is dropped, spaces and control characters folded.
const long = parseQuestions(json({
  ask: true, questions: [q('Look', 'x'.repeat(LIMITS.question + 1), ['a', 'b']), q('  Hero\n', ' Who\tare you? ', ['A cat', 'y'.repeat(LIMITS.answer + 1), 'A dog'])],
}));
assert.deepEqual(long.items, [{ label: 'Hero', text: 'Who are you?', options: ['A cat', 'A dog'] }]);
assert.equal(long.intro, 'One quick question before I build:', 'no intro: a plain one');
assert.equal(long.decide, 'You decide', 'no decide: You decide');
// Two questions with the same label: the second goes (the answer lines start with the label).
assert.equal(parseQuestions(json({ ask: true, questions: [q('Hero', 'One?', ['a', 'b']), q('hero', 'Two?', ['c', 'd'])] })).items.length, 1);
// Other scripts kept whole, with Type my own in the language and its code for the page's lang.
const ru = parseQuestions(json({ ask: true, lang: 'ru', intro: 'Пара вопросов:', decide: 'Решайте сами', own: 'Свой ответ', questions: [q('Герой', 'За кого играешь?', ['Дракон', 'Рыцарь'])] }));
assert.equal(ru.items[0].options[1], 'Рыцарь');
assert.equal(ru.own, 'Свой ответ');
assert.equal(ru.lang, 'ru');
const odd = parseQuestions(json({ ask: true, lang: 'Russian', own: 'x'.repeat(LIMITS.own + 1), questions: [q('A', 'One?', ['a', 'b'])] }));
assert.ok(!('lang' in odd) && !('own' in odd), 'a language name instead of a code, or a too-long own: left out (the site has its own words)');
assert.ok(!('own' in parseQuestions(json({ ask: true, decide: 'Du entscheidest', own: 'du entscheidest', questions: [q('A', 'One?', ['a', 'b'])] }))), 'own equal to decide: left out');

// The prompt: the request, the picks, the pictures, the notes for a change.
const p = askPrompt({ request: 'a space game', picks: { genre: 'shooter', tags: ['retro', 'cute'], platform: 'phone' }, images: 2 });
assert.match(p, /"a space game"/);
assert.match(p, /genre: shooter/);
assert.match(p, /tags: retro, cute/);
assert.match(p, /made for phones/);
assert.match(p, /attached 2 pictures/);
assert.match(p, /up to 3 short questions/);
assert.doesNotMatch(askPrompt({ request: 'x' }), /picked|attached/, 'no picks, no pictures: not said');
const e = askPrompt({ request: 'add a second player', kind: 'edit', notes: 'A cat runner. Controls: tap to jump.' });
assert.match(e, /changing their game/);
assert.match(e, /A cat runner/);
assert.match(e, /up to 2 short questions/);
assert.doesNotMatch(e, /genre:/);

console.log('questions: all checks passed');
