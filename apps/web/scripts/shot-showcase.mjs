// The six showcase games in the gallery (2026-10-29), end to end with screenshots, on a stack of its own on ports picked
// free and a database of its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched:
// `admin gallery showcase` twice (6 added, then nothing to change), a tester's game beside them (the fake agent's build,
// shared, in the gallery, one play), then /explore signed out at 1440 and 390 px: Popular, New and All with the seven,
// the six's kinds and posters; a showcase card opens its share page, Play starts the game there (one play counted), Full
// screen and back, Report this game sends a report. Needs the six show-*-polished builds and the engine in apps/games
// (git-ignored; a checkout without them copies apps/games/engine and builds/show-*-polished from the main one). Build the
// API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-showcase.mjs [outDir]
// Shots in .impeccable/review/showcase/. Afterwards the tester's account closes; the database goes with the run.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/showcase");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("showcase", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;

const stamp = Date.now().toString(36);
const tester = `showcase-tester-${stamp}@dev.test`;
const TESTER_GAME = "Box Cat Dash";
const SIX = [
  { id: "showracer", name: "Island Rush", kind: "Racer" },
  { id: "showarcade", name: "Sky Stack", kind: "Arcade" },
  { id: "showtd", name: "Gingerbread Guard", kind: "Tower defence" },
  { id: "showmatch3", name: "Petal Pop", kind: "Puzzle" },
  { id: "showrunner", name: "Rooftop Ninja", kind: "Runner" },
  { id: "show3d", name: "Sky Hopper", kind: "Platformer" },
];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) => {
  const send = () => fetch(`${apiBase}${path}`, { method, headers: { ...(email ? { Authorization: `Bearer dev:${email}` } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return send()
    .catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)))
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
};
const fits = (page) => page.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, page.viewportSize().width);
// textContent: a card far below the screen isn't rendered yet (content-visibility: auto), so its innerText is empty.
const names = (page) => page.locator(".library .gamecard__name").evaluateAll((els) => els.map((e) => e.textContent));
/** Scrolls every card into view, as a player scrolling down would, so each is drawn and its lazy poster loads. */
const wake = (page) =>
  page.evaluate(async () => {
    for (const card of document.querySelectorAll(".library .gamecard")) {
      card.scrollIntoView({ block: "center" });
      const img = card.querySelector("img");
      for (let i = 0; i < 40 && img && !(img.complete && img.naturalWidth > 0); i++) await new Promise((r) => setTimeout(r, 100));
    }
  });
/** Every card's poster has loaded (a picture, not the letter tile a missing one falls back to). */
const postersOf = (page, wanted) =>
  page.evaluate(
    (wanted) =>
      wanted.map((name) => {
        const card = [...document.querySelectorAll(".library .gamecard")].find((c) => c.querySelector(".gamecard__name")?.textContent === name);
        const img = card?.querySelector("img");
        return { name, poster: !!img && img.complete && img.naturalWidth > 0, meta: card?.querySelector(".glist__meta")?.textContent?.replace(/ /g, " ") ?? null };
      }),
    wanted,
  );
async function sorted(page, sort) {
  await page.getByRole("radio", { name: sort, exact: true }).click();
  await page.locator(".library__grid:not([aria-busy])").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(300);
}

