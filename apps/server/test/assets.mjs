// Unit test of the Assets tab's lists (src/assets/*), no database: plain names, the 3D model re-pack, sounds and fonts by
// content, and a whole game folder listed with its build's capture.
//   npm run build -w @typeplay/server && npm run test:assets -w @typeplay/server
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const root = resolve(here, "../..");
const data = mkdtempSync(join(tmpdir(), "tp-assets-"));
process.env.DATA_DIR = data; // the lists go to a folder of this run's own
const { cleanLabel, lookName, looksIn, partName, plainName } = await import("../dist/assets/names.js");
const { NotTurnable, outsideFiles, packGlb, readGltf, safeUri } = await import("../dist/assets/glb.js");
const { fontFormat, soundFormat, soundSeconds } = await import("../dist/assets/media.js");
const { importAssets } = await import("../dist/assets/importer.js");
const { fakeAssetFiles, png, wav } = await import("../dist/runs/fake-assets.js");

let failures = 0;
function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}

console.log("plain names");
ok(plainName("tb_saw_2") === "Tb saw 2", `tb_saw_2 -> "${plainName("tb_saw_2")}"`);
ok(plainName("building-type-a.glb") === "Building type a", "a file name loses its extension and dashes");
ok(plainName("Cosmic_Weightless_Loop.mp3") === "Cosmic weightless loop", "a sound file's name");
ok(plainName("map0") === "Map 0" && plainName("jump2") === "Jump 2", "letters and digits apart");
ok(plainName("EnemyBossRobot") === "Enemy boss robot", "camelCase in words");
ok(plainName("___") === "Untitled", "nothing left: Untitled");
ok(partName("enemies/boss_robot.tscn") === "Boss robot", "a part of the game from a scene's path");
ok(cleanLabel("  Red\u0000 ant\u202e  ") === "Red ant", "a label without control or direction characters");
ok(cleanLabel("x".repeat(90)).length === 60, "a label at most 60 letters");
const art = [
  'Looks.add("heart", Vector2i(40, 40), func(c: CanvasItem) -> void: heart(c))',
  'for k in KINDS:\n\tfor lv in 3:\n\t\tLooks.add("tb_%s_%d" % [k, lv], Vector2i(72, 72), func(c: CanvasItem) -> void: tower_base(c, k, lv))',
  'Looks.add_frames("e_" + k, Vector2i(sz, sz), 4, func(c: CanvasItem, i: int) -> void: Enemy.draw_robot(c, k, i))',
  'Looks.add("star_on", Vector2i(48, 48), func(c: CanvasItem) -> void: star(c, true))',
  'Looks.add("bg", Vector2i(1152, 648), func(c: CanvasItem) -> void:\n\tc.draw_rect(Rect2(0, 0, 10, 10), Color.RED))',
  'var sky: Texture2D = await Looks.bake_one(host, "sky", Vector2i(W, H), Vector2.ZERO, _paint_sky)',
].join("\n");
const calls = looksIn("art.gd", art);
ok(calls.length === 6, `six Looks calls found (${calls.length})`);
ok(lookName("tb_saw_2", calls) === "Tower base saw 2", `tb_saw_2 drawn by tower_base: "${lookName("tb_saw_2", calls)}"`);
ok(lookName("e_toaster", calls) === "Robot toaster", `e_toaster drawn by Enemy.draw_robot: "${lookName("e_toaster", calls)}"`);
ok(lookName("star_on", calls) === "Star on", `star_on drawn by star: "${lookName("star_on", calls)}"`);
ok(lookName("bg", calls) === "Bg", "drawn inline: the key's words");
ok(lookName("sky", calls) === "Sky", `bake_one with a function by name: "${lookName("sky", calls)}"`);
ok(lookName("heart", calls) === "Heart", "a key the same as its function");

