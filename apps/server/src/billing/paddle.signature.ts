// The webhook's signature (docs/payments-design.md §6; docs/research/paddle-2026.md R-W2):
// `Paddle-Signature: ts=<unix seconds>;h1=<hex>[;h1=<hex>…]`, h1 = HMAC-SHA256(secret, "<ts>:<raw body>").
// Every h1 is tried against every secret we hold (the destination's, and the previous one while a
// rotation is going) in constant time. A timestamp more than 300 s from our clock is refused:
// retries carry a fresh ts, and the event id dedupe defeats replays, so the wide window costs nothing.
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_SKEW_S = 300;
/** Skew past this is logged: Paddle's own verifier allows 5 s, so a bigger gap means our clock drifts. */
export const LOG_SKEW_S = 5;

export type SignatureCheck = { ok: true; ts: number; skewS: number } | { ok: false; why: string };

export function parseSignature(header: string | undefined): { ts: number; h1: string[] } | null {
  if (!header) return null;
  let ts: number | null = null;
  const h1: string[] = [];
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "ts" && ts === null && /^\d{1,12}$/.test(v)) ts = Number(v);
    else if (k === "h1" && /^[0-9a-f]{64}$/i.test(v)) h1.push(v.toLowerCase());
  }
  return ts === null || !h1.length ? null : { ts, h1 };
}

export function verifySignature(rawBody: Buffer, header: string | undefined, secrets: string[], now = Date.now()): SignatureCheck {
  const sig = parseSignature(header);
  if (!sig) return { ok: false, why: "no usable Paddle-Signature header" };
  const skewS = Math.abs(Math.floor(now / 1000) - sig.ts);
  if (skewS > MAX_SKEW_S) return { ok: false, why: `timestamp ${skewS} s from now (limit ${MAX_SKEW_S})` };
  const keys = secrets.filter(Boolean);
  if (!keys.length) return { ok: false, why: "no webhook secret configured" };
  const signed = Buffer.concat([Buffer.from(`${sig.ts}:`), rawBody]);
  let matched = false;
  for (const secret of keys) {
    const expected = Buffer.from(createHmac("sha256", secret).update(signed).digest("hex"));
    for (const h of sig.h1) {
      const given = Buffer.from(h);
      // Every pair is compared, so the time taken says nothing about which one matched.
      if (given.length === expected.length && timingSafeEqual(given, expected)) matched = true;
    }
  }
  return matched ? { ok: true, ts: sig.ts, skewS } : { ok: false, why: "signature mismatch" };
}

/** What a test (or the simulator) sends: the header for a body and a secret. */
export function signBody(rawBody: string | Buffer, secret: string, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${ts}:`), Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody)])).digest("hex");
  return `ts=${ts};h1=${h1}`;
}
