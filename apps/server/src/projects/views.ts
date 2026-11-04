// Database rows -> the contract's shapes (packages/shared).
import { Injectable } from "@nestjs/common";
import type {
  Effort,
  PlanId,
  PublicGame,
  Message as MessageView,
  ModelChoice,
  Orientation,
  Project as ProjectView,
  ProjectSummary,
  SharedGame,
  Version as VersionView,
} from "@typeplay/shared";
import { PERSON, personOf } from "../access/access.service.js";
import { notFound } from "../common/api-error.js";
import { planModels } from "../credits/credits.js";
import { GalleryService } from "../gallery/gallery.service.js";
import { picksOf } from "../games/picks.js";
import type { Attachment, Message, Project, User, Version } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { RunRegistry } from "../runs/registry.js";
import { questionsOf } from "./questions.js";

/** A message row as views read it: with its pictures (in their order) and its author when they were read with it. */
type MessageRow = Message & {
  attachments?: Pick<Attachment, "id" | "width" | "height" | "position">[];
  author?: Pick<User, "id" | "name" | "email" | "avatarUrl"> | null;
};

/** What to read with a message so `toMessage` can say who sent it (pair developing). */
export const WITH_AUTHOR = { author: { select: PERSON } } as const;

export function toMessage(m: MessageRow): MessageView {
  const view: MessageView = { id: m.id, role: m.role, text: m.text, createdAt: m.createdAt.toISOString() };
  if (m.author) view.by = personOf(m.author);
  if (m.attachments?.length) view.images = [...m.attachments].sort((a, b) => a.position - b.position).map(({ id, width, height }) => ({ id, width, height }));
  if (m.role === "agent") {
    if (m.model) view.model = m.model as ModelChoice;
    if (m.effort) view.effort = m.effort as Effort;
    if (m.status) view.status = m.status;
    if (m.status && m.status !== "running" && m.status !== "queued") view.credits = Number(m.credits ?? 0);
    if (m.versionN != null) view.versionN = m.versionN;
    if (m.startedAt) view.startedAt = m.startedAt.toISOString();
    if (m.startedAt && m.finishedAt) view.finishedAt = m.finishedAt.toISOString();
    if (m.suggestions?.length) view.suggestions = m.suggestions;
    if (m.biggerModel) view.biggerModel = m.biggerModel as ModelChoice;
    // The questions asked before a build (2026-11-04), as written: read back through the same check.
    const questions = m.status === "done" ? questionsOf(m.questions) : null;
    if (questions) view.questions = questions;
  }
  return view;
}

export function toVersion(v: Version): VersionView {
  return { n: v.n, label: v.label, buildId: v.buildId, createdAt: v.createdAt.toISOString() };
}

@Injectable()
export class ProjectViews {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runs: RunRegistry,
    private readonly gallery: GalleryService,
  ) {}

  /** `current`: the newest version (the one playing), or null before the first build; `plays`: all time. */
  summaryOf(p: Project, current: Pick<Version, "buildId" | "poster"> | null, plays: number): ProjectSummary {
    const status = this.runs.status(p.id);
    const queue = status === "queued" ? this.runs.placeOf(p.id) : null;
    const picks = picksOf({ genre: p.pickedGenre, tags: p.tags });
    return {
      id: p.id,
      name: p.name,
      orientation: p.orientation as Orientation,
      platform: p.platform,
      pickedGenre: picks.genre,
      tags: picks.tags,
      buildId: current?.buildId ?? null,
      status,
      ...(queue ? { queue } : {}),
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      shared: p.shared,
      poster: !!current?.poster,
      listed: p.listed,
      galleryHidden: p.hiddenAt !== null,
      plays,
    };
  }

  /** All-time plays of one game. */
  private async playsOf(projectId: string): Promise<number> {
    return (await this.gallery.totals([projectId])).get(projectId) ?? 0;
  }

  async summary(projectId: string): Promise<ProjectSummary> {
    const p = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: { versions: { orderBy: { n: "desc" }, take: 1 } },
    });
    return this.summaryOf(p, p.versions[0] ?? null, await this.playsOf(projectId));
  }

  /** A shared game with a build, for anyone (the share page); 404 otherwise, the same for "private" and "missing". */
  async publicGame(id: string): Promise<PublicGame> {
    const p =
      typeof id === "string" && /^[a-z0-9]{4,40}$/.test(id)
        ? await this.prisma.project.findFirst({ where: { id, shared: true }, include: { versions: { orderBy: { n: "desc" }, take: 1 } } })
        : null;
    const v = p?.versions[0];
    if (!p || !v) throw notFound("We couldn't find that game.");
    return {
      id: p.id,
      name: p.name,
      orientation: p.orientation as Orientation,
      platform: p.platform,
      buildId: v.buildId,
      poster: v.poster,
      updatedAt: p.updatedAt.toISOString(),
      plays: await this.playsOf(p.id),
    };
  }

  async list(userId: string): Promise<ProjectSummary[]> {
    const rows = await this.prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      include: { versions: { orderBy: { n: "desc" }, take: 1 } },
    });
    const plays = await this.gallery.totals(rows.map((p) => p.id));
    return rows.map((p) => this.summaryOf(p, p.versions[0] ?? null, plays.get(p.id) ?? 0));
  }

  /** GET /shared: the games this account builds with their owners (pair developing), the newest change first. */
  async shared(userId: string): Promise<SharedGame[]> {
    const rows = await this.prisma.projectMember.findMany({
      where: { userId },
      include: { project: { include: { versions: { orderBy: { n: "desc" }, take: 1 }, owner: { select: PERSON } } } },
    });
    rows.sort((a, b) => b.project.updatedAt.getTime() - a.project.updatedAt.getTime());
    const plays = await this.gallery.totals(rows.map((r) => r.projectId));
    return rows.map((r) => ({
      ...this.summaryOf(r.project, r.project.versions[0] ?? null, plays.get(r.projectId) ?? 0),
      owner: personOf(r.project.owner),
      role: r.role,
      since: r.createdAt.toISOString(),
    }));
  }

  /**
   * The whole game for someone in it (`viewerId`: the access check has passed): its messages with who sent each, its
   * versions, and `access` (who they are in it, the owner, the members, the plan every message here goes by).
   */
  async full(projectId: string, viewerId: string): Promise<ProjectView> {
    const p = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        messages: { orderBy: { createdAt: "asc" }, include: { attachments: { select: { id: true, width: true, height: true, position: true } }, ...WITH_AUTHOR } },
        versions: { orderBy: { n: "asc" } },
        owner: { select: { ...PERSON, plan: true } },
        members: { orderBy: { createdAt: "asc" }, include: { user: { select: PERSON } } },
      },
    });
    const current = p.versions.at(-1) ?? null;
    const plan = p.owner.plan as PlanId;
    return {
      ...this.summaryOf(p, current, await this.playsOf(projectId)),
      messages: p.messages.map(toMessage),
      versions: p.versions.map(toVersion),
      currentVersion: p.currentVersion,
      access: {
        role: p.ownerId === viewerId ? "owner" : (p.members.find((m) => m.userId === viewerId)?.role ?? "editor"),
        owner: personOf(p.owner),
        members: p.members.map((m) => personOf(m.user)),
        plan,
        models: planModels(plan),
      },
    };
  }
}
