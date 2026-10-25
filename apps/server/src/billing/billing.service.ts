// What the billing endpoints (part 3), the admin CLI and the account page need from Paddle
// (docs/payments-design.md §5, §7): the customer link, a checkout transaction, the verify pull, a plan
// change (preview, apply, undo), cancel and keep, a portal session, a refund we ask for, `admin sync`,
// and the cancel before an account closes. Every change to our rows goes through billing/handlers.ts
// with Paddle's own answer as the payload, so a webhook for the same thing is a no-op afterwards.
import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { AccountExport, BillingInfo, BillingPayment, BillingSubscription, MeBilling, PlanId } from "@typeplay/shared";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import { PLAN_NAME, PLAN_PRICE_CENTS, PLANS } from "../credits/credits.js";
import { creditsForLines, refundQuoteCents } from "../credits/ledger-math.js";
import { LedgerService } from "../credits/ledger.service.js";
import { config } from "../env.js";
import type { Payment, PrismaClient, Refund, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { BillingHandlers, linesOf, type Ctx } from "./handlers.js";
import { cents, PaddleClient, PaddleError, PaddleUnreachable } from "./paddle.client.js";
import { PAID_PLANS, PaddleService, type PaidPlan } from "./paddle.service.js";
import type { PaddleAdjustment, PaddleCustomer, PaddlePortalSession, PaddleSubscription, PaddleSubscriptionPreview, PaddleTransaction } from "./paddle.types.js";

export type CheckoutItem = { kind: "plan"; plan: PaidPlan } | { kind: "pack" };

export interface Consent {
  version: string;
  at: Date;
  termsAcceptedAt: Date;
}

/**
 * The tick box's wording version (docs/pricing.md "For the payment code"; the words live in the site,
 * apps/web/src/content/billing.ts). A checkout naming another version is refused, so a page left open
 * across a wording change can't record the old one. A new wording is a new version on both sides.
 */
export const CONSENT_VERSION = "v1";

/** POST /billing/checkout's body: the item, the current wording version, and the acceptance line seen. */
export function parseCheckout(body: unknown, now = new Date()): { item: CheckoutItem; consent: Consent } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const item = parseItem(b.item);
  if (b.consentVersion !== CONSENT_VERSION) throw badRequest("The checkout wording changed: reload the page and tick the box again.");
  if (b.acceptedTerms !== true) throw badRequest("Tick the box and accept the terms to continue.");
  return { item, consent: { version: CONSENT_VERSION, at: now, termsAcceptedAt: now } };
}

/** ?plan= / { plan }: a paid plan, or 400. */
export function parsePlan(plan: unknown): PaidPlan {
  if (typeof plan === "string" && PAID_PLANS.includes(plan as PaidPlan)) return plan as PaidPlan;
  throw badRequest(plan === "free" ? "Free isn't a plan to move to: cancel your plan instead." : "Pick a plan: medium, high, ultra or ultraplus.");
}

/** GET /billing/plan-change (part 3's contract shape, docs/payments-design.md §9). */
export interface PlanChangePreview {
  direction: "up" | "down";
  /** Charged now, tax included; `taxNowUsd` is the tax part of it. */
  chargeNowUsd: number;
  taxNowUsd: number;
  creditsNow: number;
  nextRenewalUsd: number;
  effectiveAt: string;
}

export interface PortalLinks {
  overview: string;
  cancel: string | null;
  updatePaymentMethod: string | null;
}

/** No change within this long before the renewal: Paddle refuses it (docs/research/paddle-2026.md R-S2). */
const RENEWAL_LOCK_MS = 30 * 60_000;
const LOOKUP_MS = 5 * 60_000;
const HOLD_MESSAGE = "A payment was disputed with your bank. Buying is paused; write to hello@typeplay.app.";
const UNREACHABLE = "Paddle didn't answer. Try again in a few minutes.";

/** "plan:medium" | "pack" → what it is, or 400. */
export function parseItem(item: unknown): CheckoutItem {
  if (item === "pack") return { kind: "pack" };
  const m = typeof item === "string" ? /^plan:([a-z]+)$/.exec(item) : null;
  if (m && PLANS.includes(m[1] as PlanId) && m[1] !== "free") return { kind: "plan", plan: m[1] as PaidPlan };
  throw badRequest("Pick a plan or the credit pack.");
}

const hasSubscription = (u: User) => !!u.paddleSubscriptionId && (u.subscriptionStatus === "active" || u.subscriptionStatus === "past_due" || u.subscriptionStatus === "paused");
/**
 * When Paddle changed the subscription, by Paddle's clock: what a change applied straight from Paddle's answer is
 * ordered by, against the webhooks' occurred_at (Paddle's clock too). Our own clock would mix two: on a PC running
 * 32 s slow (sandbox, 2026-10-25) a cancel made 2 s after a webhook was skipped as "older" until its own webhook came.
 */
const changedAt = (s: PaddleSubscription) => (s.updated_at ? new Date(s.updated_at) : new Date());

