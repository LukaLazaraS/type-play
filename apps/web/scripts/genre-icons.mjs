// /create's genre pictures on one contact sheet (2026-10-27): the drawn icons (public/genres/*.svg) at /create's sizes
// (72 px on a computer, 52 px on a phone, 44 px on a folded phone) and large, then Puzzle's picture now (the match-3 photo)
// beside the drawn one, and the photos Runner and Racer had before. No server needed: a page of the files, screenshotted.
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/genre-icons.mjs [out.png]
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const root = join(import.meta.dirname, "../../..");
const pub = join(root, "apps/web/public");
const out = process.argv[2] ?? join(root, ".impeccable/review/genres/genre-icons.png");
mkdirSync(dirname(out), { recursive: true });

// The order and names /create shows (content/app.ts genres, content/gallery.ts genreName).
const names = { runner: "Runner", platformer: "Platformer", puzzle: "Puzzle", racer: "Racer", shooter: "Shooter", towerdefence: "Tower defence", arcade: "Arcade", adventure: "Adventure" };
const app = readFileSync(join(root, "apps/web/src/content/app.ts"), "utf8");
const order = [...app.slice(app.indexOf("export const genres")).matchAll(/\{ id: "([a-z]+)"/g)].map((m) => m[1]).filter((g) => g in names);
const src = (p) => pathToFileURL(join(pub, p)).href;
const svg = (g) => src(`genres/${g}.svg`);
const tile = (url, size) => `<img src="${url}" width="${size}" height="${size}" style="border-radius:25%;display:block">`;
const row = (size, list = order) =>
  `<div class="row" style="grid-template-columns:repeat(4,${Math.max(size, 104)}px)">${list.map((g) => `<figure>${tile(svg(g), size)}<figcaption>${names[g]}</figcaption></figure>`).join("")}</div>`;
const pair = (label, url, size = 160) => `<figure>${tile(url, size)}<figcaption>${label}</figcaption></figure>`;

const html = `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; padding: 40px; background: #fff; color: #170d33; font: 14px/1.4 Onest, system-ui, sans-serif; width: 1180px; }
  h1 { font: 800 28px Gabarito, system-ui, sans-serif; margin: 0 0 4px; } h2 { font-size: 16px; margin: 32px 0 12px; }
  p { margin: 0; color: #53476f; }
  .row { display: grid; gap: 12px; justify-content: start; }
  figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 9px; padding: 8px 0 6px; }
  figcaption { font-weight: 600; text-align: center; }
  .cols { display: flex; gap: 56px; flex-wrap: wrap; align-items: flex-start; } .pairs { display: flex; gap: 24px; }
  .big { display: grid; grid-template-columns: repeat(4, 224px); gap: 24px; }
</style>
<h1>Genre icons</h1><p>Drawn in code (public/genres/*.svg), the site's palette, in the order /create shows them. Puzzle on /create is still the photo until Luka picks.</p>
<h2>On /create: a computer (72 px), a phone (52 px), a folded phone (44 px)</h2>
<div class="cols">${row(72)}${row(52)}${row(44)}</div>
<h2>Large</h2>
<div class="big">${order.map((g) => pair(names[g], svg(g), 224)).join("")}</div>
<h2>Puzzle: pick one (now on /create: the photo)</h2>
<div class="pairs">${pair("Puzzle now (photo)", src("games/match3_sq.jpg"))}${pair("Puzzle drawn (new)", svg("puzzle"))}${pair("now, 72 px", src("games/match3_sq.jpg"), 72)}${pair("drawn, 72 px", svg("puzzle"), 72)}</div>
<h2>Before: the photos Runner and Racer had</h2>
<div class="pairs">${pair("Runner before", src("games/runner_sunset_sq.jpg"), 104)}${pair("Runner now", svg("runner"), 104)}${pair("Racer before", src("games/car_city_sq.jpg"), 104)}${pair("Racer now", svg("racer"), 104)}</div>`;

const page = join(dirname(out), "genre-icons.html");
writeFileSync(page, html);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const tab = await browser.newPage({ viewport: { width: 1260, height: 800 }, deviceScaleFactor: 2 });
  await tab.goto(pathToFileURL(page).href);
  await tab.waitForLoadState("load");
  await tab.screenshot({ path: out, fullPage: true });
  console.log("wrote", out);
} finally {
  await browser.close();
}
