// Runs the game agent for a message and turns the result into a version, a charge and events.
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from "@nestjs/common";
import type { Effort, GameTag, Genre, ModelChoice, Platform, PlanId, RunEvent } from "@typeplay/shared";
import { AssetsService } from "../assets/assets.service.js";
import type { RunImage } from "../attachments/attachments.service.js";
import { prepareRunImages } from "../attachments/store.js";
import { creditsForUsd, planModels, toTenths } from "../credits/credits.js";
import { CreditsService, type CreditHold } from "../credits/credits.service.js";
import { LedgerService, TX_OPTIONS } from "../credits/ledger.service.js";
import { config } from "../env.js";
import { EventBus } from "../events/event-bus.js";
import { genreOf } from "../gallery/gallery.service.js";
import { headOf, settleFolder } from "../games/git.js";
import { readPlatformWord, readProjectGodot } from "../games/files.js";
import { exportWeb, gameNameOf, orientationOf, platformOf } from "../games/godot.js";
import { publishBuild, trimExport, unpublishBuild } from "../games/publish.js";
import type { Message, Plan, Version } from "../generated/prisma/client.js";
import { noticeOf, type EndWhy } from "../notify/notices.js";
import { PushService } from "../notify/push.service.js";
import { PrismaService } from "../prisma.js";
import { questionsOf } from "../projects/questions.js";
import { ProjectViews, toMessage, toVersion, WITH_AUTHOR } from "../projects/views.js";
import { MODEL_FLAG, runAgent, sweep, type AgentResult } from "./agent.js";
import { runFakeAgent } from "./fake-agent.js";
import { KeyProxy } from "./key-proxy.js";
import { RunRegistry, type ActiveRun } from "./registry.js";

export const projectDir = (projectId: string) => join(config.dataDir, "projects", projectId);

export interface StartRun {
  projectId: string;
  /** Who pays: the game's owner (access.service `payerOf`), charged and held for under their plan. */
  userId: string;
  /** Who asked for it (pair developing: the owner, or a member of the game): told when it ends. Left out: `userId`. */
  senderId?: string;
  messageId: string;
  kind: "new" | "edit";
  prompt: string;
  model: ModelChoice;
  effort: Effort;
  /** A first build: the screens the player picked (null: the agent picks one shape). A change keeps the game's own. */
  platform?: Platform | null;
  /** A first build: the genre the player picked (null: the agent picks one from the idea) and the tags. A change keeps the
   * game's own (its folder's GENRE and TAGS). */
  genre?: Genre | null;
  tags?: GameTag[];
  /** The pictures the player's message carries (attachments/), in their order: references for the AI, or art when asked. */
  images?: RunImage[];
  /** Questions before the build (2026-11-04): the AI may ask first (the player's "Ask me first"); the prompt ends with the
   * player's answers to questions asked before (it never asks again); a change answering them on the same AI skips the
   * size check (it ran with the questions). `label`: such a build's version label, in the player's words. */
  ask?: boolean;
  answered?: boolean;
  sized?: boolean;
  label?: string | null;
  /** TypePlay's own change to the game (`admin run`, 2026-11-07): free (nothing held or charged, nothing counted by the
   * Free kill switch), its messages by the TypePlay account; run.mjs --maintenance. */
  maintenance?: boolean;
  /** The credits held for this run (credits.service `assertCanRun`); released when it ends. */
  hold: CreditHold | null;
  /** When it started, as its message's `startedAt` says (after its time in line, if it waited). */
  startedAt: Date;
}