@Injectable()
export class BillingService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("billing");
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly ledger: LedgerService,
    private readonly paddle: PaddleService,
    private readonly handlers: BillingHandlers,
  ) {}

  onModuleInit() {
    if (this.paddle.mode === "off" || !config.billingJobs) return;
    this.timer = setInterval(() => {
      void this.refundLookups()
        .catch((e) => this.log.error(`refund lookups: ${e}`))
        .then(() => this.adjustmentCancels())
        .catch((e) => this.log.error(`adjustment cancels: ${e}`));
    }, LOOKUP_MS);
    this.timer.unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---- Who may buy ---------------------------------------------------------------------------

  /** Billing as this user sees it: sandbox on the live site is for ADMIN_EMAILS only; everyone on Luka's PC. */
  modeFor(user: Pick<User, "email">): MeBilling["mode"] {
    const mode = this.paddle.mode;
    if (mode === "sandbox" && config.production && !config.adminEmails.includes(user.email.toLowerCase())) return "off";
    return mode;
  }

  /** Me.billing. */
  meBilling(user: User): MeBilling {
    const sub = user.subscriptionStatus;
    const status: MeBilling["status"] = sub === "past_due" ? "past_due" : sub === "active" && hasSubscription(user) ? (user.cancelsAt ? "canceling" : "active") : "free";
    return {
      mode: this.modeFor(user),
      status,
      pendingPlan: (user.pendingPlan as PlanId | null) ?? null,
      periodEndsAt: user.periodEndsAt?.toISOString() ?? null,
      cancelsAt: user.cancelsAt?.toISOString() ?? null,
      hold: user.billingFlag === "chargeback" ? "chargeback" : null,
      freeRefillAt: user.plan === "free" ? (user.freeCycleEndsAt?.toISOString() ?? null) : null,
    };
  }

  /** GET /billing: the plan and billing page in one answer (503 billing_off when payments are off for this user). */
  async info(user: User): Promise<BillingInfo> {
    const mode = this.modeFor(user);
    if (mode === "off") throw new ApiException(503, "billing_off", "Payments aren't available on this server yet.");
    const [parts, rows, pendingRefunds] = await Promise.all([
      this.ledger.parts(user.id),
      this.prisma.payment.findMany({ where: { userId: user.id }, orderBy: { paidAt: "desc" }, take: 200 }),
      this.prisma.refund.findMany({ where: { userId: user.id, status: { in: ["requested", "pending", "lookup"] } } }),
    ]);
    const payments = rows.map((p) => this.paymentView(p, pendingRefunds));
    const consented = rows.find((p) => p.consentVersion && p.consentAt);
    const lastPlanPayment = rows.find((p) => p.kind !== "pack");
    const subscription: BillingSubscription | null =
      user.paddleSubscriptionId && user.subscriptionStatus
        ? {
            status: user.subscriptionStatus,
            renewsAt: user.cancelsAt ? null : (user.nextBilledAt?.toISOString() ?? null),
            endsAt: user.periodEndsAt?.toISOString() ?? null,
            cancelsAt: user.cancelsAt?.toISOString() ?? null,
            pendingPlan: (user.pendingPlan as PlanId | null) ?? null,
            paymentFailedAt: user.lastPaymentFailedAt?.toISOString() ?? null,
            paymentMethod: user.paymentMethod,
            lastPlan: lastPlanPayment ? this.planOf(lastPlanPayment.priceId) : null,
          }
        : null;
    return {
      mode,
      plan: user.plan as PlanId,
      subscription,
      credits: { parts },
      canBuyPack: user.plan !== "free" && user.billingFlag !== "chargeback",
      payments,
      consent: consented ? { version: consented.consentVersion!, at: consented.consentAt!.toISOString() } : null,
      hold: user.billingFlag === "chargeback" ? "chargeback" : null,
    };
  }

  private planOf(priceId: string): PlanId | null {
    const p = this.paddle.priceOf(priceId);
    return p?.kind === "plan" ? p.plan : null;
  }

  /** A Payment row as the billing page and the data export list it. */
  private paymentView(p: Payment, pendingRefunds: Refund[]): BillingPayment {
    const plan = this.planOf(p.priceId);
    const name = plan ? PLAN_NAME[plan] : "plan";
    const what = p.kind === "pack" ? "Credit pack" : p.kind === "renewal" ? `Renewal: ${name}` : p.kind === "upgrade" ? `Upgrade to ${name}` : `${name} plan`;
    const pending = pendingRefunds.find((r) => r.paymentId === p.id);
    return {
      id: p.id,
      at: p.paidAt.toISOString(),
      what,
      amountUsd: p.paidCents / 100,
      taxUsd: p.taxCents / 100,
      invoiceNumber: p.invoiceNumber,
      refundableUntil: p.refundableUntil.toISOString(),
      refundedUsd: p.refundedCents / 100,
      status: p.status === "charged_back" ? "disputed" : p.status === "completed" ? "paid" : p.status,
      refundPendingUsd: pending ? pending.quoteCents / 100 : null,
    };
  }

  /** GET /me/export: every payment we recorded (newest first) with the tick box ticked for it (the privacy policy's export; docs/payments-design.md §14(e)). */
  async exportPayments(userId: string): Promise<AccountExport["payments"]> {
    const [rows, pendingRefunds] = await Promise.all([
      this.prisma.payment.findMany({ where: { userId }, orderBy: { paidAt: "desc" } }),
      this.prisma.refund.findMany({ where: { userId, status: { in: ["requested", "pending", "lookup"] } } }),
    ]);
    return rows.map((p) => ({ ...this.paymentView(p, pendingRefunds), consentVersion: p.consentVersion, consentAt: p.consentAt?.toISOString() ?? null }));
  }

  /** 503 billing_off when payments aren't on for this user, 403 billing_hold after a chargeback. */
  assertAllowed(user: User) {
    if (this.modeFor(user) === "off") throw new ApiException(503, "billing_off", "Payments aren't available on this server yet.");
    if (user.billingFlag === "chargeback") throw new ApiException(403, "billing_hold", HOLD_MESSAGE);
  }

  private fresh(userId: string): Promise<User> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  /** Paddle's answer as the user should hear it: not answering → 503; a refusal → 409 with its words. */
  private paddleFailed(e: unknown, what: string): never {
    if (e instanceof ApiException) throw e;
    if (e instanceof PaddleUnreachable) throw new ApiException(503, "billing_off", UNREACHABLE);
    if (e instanceof PaddleError) {
      this.log.warn(`${what}: ${e.message}`);
      if (/declin|payment_fail|insufficient|card/i.test(e.code)) throw new ApiException(409, "billing_busy", "Your card was declined. Update it in Manage billing, then try again.");
      throw new ApiException(409, "billing_busy", `Paddle couldn't do that right now: ${e.code.replace(/_/g, " ")}. Try again in an hour, or write to hello@typeplay.app.`);
    }
    throw e;
  }

  // ---- Customer and checkout -----------------------------------------------------------------

  /** The user's Paddle customer: made on the first checkout (a 409 means Paddle has the email: fetched by it). */
  async ensureCustomer(user: User, client: PaddleClient): Promise<string> {
    if (user.paddleCustomerId) return user.paddleCustomerId;
    let id: string;
    try {
      id = (await client.post<PaddleCustomer>("/customers", { email: user.email, name: user.name ?? undefined, custom_data: { userId: user.id } })).id;
    } catch (e) {
      if (!(e instanceof PaddleError && e.status === 409)) throw e;
      const found = (await client.get<PaddleCustomer[]>("/customers", { email: user.email })).find((c) => c.email.toLowerCase() === user.email.toLowerCase());
      if (!found) throw new ApiException(409, "billing_busy", "Paddle has a customer with your email that it won't show us. Write to hello@typeplay.app.");
      id = found.id;
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { paddleCustomerId: id } });
    return id;
  }

  /**
   * POST /billing/checkout: a server-created transaction the overlay opens by id. A pack needs a paid
   * plan (403 plan_required); a plan while subscribed is a change, not a second subscription (409).
   */
  async createCheckout(user: User, item: CheckoutItem, consent: Consent): Promise<{ transactionId: string }> {
    this.assertAllowed(user);
    if (item.kind === "pack" && user.plan === "free") throw new ApiException(403, "plan_required", "Credit packs are for paid plans. Get Medium first: 100 credits a month, Smart and Best.");
    if (item.kind === "plan" && hasSubscription(user)) throw new ApiException(409, "billing_busy", "You already have a plan. Change it on the billing page instead of buying a second one.");
    const client = await this.paddle.require();
    const itemText = item.kind === "pack" ? "pack" : `plan:${item.plan}`;
    let txn: PaddleTransaction;
    try {
      const customerId = await this.ensureCustomer(user, client);
      txn = await client.post<PaddleTransaction>("/transactions", {
        items: [{ price_id: this.paddle.priceIdFor(item.kind === "pack" ? "pack" : item.plan), quantity: 1 }],
        customer_id: customerId,
        custom_data: { userId: user.id, item: itemText, consentVersion: consent.version, consentAt: consent.at.toISOString() },
        collection_mode: "automatic",
      });
    } catch (e) {
      this.paddleFailed(e, "checkout");
    }
    await this.prisma.checkoutSession.updateMany({ where: { userId: user.id, status: "open" }, data: { status: "abandoned" } });
    await this.prisma.checkoutSession.create({ data: { id: txn.id, userId: user.id, item: itemText, consentVersion: consent.version, consentAt: consent.at, termsAcceptedAt: consent.termsAcceptedAt } });
    await this.ledger.audit(this.prisma, { actor: `user:${user.id}`, userId: user.id, action: "checkout_opened", details: { transaction: txn.id, item: itemText, consentVersion: consent.version } });
    return { transactionId: txn.id };
  }

  /** GET /billing/checkout/:id: what our rows say (completed once the Payment is written). */
  async checkoutStatus(user: User, transactionId: string): Promise<{ status: "open" | "completed" | "abandoned" }> {
    const session = await this.prisma.checkoutSession.findFirst({ where: { id: transactionId, userId: user.id } });
    if (!session) throw notFound("We couldn't find that checkout.");
    if (session.status === "completed" || (await this.prisma.payment.findUnique({ where: { id: transactionId }, select: { id: true } }))) return { status: "completed" };
    return { status: session.status === "abandoned" ? "abandoned" : "open" };
  }

  /**
   * POST /billing/checkout/:id/verify: no webhook in 20 s, so fetch the transaction and apply it
   * through the same handler (the webhook, when it lands, is then a no-op).
   */
  async verifyCheckout(user: User, transactionId: string): Promise<{ status: "open" | "completed" | "abandoned" }> {
    const current = await this.checkoutStatus(user, transactionId);
    if (current.status === "completed") return current;
    const client = await this.paddle.require();
    let t: PaddleTransaction;
    try {
      t = await client.get<PaddleTransaction>(`/transactions/${encodeURIComponent(transactionId)}`);
    } catch (e) {
      this.paddleFailed(e, "verify");
    }
    if (t.status === "completed") {
      const result = await this.handlers.transactionCompleted(t, new Date(t.updated_at ?? Date.now()), { eventId: `txn:${t.id}`, actor: `pull:${user.id}` });
      if (result.status === "processed") return { status: "completed" };
      this.log.warn(`verify ${t.id}: ${result.status}: ${result.note}`);
      return { status: "open" };
    }
    if (t.status === "canceled") {
      await this.prisma.checkoutSession.update({ where: { id: transactionId }, data: { status: "abandoned" } });
      return { status: "abandoned" };
    }
    return { status: "open" };
  }

  // ---- Plan changes --------------------------------------------------------------------------

  private subscriptionFor(user: User): string {
    if (!hasSubscription(user) || user.subscriptionStatus !== "active") {
      throw new ApiException(409, "billing_busy", user.subscriptionStatus === "past_due" ? "Your last payment didn't go through. Update your card first." : "You don't have a plan to change: get one first.");
    }
    if (user.nextBilledAt && user.nextBilledAt.getTime() - Date.now() < RENEWAL_LOCK_MS && user.nextBilledAt.getTime() > Date.now() - RENEWAL_LOCK_MS) {
      throw new ApiException(409, "billing_busy", "Your renewal is about to run. Try again in an hour.");
    }
    return user.paddleSubscriptionId!;
  }

  private changeBody(plan: PaidPlan, mode: "prorated_immediately" | "do_not_bill") {
    return { items: [{ price_id: this.paddle.priceIdFor(plan), quantity: 1 }], proration_billing_mode: mode, on_payment_failure: "prevent_change" };
  }

  /**
   * GET /billing/plan-change?plan=: up = Paddle bills the card now (prorated) and the credits follow;
   * down = nothing now, the new price at the renewal (`do_not_bill`, refused unless Paddle's preview
   * says exactly that: to confirm in the sandbox, docs/payments-design.md §7).
   */
  async previewPlanChange(user: User, plan: PaidPlan): Promise<PlanChangePreview & { subscriptionId: string }> {
    this.assertAllowed(user);
    if (plan === user.plan) throw badRequest(`You're on ${PLAN_NAME[plan]} already.`);
    if (user.pendingPlan) throw new ApiException(409, "billing_busy", `Undo your change to ${PLAN_NAME[user.pendingPlan as PlanId]} first.`);
    const subscriptionId = this.subscriptionFor(user);
    const direction: "up" | "down" = PLAN_PRICE_CENTS[plan] > PLAN_PRICE_CENTS[user.plan as PlanId] ? "up" : "down";
    const client = await this.paddle.require();
    let preview: PaddleSubscriptionPreview;
    try {
      preview = await client.patch<PaddleSubscriptionPreview>(`/subscriptions/${encodeURIComponent(subscriptionId)}/preview`, this.changeBody(plan, direction === "up" ? "prorated_immediately" : "do_not_bill"));
    } catch (e) {
      this.paddleFailed(e, "plan change preview");
    }
    const nextRenewalUsd = PLAN_PRICE_CENTS[plan] / 100;
    if (direction === "up") {
      const now = preview.immediate_transaction;
      if (!now?.details) throw new ApiException(409, "billing_busy", "Paddle gave no price for the change. Try again in a minute.");
      const total = cents(now.details.totals?.total ?? "0");
      const tax = cents(now.details.totals?.tax ?? "0");
      const credits = creditsForLines(linesOf({ details: now.details } as PaddleTransaction), this.paddle.tenthsOfPrice);
      return { direction, chargeNowUsd: total / 100, taxNowUsd: tax / 100, creditsNow: Math.max(0, credits.tenths) / 10, nextRenewalUsd, effectiveAt: new Date().toISOString(), subscriptionId };
    }
    const next = preview.next_transaction;
    const nextSubtotal = next?.details?.totals?.subtotal;
    if (preview.immediate_transaction || !next || nextSubtotal === undefined || cents(nextSubtotal) !== PLAN_PRICE_CENTS[plan]) {
      this.log.warn(`downgrade preview for ${user.id} refused: immediate ${JSON.stringify(preview.immediate_transaction ?? null)}, next subtotal ${nextSubtotal}`);
      throw new ApiException(409, "billing_busy", "Paddle would bill this change differently than expected, so it's not done. Write to hello@typeplay.app.");
    }
    return { direction, chargeNowUsd: 0, taxNowUsd: 0, creditsNow: 0, nextRenewalUsd, effectiveAt: (user.nextBilledAt ?? user.periodEndsAt ?? new Date()).toISOString(), subscriptionId };
  }

  /** POST /billing/plan-change: the PATCH; an upgrade's credits arrive with its transaction.completed, a downgrade waits as pendingPlan. */
  async applyPlanChange(user: User, plan: PaidPlan): Promise<PlanChangePreview> {
    const preview = await this.previewPlanChange(user, plan);
    const client = await this.paddle.require();
    let sub: PaddleSubscription;
    try {
      sub = await client.patch<PaddleSubscription>(`/subscriptions/${encodeURIComponent(preview.subscriptionId)}`, this.changeBody(plan, preview.direction === "up" ? "prorated_immediately" : "do_not_bill"));
    } catch (e) {
      this.paddleFailed(e, "plan change");
    }
    if (preview.direction === "down") await this.prisma.user.update({ where: { id: user.id }, data: { pendingPlan: plan } });
    await this.handlers.subscription(sub, changedAt(sub), { eventId: `sub:${sub.id}`, actor: `user:${user.id}` });
    await this.ledger.audit(this.prisma, { actor: `user:${user.id}`, userId: user.id, action: preview.direction === "up" ? "upgrade" : "downgrade_scheduled", details: { from: user.plan, to: plan, chargeNowUsd: preview.chargeNowUsd } });
    return { direction: preview.direction, chargeNowUsd: preview.chargeNowUsd, taxNowUsd: preview.taxNowUsd, creditsNow: preview.creditsNow, nextRenewalUsd: preview.nextRenewalUsd, effectiveAt: preview.effectiveAt };
  }

  /** DELETE /billing/plan-change (and `admin downgrade <email> cancel`): the items back to the current plan, nothing billed. */
  async undoPlanChange(user: User, actor = `user:${user.id}`): Promise<void> {
    if (!user.pendingPlan) throw badRequest("There is no plan change waiting.");
    if (actor.startsWith("user:")) this.assertAllowed(user);
    const subscriptionId = this.subscriptionFor(user);
    const client = await this.paddle.require();
    let sub: PaddleSubscription;
    try {
      sub = await client.patch<PaddleSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, this.changeBody(user.plan as PaidPlan, "do_not_bill"));
    } catch (e) {
      this.paddleFailed(e, "undo plan change");
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { pendingPlan: null } });
    await this.handlers.subscription(sub, changedAt(sub), { eventId: `sub:${sub.id}`, actor });
    await this.ledger.audit(this.prisma, { actor, userId: user.id, action: "downgrade_undone", details: { was: user.pendingPlan, plan: user.plan } });
  }

  // ---- Cancel, keep, portal ------------------------------------------------------------------

  /** POST /billing/cancel: at the period's end; the plan and its credits stay until then. */
  async cancel(user: User): Promise<{ cancelsAt: string | null }> {
    this.assertAllowed(user);
    if (user.cancelsAt) return { cancelsAt: user.cancelsAt.toISOString() };
    const subscriptionId = this.subscriptionFor(user);
    const client = await this.paddle.require();
    let sub: PaddleSubscription;
    try {
      sub = await client.post<PaddleSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { effective_from: "next_billing_period" });
    } catch (e) {
      this.paddleFailed(e, "cancel");
    }
    await this.handlers.subscription(sub, changedAt(sub), { eventId: `sub:${sub.id}`, actor: `user:${user.id}` });
    await this.ledger.audit(this.prisma, { actor: `user:${user.id}`, userId: user.id, action: "cancel_scheduled", details: { effectiveAt: sub.scheduled_change?.effective_at ?? null } });
    return { cancelsAt: (await this.fresh(user.id)).cancelsAt?.toISOString() ?? null };
  }

  /** DELETE /billing/cancel ("Keep my plan"): the scheduled cancel removed. */
  async keep(user: User): Promise<void> {
    this.assertAllowed(user);
    if (!user.cancelsAt) return;
    const subscriptionId = this.subscriptionFor(user);
    const client = await this.paddle.require();
    let sub: PaddleSubscription;
    try {
      sub = await client.patch<PaddleSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`, { scheduled_change: null });
    } catch (e) {
      this.paddleFailed(e, "keep");
    }
    await this.handlers.subscription(sub, changedAt(sub), { eventId: `sub:${sub.id}`, actor: `user:${user.id}` });
    await this.ledger.audit(this.prisma, { actor: `user:${user.id}`, userId: user.id, action: "cancel_undone", details: {} });
  }

  /** POST /billing/portal: fresh links each click (Paddle says they are temporary; never stored). */
  async portal(user: User): Promise<PortalLinks> {
    this.assertAllowed(user);
    const client = await this.paddle.require();
    try {
      const customerId = await this.ensureCustomer(user, client);
      const session = await client.post<PaddlePortalSession>(`/customers/${encodeURIComponent(customerId)}/portal-sessions`, { subscription_ids: user.paddleSubscriptionId ? [user.paddleSubscriptionId] : [] });
      const sub = session.urls.subscriptions.find((s) => s.id === user.paddleSubscriptionId) ?? session.urls.subscriptions[0];
      return { overview: session.urls.general.overview, cancel: sub?.cancel_subscription ?? null, updatePaymentMethod: sub?.update_subscription_payment_method ?? null };
    } catch (e) {
      this.paddleFailed(e, "portal");
    }
  }

  // ---- Refunds (admin) -----------------------------------------------------------------------

  /**
   * `admin refund <email> <txn|last> [reason]` (docs/payments-design.md §7): under the lock, within 14
   * days, nothing pending, the bucket open, no build going (409 billing_busy) → the quote ($0 is
   * refused) → the bucket frozen and a Refund row → POST /adjustments (outside the lock; a timeout
   * leaves the row in `lookup` for the 5-minute job, which never posts twice).
   */
  async requestRefund(userId: string, which: string, reason: string, actor: string): Promise<{ refund: Refund; payment: Payment; outcome: string }> {
    const prepared = await this.ledger.withUser(userId, async (tx, user) => {
      const payment =
        which === "last"
          ? await tx.payment.findFirst({ where: { userId }, orderBy: { paidAt: "desc" } })
          : await tx.payment.findFirst({ where: { id: which, userId } });
      if (!payment) throw new Error(which === "last" ? `${user.email} has no payments` : `no payment ${which} for ${user.email}`);
      if (payment.status === "refunded" || payment.status === "charged_back") throw new Error(`${payment.id} is already ${payment.status.replace("_", " ")}`);
      if (Date.now() > payment.refundableUntil.getTime()) throw new Error(`${payment.id} was paid on ${payment.paidAt.toISOString().slice(0, 10)}: the 14 days are over (until ${payment.refundableUntil.toISOString().slice(0, 10)})`);
      const pending = await tx.refund.findFirst({ where: { paymentId: payment.id, status: { in: ["requested", "pending", "lookup"] } } });
      if (pending) throw new Error(`a refund of ${payment.id} is already ${pending.status} (${pending.id})`);
      const bucket = await tx.creditBucket.findUnique({ where: { paymentId: payment.id } });
      if (!bucket || bucket.closedAt) throw new Error(`${payment.id}: its credits have ended already (nothing to refund)`);
      if (!payment.lineItemId) throw new Error(`${payment.id} has no line item id (run admin sync ${user.email} first)`);
      const running = await tx.message.count({ where: { status: "running", project: { ownerId: userId } } });
      if (running) throw new ApiException(409, "billing_busy", `${user.email} has a build going: wait for it to finish (its charge could land on the credits being refunded)`);
      const quoteCents = refundQuoteCents({ paidCents: payment.paidCents, grantedTenths: bucket.grantedTenths, remainingTenths: bucket.remainingTenths, refundedCents: payment.refundedCents });
      if (quoteCents <= 0) throw new Error(`${payment.id}: all ${bucket.grantedTenths / 10} credits are used, so the refund is $0 (refused)`);
      await tx.creditBucket.update({ where: { id: bucket.id }, data: { frozenAt: new Date() } });
      const refund = await tx.refund.create({ data: { userId, paymentId: payment.id, bucketId: bucket.id, quoteCents, quoteTenths: bucket.remainingTenths, status: "requested", reason } });
      await this.ledger.audit(tx, { actor, userId, action: "refund_requested", details: { refund: refund.id, payment: payment.id, quoteCents, credits: bucket.remainingTenths / 10, reason } });
      return { refund, payment };
    });
    const outcome = await this.postRefund(prepared.refund, prepared.payment, actor);
    return { ...prepared, refund: await this.prisma.refund.findUniqueOrThrow({ where: { id: prepared.refund.id } }), outcome };
  }

  /** POST /adjustments for a Refund row, and its answer applied through the adjustment handler. Returns what happened, in words. */
  private async postRefund(refund: Refund, payment: Payment, actor: string): Promise<string> {
    const client = await this.paddle.require().catch(async (e) => {
      await this.prisma.refund.update({ where: { id: refund.id }, data: { status: "lookup" } });
      throw e;
    });
    let adj: PaddleAdjustment;
    // Nothing used and nothing refunded before: the whole transaction goes back as a `full` adjustment
    // (no items, no amount: Paddle refunds every line with its tax); otherwise a `partial` one of the
    // unused share before tax, Paddle adding the tax's share.
    const whole = payment.refundedCents === 0 && refund.quoteCents >= payment.paidCents;
    const reason = refund.reason || "Refund of unused credits (within 14 days)";
    try {
      adj = await client.post<PaddleAdjustment>(
        "/adjustments",
        whole
          ? { action: "refund", type: "full", transaction_id: payment.id, reason }
          : { action: "refund", type: "partial", transaction_id: payment.id, tax_mode: "external", reason, items: [{ item_id: payment.lineItemId, type: "partial", amount: String(refund.quoteCents) }] },
      );
    } catch (e) {
      if (e instanceof PaddleUnreachable) {
        // Paddle may have taken it: never post again before GET /adjustments?transaction_id= says it didn't.
        await this.prisma.refund.update({ where: { id: refund.id }, data: { status: "lookup" } });
        this.log.warn(`refund ${refund.id}: Paddle did not answer the POST; the 5-minute lookup job will find or repeat it`);
        return `Paddle did not answer: the refund is in "lookup" (the job checks every 5 minutes before posting again)`;
      }
      if (e instanceof PaddleError && /pending|already/i.test(e.code + e.message)) {
        await this.prisma.refund.update({ where: { id: refund.id }, data: { status: "lookup" } });
        return `Paddle says a refund is pending already (${e.code}): in "lookup" for the job to link`;
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.refund.update({ where: { id: refund.id }, data: { status: "rejected", resolvedAt: new Date(), reason: `${refund.reason ?? ""} [Paddle refused: ${(e as Error).message}]`.trim() } });
        await tx.creditBucket.updateMany({ where: { id: refund.bucketId, closedAt: null }, data: { frozenAt: null } });
        await this.ledger.audit(tx, { actor, userId: refund.userId, action: "refund_refused", details: { refund: refund.id, error: (e as Error).message } });
      });
      throw e;
    }
    const result = await this.applyAdjustment(refund, adj, actor);
    return `${adj.id} ${adj.status}: ${result.note}`;
  }

  /**
   * Paddle's adjustment through the same handler as its webhook (the Adjustment row is written there,
   * and our Refund row linked to it: it can't be linked before the row exists), then linked again in
   * case the handler had nothing to do.
   */
  private async applyAdjustment(refund: Refund, adj: PaddleAdjustment, actor: string) {
    const result = await this.handlers.adjustment(adj, new Date(adj.updated_at ?? adj.created_at ?? Date.now()), { eventId: `adj:${adj.id}`, actor });
    await this.prisma.refund.updateMany({ where: { id: refund.id, adjustmentId: null, status: { in: ["requested", "lookup"] } }, data: { status: "pending", adjustmentId: adj.id } });
    const cancels = await this.adjustmentCancels(refund.userId, actor);
    return cancels.length ? { ...result, note: `${result.note}; ${cancels.join("; ")}` } : result;
  }

  /** The 5-minute job: every Refund in `lookup` is looked for at Paddle; found → linked and applied, missing → posted (once more). */
  async refundLookups(actor = "job:refund-lookup"): Promise<number> {
    const waiting = await this.prisma.refund.findMany({ where: { status: "lookup" }, include: { payment: true } });
    let n = 0;
    for (const refund of waiting) {
      const client = await this.paddle.require().catch(() => null);
      if (!client) break;
      let found: PaddleAdjustment[];
      try {
        found = await client.listAll<PaddleAdjustment>("/adjustments", { transaction_id: refund.paymentId, action: "refund" });
      } catch (e) {
        this.log.warn(`refund lookup ${refund.id}: ${(e as Error).message}`);
        continue;
      }
      const since = refund.createdAt.getTime() - 60_000;
      const ours = found.find((a) => a.status !== "rejected" && (!a.created_at || Date.parse(a.created_at) >= since));
      if (ours) {
        await this.applyAdjustment(refund, ours, actor);
        this.log.log(`refund ${refund.id}: found ${ours.id} (${ours.status}) at Paddle`);
      } else {
        this.log.log(`refund ${refund.id}: nothing at Paddle, posting it again`);
        await this.postRefund(refund, refund.payment, actor).catch((e) => this.log.warn(`refund ${refund.id}: ${(e as Error).message}`));
      }
      n++;
    }
    return n;
  }

  /**
   * The subscriptions approved refunds and chargebacks cancel (the adjustment handler marks them under the user's lock;
   * Paddle is called here, outside it): right after our own refund's answer, after `admin sync`, and every 5 minutes
   * until Paddle takes each one. One our rows show done already (cancelled, or a cancel scheduled for an end-of-period
   * mark: a chargeback warning and its chargeback mark twice), or one Paddle says is cancelled, counts as done. Returns
   * what happened, in words.
   */
  async adjustmentCancels(userId?: string, actor = "job:adjustment-cancel"): Promise<string[]> {
    const due = await this.prisma.adjustment.findMany({ where: { cancelSubscription: { not: null }, canceledAt: null, ...(userId ? { userId } : {}) }, orderBy: { occurredAt: "asc" } });
    if (!due.length) return [];
    const client = await this.paddle.require().catch(() => null);
    if (!client) return [`Paddle is not answering: the subscription is cancelled by the 5-minute job`];
    const out: string[] = [];
    for (const adj of due) {
      const subscriptionId = adj.cancelSubscriptionId!;
      const when = adj.cancelSubscription === "immediately" ? "immediately" : "next_billing_period";
      const owner = adj.userId ? await this.prisma.user.findUnique({ where: { id: adj.userId } }) : null;
      const doneHere = !owner || owner.paddleSubscriptionId !== subscriptionId || owner.subscriptionStatus === "canceled" || (when === "next_billing_period" && !!owner.cancelsAt);
      let said: string;
      if (doneHere) {
        said = `subscription ${subscriptionId} needs no cancel any more (${adj.action} ${adj.id})`;
      } else {
        try {
          const sub = await client.post<PaddleSubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { effective_from: when });
          await this.handlers.subscription(sub, changedAt(sub), { eventId: `sub:${sub.id}`, actor });
          said = `subscription ${subscriptionId} cancelled at Paddle ${when === "immediately" ? "now" : "at the period's end"} (${adj.action} ${adj.id})`;
        } catch (e) {
          if (!(e instanceof PaddleError && (e.status === 404 || e.code === "subscription_already_canceled"))) {
            this.log.warn(`${adj.action} ${adj.id}: cancelling ${subscriptionId} at Paddle failed (${(e as Error).message}); tried again in 5 minutes`);
            out.push(`cancelling subscription ${subscriptionId} failed (${(e as Error).message}): the 5-minute job tries again`);
            continue;
          }
          said = `subscription ${subscriptionId} was cancelled at Paddle already (${adj.action} ${adj.id})`;
        }
      }
      await this.prisma.adjustment.update({ where: { id: adj.id }, data: { canceledAt: new Date() } });
      if (adj.userId) await this.ledger.audit(this.prisma, { actor, userId: adj.userId, action: "adjustment_cancel", details: { adjustment: adj.id, action: adj.action, subscription: subscriptionId, effectiveFrom: when, called: !doneHere } });
      this.log.log(said);
      out.push(said);
    }
    return out;
  }

  // ---- admin sync, account close --------------------------------------------------------------

  /** `admin sync <email>`: Paddle's subscription, completed transactions and adjustments for the user, applied as if webhooks. */
  async sync(userId: string, actor: string): Promise<{ subscription: string | null; transactions: string[]; adjustments: string[] }> {
    const user = await this.fresh(userId);
    const client = await this.paddle.require();
    const ctx = (eventId: string): Ctx => ({ eventId, actor });
    const out = { subscription: null as string | null, transactions: [] as string[], adjustments: [] as string[] };
    if (user.paddleSubscriptionId) {
      const sub = await client.get<PaddleSubscription>(`/subscriptions/${encodeURIComponent(user.paddleSubscriptionId)}`);
      const r = await this.handlers.subscription(sub, changedAt(sub), ctx(`sub:${sub.id}`));
      out.subscription = `${sub.id} ${sub.status}: ${r.status} (${r.note})`;
    }
    const customerId = user.paddleCustomerId;
    if (customerId) {
      const txns = await client.listAll<PaddleTransaction>("/transactions", { customer_id: customerId, status: "completed", order_by: "billed_at[ASC]" }, 200);
      for (const t of txns) {
        const r = await this.handlers.transactionCompleted(t, new Date(t.updated_at ?? t.billed_at ?? Date.now()), ctx(`txn:${t.id}`));
        out.transactions.push(`${t.id} ${t.origin}: ${r.status} (${r.note})`);
      }
      const adjs = await client.listAll<PaddleAdjustment>("/adjustments", { customer_id: customerId }, 200);
      for (const a of adjs) {
        const r = await this.handlers.adjustment(a, new Date(a.updated_at ?? a.created_at ?? Date.now()), ctx(`adj:${a.id}`));
        out.adjustments.push(`${a.id} ${a.action} ${a.status}: ${r.status} (${r.note})`);
      }
      out.adjustments.push(...(await this.adjustmentCancels(userId, actor)));
    }
    await this.ledger.audit(this.prisma, { actor, userId, action: "sync", details: { transactions: out.transactions.length, adjustments: out.adjustments.length, subscription: !!out.subscription } });
    return out;
  }

  /**
   * Before DELETE /me: a live subscription is cancelled at Paddle at once, or the close is refused
   * ("Try again in an hour": Paddle's 30-minute lock before a renewal, or Paddle not answering).
   */
  async cancelForClose(user: User): Promise<void> {
    if (!hasSubscription(user)) return;
    const unreachable = () => new ApiException(503, "billing_off", "Your plan is still active and Paddle couldn't be reached to cancel it, so the account stays open. Try again in an hour.");
    if (this.paddle.mode === "off") throw unreachable();
    const client = await this.paddle.require().catch(() => {
      throw unreachable();
    });
    let sub: PaddleSubscription;
    try {
      sub = await client.post<PaddleSubscription>(`/subscriptions/${encodeURIComponent(user.paddleSubscriptionId!)}/cancel`, { effective_from: "immediately" });
    } catch (e) {
      if (e instanceof PaddleUnreachable) throw unreachable();
      // Only Paddle's own words for "there is nothing to cancel" let the close go on; any other refusal
      // (the renewal lock, a code we don't know) keeps the account, or the subscription would keep billing with nobody behind it.
      if (e instanceof PaddleError && (e.status === 404 || e.code === "subscription_already_canceled")) {
        this.log.warn(`close ${user.id}: Paddle says ${e.code} for ${user.paddleSubscriptionId}: treated as already cancelled`);
        return;
      }
      this.log.warn(`close ${user.id}: cancel refused: ${(e as Error).message}`);
      throw new ApiException(409, "billing_busy", "Your plan renews within the hour, so it can't be cancelled right now. Try again in an hour.");
    }
    await this.handlers.subscription(sub, changedAt(sub), { eventId: `sub:${sub.id}`, actor: `user:${user.id}` });
    await this.ledger.audit(this.prisma, { actor: `user:${user.id}`, userId: user.id, action: "cancel_for_close", details: { subscription: sub.id, status: sub.status } });
  }
}
