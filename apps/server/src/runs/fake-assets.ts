// AGENT_FAKE=1 (fake-agent.ts): what a fake build leaves for the Assets tab (2026-11-04), so the tests and the
// walk-throughs see each kind without Godot. A prompt with
//   ASSETS     a 2D game: three looks drawn "in code" (one with 4 frames), two sounds made "in code", a picture file, a
//              sound file and a font, each used by a script
//   ASSETS3D   a 3D game: a model from "the library" (a .glb whose texture sits beside it, with its CREDITS.md line and a
//              still), a .gltf model with an outside .bin, a picture file, and 16 s of music as a WAV file
//   NOCAPTURE  no capture at all (a build whose capture failed, or a game from before the tab)
// and none of these: a capture with nothing in it (a game that draws everything as it runs: nothing to list).
// The files are drawn here (PNG, WAV, GLB written by hand), the font copied from the site's own.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { deflateSync } from "node:zlib";
import { ROOT } from "../env.js";
import { git } from "../games/git.js";

type Rgba = [number, number, number, number];

/** A PNG (RGBA, 8 bits) drawn by `paint(x, y)`. */
export function png(w: number, h: number, paint: (x: number, y: number) => Rgba): Buffer {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set(paint(x, y), y * (w * 4 + 1) + 1 + x * 4);
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    let c = 0xffffffff;
    for (const b of body) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const hex = (c: string, a = 255): Rgba => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), a];
const CLEAR: Rgba = [0, 0, 0, 0];

/** A round blob with eyes, its pupils moved by `t` (0..1): a look as the AI draws one. */
function blob(size: number, body: string, t = 0): Buffer {
  const r = size * 0.42;
  return png(size, size, (x, y) => {
    const dx = x - size / 2;
    const dy = y - size / 2 - Math.sin(t * Math.PI * 2) * size * 0.04;
    if (dx * dx + dy * dy > r * r) return CLEAR;
    for (const ex of [-0.16, 0.16]) {
      const ox = dx - ex * size;
      const oy = dy + 0.08 * size;
      if (ox * ox + oy * oy < (size * 0.09) ** 2) {
        const px = ox - (t - 0.5) * size * 0.06;
        return px * px + oy * oy < (size * 0.04) ** 2 ? hex("#170d33") : hex("#ffffff");
      }
    }
    return hex(body);
  });
}

/** A sound: a tone from `f0` to `f1` Hz over `seconds`, 16-bit mono WAV. */
export function wav(seconds: number, f0: number, f1: number, rate = 22050): Buffer {
  const n = Math.round(seconds * rate);
  const data = Buffer.alloc(n * 2);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const k = i / n;
    ph += (2 * Math.PI * (f0 + (f1 - f0) * k)) / rate;
    data.writeInt16LE(Math.round(Math.sin(ph) * (1 - k) * 0.4 * 32767), i * 2);
  }
  const head = Buffer.alloc(44);
  head.write("RIFF", 0, "ascii");
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8, "ascii");
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36, "ascii");
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

/** A cube's mesh (positions, normals, texture coordinates, indices) as one buffer, and its glTF description. */
function cube(): { bin: Buffer; json: Record<string, unknown> } {
  const faces: [number[], number[], number[]][] = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
    [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, -1, 0], [0, 0, -1], [1, 0, 0]],
    [[0, 0, 1], [0, 1, 0], [-1, 0, 0]], [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  ];
  const pos: number[] = [], nor: number[] = [], uv: number[] = [], idx: number[] = [];
  faces.forEach(([n, u, v], f) => {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      for (let k = 0; k < 3; k++) pos.push((n[k] + a * v[k] + b * u[k]) * 0.5);
      nor.push(...n);
      uv.push((a + 1) / 2, (b + 1) / 2);
    }
    idx.push(f * 4, f * 4 + 1, f * 4 + 2, f * 4, f * 4 + 2, f * 4 + 3);
  });
  const f32 = (a: number[]) => Buffer.from(new Float32Array(a).buffer);
  const parts = [f32(pos), f32(nor), f32(uv), Buffer.from(new Uint16Array(idx).buffer)];
  const offsets = parts.reduce<number[]>((o, p, i) => [...o, i ? o[i - 1] + parts[i - 1].length : 0], []);
  const bin = Buffer.concat(parts);
  return {
    bin,
    json: {
      asset: { version: "2.0", generator: "TypePlay fake build" },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: "Cube" }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 }, indices: 3, material: 0 }] }],
      materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0 } }],
      textures: [{ source: 0 }],
      images: [{ uri: "Textures/colormap.png" }],
      accessors: [
        { bufferView: 0, componentType: 5126, count: 24, type: "VEC3", min: [-0.5, -0.5, -0.5], max: [0.5, 0.5, 0.5] },
        { bufferView: 1, componentType: 5126, count: 24, type: "VEC3" },
        { bufferView: 2, componentType: 5126, count: 24, type: "VEC2" },
        { bufferView: 3, componentType: 5123, count: 36, type: "SCALAR" },
      ],
      bufferViews: parts.map((p, i) => ({ buffer: 0, byteOffset: offsets[i], byteLength: p.length })),
      buffers: [{ byteLength: bin.length }],
    },
  };
}

