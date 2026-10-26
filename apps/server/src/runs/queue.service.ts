// The build queue (apps/server/README.md "The build queue"): when every builder is busy (MAX_RUNS), a build waits in
// line instead of being refused. The QueuedRun rows are the line, so a restart keeps it; RunRegistry mirrors them so
// its checks stay synchronous. Paid plans' builds go first, first come first served; a free build lines up
// QUEUE_FREE_DELAY_MIN later (aging, queue-math.ts), so it always gets its turn. Nothing is charged while a build waits:
// its credits are held (in memory, held again after a restart) and checked once more at its turn, the kill switch
// included for a Free build. A build still waiting QUEUE_WAIT_MIN after its turn leaves the line, as does one that is
// stopped; its message says why, 0 credits. Every change is announced on the project's event stream ({ type: "queued" }).
import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { ApiErrorCode, Effort, ModelChoice, Platform } from "@typeplay/shared";
import { ApiException } from "../common/api-error.js";
import { fromTenths, toTenths } from "../credits/credits.js";
import { CreditsService, type CreditHold } from "../credits/credits.service.js";
import { config } from "../env.js";
import { EventBus } from "../events/event-bus.js";
import type { Plan, QueuedRun, User } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { ProjectViews, toMessage } from "../projects/views.js";
import { turnAtOf, type RunKind } from "./queue-math.js";
import { RunRegistry, type QueuedEntry } from "./registry.js";
import { FAILED_TEXT, RunsService } from "./runs.service.js";

/** Why a waiting build didn't start at its turn, by the check that stopped it (credits.service `assertCanStart`). */
const NOT_STARTED: Partial<Record<ApiErrorCode, string>> = {
  free_paused:
    "Free builds were paused while this waited: today's free allowance is used up across TypePlay. Nothing was charged. Free builds start again at 00:00 UTC, or get a plan to keep going.",
  no_credits: "By its turn there weren't enough credits left for this, so it didn't start. Nothing was charged.",
  daily_limit: "By its turn today's 5 free credits were used, so it didn't start. Nothing was charged. More tomorrow.",
  model_not_in_plan: "Your plan changed while this waited, and the Free plan builds with Fast. Nothing was charged. Send it again on Fast.",
  billing_hold: "A payment was disputed with your bank, so building is paused and this didn't start. Nothing was charged. Write to hello@typeplay.app.",
};
const EXPIRED_TEXT = "This waited too long for its turn, so it left the line. Your game is unchanged, and nothing was charged. Send it again in a few minutes.";
const TAKEN_TEXT = "This build was interrupted by a restart on our side just as it started. Your game is unchanged, and nothing was charged.";

/** What a new build in line needs written: QueuedRun's columns (nested under its agent message, in the same write). */
export type QueuedRunData = Omit<QueuedRun, "messageId">;

const entryOf = (row: Omit<QueuedRun, "prompt" | "platform" | "holdTenths">, model: ModelChoice, effort: Effort): QueuedEntry => ({
  projectId: row.projectId,
  messageId: row.messageId,
  userId: row.userId,
  kind: row.kind as RunKind,
  model,
  effort,
  lane: row.lane,
  queuedAt: row.queuedAt.getTime(),
  turnAt: row.turnAt.getTime(),
});

