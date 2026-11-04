// Where attached pictures live: the API's own data folder, DATA_DIR/attachments/<first two letters of the id>/, never a
// game folder (Godot packs whatever is in a game folder into its build, and the agent writes there). Three files a
// picture: <id>.<png|jpg|webp> (the clean picture), <id>.view.webp (what the AI sees), <id>.thumb.webp (the chat's
// thumbnail). Folders 0700 and files 0600 (on the live server the API's user's alone: the runner's job users can't enter
// it; the runner itself copies a run's pictures out, runner.mjs). Files are written before their row and deleted after
// it, so a crash leaves at worst files without a row, which the sweep removes (attachments.service.ts).
import { copyFileSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "../env.js";
import type { ImageFormat } from "../generated/prisma/client.js";

export type PictureFile = "full" | "view" | "thumb";

/** The clean picture's file extension, by format. */
export const EXT: Record<ImageFormat, string> = { png: "png", jpeg: "jpg", webp: "webp" };
/** Each file's Content-Type. */
export const TYPE: Record<ImageFormat, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

/** An attachment id: 24 lowercase letters and digits (attachments.service.ts makes them). */
export const ID = /^[a-z0-9]{24}$/;

export const attachmentsDir = () => join(config.dataDir, "attachments");

/** A picture file's path. The id is checked first: nothing else ever becomes part of a path here. */
export function pathOf(id: string, format: ImageFormat, file: PictureFile): string {
  if (!ID.test(id)) throw new Error(`bad attachment id ${id}`);
  const name = file === "full" ? `${id}.${EXT[format]}` : `${id}.${file}.webp`;
  return join(attachmentsDir(), id.slice(0, 2), name);
}

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Writes a picture's three files (each written whole, then renamed into place). */
export function writePicture(id: string, format: ImageFormat, files: Record<PictureFile, Buffer>) {
  ensureDir(attachmentsDir());
  for (const [file, data] of Object.entries(files) as [PictureFile, Buffer][]) {
    const path = pathOf(id, format, file);
    ensureDir(join(path, ".."));
    const tmp = `${path}.part`;
    writeFileSync(tmp, data, { mode: 0o600 });
    renameSync(tmp, path);
  }
}

/** A picture's three files copied for another id (a picture sent again with a new message). */
export function copyPicture(from: { id: string; format: ImageFormat }, toId: string) {
  for (const file of ["full", "view", "thumb"] as PictureFile[]) {
    const to = pathOf(toId, from.format, file);
    ensureDir(join(to, ".."));
    copyFileSync(pathOf(from.id, from.format, file), to);
  }
}

/** Deletes pictures' files; a file already gone is fine. */
export function removePictures(list: { id: string; format: ImageFormat }[]) {
  for (const p of list) for (const file of ["full", "view", "thumb"] as PictureFile[]) rmSync(pathOf(p.id, p.format, file), { force: true });
}

/** Every picture file there is, with its id and when it was last written (the sweep's list). */
export function listPictureFiles(): { id: string; path: string; mtimeMs: number }[] {
  const out: { id: string; path: string; mtimeMs: number }[] = [];
  let shards: string[] = [];
  try {
    shards = readdirSync(attachmentsDir());
  } catch {
    return out;
  }
  for (const shard of shards) {
    let names: string[] = [];
    try {
      names = readdirSync(join(attachmentsDir(), shard));
    } catch {
      continue; // not a folder
    }
    for (const name of names) {
      const path = join(attachmentsDir(), shard, name);
      const id = name.slice(0, 24);
      try {
        out.push({ id: ID.test(id) ? id : "", path, mtimeMs: statSync(path).mtimeMs });
      } catch {
        // gone meanwhile
      }
    }
  }
  return out;
}

/** This PC's runs: the run's pictures in a private folder of their own while it lasts (agent.ts reads them in). */
export const runImagesDir = (messageId: string) => join(config.dataDir, "run-images", messageId.replace(/[^a-zA-Z0-9-]/g, ""));

/**
 * A run's pictures as run.mjs `--images <dir>` reads them, in their order: `<n>.<png|jpg|webp>` (the clean picture, the
 * one the agent copies into the game when the player asks) and `<n>.view.webp` (what the AI sees), n from 1. The live
 * server's runner makes the same folder in the job's home (runner.mjs). A picture whose files are missing is left out
 * (`warn` says so) rather than failing the build.
 */
export function prepareRunImages(messageId: string, images: { id: string; format: ImageFormat }[], warn: (m: string) => void): string {
  const dir = runImagesDir(messageId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  let n = 0;
  for (const img of images) {
    try {
      copyFileSync(pathOf(img.id, img.format, "full"), join(dir, `${n + 1}.${EXT[img.format]}`));
      copyFileSync(pathOf(img.id, img.format, "view"), join(dir, `${n + 1}.view.webp`));
      n++;
    } catch (e) {
      rmSync(join(dir, `${n + 1}.${EXT[img.format]}`), { force: true });
      warn(`picture ${img.id} left out: ${(e as Error).message}`);
    }
  }
  return dir;
}
