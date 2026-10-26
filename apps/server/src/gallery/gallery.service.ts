// The public gallery (typeplay.app/explore), play counts and reports: what anyone may do without signing in.
// A play is a number per game and UTC day (PlayCount), nothing more; the limits that keep one address from
// inflating a count, or from flooding reports, live in memory only (limits.ts).
import { closeSync, lstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common";
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
/** The longest search (letters, once its spaces are tidied) and the most words of it that count. */
export const MAX_SEARCH = 60;
const MAX_WORDS = 5;
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

/** Where the next page starts: after (w, t, id) on popular, (t, id) on new, (n: the name in lower case, id) on all. */
type Cursor = { w?: number; t?: string; n?: string; id: string };
const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString("base64url");
function decodeCursor(raw: unknown, sort: GallerySort): Cursor {
  try {
    // Room for a 60-letter name of 4-byte letters.
    if (typeof raw !== "string" || raw.length > 600) throw new Error("not a cursor");
    const c = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof c.id !== "string" || !ID.test(c.id)) throw new Error("not a cursor");
    if (sort === "all") {
      if (typeof c.n !== "string" || c.n.length > 4 * MAX_SEARCH) throw new Error("not a cursor");
      return { n: c.n, id: c.id };
    }
    const ok = typeof c.t === "string" && Number.isFinite(Date.parse(c.t)) && (sort === "new" || (Number.isInteger(c.w) && (c.w as number) >= 0));
    if (!ok) throw new Error("not a cursor");
    return { w: c.w, t: new Date(c.t as string).toISOString(), id: c.id };
  } catch {
    throw badRequest("That isn't a page of the gallery.");
  }
}

