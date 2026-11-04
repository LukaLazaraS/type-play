// A version's list of assets (2026-11-04, the Assets tab; docs/design/assets.md §6): made once, when the version is
// published (runs.service.ts), or for the current version of a game made before the tab, at the first ask.
// The API lists the game folder's files itself (pictures, 3D models, sounds, fonts; a model's textures belong to the
// model), finds where each is used (the scripts and scenes that name it), reads assets/CREDITS.md for origins, and adds
// what the build's capture made of the art and sounds the game makes in code (packages/agent/tools/capture.mjs:
// export/assets/captured.json, taken only when it is of this version's commit).
// Everything here was written by the game agent (or the game's code, in the capture), so nothing is trusted: files are
// read with the game folder's rules (files.ts: no symlinks out, size caps), pictures are decoded and encoded again by
// sharp (nothing but their pixels survives), models are re-packed (glb.ts), sounds and fonts are checked by their first
// bytes, and the captured list is read field by field.
import { createHash } from "node:crypto";
import { posix } from "node:path";
import type { AssetKind } from "@typeplay/shared";
import { fitWithin, inTurn, library } from "../attachments/images.js";
import { collect, TooBig } from "../games/download.js";
import { readGameFile } from "../games/files.js";
import { MAX_MODEL_BYTES, NotTurnable, outsideFiles, packGlb, readGltf } from "./glb.js";
import { fontFormat, soundFormat, soundSeconds, wavPeaks } from "./media.js";
import { cleanLabel, type LookCall, lookName, looksIn, partName, plainName } from "./names.js";
import { putBlob, type StoredAsset, type StoredList } from "./store.js";

const KIND_BY_EXT: Record<string, AssetKind> = {
  png: "picture", jpg: "picture", jpeg: "picture", webp: "picture", svg: "picture", bmp: "picture", tga: "picture",
  glb: "model", gltf: "model", fbx: "model", obj: "model", dae: "model", blend: "model",
  wav: "sound", ogg: "sound", mp3: "sound",
  ttf: "font", otf: "font", woff: "font", woff2: "font",
};
/** The scripts and scenes searched for where an asset is used. */
const TEXT_EXT = new Set(["gd", "tscn", "tres", "gdshader", "godot"]);
/** Not the game's own content (collect() already leaves out .git, .godot, export/ and the agent's log). */
const SKIP_TOP = new Set(["test", "addons"]);
const LIMIT = {
  picture: 20 << 20,
  model: MAX_MODEL_BYTES,
  sound: 30 << 20,
  font: 10 << 20,
  look: 16 << 20,
  text: 2 << 20,
  texts: 24 << 20,
  items: 500,
  total: 200 << 20,
};
const THUMB_EDGE = 320;
const PICTURE_EDGE = 2048; // as the pictures with a message: the viewer never shows more, and Change it uploads it
const MAX_PIXELS = 64_000_000;
const FILE_TYPES: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", tga: "image/x-tga",
  glb: "model/gltf-binary", gltf: "model/gltf+json", fbx: "application/octet-stream", obj: "model/obj", dae: "model/vnd.collada+xml",
  blend: "application/octet-stream", wav: "audio/wav", ogg: "audio/ogg", mp3: "audio/mpeg",
  ttf: "font/ttf", otf: "font/otf", woff: "font/woff", woff2: "font/woff2",
};

interface Captured {
  looks: { key: string; label: string; frames: number; file: string; strip: string | null }[];
  sounds: { name: string; file: string }[];
  stills: Map<string, string>;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Record<string, unknown>[]) : []);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const capturedFile = (v: unknown) => (typeof v === "string" && /^(looks|sounds|stills)\/\d{1,4}(\.strip)?\.(png|wav)$/.test(v) ? v : null);