/** The cube as a .glb whose texture is a file beside it (as Kenney's are). */
function cubeGlb(): Buffer {
  const { bin, json } = cube();
  const text = Buffer.from(JSON.stringify(json));
  const jsonChunk = Buffer.concat([text, Buffer.alloc((4 - (text.length % 4)) % 4, 0x20)]);
  const binChunk = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + binChunk.length, 8);
  const ch = (len: number, type: number) => {
    const b = Buffer.alloc(8);
    b.writeUInt32LE(len, 0);
    b.writeUInt32LE(type, 4);
    return b;
  };
  return Buffer.concat([head, ch(jsonChunk.length, 0x4e4f534a), jsonChunk, ch(binChunk.length, 0x004e4942), binChunk]);
}

function write(dir: string, rel: string, data: Buffer | string) {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), data);
}

/** The game's files for a prompt's kind (before the build's commit). */
export function fakeAssetFiles(dir: string, prompt: string) {
  if (prompt.includes("ASSETS3D")) {
    write(dir, "assets/car-kit/sedan.glb", cubeGlb());
    write(dir, "assets/car-kit/Textures/colormap.png", png(16, 16, (x, y) => hex((x + y) % 2 ? "#ff5a36" : "#ffb347")));
    const { bin, json } = cube();
    write(dir, "models/crate.bin", bin);
    write(dir, "models/crate.png", png(8, 8, () => hex("#a0522d")));
    write(dir, "models/crate.gltf", JSON.stringify({ ...json, images: [{ uri: "crate.png" }], buffers: [{ uri: "crate.bin", byteLength: bin.length }] }));
    write(dir, "assets/CREDITS.md", "# 3D models\n\nFree to use (CC0 1.0, public domain). Thanks to their makers:\n\n- sedan.glb: Car Kit by Kenney (www.kenney.nl), CC0 1.0\n");
    write(dir, "ui/sky.png", png(48, 24, (x, y) => hex(y < 12 ? "#2a1858" : "#572877")));
    write(dir, "audio/theme.wav", wav(16, 220, 330, 8000));
    write(dir, "world.gd", 'extends Node3D\nconst CAR = preload("res://assets/car-kit/sedan.glb")\nconst CRATE = preload("res://models/crate.gltf")\nconst SKY = preload("res://ui/sky.png")\nconst THEME = preload("res://audio/theme.wav")\n');
    return;
  }
  if (prompt.includes("ASSETS")) {
    write(dir, "assets/hero.png", png(64, 64, (x, y) => ((x - 32) ** 2 + (y - 32) ** 2 < 26 ** 2 ? hex("#8fd3ff") : CLEAR)));
    write(dir, "assets/sfx/coin.wav", wav(0.2, 880, 1320));
    copyFileSync(join(ROOT, "apps/web/assets/fonts/Gabarito-Black.ttf"), join(dir, "font.ttf"));
    write(dir, "player.gd", 'extends Node2D\nconst HERO = preload("res://assets/hero.png")\nconst COIN = preload("res://assets/sfx/coin.wav")\nfunc _ready() -> void:\n\tSfx.play("jump")\n');
    write(dir, "enemy.gd", 'extends Node2D\nconst Looks = preload("res://lib/looks.gd")\nfunc make(kind: String) -> Sprite2D:\n\treturn Looks.sprite("e_" + kind)\n');
    write(dir, "art.gd", 'extends RefCounted\nconst Looks = preload("res://lib/looks.gd")\nstatic func add_all() -> void:\n\tLooks.add("coin", Vector2i(40, 40), func(c: CanvasItem) -> void: coin(c), "Gold coin")\n\tfor k in ["slime", "bat"]:\n\t\tLooks.add_frames("e_" + k, Vector2i(64, 64), 4, func(c: CanvasItem, i: int) -> void: enemy(c, k, i))\n\tLooks.add("bg", Vector2i(360, 640), func(c: CanvasItem) -> void: sky(c))\n');
    write(dir, "hud.gd", 'extends CanvasLayer\nconst Looks = preload("res://lib/looks.gd")\nfunc _ready() -> void:\n\tadd_child(Looks.sprite("coin"))\n\tvar f := load("res://font.ttf")\n');
    write(dir, "sfx.gd", 'extends Node\nvar sounds := {}\nfunc _ready() -> void:\n\tsounds["jump"] = null\n\tsounds["hurt"] = null\n');
  }
}

