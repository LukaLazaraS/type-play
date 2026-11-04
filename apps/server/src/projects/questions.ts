// Questions before a build (2026-11-04, packages/agent/tools/questions.mjs): what the API keeps of the AI's questions
// (checked again here, as the ideas are: the record comes from a run), and how the player's answer to them becomes their
// message in the chat and the request the build gets. Pure: the e2e and the projects service share it.
import type { Questions } from "@typeplay/shared";
import { badRequest } from "../common/api-error.js";

/** What the chat has room for, as run.mjs writes them (tools/questions.mjs LIMITS), and the player's own answer. */
const LIMITS = { label: 24, question: 140, answer: 48, intro: 200, decide: 32, own: 32 };
/** A BCP 47 language code ("ka", "ru", "pt-BR"). */
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
export const MAX_QUESTIONS = 3;
export const MAX_ANSWER = 120;

/** One line: control characters and runs of spaces as one space, trimmed; null when empty or past `max` letters. */
function line(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const s = value.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();
  return s && [...s].length <= max ? s : null;
}

/**
 * A run's questions as the chat may show them: 1-3 questions of 2-4 answers, single short lines, and the intro (the
 * answer's text); null when nothing usable is left (then the run counts as failed: nothing charged).
 */
export function cleanAsked(raw: unknown, intro: unknown): { intro: string; questions: Questions } | null {
  const q = raw && typeof raw === "object" ? (raw as { items?: unknown; decide?: unknown; own?: unknown; lang?: unknown }) : null;
  const text = line(intro, LIMITS.intro);
  if (!q || !Array.isArray(q.items) || !text) return null;
  const decide = line(q.decide, LIMITS.decide) ?? "You decide";
  // "Type my own" in the player's language and the language's code, when the AI gave them.
  const own = line(q.own, LIMITS.own);
  const lang = typeof q.lang === "string" && LANG.test(q.lang) ? q.lang : null;
  const extra = { ...(own && own.toLowerCase() !== decide.toLowerCase() ? { own } : {}), ...(lang ? { lang } : {}) };
  const items: Questions["items"] = [];
  for (const item of q.items) {
    if (items.length === MAX_QUESTIONS) break;
    const it = item && typeof item === "object" ? (item as { label?: unknown; text?: unknown; options?: unknown }) : {};
    const label = line(it.label, LIMITS.label);
    const question = line(it.text, LIMITS.question);
    if (!label || !question) continue;
    const options: string[] = [];
    for (const o of Array.isArray(it.options) ? it.options : []) {
      const s = line(o, LIMITS.answer);
      if (s && options.length < 4 && !options.some((x) => x.toLowerCase() === s.toLowerCase())) options.push(s);
    }
    if (options.length >= 2) items.push({ label, text: question, options });
  }
  return items.length ? { intro: text, questions: { items, decide, ...extra } } : null;
}

/** A stored answer's questions (Message.questions), or null when it has none or they don't read. */
export function questionsOf(stored: unknown): Questions | null {
  const q = cleanAsked(stored, "x");
  return q ? q.questions : null;
}

/** The answers as POST /projects/:id/messages sends them: one per question, the answer's words or null (You decide). */
export function parseAnswers(raw: unknown, count: number): (string | null)[] {
  if (!Array.isArray(raw) || raw.length !== count) throw badRequest(`Answer each of the ${count === 1 ? "question" : `${count} questions`}, or leave it to the AI.`);
  return raw.map((a) => {
    if (a === null) return null;
    if (typeof a !== "string") throw badRequest("Each answer is a few words, or You decide.");
    const s = a.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();
    if (!s) return null; // an empty typed answer leaves it to the AI
    if ([...s].length > MAX_ANSWER) throw badRequest(`Keep each answer under ${MAX_ANSWER} letters.`);
    return s;
  });
}

/**
 * The player's answer to open questions. `request`: the message the questions were about. With `answers` (one per
 * question, null for You decide): their message reads one line per question ("Hero: A knight"), in the questions' own
 * language. With `text` (typed in the box): their message is that text, after those lines when some answers were tapped
 * too (`answers` with `text`: the box's Send carries the card's taps, so none is lost). The build's request is the
 * request, the questions and the answers, in the shape packages/agent/rules/ANSWERS.md reads; the version's label stays in
 * the player's words: the request, then their message, on one line with " · " between (the versions strip and the credit
 * history show a label as one line).
 */
export function replyTo(request: string, questions: Questions, reply: { answers?: (string | null)[] | null; text?: string }): { text: string; prompt: string; label: string } {
  const typed = reply.text?.trim() ?? "";
  // Taps count only when one of them says something (all You decide with words typed: the words alone).
  const answers = reply.answers && (!typed || reply.answers.some((a) => a !== null)) ? reply.answers : null;
  if (answers) {
    const tapped = questions.items.map((q, i) => `${q.label}: ${answers[i] ?? questions.decide}`).join("\n");
    const lines = questions.items.map((q, i) => {
      const a = answers[i];
      return `- ${q.text} -> ${a === null || a === undefined ? "You decide" : a}`;
    });
    const text = typed ? `${tapped}\n${typed}` : tapped;
    const also = typed ? `\n[The player also wrote, in their own words]\n${typed}` : "";
    return { text, prompt: `${request}\n\n[The player's answers to your questions before this build]\n${lines.join("\n")}${also}`, label: oneLine(request, text) };
  }
  const asked = questions.items.map((q) => `- ${q.text} (${q.options.join(" / ")})`);
  return {
    text: typed,
    prompt: `${request}\n\n[You asked the player before this build]\n${asked.join("\n")}\n[The player's reply, in their own words]\n${typed}`,
    label: oneLine(request, typed),
  };
}

/** The request and the player's answer as one label: their lines joined with " · ". */
const oneLine = (...parts: string[]) =>
  parts
    .flatMap((p) => p.split(/\r?\n/))
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" · ");