/** The build's capture, read field by field, when it is of `commit`; null otherwise (or when there is none). */
function readCaptured(dir: string, commit: string, notes: string[]): Captured | null {
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(readGameFile(dir, "export/assets/captured.json", 4 << 20).toString("utf8")) as Record<string, unknown>;
  } catch {
    notes.push("no capture");
    return null;
  }
  if (raw?.v !== 1 || raw.commit !== commit) {
    notes.push("the capture is of another commit");
    return null;
  }
  if (Array.isArray(raw.notes)) for (const n of raw.notes.slice(0, 10)) if (typeof n === "string") notes.push(`capture: ${n.slice(0, 200)}`);
  const looks = arr(raw.looks)
    .slice(0, LIMIT.items)
    .map((l) => ({
      key: str(l.key, 120),
      label: str(l.label, 200),
      frames: Math.max(1, Math.min(256, Math.floor(Number(l.frames) || 1))),
      file: capturedFile(l.file) ?? "",
      strip: capturedFile(l.strip),
    }))
    .filter((l) => l.key && l.file);
  const sounds = arr(raw.sounds)
    .slice(0, 200)
    .map((s) => ({ name: str(s.name, 120), file: capturedFile(s.file) ?? "" }))
    .filter((s) => s.name && s.file);
  const stills = new Map<string, string>();
  for (const s of arr(raw.stills).slice(0, 200)) {
    const file = capturedFile(s.file);
    const path = str(s.path, 400);
    if (file && path) stills.set(path, file);
  }
  return { looks, sounds, stills };
}

/**
 * A picture decoded once and encoded again: itself (its own format, or PNG) at most 2048 px, and a WebP thumbnail. `wide`:
 * a sprite sheet, whose frames side by side may run to 16384 px (its height still at most 2048).
 */
async function picture(bytes: Buffer, wide = false): Promise<{ data: Buffer; type: string; thumb: Buffer; width: number; height: number; light: boolean }> {
  const sharp = await library();
  return inTurn(async () => {
    const meta = await sharp(bytes, { limitInputPixels: false, animated: false }).metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > MAX_PIXELS) throw new Error("too many pixels");
    const { data, info } = await sharp(bytes, { failOn: "error", limitInputPixels: MAX_PIXELS, animated: false, autoOrient: true })
      .timeout({ seconds: 30 })
      .resize({ width: wide ? 16_384 : PICTURE_EDGE, height: PICTURE_EDGE, fit: "inside", withoutEnlargement: true })
      .toColourspace("srgb")
      .raw({ depth: "uchar" })
      .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const light = lightOnClear(data, channels);
    const from = () => sharp(data, { raw: { width, height, channels: channels as 1 | 2 | 3 | 4 } }).timeout({ seconds: 30 });
    const t = fitWithin(width, height, THUMB_EDGE);
    const own = meta.format === "jpeg" ? "jpeg" : meta.format === "webp" ? "webp" : "png";
    const encoded = own === "jpeg" ? from().jpeg({ quality: 90, mozjpeg: true }) : own === "webp" ? from().webp({ quality: 92, alphaQuality: 100 }) : from().png({ compressionLevel: 8, adaptiveFiltering: true });
    const [full, thumb] = await Promise.all([encoded.toBuffer(), from().resize(t.width, t.height, { fit: "fill" }).webp({ quality: 80, alphaQuality: 90 }).toBuffer()]);
    return { data: full, type: `image/${own}`, thumb, width, height, light };
  });
}

/**
 * Drawn in light colours only, on a see-through ground (stars, glows, white sparks, a pale ring): the site shows it on
 * ink, where Field would hide it. A drawing with dark parts (an outline, a shadow) or in a strong colour reads on Field and
 * stays there. Counted over the visible pixels; at least a fifth of the picture is see-through.
 */