export const FAILED_TEXT = {
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

type Costs = Pick<AgentResult, "costUsd" | "messageCostUsd" | "suggestionsCostUsd" | "classifyCostUsd" | "sizeCheckCostUsd" | "askCostUsd">;
/**
 * The run's AI calls beside the agent's own work, each a part of the answer's charge (Luka, 10-24 and 10-29: every AI
 * call a player causes is theirs): the player-message rewrite, the next-step ideas, a new game's genre and size call,
 * a change's size check, and the questions call before a build (2026-11-04).
 */
export const sideUsd = (r: Costs) =>
  r.messageCostUsd + (r.suggestionsCostUsd ?? 0) + (r.classifyCostUsd ?? 0) + (r.sizeCheckCostUsd ?? 0) + (r.askCostUsd ?? 0);

/**
 * What a run cost us in AI, for the Free kill switch: what the agent reported, or what the key proxy metered when that is
 * more (live server). A Stop, a timeout or a crash leaves the agent without its record ($0 reported) though the model was
 * paid for, and model calls the agent's shell makes on its own are only in the meter (security review 10-20).
 */
export const aiSpentUsd = (result: Costs, metered: number | null) => Math.max(result.costUsd + sideUsd(result), metered ?? 0);

/**
 * The AI a size-check stop offers instead (packages/agent/tools/size-check.mjs): the next one up from Fast or Smart that
 * the plan the run started on has; none on Free, and none for Best, which is never checked.
 */
export function biggerModel(model: ModelChoice, plan: Plan | null): ModelChoice | null {
  const next: ModelChoice | null = model === "fast" ? "smart" : model === "smart" ? "best" : null;
  return next && planModels((plan ?? "free") as PlanId).includes(next) ? next : null;
}
/** When the folder can't be reset: wait this long between tries, then give up and mark it dirty. */
const SETTLE_RETRY_MS = [2_000, 10_000, 30_000];

/** A build's last event on its game's stream. */
type EndEvent = Extract<RunEvent, { type: "done" | "failed" }>;

/** What `ended` needs about a build that ended: its answer as written, and how it ended. */
export interface Ended {
  /** Who is told: the one who asked for the build (pair developing: the owner, or a member); null: nobody (an account
   * closed since). */
  userId: string | null;
  projectId: string;
  /** The answer's row as the end wrote it (status, text, version, the bigger AI). */
  message: Message;
  why: EndWhy;
  /** The game had no version before this build. */
  first: boolean;
  /** The game's stream event, made here (its summary and the credits are read for it); none at a start, nobody listens. */
  event?: () => Promise<EndEvent>;
}

@Injectable()
export class RunsService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger("runs");
  /** The server is stopping: a run it stops is left "running" for the next start to mark interrupted and tell the player. */
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RunRegistry,
    private readonly events: EventBus,
    private readonly views: ProjectViews,
    private readonly credits: CreditsService,
    private readonly ledger: LedgerService,
    private readonly keyProxy: KeyProxy,
    private readonly push: PushService,
    private readonly assets: AssetsService,
  ) {}

  /** Runs left "running" by a server that stopped mid-run: failed, nothing charged, folder reset, the player told. */
  async onModuleInit() {
    const stale = await this.prisma.message.findMany({ where: { status: "running" }, include: { project: true } });
    for (const m of stale) {
      // On this PC `node --watch` (npm run dev) ends the old server without its shutdown hook, so the
      // old run's agent, Godot and browser may still be on the folder: stop them before resetting it.
      if (process.platform === "win32" && !config.agentFake) sweep(projectDir(m.projectId));
      await this.settleOrMark(m.projectId, m.project.currentVersion);
      // No finishedAt: when it really ended (the server going down) isn't known, and the chat's answer shows no build time
      // rather than one that counts the time the server was down.
      const message = await this.prisma.message.update({ where: { id: m.id }, data: { status: "failed", text: FAILED_TEXT.interrupted, credits: 0 } });
      await this.ended({ userId: m.authorId, projectId: m.projectId, message, why: "interrupted", first: m.project.currentVersion == null });
    }
    if (stale.length) this.log.warn(`marked ${stale.length} interrupted run(s) as failed`);
    this.log.log(config.agentFake ? "AGENT_FAKE=1: runs are simulated" : `game agent: ${config.agentRunner}`);
  }

  /** On shutdown, stop every run (its process tree, and a re-export going on). */
  onApplicationShutdown() {
    this.stopping = true;
    for (const run of this.registry.active.values()) {
      run.cancelled = true;
      run.handle?.kill();
      run.export?.kill();
    }
  }

  /** Starts the run; the project is in `active` when this returns. */
  start(s: StartRun) {
    const { startedAt, senderId, ...rest } = s;
    const run: ActiveRun = {
      ...rest,
      senderId: senderId ?? s.userId,
      startedAt: startedAt.getTime(),
      handle: null,
      export: null,
      cancelled: false,
      timedOut: false,
      lastProgress: null,
      finished: Promise.resolve(),
    };
    this.registry.active.set(s.projectId, run);
    this.events.emit(s.projectId, { type: "started", messageId: s.messageId, model: s.model, effort: s.effort, startedAt: startedAt.toISOString() });
    run.finished = this.execute(run)
      .catch(async (e) => {
        this.log.error(`run ${s.projectId}: ${(e as Error).stack ?? e}`);
        await this.fail(run, NO_RESULT).catch((e2) => this.log.error(`fail ${s.projectId}: ${e2}`));
      })
      .finally(() => {
        run.hold?.release();
        if (this.registry.active.get(s.projectId) === run) this.registry.active.delete(s.projectId);
        this.registry.free(); // a builder is free: the next build in line starts
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

  /**
   * The one place a build's end goes out (notifications, 2026-10-29): its game's stream (the game page, BuildPill), then,
   * unless the player stopped it, the account's notice: on the account's stream (every other page of the site, the tab's
   * title and icon) and to its devices with notifications on (Web Push). Every end comes here: a run's (succeed,
   * stopTooBig, stopAsked, fail), a build that left the queue without starting (queue.service.ts), and those a restart
   * interrupted.
   * Never throws: the rows are written by now, and what can't be said is logged (a reload shows it).
   */
  async ended(e: Ended): Promise<void> {
    let name: string | null = null;
    if (e.event) {
      try {
        const event = await e.event();
        name = event.project.name;
        this.events.emit(e.projectId, event);
      } catch (err) {
        this.log.error(`end event ${e.projectId}: ${err}`);
      }
    }
    if (e.why === "stopped" || !e.userId) return;
    const told = e.userId;
    try {
      name ??= (await this.prisma.project.findUnique({ where: { id: e.projectId }, select: { name: true } }))?.name ?? null;
      if (name === null) return; // deleted meanwhile
      const notice = noticeOf({
        why: e.why,
        projectId: e.projectId,
        messageId: e.message.id,
        name,
        first: e.first,
        model: e.message.model,
        bigger: e.message.biggerModel,
        version: e.message.versionN,
        asked: questionsOf(e.message.questions)?.items.length ?? 0,
        text: e.message.text,
        timeoutMin: config.runTimeoutMin,
        at: e.message.finishedAt ?? new Date(),
      });
      this.events.notify(told, notice);
      void this.push.send(told, notice);
    } catch (err) {
      this.log.error(`notice ${e.projectId}: ${err}`);
    }
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
    // A change on Fast or Smart is sized before it is built (run.mjs): a stop offers the next AI up the run's plan has.
    const plan = run.kind === "edit" ? ((await this.prisma.message.findUnique({ where: { id: run.messageId }, select: { plan: true } }))?.plan ?? null) : null;
    const bigger = run.kind === "edit" ? biggerModel(run.model, plan) : null;
    // The pictures: on this PC copied into a private folder of the run's own (run.mjs --images reads it), removed when the
    // run ends; on the live server the runner copies them into the job's home itself (runner.mjs).
    const images = run.images ?? [];
    const imagesDir = images.length && !config.runnerSocket ? prepareRunImages(run.messageId, images, (m) => this.log.warn(`run ${run.projectId}: ${m}`)) : null;
    // AGENT_AUTH=api: a token for this run only; the key proxy adds our key (key-proxy.ts).
    const token = this.keyProxy.enabled ? this.keyProxy.issue(`run ${run.projectId}`, MODEL_FLAG[run.model], config.runTimeoutMin + 5) : null;
    const job = {
      dir,
      prompt: run.prompt,
      kind: run.kind,
      model: run.model,
      effort: run.effort,
      platform: run.kind === "new" ? (run.platform ?? null) : null,
      genre: run.kind === "new" ? (run.genre ?? null) : null,
      tags: run.kind === "new" ? (run.tags ?? []) : [],
      images,
      imagesDir,
      bigger,
      ask: !!run.ask,
      answered: !!run.answered,
      sized: !!run.sized,
      maintenance: !!run.maintenance,
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
      if (imagesDir) rmSync(imagesDir, { recursive: true, force: true });
      if (token) {
        metered = this.keyProxy.usageOf(token)?.costUsd ?? null;
        this.keyProxy.revoke(token);
      }
    });
    if (result.error) this.log.warn(`run ${run.projectId}: ${result.error}`);
    if ((result.ok || result.tooBig || result.asked) && !run.cancelled && !run.timedOut) {
      try {
        return await (result.tooBig ? this.stopTooBig(run, result, metered, bigger) : result.asked ? this.stopAsked(run, result, metered) : this.succeed(run, result, metered));
      } catch (e) {
        if (!(e instanceof CancelledLate)) this.log.error(`${result.tooBig || result.asked ? "saving the stop of" : "publishing"} ${run.projectId}: ${(e as Error).stack ?? e}`);
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
    const platform = platformOf(readPlatformWord(dir), orientation);
    // The genre skill it was built with (the GENRE file run.mjs keeps): the gallery's genre filter.
    const genre = genreOf(run.projectId);
    if (run.cancelled) throw new CancelledLate();
    // After a rolled-back step the check's pictures are of that step, not of this build: no poster.
    // The Free plan's mark goes by the owner's plan now, as the build is published (game.json `badge`).
    const badge = project.owner.plan === "free";
    const { poster } = await publishBuild({ buildId, dir, name, orientation, badge, poster: !result.staleExport });

    // The player pays for the attempts in the game they get (chargeUsd; older records: everything) and the run's
    // other AI calls (sideUsd: the player-message rewrite, the 9 next-step ideas, the genre call, the size check;
    // Luka, 10-24: every AI cost they cause is theirs), or what the key proxy metered when that is more (model calls
    // the agent's shell made itself).
    const agentUsd = (result.chargeUsd ?? result.costUsd) + sideUsd(result);
    const chargeUsd = Math.max(agentUsd, metered ?? 0);
    const costUsd = result.costUsd + sideUsd(result); // every attempt: our accounting
    // TypePlay's own change (`admin run`) is free: the cost is ours (costUsd, meteredUsd), nobody is charged.
    const credits = run.maintenance ? 0 : creditsForUsd(chargeUsd);
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
        // An answered build's label is the player's own words (the request and their answers), not the prompt the agent got.
        const version = await tx.version.create({ data: { projectId: run.projectId, n, label: run.label || run.prompt, buildId, commit, poster } });
        const message = await tx.message.update({
          where: { id: run.messageId },
          data: { status: "done", text, credits, costUsd, meteredUsd: metered, versionN: n, suggestions: result.suggestions ?? [], finishedAt: new Date() },
          include: WITH_AUTHOR,
        });
        // The kill switch's number (kept apart from the message: a deleted game's runs still count). Not TypePlay's own.
        if (message.plan === "free" && !run.maintenance) await this.ledger.addFreeSpend(tx, aiSpentUsd(result, metered));
        // A rename while this run was going wins over the game agent's name.
        const now = await tx.project.findUniqueOrThrow({ where: { id: run.projectId }, select: { renamed: true } });
        await tx.project.update({ where: { id: run.projectId }, data: { currentVersion: n, orientation, platform, genre, ...(now.renamed ? {} : { name }) } });
        if (!run.maintenance) await this.ledger.chargeIn(tx, run.userId, toTenths(credits), { messageId: run.messageId, note: `${run.kind} on ${run.model}` });
        return [message, version] as const;
      }, TX_OPTIONS);
    } catch (e) {
      if (e instanceof CancelledLate) await unpublishBuild(buildId).catch((e2) => this.log.error(`unpublish ${buildId}: ${e2}`));
      throw e;
    }
    const [message, version] = rows;
    // The version's list of assets (the Assets tab), made before the player hears it is done; it never fails the build.
    await this.assets.afterBuild(run.projectId, buildId, commit);
    trimExport(dir); // the engine files (~36 MB) are not needed once the pack is published
    this.registry.active.delete(run.projectId);
    run.hold?.release();
    this.registry.free();
    this.log.log(
      `run ${run.projectId} done: v${n}, $${chargeUsd.toFixed(3)} charged (agent $${agentUsd.toFixed(3)}, metered ${metered === null ? "n/a" : "$" + metered.toFixed(3)}), ${credits} credits`,
    );
    await this.ended({
      userId: run.senderId,
      projectId: run.projectId,
      message,
      why: "built",
      first: n === 1,
      event: async () => ({
        type: "done",
        message: toMessage(message),
        version: toVersion(version),
        project: await this.views.summary(run.projectId),
        credits: await this.creditsOf(run.userId),
      }),
    });
  }

  /**
   * The size check stopped a change too big for the AI it was sent on (run.mjs, before anything in the game folder
   * changed): no version and no reset, and the answer is its message, charged like any finished answer for the work it
   * did (the check: at least 0.1 credit, or the metered calls when more), in the ledger with the message and counted by
   * the Free kill switch. `bigger`: the AI the message offers, for the chat's one tap.
   */
  private async stopTooBig(run: ActiveRun, result: AgentResult, metered: number | null, bigger: ModelChoice | null) {
    const agentUsd = result.costUsd + sideUsd(result); // nothing was built: the check is the work
    const chargeUsd = Math.max(agentUsd, metered ?? 0);
    const credits = creditsForUsd(chargeUsd);
    const message = await this.prisma.$transaction(async (tx) => {
      // A Stop that landed meanwhile wins, as it does over a finished build: stopped, nothing charged (fail()).
      if (run.cancelled) throw new CancelledLate();
      // The user's row first (the ledger's one lock order), so the answer and its charge commit together.
      await this.ledger.lock(tx, run.userId);
      const m = await tx.message.update({
        where: { id: run.messageId },
        data: { status: "done", text: result.playerMessage!.trim(), credits, costUsd: agentUsd, meteredUsd: metered, biggerModel: bigger, finishedAt: new Date() },
        include: WITH_AUTHOR,
      });
      if (m.plan === "free") await this.ledger.addFreeSpend(tx, aiSpentUsd(result, metered));
      await this.ledger.chargeIn(tx, run.userId, toTenths(credits), { messageId: run.messageId, note: `${run.kind} on ${run.model}` });
      return m;
    }, TX_OPTIONS);
    this.registry.active.delete(run.projectId);
    run.hold?.release();
    this.registry.free();
    this.log.log(
      `run ${run.projectId} too big for ${run.model}: stopped before the build, $${chargeUsd.toFixed(4)} charged (metered ${metered === null ? "n/a" : "$" + metered.toFixed(4)}), ${credits} credits`,
    );
    await this.ended({
      userId: run.senderId,
      projectId: run.projectId,
      message,
      why: "toobig",
      first: false,
      event: async () => ({
        type: "done",
        message: toMessage(message),
        version: null,
        project: await this.views.summary(run.projectId),
        credits: await this.creditsOf(run.userId),
      }),
    });
  }

  /**
   * The AI asked before building (2026-11-04, the player's "Ask me first"; run.mjs --ask): nothing was built. The answer
   * is its line and the questions, charged at once like the size check's stop for the calls the run made (the questions
   * call, and the genre call or the size check beside it: at least 0.1 credit, or the metered calls when more), in the
   * ledger with the message and counted by the Free kill switch; an answer never given costs nothing more. A new game's
   * folder held only the template run.mjs made before it asked: cleared (it has no version). The player's next message
   * is their answer (projects.service), and that build never asks again.
   */
  private async stopAsked(run: ActiveRun, result: AgentResult, metered: number | null) {
    const asked = result.asked!;
    const agentUsd = result.costUsd + sideUsd(result); // nothing was built: the calls are the work
    const chargeUsd = Math.max(agentUsd, metered ?? 0);
    const credits = creditsForUsd(chargeUsd);
    const { decide, own, lang } = asked.questions;
    const questions = {
      decide,
      ...(own ? { own } : {}),
      ...(lang ? { lang } : {}),
      items: asked.questions.items.map(({ label, text, options }) => ({ label, text, options })),
    };
    const message = await this.prisma.$transaction(async (tx) => {
      // A Stop that landed meanwhile wins, as it does over a finished build: stopped, nothing charged (fail()).
      if (run.cancelled) throw new CancelledLate();
      // The user's row first (the ledger's one lock order), so the answer and its charge commit together.
      await this.ledger.lock(tx, run.userId);
      const m = await tx.message.update({
        where: { id: run.messageId },
        data: { status: "done", text: asked.intro, questions, credits, costUsd: agentUsd, meteredUsd: metered, finishedAt: new Date() },
        include: WITH_AUTHOR,
      });
      if (m.plan === "free") await this.ledger.addFreeSpend(tx, aiSpentUsd(result, metered));
      await this.ledger.chargeIn(tx, run.userId, toTenths(credits), { messageId: run.messageId, note: `${run.kind} on ${run.model}` });
      return m;
    }, TX_OPTIONS);
    if (run.kind === "new") {
      const project = await this.prisma.project.findUnique({ where: { id: run.projectId }, select: { currentVersion: true } });
      if (project) await this.settleOrMark(run.projectId, project.currentVersion);
    }
    this.registry.active.delete(run.projectId);
    run.hold?.release();
    this.registry.free();
    this.log.log(
      `run ${run.projectId} asked ${asked.questions.items.length} question(s) before the build: $${chargeUsd.toFixed(4)} charged (metered ${metered === null ? "n/a" : "$" + metered.toFixed(4)}), ${credits} credits`,
    );
    await this.ended({
      userId: run.senderId,
      projectId: run.projectId,
      message,
      why: "asked",
      first: run.kind === "new",
      event: async () => ({
        type: "done",
        message: toMessage(message),
        version: null,
        project: await this.views.summary(run.projectId),
        credits: await this.creditsOf(run.userId),
      }),
    });
  }

  /** Failed, refused, cancelled or timed out: nothing charged, the game back at its last version. */
  private async fail(run: ActiveRun, result: AgentResult, metered: number | null = null, why: keyof typeof FAILED_TEXT | null = null) {
    // Stopped by the server going down (a deploy): not the player's Stop. Left "running", so the next start marks it
    // interrupted, resets the folder and tells the player (onModuleInit); the database may be gone by now anyway.
    if (this.stopping) return;
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
      data: {
        status: refused ? "refused" : "failed",
        text,
        credits: 0,
        costUsd: result.costUsd + sideUsd(result),
        meteredUsd: metered,
        finishedAt: new Date(),
      },
      include: WITH_AUTHOR,
    });
    // Failed runs count towards the Free kill switch too (the AI was paid for): a Stop's or a timeout's metered calls included.
    if (message.plan === "free" && !run.maintenance) await this.ledger.addFreeSpend(this.prisma, aiSpentUsd(result, metered)).catch((e) => this.log.error(`free spend ${run.projectId}: ${e}`));
    this.registry.active.delete(run.projectId);
    run.hold?.release();
    this.registry.free();
    this.log.log(`run ${run.projectId} ${why ?? (run.cancelled ? "cancelled" : refused ? "refused" : "failed")}`);
    await this.ended({
      userId: run.senderId,
      projectId: run.projectId,
      message,
      // A Stop (or the game or the account deleted meanwhile) wins over how far the run got, as the text above says.
      why: why ? "failed" : run.cancelled ? "stopped" : run.timedOut ? "timeout" : refused ? "refused" : "failed",
      first: project.currentVersion == null,
      event: async () => ({
        type: "failed",
        message: toMessage(message),
        project: await this.views.summary(run.projectId),
        credits: await this.creditsOf(run.userId),
      }),
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
