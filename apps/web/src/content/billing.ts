// The billing screens' facts and words (payments part 3, docs/payments-design.md §8): the tick box
// and its wording version (stored with every purchase; the API refuses any other version), the plan
// facts read from site.ts, and where a purchase starts. Copy rule (docs/pricing.md): credits "to
// spend", "added", "ended", "refunded"; never balance, wallet, coins or gifts.
import type { PlanId } from "@typeplay/shared";
import { app } from "./app";
import { closedBeta } from "./beta";
import { credits, plans, site } from "./site";

/**
 * Paid plans can be bought from this build: Paddle's client token was set when it was built (NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
 * deploy/server/compose.yaml; "go paid" is docs/beta/runbook.md step 13). On the billing pages the API's billing mode
 * (Me.billing.mode) must say so too.
 */
export const paddleOn = app.paddle.clientToken.length > 0;

/**
 * Whether this build sells paid plans, by its two flags and never by a code edit (the launch-pages job, call 2):
 * - "on": Paddle's token is set. A plan's button opens the checkout (through /create?plan=).
 * - "beta": the closed beta (NEXT_PUBLIC_CLOSED_BETA=1), no token. A plan's button goes the way it always has (sign in,
 *   then the closed-beta page: the beta code, or "Tell me when it opens", the waitlist), and says so.
 * - "off": open sign-up, no token yet (the open launch before billing goes on). Paid plans aren't on sale; Free is how to
 *   start, and the button and the page after it say exactly that. No dates.
 */
export type Sale = "on" | "beta" | "off";
export const sale: Sale = paddleOn ? "on" : closedBeta ? "beta" : "off";

/** The words wherever a paid plan can't be bought yet: the pricing page, the checkout, /billing and /create?plan=. */
export const notOnSale = {
  /** The one sentence, the same everywhere. */
  line: "Paid plans aren't on sale yet.",
  /** A plan by name, on the page its button leads to (/create?plan=, the checkout). */
  plan: (name: string) => `${name} isn't on sale yet.`,
  /** The credit pack, on its checkout page. */
  pack: "Credit packs aren't on sale yet.",
  /** What to do instead in the closed beta: credits by hand, for the invited testers (the address follows as a link). */
  beta: "During the closed beta, we add credits by hand: write to",
  /** What to do instead at the open launch. */
  free: `Free is how to start: ${credits.freePerMonth} credits a month on Fast, up to ${credits.freePerDay} a day.`,
} as const;

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
