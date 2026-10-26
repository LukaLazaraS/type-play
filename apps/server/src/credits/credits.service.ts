// The credits as the API sees them: the balance, the checks before a run (model, credits, the Free
// daily limit, the kill switch, ask-first), the holds, and the history. The ledger itself (buckets,
// charges, grants, expiry, the Free month) is ledger.service.ts; this file never writes a row.
// A run's charge is written only when it finishes, so while it waits in line and runs its estimate's `high` is held
// (in memory) and the next message of the same user is checked against what is left after the holds.
import { Injectable } from "@nestjs/common";
import type { CreditBalance, Effort, Estimate, ModelChoice, PlanId, UsageEntry, UsagePage } from "@typeplay/shared";
import { ApiException } from "../common/api-error.js";
import type { CreditEntry, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { estimate, FREE_DAILY_AI_USD, fromTenths, planModels, toTenths } from "./credits.js";
import { LedgerService } from "./ledger.service.js";

/** Credits a run still going may cost: released when its charge (or its failure) is written. */
export interface CreditHold {
  credits: number;
  release(): void;
}

const MODEL_NAME: Record<ModelChoice, string> = { fast: "Fast", smart: "Smart", best: "Best" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A ledger row in plain words. Charges carry `<new|edit> on <model>` as their note (runs.service). */
function whatOf(e: CreditEntry, model: ModelChoice | null): string {
  if (e.kind === "charge") {
    const m = /^(new|edit) on (fast|smart|best)$/.exec(e.note ?? "");
    const name = MODEL_NAME[(m?.[2] as ModelChoice | undefined) ?? model ?? "fast"];
    if (m?.[1] === "new") return `New game on ${name}`;
    return m || model ? `Change on ${name}` : "Credits used";
  }
  if (e.kind === "refund") return e.note?.trim() || "Credits back";
  if (e.kind === "expire") return e.note?.trim() || "Credits ended";
  if (e.kind === "reversal") return e.note?.trim() || "Credits removed";
  if (e.note === "Free plan") return "Free plan credits";
  return e.note?.trim() || "Credits added";
}

@Injectable()
export class CreditsService {
  /** Per user: the holds of their runs still going (one API process; see README "Left for later"). */
  private readonly holds = new Map<string, Set<CreditHold>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
  ) {}

  /** The balance (the ledger settles what is due first: expiry, the Free month). */
  balance(user: User): Promise<CreditBalance> {
    return this.ledger.balance(user);
  }

  /** The user's row after anything due is settled (a lapsed plan is Free in this row already). */
  settled(user: User): Promise<User> {
    return this.ledger.settle(user);
  }

  /** What this user's runs still going may still cost, in credits. */
  heldBy(userId: string): number {
    let tenths = 0;
    for (const h of this.holds.get(userId) ?? []) tenths += toTenths(h.credits);
    return fromTenths(tenths);
  }

  /** Holds credits for a build of this user's (a waiting build's again after a restart: queue.service.ts). */
  hold(userId: string, credits: number): CreditHold {
    const set = this.holds.get(userId) ?? new Set<CreditHold>();
    this.holds.set(userId, set);
    const h: CreditHold = {
      credits,
      release: () => {
        set.delete(h);
        if (!set.size && this.holds.get(userId) === set) this.holds.delete(userId);
      },
    };
    set.add(h);
    return h;
  }

  /**
   * Throws the contract's error when this message may not start (model, the kill switch, credits,
   * daily limit, ask first); otherwise holds the estimate's `high` for the run. The caller releases
   * the hold when the run's charge is written (runs.service), or at once if the run never starts.
   */
  async assertCanRun(user: User, kind: "new" | "edit", model: ModelChoice, confirm: boolean | undefined, effort: Effort = "medium"): Promise<CreditHold> {
    const est = await this.check(user, kind, model, effort, { confirm: !!confirm, own: null });
    return this.hold(user.id, est.high);
  }

  /**
   * A build that waited in line, at its turn (queue.service.ts): the same checks against the user's row now (a plan
   * that lapsed meanwhile, the kill switch for a Free build, the credits after the user's other holds), except asking
   * first (they confirmed when they sent it). Its own hold stays its run's. Throws the contract's error.
   */
  async assertCanStart(user: User, kind: "new" | "edit", model: ModelChoice, effort: Effort, own: CreditHold): Promise<void> {
    await this.check(user, kind, model, effort, { confirm: true, own });
  }

  private async check(user: User, kind: "new" | "edit", model: ModelChoice, effort: Effort, opts: { confirm: boolean; own: CreditHold | null }): Promise<Estimate> {
    const plan = user.plan as PlanId;
    // A disputed payment (chargeback) holds the account until an admin clears it: no builds, no buying.
    if (user.billingFlag === "chargeback") {
      throw new ApiException(403, "billing_hold", "A payment was disputed with your bank, so building is paused. Write to hello@typeplay.app.");
    }
    if (!planModels(plan).includes(model)) {
      throw new ApiException(403, "model_not_in_plan", "The Free plan builds with Fast. Pick Fast, or upgrade for Smart and Best.");
    }
    // The kill switch (docs/pricing.md): Free builds stop for the day once they have cost $20 of AI across everyone.
    if (plan === "free" && (await this.ledger.freeAiUsdToday()) >= FREE_DAILY_AI_USD) {
      throw new ApiException(402, "free_paused", "Free builds are paused until 00:00 UTC: today's free allowance is used up across TypePlay. Get a plan to keep going.");
    }
    const est = estimate(kind, model, plan, effort);
    const { available, todayLeft } = await this.balance(user);
    // No await from here to the hold: two messages sent at once can't both pass on the same credits. A waiting build
    // at its turn doesn't count its own hold against itself.
    const held = fromTenths(toTenths(this.heldBy(user.id)) - (opts.own ? toTenths(opts.own.credits) : 0));
    const left = fromTenths(toTenths(available) - toTenths(held));
    if (available <= 0 || left < est.low) {
      throw new ApiException(
        402,
        "no_credits",
        held > 0 ? "Your build that's going now may need the credits you have left. Wait for it to finish." : "You're out of credits for this message.",
      );
    }
    // The same rule as the balance (and as the site shows): enough left today for the low estimate.
    if (todayLeft !== null && fromTenths(toTenths(todayLeft) - toTenths(held)) < est.low) {
      throw new ApiException(
        402,
        "daily_limit",
        todayLeft <= 0
          ? "You've used today's 5 free credits. More tomorrow."
          : `Not enough of today's 5 free credits left for this (${todayLeft} left; it needs at least ${est.low}). More tomorrow.`,
      );
    }
    if (est.needsConfirm && !opts.confirm) {
      throw new ApiException(409, "needs_confirm", `This could cost up to ${est.high} credits. Send it again to confirm.`);
    }
    return est;
  }

  /** The credit history, newest first: `limit` entries older than `cursor` (an entry id from `next`). */
  async history(user: User, cursor: string | null, limit: number): Promise<UsagePage> {
    await this.ledger.settle(user); // an expiry or the month's credits that fell due show up here
    const rows = await this.prisma.creditEntry.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor && UUID.test(cursor) ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const more = rows.length > limit;
    const page = rows.slice(0, limit);
    return { entries: await this.describe(page), next: more ? page.at(-1)!.id : null };
  }

  /** Every entry (the account export), newest first. */
  async all(user: User): Promise<UsageEntry[]> {
    await this.ledger.settle(user);
    const rows = await this.prisma.creditEntry.findMany({ where: { userId: user.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    return this.describe(rows);
  }

  /** Ledger rows -> UsageEntry: the game each charge was for and the prompt that ran. */
  private async describe(rows: CreditEntry[]): Promise<UsageEntry[]> {
    const ids = [...new Set(rows.map((r) => r.messageId).filter((id): id is string => !!id && UUID.test(id)))];
    const messages = ids.length
      ? await this.prisma.message.findMany({
          where: { id: { in: ids } },
          select: { id: true, projectId: true, model: true, versionN: true, project: { select: { id: true, name: true } } },
        })
      : [];
    const byId = new Map(messages.map((m) => [m.id, m]));
    // A charge is written with the version it made: that version's label is the prompt.
    const pairs = messages.filter((m) => m.versionN != null).map((m) => ({ projectId: m.projectId, n: m.versionN! }));
    const versions = pairs.length
      ? await this.prisma.version.findMany({ where: { OR: pairs }, select: { projectId: true, n: true, label: true } })
      : [];
    const label = new Map(versions.map((v) => [`${v.projectId}:${v.n}`, v.label]));
    return rows.map((e) => {
      const m = e.messageId ? byId.get(e.messageId) : undefined;
      const prompt = m?.versionN != null ? (label.get(`${m.projectId}:${m.versionN}`) ?? null) : null;
      const entry: UsageEntry = {
        id: e.id,
        at: e.createdAt.toISOString(),
        amount: fromTenths(e.tenths ?? toTenths(Number(e.amount))),
        kind: e.kind,
        what: whatOf(e, (m?.model as ModelChoice | null) ?? null),
        prompt: prompt && prompt.length > 200 ? `${prompt.slice(0, 199)}…` : prompt,
        game: m ? { id: m.project.id, name: m.project.name } : null,
      };
      if (e.messageId && !m) entry.gameDeleted = true;
      return entry;
    });
  }
}

export const effortOrDefault = (e: Effort | undefined): Effort => e ?? "medium";
