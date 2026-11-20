// The game's public line (2026-11-20; packages/agent/tools/pitch.mjs): the AI's, from the game folder's PITCH file after a
// build, and the owner's own, typed in the Share menu. Shown on the share page and used as its description everywhere
// (apps/web "Share pages"); the owner's wins (`ownerPitch ?? pitch`), and builds never touch it.
import { badRequest } from "../common/api-error.js";
import { readGameFile } from "./files.js";

/** The longest line, the AI's or the owner's (what search results show of a description is 155 with our tail). */
export const PITCH_MAX = 150;
/** The AI's line is at least this long (the agent's own check holds the rest of its rules). */
const AI_PITCH_MIN = 60;
/** A link of any kind: a line is plain text (the agent holds its own line to the same). */
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|net|org|io|app|dev|gg|me|co|ly|xyz|ai|tv|link|site|online|info|biz|store|shop|ru|de|uk|ge|us|fr|es|it|nl|jp|cn|in|br)\b/i;
const HANDLE = /(?:^|[\s(])@[\p{L}\p{N}_]/u;

/** One line of text: control and format characters out, spaces single, ends trimmed. */
const oneLine = (s: string) => s.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();

/** The AI's line in the game folder (PITCH, written by run.mjs and committed with the build), read as untrusted data: the
 * game agent can write in the folder, so a line that isn't one plain line of 60-150 letters without links is no line. */
export function readPitch(dir: string): string | null {
  try {
    const first = readGameFile(dir, "PITCH", 2048).toString("utf8").split("\n").find((l) => l.trim()) ?? "";
    const line = oneLine(first);
    const n = [...line].length;
    return n >= AI_PITCH_MIN && n <= PITCH_MAX && !LINK.test(line) && !HANDLE.test(line) ? line : null;
  } catch {
    return null;
  }
}

/** The owner's own line from PATCH /projects/:id { ownerPitch }: null goes back to the AI's; a string is one line of
 * plain text, 1-150 letters, no links. Throws 400 with the reason, said for the Share menu. */
export function cleanOwnerPitch(raw: unknown): string | null {
  if (raw === null) return null;
  if (typeof raw !== "string") throw badRequest("Write the line as text.");
  const line = oneLine(raw);
  if (!line) throw badRequest("Write a description of the game, or use the AI's.");
  if ([...line].length > PITCH_MAX) throw badRequest(`That's too long: ${PITCH_MAX} letters at most.`);
  if (LINK.test(line) || HANDLE.test(line)) throw badRequest("Leave links and @names out: the description is plain text.");
  return line;
}