function lightOnClear(px: Buffer, channels: number): boolean {
  if (channels !== 4 && channels !== 2) return false;
  const bins = new Array<number>(32).fill(0);
  let visible = 0;
  let clear = 0;
  let total = 0;
  const step = channels * Math.max(1, Math.floor(px.length / channels / 200_000)); // at most ~200,000 pixels looked at
  for (let i = 0; i + channels - 1 < px.length; i += step) {
    total++;
    const a = px[i + channels - 1] / 255;
    if (a < 0.05) clear++;
    if (a < 0.15) continue; // faint pixels (a star's soft edge) still count as seen
    const l = channels === 4 ? (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255 : px[i] / 255;
    bins[Math.min(31, Math.floor(l * 32))]++;
    visible++;
  }
  if (!visible || clear / total < 0.2) return false;
  // Its darkest tenth and its middle: pale all over (a star, a glow) and no dark parts (an outline puts its tenth near 0;
  // a saturated colour, as a mid-green slime, has a middle well under 0.7 and reads on Field).
  const at = (share: number) => {
    let count = 0;
    for (let b = 0; b < 32; b++) {
      count += bins[b];
      if (count >= visible * share) return b / 32;
    }
    return 1;
  };
  return at(0.1) >= 0.45 && at(0.5) >= 0.7;
}

/** An id that stays the same for the same file or look in every version of the game. */
const idOf = (seed: string) => createHash("sha256").update(seed).digest("hex").slice(0, 16);

/** "assets/CREDITS.md" lines ("- sedan.glb: Car Kit by Kenney (www.kenney.nl), CC0 1.0") by file name. */
function credits(dir: string): Map<string, string> {
  const map = new Map<string, string>();
  let text = "";
  try {
    text = readGameFile(dir, "assets/CREDITS.md", 256 << 10).toString("utf8");
  } catch {
    return map;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*[-*]\s+([^:]{1,200}):\s*(.{1,300})$/.exec(line);
    if (m) map.set(m[1].trim().toLowerCase(), cleanLabel(m[2]));
  }
  return map;
}

/** The files a model points at (textures, buffers, an .obj's material file and its maps), as game paths. */
function modelParts(dir: string, rel: string, ext: string): string[] {
  const near = (p: string) => posix.normalize(posix.join(posix.dirname(rel), p.replace(/\\/g, "/")));
  try {
    if (ext === "glb" || ext === "gltf") return outsideFiles(readGltf(readGameFile(dir, rel, LIMIT.model), ext === "glb")).map(near);
    if (ext === "obj") {
      const parts: string[] = [];
      const text = readGameFile(dir, rel, LIMIT.model).toString("latin1");
      for (const m of text.matchAll(/^mtllib\s+(.+?)\s*$/gm)) {
        const mtl = near(m[1]);
        parts.push(mtl);
        try {
          for (const t of readGameFile(dir, mtl, 1 << 20).toString("latin1").matchAll(/^\s*(?:map_\w+|bump|disp|norm)\s+(?:-\S+\s+\S+\s+)*(.+?)\s*$/gm)) parts.push(near(t[1]));
        } catch {
          // no material file: nothing more belongs to it
        }
      }
      return parts;
    }
  } catch {
    // a model that can't be read: it is listed without its parts
  }
  return [];
}

export interface ImportInput {
  projectId: string;
  buildId: string;
  dir: string;
  /** The version's commit: the build's capture is taken only when it is of this commit. null: list the files only. */
  commit: string | null;
}

/** Lists a version's assets and keeps their files; returns the list (the caller writes it). */
export async function importAssets({ projectId, buildId, dir, commit }: ImportInput): Promise<StoredList> {
  const notes: string[] = [];
  const assets: StoredAsset[] = [];
  const seen = new Set<string>();
  let total = 0;
  const keep = (data: Buffer) => {
    total += data.length;
    return putBlob(projectId, data);
  };
  const room = (bytes: number) => assets.length < LIMIT.items && total + bytes <= LIMIT.total;
  const add = (a: Omit<StoredAsset, "id">, seed: string) => {
    let id = idOf(seed);
    for (let n = 2; seen.has(id); n++) id = idOf(`${seed}#${n}`);
    seen.add(id);
    assets.push({ id, ...a });
  };

  // The game's files: what they are, and the scripts and scenes to search for where each is used.
  let files: { rel: string }[] = [];
  try {
    files = collect(dir).filter((f) => !SKIP_TOP.has(f.rel.split("/")[0]));
  } catch (e) {
    notes.push(e instanceof TooBig ? "the game has too many files to list" : `the game's files can't be listed: ${(e as Error).message}`);
  }
  const ext = (rel: string) => rel.slice(rel.lastIndexOf(".") + 1).toLowerCase();
  const texts: { rel: string; text: string }[] = [];
  let textBytes = 0;
  for (const f of files) {
    if (!TEXT_EXT.has(ext(f.rel)) || f.rel.startsWith("lib/")) continue;
    try {
      const text = readGameFile(dir, f.rel, LIMIT.text).toString("utf8");
      textBytes += text.length;
      if (textBytes > LIMIT.texts) break;
      texts.push({ rel: f.rel, text });
    } catch {
      // too big or not a plain file: not searched
    }
  }
  /**
   * The parts of the game whose scripts or scenes name it. `maker`: a script that only makes it (draws a look, fills a
   * sound's slot) is left out when others use it, so the line says where the player meets it ("Tower", not "Art").
   */
  const where = (needles: string[], maker?: (t: { rel: string; text: string }) => boolean) => {
    const hits = texts.filter((t) => needles.some((n) => n && t.text.includes(n)));
    const users = maker && hits.some((t) => !maker(t)) ? hits.filter((t) => !maker(t)) : hits;
    return [...new Set(users.map((t) => (t.rel === "project.godot" ? "Project settings" : partName(t.rel))))].slice(0, 6);
  };
  const calls: LookCall[] = texts.filter((t) => t.rel.endsWith(".gd")).flatMap((t) => looksIn(t.rel, t.text));
  const origin = credits(dir);

  // 1. What the build's capture made of the game's own drawing and sounds.
  const captured = commit ? readCaptured(dir, commit, notes) : null;
  for (const l of captured?.looks ?? []) {
    try {
      const first = await picture(readGameFile(dir, `export/assets/${l.file}`, LIMIT.look));
      let file = first.data;
      let frames = 1;
      if (l.frames > 1 && l.strip) {
        const strip = await picture(readGameFile(dir, `export/assets/${l.strip}`, LIMIT.look), true);
        if (strip.width >= first.width * l.frames - l.frames && strip.type === "image/png") {
          file = strip.data;
          frames = l.frames;
        }
      }
      if (!room(file.length + first.data.length + first.thumb.length)) {
        notes.push("the list is full");
        break;
      }
      const call = calls.find((c) => c.pattern.test(l.key));
      const drawsIt = (t: { rel: string }) => calls.some((c) => c.file === t.rel && c.pattern.test(l.key));
      const used = where([`"${l.key}"`], drawsIt);
      add(
        {
          kind: "picture",
          name: l.label ? cleanLabel(l.label) || lookName(l.key, calls) : lookName(l.key, calls),
          made: "code",
          where: used.length ? used : call && call.prefix.length >= 2 ? where([`"${call.prefix}`], drawsIt) : [],
          key: l.key,
          width: first.width,
          height: first.height,
          ...(frames > 1 && { frames }),
          ...(first.light && { light: true }),
          bytes: file.length,
          format: "png",
          picture: true,
          blobs: { file: keep(file), picture: file === first.data ? undefined : keep(first.data), thumb: keep(first.thumb) },
          types: { file: "image/png", picture: "image/png" },
        },
        `look:${l.key}`,
      );
    } catch (e) {
      notes.push(`look ${l.key}: ${(e as Error).message}`.slice(0, 200));
    }
  }
  for (const s of captured?.sounds ?? []) {
    try {
      const data = readGameFile(dir, `export/assets/${s.file}`, LIMIT.sound);
      if (soundFormat(data) !== "wav") throw new Error("not a WAV");
      if (!room(data.length)) {
        notes.push("the list is full");
        break;
      }
      add(
        {
          kind: "sound",
          name: plainName(s.name),
          made: "code",
          // sfx.gd's sounds["jump"] = … makes it; Sfx.play("jump") in player.gd is where it plays.
          where: where([`"${s.name}"`], (t) => new RegExp(`\\[\\s*"${esc(s.name)}"\\s*\\]\\s*=|"${esc(s.name)}"\\s*:`).test(t.text)),
          key: s.name,
          ...(soundSeconds(data, "wav") !== null && { seconds: soundSeconds(data, "wav") as number }),
          ...(wavPeaks(data) && { peaks: wavPeaks(data) as number[] }),
          bytes: data.length,
          format: "wav",
          picture: false,
          blobs: { file: keep(data) },
          types: { file: "audio/wav" },
        },
        `sound:${s.name}`,
      );
    } catch (e) {
      notes.push(`sound ${s.name}: ${(e as Error).message}`.slice(0, 200));
    }
  }

  // 2. The game's files. A model's textures and buffers are part of the model, not assets of their own.
  const parts = new Set<string>();
  for (const f of files) if (KIND_BY_EXT[ext(f.rel)] === "model") for (const p of modelParts(dir, f.rel, ext(f.rel))) parts.add(p);
  const order: AssetKind[] = ["picture", "model", "sound", "font"];
  const listed = files
    .filter((f) => KIND_BY_EXT[ext(f.rel)] && !parts.has(f.rel))
    .sort((a, b) => order.indexOf(KIND_BY_EXT[ext(a.rel)]) - order.indexOf(KIND_BY_EXT[ext(b.rel)]) || a.rel.localeCompare(b.rel));
  for (const f of listed) {
    const kind = KIND_BY_EXT[ext(f.rel)];
    const e = ext(f.rel) === "jpeg" ? "jpg" : ext(f.rel);
    const base = f.rel.split("/").pop() ?? f.rel;
    const used = where([`res://${f.rel}`, `/${base}"`, `"${base}"`]);
    const credit = origin.get(base.toLowerCase());
    try {
      const data = readGameFile(dir, f.rel, LIMIT[kind]);
      if (kind === "picture") {
        let shown: Awaited<ReturnType<typeof picture>> | null = null;
        try {
          shown = await picture(data);
        } catch {
          notes.push(`picture ${f.rel}: can't be drawn`);
        }
        if (!room(data.length + (shown ? shown.data.length + shown.thumb.length : 0))) {
          notes.push("the list is full");
          break;
        }
        add(
          {
            kind, name: plainName(base), made: credit ? "library" : "file", where: used, file: f.rel, ...(credit && { credit }),
            ...(shown && { width: shown.width, height: shown.height }),
            ...(shown?.light && { light: true }),
            bytes: data.length, format: e, picture: !!shown,
            blobs: { file: keep(data), ...(shown && { picture: keep(shown.data), thumb: keep(shown.thumb) }) },
            types: { file: FILE_TYPES[e] ?? "application/octet-stream", ...(shown && { picture: shown.type }) },
          },
          `file:${f.rel}`,
        );
      } else if (kind === "model") {
        let file = data;
        let format = e;
        let turnable = false;
        if (e === "glb" || e === "gltf") {
          try {
            file = packGlb(readGltf(data, e === "glb"), (p) => readGameFile(dir, posix.normalize(posix.join(posix.dirname(f.rel), p)), LIMIT.model));
            format = "glb";
            turnable = true;
          } catch (err) {
            notes.push(`model ${f.rel}: not turnable (${err instanceof NotTurnable ? err.message : (err as Error).message})`.slice(0, 200));
          }
        }
        const stillFile = captured?.stills.get(f.rel);
        let still: Awaited<ReturnType<typeof picture>> | null = null;
        if (stillFile) {
          try {
            still = await picture(readGameFile(dir, `export/assets/${stillFile}`, LIMIT.look));
          } catch {
            notes.push(`model ${f.rel}: its still can't be read`);
          }
        }
        if (!room(file.length + (still ? still.data.length + still.thumb.length : 0))) {
          notes.push("the list is full");
          break;
        }
        add(
          {
            kind, name: plainName(base), made: credit ? "library" : "file", where: used, file: f.rel, ...(credit && { credit }),
            bytes: file.length, format, picture: !!still, turnable,
            blobs: { file: keep(file), ...(still && { picture: keep(still.data), thumb: keep(still.thumb) }) },
            types: { file: FILE_TYPES[format] ?? "application/octet-stream", ...(still && { picture: still.type }) },
          },
          `file:${f.rel}`,
        );
      } else if (kind === "sound") {
        const format = soundFormat(data);
        if (!format) {
          notes.push(`sound ${f.rel}: not a WAV, Ogg or MP3 file`);
          continue;
        }
        if (!room(data.length)) {
          notes.push("the list is full");
          break;
        }
        const seconds = soundSeconds(data, format);
        add(
          {
            kind, name: plainName(base), made: credit ? "library" : "file", where: used, file: f.rel, ...(credit && { credit }),
            ...(seconds !== null && { seconds }), ...(format === "wav" && wavPeaks(data) && { peaks: wavPeaks(data) as number[] }), bytes: data.length, format, picture: false,
            blobs: { file: keep(data) }, types: { file: FILE_TYPES[format] },
          },
          `file:${f.rel}`,
        );
      } else {
        const format = fontFormat(data);
        if (!format) {
          notes.push(`font ${f.rel}: not a font file`);
          continue;
        }
        if (!room(data.length)) {
          notes.push("the list is full");
          break;
        }
        add(
          {
            kind, name: plainName(base), made: credit ? "library" : "file", where: used, file: f.rel, ...(credit && { credit }),
            bytes: data.length, format, picture: false, blobs: { file: keep(data) }, types: { file: FILE_TYPES[format] },
          },
          `file:${f.rel}`,
        );
      }
    } catch (err) {
      notes.push(`${kind} ${f.rel}: ${(err as Error).message}`.slice(0, 200));
    }
  }
  // "All" shows the kinds together (the AI's pictures with the picture files, its sounds with the sound files), each kind
  // in the order found: the capture's order (the game's own) first, then the files by path.
  const kindOrder: AssetKind[] = ["picture", "model", "sound", "font"];
  const sorted = assets.map((a, i) => ({ a, i })).sort((x, y) => kindOrder.indexOf(x.a.kind) - kindOrder.indexOf(y.a.kind) || x.i - y.i).map(({ a }) => a);
  return { v: 1, buildId, source: captured ? "build" : "files", made: new Date().toISOString(), commit, assets: sorted, notes };
}
