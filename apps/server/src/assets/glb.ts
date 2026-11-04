// 3D models for the Assets tab (2026-11-04): a game's glTF model (.glb, or .gltf with its .bin and textures beside it)
// re-packed as ONE self-contained .glb, so the site can show it turning from a single private download and the player
// downloads one file that opens anywhere. The model is the agent's file, so nothing in it is trusted: the JSON is parsed
// and written again, outside files are read only through the game folder's rules (the caller's `read`), and a model that
// needs a decoder the viewer would have to download (Draco, meshopt, Basis textures) is not made turnable.
// The format: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#glb-file-format-specification

/** Extensions a model may require and still be shown: materials, texture transforms, quantised meshes, lights, WebP. */
const ALLOWED = /^(KHR_materials_[a-z_]+|KHR_texture_transform|KHR_mesh_quantization|KHR_lights_punctual|KHR_materials_variants|EXT_texture_webp)$/;
const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"
const BIN_CHUNK = 0x004e4942; // "BIN\0"
export const MAX_MODEL_BYTES = 50 << 20;

export class NotTurnable extends Error {}

type Json = Record<string, unknown>;
interface Gltf {
  json: Json;
  /** A .glb's own binary chunk (buffer 0 when that buffer has no uri). */
  bin: Buffer | null;
}

/** Reads a .glb's JSON and binary chunks, or a .gltf's JSON. Throws NotTurnable on anything that isn't one. */
export function readGltf(bytes: Buffer, glb: boolean): Gltf {
  if (!glb) {
    try {
      const json = JSON.parse(bytes.toString("utf8")) as unknown;
      if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("not an object");
      return { json: json as Json, bin: null };
    } catch {
      throw new NotTurnable("not a glTF file");
    }
  }
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== GLB_MAGIC || bytes.readUInt32LE(4) !== 2) throw new NotTurnable("not a glTF 2 binary");
  const total = Math.min(bytes.readUInt32LE(8), bytes.length);
  let json: Json | null = null;
  let bin: Buffer | null = null;
  for (let at = 12; at + 8 <= total; ) {
    const len = bytes.readUInt32LE(at);
    const type = bytes.readUInt32LE(at + 4);
    const body = bytes.subarray(at + 8, Math.min(at + 8 + len, total));
    if (type === JSON_CHUNK && !json) {
      try {
        json = JSON.parse(body.toString("utf8")) as Json;
      } catch {
        throw new NotTurnable("its JSON can't be read");
      }
    } else if (type === BIN_CHUNK && !bin) bin = body;
    at += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json || typeof json !== "object" || Array.isArray(json)) throw new NotTurnable("no JSON chunk");
  return { json, bin };
}

const list = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : []);
const isData = (uri: string) => /^data:/i.test(uri);

/** The files a model points at (its textures, its .bin), as paths relative to the model's folder: they belong to it. */
export function outsideFiles(g: Gltf): string[] {
  const uris = [...list(g.json.images), ...list(g.json.buffers)].map((x) => x.uri).filter((u): u is string => typeof u === "string" && !isData(u));
  return [...new Set(uris.map((u) => safeUri(u)).filter((u): u is string => !!u))];
}

