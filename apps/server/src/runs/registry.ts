// Which projects have a run (or a restore, or an Android build) going: one per project, at most
// MAX_RUNS runs at once, and per user as many as their plan allows (credits.ts `runsAtOnce`).
import { Injectable } from "@nestjs/common";
import type { Effort, ModelChoice, PlanId, RunEvent, RunStatus } from "@typeplay/shared";
import { ApiException } from "../common/api-error.js";
import { runsAtOnce } from "../credits/credits.js";
import type { CreditHold } from "../credits/credits.service.js";
import { config } from "../env.js";
import type { AgentHandle } from "./agent.js";
import type { ExportHandle } from "../games/godot.js";

export interface ActiveRun {
  projectId: string;
  messageId: string;
  userId: string;
  kind: "new" | "edit";
  prompt: string;
  model: ModelChoice;
  effort: Effort;
  /** The credits held for this run while it goes (released when its charge or failure is written). */
  hold: CreditHold | null;
  handle: AgentHandle | null;
  /** The re-export after a rolled-back last step (succeed()): cancel and shutdown must reach it too. */
  export: ExportHandle | null;
  cancelled: boolean;
  timedOut: boolean;
  lastProgress: Extract<RunEvent, { type: "progress" }> | null;
  /** Settles when the run is fully finished (folder settled, rows written, event sent). */
  finished: Promise<void>;
}

/** export: an Android build (android/android.service.ts) holds the project for its whole run; ideas: "More ideas" (a few seconds). */
type Purpose = "run" | "restore" | "delete" | "export" | "ideas";

@Injectable()
export class RunRegistry {
  readonly active = new Map<string, ActiveRun>();
  /** Projects reserved while a request is starting a run, restoring or deleting the game. */
  private readonly reserved = new Map<string, { purpose: Purpose; userId: string | null }>();

  status(projectId: string): RunStatus {
    if (this.active.has(projectId)) return "running";
    return this.reserved.get(projectId)?.purpose === "export" ? "exporting" : "idle";
  }

  /** Android builds going (each holds its project with purpose "export"). */
  get exporting(): number {
    let n = 0;
    for (const r of this.reserved.values()) if (r.purpose === "export") n++;
    return n;
  }

  /** This user's runs going or starting. */
  runsOf(userId: string): number {
    let n = 0;
    for (const r of this.active.values()) if (r.userId === userId) n++;
    for (const r of this.reserved.values()) if (r.purpose === "run" && r.userId === userId) n++;
    return n;
  }

  /**
   * Claims the project for a run, a restore or its deletion; throws 409 busy. A run also counts
   * against the owner's plan (one at a time on Free and Medium, two from High) and MAX_RUNS.
   * Call the returned release when done.
   */
  reserve(projectId: string, purpose: Purpose, owner?: { id: string; plan: PlanId }): () => void {
    if (this.reserved.get(projectId)?.purpose === "export") {
      throw new ApiException(409, "busy", "This game is being built for Android right now (a few minutes). Chat again when it's done.");
    }
    if (this.reserved.get(projectId)?.purpose === "ideas") {
      throw new ApiException(409, "busy", "Getting more ideas for this game: try again in a few seconds.");
    }
    if (this.active.has(projectId) || this.reserved.has(projectId)) {
      throw new ApiException(409, "busy", "This game is already being built. Wait for it to finish, or stop it.");
    }
    if (purpose === "run" && owner) {
      const cap = runsAtOnce(owner.plan);
      if (this.runsOf(owner.id) >= cap) {
        throw new ApiException(
          409,
          "busy",
          cap === 1
            ? "Your plan builds one game at a time. Wait for the build that's going now, or stop it."
            : `Your plan builds ${cap} games at a time. Wait for one of yours to finish, or stop it.`,
        );
      }
    }
    const starting = [...this.reserved.values()].filter((r) => r.purpose === "run").length;
    // An Android build (one Gradle JVM) weighs two run slots, so it and a check fit under the runner's memory cap.
    if (purpose === "run" && this.active.size + starting + 2 * this.exporting >= config.maxRuns) {
      throw new ApiException(409, "busy", "TypePlay is building as many games as it can right now. Try again in a minute.");
    }
    this.reserved.set(projectId, { purpose, userId: owner?.id ?? null });
    return () => this.reserved.delete(projectId);
  }
}