/** The search's words (any case; the first 5 count, each anywhere in the name), or none. Longer than MAX_SEARCH: 400. */
function searchWords(raw: unknown): string[] {
  if (raw === undefined || raw === "") return [];
  if (typeof raw !== "string") throw badRequest("Search with words.");
  const clean = raw.replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim();
  if ([...clean].length > MAX_SEARCH) throw badRequest(`Search with up to ${MAX_SEARCH} letters.`);
  return clean ? clean.split(" ").slice(0, MAX_WORDS) : [];
}
/** A word as an ILIKE pattern that finds it anywhere in a name; its own %, _ and \ are plain letters. */
const anywhere = (word: string) => `%${word.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

type Row = {
  id: string;
  name: string;
  lname: string;
  orientation: string;
  platform: string | null;
  genre: string | null;
  listedAt: Date;
  buildId: string;
  poster: boolean;
  week: number;
};

@Injectable()
export class GalleryService implements OnModuleInit {
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

  async onModuleInit() {
    await this.backfillGenres().catch((e) => this.log.error(`genres: ${e}`));
  }

  /** Gallery games from before the database kept genres (2026-10-27) get theirs from their folders. Builds and listing keep it
   * up to date after that (runs.service, projects.service), so most starts find nothing to do. Returns how many it filled. */
  async backfillGenres(): Promise<number> {
    const missing = await this.prisma.project.findMany({ where: { listed: true, genre: null, currentVersion: { not: null } }, select: { id: true } });
    let filled = 0;
    for (const { id } of missing) {
      const genre = genreOf(id);
      // Raw SQL, so updatedAt stays (it orders the owner's list by builds and messages).
      if (genre) filled += await this.prisma.$executeRaw`UPDATE "Project" SET genre = ${genre}::"Genre" WHERE id = ${id} AND genre IS NULL`;
    }
    if (filled) this.log.log(`genres: ${filled} gallery game(s) filled in from their folders`);
    return filled;
  }

  /**
   * A page of the gallery: listed, shared, not hidden, built; with `genre`, only that genre's games; with `q`, only names
   * holding every word of it. Popular = plays in the last 7 UTC days (today included); new = when it joined the gallery;
   * all = by name, A to Z. A first page (no cursor) also counts the games that match and the whole gallery's per genre.
   */
  async page(sortRaw: unknown, cursorRaw: unknown, limitRaw: unknown, genreRaw?: unknown, qRaw?: unknown): Promise<GalleryPage> {
    if (sortRaw !== undefined && sortRaw !== "popular" && sortRaw !== "new" && sortRaw !== "all") throw badRequest("Sort is popular, new or all.");
    const sort: GallerySort = sortRaw === "new" || sortRaw === "all" ? sortRaw : "popular";
    const limit = limitRaw === undefined ? PAGE : Number(limitRaw);
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) throw badRequest(`limit is 1 to ${MAX_PAGE}.`);
    if (genreRaw !== undefined && genreRaw !== "" && !(GENRES as unknown[]).includes(genreRaw)) throw badRequest(`Genre is one of ${GENRES.join(", ")}.`);
    const genre = genreRaw ? (genreRaw as Genre) : null;
    const words = searchWords(qRaw);
    const c = cursorRaw === undefined || cursorRaw === "" ? null : decodeCursor(cursorRaw, sort);
    const week = Prisma.sql`coalesce(w.n, 0)`;
    // In the gallery: listed, shared, not hidden, and built (the join below needs the playing version).
    const inGallery = Prisma.sql`p.listed AND p.shared AND p."hiddenAt" IS NULL AND p."listedAt" IS NOT NULL AND p."currentVersion" IS NOT NULL`;
    const genreIs = genre ? Prisma.sql`AND p.genre = ${genre}::"Genre"` : Prisma.empty;
    const named = words.length ? Prisma.sql`AND ${Prisma.join(words.map((w) => Prisma.sql`p.name ILIKE ${anywhere(w)}`), " AND ")}` : Prisma.empty;
    const after = !c
      ? Prisma.empty
      : sort === "new"
        ? Prisma.sql`AND (p."listedAt", p.id) < (${c.t}::timestamp, ${c.id})`
        : sort === "all"
          ? Prisma.sql`AND (lower(p.name), p.id) > (${c.n}, ${c.id})`
          : Prisma.sql`AND (${week}, p."listedAt", p.id) < (${c.w}::int, ${c.t}::timestamp, ${c.id})`;
    const order =
      sort === "new"
        ? Prisma.sql`p."listedAt" DESC, p.id DESC`
        : sort === "all"
          ? Prisma.sql`lower(p.name) ASC, p.id ASC`
          : Prisma.sql`${week} DESC, p."listedAt" DESC, p.id DESC`;
    // The playing version is the newest one (currentVersion); a restore makes a new version that reuses an old build.
    const rows = await this.prisma.$queryRaw<Row[]>`
      SELECT p.id, p.name, lower(p.name) AS lname, p.orientation::text AS orientation, p.platform::text AS platform,
        p.genre::text AS genre, p."listedAt", v."buildId", v.poster, ${week}::int AS week
      FROM "Project" p
      JOIN "Version" v ON v."projectId" = p.id AND v.n = p."currentVersion"
      LEFT JOIN (
        SELECT "projectId", sum(count)::int AS n FROM "PlayCount"
        WHERE day > (now() AT TIME ZONE 'UTC')::date - 7 GROUP BY "projectId"
      ) w ON w."projectId" = p.id
      WHERE ${inGallery} ${genreIs} ${named} ${after}
      ORDER BY ${order}
      LIMIT ${limit + 1}`;
    const shown = rows.slice(0, limit);
    const [totals, counts] = await Promise.all([
      this.totals(shown.map((r) => r.id)),
      c
        ? null
        : Promise.all([
            this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Project" p WHERE ${inGallery} ${genreIs} ${named}`,
            this.prisma.$queryRaw<{ genre: Genre; n: number }[]>`
              SELECT p.genre::text AS genre, count(*)::int AS n FROM "Project" p WHERE ${inGallery} AND p.genre IS NOT NULL GROUP BY p.genre`,
          ]),
    ]);
    const games: GalleryGame[] = shown.map((r) => ({
      id: r.id,
      name: r.name,
      orientation: r.orientation as Orientation,
      platform: r.platform as Platform | null,
      buildId: r.buildId,
      poster: r.poster,
      plays: totals.get(r.id) ?? 0,
      playsWeek: r.week,
      genre: r.genre as Genre | null,
      listedAt: r.listedAt.toISOString(),
    }));
    const last = shown.at(-1);
    const next = !(rows.length > limit && last)
      ? null
      : encodeCursor(sort === "all" ? { n: last.lname, id: last.id } : { ...(sort === "popular" ? { w: last.week } : {}), t: last.listedAt.toISOString(), id: last.id });
    if (!counts) return { games, next };
    const [[{ n: total }], perGenre] = counts;
    // In the genres' own order, a genre with no games left out.
    const genres: Partial<Record<Genre, number>> = {};
    for (const g of GENRES) {
      const n = perGenre.find((r) => r.genre === g)?.n;
      if (n) genres[g] = n;
    }
    return { games, next, total, genres };
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
