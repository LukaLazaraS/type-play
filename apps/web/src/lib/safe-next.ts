// Where sign-in (/auth/callback's ?next=) and the checkout's back links (?back=) may send the visitor: a path on this
// site, never another site. No imports, so scripts/safe-next-check.mjs can run it with plain Node.

const BASE = "https://typeplay.invalid";

/**
 * Only same-site paths. A browser drops tabs and line breaks from an address and reads "\" as "/", so "/\t/evil.example"
 * is "//evil.example", another site (security review 10-20): anything with a control or format character, a space or a
 * backslash is refused, and what is left must still resolve on this site.
 */
export function safeNext(next: string | null | undefined, fallback = "/create"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\p{Cc}\p{Cf}\s\\]/u.test(next)) return fallback;
  try {
    return new URL(next, BASE).origin === BASE ? next : fallback;
  } catch {
    return fallback;
  }
}
