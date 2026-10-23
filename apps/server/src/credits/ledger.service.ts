// The credit ledger's writes (docs/payments-design.md §4). Every write runs in one Prisma
// interactive transaction that first locks the user's row (`SELECT … FOR UPDATE`): Read Committed
// gives no read-then-write protection, so the row lock is what serialises a charge, a grant, a
// settle and (part 2) a webhook for the same user. One lock order everywhere: the user first, then
// whatever else the caller writes (runs.service passes its own transaction in, after the lock).
//
// Buckets hold credits that arrived together and end together; a charge takes from them in spend
// order (ledger-math.ts) and records the split as allocations. settle() does the time-driven work:
// due buckets expire, Free users get their monthly 20, past-due plans lapse a day after the period.
import { Inject, Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { CreditBalance, PlanId } from "@typeplay/shared";
import { config } from "../env.js";
import type { ClosedWhy, CreditBucket, CreditEntry, CreditSource, Prisma, PrismaClient, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { FREE_DAILY_CREDITS, FREE_MONTHLY_CREDITS, fromTenths, toTenths } from "./credits.js";
import { allocate, availableTenths, carryOverCap, expireNote, expiringSoonest, monthLater, nextSettleAt, PAST_DUE_GRACE_MS, spendable, startOfUtcDay } from "./ledger-math.js";

export type Tx = Prisma.TransactionClient;

/** A grant: where the credits come from and when they end. */
export interface Grant {
  source: CreditSource;
  tenths: number;
  expiresAt: Date | null;
  /** The history line ("Free plan", "Medium plan, October", "Given by hand"). */
  note: string;
  /** The Paddle transaction that bought it (txn_…). */
  paymentId?: string;
  startsAt?: Date;
}

/** One part of what the user can spend, for the billing page ("163 from High, until 17 Dec"). */
export interface CreditPart {
  source: CreditSource;
  left: number;
  expiresAt: string | null;
}

/** What `admin audit` found wrong, one line each; empty when the invariants hold. */
export type AuditProblem = string;

/** The 10-minute sweep: users whose nextSettleAt passed, 200 at a time. */
const SWEEP_MS = 10 * 60_000;
const SWEEP_BATCH = 200;
/** Interactive transactions that wait for the user's lock get this long (Prisma's default is 5 s). */
export const TX_OPTIONS = { timeout: 15_000 };

@Injectable()
export class LedgerService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("ledger");
  private timer: NodeJS.Timeout | null = null;

  /** The admin CLI builds one with createPrisma(); the API injects PrismaService. */
  constructor(@Inject(PrismaService) private readonly prisma: PrismaClient) {}

  onModuleInit() {
    if (!config.billingJobs) return;
    this.timer = setInterval(() => void this.sweep().catch((e) => this.log.error(`sweep: ${e}`)), SWEEP_MS);
    this.timer.unref();
    setTimeout(() => void this.sweep().catch((e) => this.log.error(`sweep: ${e}`)), 5_000).unref();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  // ---- The lock ----------------------------------------------------------------------------

  /** Locks the user's row for the rest of the transaction: the first statement of every ledger write. */
  async lock(tx: Tx, userId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  }

  /**
   * One transaction with the user's row locked, settled first when something is due; `fn` gets the
   * fresh row. Everything the ledger writes on its own goes through here.
   */
  withUser<T>(userId: string, fn: (tx: Tx, user: User) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, userId);
      let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (this.due(user)) user = await this.settleIn(tx, user);
      return fn(tx, user);
    }, TX_OPTIONS);
  }

  private due(user: User, now = new Date()): boolean {
    return user.nextSettleAt !== null && user.nextSettleAt.getTime() <= now.getTime();
  }

  // ---- Writes (inside a transaction that holds the lock) -------------------------------------

  /**
   * A charge (a message's credits), or credits taken back by hand (`kind: "grant"`, negative, so the
   * Free daily limit ignores it): one ledger row plus its split over the buckets in spend order; what
   * no bucket covers becomes debt that the next grant settles first.
   */
  async chargeIn(tx: Tx, userId: string, tenths: number, data: { messageId?: string | null; note: string; kind?: "charge" | "grant" }, now = new Date()): Promise<CreditEntry> {
    let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (this.due(user, now)) user = await this.settleIn(tx, user, now);
    const buckets = await tx.creditBucket.findMany({ where: { userId, closedAt: null, frozenAt: null, remainingTenths: { gt: 0 } } });
    const { allocations, debtTenths } = allocate(buckets, tenths);
    const entry = await tx.creditEntry.create({
      data: {
        userId,
        amount: fromTenths(-tenths),
        tenths: -tenths,
        kind: data.kind ?? "charge",
        messageId: data.messageId ?? null,
        note: data.note,
        createdAt: now,
        allocations: { create: allocations.map((a) => ({ bucketId: a.bucketId, tenths: a.tenths })) },
      },
    });
    for (const a of allocations) {
      if (a.bucketId) await tx.creditBucket.update({ where: { id: a.bucketId }, data: { remainingTenths: { decrement: a.tenths } } });
    }
    if (debtTenths > 0) await tx.user.update({ where: { id: userId }, data: { debtTenths: { increment: debtTenths } } });
    return entry;
  }

  /**
   * Credits added: a new bucket and its grant row. Debt is settled first: the debt allocations of
   * earlier charges move onto this bucket (so every charge's split still adds up to the charge, and
   * the bucket's remaining = granted − its allocations).
   */
  async grantIn(tx: Tx, userId: string, g: Grant, now = new Date(), opts: { settled?: boolean } = {}): Promise<{ entry: CreditEntry; bucket: CreditBucket }> {
    if (!Number.isInteger(g.tenths) || g.tenths <= 0) throw new Error(`a grant is a positive whole number of tenths, not ${g.tenths}`);
    let user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (!opts.settled && this.due(user, now)) user = await this.settleIn(tx, user, now);
    const bucket = await tx.creditBucket.create({
      data: {
        userId,
        source: g.source,
        grantedTenths: g.tenths,
        remainingTenths: g.tenths,
        startsAt: g.startsAt ?? now,
        expiresAt: g.expiresAt,
        paymentId: g.paymentId ?? null,
        note: g.note,
        createdAt: now,
      },
    });
    const entry = await tx.creditEntry.create({
      data: { userId, amount: fromTenths(g.tenths), tenths: g.tenths, kind: "grant", note: g.note, bucketId: bucket.id, createdAt: now },
    });
    if (user.debtTenths > 0) {
      let left = Math.min(user.debtTenths, g.tenths);
      let moved = 0;
      const owed = await tx.creditAllocation.findMany({ where: { bucketId: null, entry: { userId } }, orderBy: [{ entry: { createdAt: "asc" } }, { id: "asc" }] });
      for (const a of owed) {
        if (left <= 0) break;
        if (a.tenths <= left) {
          await tx.creditAllocation.update({ where: { id: a.id }, data: { bucketId: bucket.id } });
          left -= a.tenths;
          moved += a.tenths;
        } else {
          await tx.creditAllocation.update({ where: { id: a.id }, data: { tenths: a.tenths - left } });
          await tx.creditAllocation.create({ data: { entryId: a.entryId, bucketId: bucket.id, tenths: left } });
          moved += left;
          left = 0;
        }
      }
      if (moved > 0) {
        bucket.remainingTenths -= moved;
        await tx.creditBucket.update({ where: { id: bucket.id }, data: { remainingTenths: { decrement: moved } } });
        await tx.user.update({ where: { id: userId }, data: { debtTenths: { decrement: moved } } });
      }
    }
    // A bucket that ends sooner than anything else moves the next settle up.
    if (g.expiresAt && (!user.nextSettleAt || g.expiresAt < user.nextSettleAt)) {
      await tx.user.update({ where: { id: userId }, data: { nextSettleAt: g.expiresAt } });
    }
    return { entry, bucket };
  }

  /** `tenths` of a bucket end (an `expire` row), the bucket closed when told to or when empty. */
  async expireIn(tx: Tx, bucket: CreditBucket, tenths: number, note: string, why: ClosedWhy, now = new Date(), close = true): Promise<void> {
    const gone = Math.max(0, Math.min(tenths, bucket.remainingTenths));
    if (gone > 0) {
      await tx.creditEntry.create({ data: { userId: bucket.userId, amount: fromTenths(-gone), tenths: -gone, kind: "expire", note, bucketId: bucket.id, createdAt: now } });
    }
    const closing = close || bucket.remainingTenths - gone <= 0;
    await tx.creditBucket.update({
      where: { id: bucket.id },
      data: { remainingTenths: { decrement: gone }, ...(closing ? { closedAt: now, closedWhy: why } : {}) },
    });
    bucket.remainingTenths -= gone;
  }

  /**
   * Credits removed after a refund or a chargeback (the adjustment webhooks, billing/handlers.ts): a
   * `reversal` row named by its Paddle adjustment, so a replayed webhook can't remove them twice
   * (unique). The bucket is closed when told to (`close`, the default) or when nothing is left: a
   * partial refund Paddle made itself leaves the rest spendable. `done` is false when this adjustment
   * was reversed before; `gone` is 0 when there was nothing left to remove (no row is written then:
   * the history never says "Refunded 0", and a bucket closed earlier keeps its own closing).
   */
  async reverseIn(tx: Tx, bucket: CreditBucket, tenths: number, note: string, paddleAdjustmentId: string, why: ClosedWhy, now = new Date(), close = true): Promise<{ done: boolean; gone: number }> {
    const already = await tx.creditEntry.findUnique({ where: { paddleAdjustmentId } });
    if (already) return { done: false, gone: 0 };
    const gone = Math.max(0, Math.min(tenths, bucket.remainingTenths));
    if (gone > 0) {
      await tx.creditEntry.create({
        data: { userId: bucket.userId, amount: fromTenths(-gone), tenths: -gone, kind: "reversal", note, bucketId: bucket.id, paddleAdjustmentId, createdAt: now },
      });
    }
    const closing = !bucket.closedAt && (close || bucket.remainingTenths - gone <= 0);
    await tx.creditBucket.update({
      where: { id: bucket.id },
      data: { remainingTenths: { decrement: gone }, frozenAt: null, ...(closing ? { closedAt: now, closedWhy: why } : {}) },
    });
    bucket.remainingTenths -= gone;
    return { done: true, gone };
  }

  /**
   * The carry-over cap before a renewal's grant (part 2): the open plan and upgrade buckets together
   * keep at most the new plan's month; the rest ends, oldest first.
   */
  async capCarryOverIn(tx: Tx, userId: string, capTenths: number, now = new Date()): Promise<number> {
    const buckets = await tx.creditBucket.findMany({ where: { userId, closedAt: null } });
    let total = 0;
    for (const cut of carryOverCap(buckets, capTenths)) {
      const b = buckets.find((x) => x.id === cut.bucketId)!;
      await this.expireIn(tx, b, cut.tenths, expireNote(b.source, b.startsAt), "expired", now, false);
      total += cut.tenths;
    }
    return total;
  }

  /**
   * Free users: the month's credits. Unless a free grant happened within the last month (then the
   * cycle just moves to a month after it, so a cancel-and-return can't farm them), the old free
   * bucket ends and 20 new credits start, with the cycle ending a month from now. Also what a cancel
   * or a lapse calls to start the Free cycle (part 2). The grant is written a millisecond after the
   * expiry, so the history keeps them in that order.
   */
  async startFreeCycleIn(tx: Tx, user: User, now = new Date()): Promise<User> {
    const last = await tx.creditBucket.findFirst({ where: { userId: user.id, source: "free" }, orderBy: { startsAt: "desc" } });
    const tooSoon = last && monthLater(last.startsAt).getTime() > now.getTime();
    if (tooSoon) {
      return tx.user.update({ where: { id: user.id }, data: { freeCycleEndsAt: monthLater(last.startsAt) } });
    }
    const oldFree = await tx.creditBucket.findMany({ where: { userId: user.id, closedAt: null, source: "free" } });
    for (const b of oldFree) await this.expireIn(tx, b, b.remainingTenths, expireNote("free", b.startsAt), "expired", now);
    const at = new Date(now.getTime() + 1);
    const ends = monthLater(at);
    const fresh = await tx.user.update({ where: { id: user.id }, data: { freeCycleEndsAt: ends } });
    await this.grantIn(tx, user.id, { source: "free", tenths: toTenths(FREE_MONTHLY_CREDITS), expiresAt: ends, note: "Free plan" }, at, { settled: true });
    return fresh;
  }

  /**
   * The time-driven work, under the lock: due buckets end (one `expire` row each, in plain words);
   * Free users past their cycle get the month's 20; a past-due plan lapses a day after its period
   * (plan credits end, packs stay, Free starts: a renewal that goes through later restores the plan
   * by money). Then nextSettleAt is recomputed. Returns the fresh user row.
   */
  async settleIn(tx: Tx, user: User, now = new Date()): Promise<User> {
    const userId = user.id;
    const due = await tx.creditBucket.findMany({ where: { userId, closedAt: null, expiresAt: { lte: now } }, orderBy: { expiresAt: "asc" } });
    for (const b of due) await this.expireIn(tx, b, b.remainingTenths, expireNote(b.source, b.startsAt), "expired", now);
    let u = user;
    if (u.plan === "free" && u.freeCycleEndsAt && u.freeCycleEndsAt.getTime() <= now.getTime()) {
      u = await this.startFreeCycleIn(tx, u, now);
    }
    if (u.plan !== "free" && u.subscriptionStatus === "past_due" && u.periodEndsAt && now.getTime() >= u.periodEndsAt.getTime() + PAST_DUE_GRACE_MS) {
      const planBuckets = await tx.creditBucket.findMany({ where: { userId, closedAt: null, source: { in: ["plan", "upgrade"] } } });
      let ended = 0;
      for (const b of planBuckets) {
        ended += b.remainingTenths;
        await this.expireIn(tx, b, b.remainingTenths, expireNote(b.source, b.startsAt), "canceled", now);
      }
      const was = u.plan;
      u = await tx.user.update({ where: { id: userId }, data: { plan: "free", pendingPlan: null } });
      u = await this.startFreeCycleIn(tx, u, now);
      await this.audit(tx, { actor: "job:settle", userId, action: "plan_lapsed", details: { from: was, periodEndsAt: u.periodEndsAt, creditsEnded: fromTenths(ended) } });
      this.log.warn(`user ${userId}: ${was} lapsed (past due since ${u.periodEndsAt?.toISOString()}), now free`);
    }
    const open = await tx.creditBucket.findMany({ where: { userId, closedAt: null }, select: { expiresAt: true, closedAt: true } });
    const next = nextSettleAt({ buckets: open, plan: u.plan, freeCycleEndsAt: u.freeCycleEndsAt, subscriptionStatus: u.subscriptionStatus, periodEndsAt: u.periodEndsAt });
    return tx.user.update({ where: { id: userId }, data: { nextSettleAt: next } });
  }

  /** A billing audit row: who did what to whom. `db` is the caller's transaction, or the client. */
  audit(db: Tx | PrismaClient, row: { actor: string; userId: string | null; action: string; details: Record<string, unknown> }): Promise<unknown> {
    return db.billingAudit.create({ data: { actor: row.actor, userId: row.userId, action: row.action, details: row.details as Prisma.InputJsonObject } });
  }

  // ---- Entry points (take the lock themselves) ---------------------------------------------

  /** Settles the user when something is due (expiry, the Free month, a lapse); otherwise a no-op. */
  async settle(user: User, now = new Date()): Promise<User> {
    if (!this.due(user, now)) return user;
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, user.id);
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
      return this.due(fresh, now) ? this.settleIn(tx, fresh, now) : fresh; // another request may have done it meanwhile
    }, TX_OPTIONS);
  }

  /** The sweep: every user whose nextSettleAt passed, one transaction each. */
  async sweep(now = new Date()): Promise<number> {
    const users = await this.prisma.user.findMany({ where: { nextSettleAt: { lte: now } }, take: SWEEP_BATCH, orderBy: { nextSettleAt: "asc" } });
    let n = 0;
    for (const u of users) {
      try {
        await this.settle(u, now);
        n++;
      } catch (e) {
        this.log.error(`settle ${u.id}: ${e}`);
      }
    }
    if (n) this.log.log(`settled ${n} user(s)`);
    return n;
  }

  /** Credits added by hand or by a payment (part 2): one transaction, the lock, the grant. */
  grant(userId: string, g: Grant): Promise<{ entry: CreditEntry; bucket: CreditBucket }> {
    return this.withUser(userId, (tx) => this.grantIn(tx, userId, g, new Date(), { settled: true }));
  }

  /** Credits taken back by hand: a negative grant row, consumed in spend order (debt when short). */
  takeBack(userId: string, tenths: number, note: string): Promise<CreditEntry> {
    return this.withUser(userId, (tx) => this.chargeIn(tx, userId, tenths, { note, kind: "grant" }));
  }

  // ---- Reads ----------------------------------------------------------------------------------

  /** What the user can spend now (settled first when due), with today's Free allowance and the credits ending soonest. */
  async balance(user: User, now = new Date()): Promise<CreditBalance> {
    const u = await this.settle(user, now);
    const buckets = await this.prisma.creditBucket.findMany({ where: { userId: u.id, closedAt: null } });
    const soon = expiringSoonest(buckets);
    const balance: CreditBalance = {
      available: fromTenths(availableTenths(buckets, u.debtTenths)),
      todayLeft: null,
      expiring: soon ? { amount: fromTenths(soon.tenths), at: soon.at.toISOString() } : null,
    };
    if ((u.plan as PlanId) === "free") {
      const today = await this.prisma.creditEntry.aggregate({ where: { userId: u.id, kind: "charge", createdAt: { gte: startOfUtcDay(now) } }, _sum: { tenths: true } });
      const used = -(today._sum.tenths ?? 0);
      balance.todayLeft = fromTenths(Math.max(0, toTenths(FREE_DAILY_CREDITS) - used));
    }
    return balance;
  }

  /** The spendable buckets as the billing page lists them (part 3's `credits.parts`), in spend order. */
  async parts(userId: string): Promise<CreditPart[]> {
    const buckets = await this.prisma.creditBucket.findMany({ where: { userId, closedAt: null } });
    return spendable(buckets).map((b) => ({ source: b.source, left: fromTenths(b.remainingTenths), expiresAt: b.expiresAt?.toISOString() ?? null }));
  }

  /**
   * The kill switch's number: what Free runs have cost in AI today (API list price), failed runs
   * included. Kept per UTC day in FreeSpend, added to when a run ends and never lowered: Message rows
   * go with their game when it is deleted, so a sum over them would forget what a deleted game cost.
   */
  async freeAiUsdToday(now = new Date()): Promise<number> {
    const row = await this.prisma.freeSpend.findUnique({ where: { day: startOfUtcDay(now) } });
    return Number(row?.usd ?? 0);
  }

  /** A Free run ended (done or failed): its AI cost joins the day's total (runs.service, with its transaction). */
  async addFreeSpend(db: Tx | PrismaClient, usd: number, now = new Date()): Promise<void> {
    if (!(usd > 0)) return;
    const day = startOfUtcDay(now);
    await db.freeSpend.upsert({ where: { day }, create: { day, usd }, update: { usd: { increment: usd } } });
  }

  /**
   * The invariants (docs/payments-design.md §3), for one user or everyone: (1) per user the ledger
   * rows add up to the open buckets' remaining less the debt, and the debt is exactly the debt
   * allocations; (2) every charge's allocations add up to the charge; (3) every bucket's remaining is
   * what was granted less its allocations, expiries and reversals, never below zero; (4) one reversal
   * per Paddle adjustment; (5) nothing refunded beyond what was paid; (6) stored events still carry
   * their own id. Returns one line per problem.
   */
  async checkInvariants(userId: string | null): Promise<AuditProblem[]> {
    const problems: AuditProblem[] = [];
    const only = userId ?? null;
    const users = await this.prisma.$queryRaw<{ id: string; email: string; debt: number; entries: number; remaining: number; debtAlloc: number; untyped: number }[]>`
      SELECT u.id, u.email, u."debtTenths" AS debt,
        coalesce((SELECT sum(e.tenths) FROM "CreditEntry" e WHERE e."userId" = u.id), 0)::int AS entries,
        coalesce((SELECT sum(b."remainingTenths") FROM "CreditBucket" b WHERE b."userId" = u.id AND b."closedAt" IS NULL), 0)::int AS remaining,
        coalesce((SELECT sum(a.tenths) FROM "CreditAllocation" a JOIN "CreditEntry" e ON e.id = a."entryId" WHERE e."userId" = u.id AND a."bucketId" IS NULL), 0)::int AS "debtAlloc",
        (SELECT count(*) FROM "CreditEntry" e WHERE e."userId" = u.id AND e.tenths IS NULL)::int AS untyped
      FROM "User" u WHERE ${only}::text IS NULL OR u.id = ${only}`;
    for (const u of users) {
      if (u.entries !== u.remaining - u.debt) problems.push(`${u.email}: ledger rows add up to ${u.entries} tenths, but open buckets hold ${u.remaining} and the debt is ${u.debt}`);
      if (u.debtAlloc !== u.debt) problems.push(`${u.email}: debt is ${u.debt} tenths, but the debt allocations add up to ${u.debtAlloc}`);
      if (u.untyped) problems.push(`${u.email}: ${u.untyped} ledger row(s) without tenths`);
    }
    const charges = await this.prisma.$queryRaw<{ id: string; email: string; tenths: number; alloc: number }[]>`
      SELECT e.id, u.email, e.tenths, coalesce(sum(a.tenths), 0)::int AS alloc
      FROM "CreditEntry" e JOIN "User" u ON u.id = e."userId" LEFT JOIN "CreditAllocation" a ON a."entryId" = e.id
      WHERE e.tenths < 0 AND e.kind IN ('charge', 'grant') AND (${only}::text IS NULL OR e."userId" = ${only})
      GROUP BY e.id, u.email HAVING coalesce(sum(a.tenths), 0) <> -e.tenths`;
    for (const c of charges) problems.push(`${c.email}: charge ${c.id} is ${c.tenths} tenths, but its allocations add up to ${c.alloc}`);
    const buckets = await this.prisma.$queryRaw<{ id: string; email: string; source: string; granted: number; remaining: number; alloc: number; gone: number; grantRows: number }[]>`
      SELECT b.id, u.email, b.source::text AS source, b."grantedTenths" AS granted, b."remainingTenths" AS remaining,
        coalesce((SELECT sum(a.tenths) FROM "CreditAllocation" a WHERE a."bucketId" = b.id), 0)::int AS alloc,
        coalesce((SELECT -sum(e.tenths) FROM "CreditEntry" e WHERE e."bucketId" = b.id AND e.kind IN ('expire', 'reversal')), 0)::int AS gone,
        coalesce((SELECT sum(e.tenths) FROM "CreditEntry" e WHERE e."bucketId" = b.id AND e.kind IN ('grant', 'refund')), 0)::int AS "grantRows"
      FROM "CreditBucket" b JOIN "User" u ON u.id = b."userId" WHERE ${only}::text IS NULL OR b."userId" = ${only}`;
    for (const b of buckets) {
      if (b.remaining < 0) problems.push(`${b.email}: ${b.source} bucket ${b.id} is below zero (${b.remaining})`);
      if (b.remaining !== b.granted - b.alloc - b.gone) problems.push(`${b.email}: ${b.source} bucket ${b.id} has ${b.remaining} left, but granted ${b.granted} − spent ${b.alloc} − ended ${b.gone} = ${b.granted - b.alloc - b.gone}`);
      if (b.grantRows !== b.granted) problems.push(`${b.email}: ${b.source} bucket ${b.id} was granted ${b.granted}, but its grant rows add up to ${b.grantRows}`);
    }
    const reversals = await this.prisma.$queryRaw<{ adj: string; n: number }[]>`
      SELECT "paddleAdjustmentId" AS adj, count(*)::int AS n FROM "CreditEntry" WHERE "paddleAdjustmentId" IS NOT NULL
      AND (${only}::text IS NULL OR "userId" = ${only}) GROUP BY "paddleAdjustmentId" HAVING count(*) > 1`;
    for (const r of reversals) problems.push(`adjustment ${r.adj} has ${r.n} reversals`);
    const refunds = await this.prisma.$queryRaw<{ id: string; paid: number; refunded: number }[]>`
      SELECT id, "paidCents" AS paid, "refundedCents" AS refunded FROM "Payment"
      WHERE ("refundedCents" > "paidCents" OR "refundedCents" < 0) AND (${only}::text IS NULL OR "userId" = ${only})`;
    for (const p of refunds) problems.push(`payment ${p.id}: refunded ${p.refunded} cents of ${p.paid} paid`);
    if (!only) {
      const events = await this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "PaddleEvent" WHERE payload ? 'event_id' AND payload->>'event_id' IS DISTINCT FROM id`;
      for (const e of events) problems.push(`event ${e.id}: its payload carries another event id`);
    }
    return problems;
  }
}
