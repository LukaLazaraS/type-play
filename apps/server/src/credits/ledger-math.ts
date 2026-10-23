// The credit ledger's arithmetic (docs/payments-design.md §4), as pure functions: integers only
// (credits in tenths, money in cents), rounding half-up once per line, dates in UTC. No database
// here: ledger.service.ts reads the rows, calls these and writes the result under the user's lock.
// Tested on its own by test/ledger-math.mjs.
import type { CreditSource, SubStatus } from "../generated/prisma/client.js";
import { PACK_MONTHS, UPGRADE_CREDITS } from "./credits.js";

export const DAY_MS = 86_400_000;
/** A past-due subscription keeps its plan this long after the period ends; then settle() drops it to Free. */
export const PAST_DUE_GRACE_MS = 24 * 3_600_000;

/** Half-up, away from zero: 2.5 -> 3, -2.5 -> -3, 2.4999 -> 2 (a hair of float error forgiven). */
export const roundHalfUp = (x: number) => Math.sign(x) * Math.floor(Math.abs(x) + 0.5 + 1e-9);

/**
 * "A month" = the same day n months on, clamped to that month's end, the time of day kept (UTC):
 * 31 Jan -> 28 Feb, 31 Oct -> 30 Nov, 15 Jan -> 15 Feb. Negative n goes back.
 */
export function addMonths(date: Date, months: number): Date {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const d = Math.min(date.getUTCDate(), lastDay);
  return new Date(Date.UTC(y, m, d, date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds()));
}
export const monthLater = (date: Date) => addMonths(date, 1);

/** The UTC day's start: "a day" is a UTC day everywhere in the ledger (the Free daily limit too). */
export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** "October": the month a plan's credits came from, for the expiry note. */
export const monthName = (date: Date) => new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(date);

/** What the ledger needs to know about a bucket to order and spend it (a CreditBucket row fits). */
export interface BucketLike {
  id: string;
  source: CreditSource;
  startsAt: Date;
  expiresAt: Date | null;
  remainingTenths: number;
  frozenAt: Date | null;
  closedAt: Date | null;
}

/** A bucket a charge may take from: open, not frozen by a pending refund, with something left. */
export const isSpendable = (b: BucketLike) => b.closedAt === null && b.frozenAt === null && b.remainingTenths > 0;

/**
 * Spend order (docs/pricing.md): free credits first (soonest expiry first), then plan and upgrade
 * credits oldest first, then packs (soonest expiry first), then credits given by hand (no expiry;
 * our choice: pricing.md does not place them).
 */
const GROUP: Record<CreditSource, number> = { free: 0, plan: 1, upgrade: 1, pack: 2, admin: 3 };
const time = (d: Date | null) => (d ? d.getTime() : Number.POSITIVE_INFINITY);
export function spendOrder(a: BucketLike, b: BucketLike): number {
  const g = GROUP[a.source] - GROUP[b.source];
  if (g) return g;
  const byExpiry = GROUP[a.source] === 0 || GROUP[a.source] === 2;
  return (byExpiry && time(a.expiresAt) - time(b.expiresAt)) || a.startsAt.getTime() - b.startsAt.getTime() || a.id.localeCompare(b.id);
}

/** The buckets a charge takes from, in spend order. */
export const spendable = (buckets: BucketLike[]) => buckets.filter(isSpendable).sort(spendOrder);

/** What the user can spend now: the spendable buckets' remaining, less any debt. */
export const availableTenths = (buckets: BucketLike[], debtTenths: number) => spendable(buckets).reduce((s, b) => s + b.remainingTenths, 0) - debtTenths;

export interface Allocation {
  /** null = debt: nothing was left to take it from. */
  bucketId: string | null;
  tenths: number;
}

/** How a charge of `tenths` splits over the buckets (spend order); the shortfall is one debt allocation. */
export function allocate(buckets: BucketLike[], tenths: number): { allocations: Allocation[]; debtTenths: number } {
  if (!Number.isInteger(tenths) || tenths <= 0) throw new Error(`a charge is a positive whole number of tenths, not ${tenths}`);
  const allocations: Allocation[] = [];
  let left = tenths;
  for (const b of spendable(buckets)) {
    if (left <= 0) break;
    const take = Math.min(left, b.remainingTenths);
    allocations.push({ bucketId: b.id, tenths: take });
    left -= take;
  }
  if (left > 0) allocations.push({ bucketId: null, tenths: left });
  return { allocations, debtTenths: left };
}

/**
 * The carry-over cap at a renewal (docs/pricing.md: unused plan credits carry over one month, capped
 * at a month's amount): before the new period's bucket is granted, the open plan and upgrade buckets
 * together may hold at most `capTenths` (the plan just paid for); the excess expires, oldest first.
 * Returns what to expire from which bucket.
 */
export function carryOverCap(buckets: BucketLike[], capTenths: number): { bucketId: string; tenths: number }[] {
  const plan = buckets.filter((b) => b.closedAt === null && b.frozenAt === null && (b.source === "plan" || b.source === "upgrade") && b.remainingTenths > 0).sort(spendOrder);
  let excess = plan.reduce((s, b) => s + b.remainingTenths, 0) - Math.max(0, capTenths);
  const out: { bucketId: string; tenths: number }[] = [];
  for (const b of plan) {
    if (excess <= 0) break;
    const take = Math.min(excess, b.remainingTenths);
    out.push({ bucketId: b.id, tenths: take });
    excess -= take;
  }
  return out;
}

/**
 * When a bucket's credits end: a plan period's a month after the period (the carried month); an
 * upgrade's with the period's plan bucket; a pack's after 12 months; the Free month's at the cycle's
 * end; credits given by hand never.
 */