console.log("3D models: one self-contained .glb");
const game = mkdtempSync(join(tmpdir(), "tp-assets-game-"));
const git = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: game, encoding: "utf8" });
writeFileSync(join(game, "project.godot"), 'config_version=5\n[application]\nconfig/name="Test"\n');
fakeAssetFiles(game, "a car game ASSETS3D");
const glbBytes = readFileSync(join(game, "assets/car-kit/sedan.glb"));
const g = readGltf(glbBytes, true);
ok(JSON.stringify(outsideFiles(g)) === JSON.stringify(["Textures/colormap.png"]), "the model points at its texture beside it");
const packed = packGlb(g, (p) => readFileSync(join(game, "assets/car-kit", p)));
const back = readGltf(packed, true);
ok(packed.readUInt32LE(8) === packed.length, "the .glb's length is its size");
ok(!back.json.images[0].uri && typeof back.json.images[0].bufferView === "number" && back.json.images[0].mimeType === "image/png", "the texture is inside, as a view");
const view = back.json.bufferViews[back.json.images[0].bufferView];
ok(back.bin.subarray(view.byteOffset, view.byteOffset + view.byteLength).equals(readFileSync(join(game, "assets/car-kit/Textures/colormap.png"))), "byte for byte");
ok(back.json.bufferViews.every((v) => v.buffer === 0) && back.json.buffers.length === 1, "one buffer");
const gltf = readGltf(readFileSync(join(game, "models/crate.gltf")), false);
const packedGltf = readGltf(packGlb(gltf, (p) => readFileSync(join(game, "models", p))), true);
ok(!packedGltf.json.buffers[0].uri && packedGltf.json.images[0].mimeType === "image/png", "a .gltf with an outside .bin and texture: packed too");
let refused = "";
try {
  packGlb({ json: { ...g.json, extensionsRequired: ["KHR_draco_mesh_compression"] }, bin: g.bin }, () => Buffer.alloc(0));
} catch (e) {
  refused = e instanceof NotTurnable ? e.message : String(e);
}
ok(/draco/i.test(refused), `a model that needs Draco isn't turnable ("${refused}")`);
ok(safeUri("../../etc/passwd") === "../../etc/passwd" && safeUri("/etc/passwd") === null && safeUri("file:///etc/passwd") === null && safeUri("C:\\x.png") === null, "absolute and scheme addresses refused (relative ones go through the game folder's rules)");
refused = "";
try {
  packGlb({ json: { ...g.json, images: [{ uri: "https://example.com/x.png" }] }, bin: g.bin }, () => Buffer.alloc(0));
} catch (e) {
  refused = e instanceof NotTurnable ? e.message : String(e);
}
ok(refused === "a texture outside the game", "a texture from the internet isn't fetched");
ok((() => {
  try {
    readGltf(Buffer.from("not a model at all, just words"), true);
    return false;
  } catch (e) {
    return e instanceof NotTurnable;
  }
})(), "not a .glb: refused");

console.log("sounds and fonts by content");
const beep = wav(0.25, 440, 440);
ok(soundFormat(beep) === "wav" && soundSeconds(beep, "wav") === 0.25, "a WAV and its length");
ok(soundFormat(Buffer.from("OggS\0\x02")) === "ogg" && soundFormat(Buffer.from("ID3\x04\0\0")) === "mp3", "Ogg and MP3 by their first bytes");
ok(soundFormat(Buffer.from("MZ\x90\0")) === null, "a program is no sound");
const ttf = readFileSync(join(root, "apps/web/assets/fonts/Gabarito-Black.ttf"));
ok(fontFormat(ttf) === "ttf" && fontFormat(Buffer.from("wOF2xxxx")) === "woff2" && fontFormat(Buffer.from("<html>")) === null, "fonts by their first bytes");

