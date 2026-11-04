// End-to-end test of the Assets tab's API (2026-11-04) against an API of its own on a free port with fake builds
// (DEV_AUTH=1 AGENT_FAKE=1; src/runs/fake-assets.ts), on a database of the run's own (test/test-db.mjs):
//   npm run build -w @typeplay/server && npm run test:assets:e2e -w @typeplay/server
// A 2D game (looks drawn in code, one with 4 frames; sounds made in code; a picture, a sound and a font file), a 3D game
// (a library model whose texture sits beside it, a .gltf with an outside .bin, a picture, 16 s of music), a game with
// nothing to list, a build whose capture failed (its files only), a game from before the tab (listed from its files at
// the first ask; an older version: "none"); each file, picture and thumbnail with its type and headers; another user,
// a bad id, an unknown build and no sign-in refused; a restore; the lists and their files gone with the game.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { freePort } from "../../../scripts/test-run.mjs";
import { useTestDatabase } from "./test-db.mjs";

const here = resolve(import.meta.dirname, "..");
const root = resolve(here, "../..");
await useTestDatabase();
const PORT = await freePort();
const API = `http://127.0.0.1:${PORT}`;
const DATA = resolve(process.env.DATA_DIR || join(root, "data"));
const stamp = Date.now().toString(36);
const A = `dev:assets-${stamp}-a@test.local`;
const B = `dev:assets-${stamp}-b@test.local`;
const emailOf = (t) => t.slice(4);
let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const admin = (...args) => spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: here, encoding: "utf8" });

async function api(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
async function raw(token, path) {
  const res = await fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) };
}
/** The game once its build has ended (idle again). */
async function settled(token, id) {
  for (let i = 0; i < 120; i++) {
    const p = (await api(token, "GET", `/projects/${id}`)).body;
    if (p && p.status === "idle" && p.messages.at(-1)?.status !== "running") return p;
    await sleep(500);
  }
  throw new Error(`${id} never finished`);
}
async function build(prompt) {
  const r = await api(A, "POST", "/projects", { prompt, model: "fast" });
  if (r.status !== 201) throw new Error(`POST /projects ${r.status}: ${JSON.stringify(r.body)}`);
  const p = await settled(A, r.body.id);
  if (!p.buildId) throw new Error(`no build for "${prompt}": ${JSON.stringify(p.messages.at(-1))}`);
  return p;
}
const isPng = (b) => b.length > 24 && b.readUInt32BE(0) === 0x89504e47;
const pngSize = (b) => [b.readUInt32BE(16), b.readUInt32BE(20)];
const isWebp = (b) => b.length > 12 && b.toString("latin1", 0, 4) === "RIFF" && b.toString("latin1", 8, 12) === "WEBP";

