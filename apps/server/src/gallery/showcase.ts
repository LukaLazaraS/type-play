// `admin gallery showcase` (src/admin.ts): our six showcase games in the public gallery, under a TypePlay account of
// their own. The one way they get there: on the live database after a deploy (docs/beta/runbook.md), and on this PC's
// development database by the local site's seed (scripts/local-site.mjs). Running it again changes nothing: a game
// that is there already is left as it is (its plays, reports, a hide), and only a missing one is added.
// The builds are the polished Opus ones the home page plays (apps/web/src/content/games.ts), in the home page's order;
// name and orientation come from each build's own game.json where the gallery loads it: the games folder here
// (GAMES_BUILDS_DIR), https://typeplay.dev for the live database. A build, pack or poster that isn't there stops it
// before anything is written (`node deploy/deploy.mjs games` publishes them).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Genre, Orientation } from "@typeplay/shared";
import type { LedgerService } from "../credits/ledger.service.js";
import { config, ENV_MODE } from "../env.js";
import type { PrismaClient } from "../generated/prisma/client.js";

/** The account that owns them. Its id is no Supabase user id (those are UUIDs) and `.invalid` is no one's domain
 * (RFC 2606), so nobody can sign in as it: the games are no player's to open or change. */
export const SHOWCASE_OWNER = { id: "typeplay-showcase", email: "showcase@typeplay.invalid", name: "TypePlay" };

/** Each game's id (its share page typeplay.app/play/<id>), its build on the games origin, and its genre for the
 * gallery's filter (the genre skill it would be built with today). */
export const SHOWCASE: { id: string; build: string; genre: Genre }[] = [
  { id: "showracer", build: "show-racer-polished", genre: "racer" },
  { id: "showarcade", build: "show-arcade-polished", genre: "arcade" },
  { id: "showtd", build: "show-td-polished", genre: "towerdefence" },
  { id: "showmatch3", build: "show-match3-polished", genre: "puzzle" },
  { id: "showrunner", build: "show-runner-polished", genre: "runner" },
  { id: "show3d", build: "show-3d-polished", genre: "platformer" },
];

const LIVE_GAMES = "https://typeplay.dev";
/** The live database's games are loaded from typeplay.dev; every other database's from this PC's games folder. */
const fromLive = ENV_MODE === "live" || config.gamesPublish === "r2";

/** A published build's game.json, or a sentence saying what is missing. */
async function readBuild(build: string): Promise<{ name: string; orientation: Orientation } | string> {
  let json: string;
  if (fromLive) {
    const at = (file: string) => `${LIVE_GAMES}/builds/${build}/${file}`;
    const res = await fetch(at("game.json"), { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return `${at("game.json")} answers ${res.status}`;
    for (const file of ["index.pck", "poster.png"]) {
      const head = await fetch(at(file), { method: "HEAD", signal: AbortSignal.timeout(15_000) });
      if (!head.ok) return `${at(file)} answers ${head.status}`;
    }
    json = await res.text();
  } else {
    const dir = join(config.gamesBuildsDir, build);
    const missing = ["game.json", "index.pck", "poster.png"].find((f) => !existsSync(join(dir, f)));
    if (missing) return `${join(dir, missing)} is not there`;
    json = readFileSync(join(dir, "game.json"), "utf8");
  }
  const meta = JSON.parse(json) as { name?: unknown; orientation?: unknown };
  const name = typeof meta.name === "string" ? meta.name.trim().slice(0, 60) : "";
  if (!name) return `${build}/game.json has no name`;
  return { name, orientation: meta.orientation === "landscape" ? "landscape" : "portrait" };
}

export async function showcaseAdmin(prisma: PrismaClient, ledger: LedgerService, actor: string): Promise<void> {
  console.log(`builds from ${fromLive ? LIVE_GAMES : config.gamesBuildsDir}`);
  const there = new Map((await prisma.project.findMany({ where: { id: { in: SHOWCASE.map((g) => g.id) } }, include: { owner: { select: { id: true, email: true } } } })).map((p) => [p.id, p]));
  // Every build is checked before anything is written: all six go in, or none.
  const builds = new Map<string, { name: string; orientation: Orientation }>();
  const problems: string[] = [];
  for (const g of SHOWCASE) {
    if (there.has(g.id)) continue;
    const b = await readBuild(g.build);
    if (typeof b === "string") problems.push(b);
    else builds.set(g.id, b);
  }
  if (problems.length) throw new Error(`nothing changed: ${problems.join("; ")} (publish the builds first: node deploy/deploy.mjs games)`);

  const now = Date.now();
  const added = await prisma.$transaction(async (tx) => {
    await tx.user.upsert({ where: { id: SHOWCASE_OWNER.id }, create: SHOWCASE_OWNER, update: {} });
    const ids: string[] = [];
    for (const [i, g] of SHOWCASE.entries()) {
      const b = builds.get(g.id);
      if (!b) continue;
      // A second apart, in the home page's order: with no plays yet, Popular and New show them in it.
      const at = new Date(now - i * 1000);
      await tx.project.create({
        data: {
          id: g.id,
          ownerId: SHOWCASE_OWNER.id,
          name: b.name,
          orientation: b.orientation,
          genre: g.genre,
          currentVersion: 1,
          shared: true,
          sharedAt: at,
          listed: true,
          listedAt: at,
          createdAt: at,
          updatedAt: at,
          versions: { create: { n: 1, label: "A showcase game", buildId: g.build, commit: "showcase", poster: true, createdAt: at } },
        },
      });
      ids.push(g.id);
    }
    await ledger.audit(tx, { actor, userId: SHOWCASE_OWNER.id, action: "gallery_showcase", details: { added: ids } });
    return ids;
  });

  for (const g of SHOWCASE) {
    const p = there.get(g.id);
    const b = builds.get(g.id);
    if (b) console.log(`${g.id.padEnd(11)} "${b.name}" (${b.orientation}, ${g.genre}, ${g.build}): added`);
    else if (p && p.owner.id !== SHOWCASE_OWNER.id) console.log(`${g.id.padEnd(11)} belongs to ${p.owner.email}: left as it is`);
    else if (p) {
      const state = p.listed && p.shared ? (p.hiddenAt ? `hidden since ${p.hiddenAt.toISOString().slice(0, 10)} (admin gallery unhide ${g.id})` : "in the gallery") : "not listed";
      console.log(`${g.id.padEnd(11)} "${p.name}": there already, ${state}`);
    }
  }
  console.log(added.length ? `${added.length} added to the gallery` : "nothing to change: every showcase game is there");
}
