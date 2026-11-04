// Projects: create (and start the first build, or put it in line), send a change, restore a version, cancel a run;
// rename, share, download and delete a game. Pair developing (2026-11-04): a game's members send, restore, rename,
// download and stop their own builds too (access.service decides who may), and every change is paid by the owner.
import { randomInt, randomUUID } from "node:crypto";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import type { Effort, Genre, ModelChoice, PlanId, Platform, Project as ProjectView } from "@typeplay/shared";
import { AccessService, ownerOnly, payerOf, PERSON, personOf } from "../access/access.service.js";
import { AndroidService } from "../android/android.service.js";
import { removeGameAssets } from "../assets/store.js";
import { AttachmentsService } from "../attachments/attachments.service.js";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import { config } from "../env.js";
import { genreOf } from "../gallery/gallery.service.js";
import { projectZip, TooBig } from "../games/download.js";
import { unpublishBuild } from "../games/publish.js";
import { MODELS } from "../credits/credits.js";
import { CreditsService, type CreditHold } from "../credits/credits.service.js";
import type { User } from "../generated/prisma/client.js";
import { readPlatformWord, readProjectGodot } from "../games/files.js";
import { removeFolder, restoreCommit, settleFolder } from "../games/git.js";
import { orientationOf, platformOf } from "../games/godot.js";
import { parsePicks, picksOf } from "../games/picks.js";
import { PrismaService } from "../prisma.js";
import { BuildQueue, type QueuedRunData } from "../runs/queue.service.js";
import { RunRegistry } from "../runs/registry.js";
import { projectDir, RunsService } from "../runs/runs.service.js";
import { parseAnswers, questionsOf, replyTo } from "./questions.js";
import { ProjectViews } from "./views.js";

const EFFORTS: Effort[] = ["low", "medium", "high"];
const MAX_PROMPT = 4000;

export interface RunRequest {
  text: string;
  model: ModelChoice;
  effort: Effort;
  confirm: boolean;
}

/** Checks a create/message body: the sentence, the model the user picked, effort, confirm. `textOptional`: a message
 * answering questions with `answers` (the API writes its words from them). */
export function parseRunBody(body: unknown, textKey: "prompt" | "text", textOptional = false): RunRequest {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const text = typeof b[textKey] === "string" ? (b[textKey] as string).trim() : "";
  if (!text && !textOptional) throw badRequest("Type what you want first.");
  if (text.length > MAX_PROMPT) throw badRequest(`That's too long: keep it under ${MAX_PROMPT} characters.`);
  if (!MODELS.includes(b.model as ModelChoice)) throw badRequest("Pick Fast, Smart or Best.");
  if (b.effort !== undefined && !EFFORTS.includes(b.effort as Effort)) throw badRequest("Effort is low, medium or high.");
  return { text, model: b.model as ModelChoice, effort: (b.effort as Effort) ?? "medium", confirm: b.confirm === true };
}

/** "Ask me first" (2026-11-04): the AI may ask before it builds. true or false; left out, false (an older site never asks). */
export function parseAsk(body: unknown): boolean {
  const a = body && typeof body === "object" ? (body as Record<string, unknown>).ask : undefined;
  if (a === undefined || a === null) return false;
  if (typeof a !== "boolean") throw badRequest("ask is true or false.");
  return a;
}

/** The longest request a build may get with the questions and the answer (the runner takes 8,000 letters an argument). */
const MAX_COMPOSED = 7900;

const PLATFORMS: Platform[] = ["phone", "computer", "fill"];
/** The new-game screen's pick of screens; left out: the agent picks one shape. */
export function parsePlatform(body: unknown): Platform | null {
  const p = body && typeof body === "object" ? (body as Record<string, unknown>).platform : undefined;
  if (p === undefined || p === null) return null;
  if (!PLATFORMS.includes(p as Platform)) throw badRequest("Pick phone, computer or every screen.");
  return p as Platform;
}