/** The build's capture (packages/agent/tools/capture.mjs writes the same), after the build's commit. */
export async function fakeCapture(dir: string, prompt: string) {
  if (prompt.includes("NOCAPTURE")) return;
  const commit = await git(dir, "rev-parse", "HEAD");
  const out = (rel: string, data: Buffer) => write(dir, `export/assets/${rel}`, data);
  const looks: unknown[] = [];
  const sounds: unknown[] = [];
  const stills: unknown[] = [];
  if (prompt.includes("ASSETS3D")) {
    out("stills/1.png", png(96, 96, (x, y) => (Math.abs(x - 48) < 30 && Math.abs(y - 48) < 30 ? hex(x > 48 ? "#e84a26" : "#ff5a36") : CLEAR)));
    stills.push({ path: "assets/car-kit/sedan.glb", file: "stills/1.png" });
  } else if (prompt.includes("ASSETS")) {
    out("looks/1.png", png(40, 40, (x, y) => ((x - 20) ** 2 + (y - 20) ** 2 < 17 ** 2 ? hex("#ffb347") : CLEAR)));
    looks.push({ key: "coin", label: "Gold coin", w: 40, h: 40, frames: 1, file: "looks/1.png" });
    const frames = [0, 1, 2, 3].map((i) => blob(64, "#2f9e44", i / 4));
    out("looks/2.png", frames[0]);
    // The sheet: the four frames side by side.
    const sheet = png(256, 64, (x, y) => {
      const f = Math.floor(x / 64);
      const r = 64 * 0.42, t = f / 4;
      const dx = (x % 64) - 32, dy = y - 32 - Math.sin(t * Math.PI * 2) * 64 * 0.04;
      return dx * dx + dy * dy <= r * r ? hex("#2f9e44") : CLEAR;
    });
    out("looks/2.strip.png", sheet);
    looks.push({ key: "e_slime", w: 64, h: 64, frames: 4, file: "looks/2.png", strip: "looks/2.strip.png" });
    out("looks/3.png", blob(64, "#572877"));
    looks.push({ key: "e_bat", w: 64, h: 64, frames: 1, file: "looks/3.png" });
    out("looks/4.png", png(360, 640, (x, y) => hex(["#1c1240", "#2a1858", "#3d206b", "#572877", "#6a2c7a"][Math.min(4, Math.floor(y / 128))])));
    looks.push({ key: "bg", w: 360, h: 640, frames: 1, file: "looks/4.png" });
    out("sounds/1.wav", wav(0.13, 320, 720));
    out("sounds/2.wav", wav(0.3, 600, 200));
    sounds.push({ name: "jump", seconds: 0.13, file: "sounds/1.wav" }, { name: "hurt", seconds: 0.3, file: "sounds/2.wav" });
  }
  write(dir, "export/assets/captured.json", JSON.stringify({ v: 1, commit, made: new Date().toISOString(), ms: 1200, looks, sounds, stills, notes: [] }));
}
