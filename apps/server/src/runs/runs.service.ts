// Runs the game agent for a message and turns the result into a version, a charge and events.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { Effort, ModelChoice } from "@typeplay/shared";
import { creditsForUsd, toTenths } from "../credits/credits.js";
import { CreditsService, type CreditHold } from "../credits/credits.service.js";
import { LedgerService, TX_OPTIONS } from "../credits/ledger.service.js";
import { config } from "../env.js";
import { EventBus } from "../events/event-bus.js";
import { headOf, settleFolder } from "../games/git.js";
import { readProjectGodot } from "../games/files.js";
import { exportWeb, gameNameOf, orientationOf } from "../games/godot.js";
import { publishBuild, trimExport, unpublishBuild } from "../games/publish.js";
import type { Message, Version } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { ProjectViews, toMessage, toVersion } from "../projects/views.js";
import { MODEL_FLAG, runAgent, sweep, type AgentResult } from "./agent.js";
import { runFakeAgent } from "./fake-agent.js";
import { KeyProxy } from "./key-proxy.js";
import { RunRegistry, type ActiveRun } from "./registry.js";

export const projectDir = (projectId: string) => join(config.dataDir, "projects", projectId);

export interface StartRun {
  projectId: string;
  userId: string;
  messageId: string;
  kind: "new" | "edit";
  prompt: string;
  model: ModelChoice;
  effort: Effort;
  /** The credits held for this run (credits.service `assertCanRun`); released when it ends. */
  hold: CreditHold | null;
}

const FAILED_TEXT = {
  new: "I couldn't build that game this time. Nothing was charged. Try again, maybe in other words.",
  edit: "I couldn't get that change working, so your game is unchanged. Nothing was charged. Try again, maybe in other words.",
  refused: "I can't make that one. Try a different idea. Nothing was charged.",
  cancelled: "Stopped. Your game is unchanged, and nothing was charged.",
  timedOut: "This took too long, so I stopped it. Your game is unchanged, and nothing was charged.",
  interrupted: "This build was interrupted. Your game is unchanged, and nothing was charged.",
  dirty: "Your game's files couldn't be put back in order after the last build, so nothing was built. Nothing was charged. Try again in a minute.",
};

/** A Stop that landed after the agent had finished but before the version was saved: no charge. */
class CancelledLate extends Error {
  constructor() {
    super("cancelled after the agent finished");
  }
}

const NO_RESULT: AgentResult = { ok: false, costUsd: 0, messageCostUsd: 0, chargeUsd: 0 };

/**
 * What a run cost us in AI, for the Free kill switch: what the agent reported, or what the key proxy metered when that is
 * more (live server). A Stop, a timeout or a crash leaves the agent without its record ($0 reported) though the model was
 * paid for, and model calls the agent's shell makes on its own are only in the meter (security review 10-20).
 */
export const aiSpentUsd = (result: Pick<AgentResult, "costUsd" | "messageCostUsd" | "suggestionsCostUsd">, metered: number | null) =>
  Math.max(result.costUsd + result.messageCostUsd + (result.suggestionsCostUsd ?? 0), metered ?? 0);
/** When the folder can't be reset: wait this long between tries, then give up and mark it dirty. */
const SETTLE_RETRY_MS = [2_000, 10_000, 30_000];

