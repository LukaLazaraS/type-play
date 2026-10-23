// The billing screens' facts and words (payments part 3, docs/payments-design.md §8): the tick box
// and its wording version (stored with every purchase; the API refuses any other version), the plan
// facts read from site.ts, and where a purchase starts. Copy rule (docs/pricing.md): credits "to
// spend", "added", "ended", "refunded"; never balance, wallet, coins or gifts.
import type { PlanId } from "@typeplay/shared";
import { credits, plans, site } from "./site";

export type PaidPlan = Exclude<PlanId, "free">;
export const PAID_PLANS: PaidPlan[] = ["medium", "high", "ultra", "ultraplus"];

/**
 * The tick box, required on every purchase (a plan, an upgrade, a pack). v1, decided 2026-10-16
 * (docs/pricing.md "For the payment code"). A new wording is a new version here and in the API
 * (apps/server/src/billing/billing.service.ts CONSENT_VERSION), so every payment records which
 * words were ticked and when.
 */
export const consent = {
  version: "v1",
  text: "Start now: I ask TypePlay to begin right away. If I withdraw within 14 days, I pay for the credits I've used. Once all credits from this purchase are used, I can no longer withdraw.",
} as const;

/** site.ts calls Ultra+ "ultra-plus" in its links; the API says "ultraplus". */
export function planIdOf(siteId: string | null | undefined): PaidPlan | null {
  const id = siteId === "ultra-plus" ? "ultraplus" : siteId;
  return PAID_PLANS.includes(id as PaidPlan) ? (id as PaidPlan) : null;
}

/** A plan's name, price and monthly credits, from the pricing page's own numbers. */
export function planFacts(id: PlanId): { name: string; price: number; credits: number } {
  const p = plans.find((x) => planIdOf(x.id) === id || (id === "free" && x.id === "free"));
  return p ? { name: p.name, price: p.price, credits: p.credits } : { name: id, price: 0, credits: 0 };
}

/** The next plan up from this one; null on Ultra+. */
export function planAbove(id: PlanId): PaidPlan | null {
  const order: PlanId[] = ["free", ...PAID_PLANS];
  return (order[order.indexOf(id) + 1] as PaidPlan | undefined) ?? null;
}

export const pack = credits.pack;
export const support = { email: site.email, phone: site.phone } as const;

/** The checkout page for a plan or the pack, and where to go after ("/games/<id>", "/billing"). */
export const checkoutHref = (item: `plan:${PaidPlan}` | "pack", back?: string | null) =>
  `/billing/checkout?item=${item}${back ? `&back=${encodeURIComponent(back)}` : ""}`;

/** While a payment is disputed with the bank (403 billing_hold): buying and building are paused. */
export const HOLD_LINE = `A payment was disputed with your bank. Buying is paused; write to ${site.email}.`;
