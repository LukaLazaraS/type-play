// Projects: create (and start the first build), send a change, restore a version, cancel a run;
// rename, share, download and delete a game.
import { randomInt } from "node:crypto";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import type { Effort, ModelChoice, PlanId, Project as ProjectView } from "@typeplay/shared";
import { AndroidService } from "../android/android.service.js";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import { config } from "../env.js";
import { projectZip, TooBig } from "../games/download.js";
import { unpublishBuild } from "../games/publish.js";
import { MODELS } from "../credits/credits.js";
import { CreditsService, type CreditHold } from "../credits/credits.service.js";
import type { User } from "../generated/prisma/client.js";
import { readProjectGodot } from "../games/files.js";
import { removeFolder, restoreCommit, settleFolder } from "../games/git.js";
import { orientationOf } from "../games/godot.js";
import { PrismaService } from "../prisma.js";
import { RunRegistry } from "../runs/registry.js";
import { projectDir, RunsService } from "../runs/runs.service.js";
import { ProjectViews } from "./views.js";

const EFFORTS: Effort[] = ["low", "medium", "high"];
const MAX_PROMPT = 4000;

export interface RunRequest {
  text: string;
  model: ModelChoice;
  effort: Effort;
  confirm: boolean;
}

/** Checks a create/message body: the sentence, the model the user picked, effort, confirm. */
export function parseRunBody(body: unknown, textKey: "prompt" | "text"): RunRequest {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const text = typeof b[textKey] === "string" ? (b[textKey] as string).trim() : "";
  if (!text) throw badRequest("Type what you want first.");
  if (text.length > MAX_PROMPT) throw badRequest(`That's too long: keep it under ${MAX_PROMPT} characters.`);
  if (!MODELS.includes(b.model as ModelChoice)) throw badRequest("Pick Fast, Smart or Best.");
  if (b.effort !== undefined && !EFFORTS.includes(b.effort as Effort)) throw badRequest("Effort is low, medium or high.");
  return { text, model: b.model as ModelChoice, effort: (b.effort as Effort) ?? "medium", confirm: b.confirm === true };
}

/** Who a run is for: the registry caps runs per user by plan. */
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
    private readonly views: ProjectViews,
    private readonly credits: CreditsService,
    private readonly android: AndroidService,
  ) {}

  async create(user: User, body: unknown): Promise<ProjectView> {
    const req = parseRunBody(body, "prompt");
    const id = newProjectId();
    const release = this.registry.reserve(id, "run", ownerOf(user));
    let hold: CreditHold | null = null; // the run's credits, until the run owns them
    try {
      hold = await this.credits.assertCanRun(user, "new", req.model, req.confirm, req.effort);
      const now = Date.now();
      const project = await this.prisma.project.create({
        data: {
          id,
          ownerId: user.id,
          name: nameFromPrompt(req.text),
          messages: {
            create: [
              { role: "user", text: req.text, createdAt: new Date(now) },
              // `plan`: the Free kill switch sums each day's cost by the plan the run started on.
              { role: "agent", text: "", model: req.model, effort: req.effort, status: "running", plan: user.plan, createdAt: new Date(now + 1) },
            ],
          },
        },
        include: { messages: { where: { role: "agent" } } },
      });
      this.runs.start({ projectId: id, userId: user.id, messageId: project.messages[0].id, kind: "new", prompt: req.text, model: req.model, effort: req.effort, hold });
      hold = null;
    } finally {
      hold?.release();
      release();
    }
    return this.views.full(id);
  }

  async send(user: User, id: string, body: unknown): Promise<ProjectView> {
    const project = await this.views.owned(user.id, id);
    const req = parseRunBody(body, "text");
    const release = this.registry.reserve(project.id, "run", ownerOf(user));
    let hold: CreditHold | null = null;
    try {
      const kind = project.currentVersion == null ? "new" : "edit"; // the first build failed: build again
      hold = await this.credits.assertCanRun(user, kind, req.model, req.confirm, req.effort);
      const now = Date.now();
      await this.prisma.message.create({ data: { projectId: id, role: "user", text: req.text, createdAt: new Date(now) } });
      const agent = await this.prisma.message.create({
        data: { projectId: id, role: "agent", text: "", model: req.model, effort: req.effort, status: "running", plan: user.plan, createdAt: new Date(now + 1) },
      });
      await this.prisma.project.update({ where: { id }, data: { updatedAt: new Date() } });
      this.runs.start({ projectId: id, userId: user.id, messageId: agent.id, kind, prompt: req.text, model: req.model, effort: req.effort, hold });
      hold = null;
    } finally {
      hold?.release();
      release();
    }
    return this.views.full(id);
  }

  async restore(user: User, id: string, body: unknown): Promise<ProjectView> {
    const project = await this.views.owned(user.id, id);
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
      const next = (last?.n ?? 0) + 1;
      try {
        await this.prisma.$transaction([
          this.prisma.version.create({ data: { projectId: id, n: next, label, buildId: old.buildId, commit, poster: old.poster } }),
          this.prisma.project.update({ where: { id }, data: { currentVersion: next, orientation } }),
        ]);
      } catch (e) {
        await settleFolder(dir, last?.commit ?? null); // keep the folder at the version the database knows
        throw e;
      }
    } finally {
      release();
    }
    return this.views.full(id);
  }

  async cancel(user: User, id: string): Promise<ProjectView> {
    await this.views.owned(user.id, id);
    await this.runs.cancel(id);
    return this.views.full(id);
  }

  /** Rename, share or unshare, and show it in the gallery or not. A rename sticks: later builds keep it. */
  async update(user: User, id: string, body: unknown): Promise<ProjectView> {
    const project = await this.views.owned(user.id, id);
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    const data: { name?: string; renamed?: true; shared?: boolean; sharedAt?: Date | null; listed?: boolean; listedAt?: Date } = {};
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
    }
    if (data.shared === false) data.listed = false;
    if (!Object.keys(data).length) throw badRequest("Say what to change: a name, sharing, or the gallery.");
    // updatedAt is the last build or message: a rename or a share doesn't move the game up the list.
    await this.prisma.project.update({ where: { id }, data: { ...data, updatedAt: project.updatedAt } });
    return this.views.full(id);
  }

  /** The Godot project at its current version, as a .zip. */
  async download(user: User, id: string): Promise<{ file: string; data: Buffer }> {
    const project = await this.views.owned(user.id, id);
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
    const project = await this.views.owned(user.id, id);
    await this.removeGame(project.id);
    return { ok: true };
  }

  /** Deletes a game for good: stops its build, then its rows (messages, versions), its folder, its
   * published builds (so their links stop working) and its run logs. The credit ledger keeps its
   * charges: they are the account's history, and the balance depends on them. */
  async removeGame(id: string): Promise<void> {
    await this.runs.cancel(id); // waits until the folder is back at its last version
    await this.android.cancelAll(id); // an Android build going or queued: stopped (it holds the project while it runs)
    const release = this.registry.reserve(id, "delete");
    try {
      const versions = await this.prisma.version.findMany({ where: { projectId: id }, select: { buildId: true } });
      const androidFiles = this.android.removeProject(id); // reads the rows before they cascade away
      await this.prisma.project.delete({ where: { id } });
      // After the rows: if a step below fails, what is left is files nobody can reach, never a game without files.
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
