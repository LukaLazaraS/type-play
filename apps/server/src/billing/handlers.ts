// What a Paddle event does to our rows (docs/payments-design.md §6 table, §7). Each handler is a
// function of (payload, occurred_at): the webhook inbox, the verify pull after a checkout, `admin sync`
// and `admin retry` all call the same code, and every write is idempotent by its natural key (the
// Payment's txn_, one reversal per adj_, User.subscriptionUpdatedAt), so a replay is a no-op.
// Rule 1: the plan and the credits move only on `transaction.completed` (money); subscription events
// set status fields and dates. Rule 7: an unknown user, price or currency is parked, never guessed.
import { Inject, Injectable, Logger } from "@nestjs/common";
import { PACK_MONTHS, PLAN_CREDITS, PLAN_NAME, toTenths } from "../credits/credits.js";
import { addMonths, creditsForLines, creditsToRemove, expireNote, monthLater, refundQuoteCents, type LineItem } from "../credits/ledger-math.js";
import { LedgerService } from "../credits/ledger.service.js";
import type { Payment, PaymentKind, Prisma, PrismaClient, SubStatus, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { cents, paymentMethodName } from "./paddle.client.js";
import { PaddleService, type PaidPlan } from "./paddle.service.js";
import type { PaddleAdjustment, PaddleSubscription, PaddleTransaction } from "./paddle.types.js";

/** The 11 event types the destination subscribes to (docs/payments-design.md §6). Anything else is `ignored`. */
export const SUBSCRIBED_EVENTS = new Set([
  "transaction.completed",
  "transaction.payment_failed",
  "subscription.created",
  "subscription.updated",
  "subscription.activated",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.canceled",
  "adjustment.created",
  "adjustment.updated",
]);

export interface HandlerResult {
  /** processed: applied (or already applied); ignored: nothing for us; parked: a person has to look (unknown user, price, currency). */
  status: "processed" | "ignored" | "parked";
  note: string;
  userId?: string | null;
}

/** Who is applying it: "webhook:evt_…", "pull:txn_…", "admin:<name>"; `eventId` goes on the Payment row. */
export interface Ctx {
  eventId: string;
  actor: string;
}

/** Who an event is about, or the result to record when nobody (ignored: a closed account; parked: unknown). */
type Who = { ok: true; userId: string } | { ok: false; result: HandlerResult };

const processed = (note: string, userId?: string | null): HandlerResult => ({ status: "processed", note, userId });
const ignored = (note: string, userId?: string | null): HandlerResult => ({ status: "ignored", note, userId });
const parked = (note: string, userId?: string | null): HandlerResult => ({ status: "parked", note, userId });

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const date = (v: unknown): Date | null => {
  const d = typeof v === "string" ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};
/** A new flag never hides a chargeback hold (only `admin flag clear` lifts that). */
const flagFor = (user: { billingFlag: string | null }, flag: string) => (user.billingFlag === "chargeback" ? "chargeback" : flag);
const SUB_STATUS: Record<string, SubStatus> = { active: "active", trialing: "active", past_due: "past_due", canceled: "canceled", paused: "paused" };

/** The transaction's lines as the ledger reads them (details.line_items; items[] when a payload lacks them). */
export function linesOf(t: PaddleTransaction): LineItem[] {
  const lines = t.details?.line_items;
  if (lines?.length) {
    return lines.map((l) => ({
      priceId: l.price_id,
      quantity: l.quantity,
      rate: l.proration?.rate == null ? null : Number(l.proration.rate),
      subtotalCents: l.totals?.subtotal == null ? 0 : cents(l.totals.subtotal),
    }));
  }
  return (t.items ?? []).filter((i) => i.price?.id).map((i) => ({ priceId: i.price!.id, quantity: i.quantity, rate: null, subtotalCents: 0 }));
}

/** After discount, before tax; tax; total: from details.totals (the lines added up when it is missing). */
export function totalsOf(t: PaddleTransaction): { paidCents: number; taxCents: number; totalCents: number } {
  const tot = t.details?.totals;
  if (tot) {
    const total = cents(tot.total);
    const tax = cents(tot.tax);
    return { paidCents: Math.max(0, total - tax), taxCents: tax, totalCents: total };
  }
  let total = 0;
  let tax = 0;
  for (const l of t.details?.line_items ?? []) {
    if (!l.totals) continue;
    total += cents(l.totals.total);
    tax += cents(l.totals.tax);
  }
  return { paidCents: Math.max(0, total - tax), taxCents: tax, totalCents: total };
}

@Injectable()
export class BillingHandlers {
  private readonly log = new Logger("billing");

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaClient,
    private readonly ledger: LedgerService,
    private readonly paddle: PaddleService,
  ) {}

  /** One event's `data` by type. Unknown types are ignored; a thrown error means "try again later" (the inbox retries). */
  apply(type: string, data: unknown, occurredAt: Date, ctx: Ctx): Promise<HandlerResult> {
    if (!data || typeof data !== "object") return Promise.resolve(ignored("no data"));
    switch (type) {
      case "transaction.completed":
        return this.transactionCompleted(data as PaddleTransaction, occurredAt, ctx);
      case "transaction.payment_failed":
        return this.paymentFailed(data as PaddleTransaction, occurredAt, ctx);
      case "subscription.created":
      case "subscription.updated":
      case "subscription.activated":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.canceled":
        return this.subscription(data as PaddleSubscription, occurredAt, ctx);
      case "adjustment.created":
      case "adjustment.updated":
        return this.adjustment(data as PaddleAdjustment, occurredAt, ctx);
      default:
        return Promise.resolve(ignored(`${type} is not handled`));
    }
  }

  // ---- Who ------------------------------------------------------------------------------------

  /**
   * The user an event is about: custom_data.userId (our checkouts put it there, and Paddle copies it
   * to the subscription and every later transaction), then the Paddle customer, then the subscription,
   * then the payment. A closed account's id (its tombstone) means "ignored"; nobody means "parked".
   */
  async resolveUser(p: { customData?: Record<string, unknown> | null; customerId?: string | null; subscriptionId?: string | null; transactionId?: string | null }): Promise<Who> {
    const found = (userId: string): Who => ({ ok: true, userId });
    const not = (result: HandlerResult): Who => ({ ok: false, result });
    const uid = str(p.customData?.userId);
    if (uid) {
      if (await this.prisma.user.findUnique({ where: { id: uid }, select: { id: true } })) return found(uid);
      if (await this.prisma.closedAccount.findUnique({ where: { id: uid }, select: { id: true } })) return not(ignored(`user ${uid} closed their account`));
    }
    if (p.customerId) {
      const u = await this.prisma.user.findUnique({ where: { paddleCustomerId: p.customerId }, select: { id: true } });
      if (u) return found(u.id);
    }
    if (p.subscriptionId) {
      const u = await this.prisma.user.findUnique({ where: { paddleSubscriptionId: p.subscriptionId }, select: { id: true } });
      if (u) return found(u.id);
    }
    if (p.transactionId) {
      const pay = await this.prisma.payment.findUnique({ where: { id: p.transactionId }, select: { userId: true } });
      if (pay?.userId) return found(pay.userId);
      if (pay) return not(ignored(`payment ${p.transactionId} belongs to a closed account`));
    }
    return not(parked(`unknown user (custom_data.userId ${uid ?? "-"}, customer ${p.customerId ?? "-"}, subscription ${p.subscriptionId ?? "-"})`));
  }

  // ---- transaction.completed ----------------------------------------------------------------

  /**
   * Money arrived: one Payment per txn_, credits by the transaction's origin (a new plan, a renewal with
   * the carry-over cap first, an upgrade's prorated share, a pack), the plan from the price paid.
   */
  async transactionCompleted(t: PaddleTransaction, occurredAt: Date, ctx: Ctx): Promise<HandlerResult> {
    if (t.status !== "completed") return ignored(`transaction ${t.id} is ${t.status}, not completed`);
    if (t.origin === "subscription_payment_method_change") return processed("a payment method change: nothing to grant");
    if ((t.currency_code ?? "").toUpperCase() !== "USD") return parked(`currency ${t.currency_code ?? "?"} (only USD)`);
    const lines = linesOf(t);
    const credits = creditsForLines(lines, this.paddle.tenthsOfPrice);
    if (credits.parked) return parked(credits.parked);
    // A checkout (origin web or api) counts only when it is one we opened: the CheckoutSession for this
    // transaction names the buyer. Anyone can open a Paddle checkout from a browser with another user's
    // email or id in it (the client token is public by design), so without our session nothing is
    // granted and a person decides (rule 7). Paddle's own transactions (renewals, upgrades, charges)
    // name the user by custom_data (copied from the checkout we opened) and by the subscription.
    const checkout = t.origin === "web" || t.origin === "api";
    const session = checkout ? await this.prisma.checkoutSession.findUnique({ where: { id: t.id } }) : null;
    let who: Who;
    if (checkout) {
      const uid = str(t.custom_data?.userId);
      if (!session) {
        return parked(`a checkout we did not open: no CheckoutSession for ${t.id} (custom_data.userId ${uid ?? "-"}, customer ${t.customer_id ?? "-"}); nothing granted. Real money: grant by hand (admin grant) or refund it at Paddle`);
      }
      if (uid && uid !== session.userId) return parked(`checkout ${t.id} was opened for ${session.userId} but names ${uid} in custom_data; nothing granted`, session.userId);
      who = (await this.prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } })) ? { ok: true, userId: session.userId } : { ok: false, result: ignored(`user ${session.userId} closed their account`) };
    } else {
      who = await this.resolveUser({ customData: t.custom_data, customerId: t.customer_id, subscriptionId: t.subscription_id });
    }
    if (!who.ok) return who.result;
    const userId = who.userId;
    return this.ledger.withUser(userId, async (tx, user): Promise<HandlerResult> => {
      if (await tx.payment.findUnique({ where: { id: t.id }, select: { id: true } })) return processed(`payment ${t.id} already recorded`, userId);
      const main = lines.find((l) => l.subtotalCents >= 0 && l.quantity > 0) ?? lines[0];
      const price = this.paddle.priceOf(main.priceId)!;
      const kind: PaymentKind =
        t.origin === "subscription_recurring" ? "renewal" : t.origin === "subscription_update" ? "upgrade" : t.origin === "subscription_charge" ? "pack" : price.kind === "pack" ? "pack" : "plan";
      if (kind === "pack" ? price.kind !== "pack" : price.kind !== "plan") return parked(`${t.origin} transaction on a ${price.kind} price`, userId);
      // Money on a subscription that is not the user's is never applied: it would take over the plan,
      // its dates and every later event (a second subscription made from a hand-made checkout with this
      // user's email). A new checkout of ours may bring a new subscription only while the user has no
      // live one. Otherwise: flagged when the user's own is live, parked for a person either way.
      const live = user.subscriptionStatus === "active" || user.subscriptionStatus === "past_due" || user.subscriptionStatus === "paused";
      if (t.subscription_id && user.paddleSubscriptionId !== t.subscription_id && !(checkout && !(user.paddleSubscriptionId && live))) {
        const why = `${t.origin} transaction ${t.id} is on subscription ${t.subscription_id}, not the user's (${user.paddleSubscriptionId ?? "none"}${user.subscriptionStatus ? ` ${user.subscriptionStatus}` : ""})`;
        if (live) await tx.user.update({ where: { id: userId }, data: { billingFlag: flagFor(user, "two_subscriptions") } });
        await this.ledger.audit(tx, { actor: ctx.actor, userId, action: "two_subscriptions", details: { current: user.paddleSubscriptionId, other: t.subscription_id, transaction: t.id, flagged: live } });
        this.log.warn(`payment ${t.id} for ${userId}: ${why}: parked`);
        return parked(`${why}; nothing granted${live ? " (flag two_subscriptions)" : ""}`, userId);
      }
      const now = new Date();
      // The grant row is written a millisecond after what the cap expired, so the history keeps that order.
      const grantAt = new Date(now.getTime() + 1);
      const paidAt = date(t.billed_at) ?? occurredAt;
      const periodStart = date(t.billing_period?.starts_at);
      const sameSub = !!t.subscription_id && user.paddleSubscriptionId === t.subscription_id;
      const periodEnd = date(t.billing_period?.ends_at) ?? (sameSub ? user.periodEndsAt : null) ?? monthLater(paidAt);
      const totals = totalsOf(t);
      if (session) await tx.checkoutSession.update({ where: { id: t.id }, data: { status: "completed" } });
      const payment = await tx.payment.create({
        data: {
          id: t.id,
          userId,
          kind,
          origin: t.origin,
          priceId: main.priceId,
          lineItemId: t.details?.line_items?.find((l) => l.price_id === main.priceId)?.id ?? null,
          paidCents: totals.paidCents,
          taxCents: totals.taxCents,
          totalCents: totals.totalCents,
          currency: "USD",
          invoiceNumber: str(t.invoice_number),
          periodStart,
          periodEnd: date(t.billing_period?.ends_at),
          paidAt,
          refundableUntil: new Date(paidAt.getTime() + 14 * 86_400_000),
          consentVersion: session?.consentVersion ?? str(t.custom_data?.consentVersion),
          consentAt: session?.consentAt ?? date(t.custom_data?.consentAt),
          termsAcceptedAt: session?.termsAcceptedAt ?? date(t.custom_data?.consentAt),
          eventId: ctx.eventId,
          raw: t as unknown as Prisma.InputJsonObject,
        },
      });
      const paymentMethod = paymentMethodName(t.payments?.find((p) => p.method_details)?.method_details) ?? user.paymentMethod;
      const userData: Prisma.UserUpdateInput = { paymentMethod, paddleCustomerId: user.paddleCustomerId ?? t.customer_id ?? undefined };
      const anomalies: string[] = [];
      let note = "";
      if (kind === "plan" || kind === "renewal" || kind === "upgrade") {
        const plan = (price as { plan: PaidPlan }).plan;
        if (kind === "renewal") {
          // The carry-over cap, then the previous period's credits end a month after it did, then the new month.
          await this.ledger.capCarryOverIn(tx, userId, toTenths(PLAN_CREDITS[plan]), now);
          if (periodStart) {
            const older = await tx.creditBucket.findMany({ where: { userId, closedAt: null, source: { in: ["plan", "upgrade"] }, startsAt: { lt: periodStart } } });
            const carriedUntil = monthLater(periodStart);
            for (const b of older) if (!b.expiresAt || b.expiresAt.getTime() > carriedUntil.getTime()) await tx.creditBucket.update({ where: { id: b.id }, data: { expiresAt: carriedUntil } });
          }
          note = `Renewal: ${PLAN_NAME[plan]}`;
          await this.ledger.grantIn(tx, userId, { source: "plan", tenths: credits.tenths, expiresAt: monthLater(periodEnd), note, paymentId: payment.id, startsAt: paidAt }, grantAt, { settled: true });
          Object.assign(userData, { plan, pendingPlan: null, subscriptionStatus: "active", periodEndsAt: periodEnd, lastPaymentFailedAt: null, paddleSubscriptionId: t.subscription_id ?? undefined });
        } else if (kind === "upgrade") {
          const current = await tx.creditBucket.findFirst({ where: { userId, closedAt: null, source: "plan" }, orderBy: { startsAt: "desc" } });
          note = `Upgrade to ${PLAN_NAME[plan]}`;
          await this.ledger.grantIn(
            tx,
            userId,
            { source: "upgrade", tenths: credits.tenths, expiresAt: current?.expiresAt ?? monthLater(user.periodEndsAt ?? paidAt), note, paymentId: payment.id, startsAt: paidAt },
            grantAt,
            { settled: true },
          );
          Object.assign(userData, { plan, subscriptionStatus: "active", lastPaymentFailedAt: null });
        } else {
          note = `${PLAN_NAME[plan]} plan`;
          await this.ledger.grantIn(tx, userId, { source: "plan", tenths: credits.tenths, expiresAt: monthLater(periodEnd), note, paymentId: payment.id, startsAt: paidAt }, grantAt, { settled: true });
          Object.assign(userData, { plan, pendingPlan: null, cancelsAt: null, subscriptionStatus: "active", periodEndsAt: periodEnd, lastPaymentFailedAt: null, paddleSubscriptionId: t.subscription_id ?? undefined });
        }
      } else {
        if (user.plan === "free") anomalies.push("a pack bought on the Free plan (granted all the same)");
        note = "Credit pack";
        await this.ledger.grantIn(tx, userId, { source: "pack", tenths: credits.tenths, expiresAt: addMonths(paidAt, PACK_MONTHS), note, paymentId: payment.id, startsAt: paidAt }, grantAt, { settled: true });
      }
      const fresh = await tx.user.update({ where: { id: userId }, data: userData });
      await this.ledger.settleIn(tx, fresh, now); // nextSettleAt follows the new and corrected expiry dates
      await this.ledger.audit(tx, {
        actor: ctx.actor,
        userId,
        action: "payment",
        details: { transaction: t.id, kind, origin: t.origin, credits: credits.tenths / 10, paidCents: totals.paidCents, plan: fresh.plan, anomalies },
      });
      if (anomalies.length) this.log.warn(`payment ${t.id} for ${userId}: ${anomalies.join("; ")}`);
      return processed(`${note}: ${credits.tenths / 10} credits for $${(totals.paidCents / 100).toFixed(2)}${anomalies.length ? ` (${anomalies.join("; ")})` : ""}`, userId);
    });
  }

  // ---- transaction.payment_failed -----------------------------------------------------------

  /** The banner's date only: User.lastPaymentFailedAt = the newest failure. Paddle retries; the plan stays until it lapses (settle). */
  async paymentFailed(t: PaddleTransaction, occurredAt: Date, ctx: Ctx): Promise<HandlerResult> {
    const who = await this.resolveUser({ customData: t.custom_data, customerId: t.customer_id, subscriptionId: t.subscription_id });
    if (!who.ok) return who.result;
    const { userId } = who;
    return this.ledger.withUser(userId, async (tx, user) => {
      if (user.lastPaymentFailedAt && user.lastPaymentFailedAt.getTime() >= occurredAt.getTime()) return processed("an older failure than the one recorded", userId);
      await tx.user.update({ where: { id: userId }, data: { lastPaymentFailedAt: occurredAt } });
      const codes = (t.payments ?? []).map((p) => (p as { error_code?: string }).error_code).filter(Boolean);
      await this.ledger.audit(tx, { actor: ctx.actor, userId, action: "payment_failed", details: { transaction: t.id, origin: t.origin, errors: codes } });
      return processed(`payment failed (${codes.join(", ") || "no error code"})`, userId);
    });
  }

  // ---- subscription.* -----------------------------------------------------------------------

  /**
   * Every subscription event carries the whole entity, so one function applies them all: ids, status,
   * dates, a scheduled cancel. Older than the last applied → skipped. Canceled or paused → the plan
   * ends (plan and upgrade credits end, packs stay, the Free cycle starts). The plan is never set from
   * `items`: that happens when the money for it arrives.
   */
  async subscription(s: PaddleSubscription, occurredAt: Date, ctx: Ctx): Promise<HandlerResult> {
    const who = await this.resolveUser({ customData: s.custom_data, customerId: s.customer_id, subscriptionId: s.id });
    if (!who.ok) return who.result;
    const { userId } = who;
    return this.ledger.withUser(userId, async (tx, user): Promise<HandlerResult> => {
      if (user.subscriptionUpdatedAt && occurredAt.getTime() <= user.subscriptionUpdatedAt.getTime()) return processed("older than the last subscription event applied", userId);
      const status = SUB_STATUS[s.status];
      if (!status) return ignored(`subscription status ${s.status}`, userId);
      if (user.paddleSubscriptionId !== s.id) {
        if (user.paddleSubscriptionId && (user.subscriptionStatus === "active" || user.subscriptionStatus === "past_due" || user.subscriptionStatus === "paused")) {
          // Not the subscription the user is on: never replaces it. A second active one is flagged for the admin (rule 7).
          if (status === "active") {
            await tx.user.update({ where: { id: userId }, data: { billingFlag: flagFor(user, "two_subscriptions") } });
            await this.ledger.audit(tx, { actor: ctx.actor, userId, action: "two_subscriptions", details: { current: user.paddleSubscriptionId, other: s.id } });
          }
          return ignored(`subscription ${s.id} is not the user's (${user.paddleSubscriptionId})`, userId);
        }
        // A subscription we have not seen the money for is attached only when it comes from a checkout
        // we opened (subscription.created names its first transaction) or a payment recorded on it;
        // anything else (a stranger's subscription with this user's email in it) changes nothing. The
        // events that follow the money (transaction.completed, subscription.updated) attach it in time.
        const ours =
          (s.transaction_id ? await tx.checkoutSession.findFirst({ where: { id: s.transaction_id, userId }, select: { id: true } }) : null) ??
          (await tx.payment.findFirst({ where: { userId, raw: { path: ["subscription_id"], equals: s.id } }, select: { id: true } }));
        if (!ours) return ignored(`subscription ${s.id} is not from a checkout we opened (transaction ${s.transaction_id ?? "-"}); nothing changed`, userId);
      }
      const period = s.current_billing_period ?? null;
      const periodEndsAt =
        // Past due: the paid period's end stays, so the lapse comes a day after it, whatever Paddle shows
        // for the unpaid period (to confirm in the sandbox: whether current_billing_period advances on past_due).
        status === "past_due" && user.periodEndsAt ? user.periodEndsAt : date(period?.ends_at);
      const data: Prisma.UserUpdateInput = {
        paddleCustomerId: user.paddleCustomerId ?? s.customer_id,
        paddleSubscriptionId: s.id,
        subscriptionStatus: status,
        subscriptionUpdatedAt: occurredAt,
        nextBilledAt: date(s.next_billed_at),
        periodEndsAt,
        cancelsAt: s.scheduled_change?.action === "cancel" ? date(s.scheduled_change.effective_at) : null,
      };
      let note = `subscription ${status}`;
      let fresh = await tx.user.update({ where: { id: userId }, data });
      if ((status === "canceled" || status === "paused") && user.plan !== "free") {
        const ended = await this.endPlanIn(tx, fresh, status, ctx, { subscription: s.id });
        fresh = ended.user;
        note = `${status}: ${user.plan} ended, ${ended.creditsEnded} plan credits ended, now Free`;
      }
      // The current period's plan credits end a month after the period (the carried month): corrected
      // here because the first transaction carries no billing_period, only the subscription does.
      if (period && status === "active") {
        const start = date(period.starts_at);
        const end = date(period.ends_at);
        if (start && end) {
          const until = monthLater(end);
          const current = await tx.creditBucket.findMany({ where: { userId, closedAt: null, source: { in: ["plan", "upgrade"] }, startsAt: { gte: new Date(start.getTime() - 3_600_000), lte: end } } });
          for (const b of current) if (!b.expiresAt || b.expiresAt.getTime() !== until.getTime()) await tx.creditBucket.update({ where: { id: b.id }, data: { expiresAt: until } });
        }
      }
      await this.ledger.settleIn(tx, fresh, new Date());
      await this.ledger.audit(tx, {
        actor: ctx.actor,
        userId,
        action: "subscription",
        details: { subscription: s.id, status, periodEndsAt: periodEndsAt?.toISOString() ?? null, cancelsAt: data.cancelsAt instanceof Date ? data.cancelsAt.toISOString() : null },
      });
      return processed(note, userId);
    });
  }

  /**
   * The plan ends now (a cancel, a pause, or the month's payment given back in full): plan and upgrade
   * credits end ("when your plan ends, its monthly credits end with it"), packs stay, the Free cycle
   * starts, a pending downgrade is dropped. Under the user's lock; returns the fresh row.
   */
  private async endPlanIn(tx: Prisma.TransactionClient, user: User, why: string, ctx: Ctx, details: Record<string, unknown>): Promise<{ user: User; creditsEnded: number }> {
    const planBuckets = await tx.creditBucket.findMany({ where: { userId: user.id, closedAt: null, source: { in: ["plan", "upgrade"] } } });
    let ended = 0;
    for (const b of planBuckets) {
      ended += b.remainingTenths;
      await this.ledger.expireIn(tx, b, b.remainingTenths, expireNote(b.source, b.startsAt), "canceled", new Date());
    }
    let fresh = await tx.user.update({ where: { id: user.id }, data: { plan: "free", pendingPlan: null } });
    fresh = await this.ledger.startFreeCycleIn(tx, fresh, new Date());
    await this.ledger.audit(tx, { actor: ctx.actor, userId: user.id, action: "plan_ended", details: { from: user.plan, why, creditsEnded: ended / 10, ...details } });
    return { user: fresh, creditsEnded: ended / 10 };
  }

  /**
   * What a refund or a chargeback of this payment does to the user's subscription at Paddle, marked on the adjustment
   * for BillingService.adjustmentCancels, which calls Paddle after this lock. A refund means they don't want the plan
   * any more (Luka, 2026-10-25): a payment on the subscription cancels it; a pack's cancels nothing. A chargeback, on
   * any payment, cancels it too (Luka, 2026-10-26): no second charge, no second dispute. Right away when the payment
   * paid for the current period (the newest plan or renewal payment, on that subscription: nothing paid for the period
   * is left); otherwise at the period's end, so the month paid for stays (a cancel already scheduled is enough).
   */
  private async markCancel(tx: Prisma.TransactionClient, a: PaddleAdjustment, pay: Payment, user: User, newestPlanPayment: string | null, chargeback: boolean) {
    const none = { when: null, note: "" };
    if (!user.paddleSubscriptionId || (user.subscriptionStatus !== "active" && user.subscriptionStatus !== "past_due")) return none;
    const onIt = str((pay.raw as { subscription_id?: unknown } | null)?.subscription_id) === user.paddleSubscriptionId;
    if (!chargeback && (pay.kind === "pack" || !onIt)) return none;
    const when = onIt && newestPlanPayment === pay.id ? "immediately" : user.cancelsAt ? null : "next_billing_period";
    if (!when) return none;
    await tx.adjustment.update({ where: { id: a.id }, data: { cancelSubscription: when, cancelSubscriptionId: user.paddleSubscriptionId } });
    return { when, note: `, subscription ${user.paddleSubscriptionId} to be cancelled at Paddle ${when === "immediately" ? "now" : "at the period's end"}` };
  }

  // ---- adjustment.* -------------------------------------------------------------------------

  /**
   * A refund, a chargeback or a credit on a payment. The row is upserted by the newest occurred_at
   * (created and updated arrive in either order); the effect runs once per status: an approved refund
   * reverses the credits and finishes our Refund row (or flags one Paddle made itself for review), a
   * rejected one unfreezes the bucket, a chargeback removes the payment's remaining credits and holds
   * the account (403 billing_hold) until an admin clears it.
   */
  async adjustment(a: PaddleAdjustment, occurredAt: Date, ctx: Ctx): Promise<HandlerResult> {
    const payment = await this.prisma.payment.findUnique({ where: { id: a.transaction_id } });
    if (!payment) return parked(`no payment ${a.transaction_id} for adjustment ${a.id}`);
    const totals = { subtotalCents: Math.abs(cents(a.totals?.subtotal ?? "0")), taxCents: Math.abs(cents(a.totals?.tax ?? "0")), totalCents: Math.abs(cents(a.totals?.total ?? "0")) };
    const rowData = { action: a.action, type: a.type ?? "partial", status: a.status, ...totals, currency: a.currency_code ?? "USD", occurredAt, raw: a as unknown as Prisma.InputJsonObject };
    if (!payment.userId) {
      await this.prisma.adjustment.upsert({ where: { id: a.id }, create: { id: a.id, paymentId: payment.id, userId: null, ...rowData }, update: rowData });
      return ignored(`adjustment ${a.id} on a closed account's payment ${payment.id}`);
    }
    const userId = payment.userId;
    return this.ledger.withUser(userId, async (tx, user): Promise<HandlerResult> => {
      const existing = await tx.adjustment.findUnique({ where: { id: a.id } });
      const newest = !existing || occurredAt.getTime() >= existing.occurredAt.getTime();
      if (!existing) await tx.adjustment.create({ data: { id: a.id, paymentId: payment.id, userId, ...rowData } });
      else if (newest) await tx.adjustment.update({ where: { id: a.id }, data: rowData });
      const status = newest ? a.status : existing!.status;
      if (existing && existing.status === status) return processed(`adjustment ${a.id} ${status}: already applied`, userId);
      const pay = await tx.payment.findUniqueOrThrow({ where: { id: payment.id } });
      const bucket = await tx.creditBucket.findUnique({ where: { paymentId: pay.id } });
      const now = new Date();
      const ours = await tx.refund.findFirst({ where: { paymentId: pay.id, OR: [{ adjustmentId: a.id }, { status: { in: ["requested", "pending", "lookup"] } }] }, orderBy: { createdAt: "desc" } });
      const audit = (action: string, details: Record<string, unknown>) => this.ledger.audit(tx, { actor: ctx.actor, userId, action, details: { adjustment: a.id, payment: pay.id, ...details } });

      if (a.action === "refund") {
        if (status === "approved") {
          let removed = 0;
          let flag: string | null = null;
          // What was left before the reversal: the over-refund check below compares against it (after
          // it, a refund of exactly the unused share would look like too much).
          const remainingBefore = bucket?.remainingTenths ?? 0;
          if (bucket) {
            const tenths = ours ? bucket.remainingTenths : creditsToRemove({ grantedTenths: bucket.grantedTenths, remainingTenths: bucket.remainingTenths, refundSubtotalCents: totals.subtotalCents, paidCents: pay.paidCents, ours: false });
            const r = await this.ledger.reverseIn(tx, bucket, tenths, "Refunded", a.id, "refunded", now, !!ours || tenths >= bucket.remainingTenths);
            if (!r.done) return processed(`refund ${a.id} already reversed`, userId);
            removed = r.gone;
          } else if (await tx.creditEntry.findUnique({ where: { paddleAdjustmentId: a.id } })) {
            return processed(`refund ${a.id} already applied`, userId);
          } else flag = "refund_review";
          const refunded = Math.min(pay.paidCents, pay.refundedCents + totals.subtotalCents);
          if (pay.refundedCents + totals.subtotalCents > pay.paidCents) flag = "refund_review";
          if (!ours && bucket && totals.subtotalCents > refundQuoteCents({ paidCents: pay.paidCents, grantedTenths: bucket.grantedTenths, remainingTenths: remainingBefore, refundedCents: pay.refundedCents })) {
            flag = "refund_review"; // Paddle refunded more than the unused share: a person decides whether to recover anything
          }
          const whole = refunded >= pay.paidCents;
          await tx.payment.update({ where: { id: pay.id }, data: { refundedCents: refunded, status: whole ? "refunded" : "partly_refunded" } });
          if (ours) await tx.refund.update({ where: { id: ours.id }, data: { status: "approved", adjustmentId: a.id, resolvedAt: now } });
          if (flag) await tx.user.update({ where: { id: userId }, data: { billingFlag: flagFor(user, flag) } });
          // The month's payment given back in full: the plan ends now (docs/pricing.md: the plan runs to the
          // end of the paid period, and this one is paid for no longer). Only the payment that bought the
          // current period counts (the newest plan or renewal payment); an upgrade's or a pack's refund
          // takes its credits only.
          const newest = await tx.payment.findFirst({ where: { userId, kind: { in: ["plan", "renewal"] } }, orderBy: { paidAt: "desc" }, select: { id: true } });
          const cancel = await this.markCancel(tx, a, pay, user, newest?.id ?? null, false);
          let planEnded = false;
          if (whole && (pay.kind === "plan" || pay.kind === "renewal") && user.plan !== "free") {
            if (newest?.id === pay.id) {
              const ended = await this.endPlanIn(tx, user, "refunded", ctx, { payment: pay.id, adjustment: a.id });
              await this.ledger.settleIn(tx, ended.user, now);
              planEnded = true;
              this.log.warn(`refund ${a.id}: ${user.email}'s ${user.plan} month was refunded in full, the plan ended`);
            }
          }
          await audit("refund_approved", { ours: !!ours, subtotalCents: totals.subtotalCents, creditsRemoved: removed / 10, flag, planEnded, cancel: cancel.when });
          return processed(
            `refund approved: $${(totals.subtotalCents / 100).toFixed(2)}, ${removed / 10} credits removed${planEnded ? ", the plan ended (paid in full no longer)" : ""}${cancel.note}${flag ? ` (flag ${flag})` : ""}`,
            userId,
          );
        }
        if (status === "rejected") {
          if (ours) {
            await tx.refund.update({ where: { id: ours.id }, data: { status: "rejected", adjustmentId: a.id, resolvedAt: now } });
            await tx.creditBucket.updateMany({ where: { id: ours.bucketId, closedAt: null }, data: { frozenAt: null } });
          }
          await audit("refund_rejected", { ours: !!ours });
          return processed(`refund ${a.id} rejected${ours ? ": the credits are spendable again" : ""}`, userId);
        }
        if (status === "pending_approval") {
          if (ours && ours.adjustmentId !== a.id) await tx.refund.update({ where: { id: ours.id }, data: { status: "pending", adjustmentId: a.id } });
          await audit("refund_pending", { ours: !!ours });
          return processed(`refund ${a.id} pending approval`, userId);
        }
        await audit("refund_" + status, {});
        return processed(`refund ${a.id} ${status}: noted`, userId);
      }

      if (a.action === "chargeback" || a.action === "chargeback_warning") {
        let removed = 0;
        if (bucket) removed = (await this.ledger.reverseIn(tx, bucket, bucket.remainingTenths, "Removed after a chargeback", a.id, "charged_back", now)).gone;
        await tx.payment.update({ where: { id: pay.id }, data: { status: "charged_back" } });
        await tx.user.update({ where: { id: userId }, data: { billingFlag: "chargeback" } });
        if (ours && ours.status !== "approved") await tx.refund.update({ where: { id: ours.id }, data: { status: "rejected", resolvedAt: now } });
        const newest = await tx.payment.findFirst({ where: { userId, kind: { in: ["plan", "renewal"] } }, orderBy: { paidAt: "desc" }, select: { id: true } });
        const cancel = await this.markCancel(tx, a, pay, user, newest?.id ?? null, true);
        await audit(a.action, { creditsRemoved: removed / 10, fee: a.payout_totals?.chargeback_fee ?? null, cancel: cancel.when });
        this.log.warn(`${a.action} on ${pay.id} (${user.email}): account on hold`);
        return processed(`${a.action}: ${removed / 10} credits removed, account on hold${cancel.note}`, userId);
      }
      if (a.action === "chargeback_reverse" || a.action === "chargeback_warning_reverse") {
        await audit(a.action, {});
        this.log.warn(`${a.action} on ${pay.id} (${user.email}): nothing is restored by itself (admin grant, admin flag clear)`);
        return processed(`${a.action}: logged for the admin (credits and the hold are restored by hand)`, userId);
      }
      await audit(`adjustment_${a.action}`, { status });
      return processed(`${a.action} ${status}: noted`, userId);
    });
  }
}
