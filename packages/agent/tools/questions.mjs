// The questions before a build (2026-11-04, HQ for Luka: "the builder never asks questions"). When the player leaves
// "Ask me first" ticked, one cheap Haiku call, no tools, decides before anything is built whether the request leaves a
// real gap that changes the game (what you play, the goal, the controls, the look's direction), and if so writes up to
// 3 short questions with 2-4 tap answers each, in the player's language. A clear request gets none and the build goes on
// in the same run. run.mjs runs it first (a new game: beside the genre call; a change: beside the size check, whose stop
// wins); questions end the run with them as the answer, nothing built. The player answers in the chat (or leaves a point
// to the AI with "You decide") and the next run builds with the answers (rules/ANSWERS.md); it never asks again.
// It sees the request, the picks (genre, tags, screens), the pictures themselves, and for a change the game's notes.
// Never throws: a failed or malformed answer lets the build go (asking helps; it never stands in the way).
// Its cost is the player's, like every AI call they cause: in the build's charge, or the questions answer's.
import { readFileSync } from 'node:fs';

/** At most this many questions, and per question this many tap answers (the app adds You decide and a typed answer). */
export const MAX_QUESTIONS = 3;
export const ANSWERS = { min: 2, max: 4 };
/** Lengths the chat has room for, in characters: a label, a question, a tap answer, the intro line, You decide, Type my
 * own. */
export const LIMITS = { label: 24, question: 140, answer: 48, intro: 200, decide: 32, own: 32 };
/** A BCP 47 language code ("ka", "ru", "en", "pt-BR"): the page's `lang` for the questions. */
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
/** The notes a change's call reads (NOTES.md, the agent's own description of the game). */
export const NOTES_CHARS = 3000;

const SYSTEM = 'You decide whether a game builder should ask the player anything before it builds, and write the questions. Answer with one JSON object only.';

const SCREENS = { phone: 'made for phones (upright)', computer: 'made for computers (wide)', fill: 'fills every screen' };

/** The picks as plain lines (none: nothing). */
function picksLines({ genre, tags = [], platform } = {}) {
  const lines = [];
  if (genre && genre !== 'none') lines.push(`The player picked the genre: ${genre}.`);
  if (tags.length) lines.push(`The player picked these tags: ${tags.join(', ')}.`);
  if (platform && SCREENS[platform]) lines.push(`The player picked the screens: ${SCREENS[platform]}.`);
  return lines;
}

/**
 * The call's prompt. `kind`: new (a game from nothing) or edit (a change to `notes`' game); `images`: how many pictures
 * come with it (the pictures themselves come before this text in the same message).
 */
export function askPrompt({ request, kind = 'new', picks = {}, images = 0, notes = '' }) {
  const seen = images ? `The player attached ${images === 1 ? 'a picture' : `${images} pictures`} to it (above): ${images === 1 ? 'it may answer' : 'they may answer'} some points already (the look, the hero, the layout).` : '';
  const head = kind === 'edit'
    ? [`A player is changing their game by chat and sent this request:\n"${request}"`, notes ? `What the game is now (its notes):\n${notes}` : '', seen]
    : [`A player wants a game built from this request:\n"${request}"`, picksLines(picks).join('\n'), seen];
  const when = kind === 'edit'
    ? [
      'Before the change is built you may ask the player up to 2 short questions, but only when the request could mean clearly different changes and building the wrong one would waste it (for example "add a second player": on the same screen at once, or taking turns?).',
      'Most change requests need no questions: "add a boss", "make it harder", "add coins", "make the robot red" are clear enough; a good game designer picks the details. When unsure, ask nothing.',
    ]
    : [
      `Before the build starts you may ask the player up to ${MAX_QUESTIONS} short questions, but only where the request leaves a real gap that changes what the game is:\n- what the player plays as or controls,\n- the goal (how you win, score or lose),\n- the controls, only when the request could mean very different ways to play,\n- the look's direction, only when nothing hints at it (no tag, no picture, no theme in the words).`,
      'Never ask about what a good game designer picks well alone: colours, names, how many levels, sounds and music, difficulty, menus, the score display, the screen shape. Never ask what the request, the picks or the pictures already say.',
      'Most requests need no questions. Ask nothing when the request says what kind of game it is and what you do in it (a sentence is enough), or names a well-known kind of game ("snake, but you are a cat"). Asking costs the player time: when unsure, ask nothing. One or two questions are usually enough.',
    ];
  const format = [
    'Answer with one JSON object and nothing else.',
    'No questions: {"language": "<the language of the request>", "ask": false}',
    'Questions: {"language": "<the language of the request>", "lang": "<its BCP 47 code, such as en, ka, ru, de>", "ask": true, "intro": "<one short friendly line before the questions>", "decide": "<the answer that means \\"the builder picks\\", said by the player to the builder: \\"You decide\\" in English, \\"Решай сам\\" in Russian, \\"Du entscheidest\\" in German; never \\"I will decide\\">", "own": "<\\"Type my own\\" in that language: the player writes their own answer>", "questions": [{"label": "<1 or 2 words naming the point>", "question": "<one short question>", "answers": ["<2 to 4 short answers, 1 to 4 words each>"]}]}',
    'Write the intro, decide, own, labels, questions and answers in the language of the request (the language the player wrote in, whatever the genre or tag names are in). Answers are concrete, different from each other and fit the request; never "Other", "Anything" or "You decide" among them: the app adds those.',
  ];
  const examples = kind === 'edit'
    ? [
      'Example: "add a second player"\n{"language": "English", "lang": "en", "ask": true, "intro": "One quick question before I change it:", "decide": "You decide", "own": "Type my own", "questions": [{"label": "Two players", "question": "How do the two players play?", "answers": ["Both at once", "Taking turns"]}]}',
      'Example: "Add a double jump and make the coins spin"\n{"language": "English", "ask": false}',
    ]
    : [
      'Example: "make a game with a dragon"\n{"language": "English", "lang": "en", "ask": true, "intro": "Two quick questions, so I build the game you have in mind:", "decide": "You decide", "own": "Type my own", "questions": [{"label": "You play", "question": "Who do you play as?", "answers": ["The dragon", "A knight", "A kid riding a dragon"]}, {"label": "Goal", "question": "What is the goal?", "answers": ["Fly as far as you can", "Defend the castle", "Collect the treasure"]}]}',
      'Example: "An endless runner where a little robot jumps over cactuses and it gets faster over time."\n{"language": "English", "ask": false}',
    ];
  return [...head, ...when, ...format, ...examples].filter(Boolean).join('\n\n');
}

