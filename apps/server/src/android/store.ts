// Where signed Android builds live (docs/android-export-design.md §8, §15): ANDROID_STORE=folder
// keeps them in data/android/<projectId>/<buildId>.<ext> and the API streams them (the download
// route and the 10-minute phone link); ANDROID_STORE=r2 puts them in the private typeplay-exports
// bucket (the phone link is still the short /android/dl/<token>, which redirects to a presigned GET
// made at that moment; a 30-day lifecycle rule on the bucket is the backstop for the hourly sweep:
// deploy.mjs api-setup). Files expire 30 days after a build is done either way.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Readable } from "node:stream";
import { Readable as NodeReadable } from "node:stream";
import { config } from "../env.js";
import { r2Delete, r2Get, r2PresignGet, r2Put } from "../games/r2.js";

export interface Stored {
  /** "data/android/<projectId>/<buildId>.<ext>" (folder) or "android/<projectId>/<buildId>.<ext>" (R2). */
  path: string;
  bytes: number;
  sha256: string;
}

const PROJECT_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const BUILD_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
export const MIME: Record<"apk" | "aab", string> = { apk: "application/vnd.android.package-archive", aab: "application/octet-stream" };

/** The folder store's root: data/android (next to data/projects). */
export const androidDataDir = () => join(config.dataDir, "android");

/**
 * ANDROID_FAKE=1 with ANDROID_STORE=r2 (dev and the e2e; ANDROID_FAKE is refused in production): the bucket is a
 * folder, data/android/_r2/<bucket>/<key>, so the R2 paths run without touching R2: the stored key, the redirect
 * behind the phone link and its presigned URL, which is computed here and never fetched.
 */
const fakeBucket = () => config.android.fake && config.android.store === "r2";

/** A fake bucket's file for an R2 key ("android/<projectId>/<buildId>.<ext>"), refusing anything else. */
function fakeObject(key: string): string {
  const m = /^android\/([a-z0-9_-]+)\/([a-z0-9-]+)\.(apk|aab)$/.exec(key);
  if (!m) throw new Error(`not an R2 build key: ${key}`);
  return join(androidDataDir(), "_r2", config.android.r2Bucket, "android", m[1], `${m[2]}.${m[3]}`);
}

/** One R2 object removed (a missing one is fine), in the real bucket or the fake one. */
async function deleteObject(key: string): Promise<void> {
  if (fakeBucket()) return rmSync(fakeObject(key), { force: true });
  return r2Delete(key, config.android.r2Bucket);
}

function check(projectId: string, buildId: string, ext: string) {
  if (!PROJECT_ID.test(projectId) || !BUILD_ID.test(buildId) || (ext !== "apk" && ext !== "aab")) throw new Error(`bad build path ${projectId}/${buildId}.${ext}`);
}

/** A stored path back to its folder file, refusing anything outside data/android. */
function localFile(path: string): string {
  const m = /^data\/android\/([a-z0-9_-]+)\/([a-z0-9-]+)\.(apk|aab)$/.exec(path);
  if (!m) throw new Error(`not a folder-store path: ${path}`);
  const file = resolve(androidDataDir(), m[1], `${m[2]}.${m[3]}`);
  if (!file.startsWith(resolve(androidDataDir()))) throw new Error(`path escapes the store: ${path}`);
  return file;
}

export async function putBuild(projectId: string, buildId: string, ext: "apk" | "aab", data: Buffer): Promise<Stored> {
  check(projectId, buildId, ext);
  const sha256 = createHash("sha256").update(data).digest("hex");
  if (config.android.store === "r2") {
    const key = `android/${projectId}/${buildId}.${ext}`;
    if (fakeBucket()) {
      const file = fakeObject(key);
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      writeFileSync(file, data, { mode: 0o600 });
    } else await r2Put(key, data, MIME[ext], "private, no-store", config.android.r2Bucket);
    return { path: key, bytes: data.length, sha256 };
  }
  const dir = join(androidDataDir(), projectId);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(join(dir, `${buildId}.${ext}`), data, { mode: 0o600 });
  return { path: `data/android/${projectId}/${buildId}.${ext}`, bytes: data.length, sha256 };
}

/** The file to stream to a browser, or null when it is gone. */
export async function openBuild(path: string): Promise<{ stream: Readable; bytes: number } | null> {
  if (path.startsWith("android/")) {
    if (fakeBucket()) {
      const file = fakeObject(path);
      return existsSync(file) ? { stream: createReadStream(file), bytes: statSync(file).size } : null;
    }
    const res = await r2Get(path, config.android.r2Bucket);
    if (!res?.body) return null;
    return { stream: NodeReadable.fromWeb(res.body as import("node:stream/web").ReadableStream), bytes: Number(res.headers.get("content-length") ?? 0) };
  }
  const file = localFile(path);
  if (!existsSync(file)) return null;
  return { stream: createReadStream(file), bytes: statSync(file).size };
}

export async function deleteBuild(path: string): Promise<void> {
  if (path.startsWith("android/")) return deleteObject(path);
  rmSync(localFile(path), { force: true });
}

/**
 * A link straight to the object, made now (R2 only; null for a folder-store file, which the API streams): the
 * phone link's redirect points at it, for `expiresSec` seconds (links.ts `presignSeconds`).
 */
export function presignBuild(path: string, filename: string, expiresSec: number): string | null {
  if (!path.startsWith("android/")) return null;
  return r2PresignGet(path, { bucket: config.android.r2Bucket, expiresSec, filename });
}

/** A deleted game's files (the rows know the R2 keys; the folder goes as a whole). */
export async function removeProjectBuilds(projectId: string, paths: string[]): Promise<void> {
  for (const p of paths) if (p.startsWith("android/")) await deleteObject(p).catch(() => {});
  if (PROJECT_ID.test(projectId)) {
    rmSync(join(androidDataDir(), projectId), { recursive: true, force: true });
    if (fakeBucket()) rmSync(join(androidDataDir(), "_r2", config.android.r2Bucket, "android", projectId), { recursive: true, force: true });
  }
}
