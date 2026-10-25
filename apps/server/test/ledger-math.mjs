// Unit test of the ledger's arithmetic (src/credits/ledger-math.ts), no database:
//   npm run build -w @typeplay/server && npm run test:ledger -w @typeplay/server
import {
  addMonths,
  allocate,
  availableTenths,
  carryOverCap,
  creditsForLines,
  creditsToRemove,
  expireNote,
  expiresAtFor,
  expiringSoonest,
  monthLater,
  nextSettleAt,
  PAST_DUE_GRACE_MS,
  refundQuoteCents,
  roundHalfUp,
  spendable,
  startOfUtcDay,
} from "../dist/credits/ledger-math.js";
import { PLAN_CREDITS, toTenths, UPGRADE_CREDITS } from "../dist/credits/credits.js";

let failures = 0;
function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}
const iso = (d) => d.toISOString();
const at = (s) => new Date(s);
const sameDay = (ms) => iso(new Date(ms)).slice(0, 10);

console.log("rounding");
ok(roundHalfUp(2.5) === 3 && roundHalfUp(2.4999) === 2 && roundHalfUp(3) === 3, "half-up: 2.5 -> 3, 2.4999 -> 2");
ok(roundHalfUp(-2.5) === -3 && roundHalfUp(-2.4) === -2, "half-up away from zero: -2.5 -> -3");
ok(roundHalfUp(0.1 + 0.2 + 0.2) === 1 && roundHalfUp(1375 * 1) === 1375, "float noise forgiven; integers kept");

console.log("months, clamped");
ok(iso(monthLater(at("2026-01-31T10:00:00Z"))) === "2026-02-28T10:00:00.000Z", "31 Jan -> 28 Feb, time kept");
ok(iso(monthLater(at("2028-01-31T00:00:00Z"))) === "2028-02-29T00:00:00.000Z", "31 Jan 2028 -> 29 Feb (leap)");
ok(iso(monthLater(at("2026-10-31T23:59:59Z"))) === "2026-11-30T23:59:59.000Z", "31 Oct -> 30 Nov");
ok(iso(monthLater(at("2026-12-15T12:00:00Z"))) === "2027-01-15T12:00:00.000Z", "15 Dec -> 15 Jan next year");
ok(iso(addMonths(at("2026-10-18T00:00:00Z"), 12)) === "2027-10-18T00:00:00.000Z", "+12 months: a pack's year");
ok(iso(addMonths(at("2026-03-31T00:00:00Z"), -1)) === "2026-02-28T00:00:00.000Z", "a month back, clamped");
ok(iso(startOfUtcDay(at("2026-10-18T23:30:00Z"))) === "2026-10-18T00:00:00.000Z", "a day is a UTC day");

console.log("spend order and allocation");
const b = (id, source, extra = {}) => ({ id, source, startsAt: at("2026-10-01T00:00:00Z"), expiresAt: null, remainingTenths: 100, frozenAt: null, closedAt: null, ...extra });
const buckets = [
  b("admin", "admin"),
  b("pack-late", "pack", { expiresAt: at("2027-12-01T00:00:00Z") }),
  b("pack-soon", "pack", { expiresAt: at("2027-06-01T00:00:00Z") }),
  b("plan-new", "plan", { startsAt: at("2026-11-01T00:00:00Z"), expiresAt: at("2027-01-01T00:00:00Z") }),
  b("plan-old", "plan", { startsAt: at("2026-10-01T00:00:00Z"), expiresAt: at("2026-12-01T00:00:00Z") }),
  b("upgrade", "upgrade", { startsAt: at("2026-10-15T00:00:00Z"), expiresAt: at("2026-12-01T00:00:00Z") }),
  b("free", "free", { expiresAt: at("2026-11-01T00:00:00Z") }),
  b("closed", "free", { closedAt: at("2026-10-02T00:00:00Z") }),
  b("frozen", "plan", { frozenAt: at("2026-10-02T00:00:00Z") }),
  b("empty", "plan", { remainingTenths: 0 }),
];
ok(spendable(buckets).map((x) => x.id).join() === "free,plan-old,upgrade,plan-new,pack-soon,pack-late,admin", "free -> plan/upgrade oldest first -> packs soonest first -> admin; closed, frozen and empty left out");
ok(availableTenths(buckets, 0) === 700 && availableTenths(buckets, 30) === 670, "available = spendable remaining − debt (frozen left out)");
const a1 = allocate(buckets, 250);
ok(a1.allocations.map((x) => `${x.bucketId}:${x.tenths}`).join() === "free:100,plan-old:100,upgrade:50" && a1.debtTenths === 0, "25 credits: 10 free, 10 old plan, 5 upgrade");
const a2 = allocate(buckets, 760);
ok(a2.allocations.at(-1).bucketId === null && a2.allocations.at(-1).tenths === 60 && a2.debtTenths === 60, "76 credits on 70: the last 6 are debt (a null-bucket allocation)");
ok(a2.allocations.reduce((s, x) => s + x.tenths, 0) === 760, "allocations add up to the charge");
ok(allocate([], 17).debtTenths === 17 && allocate([], 17).allocations.length === 1, "nothing to take from: all debt");
let threw = false;
try {
  allocate(buckets, 0);
} catch {
  threw = true;
}
ok(threw, "a charge of 0 is refused");
ok(allocate(buckets, 1).allocations.every((x) => Number.isInteger(x.tenths)), "integer tenths out");

