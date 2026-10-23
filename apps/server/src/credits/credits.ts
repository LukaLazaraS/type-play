// Credit rules from docs/pricing.md: pure numbers, shared by the API and the admin CLI.
// Credits have one decimal; the math runs in tenths (integers) so 0.1 + 0.2 stays 0.3.
import type { Effort, Estimate, ModelChoice, PlanId } from "@typeplay/shared";

export const PLANS: PlanId[] = ["free", "medium", "high", "ultra", "ultraplus"];
export const MODELS: ModelChoice[] = ["fast", "smart", "best"];

/** Which models a plan may use. Every paid plan has the same AI. */
export const planModels = (plan: PlanId): ModelChoice[] => (plan === "free" ? ["fast"] : [...MODELS]);

/** 1 credit = $0.06 of AI work at API list prices. */
export const CREDIT_USD = 0.06;
/** Free plan: 20 credits at sign-up and 20 more each month (ledger.service `settle`), at most 5 a day. */
export const FREE_SIGNUP_CREDITS = 20;
export const FREE_MONTHLY_CREDITS = 20;
export const FREE_DAILY_CREDITS = 5;
/** The kill switch (docs/pricing.md "The free plan"): once Free runs have cost this much AI today
 * (API list price, before VAT; Message.costUsd by Message.plan, failed runs included), Free builds
 * stop until 00:00 UTC. Read as the literal $20, not the "~280 credits" after-VAT figure (§14(b)). */
export const FREE_DAILY_AI_USD = 20;

/** Credits a month per plan, and the plan's price (cents, USD, before tax): docs/pricing.md. Part 2
 * checks Paddle's catalog against these at start. */
export const PLAN_CREDITS: Record<PlanId, number> = { free: FREE_MONTHLY_CREDITS, medium: 100, high: 275, ultra: 600, ultraplus: 1300 };
export const PLAN_PRICE_CENTS: Record<PlanId, number> = { free: 0, medium: 2000, high: 5000, ultra: 10000, ultraplus: 20000 };
/** The plan's name as the site writes it (the grant notes "Medium plan", "Renewal: High", "Upgrade to Ultra+"). */
export const PLAN_NAME: Record<PlanId, string> = { free: "Free", medium: "Medium", high: "High", ultra: "Ultra", ultraplus: "Ultra+" };
/** The credit pack: $10 once, 40 credits, paid plans only, good for 12 months. */
export const PACK_CREDITS = 40;
export const PACK_PRICE_CENTS = 1000;
export const PACK_MONTHS = 12;

/**
 * Decided (docs/payments-design.md §14(a)): an upgrade mid-period grants the credits Paddle charges
 * for, pro rata (Medium -> High at half a period: 275 × 0.5 − 100 × 0.5 = 87.5 credits). "full" would
 * grant the new plan's whole month and let a Medium user buy 275 credits for about $21 by upgrading on
 * day 29 and downgrading at renewal.
 */
export const UPGRADE_CREDITS: "prorated" | "full" = "prorated";
/**
 * Decided (§14(f)): when a plan is cancelled or lapses, pack credits stay spendable under Free's
 * rules (Fast only, 5 a day) for the rest of their 12 months, rather than waiting for a new plan.
 */
export const PACK_CREDITS_AFTER_CANCEL: "spendable" | "frozen" = "spendable";
/** A message whose estimate's `high` passes this asks first (confirm: true). */
export const askFirstLimit = (plan: PlanId) => (plan === "free" ? 3 : 25);
/** Builds one user may have going at once (docs/pricing.md: High and above "two builds at once"). */
export const runsAtOnce = (plan: PlanId) => (plan === "free" || plan === "medium" ? 1 : 2);

/** Typical cost and range per message, measured (packages/agent/RESULTS.md, docs/pricing.md). */
const TABLE: Record<"new" | "edit", Record<ModelChoice, [typical: number, low: number, high: number]>> = {
  edit: { fast: [0.3, 0.1, 0.5], smart: [1.3, 0.8, 2.1], best: [3.3, 2.5, 4.2] },
  new: { fast: [1.7, 1.2, 2.1], smart: [6.7, 5, 8.2], best: [17, 13, 24] },
};

export const EFFORTS: Effort[] = ["low", "medium", "high"];

/** How effort moves the cost, against medium (the table above), measured in packages/agent/RESULTS.md:
 * Haiku low $0.038 vs medium $0.049 (0.8×); Opus high $1.46 vs medium $0.82 (1.8×). */
const EFFORT_FACTOR: Record<Effort, number> = { low: 0.8, medium: 1, high: 1.8 };

export function estimate(kind: "new" | "edit", model: ModelChoice, plan: PlanId, effort: Effort = "medium"): Estimate {
  const f = EFFORT_FACTOR[effort];
  const [typical, low, high] = TABLE[kind][model].map((c) => fromTenths(Math.max(1, Math.round(c * f * 10))));
  return { kind, model, typical, low, high, needsConfirm: high > askFirstLimit(plan), effort };
}

export const toTenths = (credits: number) => Math.round(credits * 10);
export const fromTenths = (tenths: number) => tenths / 10;

/** What a finished run costs: its API-equivalent dollars in credits, rounded up to 0.1, at least 0.1. */
export function creditsForUsd(usd: number): number {
  const tenths = Math.ceil((usd / CREDIT_USD) * 10 - 1e-9);
  return fromTenths(Math.max(1, tenths));
}
