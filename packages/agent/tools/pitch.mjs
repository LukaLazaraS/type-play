// The game's public line (2026-11-20): one sentence about the game, written after every build or change that worked,
// shown on its share page and used as its description in search and link previews (apps/web "Share pages"). One cheap
// Haiku call, no tools, beside run.mjs's other closing calls; like every AI cost a player causes, it is part of that
// answer's charge (run.mjs `pitchCostUsd`). The server's one-off backfill (`admin gallery pitch`) uses the same call.
//
// What it reads: the game's name (project.godot), its genre (GENRE), NOTES.md's first 60 lines (as notesOf reads them)
// and its current line (PITCH). Never the player's prompt, the request history (the folder's git log) or the builder's
// reply: all three carry the player's own words, and the line is public. It answers KEEP when the game didn't change in
// kind. The line is checked in code too (checkPitch): one that fails keeps the old line (or none), and never fails a build.
// The game agent controls its folder, so these files are read only when they are plain small files (a NOTES.md that is a
// link to /proc/self/environ must not put a process's secrets into a public line); the server reads them its own safe way
// (games/files.ts) and calls pitchFor with the text.
import { closeSync, constants, existsSync, fstatSync, lstatSync, openSync, readFileSync, readSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ISOLATED, MODELS } from './isolated.mjs';

/** The file in the game folder: the agent's line, one line of text, committed with the build (no file: no line yet). */
export const PITCH_FILE = 'PITCH';
/** The call aims at 90-140 letters; after cleaning a line must be 60-150 (the owner's own line has the same top). */
export const PITCH_MIN = 60;
export const PITCH_MAX = 150;

export const GENRE_WORDS = {
  runner: 'an endless runner', platformer: 'a platformer', puzzle: 'a puzzle game', racer: 'a racing game', shooter: 'a shooter',
  towerdefence: 'a tower defence game', arcade: 'an arcade game', adventure: 'an adventure game',
};

/** A file in the game folder as text: only a plain file (no link, pipe or folder) of at most `max` bytes; '' otherwise. */
export function folderText(dir, rel, max) {
  const file = join(dir, rel);
  try {
    if (!lstatSync(file).isFile()) return '';
    const fd = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const st = fstatSync(fd);
      if (!st.isFile() || st.size > max) return '';
      const buf = Buffer.alloc(st.size);
      return buf.subarray(0, readSync(fd, buf, 0, st.size, 0)).toString('utf8');
    } finally {
      closeSync(fd);
    }
  } catch {
    return '';
  }
}

/** project.godot's config/name, or ''. */
export const nameIn = (projectGodot) => /^config\/name="((?:[^"\\]|\\.)*)"/m.exec(projectGodot)?.[1].replace(/\\(.)/g, '$1').trim().slice(0, 60) ?? '';
/** The game's name as project.godot has it, or ''. */
export const nameOf = (dir) => nameIn(folderText(dir, 'project.godot', 1 << 20));
/** The genre skill the game was built with (GENRE), or ''. */
export function genreOf(dir) {
  const word = folderText(dir, 'GENRE', 64).trim();
  return GENRE_WORDS[word] ? word : '';
}
/** NOTES.md's first 60 lines (the notes rule's own limit, as tools/next-steps.mjs notesOf reads them), or ''. */
export const notesIn = (text) => text.split('\n').slice(0, 60).join('\n').trim();
export const notesOf = (dir) => notesIn(folderText(dir, 'NOTES.md', 256 << 10));

/** A line as read or answered, tidied: its first line, no wrapping quotes, no control characters or doubled spaces, a
 * full stop at the end. */
export function cleanPitch(raw) {
  let s = String(raw ?? '').replace(/\r/g, '').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  s = s.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/^(?:pitch|sentence|line|description)\s*:\s*/i, '');
  for (let i = 0; i < 2; i++) s = s.replace(/^["'“‘«]+\s*|\s*["'”’»]+$/g, '').trim();
  s = s.replace(/!+$/, '.');
  if (/[\p{L}\p{N})]$/u.test(s)) s += '.';
  return s;
}

