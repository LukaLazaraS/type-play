// Which projects have a run (or a restore, or an Android build) going or a build waiting in line: one per project, at
// most MAX_RUNS runs at once (past it, builds wait in line: queue.service.ts), and per user as many going or waiting as
// their plan allows (credits.ts `runsAtOnce`). The line itself is in Postgres (QueuedRun); `queued` mirrors it, so every
// check here is synchronous: nothing can slip in between a check and the claim it guards.
import { Injectable } from "@nestjs/common";
import type { Effort, ModelChoice, PlanId, Platform, QueuePlace, RunEvent, RunStatus } from "@typeplay/shared";
import { ApiException } from "../common/api-error.js";
import { runsAtOnce } from "../credits/credits.js";
import type { CreditHold } from "../credits/credits.service.js";
import { config } from "../env.js";
import type { AgentHandle } from "./agent.js";
import type { ExportHandle } from "../games/godot.js";
import { inLine, runEndsAt, typicalMs, waitMinutes, waits, type Going, type Lane, type RunKind } from "./queue-math.js";

export interface ActiveRun {
  projectId: string;
  messageId: string;
  userId: string;
  kind: "new" | "edit";
  prompt: string;
  model: ModelChoice;
  effort: Effort;
  /** A first build's screens, as StartRun's. */
  platform?: Platform | null;
  /** The credits held for this run while it goes (released when its charge or failure is written). */
  hold: CreditHold | null;
  handle: AgentHandle | null;
  /** The re-export after a rolled-back last step (succeed()): cancel and shutdown must reach it too. */
  export: ExportHandle | null;
  cancelled: boolean;
  timedOut: boolean;
  lastProgress: Extract<RunEvent, { type: "progress" }> | null;
  /** When it started (ms): the queue's rough wait counts from it. */
  startedAt: number;
  /** Settles when the run is fully finished (folder settled, rows written, event sent). */
  finished: Promise<void>;
}

/** A build waiting in line, as the registry needs it (the row is QueuedRun). */
export interface QueuedEntry {
  projectId: string;
  messageId: string;
  userId: string;
  kind: RunKind;
  model: ModelChoice;
  effort: Effort;
  lane: Lane;
  queuedAt: number;
  turnAt: number;
}

/**
 * run: a build starting now (it holds a builder); queue: a build on its way into the line (no builder); export: an
 * Android build (android/android.service.ts) holds the project for its whole run.
 */
type Purpose = "run" | "queue" | "restore" | "delete" | "export";
/** What a starting build will be, for the rough waits of the builds behind it. */
type Reservation = { purpose: Purpose; userId: string | null; kind?: RunKind; model?: ModelChoice; effort?: Effort };

/** An Android build holds two builders for about this long (an APK under a minute, an AAB 2 to 4). */
const EXPORT_MS = 3 * 60_000;

@Injectable()
export class RunRegistry {
  readonly active = new Map<string, ActiveRun>();
  /** Projects reserved while a request is starting a run, queueing one, restoring or deleting the game. */
  private readonly reserved = new Map<string, Reservation>();
  /** The builds waiting in line, by project (mirrors QueuedRun; queue.service.ts keeps it). */
  readonly queued = new Map<string, QueuedEntry>();
  /** Told whenever a builder or a project may have come free (queue.service.ts starts the next build). */
  private readonly freed = new Set<() => void>();

  status(projectId: string): RunStatus {
    if (this.active.has(projectId)) return "running";
    if (this.queued.has(projectId)) return "queued";
    const r = this.reserved.get(projectId)?.purpose;
    return r === "export" ? "exporting" : r === "queue" ? "queued" : r === "run" ? "running" : "idle";
  }

  /** Android builds going (each holds its project with purpose "export"). */
  get exporting(): number {
    let n = 0;
    for (const r of this.reserved.values()) if (r.purpose === "export") n++;
    return n;
  }

  /** Builders free now: MAX_RUNS less the runs going and starting; an Android build (one Gradle JVM) takes two, so it and a
   * check fit under the runner's memory cap. */
  get freeBuilders(): number {
    let starting = 0;
    for (const r of this.reserved.values()) if (r.purpose === "run") starting++;
    return config.maxRuns - this.active.size - starting - 2 * this.exporting;
  }

  /** This user's builds going, starting or waiting in line. */
  runsOf(userId: string): number {
    let n = 0;
    for (const r of this.active.values()) if (r.userId === userId) n++;
    for (const r of this.reserved.values()) if ((r.purpose === "run" || r.purpose === "queue") && r.userId === userId) n++;
    for (const q of this.queued.values()) if (q.userId === userId) n++;
    return n;
  }