console.log("carry-over cap");
const planOnly = [b("p1", "plan", { startsAt: at("2026-08-01T00:00:00Z"), remainingTenths: 400 }), b("p2", "plan", { startsAt: at("2026-09-01T00:00:00Z"), remainingTenths: 900 }), b("pack", "pack", { remainingTenths: 400 }), b("free", "free", { remainingTenths: 50 })];
const cap = carryOverCap(planOnly, toTenths(PLAN_CREDITS.medium));
ok(cap.map((x) => `${x.bucketId}:${x.tenths}`).join() === "p1:300", "1,300 plan tenths capped at Medium's 1,000: 300 expire from the oldest; packs and free untouched");
ok(carryOverCap(planOnly, 2750).length === 0, "under High's 2,750: nothing expires");
const capTwo = carryOverCap(planOnly, 500);
ok(capTwo.map((x) => `${x.bucketId}:${x.tenths}`).join() === "p1:400,p2:400", "cap 500 on 1,300: the oldest bucket goes entirely, then 400 of the next");
ok(carryOverCap([b("f", "plan", { frozenAt: at("2026-10-02T00:00:00Z"), remainingTenths: 5000 })], 1000).length === 0, "a frozen bucket (refund pending) is never capped");

console.log("expiry dates and notes");
const now = at("2026-10-18T12:00:00Z");
ok(iso(expiresAtFor("plan", { now, periodEnd: at("2026-11-18T12:00:00Z") })) === "2026-12-18T12:00:00.000Z", "plan credits end a month after the period (the carried month)");
ok(iso(expiresAtFor("upgrade", { now, periodEnd: at("2026-11-18T12:00:00Z") })) === "2026-12-18T12:00:00.000Z", "an upgrade ends with the period's plan bucket");
ok(iso(expiresAtFor("pack", { now })) === "2027-10-18T12:00:00.000Z", "a pack lasts 12 months");
ok(iso(expiresAtFor("free", { now, freeCycleEndsAt: at("2026-11-03T00:00:00Z") })) === "2026-11-03T00:00:00.000Z", "free credits end with the cycle");
ok(expiresAtFor("admin", { now }) === null, "credits given by hand never end");
ok(expireNote("free", now) === "Free credits ended" && expireNote("pack", now) === "Pack credits ended", "notes: free, pack");
ok(expireNote("plan", at("2026-10-05T00:00:00Z")) === "Credits from October ended" && expireNote("upgrade", at("2026-11-30T23:00:00Z")) === "Credits from November ended", "plan and upgrade notes name the month (UTC)");

console.log("credits for a Paddle transaction");
const price = (id) => ({ pri_medium: toTenths(PLAN_CREDITS.medium), pri_high: toTenths(PLAN_CREDITS.high), pri_pack: 400 })[id] ?? null;
ok(UPGRADE_CREDITS === "prorated", "decided: upgrade credits are prorated");
ok(creditsForLines([{ priceId: "pri_medium", quantity: 1, rate: null, subtotalCents: 2000 }], price).tenths === 1000, "a new Medium plan: 100 credits");
const half = creditsForLines([{ priceId: "pri_high", quantity: 1, rate: 0.5, subtotalCents: 2500 }, { priceId: "pri_medium", quantity: 1, rate: 0.5, subtotalCents: -1000 }], price);
ok(half.tenths === 875 && half.parked === null, "Medium -> High at half a period: 275 × 0.5 − 100 × 0.5 = 87.5 credits");
const real = creditsForLines([{ priceId: "pri_high", quantity: 1, rate: 0.99993, subtotalCents: 5000 }, { priceId: "pri_medium", quantity: -1, rate: 0.99993, subtotalCents: -2000 }], price);
ok(real.tenths === 1750 && real.parked === null, "Paddle's own upgrade lines (sandbox 2026-10-25: the old plan as quantity -1, subtotal -2000): 275 − 100 = 175 credits, not 375");
const full = creditsForLines([{ priceId: "pri_high", quantity: 1, rate: 0.5, subtotalCents: 2500 }, { priceId: "pri_medium", quantity: 1, rate: 0.5, subtotalCents: -1000 }], price, "full");
ok(full.tenths === 2750, '"full" (the loophole) would grant the whole 275');
ok(creditsForLines([{ priceId: "pri_pack", quantity: 3, rate: null, subtotalCents: 3000 }], price).tenths === 1200, "3 packs: 120 credits");
ok(creditsForLines([{ priceId: "pri_high", quantity: 1, rate: 0.33333, subtotalCents: 1667 }], price).tenths === 917, "2750 × 0.33333 = 916.66 -> 917 (half-up, once per line)");
const neg = creditsForLines([{ priceId: "pri_medium", quantity: 1, rate: 0.2, subtotalCents: 400 }, { priceId: "pri_high", quantity: 1, rate: 0.5, subtotalCents: -2500 }], price);
ok(neg.tenths <= 0 && /nothing to grant/.test(neg.parked), "a negative net is parked, nothing granted");
ok(/unknown price/.test(creditsForLines([{ priceId: "pri_other", quantity: 1, rate: null, subtotalCents: 100 }], price).parked), "an unknown price is parked");
ok(/no line items/.test(creditsForLines([], price).parked), "no lines: parked");