let child = null;
let log = "";
/** The API under test, (re)started on the same port: a fresh process knows only the lists on disk. */
async function startApi() {
  if (child) {
    child.kill();
    await new Promise((r) => (child.exitCode !== null ? r() : child.once("exit", r)));
  }
  child = spawn(process.execPath, ["dist/main.js"], {
    cwd: here,
    env: { ...process.env, PORT: String(PORT), DEV_AUTH: "1", AGENT_FAKE: "1", BILLING_JOBS: "0" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  child.stdout.on("data", (d) => (log = (log + d).slice(-20_000)));
  child.stderr.on("data", (d) => (log = (log + d).slice(-20_000)));
  for (let i = 0; ; i++) {
    if (i > 120) throw new Error(`the API did not start: ${log.slice(-1500)}`);
    const h = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
    if (h?.agent === "fake") return;
    await sleep(500);
  }
}
const projects = [];
try {
  await startApi();
  await api(A, "GET", "/me");
  await api(B, "GET", "/me");
  ok(admin("plan", emailOf(A), "medium").status === 0 && admin("grant", emailOf(A), "60").status === 0, "the maker on Medium + 60 credits");

  console.log("a 2D game: looks and sounds made in code, a picture, a sound and a font file");
  const g2 = await build("A slime game with bats ASSETS");
  projects.push(g2.id);
  const list2 = await api(A, "GET", `/projects/${g2.id}/assets/${g2.buildId}`);
  ok(list2.status === 200 && list2.body.source === "build" && list2.body.buildId === g2.buildId, `listed when built (${list2.status}, ${list2.body?.source})`);
  const a2 = list2.body.assets;
  const by = (list, name) => list.find((a) => a.name === name);
  ok(a2.length === 9 && by(a2, "Sky bg")?.key === "bg", `9 assets: 4 looks, 2 sounds made in code, a picture, a sound and a font (${a2.map((a) => a.name).join(", ")})`);
  ok(by(a2, "Gold coin")?.made === "code" && by(a2, "Gold coin")?.key === "coin" && by(a2, "Gold coin")?.width === 40, "the look the AI named: Gold coin, 40 px");
  ok(JSON.stringify(by(a2, "Gold coin")?.where) === JSON.stringify(["Hud"]), `…used in the HUD, not in art.gd that draws it (${JSON.stringify(by(a2, "Gold coin")?.where)})`);
  const slime = by(a2, "Enemy slime");
  ok(slime?.frames === 4 && slime.width === 64 && slime.format === "png", "an animated look named by its drawing function: Enemy slime, 4 frames of 64 px");
  ok(JSON.stringify(slime?.where) === JSON.stringify(["Enemy"]), `…used in Enemy (${JSON.stringify(slime?.where)})`);
  ok(by(a2, "Jump")?.kind === "sound" && by(a2, "Jump")?.made === "code" && by(a2, "Jump")?.seconds === 0.13 && JSON.stringify(by(a2, "Jump")?.where) === JSON.stringify(["Player"]), "a sound made in code: Jump, 0.13 s, plays in Player");
  ok(by(a2, "Hero")?.made === "file" && by(a2, "Hero")?.file === "assets/hero.png" && JSON.stringify(by(a2, "Hero")?.where) === JSON.stringify(["Player"]), "a picture file: Hero, used in Player");
  ok(by(a2, "Coin")?.kind === "sound" && by(a2, "Coin")?.format === "wav", "a sound file: Coin");
  ok(by(a2, "Font")?.kind === "font" && by(a2, "Font")?.format === "ttf" && JSON.stringify(by(a2, "Font")?.where) === JSON.stringify(["Hud"]), "a font file, used in the HUD");
  ok(a2.every((a) => !("blobs" in a) && !("types" in a)), "nothing of how files are kept reaches the site");

  console.log("the files");
  const base = `/projects/${g2.id}/assets/${g2.buildId}`;
  const sheet = await raw(A, `${base}/${slime.id}`);
  ok(sheet.status === 200 && sheet.headers.get("content-type") === "image/png" && isPng(sheet.buf) && pngSize(sheet.buf).join("x") === "256x64", `Download of the animated look: its sprite sheet, 256×64 PNG (${pngSize(sheet.buf).join("x")})`);
  ok(sheet.headers.get("content-disposition") === 'attachment; filename="enemy-slime.png"', `…named after it (${sheet.headers.get("content-disposition")})`);
  ok(sheet.headers.get("cache-control") === "private, no-store" && sheet.headers.get("x-content-type-options") === "nosniff" && /sandbox/.test(sheet.headers.get("content-security-policy") ?? ""), "…never cached by anything shared, never sniffed, sandboxed");
  const first = await raw(A, `${base}/${slime.id}/picture`);
  ok(first.status === 200 && isPng(first.buf) && pngSize(first.buf).join("x") === "64x64" && first.headers.get("content-disposition") === "inline", "its picture: the first frame, 64×64");
  const thumb = await raw(A, `${base}/${slime.id}/thumb`);
  ok(thumb.status === 200 && thumb.headers.get("content-type") === "image/webp" && isWebp(thumb.buf), "its thumbnail: WebP");
  const bg = a2.find((a) => a.key === "bg");
  const bgThumb = await raw(A, `${base}/${bg.id}/thumb`);
  ok(bgThumb.status === 200 && isWebp(bgThumb.buf) && bgThumb.buf.readUInt32LE(4) > 0, "a big look's thumbnail too");
  const jump = await raw(A, `${base}/${by(a2, "Jump").id}`);
  ok(jump.status === 200 && jump.headers.get("content-type") === "audio/wav" && jump.buf.toString("latin1", 0, 4) === "RIFF", "a sound made in code downloads as WAV");
  ok((await raw(A, `${base}/${by(a2, "Jump").id}/picture`)).status === 404, "a sound has no picture: 404");
  const font = await raw(A, `${base}/${by(a2, "Font").id}`);
  ok(font.status === 200 && font.headers.get("content-type") === "font/ttf" && font.buf.readUInt32BE(0) === 0x00010000, "the font file as it is");
  const hero = await raw(A, `${base}/${by(a2, "Hero").id}/picture`);
  ok(hero.status === 200 && isPng(hero.buf) && pngSize(hero.buf).join("x") === "64x64", "a picture file's picture (decoded and encoded again)");

  console.log("only its owner");
  ok((await api(B, "GET", base)).status === 404, "another user: 404 for the list");
  ok((await raw(B, `${base}/${slime.id}`)).status === 404 && (await raw(B, `${base}/${slime.id}/thumb`)).status === 404, "…and for its files");
  ok((await raw(null, `${base}/${slime.id}`)).status === 401 && (await api(null, "GET", base)).status === 401, "no sign-in: 401");
  ok((await raw(A, `${base}/0123456789abcdef`)).status === 404 && (await raw(A, `${base}/not-an-id`)).status === 404, "an unknown or bad asset id: 404");
  ok((await api(A, "GET", `/projects/${g2.id}/assets/${g2.id}-v9`)).status === 404 && (await api(A, "GET", `/projects/${g2.id}/assets/robot-runner`)).status === 404, "a build that is none of the game's versions: 404");
  ok((await api(A, "GET", `/projects/${g2.id}/assets/..%2F..%2Fetc`)).status === 404, "a path for a build id: 404");

  console.log("a 3D game");
  const g3 = await build("A car game in a city ASSETS3D");
  projects.push(g3.id);
  const list3 = (await api(A, "GET", `/projects/${g3.id}/assets/${g3.buildId}`)).body;
  const a3 = list3.assets;
  const sedan = by(a3, "Sedan");
  ok(sedan?.kind === "model" && sedan.made === "library" && sedan.credit === "Car Kit by Kenney (www.kenney.nl), CC0 1.0" && sedan.turnable && sedan.picture, "the library model: its credit, turnable, its still");
  ok(by(a3, "Crate")?.turnable && by(a3, "Crate")?.picture === false, "the .gltf model: turnable, no still");
  ok(!a3.some((a) => /colormap|crate\.(png|bin)/.test(a.file ?? "")), "its texture and buffer are part of it, not listed");
  ok(by(a3, "Theme")?.seconds === 16 && by(a3, "Sky")?.kind === "picture", "16 s of music and a picture file");
  const glb = await raw(A, `/projects/${g3.id}/assets/${g3.buildId}/${sedan.id}`);
  const json = glb.status === 200 ? JSON.parse(glb.buf.subarray(20, 20 + glb.buf.readUInt32LE(12)).toString("utf8")) : null;
  ok(glb.headers.get("content-type") === "model/gltf-binary" && glb.headers.get("content-disposition") === 'attachment; filename="sedan.glb"', "the model downloads as one .glb");
  ok(json && !json.images[0].uri && json.images[0].mimeType === "image/png" && typeof json.images[0].bufferView === "number", "…with its texture inside");
  const still = await raw(A, `/projects/${g3.id}/assets/${g3.buildId}/${sedan.id}/picture`);
  ok(still.status === 200 && isPng(still.buf), "its still: a PNG");

  console.log("nothing to list, a capture that failed, a game from before the tab");
  const g0 = await build("A tiny game that draws everything as it runs");
  projects.push(g0.id);
  const list0 = (await api(A, "GET", `/projects/${g0.id}/assets/${g0.buildId}`)).body;
  ok(list0.source === "build" && list0.assets.length === 0, "a game with nothing to list: source build, no assets");
  const gf = await build("A slime game whose capture failed ASSETS NOCAPTURE");
  projects.push(gf.id);
  const listF = (await api(A, "GET", `/projects/${gf.id}/assets/${gf.buildId}`)).body;
  ok(listF.source === "files" && listF.assets.length === 3 && !listF.assets.some((a) => a.made === "code"), `no capture: the files only (${listF.assets.map((a) => a.name).join(", ")})`);
  // A game from before the tab: its list never made (the lists' files taken away), then a change, then the first version's.
  const listsDir = join(DATA, "assets", g2.id, "builds");
  rmSync(join(listsDir, `${g2.buildId}.json`), { force: true });
  await startApi(); // a fresh process: no list in memory either
  const late = await api(A, "GET", base);
  ok(late.status === 200 && late.body.source === "files" && late.body.assets.length === 3, `the current version, listed from its files at the first ask (${late.body?.source}, ${late.body?.assets?.length})`);
  ok(existsSync(join(listsDir, `${g2.buildId}.json`)), "…and kept");
  const changed = await api(A, "POST", `/projects/${g2.id}/messages`, { text: "Make the slime blue ASSETS", model: "fast" });
  ok(changed.status === 201, "a change");
  const v2 = await settled(A, g2.id);
  ok(v2.buildId === `${g2.id}-v2` && (await api(A, "GET", `/projects/${g2.id}/assets/${v2.buildId}`)).body.source === "build", "version 2: listed when built");
  rmSync(join(listsDir, `${g2.buildId}.json`), { force: true });
  await startApi();
  const old = await api(A, "GET", base);
  ok(old.status === 200 && old.body.source === "none" && old.body.assets.length === 0, "an older version without a list: none (its files are only in its history)");
  const restored = await api(A, "POST", `/projects/${g2.id}/restore`, { n: 2 });
  ok(restored.status === 200 || restored.status === 201, "a restore of version 2");
  const v3 = await settled(A, g2.id);
  const listR = await api(A, "GET", `/projects/${g2.id}/assets/${v3.buildId}`);
  ok(v3.buildId === `${g2.id}-v2` && listR.body?.source === "build" && listR.body.assets.length === 9, "the restored version shares version 2's build and its list");

  console.log("deleted with the game");
  ok(existsSync(join(DATA, "assets", g2.id)), "the game's lists and files exist");
  ok((await api(A, "DELETE", `/projects/${g2.id}`)).status === 200, "the game deleted");
  ok(!existsSync(join(DATA, "assets", g2.id)), "…its lists and files with it");
  projects.splice(projects.indexOf(g2.id), 1);
} catch (e) {
  failures++;
  console.log(`  FAIL ${e.stack ?? e}`);
  console.log(log.slice(-3000));
} finally {
  for (const id of projects) await api(A, "DELETE", `/projects/${id}`).catch(() => {});
  for (const t of [A, B]) await api(t, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  child?.kill();
}
const left = existsSync(join(DATA, "assets")) ? readdirSync(join(DATA, "assets")).filter((d) => projects.includes(d)) : [];
ok(left.length === 0, "no lists left behind");
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
