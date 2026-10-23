// A closed account's tombstone (the ClosedAccount table): what survives `DELETE /me`.
// - Its old user id refuses that account's still-valid sign-in tokens for TOKEN_GRACE_MS (a Supabase
//   access token lives an hour), across API restarts, so the account can't quietly come back.
// - Its email, scrambled (SHA-256 with a fixed salt: the address itself is not kept), stops a sign-up
//   with the same email within TOMBSTONE_DAYS from getting the Free plan's credits a second time.
//   The privacy policy says so (apps/web/src/content/legal.ts, "How long we keep it").
import { createHash } from "node:crypto";

export const TOKEN_GRACE_MS = 2 * 60 * 60_000;
export const TOMBSTONE_DAYS = 90;
const SALT = "typeplay-closed-account-v1";

export const emailHash = (email: string) => createHash("sha256").update(`${SALT}:${email.trim().toLowerCase()}`).digest("hex");

/** Shown with the account's credits when the signup grant was withheld (Me.notice). */
export const NO_SIGNUP_CREDITS_NOTICE = "This email had a TypePlay account closed less than 90 days ago, so the Free plan's starting credits aren't given again.";
