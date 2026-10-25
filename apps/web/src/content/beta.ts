// Beta 1 (PLAN.md package 6): the closed beta and "Send feedback". The API checks the same limits (apps/server, src/feedback).

/** The longest note: what happened, and what was expected, each. */
export const FEEDBACK_TEXT_MAX = 4000;
/** From here on the dialog counts the letters left. */
export const FEEDBACK_COUNT_FROM = 3600;
/** Notes a day per account (the API answers 429 after that). */
export const FEEDBACK_PER_DAY = 10;

/**
 * The closed beta, said before sign-in too (NEXT_PUBLIC_CLOSED_BETA=1 at build time, next to the API's BETA_INVITE_ONLY;
 * deploy/server/compose.yaml): the signed-out /create and /games tell people which Google account to use, so nobody
 * hands over a Google sign-in only to learn the beta is closed.
 */
export const closedBeta = process.env.NEXT_PUBLIC_CLOSED_BETA === "1";
export const CLOSED_BETA_NOTE = "A closed beta for now: sign in with Google, then type the beta code from your invitation.";

/** A beta code (Luka, 10-24): six digits, typed on the closed-beta page after signing in (the API: POST /beta/code). */
export const BETA_CODE_LENGTH = 6;
