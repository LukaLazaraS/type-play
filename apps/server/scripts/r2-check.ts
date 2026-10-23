// Checks the live build upload end to end: publishes one throwaway build (builds/zz-test-<random>/)
// to the typeplay-games bucket with the API's own publishBuild(), reads it back from
// https://typeplay.dev, then deletes it. Needs the R2 keys (root .env, or the api container's env):
//   npm run r2:check -w @typeplay/server
//   docker compose exec api npm run r2:check -w @typeplay/server      (on the API server)
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GAMES_PUBLISH = "r2";
const { config } = await import("../src/env.js");
const { publishBuild } = await import("../src/games/publish.js");
const { r2Delete, r2Etag } = await import("../src/games/r2.js");
const { fakePoster } = await import("../src/runs/fake-agent.js");

const origin = (process.env.GAMES_ORIGIN || "https://typeplay.dev").replace(/\/+$/, "");
const id = `zz-test-${randomBytes(4).toString("hex")}`;
const keys = [`builds/${id}/index.pck`, `builds/${id}/game.json`, `builds/${id}/poster.png`];
const md5 = (b: Buffer) => createHash("md5").update(b).digest("hex");
let failures = 0;
const ok = (cond: boolean, what: string) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};

const dir = mkdtempSync(join(tmpdir(), "r2-check-"));
const pack = Buffer.concat([Buffer.from("GDPC"), randomBytes(2048)]);
const poster = fakePoster();
mkdirSync(join(dir, "export/web"), { recursive: true });
writeFileSync(join(dir, "export/web/index.pck"), pack);
writeFileSync(join(dir, "export/screenshot-start.png"), poster);
console.log(`bucket ${config.r2.bucket}, build ${id}`);
try {
  const published = await publishBuild({ buildId: id, dir, name: "R2 check", orientation: "portrait", badge: false });
  ok(published.poster, "publishBuild says the poster went too");
  ok((await r2Etag(keys[0])) === md5(pack), "index.pck is in the bucket (same MD5)");
  ok((await r2Etag(keys[2])) === md5(poster), "poster.png is in the bucket (same MD5)");
  const png = await fetch(`${origin}/builds/${id}/poster.png`);
  ok(png.status === 200 && png.headers.get("content-type") === "image/png" && /immutable/.test(png.headers.get("cache-control") ?? ""), `poster.png serves as image/png, immutable (${png.status})`);
  const meta = await fetch(`${origin}/builds/${id}/game.json`);
  const json = meta.ok ? ((await meta.json()) as { name?: string; engine?: string; orientation?: string }) : {};
  ok(meta.status === 200 && json.name === "R2 check" && json.engine === config.godotVersion, `${origin}/builds/${id}/game.json serves (${meta.status})`);
  ok(meta.headers.get("cache-control") === "no-cache", `game.json cache-control: ${meta.headers.get("cache-control")}`);
  const pck = await fetch(`${origin}/builds/${id}/index.pck`);
  ok(pck.status === 200 && Buffer.from(await pck.arrayBuffer()).equals(pack), `index.pck serves the same bytes (${pck.status})`);
  ok(/immutable/.test(pck.headers.get("cache-control") ?? ""), `index.pck cache-control: ${pck.headers.get("cache-control")}`);
} finally {
  for (const k of keys) await r2Delete(k);
  rmSync(dir, { recursive: true, force: true });
}
ok((await r2Etag(keys[0])) === null && (await r2Etag(keys[1])) === null && (await r2Etag(keys[2])) === null, "test objects deleted from the bucket (poster too)");
const after = await fetch(`${origin}/builds/${id}/game.json`);
ok(after.status === 404, `game.json is gone from ${origin} (${after.status})`);
console.log(failures ? `${failures} check(s) failed` : "R2 publish works");
process.exit(failures ? 1 : 0);