  /** 409 busy when the project has something going or waiting (the Android wording while it exports). */
  private assertIdle(projectId: string) {
    if (this.reserved.get(projectId)?.purpose === "export") {
      throw new ApiException(409, "busy", "This game is being built for Android right now (a few minutes). Chat again when it's done.");
    }
    if (this.queued.has(projectId) || this.reserved.get(projectId)?.purpose === "queue") {
      throw new ApiException(409, "busy", "This game's last change is waiting for its turn to be built. Wait for it, or stop it.");
    }
    if (this.active.has(projectId) || this.reserved.has(projectId)) {
      throw new ApiException(409, "busy", "This game is already being built. Wait for it to finish, or stop it.");
    }
  }

  /**
   * Claims the project for a build; throws 409 busy when the game has one going or waiting, or when the owner's plan's
   * builds at once (going or waiting: one on Free and Medium, two from High) are used. `now`: a builder is free and
   * nobody waits, so the build starts at once and the claim holds that builder until it has; otherwise the build goes
   * into the line (the claim only holds the project). Call `release` when it has started or is in the line, or failed.
   */
  claimRun(projectId: string, owner: { id: string; plan: PlanId }, what: { kind: RunKind; model: ModelChoice; effort: Effort }): { now: boolean; release: () => void } {
    this.assertIdle(projectId);
    const cap = runsAtOnce(owner.plan);
    if (this.runsOf(owner.id) >= cap) {
      throw new ApiException(
        409,
        "busy",
        cap === 1
          ? "Your plan builds one game at a time. Wait for the build that's going or waiting now, or stop it."
          : `Your plan builds ${cap} games at a time. Wait for one of yours to finish, or stop it.`,
      );
    }
    const now = this.freeBuilders > 0 && this.queued.size === 0 && ![...this.reserved.values()].some((r) => r.purpose === "queue");
    const mine: Reservation = { purpose: now ? "run" : "queue", userId: owner.id, ...what };
    this.reserved.set(projectId, mine);
    return { now, release: () => this.release(projectId, mine) };
  }

  /** Claims the project for a restore, its deletion or an Android build; throws 409 busy. Call the returned release when done. */
  reserve(projectId: string, purpose: "restore" | "delete" | "export"): () => void {
    this.assertIdle(projectId);
    const mine: Reservation = { purpose, userId: null };
    this.reserved.set(projectId, mine);
    return () => this.release(projectId, mine);
  }

  /** The queue's turn for a waiting build: out of the line and starting (it holds a builder from here). */
  take(entry: QueuedEntry): () => void {
    this.queued.delete(entry.projectId);
    const mine: Reservation = { purpose: "run", userId: entry.userId, kind: entry.kind, model: entry.model, effort: entry.effort };
    this.reserved.set(entry.projectId, mine);
    return () => this.release(entry.projectId, mine);
  }

  private release(projectId: string, mine: Reservation) {
    if (this.reserved.get(projectId) === mine) this.reserved.delete(projectId);
    this.free();
  }

  /** Something that held a builder or a project let go: the queue looks again. */
  free() {
    for (const fn of this.freed) fn();
  }

  onFree(fn: () => void): () => void {
    this.freed.add(fn);
    return () => this.freed.delete(fn);
  }

  /** Whether the project could start a build now (nothing else holds it). */
  canStart(projectId: string): boolean {
    return !this.active.has(projectId) && !this.reserved.has(projectId);
  }

  /** The line in order. */
  line(): (QueuedEntry & { id: string })[] {
    return inLine([...this.queued.values()].map((q) => ({ ...q, id: q.messageId })));
  }

  /** Every waiting build's place and rough wait, by project. */
  places(now = Date.now()): Map<string, QueuePlace> {
    const line = this.line();
    const going: Going[] = [];
    for (const r of this.active.values()) going.push({ endsAt: runEndsAt(r.startedAt, r.kind, r.model, now, r.effort), units: 1 });
    for (const r of this.reserved.values()) {
      if (r.purpose === "run") going.push({ endsAt: now + typicalMs(r.kind ?? "new", r.model ?? "fast", r.effort), units: 1 });
      else if (r.purpose === "export") going.push({ endsAt: now + EXPORT_MS, units: 2 });
    }
    const ms = waits(line, going, config.maxRuns, now);
    const limit = config.queue.waitMin * 60_000;
    return new Map(
      line.map((q, i) => [q.projectId, { ahead: i, waitMin: waitMinutes(ms[i]), lane: q.lane, leavesAt: new Date(q.turnAt + limit).toISOString() }]),
    );
  }

  /** One project's place in the line (null when it isn't waiting). */
  placeOf(projectId: string, now = Date.now()): QueuePlace | null {
    return this.queued.has(projectId) ? (this.places(now).get(projectId) ?? null) : null;
  }
}