console.log("refunds");
ok(refundQuoteCents({ paidCents: 2000, grantedTenths: 1000, remainingTenths: 700, refundedCents: 0 }) === 1400, "the policy's example: Medium, 30 of 100 used -> $14.00");
// A refund Paddle made earlier took its credits out already (creditsToRemove), so the quote is the share of what is left, capped by the money left.
ok(refundQuoteCents({ paidCents: 2000, grantedTenths: 1000, remainingTenths: 700, refundedCents: 500 }) === 1400, "after a $5.00 partial refund with 70 left: $14.00 (the unused share, not minus the $5 again)");
ok(refundQuoteCents({ paidCents: 2000, grantedTenths: 1000, remainingTenths: 750, refundedCents: 500 }) === 1500, "Paddle refunded $5.00 (25 credits removed), 75 left untouched: $15.00, all that is left of the $20");
ok(refundQuoteCents({ paidCents: 2000, grantedTenths: 1000, remainingTenths: 1000, refundedCents: 500 }) === 1500, "never more than the money left: 100 left but $5 refunded -> $15.00");
ok(refundQuoteCents({ paidCents: 5000, grantedTenths: 2750, remainingTenths: 1, refundedCents: 0 }) === 2, "High with 0.1 credit left: 5000 × 1 / 2750 = 1.8 -> 2 cents");
ok(refundQuoteCents({ paidCents: 2000, grantedTenths: 1000, remainingTenths: 0, refundedCents: 0 }) === 0, "all used: $0 (refused)");
ok(refundQuoteCents({ paidCents: 2000, grantedTenths: 1000, remainingTenths: 1000, refundedCents: 2000 }) === 0, "never below zero");
ok(creditsToRemove({ grantedTenths: 1000, remainingTenths: 700, refundSubtotalCents: 1400, paidCents: 2000, ours: true }) === 700, "our own refund removes all that is left");
ok(creditsToRemove({ grantedTenths: 1000, remainingTenths: 700, refundSubtotalCents: 500, paidCents: 2000, ours: false }) === 250, "Paddle's $5.00 refund on $20.00 removes 25 credits");
ok(creditsToRemove({ grantedTenths: 1000, remainingTenths: 100, refundSubtotalCents: 1900, paidCents: 2000, ours: false }) === 100, "never more than what is left");

console.log("the next settle and the credits ending soonest");
const soon = nextSettleAt({ buckets: [{ expiresAt: at("2026-11-03T00:00:00Z"), closedAt: null }, { expiresAt: at("2026-10-20T00:00:00Z"), closedAt: at("2026-10-19T00:00:00Z") }], plan: "free", freeCycleEndsAt: at("2026-11-03T00:00:00Z"), subscriptionStatus: null, periodEndsAt: null });
ok(iso(soon) === "2026-11-03T00:00:00.000Z", "the soonest open bucket end (closed ones ignored)");
const lapse = nextSettleAt({ buckets: [], plan: "high", freeCycleEndsAt: null, subscriptionStatus: "past_due", periodEndsAt: at("2026-11-17T00:00:00Z") });
ok(lapse.getTime() === at("2026-11-17T00:00:00Z").getTime() + PAST_DUE_GRACE_MS && PAST_DUE_GRACE_MS === 86_400_000, "past due: a day after the period ends");
ok(nextSettleAt({ buckets: [{ expiresAt: null, closedAt: null }], plan: "medium", freeCycleEndsAt: at("2026-11-03T00:00:00Z"), subscriptionStatus: "active", periodEndsAt: at("2026-11-17T00:00:00Z") }) === null, "a paid plan with only an admin bucket: nothing due (the free cycle is Free's)");
const ending = expiringSoonest([b("free", "free", { expiresAt: at("2026-11-03T09:00:00Z"), remainingTenths: 120 }), b("pack", "pack", { expiresAt: at("2027-10-18T00:00:00Z") }), b("admin", "admin")]);
ok(ending.tenths === 120 && sameDay(ending.at.getTime()) === "2026-11-03", '"12 credits end on 3 Nov"');
ok(expiringSoonest([b("admin", "admin")]) === null, "nothing dated: null");

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