@Injectable()
export class RunsService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("runs");

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RunRegistry,
    private readonly events: EventBus,
    private readonly views: ProjectViews,
    private readonly credits: CreditsService,
    private readonly ledger: LedgerService,
    private readonly keyProxy: KeyProxy,
  ) {}

  /** Runs left "running" by a server that stopped mid-run: failed, nothing charged, folder reset. */
  async onModuleInit() {
    const stale = await this.prisma.message.findMany({ where: { status: "running" }, include: { project: true } });
    for (const m of stale) {
      // On this PC `node --watch` (npm run dev) ends the old server without its shutdown hook, so the
      // old run's agent, Godot and browser may still be on the folder: stop them before resetting it.
      if (process.platform === "win32" && !config.agentFake) sweep(projectDir(m.projectId));
      await this.settleOrMark(m.projectId, m.project.currentVersion);
      await this.prisma.message.update({ where: { id: m.id }, data: { status: "failed", text: FAILED_TEXT.interrupted, credits: 0 } });
    }
    if (stale.length) this.log.warn(`marked ${stale.length} interrupted run(s) as failed`);
    this.log.log(config.agentFake ? "AGENT_FAKE=1: runs are simulated" : `game agent: ${config.agentRunner}`);
  }

  /** On shutdown, stop every run (its process tree, and a re-export going on). */
  onApplicationShutdown() {
    for (const run of this.registry.active.values()) {
      run.cancelled = true;
      run.handle?.kill();
      run.export?.kill();
    }
  }

  /** Starts the run; the project is in `active` when this returns. */
  start(s: StartRun) {
    const run: ActiveRun = { ...s, handle: null, export: null, cancelled: false, timedOut: false, lastProgress: null, finished: Promise.resolve() };
    this.registry.active.set(s.projectId, run);
    this.events.emit(s.projectId, { type: "started", messageId: s.messageId, model: s.model, effort: s.effort });
    run.finished = this.execute(run)
      .catch(async (e) => {
        this.log.error(`run ${s.projectId}: ${(e as Error).stack ?? e}`);
        await this.fail(run, NO_RESULT).catch((e2) => this.log.error(`fail ${s.projectId}: ${e2}`));
      })
      .finally(() => {
        run.hold?.release();
        if (this.registry.active.get(s.projectId) === run) this.registry.active.delete(s.projectId);
      });
  }

  /** Stops the project's run, if any, and waits until the game is back at its last version. */
  async cancel(projectId: string) {
    const run = this.registry.active.get(projectId);
    if (!run) return;
    run.cancelled = true;
    run.handle?.kill();
    run.export?.kill();
    await run.finished;
  }

  /** A dirty project (a failed run's reset failed, `Project.dirty`): the folder back in order now, or throws. */
  async settleIfDirty(projectId: string) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    if (!project.dirty) return;
    await this.settle(projectId, project.currentVersion);
    await this.prisma.project.update({ where: { id: projectId }, data: { dirty: false } });
    this.log.log(`project ${projectId}: folder back in order`);
  }

  private async execute(run: ActiveRun) {
    const dir = projectDir(run.projectId);
    // Nothing builds on a folder a failed run could not reset: put it right first, or stop here.
    try {
      await this.settleIfDirty(run.projectId);
    } catch (e) {
      this.log.error(`run ${run.projectId}: folder still dirty: ${e}`);
      return this.fail(run, NO_RESULT, null, "dirty");
    }
    // A first build always starts clean (on the live server the runner clears the folder itself).
    if (run.kind === "new" && !config.runnerSocket) rmSync(dir, { recursive: true, force: true });
    // AGENT_AUTH=api: a token for this run only; the key proxy adds our key (key-proxy.ts).
    const token = this.keyProxy.enabled ? this.keyProxy.issue(`run ${run.projectId}`, MODEL_FLAG[run.model], config.runTimeoutMin + 5) : null;
    const job = {
      dir,
      prompt: run.prompt,
      kind: run.kind,
      model: run.model,
      effort: run.effort,
      logFile: join(config.dataDir, "logs", `${run.projectId}-${run.messageId}.log`),
      onProgress: (text: string) => {
        const e = { type: "progress" as const, messageId: run.messageId, text, at: new Date().toISOString() };
        run.lastProgress = e;
        this.events.emit(run.projectId, e);
      },
      auth: token ? { baseUrl: config.keyProxy.url, token } : undefined,
    };
    run.handle = (config.agentFake ? runFakeAgent : runAgent)(job);
    if (run.cancelled) run.handle.kill(); // cancelled while starting
    const timer = setTimeout(() => {
      run.timedOut = true;
      run.handle?.kill();
    }, config.runTimeoutMin * 60_000);
    // What the key proxy metered for this run (live server); null on Luka's PC (the Max login, no proxy).
    let metered: number | null = null;
    const result = await run.handle.done.finally(() => {
      clearTimeout(timer);
      if (token) {
        metered = this.keyProxy.usageOf(token)?.costUsd ?? null;
        this.keyProxy.revoke(token);
      }
    });
    if (result.error) this.log.warn(`run ${run.projectId}: ${result.error}`);
    if (result.ok && !run.cancelled && !run.timedOut) {
      try {
        return await this.succeed(run, result, metered);
      } catch (e) {
        if (!(e instanceof CancelledLate)) this.log.error(`publishing ${run.projectId}: ${(e as Error).stack ?? e}`);
      }
    }
    await this.fail(run, result, metered);
  }

  private async succeed(run: ActiveRun, result: AgentResult, metered: number | null) {
    const dir = projectDir(run.projectId);
    if (result.staleExport) {
      // Tracked on the run, so a Stop or a server shutdown kills Godot too (godot.ts caps its time).
      run.export = exportWeb(dir);
      const fresh = await run.export.done.finally(() => (run.export = null));
      if (run.cancelled) throw new CancelledLate();
      if (!fresh) throw new Error("re-export failed");
    }
    const pck = join(dir, "export/web/index.pck");
    if (!existsSync(pck)) throw new Error("no web export after a successful run");
    const commit = await headOf(dir);
    const projectGodot = readProjectGodot(dir);
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: run.projectId }, include: { owner: { select: { plan: true } } } });
    const last = await this.prisma.version.findFirst({ where: { projectId: run.projectId }, orderBy: { n: "desc" } });
    const n = (last?.n ?? 0) + 1;
    const buildId = `${run.projectId}-v${n}`;
    const name = project.renamed ? project.name : (gameNameOf(projectGodot) ?? project.name);
    const orientation = orientationOf(projectGodot);
    if (run.cancelled) throw new CancelledLate();
    // After a rolled-back step the check's pictures are of that step, not of this build: no poster.
    // The Free plan's mark goes by the owner's plan now, as the build is published (game.json `badge`).
    const badge = project.owner.plan === "free";
    const { poster } = await publishBuild({ buildId, dir, name, orientation, badge, poster: !result.staleExport });

    // The player pays for the attempts in the game they get (chargeUsd; older records: everything), the
    // player-message rewrite and the 9 next-step ideas (Luka, 10-24: every AI cost they cause is theirs),
    // or what the key proxy metered when that is more (model calls the agent's shell made itself).
    const suggestionsUsd = result.suggestionsCostUsd ?? 0;
    const agentUsd = (result.chargeUsd ?? result.costUsd) + result.messageCostUsd + suggestionsUsd;
    const chargeUsd = Math.max(agentUsd, metered ?? 0);
    const costUsd = result.costUsd + result.messageCostUsd + suggestionsUsd; // every attempt: our accounting
    const credits = creditsForUsd(chargeUsd);
    const text = result.playerMessage?.trim() || "Your game is ready. Press play!";
    // Fake runs only: a prompt with "SLOW" publishes slowly, so the e2e test can land a Stop here.
    if (config.agentFake && run.prompt.includes("SLOW")) await sleep(3000);
    let rows: readonly [Message, Version];
    try {
      rows = await this.prisma.$transaction(async (tx) => {
        // A Stop that landed while the build was being published: no version, no charge.
        if (run.cancelled) throw new CancelledLate();
        // The user's row first (the ledger's one lock order), so the version, the message, the
        // project and the charge commit together and nothing else moves the credits meanwhile.
        await this.ledger.lock(tx, run.userId);
        const version = await tx.version.create({ data: { projectId: run.projectId, n, label: run.prompt, buildId, commit, poster } });
        const message = await tx.message.update({
          where: { id: run.messageId },
          data: { status: "done", text, credits, costUsd, meteredUsd: metered, versionN: n, suggestions: result.suggestions ?? [] },
        });
        // The kill switch's number (kept apart from the message: a deleted game's runs still count).
        if (message.plan === "free") await this.ledger.addFreeSpend(tx, aiSpentUsd(result, metered));
        // A rename while this run was going wins over the game agent's name.
        const now = await tx.project.findUniqueOrThrow({ where: { id: run.projectId }, select: { renamed: true } });
        await tx.project.update({ where: { id: run.projectId }, data: { currentVersion: n, orientation, ...(now.renamed ? {} : { name }) } });
        await this.ledger.chargeIn(tx, run.userId, toTenths(credits), { messageId: run.messageId, note: `${run.kind} on ${run.model}` });
        return [message, version] as const;
      }, TX_OPTIONS);
    } catch (e) {
      if (e instanceof CancelledLate) await unpublishBuild(buildId).catch((e2) => this.log.error(`unpublish ${buildId}: ${e2}`));
      throw e;
    }
    const [message, version] = rows;
    trimExport(dir); // the engine files (~36 MB) are not needed once the pack is published
    this.registry.active.delete(run.projectId);
    run.hold?.release();
    this.log.log(
      `run ${run.projectId} done: v${n}, $${chargeUsd.toFixed(3)} charged (agent $${agentUsd.toFixed(3)}, metered ${metered === null ? "n/a" : "$" + metered.toFixed(3)}), ${credits} credits`,
    );
    try {
      this.events.emit(run.projectId, {
        type: "done",
        message: toMessage(message),
        version: toVersion(version),
        project: await this.views.summary(run.projectId),
        credits: await this.creditsOf(run.userId),
      });
    } catch (e) {
      this.log.error(`done event ${run.projectId}: ${e}`); // the version is saved; a reload shows it
    }
  }

  /** Failed, refused, cancelled or timed out: nothing charged, the game back at its last version. */
  private async fail(run: ActiveRun, result: AgentResult, metered: number | null = null, why: keyof typeof FAILED_TEXT | null = null) {
    const project = await this.prisma.project.findUniqueOrThrow({ where: { id: run.projectId } });
    if (why !== "dirty") await this.settleOrMark(run.projectId, project.currentVersion);
    const refused = !!result.refused && !run.cancelled && !run.timedOut;
    const text = why
      ? FAILED_TEXT[why]
      : run.cancelled
        ? FAILED_TEXT.cancelled
        : run.timedOut
          ? FAILED_TEXT.timedOut
          : refused
            ? FAILED_TEXT.refused
            : project.currentVersion == null
              ? FAILED_TEXT.new
              : FAILED_TEXT.edit;
    const message = await this.prisma.message.update({
      where: { id: run.messageId },
      data: { status: refused ? "refused" : "failed", text, credits: 0, costUsd: result.costUsd + result.messageCostUsd + (result.suggestionsCostUsd ?? 0), meteredUsd: metered },
    });
    // Failed runs count towards the Free kill switch too (the AI was paid for): a Stop's or a timeout's metered calls included.
    if (message.plan === "free") await this.ledger.addFreeSpend(this.prisma, aiSpentUsd(result, metered)).catch((e) => this.log.error(`free spend ${run.projectId}: ${e}`));
    this.registry.active.delete(run.projectId);
    run.hold?.release();
    this.log.log(`run ${run.projectId} ${why ?? (run.cancelled ? "cancelled" : refused ? "refused" : "failed")}`);
    this.events.emit(run.projectId, {
      type: "failed",
      message: toMessage(message),
      project: await this.views.summary(run.projectId),
      credits: await this.creditsOf(run.userId),
    });
  }

  /** The game folder back at the project's current version (deleted when there is none yet). */
  private async settle(projectId: string, currentVersion: number | null) {
    const v = currentVersion == null ? null : await this.prisma.version.findUnique({ where: { projectId_n: { projectId, n: currentVersion } } });
    await settleFolder(projectDir(projectId), v?.commit ?? null);
  }

  /**
   * settle(), tried again a few times (the runner restarting, a file still held); when it still
   * fails the project is marked dirty, so the next run or download settles it first and nothing is
   * built on half-written files. Never throws.
   */
  private async settleOrMark(projectId: string, currentVersion: number | null): Promise<void> {
    for (let i = 0; ; i++) {
      try {
        await this.settle(projectId, currentVersion);
        return;
      } catch (e) {
        if (i < SETTLE_RETRY_MS.length) {
          this.log.warn(`reset ${projectId}: ${e}; trying again in ${SETTLE_RETRY_MS[i] / 1000} s`);
          await sleep(SETTLE_RETRY_MS[i]);
          continue;
        }
        this.log.error(`reset ${projectId} failed for good, marked dirty: ${e}`);
        await this.prisma.project.update({ where: { id: projectId }, data: { dirty: true } }).catch((e2) => this.log.error(`mark dirty ${projectId}: ${e2}`));
        return;
      }
    }
  }

  private async creditsOf(userId: string) {
    return this.credits.balance(await this.prisma.user.findUniqueOrThrow({ where: { id: userId } }));
  }
}
