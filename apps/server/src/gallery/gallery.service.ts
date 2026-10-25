// The public gallery (typeplay.app/explore), play counts and reports: what anyone may do without signing in.
// A play is a number per game and UTC day (PlayCount), nothing more; the limits that keep one address from
// inflating a count, or from flooding reports, live in memory only (limits.ts).
import { closeSync, lstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import type { GalleryGame, GalleryPage, GallerySort, Genre, Orientation, Platform, ReportReason } from "@typeplay/shared";
import { ApiException, badRequest, notFound } from "../common/api-error.js";
import { config } from "../env.js";
import { Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma.js";
import { Limit, takeAll } from "./limits.js";

const ID = /^[a-z0-9]{4,40}$/;
export const GENRES: Genre[] = ["runner", "puzzle", "racer", "towerdefence"];
export const REASONS: ReportReason[] = ["sexual", "hate", "copied", "scam", "other"];
const PAGE = 24;
const MAX_PAGE = 48;
const MAX_REPORT_TEXT = 500;
/** Open reports that take a game out of the gallery by themselves until an admin looks (one address sends at most one a day per game). */
export const AUTO_HIDE_REPORTS = 3;
/**
 * Open reports a game keeps at most: past this a report is thanked (204) and not stored. Addresses can be had by the
 * thousand (an IPv6 /48 is 65,536 /64s; the runner can set CF-Connecting-IP), so without it a script could fill the
 * database with reports of one game (security review 10-20). The game is out of the gallery long before this.
 */
export const MAX_OPEN_REPORTS = 20;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The genre skill the game was built with: its folder's GENRE file (run.mjs writes it), read as untrusted data. */
export function genreOf(projectId: string): Genre | null {
  // The game folder (runs.service's projectDir, not imported: that module imports the views, which import this one).
  const file = join(config.dataDir, "projects", projectId, "GENRE");
  try {
    // A plain small file only: the game agent can write in the folder (a link, a pipe or a huge file is no genre).
    const st = lstatSync(file);
    if (!st.isFile() || st.size > 64) return null;
    const fd = openSync(file, "r");
    try {
      const buf = Buffer.alloc(64);
      const g = buf.subarray(0, readSync(fd, buf, 0, 64, 0)).toString("utf8").trim();
      return (GENRES as string[]).includes(g) ? (g as Genre) : null;
    } finally {
      closeSync(fd);
    }
  } catch {
    return null;
  }
}

type Cursor = { w?: number; t: string; id: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(raw: unknown, sort: GallerySort): Cursor {
  try {
    if (typeof raw !== "string" || raw.length > 300) throw new Error("not a cursor");
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;
    const ok =
      typeof c.t === "string" && Number.isFinite(Date.parse(c.t)) && typeof c.id === "string" && ID.test(c.id) &&
      (sort === "new" || (Number.isInteger(c.w) && (c.w as number) >= 0));
    if (!ok) throw new Error("not a cursor");
    return { w: c.w, t: new Date(c.t as string).toISOString(), id: c.id as string };
  } catch {
    throw badRequest("That isn't a page of the gallery.");
  }
}

type Row = { id: string; name: string; orientation: string; platform: string | null; listedAt: Date; buildId: string; poster: boolean; week: number };

@Injectable()
export class GalleryService {
  private readonly log = new Logger("gallery");
  // A play: one address counts at most 3 times an hour for a game and 60 times an hour in all; a game takes at most
  // 120 a minute whoever sends them (a backstop for made-up addresses, e.g. from inside our own network).
  private readonly playsGameAddress = new Limit(3, HOUR);
  private readonly playsAddress = new Limit(60, HOUR);
  private readonly playsGame = new Limit(120, MINUTE);
  // A report: one per game and address a day, 5 an hour from one address.
  private readonly reportsGameAddress = new Limit(1, DAY);
  private readonly reportsAddress = new Limit(5, HOUR);

  constructor(private readonly prisma: PrismaService) {}

  /** A page of the gallery: listed, shared, not hidden, built. Popular = plays in the last 7 UTC days (today included). */
  async page(sortRaw: unknown, cursorRaw: unknown, limitRaw: unknown): Promise<GalleryPage> {
    if (sortRaw !== undefined && sortRaw !== "popular" && sortRaw !== "new") throw badRequest("Sort is popular or new.");
    const sort: GallerySort = sortRaw === "new" ? "new" : "popular";
    const limit = limitRaw === undefined ? PAGE : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) throw badRequest(`limit is 1 to ${MAX_PAGE}.`);
    const c = cursorRaw === undefined || cursorRaw === "" ? null : decodeCursor(cursorRaw, sort);
    const week = Prisma.sql`coalesce(w.n, 0)`;
    const after = !c
      ? Prisma.empty
      : sort === "new"
        ? Prisma.sql`AND (p."listedAt", p.id) < (${c.t}::timestamp, ${c.id})`
        : Prisma.sql`AND (${week}, p."listedAt", p.id) < (${c.w}::int, ${c.t}::timestamp, ${c.id})`;
    const order = sort === "new" ? Prisma.sql`p."listedAt" DESC, p.id DESC` : Prisma.sql`${week} DESC, p."listedAt" DESC, p.id DESC`;
    // The playing version is the newest one (currentVersion); a restore makes a new version that reuses an old build.
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT p.id, p.name, p.orientation::text AS orientation, p.platform::text AS platform, p."listedAt", v."buildId", v.poster, ${week}::int AS week
      FROM "Project" p
      JOIN "Version" v ON v."projectId" = p.id AND v.n = p."currentVersion"
      LEFT JOIN (
        SELECT "projectId", sum(count)::int AS n FROM "PlayCount"
        WHERE day > (now() AT TIME ZONE 'UTC')::date - 7 GROUP BY "projectId"
      ) w ON w."projectId" = p.id
      WHERE p.listed AND p.shared AND p."hiddenAt" IS NULL AND p."listedAt" IS NOT NULL ${after}
      ORDER BY ${order}
      LIMIT ${limit + 1}`;
    const shown = rows.slice(0, limit);
    const totals = await this.totals(shown.map((r) => r.id));
    const games: GalleryGame[] = shown.map((r) => ({
      id: r.id,
      name: r.name,
      orientation: r.orientation as Orientation,
      platform: r.platform as Platform | null,
      buildId: r.buildId,
      poster: r.poster,
      plays: totals.get(r.id) ?? 0,
      playsWeek: r.week,
      genre: genreOf(r.id),
      listedAt: r.listedAt.toISOString(),
    }));
    const last = shown.at(-1);
    const next = rows.length > limit && last ? encodeCursor({ ...(sort === "popular" ? { w: last.week } : {}), t: last.listedAt.toISOString(), id: last.id }) : null;
    return { games, next };
  }

  /** All-time plays per game, for these games (0 when none). */
  async totals(projectIds: string[]): Promise<Map<string, number>> {
    if (!projectIds.length) return new Map();
    const rows = await this.prisma.playCount.groupBy({ by: ["projectId"], where: { projectId: { in: projectIds } }, _sum: { count: true } });
    return new Map(rows.map((r) => [r.projectId, r._sum.count ?? 0]));
  }

  /** The share page's game started: one more play today, for a shared, built game, unless this address is past its limits. */
  async countPlay(id: string, visitor: string): Promise<void> {
    if (!ID.test(id)) throw notFound("We couldn't find that game.");
    if (!takeAll([[this.playsGameAddress, `${visitor}:${id}`], [this.playsAddress, visitor], [this.playsGame, id]])) return;
    await this.prisma.$executeRaw`
      INSERT INTO "PlayCount" ("projectId", day, count)
      SELECT p.id, (now() AT TIME ZONE 'UTC')::date, 1 FROM "Project" p WHERE p.id = ${id} AND p.shared AND p."currentVersion" IS NOT NULL
      ON CONFLICT ("projectId", day) DO UPDATE SET count = "PlayCount".count + 1`;
  }

  /** "Report this game": a reason from the list and an optional line, for a shared game. The third open report takes
   * the game out of the gallery until an admin looks (`admin gallery reports`). */
  async report(id: string, visitor: string, body: unknown): Promise<void> {
    if (!ID.test(id)) throw notFound("We couldn't find that game.");
    const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
    if (!REASONS.includes(b.reason as ReportReason)) throw badRequest("Pick what's wrong with the game.");
    let text: string | null = null;
    if (b.text !== undefined && b.text !== null) {
      if (typeof b.text !== "string") throw badRequest("Write what else to say as text.");
      const clean = b.text.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();
      if ([...clean].length > MAX_REPORT_TEXT) throw badRequest(`Keep it under ${MAX_REPORT_TEXT} letters.`);
      text = clean || null;
    }
    if (!takeAll([[this.reportsGameAddress, `${visitor}:${id}`], [this.reportsAddress, visitor]])) {
      throw new ApiException(429, "too_many", "We already have your report about this game. Thank you: we'll look at it.");
    }
    const game = await this.prisma.project.findFirst({ where: { id, shared: true }, select: { id: true, ownerId: true, hiddenAt: true } });
    if (!game) throw notFound("We couldn't find that game.");
    const reason = b.reason as ReportReason;
    const openBefore = await this.prisma.gameReport.count({ where: { projectId: id, handledAt: null } });
    if (openBefore >= MAX_OPEN_REPORTS) return; // enough to act on: thanked, not stored (MAX_OPEN_REPORTS)
    await this.prisma.gameReport.create({ data: { projectId: id, reason, text } });
    const open = openBefore + 1;
    this.log.warn(`report on ${id}: ${reason} (${open} open; admin gallery reports)`);
    if (open < AUTO_HIDE_REPORTS || game.hiddenAt) return;
    // Raw SQL, so updatedAt stays (it orders the owner's list by builds and messages, not by this).
    const why = `${open} reports, waiting for a look`;
    const hidden = await this.prisma.$executeRaw`
      UPDATE "Project" SET "hiddenAt" = now() AT TIME ZONE 'UTC', "hiddenReason" = ${why}
      WHERE id = ${id} AND "hiddenAt" IS NULL`;
    if (hidden) {
      await this.prisma.billingAudit.create({ data: { actor: "job:reports", userId: game.ownerId, action: "gallery_hide", details: { projectId: id, reports: open, auto: true } } });
      this.log.warn(`${id} left the gallery by itself after ${open} open reports`);
    }
  }
}
