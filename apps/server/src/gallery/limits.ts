// Limits for what anyone may send without signing in (a play, a report): counters per key in fixed windows,
// held in this process's memory only, never written anywhere, and gone on a restart. A visitor is a key made
// from their address with a random secret picked at start (so not even this process keeps the address), and
// a phone's or a home's whole IPv6 /64 counts as one address.
import { createHmac, randomBytes } from "node:crypto";
import { isIPv4, isIPv6 } from "node:net";
import type { Request } from "express";
import { config } from "../env.js";

/** At most `max` per key in each window of `ms` (fixed windows: cheap, and a burst at a window's edge is fine here). */
export class Limit {
  private readonly hits = new Map<string, { n: number; until: number }>();
  private added = 0;

  constructor(
    readonly max: number,
    readonly ms: number,
    /** Keys held at most: past this (a flood of addresses), new keys are refused until old windows end. */
    private readonly maxKeys = 100_000,
  ) {}

  /** Whether `key` has room for one more now. */
  has(key: string, now = Date.now()): boolean {
    const h = this.hits.get(key);
    if (h && h.until > now) return h.n < this.max;
    if (this.hits.size < this.maxKeys) return true;
    this.sweep(now);
    return this.hits.size < this.maxKeys;
  }

  /** Counts one for `key` (call `has` first). */
  take(key: string, now = Date.now()) {
    const h = this.hits.get(key);
    if (h && h.until > now) {
      h.n++;
      return;
    }
    this.hits.set(key, { n: 1, until: now + this.ms });
    if (++this.added % 1000 === 0) this.sweep(now);
  }

  private sweep(now: number) {
    for (const [k, h] of this.hits) if (h.until <= now) this.hits.delete(k);
  }
}

/** Counts one against every [limit, key] when all of them have room; otherwise counts nothing and says no. */
export function takeAll(pairs: [Limit, string][], now = Date.now()): boolean {
  if (!pairs.every(([limit, key]) => limit.has(key, now))) return false;
  for (const [limit, key] of pairs) limit.take(key, now);
  return true;
}

/** An address as the limits count it: IPv4 as is, IPv6 cut to its /64. */
export function addressKey(raw: string): string {
  const a = raw.trim().toLowerCase().replace(/%.*$/, "").replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");
  if (isIPv4(a) || !isIPv6(a)) return a.slice(0, 64);
  const [head, tail] = a.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const full = tail === undefined ? h : [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t];
  return `${full.slice(0, 4).map((x) => x.replace(/^0+(?=.)/, "")).join(":")}::/64`;
}

const secret = randomBytes(32);

/**
 * The visitor as a key for the limits: a keyed hash of their address, never the address. Live, only Cloudflare
 * reaches the API (the firewall lets nothing else in on 80/443), so Cloudflare's CF-Connecting-IP is the visitor;
 * elsewhere it is the connection's own address (TRUST_PROXY=1 lets a test act as several visitors).
 */
export function visitorKey(req: Request): string {
  const cf = config.trustProxy ? req.headers["cf-connecting-ip"] : undefined;
  const address = (typeof cf === "string" && cf.trim()) || req.socket.remoteAddress || "unknown";
  return createHmac("sha256", secret).update(addressKey(address)).digest("base64url").slice(0, 22);
}