// ---- The stack ------------------------------------------------------------------------------------
const children = [];
function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let log = "";
  child.stdout.on("data", (d) => (log = (log + d).slice(-4000)));
  child.stderr.on("data", (d) => (log = (log + d).slice(-4000)));
  children.push({ name, child });
  return { child, log: () => log };
}
function stopAll() {
  for (const { child } of children.reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGKILL");
  }
}
async function until(what, test, seconds, log) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await test().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} did not start: ${log?.() ?? ""}`);
}

const tsconfig = join(webDir, "tsconfig.json");
const tsconfigBefore = readFileSync(tsconfig, "utf8");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, { PORT: String(API_PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0" });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/showcase",
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_CLOSED_BETA: "",
    NEXT_PUBLIC_API_ORIGIN: apiBase,
    NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${GAMES_PORT}`,
    NEXT_PUBLIC_PADDLE_ENV: "",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
  });
  await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 180, siteProc.log);
  console.log(`stack up: site :${SITE_PORT}, API :${API_PORT}, games :${GAMES_PORT}`);

  // ---- The command, twice ----------------------------------------------------------------------------
  const first = admin("gallery", "showcase");
  check("admin gallery showcase: 6 added", first.status === 0 && /6 added to the gallery/.test(first.stdout), (first.stderr || first.stdout).trim().split("\n").slice(-2).join(" / "));
  const again = admin("gallery", "showcase");
  check("run again: nothing to change", again.status === 0 && /nothing to change/.test(again.stdout), again.stdout.trim().split("\n").at(-1));

  // ---- A tester's game beside them: built, shared, in the gallery, played once ---------------------------
  await api(tester, "GET", "/me");
  const made = (await api(tester, "POST", "/projects", { prompt: "Make an endless runner where a cat jumps over boxes GENRE:runner", model: "fast" })).body;
  for (let i = 0; i < 120; i++) {
    if ((await api(tester, "GET", `/projects/${made.id}`)).body?.status === "idle") break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const listed = (await api(tester, "PATCH", `/projects/${made.id}`, { name: TESTER_GAME, shared: true, listed: true })).body;
  check("a tester's game: built, shared, in the gallery", listed?.listed === true && !!listed.buildId);
  check("…played once", (await api(null, "POST", `/public/games/${made.id}/play`)).status === 204);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  for (const [label, viewport, phone] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, ...(phone ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("page error:", e.message));
    await page.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator(".feature").waitFor({ timeout: 120_000 });
    await page.waitForLoadState("networkidle");
    // Popular: the week's most played on top (the tester's, one play), then the six at 0 plays in the home page's order.
    const popular = await names(page);
    check(`${label} Popular: the tester's game on top in its frame`, (await page.locator(".feature__name").innerText()) === TESTER_GAME);
    check(`${label} Popular: the seven, the six in the home page's order after it`, popular.join() === [TESTER_GAME, ...SIX.map((g) => g.name)].join(), popular.join(", "));
    await wake(page);
    const cards = await postersOf(page, SIX.map((g) => g.name));
    // At 390 Island Rush has the play from the 1440 pass ("1 play this week · Racer").
    const kindOk = (c, i) => (phone ? c.meta.endsWith(SIX[i].kind) : c.meta === SIX[i].kind);
    check(`${label}: each showcase card has its poster and its kind${phone ? "" : ", no plays"}`, cards.every((c, i) => c.poster && kindOk(c, i)), JSON.stringify(cards));
    check(`${label}: nothing wider than the screen`, await fits(page));
    await shot(page, `explore-${label}-last-cards`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, `explore-${label}`);
    await page.evaluate(() => window.scrollTo(0, document.querySelector(".library")?.getBoundingClientRect().top + window.scrollY - 16));
    await shot(page, `explore-${label}-library`);
    await page.evaluate(() => window.scrollTo(0, 0));
    await sorted(page, "New");
    check(`${label} New: the tester's game (listed last) first, then the six`, (await names(page)).join() === [TESTER_GAME, ...SIX.map((g) => g.name)].join());
    await sorted(page, "All");
    const az = await names(page);
    check(`${label} All: the seven A to Z`, az.length === 7 && az.every((n, i) => i === 0 || az[i - 1].localeCompare(n, "en", { sensitivity: "base" }) <= 0), az.join(", "));
    await shot(page, `explore-all-${label}`);
    await page.getByRole("radio", { name: "Platformer" }).click();
    await page.locator(".library__grid:not([aria-busy])").waitFor({ timeout: 30_000 });
    check(`${label} the Platformer kind: Sky Hopper`, (await names(page)).join() === "Sky Hopper");
    await page.getByRole("radio", { name: "Any genre" }).click();
    await page.locator(".library__grid:not([aria-busy])").waitFor({ timeout: 30_000 });

    // A showcase game's share page: its card opens it; Play, Full screen, Report.
    const link = page.getByRole("link", { name: "Play Island Rush" });
    check(`${label}: Island Rush's card opens its share page`, (await link.getAttribute("href")) === "/play/showracer");
    if (!phone) {
      await page.goto(`${base}/play/showracer`, { waitUntil: "domcontentloaded" });
      await page.locator(".play__name").waitFor({ timeout: 60_000 });
      await page.waitForLoadState("networkidle");
      const sent = page.waitForResponse((r) => r.url().endsWith("/public/games/showracer/play") && r.request().method() === "POST", { timeout: 120_000 });
      sent.catch(() => {});
      await page.getByRole("button", { name: /^Play / }).click();
      await page.locator(".gameframe[data-ready]").waitFor({ timeout: 120_000 });
      check("Play: Island Rush starts in its frame, one play sent (204)", (await sent).status() === 204);
      await page.waitForTimeout(2500); // the game's first frames
      await shot(page, "showcase-play-1440");
      await page.getByRole("button", { name: "Full screen" }).click();
      await page.waitForTimeout(1500);
      check("Full screen: the frame fills the window", await page.evaluate(() => { const f = document.querySelector(".gameframe")?.getBoundingClientRect(); return !!f && f.width >= window.innerWidth - 2 && f.height >= window.innerHeight - 2; }));
      await shot(page, "showcase-fullscreen-1440");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      const plays = (await db.query(`SELECT coalesce(sum(count), 0)::int AS n FROM "PlayCount" WHERE "projectId" = 'showracer'`)).rows[0].n;
      check("the database counts Island Rush's play: 1", plays === 1, String(plays));
      const report = page.getByRole("button", { name: "Report this game" });
      for (let i = 0; i < 10 && !(await page.locator("dialog[open]").count()); i++) {
        await report.click();
        await page.waitForTimeout(800);
      }
      check("Report this game: the dialog for Island Rush", (await page.locator("dialog[open] .dialog__title").innerText()) === "Report Island Rush");
      await page.locator(".choice", { hasText: "Something else" }).click();
      await page.getByRole("button", { name: "Send report" }).click();
      await page.locator('dialog[open] [role="status"]').waitFor({ timeout: 15_000 });
      await shot(page, "showcase-report-sent-1440");
      const reports = (await db.query(`SELECT reason FROM "GameReport" WHERE "projectId" = 'showracer'`)).rows;
      check("…sent and stored", reports.length === 1 && reports[0].reason === "other");
      await page.keyboard.press("Escape");
    } else {
      await page.goto(`${base}/play/showrunner`, { waitUntil: "domcontentloaded" });
      await page.locator(".play__name").waitFor({ timeout: 60_000 });
      await page.waitForLoadState("networkidle");
      check("390: Rooftop Ninja's share page, nothing wider than the screen", (await page.locator(".play__name").innerText()) === "Rooftop Ninja" && (await fits(page)));
      await shot(page, "showcase-share-390", true);
    }
    await ctx.close();
  }
} catch (e) {
  check("the walk-through ran", false, e?.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  await api(tester, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  await db.end().catch(() => {});
  stopAll();
  writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
