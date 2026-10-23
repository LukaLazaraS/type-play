// Puts a finished build where the games origin serves it: builds/<buildId>/{index.pck, game.json,
// poster.png}. Builds are immutable (a new version is a new id). GAMES_PUBLISH picks where:
//   folder (dev): apps/games/builds, served by the dev games origin on :3001
//   r2 (live):    the typeplay-games bucket behind https://typeplay.dev, same cache rules as
//                 apps/games/scripts/publish.mjs (packs immutable, game.json no-cache)
// The poster is the check's picture of the start screen (export/screenshot-start.png): the share
// page's link preview and the frame's picture before Play. game.json's `badge` turns on the Free
// plan's "Made with TypePlay" mark in apps/games/play.html.
import { lstatSync, mkdirSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Orientation } from "@typeplay/shared";
import { config } from "../env.js";
import { readGameFile, readWebPack } from "./files.js";
import { r2Delete, r2Put } from "./r2.js";

export interface BuildToPublish {
  buildId: string;
  /** The game folder; its export/web/index.pck is published. */
  dir: string;
  name: string;
  orientation: Orientation;
  /** The "Made with TypePlay" mark (play.html): the owner is on the Free plan as this is published. It stays with
   * the build (builds are immutable: a restore plays the old build, mark and all); the next version follows the plan then. */
  badge: boolean;
  /** Publish export/screenshot-start.png as poster.png (off when that picture is from a step that was rolled back). */
  poster?: boolean;
}

const BUILD_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
/** Browsers keep a build for a year (a new version is a new id); Cloudflare's edge for a day, so a
 * deleted game's poster (a .png, which the edge caches by default) is gone from every PoP by then. */
const IMMUTABLE = "public, max-age=31536000, s-maxage=86400, immutable";
const BUILD_FILES = ["index.pck", "game.json", "poster.png"];
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** The start-screen picture, if the check made one and it really is a PNG (the agent writes that folder). */
function posterOf(dir: string): Buffer | null {
  try {
    const png = readGameFile(dir, "export/screenshot-start.png", 8 << 20);
    return png.length > PNG.length && png.subarray(0, PNG.length).equals(PNG) ? png : null;
  } catch {
    return null;
  }
}

/** Publishes the build; says whether a poster went with it. */
export async function publishBuild(b: BuildToPublish): Promise<{ poster: boolean }> {
  if (!BUILD_ID.test(b.buildId)) throw new Error(`bad build id: ${b.buildId}`);
  const pack = readWebPack(b.dir);
  const poster = b.poster === false ? null : posterOf(b.dir);
  const meta = {
    name: b.name,
    engine: config.godotVersion,
    pack: "index.pck",
    orientation: b.orientation,
    badge: b.badge,
    source: "user",
    built: new Date().toISOString().slice(0, 10),
  };
  const json = Buffer.from(JSON.stringify(meta, null, 2) + "\n");
  // game.json last: the loader never sees a game without its pack.
  if (config.gamesPublish === "r2") {
    await r2Put(`builds/${b.buildId}/index.pck`, pack, "application/octet-stream", IMMUTABLE);
    if (poster) await r2Put(`builds/${b.buildId}/poster.png`, poster, "image/png", IMMUTABLE);
    await r2Put(`builds/${b.buildId}/game.json`, json, "application/json", "no-cache");
    return { poster: !!poster };
  }
  const dir = join(config.gamesBuildsDir, b.buildId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.pck"), pack);
  if (poster) writeFileSync(join(dir, "poster.png"), poster);
  writeFileSync(join(dir, "game.json"), json);
  return { poster: !!poster };
}

/**
 * After a publish: the Godot web engine the check or export wrote next to the pack (index.wasm,
 * index.js and the rest, ~36 MB of the same bytes in every game folder, git-ignored so a reset never
 * removes them) goes; the pack and the check's pictures stay. The next check or export writes the
 * engine again. Only regular files in a real export/web folder are touched (the agent writes it).
 */
export function trimExport(dir: string): void {
  const web = join(dir, "export/web");
  try {
    if (!lstatSync(web).isDirectory()) return;
  } catch {
    return;
  }
  for (const name of readdirSync(web)) {
    if (name === "index.pck") continue;
    const p = join(web, name);
    try {
      if (lstatSync(p).isFile()) unlinkSync(p);
    } catch {
      // gone already, or not a plain file: leave it
    }
  }
}

/** Takes a deleted game's build off the games origin (its links stop working). */
export async function unpublishBuild(buildId: string): Promise<void> {
  if (!BUILD_ID.test(buildId)) throw new Error(`bad build id: ${buildId}`);
  if (config.gamesPublish === "r2") {
    // game.json first: the loader then says "not found" instead of loading half a game.
    for (const f of ["game.json", "index.pck", "poster.png"]) await r2Delete(`builds/${buildId}/${f}`);
    return;
  }
  for (const f of BUILD_FILES) rmSync(join(config.gamesBuildsDir, buildId, f), { force: true });
  rmSync(join(config.gamesBuildsDir, buildId), { recursive: true, force: true });
}