@Injectable()
export class BuildQueue implements OnModuleInit, OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger("queue");
  /** The credits held for each waiting build, by message (the run takes the hold over when it starts). */
  private readonly holds = new Map<string, CreditHold>();
  /** Builds being started now (their turn came, the run isn't going yet), by project: a Stop waits for them. */
  private readonly starting = new Map<string, Promise<void>>();
  /** The place each waiting build was last told, by project, so only changes are sent. */
  private readonly told = new Map<string, string>();
  private dispatching = false;
  private again = false;
  private timer: NodeJS.Timeout | null = null;
  private stopping = false;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RunRegistry,
    private readonly runs: RunsService,
    private readonly credits: CreditsService,
    private readonly events: EventBus,
    private readonly views: ProjectViews,
  ) {}

  /** The line as a stopped server left it: mirrored and its credits held again. Started from onApplicationBootstrap. */
  async onModuleInit() {
    // A build the queue had taken out of the line but not yet started when the server stopped: its message says queued.
    const taken = await this.prisma.message.updateMany({
      where: { status: "queued", queued: { is: null } },
      data: { status: "failed", text: TAKEN_TEXT, credits: 0, finishedAt: new Date() },
    });
    if (taken.count) this.log.warn(`marked ${taken.count} build(s) a stopped server had taken from the line as failed`);
    const rows = await this.prisma.queuedRun.findMany({ include: { message: { select: { model: true, effort: true, status: true } } } });
    for (const { message, ...row } of rows) {
      if (message.status !== "queued" || !message.model) {
        await this.prisma.queuedRun.delete({ where: { messageId: row.messageId } }); // its build has ended: not in line any more
        continue;
      }
      this.registry.queued.set(row.projectId, entryOf(row, message.model, message.effort ?? "medium"));
      this.holds.set(row.messageId, this.credits.hold(row.userId, fromTenths(row.holdTenths)));
    }
    if (this.registry.queued.size) this.log.log(`${this.registry.queued.size} build(s) waiting in line`);
    this.unsubscribe = this.registry.onFree(() => this.tick());
  }

  /** After every module's start: what a stopped server left running is reset (runs.service), so the line can move. */
  onApplicationBootstrap() {
    this.tick();
  }

  onApplicationShutdown() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    this.unsubscribe?.();
  }

  /** The row for a build going into the line now: its turn (paid now, free after the delay) and its hold. */
  rowFor(r: { projectId: string; userId: string; kind: RunKind; prompt: string; platform: Platform | null; plan: Plan; hold: CreditHold; at: Date }): QueuedRunData {
    const lane = r.plan === "free" ? "free" : "paid";
    const turnAt = new Date(turnAtOf(r.at.getTime(), lane, config.queue.freeDelayMin * 60_000));
    return { projectId: r.projectId, userId: r.userId, kind: r.kind, prompt: r.prompt, platform: r.platform, lane, queuedAt: r.at, turnAt, holdTenths: toTenths(r.hold.credits) };
  }

  /** A build just written into the line (its message and row): mirrored, its hold kept, announced; it starts when it can. */
  added(row: QueuedRunData & { messageId: string }, model: ModelChoice, effort: Effort, hold: CreditHold) {
    this.registry.queued.set(row.projectId, entryOf(row, model, effort));
    this.holds.set(row.messageId, hold);
    this.log.log(`queue ${row.projectId}: waiting (${row.lane}, ${this.registry.queued.size} in line)`);
    this.tick();
  }

  /**
   * Takes the project's waiting build out of the line (a Stop, or the game being deleted): its message says stopped, 0
   * credits. A build whose turn came meanwhile is let start first (true is returned only when it left the line here):
   * the caller then stops the run (runs.service `cancel`).
   */
  async cancel(projectId: string): Promise<boolean> {
    // A start that failed is the queue's to log (dispatch), not this Stop's to answer with.
    const startDone = () => this.starting.get(projectId)?.catch(() => {});
    if (this.starting.has(projectId)) {
      await startDone();
      return false;
    }
    const q = this.registry.queued.get(projectId);
    if (!q) return false;
    // In one step: whoever deletes the row (this Stop, or the queue at its turn) has the build.
    const removed = await this.prisma.queuedRun.deleteMany({ where: { messageId: q.messageId } });
    // Its turn may have come meanwhile: then that start ends first (without starting it when this Stop has the row).
    await startDone();
    if (!removed.count) return false;
    if (this.registry.queued.get(projectId) === q) this.registry.queued.delete(projectId);
    await this.leave(q, FAILED_TEXT.cancelled, "stopped");
    this.tick(); // the ones behind it move up
    return true;
  }

  /** Starts what can start now. One at a time: a call while it goes makes it go round once more. */
  tick() {
    if (this.stopping) return;
    if (this.dispatching) {
      this.again = true;
      return;
    }
    this.dispatching = true;
    void this.dispatch()
      .catch((e) => this.log.error(`dispatch: ${(e as Error).stack ?? e}`))
      .finally(() => {
        this.dispatching = false;
        if (this.again) {
          this.again = false;
          this.tick();
        } else this.schedule();
      });
  }

  private async dispatch() {
    await this.expire();
    while (this.registry.freeBuilders > 0) {
      // In line order, skipping a game something else holds right now (it keeps its place).
      const next = this.registry.line().find((q) => this.registry.canStart(q.projectId));
      if (!next) break;
      const release = this.registry.take(next);
      const going = this.begin(next, release).finally(() => {
        this.starting.delete(next.projectId);
        release();
      });
      this.starting.set(next.projectId, going);
      await going;
    }
    await this.announce();
  }

  /** A waiting build's turn: checked again and started, or out of the line with why it didn't start (`release` lets go of
   * its builder first, so the page hears the game idle). */
  private async begin(q: QueuedEntry, release: () => void) {
    let row: (QueuedRun & { message: { model: ModelChoice | null; effort: Effort | null } }) | null;
    let hold: CreditHold;
    let refusal: ApiException | null = null;
    let user: User;
    let claimed: { count: number };
    try {
      row = await this.prisma.queuedRun.findUnique({ where: { messageId: q.messageId }, include: { message: { select: { model: true, effort: true } } } });
      if (!row) return; // stopped meanwhile: the Stop wrote its message
      hold = this.holds.get(q.messageId) ?? this.credits.hold(q.userId, fromTenths(row.holdTenths));
      this.holds.set(q.messageId, hold);
      user = await this.credits.settled(await this.prisma.user.findUniqueOrThrow({ where: { id: q.userId } }));
      try {
        await this.credits.assertCanStart(user, q.kind, q.model, row.message.effort ?? "medium", hold);
      } catch (e) {
        if (!(e instanceof ApiException)) throw e;
        refusal = e;
      }
      // Out of the line in one step: a Stop that came meanwhile took the row first, and then nothing starts.
      claimed = await this.prisma.queuedRun.deleteMany({ where: { messageId: q.messageId } });
    } catch (e) {
      // The database didn't answer: back in its place, tried again at the next look.
      if (!this.registry.queued.has(q.projectId)) this.registry.queued.set(q.projectId, q);
      throw e;
    }
    if (!claimed.count) return;
    if (refusal) {
      release();
      return this.leave(q, NOT_STARTED[refusal.code] ?? `${refusal.message} Nothing was charged.`, `not started: ${refusal.code}`);
    }
    this.holds.delete(q.messageId);
    this.told.delete(q.projectId);
    const startedAt = new Date();
    // The plan it starts on: the kill switch counts a Free build's cost by it, as for a build that started at once.
    try {
      await this.prisma.message.update({ where: { id: q.messageId }, data: { status: "running", startedAt, plan: user.plan } });
    } catch (e) {
      hold.release(); // out of the line, not started: its message stays "queued" until the next start marks it failed
      throw e;
    }
    this.log.log(`queue ${q.projectId}: started after ${Math.round((startedAt.getTime() - q.queuedAt) / 1000)} s in line (${q.lane})`);
    this.runs.start({
      projectId: q.projectId,
      userId: q.userId,
      messageId: q.messageId,
      kind: q.kind,
      prompt: row.prompt,
      model: q.model,
      effort: row.message.effort ?? "medium",
      platform: row.platform,
      hold,
      startedAt,
    });
  }

  /** Builds still waiting QUEUE_WAIT_MIN after their turn leave the line. */
  private async expire() {
    const now = Date.now();
    for (const q of [...this.registry.queued.values()]) {
      if (now - q.turnAt <= config.queue.waitMin * 60_000) continue;
      const removed = await this.prisma.queuedRun.deleteMany({ where: { messageId: q.messageId } });
      if (this.registry.queued.get(q.projectId) === q) this.registry.queued.delete(q.projectId);
      if (removed.count) await this.leave(q, EXPIRED_TEXT, "waited too long");
    }
  }

  /** Out of the line without starting: the hold goes, the message says why (0 credits), the page hears it. */
  private async leave(q: QueuedEntry, text: string, why: string) {
    this.holds.get(q.messageId)?.release();
    this.holds.delete(q.messageId);
    this.told.delete(q.projectId);
    const message = await this.prisma.message.update({ where: { id: q.messageId }, data: { status: "failed", text, credits: 0, finishedAt: new Date() } });
    this.log.log(`queue ${q.projectId}: left the line (${why}) after ${Math.round((Date.now() - q.queuedAt) / 1000)} s`);
    try {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: q.userId } });
      this.events.emit(q.projectId, { type: "failed", message: toMessage(message), project: await this.views.summary(q.projectId), credits: await this.credits.balance(user) });
    } catch (e) {
      this.log.error(`failed event ${q.projectId}: ${e}`); // the message is written; a reload shows it
    }
  }

  /** Tells every waiting build whose place or rough wait changed since it was last told. */
  private async announce() {
    const places = this.registry.places();
    for (const [projectId, place] of places) {
      const q = this.registry.queued.get(projectId);
      const said = `${place.ahead}:${place.waitMin}:${place.lane}`;
      if (!q || this.told.get(projectId) === said) continue;
      this.told.set(projectId, said);
      this.events.emit(projectId, { type: "queued", messageId: q.messageId, queue: place });
    }
    for (const id of [...this.told.keys()]) if (!places.has(id)) this.told.delete(id);
  }

  /** While builds wait, look again now and then: the waits shrink as the builds going age, and the wait limit runs out. */
  private schedule() {
    if (this.timer || this.stopping || !this.registry.queued.size) return;
    const every = Math.max(1_000, Math.min(30_000, (config.queue.waitMin * 60_000) / 6));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick();
    }, every);
    this.timer.unref();
  }
}