/** Who a run is for: the registry caps runs going or waiting per user by plan. */
const ownerOf = (user: User) => ({ id: user.id, plan: user.plan as PlanId });

/** A short lowercase random id, used in URLs and build ids. */
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
export const newProjectId = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

/** Until the agent names the game: the first words of the prompt, at most 40 characters. */
export function nameFromPrompt(prompt: string): string {
  let name = "";
  for (const word of prompt.replace(/\s+/g, " ").trim().split(" ")) {
    if ((name + " " + word).trim().length > 40) break;
    name = (name + " " + word).trim();
  }
  name = (name || prompt.trim().slice(0, 40)).replace(/[\s,.;:!?-]+$/, "");
  return name.charAt(0).toUpperCase() + name.slice(1) || "My game";
}

/** A name the player typed: one line, 1-60 letters (emoji and every script are fine). */
export function cleanName(raw: unknown): string {
  if (typeof raw !== "string") throw badRequest("Type a name for the game.");
  const name = raw.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();
  if (!name) throw badRequest("Type a name for the game.");
  if ([...name].length > 60) throw badRequest("That name is too long: keep it under 60 letters.");
  return name;
}

@Injectable()
export class ProjectsService {
  private readonly log = new Logger("projects");

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RunRegistry,
    private readonly runs: RunsService,
    private readonly queue: BuildQueue,
    private readonly views: ProjectViews,
    private readonly credits: CreditsService,
    private readonly android: AndroidService,
    private readonly attachments: AttachmentsService,
    private readonly access: AccessService,
  ) {}

  /** The account that pays for a game's builds (its owner: access.service `payerOf`), with anything due settled. */
  private async payerRow(project: { ownerId: string }): Promise<User> {
    return this.credits.settled(await this.prisma.user.findUniqueOrThrow({ where: { id: payerOf(project) } }));
  }

  /**
   * Claims the game for a build paid by `payer`. A 409 while someone else in the game has a build going or waiting says
   * whose (pair developing); a member's 409 for the owner's plan's builds at once says it is the owner's plan.
   */
  private async claim(projectId: string, payer: User, sender: User, what: { kind: "new" | "edit"; model: ModelChoice; effort: Effort }) {
    try {
      return this.registry.claimRun(projectId, ownerOf(payer), { ...what, senderId: sender.id });
    } catch (e) {
      if (!(e instanceof ApiException) || e.code !== "busy") throw e;
      const other = this.registry.senderOf(projectId);
      if (other && other !== sender.id) {
        const who = await this.prisma.user.findUnique({ where: { id: other }, select: PERSON });
        throw new ApiException(409, "busy", `${who ? personOf(who).name : "Someone"}'s change to this game is being built now. Send yours when it's done.`);
      }
      if (!other && payer.id !== sender.id && this.registry.status(projectId) === "idle") {
        throw new ApiException(409, "busy", `${personOf(payer).name}'s plan is building as many games at once as it can right now. Send this when one is done.`);
      }
      throw e;
    }
  }

  async create(user: User, body: unknown): Promise<ProjectView> {
    const req = parseRunBody(body, "prompt");
    const ask = parseAsk(body); // "Ask me first": the run may ask before it builds (questions.ts)
    const platform = parsePlatform(body);
    const { genre, tags } = parsePicks(body);
    // The pictures the player attached (uploaded already, POST /attachments): checked before anything is written.
    const picked = await this.attachments.pick(user, (body as { images?: unknown } | null)?.images, null);
    const id = newProjectId();
    // A builder is free: it starts at once. All busy: it waits in line (runs/queue.service.ts).
    const claim = this.registry.claimRun(id, ownerOf(user), { kind: "new", model: req.model, effort: req.effort });
    let hold: CreditHold | null = null; // the run's credits, until the run (or the line) owns them
    let undo: (() => void) | null = null; // copies of pictures sent again, until their rows are written
    try {
      hold = await this.credits.assertCanRun(user, "new", req.model, req.confirm, req.effort);
      const now = Date.now();
      const sent = new Date(now + 1);
      const prepared = this.attachments.prepare(picked);
      undo = prepared.undo;
      const asked = randomUUID(); // the player's message, which owns the pictures
      const queued = claim.now
        ? null
        : this.queue.rowFor({ projectId: id, userId: user.id, kind: "new", prompt: req.text, platform, genre, tags, images: prepared.images.map((i) => i.id), ask, plan: user.plan, hold, at: sent });
      const { project, images } = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            id,
            ownerId: user.id,
            name: nameFromPrompt(req.text),
            platform,
            pickedGenre: genre,
            tags,
            messages: {
              create: [
                { id: asked, role: "user", text: req.text, authorId: user.id, createdAt: new Date(now) },
                { ...this.agentMessage(user, req, sent, queued), authorId: user.id, createdAt: sent },
              ],
            },
          },
          include: { messages: { where: { role: "agent" } } },
        });
        return { project, images: await this.attachments.attachIn(tx, user.id, asked, prepared) };
      });
      undo = null;
      const messageId = project.messages[0].id;
      if (queued) this.queue.added({ ...queued, messageId }, req.model, req.effort, hold, user.id);
      else this.runs.start({ projectId: id, userId: user.id, messageId, kind: "new", prompt: req.text, model: req.model, effort: req.effort, platform, genre, tags, images, ask, hold, startedAt: sent });
      hold = null;
    } finally {
      undo?.();
      hold?.release();
      claim.release();
    }
    return this.views.full(id, user.id);
  }

  /**
   * The game's open questions (2026-11-04): its newest message is an answer that asked (status done, with questions).
   * With the request they were about (the player's message before it: its words and its pictures, in their order) and
   * the AI and effort it was sent on. Null when none are open.
   */
  private async openQuestions(projectId: string) {
    const [last, before] = await this.prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 2,
      include: { attachments: { select: { id: true, position: true } }, author: { select: PERSON } },
    });
    if (last?.role !== "agent" || last.status !== "done" || before?.role !== "user") return null;
    const questions = questionsOf(last.questions);
    if (!questions) return null;
    const images = [...before.attachments].sort((a, b) => a.position - b.position).map((a) => a.id);
    // Who asked (pair developing): only they answer; null, someone who has closed their account since.
    const askedBy = before.author ? { id: before.author.id, name: personOf(before.author).name } : null;
    return { questions, request: before.text, images, model: last.model, effort: last.effort ?? "medium", askedBy };
  }

  async send(user: User, id: string, body: unknown): Promise<ProjectView> {
    const { project, role } = await this.access.game(user.id, id, "edit");
    // Who pays: the game's owner, under the owner's plan, whoever in the game sends it (pair developing).
    const payer = role === "owner" ? user : await this.payerRow(project);
    const paidBy = role === "owner" ? undefined : personOf(payer).name;
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    // Questions open (the game's newest answer asked them, 2026-11-04): this message is their answer, tapped (`answers`)
    // or typed. The build gets the request they were about, the questions and the answer (questions.ts), and never asks
    // again: the AI asks once per request. Only the one who asked answers them: anyone else's message is a new request.
    const found = await this.openQuestions(project.id);
    const open = found && found.askedBy?.id === user.id ? found : null;
    if (b.answers !== undefined && b.answers !== null && !open) {
      throw badRequest(found ? `Only ${found.askedBy?.name ?? "the one who asked"} can answer these questions.` : "Those questions were answered already.");
    }
    const answers = open && b.answers !== undefined && b.answers !== null ? parseAnswers(b.answers, open.questions.items.length) : null;
    const req = parseRunBody(body, "text", !!answers);
    const reply = open ? replyTo(open.request, open.questions, { answers, text: req.text }) : null;
    if (reply && reply.prompt.length > MAX_COMPOSED) throw badRequest("With the first message and the questions that's too long: keep your answer shorter.");
    const text = reply?.text ?? req.text; // the player's message in the chat
    const prompt = reply?.prompt ?? req.text; // what the build gets
    const ask = reply ? false : parseAsk(body);
    // Sent on the AI and effort the questions were asked on, the price agreed for them then holds (no second question). A
    // change answered by taps on the same AI skips the size check: it ran with the questions, on the same request.
    const confirm = req.confirm || (!!open && open.model === req.model && open.effort === req.effort);
    // The pictures it carries: uploaded for it, or sent before with this game (copied for this message).
    const picked = await this.attachments.pick(user, b.images, project.id);
    const kind = project.currentVersion == null ? "new" : "edit"; // the first build failed (or asked first): build now
    // Taps alone change nothing the size check judged; words typed with them may, so those are checked again.
    const sized = !!answers && !req.text && kind === "edit" && open?.model === req.model;
    const claim = await this.claim(project.id, payer, user, { kind, model: req.model, effort: req.effort });
    let hold: CreditHold | null = null;
    let undo: (() => void) | null = null;
    try {
      hold = await this.credits.assertCanRun(payer, kind, req.model, confirm, req.effort, paidBy);
      const now = Date.now();
      const sent = new Date(now + 1);
      // The first build failed and this builds again: for the screens, genre and tags the player picked.
      const { genre, tags } = picksOf({ genre: project.pickedGenre, tags: project.tags });
      const prepared = this.attachments.prepare(picked);
      undo = prepared.undo;
      // An answer's build also gets the pictures of the request asked about (they stay that message's), first; 10 at most.
      const ownIds = prepared.images.map((i) => i.id);
      const runIds = open ? [...open.images, ...ownIds].slice(0, 10) : ownIds;
      const flags = { ask, answered: !!reply, sized, label: reply?.label ?? null };
      // In line, paid and laned by the owner's plan; the messages say who sent it.
      const queued = claim.now
        ? null
        : this.queue.rowFor({ projectId: id, userId: payer.id, kind, prompt, platform: project.platform, genre, tags, images: runIds, ...flags, plan: payer.plan, hold, at: sent });
      // The player's message and its pictures together: a picture another tab sent a moment ago leaves no message behind.
      const own = await this.prisma.$transaction(async (tx) => {
        const asked = await tx.message.create({ data: { projectId: id, role: "user", text, authorId: user.id, createdAt: new Date(now) } });
        return this.attachments.attachIn(tx, user.id, asked.id, prepared);
      });
      undo = null;
      const images = open ? [...(await this.attachments.forRun(open.images)), ...own].slice(0, 10) : own;
      const agent = await this.prisma.message.create({ data: { projectId: id, ...this.agentMessage(payer, req, sent, queued), authorId: user.id, createdAt: sent } });
      await this.prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
      if (queued) this.queue.added({ ...queued, messageId: agent.id }, req.model, req.effort, hold, user.id);
      else
        this.runs.start({
          projectId: id,
          userId: payer.id,
          senderId: user.id,
          messageId: agent.id,
          kind,
          prompt,
          model: req.model,
          effort: req.effort,
          platform: project.platform,
          genre,
          tags,
          images,
          ...flags,
          hold,
          startedAt: sent,
        });
      hold = null;
    } finally {
      undo?.();
      hold?.release();
      claim.release();
    }
    return this.views.full(id, user.id);
  }

  /**
   * A build's agent message: running from now, or waiting in line with its QueuedRun row (written in the same insert).
   * `plan`: the Free kill switch sums each day's cost by the plan a run started on (a waiting build's is set again at its start).
   */
  private agentMessage(user: User, req: RunRequest, sent: Date, queued: QueuedRunData | null) {
    const base = { role: "agent" as const, text: "", model: req.model, effort: req.effort, plan: user.plan };
    return queued ? { ...base, status: "queued" as const, queued: { create: queued } } : { ...base, status: "running" as const, startedAt: sent };
  }

  async restore(user: User, id: string, body: unknown): Promise<ProjectView> {
    const { project } = await this.access.game(user.id, id, "edit");
    const n = (body as { n?: unknown } | null)?.n;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1) throw badRequest("Pick a version to restore.");
    const release = this.registry.reserve(project.id, "restore");
    try {
      const old = await this.prisma.version.findUnique({ where: { projectId_n: { projectId: id, n } } });
      if (!old) throw notFound(`There is no version ${n}.`);
      const dir = projectDir(id);
      if (!existsSync(join(dir, ".git"))) throw notFound("This game's files are missing.");
      const last = await this.prisma.version.findFirst({ where: { projectId: id }, orderBy: { n: "desc" } });
      const label = `Restored version ${n}`;
      const commit = await restoreCommit(dir, old.commit, label);
      const orientation = orientationOf(readProjectGodot(dir));
      const platform = platformOf(readPlatformWord(dir), orientation); // an older version may not fill every screen yet
      const next = (last?.n ?? 0) + 1;
      try {
        await this.prisma.$transaction([
          this.prisma.version.create({ data: { projectId: id, n: next, label, buildId: old.buildId, commit, poster: old.poster } }),
          this.prisma.project.update({ where: { id }, data: { currentVersion: next, orientation, platform } }),
        ]);
      } catch (e) {
        await settleFolder(dir, last?.commit ?? null); // keep the folder at the version the database knows
        throw e;
      }
    } finally {
      release();
    }
    return this.views.full(id, user.id);
  }

  /** Stop: the game's owner stops any build of it, a member only the ones they asked for (403 for another's). */
  async cancel(user: User, id: string): Promise<ProjectView> {
    const { role } = await this.access.game(user.id, id, "edit");
    // Whose build it is, looked at again before each step (the line's build may have started meanwhile, someone's ended).
    const mine = () => role === "owner" || [null, user.id].includes(this.registry.senderOf(id));
    if (!mine()) throw ownerOnly("This build is someone else's: only they or the game's owner can stop it.");
    await this.queue.cancel(id); // a build waiting in line leaves it
    if (mine()) await this.runs.cancel(id); // one going, or one whose turn came just now, stops
    return this.views.full(id, user.id);
  }

  /** Rename (anyone in the game), share or unshare, and show it in the gallery or not (its owner only). A rename sticks:
   * later builds keep it. */
  async update(user: User, id: string, body: unknown): Promise<ProjectView> {
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const sharing = b.shared !== undefined || b.listed !== undefined;
    const { project } = await this.access.game(user.id, id, sharing ? "owner" : "edit", "Only the game's owner can share it or put it in the gallery.");
    const data: { name?: string; renamed?: true; shared?: boolean; sharedAt?: Date | null; listed?: boolean; listedAt?: Date; genre?: Genre | null } = {};
    if (b.name !== undefined) {
      data.name = cleanName(b.name);
      data.renamed = true;
    }
    if (b.shared !== undefined) {
      if (typeof b.shared !== "boolean") throw badRequest("shared is true or false.");
      if (b.shared && project.currentVersion == null) throw badRequest("There is no game to share yet: build it first.");
      data.shared = b.shared;
      if (b.shared !== project.shared) data.sharedAt = b.shared ? new Date() : null;
    }
    // The gallery is a second step after sharing: only while shared, and unsharing takes the game out of it too.
    if (b.listed !== undefined) {
      if (typeof b.listed !== "boolean") throw badRequest("listed is true or false.");
      if (b.listed && !(data.shared ?? project.shared)) throw badRequest("Share the game first: only shared games can be in the gallery.");
      data.listed = b.listed;
      // The first time only: going back in later doesn't move it up in New.
      if (b.listed && !project.listedAt) data.listedAt = new Date();
      // Its genre for the gallery's filter, from its folder (a game built before builds kept it there has none yet).
      if (b.listed) data.genre = genreOf(id);
    }
    if (data.shared === false) data.listed = false;
    if (!Object.keys(data).length) throw badRequest("Say what to change: a name, sharing, or the gallery.");
    // updatedAt is the last build or message: a rename or a share doesn't move the game up the list.
    await this.prisma.project.update({ where: { id }, data: { ...data, updatedAt: project.updatedAt } });
    return this.views.full(id, user.id);
  }

  /** The Godot project at its current version, as a .zip (anyone who builds it: the owner and its members). */
  async download(user: User, id: string): Promise<{ file: string; data: Buffer }> {
    const { project } = await this.access.game(user.id, id, "edit");
    if (this.registry.status(id) === "running") {
      throw new ApiException(409, "busy", "This game is being changed right now. Download it when the build is done.");
    }
    if (project.currentVersion == null) throw notFound("There is nothing to download yet: the game hasn't been built.");
    const dir = projectDir(id);
    if (project.dirty) {
      // A failed run's reset failed: never hand out half-written files.
      await this.runs.settleIfDirty(id).catch((e) => {
        this.log.error(`download ${id}: folder still dirty: ${e}`);
        throw new ApiException(409, "busy", "This game's files are being put back in order. Try again in a minute.");
      });
    }
    if (!existsSync(join(dir, "project.godot"))) throw notFound("This game's files are missing.");
    try {
      return projectZip(dir, project.name, project.currentVersion);
    } catch (e) {
      if (e instanceof TooBig) throw badRequest("This game is too big to download here. Write to hello@typeplay.app and we'll send it.");
      throw e;
    }
  }

  async remove(user: User, id: string): Promise<{ ok: true }> {
    const { project } = await this.access.game(user.id, id, "owner", "Only the game's owner can delete it. You can leave it instead.");
    await this.removeGame(project.id);
    return { ok: true };
  }

  /** Deletes a game for good: stops its build, then its rows (messages, versions), its pictures, its folder, its
   * published builds (so their links stop working) and its run logs. The credit ledger keeps its
   * charges: they are the account's history, and the balance depends on them. */
  async removeGame(id: string): Promise<void> {
    await this.queue.cancel(id); // a build waiting in line leaves it
    await this.runs.cancel(id); // waits until the folder is back at its last version
    await this.android.cancelAll(id); // an Android build going or queued: stopped (it holds the project while it runs)
    const release = this.registry.reserve(id, "delete");
    try {
      const versions = await this.prisma.version.findMany({ where: { projectId: id }, select: { buildId: true } });
      const androidFiles = this.android.removeProject(id); // reads the rows before they cascade away
      const pictures = await this.attachments.ofGame(id); // the same: its messages' pictures, whose files go after the rows
      await this.prisma.project.delete({ where: { id } });
      // After the rows: if a step below fails, what is left is files nobody can reach, never a game without files.
      this.attachments.removeFiles(pictures);
      removeGameAssets(id); // its asset lists and their files (the Assets tab)
      await removeFolder(projectDir(id)).catch((e) => this.log.error(`remove folder ${id}: ${e}`));
      await androidFiles;
      for (const buildId of new Set(versions.map((v) => v.buildId))) {
        // Only this game's own builds (<id>-v<n>), never a demo build a test pointed at.
        if (buildId.startsWith(`${id}-v`)) await unpublishBuild(buildId).catch((e) => this.log.error(`unpublish ${buildId}: ${e}`));
      }
      const logs = join(config.dataDir, "logs");
      // The run logs (<id>-…) and the Android build logs (android-<id>-a<n>.log).
      if (existsSync(logs)) {
        for (const f of readdirSync(logs)) {
          if (f.startsWith(`${id}-`) || f.startsWith(`android-${id}-a`)) rmSync(join(logs, f), { force: true });
        }
      }
    } finally {
      release();
    }
  }
}
