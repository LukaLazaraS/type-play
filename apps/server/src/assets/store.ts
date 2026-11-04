// Where a game's asset lists live (2026-11-04): the API's own data folder, never the game folder (the agent writes
// there, and Godot packs whatever is in it into the build).
//   DATA_DIR/assets/<project>/blobs/<sha256>        each file once per game, however many versions use it
//   DATA_DIR/assets/<project>/builds/<build>.json   one version's list (builds are immutable: written once)
// Folders 0700 and files 0600, like the pictures' (the runner's job users can't enter them). The whole folder goes with
// the game (projects.service.ts removeGame) and so with the account.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameAsset } from "@typeplay/shared";
import { config } from "../env.js";

/** A project id and a build id as path parts: checked first, so nothing else ever becomes part of a path here. */
const PROJECT = /^[a-z0-9][a-z0-9-]{3,63}$/;
export const BUILD = /^[a-z0-9][a-z0-9-]{0,80}$/;
const SHA = /^[0-9a-f]{64}$/;

/** What is kept of an asset beyond what the site sees: its stored files and their types. */
export interface StoredAsset extends GameAsset {
  /** The file Download saves, its picture (pictures, looks, model stills) and its thumbnail, by content hash. */
  blobs: { file: string; picture?: string; thumb?: string };
  types: { file: string; picture?: string };
}

export interface StoredList {
  v: 1;
  buildId: string;
  source: "build" | "files";
  /** When it was listed. */
  made: string;
  /** The commit the capture was of (build), or null (files only). */
  commit: string | null;
  assets: StoredAsset[];
  /** What couldn't be listed and why (for us; never shown). */
  notes: string[];
}

export const assetsRoot = () => join(config.dataDir, "assets");

function projectDirOf(projectId: string): string {
  if (!PROJECT.test(projectId)) throw new Error(`bad project id ${projectId}`);
  return join(assetsRoot(), projectId);
}

function ensureDir(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Writes a file whole, then renames it into place: a reader never sees half of one. */
function writeWhole(path: string, data: Buffer | string) {
  const tmp = `${path}.${process.pid}.part`;
  writeFileSync(tmp, data, { mode: 0o600 });
  renameSync(tmp, path);
}

/** Keeps a file (once per game) and returns its content hash. */
export function putBlob(projectId: string, data: Buffer): string {
  const sha = createHash("sha256").update(data).digest("hex");
  const dir = join(projectDirOf(projectId), "blobs");
  ensureDir(dir);
  const path = join(dir, sha);
  if (!existsSync(path)) writeWhole(path, data);
  return sha;
}

/** A kept file's path and size, or null when it is gone. */
export function blobFile(projectId: string, sha: string): { path: string; size: number } | null {
  if (!SHA.test(sha)) return null;
  const path = join(projectDirOf(projectId), "blobs", sha);
  try {
    return { path, size: statSync(path).size };
  } catch {
    return null;
  }
}

/** A version's list, read once and then kept in memory (lists never change); null when there is none. */
const cache = new Map<string, StoredList>();
const CACHE_MAX = 64;

export function readList(projectId: string, buildId: string): StoredList | null {
  if (!BUILD.test(buildId)) return null;
  const key = `${projectId}/${buildId}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const path = join(projectDirOf(projectId), "builds", `${buildId}.json`);
  let list: StoredList;
  try {
    list = JSON.parse(readFileSync(path, "utf8")) as StoredList;
  } catch {
    return null;
  }
  if (list?.v !== 1 || !Array.isArray(list.assets)) return null;
  cache.set(key, list);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return list;
}

export function writeList(projectId: string, list: StoredList) {
  if (!BUILD.test(list.buildId)) throw new Error(`bad build id ${list.buildId}`);
  const dir = join(projectDirOf(projectId), "builds");
  ensureDir(dir);
  writeWhole(join(dir, `${list.buildId}.json`), JSON.stringify(list));
  cache.delete(`${projectId}/${list.buildId}`);
}

/** A deleted game's lists and files. */
export function removeGameAssets(projectId: string) {
  for (const key of [...cache.keys()]) if (key.startsWith(`${projectId}/`)) cache.delete(key);
  if (!PROJECT.test(projectId)) return;
  rmSync(join(assetsRoot(), projectId), { recursive: true, force: true });
}
