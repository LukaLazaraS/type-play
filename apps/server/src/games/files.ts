// Reading files the game agent wrote. The agent controls its game folder, so a "file" there may be
// a symlink to something of ours: `export/web/index.pck` → /proc/self/environ would upload this
// process's secrets as a public game pack. So: only regular files whose real path is inside the
// folder, opened without following a final symlink, with a size cap.
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { isAbsolute, join, relative } from "node:path";

export function readGameFile(dir: string, rel: string, maxBytes: number): Buffer {
  const real = realpathSync(join(dir, rel)); // throws when missing
  const inside = relative(realpathSync(dir), real);
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) throw new Error(`${rel} points outside the game folder`);
  // O_NONBLOCK: a FIFO named like the file must not hang us (fstat then refuses it).
  const fd = openSync(real, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const st = fstatSync(fd);
    if (!st.isFile()) throw new Error(`${rel} is not a regular file`);
    if (st.size > maxBytes) throw new Error(`${rel} is too big (${st.size} bytes)`);
    const buf = Buffer.alloc(st.size);
    let off = 0;
    while (off < st.size) {
      const n = readSync(fd, buf, off, st.size - off, off);
      if (!n) break;
      off += n;
    }
    return buf.subarray(0, off);
  } finally {
    closeSync(fd);
  }
}

/** project.godot as text (it is small; 1 MB is plenty). */
export const readProjectGodot = (dir: string) => readGameFile(dir, "project.godot", 1 << 20).toString("utf8");

/** The word in the folder's PLATFORM file (the game agent writes it since 2026-10-25); "" when there is none. */
export function readPlatformWord(dir: string): string {
  try {
    return readGameFile(dir, "PLATFORM", 64).toString("utf8").trim();
  } catch {
    return "";
  }
}

/** The web export's pack. Our games are 12-40 KB (2D) to a few MB (3D models); 64 MB is a sanity cap. */
export const readWebPack = (dir: string) => readGameFile(dir, "export/web/index.pck", 64 << 20);