console.log("a game folder listed, with its build's capture");
writeFileSync(join(game, "player.gd"), 'extends Node\nconst SKY = preload("res://ui/sky.png")\nfunc _ready() -> void:\n\tSfx.play("jump")\n');
writeFileSync(join(game, "sfx.gd"), 'extends Node\nvar sounds := {}\nfunc _ready() -> void:\n\tsounds["jump"] = null\n');
writeFileSync(join(game, "art.gd"), art);
mkdirSync(join(game, "test"), { recursive: true });
writeFileSync(join(game, "test/ignored.png"), png(4, 4, () => [255, 0, 0, 255]));
git("init", "-q");
git("add", "-A");
git("commit", "-qm", "build");
const commit = git("rev-parse", "HEAD").stdout.trim();
mkdirSync(join(game, "export/assets/looks"), { recursive: true });
mkdirSync(join(game, "export/assets/sounds"), { recursive: true });
writeFileSync(join(game, "export/assets/looks/1.png"), png(72, 72, (x, y) => (x + y > 60 ? [255, 90, 54, 255] : [0, 0, 0, 0])));
writeFileSync(join(game, "export/assets/looks/2.png"), Buffer.from("this is not a picture"));
writeFileSync(join(game, "export/assets/sounds/1.wav"), beep);
writeFileSync(join(game, "export/assets/captured.json"), JSON.stringify({
  v: 1, commit, looks: [
    { key: "tb_saw_2", w: 72, h: 72, frames: 1, file: "looks/1.png" },
    { key: "broken", w: 9, h: 9, frames: 1, file: "looks/2.png" },
    { key: "escape", w: 9, h: 9, frames: 1, file: "../../../project.godot" },
  ], sounds: [{ name: "jump", seconds: 0.25, file: "sounds/1.wav" }], stills: [], notes: ["a test note"],
}));
const list = await importAssets({ projectId: "unittest01", buildId: "unittest01-v1", dir: game, commit });
const by = (name) => list.assets.find((a) => a.name === name);
ok(list.source === "build", "the capture is of this commit: source build");
ok(by("Tower base saw 2")?.made === "code" && by("Tower base saw 2")?.width === 72, "the look, named by its drawing function");
ok(!list.assets.some((a) => a.key === "broken" || a.key === "escape"), "a look that isn't a picture, and one outside export/assets: left out");
ok(by("Jump")?.kind === "sound" && JSON.stringify(by("Jump")?.where) === JSON.stringify(["Player"]), `the sound made in code plays in Player (made in Sfx): ${JSON.stringify(by("Jump")?.where)}`);
ok(by("Sedan")?.made === "library" && by("Sedan")?.credit?.startsWith("Car Kit by Kenney") && by("Sedan")?.turnable, "the library model: its credit, turnable");
ok(by("Crate")?.turnable && by("Crate")?.made === "file", "the .gltf model: turnable");
ok(!list.assets.some((a) => /colormap|crate\.png|crate\.bin/.test(a.file ?? "")), "a model's texture and buffer belong to it: not listed");
ok(JSON.stringify(by("Sky")?.where) === JSON.stringify(["Player", "World"]), `the picture file is used in Player and World: ${JSON.stringify(by("Sky")?.where)}`);
ok((by("Theme")?.seconds ?? 0) === 16, `the 16 s WAV file: ${by("Theme")?.seconds}`);
ok(!list.assets.some((a) => (a.file ?? "").startsWith("test/")), "test/ isn't the game's content");
ok(list.assets.every((a) => /^[0-9a-f]{16}$/.test(a.id)) && new Set(list.assets.map((a) => a.id)).size === list.assets.length, "ids: 16 hex, unique");
ok(list.notes.some((n) => n.includes("a test note")), "the capture's notes kept (for us)");
const again = await importAssets({ projectId: "unittest01", buildId: "unittest01-v2", dir: game, commit });
ok(again.assets.find((a) => a.name === "Sedan")?.id === by("Sedan")?.id, "the same file, the same id in another version");
ok(again.assets.find((a) => a.name === "Sedan")?.blobs.file === by("Sedan")?.blobs.file, "…and the same stored file (kept once)");
const stale = await importAssets({ projectId: "unittest01", buildId: "unittest01-v3", dir: game, commit: "0".repeat(40) });
ok(stale.source === "files" && !stale.assets.some((a) => a.made === "code"), "a capture of another commit: the files only");

rmSync(game, { recursive: true, force: true });
rmSync(data, { recursive: true, force: true });
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