/** A relative uri as a path ("Textures/colormap.png"); null for anything absolute, with a scheme, or empty. */
export function safeUri(uri: string): string | null {
  let path: string;
  try {
    path = decodeURIComponent(uri.split(/[?#]/)[0]);
  } catch {
    return null;
  }
  if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("/") || path.startsWith("\\")) return null;
  return path.replace(/\\/g, "/");
}

function dataBytes(uri: string): Buffer {
  const m = /^data:[^,]*?(;base64)?,(.*)$/is.exec(uri);
  if (!m) throw new NotTurnable("a data address that can't be read");
  return m[1] ? Buffer.from(m[2], "base64") : Buffer.from(decodeURIComponent(m[2]), "latin1");
}

/** A picture's MIME type by its first bytes (the types a glTF viewer draws). */
function imageType(b: Buffer): string | null {
  if (b.length >= 8 && b.readUInt32BE(0) === 0x89504e47) return "image/png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const pad4 = (n: number) => (4 - (n % 4)) % 4;

/**
 * The model as one .glb with every buffer and texture inside. `read(path)` reads a file next to the model (relative to its
 * folder; the caller keeps it inside the game folder and caps its size). Throws NotTurnable when it can't be shown.
 */
export function packGlb(g: Gltf, read: (path: string) => Buffer): Buffer {
  const json = JSON.parse(JSON.stringify(g.json)) as Json; // written again from what was parsed: nothing else survives
  const required = Array.isArray(json.extensionsRequired) ? (json.extensionsRequired as unknown[]).map(String) : [];
  const unknown = required.filter((e) => !ALLOWED.test(e));
  if (unknown.length) throw new NotTurnable(`needs ${unknown.join(", ")}`);
  const parts: Buffer[] = [];
  let size = 0;
  const append = (b: Buffer): number => {
    const at = size;
    parts.push(b);
    size += b.length;
    const gap = pad4(b.length);
    if (gap) {
      parts.push(Buffer.alloc(gap));
      size += gap;
    }
    if (size > MAX_MODEL_BYTES) throw new NotTurnable("too big");
    return at;
  };
  // Every buffer into one, in order: buffer 0 of a .glb without a uri is its binary chunk.
  const bufferAt: number[] = [];
  for (const [i, buf] of list(json.buffers).entries()) {
    const uri = typeof buf.uri === "string" ? buf.uri : null;
    let bytes: Buffer;
    if (uri === null) {
      if (i !== 0 || !g.bin) throw new NotTurnable("a buffer with no data");
      bytes = g.bin;
    } else if (isData(uri)) bytes = dataBytes(uri);
    else {
      const path = safeUri(uri);
      if (!path) throw new NotTurnable("a buffer outside the game");
      bytes = read(path);
    }
    const length = typeof buf.byteLength === "number" ? Math.min(buf.byteLength, bytes.length) : bytes.length;
    bufferAt[i] = append(bytes.subarray(0, length));
  }
  const views = list(json.bufferViews);
  for (const v of views) {
    const b = typeof v.buffer === "number" ? v.buffer : -1;
    if (!(b in bufferAt)) throw new NotTurnable("a view of a buffer that isn't there");
    v.byteOffset = bufferAt[b] + (typeof v.byteOffset === "number" ? v.byteOffset : 0);
    v.buffer = 0;
  }
  // Each picture given by an address goes inside, as a view of the one buffer.
  for (const img of list(json.images)) {
    const uri = typeof img.uri === "string" ? img.uri : null;
    if (uri === null) continue; // already a view
    let bytes: Buffer;
    if (isData(uri)) bytes = dataBytes(uri);
    else {
      const path = safeUri(uri);
      if (!path) throw new NotTurnable("a texture outside the game");
      bytes = read(path);
    }
    const type = imageType(bytes);
    if (!type) throw new NotTurnable("a texture that isn't a PNG, JPEG or WebP picture");
    const at = append(bytes);
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.length });
    img.bufferView = views.length - 1;
    img.mimeType = type;
    delete img.uri;
  }
  json.bufferViews = views;
  json.buffers = size ? [{ byteLength: size }] : [];
  if (!size) delete json.buffers;
  const text = Buffer.from(JSON.stringify(json), "utf8");
  const jsonChunk = Buffer.concat([text, Buffer.alloc(pad4(text.length), 0x20)]);
  const bin = Buffer.concat(parts);
  const total = 12 + 8 + jsonChunk.length + (size ? 8 + bin.length : 0);
  if (total > MAX_MODEL_BYTES) throw new NotTurnable("too big");
  const head = Buffer.alloc(12);
  head.writeUInt32LE(GLB_MAGIC, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(total, 8);
  const chunkHead = (len: number, type: number) => {
    const h = Buffer.alloc(8);
    h.writeUInt32LE(len, 0);
    h.writeUInt32LE(type, 4);
    return h;
  };
  return Buffer.concat([head, chunkHead(jsonChunk.length, JSON_CHUNK), jsonChunk, ...(size ? [chunkHead(bin.length, BIN_CHUNK), bin] : [])]);
}
