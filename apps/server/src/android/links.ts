// The phone link and the redirect behind it (docs/android-export-design.md §8). The link the site shows
// and draws as a QR code is always short, `${API_PUBLIC_URL}/android/dl/<token>`, whatever the store:
// with the folder store the API streams the file; with R2 it answers a redirect to a presigned URL
// made at that moment (a presigned URL is ~450 characters, more than the site's QR encoder takes).

/** The longest a presigned URL behind the redirect lives: a few minutes, and never past the link itself (a link lives 10 minutes: `config.android.linkSeconds`). */
export const PRESIGN_MAX_SEC = 300;

/** The short link for a token. `publicUrl` is API_PUBLIC_URL (https://api.typeplay.app); a trailing slash is ignored. */
export const phoneLinkUrl = (publicUrl: string, token: string): string => `${publicUrl.replace(/\/+$/, "")}/android/dl/${token}`;

/** Seconds a presigned URL minted at `now` may live: up to PRESIGN_MAX_SEC, cut to what is left of the link's life (at least 1). */
export function presignSeconds(linkExpiresAt: number, now: number): number {
  return Math.max(1, Math.min(PRESIGN_MAX_SEC, Math.floor((linkExpiresAt - now) / 1000)));
}