export function expiresAtFor(source: CreditSource, at: { now: Date; periodEnd?: Date | null; freeCycleEndsAt?: Date | null }): Date | null {
  switch (source) {
    case "plan":
    case "upgrade":
      return monthLater(at.periodEnd ?? at.now);
    case "pack":
      return addMonths(at.now, PACK_MONTHS);
    case "free":
      return at.freeCycleEndsAt ?? monthLater(at.now);
    case "admin":
      return null;
  }
}

/** The history line for an expiry, in the player's words. */
export function expireNote(source: CreditSource, startsAt: Date): string {
  switch (source) {
    case "free":
      return "Free credits ended";
    case "pack":
      return "Pack credits ended";
    case "admin":
      return "Credits ended";
    default:
      return `Credits from ${monthName(startsAt)} ended`;
  }
}

/** One line of a Paddle transaction (details.line_items[]), with the numbers already parsed. */
export interface LineItem {
  priceId: string;
  quantity: number;
  /** proration.rate (null when the line is not prorated, i.e. a whole period). */
  rate: number | null;
  /** totals.subtotal in cents: negative for the unused part of the old plan on an upgrade. */
  subtotalCents: number;
}

/**
 * Credits for a transaction: Σ over its lines of round_half_up(credits × quantity × rate), negative
 * lines (the old plan's unused share on an upgrade) subtracting. `tenthsOfPrice` maps a Paddle price
 * to its credits (tenths), null for a price we don't sell. A net of zero or less, or an unknown price,
 * is parked for a person (`parked` says why) and grants nothing. UPGRADE_CREDITS "full" (credits.ts,
 * the loophole) would ignore the rates and the negative lines.
 */
export function creditsForLines(lines: LineItem[], tenthsOfPrice: (priceId: string) => number | null, mode: "prorated" | "full" = UPGRADE_CREDITS): { tenths: number; parked: string | null } {
  let tenths = 0;
  for (const line of lines) {
    const base = tenthsOfPrice(line.priceId);
    if (base === null) return { tenths: 0, parked: `unknown price ${line.priceId}` };
    const sign = line.subtotalCents < 0 ? -1 : 1;
    if (mode === "full" && sign < 0) continue;
    const rate = mode === "full" ? 1 : (line.rate ?? 1);
    tenths += sign * roundHalfUp(base * line.quantity * rate);
  }
  if (tenths <= 0) return { tenths, parked: lines.length ? `nothing to grant (net ${tenths} tenths)` : "no line items" };
  return { tenths, parked: null };
}

/**
 * The refund for a payment (docs/pricing.md: the price × the unused share of that payment's credits),
 * before tax (Paddle adds the tax share), at most what is still refundable of the money (paid − refunded
 * already); never below zero. Medium ($20.00) with 30 of 100 credits used: 2000 × 700 / 1000 = 1400
 * cents. A refund Paddle made earlier has already taken its credits out of `remainingTenths`
 * (creditsToRemove), so it is not subtracted again: $5.00 refunded and 75 of 100 left → $15.00.
 */
export function refundQuoteCents(p: { paidCents: number; grantedTenths: number; remainingTenths: number; refundedCents: number }): number {
  if (p.grantedTenths <= 0) return 0;
  const share = roundHalfUp((p.paidCents * Math.max(0, Math.min(p.remainingTenths, p.grantedTenths))) / p.grantedTenths);
  return Math.max(0, Math.min(share, p.paidCents - p.refundedCents));
}

/**
 * Credits to remove when a refund is approved: all that is left of the (frozen) bucket for a refund
 * we asked for ourselves; otherwise (Paddle's own) the refunded money's share of the grant, at most
 * what is left.
 */
export function creditsToRemove(p: { grantedTenths: number; remainingTenths: number; refundSubtotalCents: number; paidCents: number; ours: boolean }): number {
  const left = Math.max(0, p.remainingTenths);
  if (p.ours) return left;
  if (p.paidCents <= 0) return left;
  return Math.min(left, roundHalfUp((p.grantedTenths * Math.abs(p.refundSubtotalCents)) / p.paidCents));
}

/**
 * When settle() next has something to do for a user: the soonest open bucket's end, the Free
 * cycle's end (Free users), or the day after the period ends (past due); null when nothing is due.
 */
export function nextSettleAt(u: {
  buckets: Pick<BucketLike, "expiresAt" | "closedAt">[];
  plan: string;
  freeCycleEndsAt: Date | null;
  subscriptionStatus: SubStatus | null;
  periodEndsAt: Date | null;
}): Date | null {
  const times: number[] = [];
  for (const b of u.buckets) if (b.closedAt === null && b.expiresAt) times.push(b.expiresAt.getTime());
  if (u.plan === "free" && u.freeCycleEndsAt) times.push(u.freeCycleEndsAt.getTime());
  if (u.subscriptionStatus === "past_due" && u.periodEndsAt) times.push(u.periodEndsAt.getTime() + PAST_DUE_GRACE_MS);
  return times.length ? new Date(Math.min(...times)) : null;
}

/** The credits ending soonest, for "12 credits end on 3 Nov": the spendable buckets whose end falls on the earliest day. */
export function expiringSoonest(buckets: BucketLike[]): { tenths: number; at: Date } | null {
  const dated = spendable(buckets).filter((b) => b.expiresAt);
  if (!dated.length) return null;
  const first = dated.reduce((a, b) => (b.expiresAt!.getTime() < a.expiresAt!.getTime() ? b : a));
  const day = first.expiresAt!.toISOString().slice(0, 10);
  const tenths = dated.filter((b) => b.expiresAt!.toISOString().slice(0, 10) === day).reduce((s, b) => s + b.remainingTenths, 0);
  return { tenths, at: first.expiresAt! };
}