/** One line of text: control characters and runs of spaces as one space, trimmed; null when empty or past `max`. */
function line(value, max) {
  if (typeof value !== 'string') return null;
  const s = value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return s && [...s].length <= max ? s : null;
}

const SKIP = /^(other|anything|something else|you decide|surprise me|any)$/i;

/**
 * The call's answer as the chat may show it: { intro, decide, items: [{ label, text, options }] } with 1-3 questions of
 * 2-4 answers each, or null (no questions, or nothing usable: then the build goes on). Lines out of format are dropped
 * one by one; a question left with fewer than 2 answers goes.
 */
export function parseQuestions(answer) {
  const raw = String(answer ?? '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || data.ask !== true || !Array.isArray(data.questions)) return null;
  const decide = line(data.decide, LIMITS.decide) ?? 'You decide';
  const items = [];
  for (const q of data.questions) {
    if (items.length === MAX_QUESTIONS) break;
    const text = line(q?.question, LIMITS.question);
    const label = line(q?.label, LIMITS.label);
    if (!text || !label || items.some((i) => i.label.toLowerCase() === label.toLowerCase())) continue;
    const options = [];
    for (const a of Array.isArray(q.answers) ? q.answers : []) {
      const o = line(a, LIMITS.answer);
      if (!o || SKIP.test(o) || o.toLowerCase() === decide.toLowerCase() || options.some((x) => x.toLowerCase() === o.toLowerCase())) continue;
      if (options.length < ANSWERS.max) options.push(o);
    }
    if (options.length >= ANSWERS.min) items.push({ label, text, options });
  }
  if (!items.length) return null;
  const own = line(data.own, LIMITS.own);
  const lang = typeof data.lang === 'string' && LANG.test(data.lang.trim()) ? data.lang.trim() : null;
  return {
    intro: line(data.intro, LIMITS.intro) ?? (items.length === 1 ? 'One quick question before I build:' : 'A few quick questions before I build:'),
    decide,
    ...(own && own.toLowerCase() !== decide.toLowerCase() ? { own } : {}),
    ...(lang ? { lang } : {}),
    items,
  };
}

/** The call's message: the pictures (what the AI sees of each) before the words, as the build's first message has them. */
function message(text, pictures) {
  if (!pictures.length) return text;
  const content = [];
  for (const p of pictures) {
    content.push({ type: 'text', text: `Picture ${p.n}` });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/webp', data: readFileSync(p.view).toString('base64') } });
  }
  content.push({ type: 'text', text });
  return (async function* () {
    yield { type: 'user', parent_tool_use_id: null, message: { role: 'user', content } };
  })();
}

/**
 * Runs the call: { questions, answer, costUsd } (questions: parseQuestions' shape, or null). `query` and `options` are
 * run.mjs's (the SDK's query and the isolated Haiku options); `pictures`: run.mjs's [{ n, view }].
 */
export async function askQuestions({ request, kind = 'new', picks = {}, notes = '', pictures = [], query, options }) {
  let answer = '', costUsd = 0;
  const text = askPrompt({ request, kind, picks, images: pictures.length, notes: String(notes ?? '').slice(0, NOTES_CHARS) });
  try {
    for await (const m of query({ prompt: message(text, pictures), options: { ...options, systemPrompt: SYSTEM } })) {
      if (m.type === 'result') {
        if (m.subtype === 'success') answer = m.result ?? '';
        costUsd = m.total_cost_usd ?? 0;
      }
    }
  } catch (e) {
    console.log(`[questions skipped] ${String(e?.message || e).split('\n')[0].slice(0, 120)}`);
  }
  return { questions: parseQuestions(answer), answer: answer.trim(), costUsd };
}
