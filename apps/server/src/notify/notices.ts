// What a build's end says in the notifications (2026-10-29): the game's name and what happened in a few plain words, and
// one or two sentences under them. The same words go to the site's notice, the tab's title and the device's notification
// (RunNotice, packages/shared), so they are written here once. The chat keeps its own, longer answer.
import type { ModelChoice, NoticeKind, RunNotice } from "@typeplay/shared";

/**
 * How a build ended. built: a new version. toobig: the size check stopped the change (no version). failed and refused:
 * the agent's run (a first build or a change). timeout, interrupted: stopped on our side. expired, notStarted: it left the
 * queue without starting (waited too long; not allowed at its turn). stopped: the player's Stop, or the game or the account
 * deleted meanwhile: no notification.
 */
export type EndWhy = "built" | "toobig" | "failed" | "refused" | "timeout" | "interrupted" | "expired" | "notStarted" | "stopped";

const MODEL_NAME: Record<ModelChoice, string> = { fast: "Fast", smart: "Smart", best: "Best" };

export interface NoticeFacts {
  why: Exclude<EndWhy, "stopped">;
  projectId: string;
  messageId: string;
  /** The game's name now (after a first build that worked: the one the AI gave it). */
  name: string;
  /** No version before this build: a first build (a failure leaves no game to be "unchanged"). */
  first: boolean;
  /** The AI the answer was sent on, and the bigger one a size-check stop offers. */
  model: ModelChoice | null;
  bigger: ModelChoice | null;
  /** The version a finished build made. */
  version: number | null;
  /** The answer's own text in the chat (a build that didn't start says why there, in one sentence). */
  text: string;
  /** How long a build may run before it is stopped (RUN_TIMEOUT_MIN). */
  timeoutMin: number;
  at: Date;
}

const KIND: Record<NoticeFacts["why"], NoticeKind> = {
  built: "ready",
  toobig: "toobig",
  failed: "failed",
  refused: "failed",
  timeout: "failed",
  interrupted: "failed",
  expired: "failed",
  notStarted: "failed",
};

/** The title (always the game's name first) and the sentences under it. */
function words(f: NoticeFacts): { title: string; body: string } {
  const unchanged = f.first ? "Nothing was charged." : "Your game is unchanged, and nothing was charged.";
  switch (f.why) {
    case "built":
      return { title: `${f.name} is ready`, body: f.first || f.version === null ? "Your new game is built. Play it now." : `Version ${f.version} is in. Play it now.` };
    case "toobig": {
      const ai = f.model ? MODEL_NAME[f.model] : "this AI";
      return {
        title: `${f.name}: that change is too big for ${ai}`,
        body: f.bigger ? `${MODEL_NAME[f.bigger]} can do it in one go, or ask for one part at a time.` : "Ask for one part at a time: the chat says how.",
      };
    }
    case "failed":
      return f.first
        ? { title: `${f.name} didn't build`, body: "Nothing was charged. Try again, maybe in other words." }
        : { title: `${f.name}: your change didn't work`, body: unchanged };
    case "refused":
      return { title: f.first ? `${f.name} can't be made` : `${f.name}: that change can't be made`, body: "Try a different idea. Nothing was charged." };
    case "timeout":
      return { title: `${f.name} took too long`, body: `It stopped after ${f.timeoutMin} minutes. ${unchanged}` };
    case "interrupted":
      return { title: `${f.name}: the build was interrupted`, body: `${unchanged} Send it again when you like.` };
    case "expired":
      return { title: `${f.name} didn't start`, body: "It waited too long for its turn and left the queue. Nothing was charged." };
    case "notStarted":
      return { title: `${f.name} didn't start`, body: f.text };
  }
}

export function noticeOf(f: NoticeFacts): RunNotice {
  return {
    kind: KIND[f.why],
    projectId: f.projectId,
    messageId: f.messageId,
    name: f.name,
    ...words(f),
    url: `/games/${f.projectId}`,
    at: f.at.toISOString(),
  };
}