const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|app|dev|gg|me|co|ly|xyz|ai|tv|link|site|online|info|biz|store|shop|ru|de|uk|ge|us|fr|es|it|nl|jp|cn|in|br)\b/i;
const HANDLE = /(?:^|[\s(])[@#][\p{L}\p{N}_]/u;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;
/** How it was made, never part of the line ("code" and "notes" stay allowed: a puzzle's code, a rhythm game's notes). */
const MAKING = /\b(?:a\.?i\.?|artificial intelligence|typeplay|godot|prompt\w*|tests?|tested|testing|made with|built with|created with|made using|generated|gpt|chatgpt|claude|llm|vibe[- ]?coded)\b/i;
/** The maker or someone they know: a public line says nothing about either. */
const PERSONAL = /\b(?:i|me|my|mine|we|our|ours|us|dedicated|dedication|in memory|happy birthday|birthday|made by|created by|built by)\b/i;
const HYPE = /\b(?:ultimate|epic|amazing|awesome|incredible|insane|revolutionary|stunning|addictive|addicting|mind[- ]blowing|unforgettable|masterpiece|must[- ]play|breathtaking|legendary|game[- ]changing|jaw[- ]dropping|world[- ]class|the best|best[- ]ever|greatest|unbelievable|spectacular|phenomenal|ever made|like never before)\b/i;

/**
 * The code's half of the rules (the call is told all of them): one English sentence of 60-150 letters, no links,
 * handles, hashtags or emoji, nothing about how it was made, nothing personal, no hype. `name`: the game's own name,
 * which may hold any word. { ok, text, why }.
 */
export function checkPitch(raw, { name = '' } = {}) {
  const text = cleanPitch(raw);
  const fail = (why) => ({ ok: false, text, why });
  const length = [...text].length;
  if (!text || /^keep\.?$/i.test(text)) return fail('no line');
  if (length < PITCH_MIN || length > PITCH_MAX) return fail(`${length} letters (${PITCH_MIN}-${PITCH_MAX})`);
  // The game's own name may say anything; the rest of the line may not.
  const rest = name && name.length >= 2 ? text.split(name).join(' ') : text;
  if (EMOJI.test(rest)) return fail('emoji');
  if (LINK.test(rest)) return fail('a link');
  if (HANDLE.test(rest)) return fail('a handle or hashtag');
  if (/[.!?]["'”’)\]]?\s+["'“‘(\[]?\p{Lu}/u.test(rest)) return fail('more than one sentence');
  const letters = rest.match(/\p{L}/gu) ?? [];
  const latin = rest.match(/[A-Za-z]/g) ?? [];
  if (letters.length && latin.length / letters.length < 0.95) return fail('not English');
  const making = MAKING.exec(rest);
  if (making) return fail(`says how it was made ("${making[0]}")`);
  const personal = PERSONAL.exec(rest);
  if (personal) return fail(`personal ("${personal[0]}")`);
  const hype = HYPE.exec(rest);
  if (hype) return fail(`hype ("${hype[0]}")`);
  return { ok: true, text, why: '' };
}

/** The game's current line: its PITCH file if it is a plain small file whose line passes the check; '' otherwise. */
export function readPitch(dir) {
  const c = checkPitch(folderText(dir, PITCH_FILE, 2048), { name: nameOf(dir) });
  return c.ok ? c.text : '';
}

/** Writes the line into the folder (none: no file). True when the file changed. */
export function savePitch(dir, line) {
  const file = join(dir, PITCH_FILE);
  const before = existsSync(file) ? readFileSync(file, 'utf8') : null;
  const after = line ? `${line}\n` : null;
  if (before === after) return false;
  if (after === null) rmSync(file, { force: true });
  else writeFileSync(file, after);
  return true;
}

export const PITCH_SYSTEM = 'You write the one public sentence that describes a game on its page. Reply with the sentence only, or KEEP.';

export function pitchPrompt({ name, genre, notes, current }) {
  const what = [name && `"${name}"`, GENRE_WORDS[genre]].filter(Boolean).join(', ');
  return [
    'A game made by a player has a public page. It needs one sentence about the game: shown under its name, in search results and in link previews, to people who have never seen it.',
    `The game${what ? `: ${what}` : ''}.`,
    `The builder's notes on the game as it is now (they may hold private words: the rules below say what may go public):\n${notes}`,
    current ? `Its current sentence: "${current}"` : 'It has no sentence yet.',
    [
      'Rules:',
      '- English, one sentence of 80 to 130 characters: short, never over 140 (count them).',
      "- Say what the player does and the hook that makes this game itself (its world, its twist, its goal), in plain words a player would use; pick the best two or three things, don't list everything. Start with what you do or where you are, not with the game's name.",
      '- Only what the notes say the game has. Nothing about how it was made or checked: no AI, TypePlay, Godot, code, scripts, notes, tests or prompts, no "made with". Rivals the computer drives are "rivals", not "AI".',
      "- Nothing personal: no people's names, dedications or messages to someone (\"for my son\"), birthdays, real places, schools or companies, unless they are part of the game's own name. Leave out anything like that in the notes.",
      '- Plain and true: no hype words (amazing, epic, ultimate, addictive, the best), no clichés like "test your skills", no exclamation marks, hashtags, emoji, links or @handles.',
      current
        ? '- Keep or rewrite: if the current sentence is still true of the game and follows these rules, reply KEEP. Write a new one only when the game changed in kind (a new mode, goal, world or main feature it should name) or the sentence says something the game no longer has.'
        : '',
    ].filter(Boolean).join('\n'),
    current ? 'Reply with the sentence alone, or KEEP.' : 'Reply with the sentence alone.',
  ].join('\n\n');
}

/** The call's options: Haiku at low effort, one turn, no tools, isolated (run.mjs and the server's backfill). */
export const PITCH_OPTIONS = { ...ISOLATED, tools: [], model: MODELS.haiku, effort: 'low', maxTurns: 1, systemPrompt: PITCH_SYSTEM };

/**
 * Writes or keeps the line for a game (one call), from its name, genre (a GENRE word), NOTES.md text and `current` line.
 * An answer whose only fault is its length is asked for once more, shorter (Haiku overshoots now and then: 1 of 12 in
 * the 11-20 sample); any other fault keeps the old line. Never throws: a run that built the game must not fail over its
 * line. `query`: the Agent SDK's (imported here when not given). Returns
 *   { pitch: the line to keep ('' none), action: new | kept | rejected | failed | skipped, why, answer, costUsd,
 *     tokens: { input, output, cacheRead, cacheWrite }, calls, seconds }.
 */
export async function pitchFor({ name = '', genre = '', notes = '', current = '', query, options = PITCH_OPTIONS }) {
  const t0 = Date.now();
  let costUsd = 0;
  let calls = 0;
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const done = (r) => ({ pitch: current, why: '', answer: '', ...r, costUsd, tokens, calls, seconds: +((Date.now() - t0) / 1000).toFixed(1) });
  notes = notesIn(notes);
  if (!notes) return done({ action: 'skipped', why: 'no NOTES.md' });
  const ask = async (prompt) => {
    let answer = '';
    calls++;
    for await (const m of query({ prompt, options })) {
      if (m.type !== 'result') continue;
      if (m.subtype === 'success') answer = (m.result ?? '').trim();
      costUsd += m.total_cost_usd ?? 0;
      for (const u of Object.values(m.modelUsage ?? {})) {
        tokens.input += u.inputTokens ?? 0; tokens.output += u.outputTokens ?? 0;
        tokens.cacheRead += u.cacheReadInputTokens ?? 0; tokens.cacheWrite += u.cacheCreationInputTokens ?? 0;
      }
    }
    return answer;
  };
  const prompt = pitchPrompt({ name, genre, notes, current });
  let answer = '';
  let c;
  try {
    query ??= (await import('@anthropic-ai/claude-agent-sdk')).query;
    answer = await ask(prompt);
    if (current && /^\W*keep\W*$/i.test(answer)) return done({ action: 'kept', answer });
    c = checkPitch(answer, { name });
    if (!c.ok && c.text && /^\d+ letters/.test(c.why)) {
      answer = await ask(`${prompt}\n\nYou answered: "${c.text}"\nThat is ${[...c.text].length} characters. Write it again in 80 to 130 characters, the same rules. Reply with the sentence alone.`);
      c = checkPitch(answer, { name });
    }
  } catch (e) {
    return done({ action: 'failed', why: String(e?.message || e).split('\n')[0].slice(0, 120) });
  }
  if (!c.ok) return done({ action: 'rejected', why: c.why, answer: c.text || answer });
  if (c.text === current) return done({ action: 'kept', answer });
  return done({ pitch: c.text, action: 'new', answer });
}

/** pitchFor with the game folder's own files (run.mjs): `current` is the line it had before this build (run.mjs reads it
 * at the run's start, so a PITCH the build session wrote itself never counts). */
export const makePitch = ({ dir, current = '', query, options = PITCH_OPTIONS }) =>
  pitchFor({ name: nameOf(dir), genre: genreOf(dir), notes: notesOf(dir), current, query, options });
