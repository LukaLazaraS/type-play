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

/**
 * The origin an absolute redirect from a route handler goes to. Live, Next runs behind Caddy in the container and
 * `request.nextUrl` carries its own bind address (10-24: sign-in landed on https://0.0.0.0:3000/create), so it comes
 * from the Host the visitor asked for, which Caddy passes on as it is: localhost or 127.0.0.1 (dev, tests) as asked,
 * anything else https://<domain>, so a forged Host can't send anyone to another site.
 */
export function publicOrigin(host: string | null, protocol: string, domain: string): string {
  const asked = (host ?? "").trim().toLowerCase();
  if (/^(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(asked)) return `${protocol === "https:" ? "https" : "http"}://${asked}`;
  return `https://${domain}`;
}
