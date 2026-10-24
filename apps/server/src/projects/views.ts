// Database rows -> the contract's shapes (packages/shared).
import { Injectable } from "@nestjs/common";
import type {
  Effort,
  PublicGame,
  Message as MessageView,
  ModelChoice,
  Orientation,
  Project as ProjectView,
  ProjectSummary,
  Version as VersionView,
} from "@typeplay/shared";
import { notFound } from "../common/api-error.js";
import { GalleryService } from "../gallery/gallery.service.js";
import type { Message, Project, Version } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { RunRegistry } from "../runs/registry.js";

/** "More ideas" per answer (Luka, 10-24): then the button goes until the next build or change brings new ones. */
export const MORE_IDEAS = 3;

export function toMessage(m: Message): MessageView {
  const view: MessageView = { id: m.id, role: m.role, text: m.text, createdAt: m.createdAt.toISOString() };
  if (m.role === "agent") {
    if (m.model) view.model = m.model as ModelChoice;
    if (m.effort) view.effort = m.effort as Effort;
    if (m.status) view.status = m.status;
    if (m.status && m.status !== "running") view.credits = Number(m.credits ?? 0);
    if (m.versionN != null) view.versionN = m.versionN;
    // Every idea shown for this answer is kept (none comes back with More ideas): the chat shows the newest three.
    if (m.suggestions?.length) {
      view.suggestions = m.suggestions.slice(-3);
      view.moreIdeas = Math.max(0, MORE_IDEAS - (m.ideaRounds ?? 0));
    }
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

  /** The project if this user owns it, else 404 (another user's project looks like no project). */
  async owned(userId: string, id: string): Promise<Project> {
    const p = typeof id === "string" && /^[a-z0-9]{4,40}$/.test(id) ? await this.prisma.project.findFirst({ where: { id, ownerId: userId } }) : null;
    if (!p) throw notFound("We couldn't find that game.");
    return p;
  }

  /** `current`: the newest version (the one playing), or null before the first build; `plays`: all time. */
  summaryOf(p: Project, current: Pick<Version, "buildId" | "poster"> | null, plays: number): ProjectSummary {
    return {
      id: p.id,
      name: p.name,
      orientation: p.orientation as Orientation,
      buildId: current?.buildId ?? null,
      status: this.runs.status(p.id),
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

  async full(projectId: string): Promise<ProjectView> {
    const p = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        versions: { orderBy: { n: "asc" } },
      },
    });
    const current = p.versions.at(-1) ?? null;
    return {
      ...this.summaryOf(p, current, await this.playsOf(projectId)),
      messages: p.messages.map(toMessage),
      versions: p.versions.map(toVersion),
      currentVersion: p.currentVersion,
    };
  }
}
