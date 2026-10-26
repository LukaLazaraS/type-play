// /create's Genre and Tags (Luka 10-27), end to end with screenshots, on a stack of its own on ports picked free and a
// database of its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched: the API (DEV_AUTH=1,
// AGENT_FAKE=1; game folders in data/shots/kinds-data), the games origin, the site (`next dev` with its own
// NEXT_DIST_DIR, .next/kinds; tsconfig.json is put back afterwards).
// Build the API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-kinds.mjs [outDir]
// Shots in .impeccable/review/kinds/. Checks: the four genre pictures, none picked at first and the line saying the AI
// decides from the idea; a tap picks one (the ring, the check, its line), a tap on another moves the pick, a tap on the
// picked one picks none; the arrow keys and Space; what screen readers are told; the tags as toggles (aria-pressed),
// several at once, never both 2D and 3D nor Cozy and Hard; a chip's focus ring; the lines under both keep their room, so
// nothing under them moves; no example idea goes into the box; the picks sent with the build and recorded (the project,
// the game folder's GENRE and TAGS), then cleared for the next game and for a new idea from the home page; picks made
// signed out kept through the sign-in. Worst cases: picks an older page kept (unknown ones, both of a pair), the page
// while the build is sent, 200% zoom, phones at 390, 320 and 280 px by touch with every tag that can go together.
// Afterwards the test account closes and the database goes.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/kinds");
mkdirSync(out, { recursive: true });
const [site, apiPort, games, proxy] = await useOwnStack("kinds", 4);
const PORT = { site, api: apiPort, games, proxy };
const base = `http://localhost:${PORT.site}`;
const apiBase = `http://127.0.0.1:${PORT.api}`;
const DATA = join(root, "data/shots/kinds-data");

const stamp = Date.now().toString(36);
const maker = `kinds-${stamp}@dev.test`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(250); // past the 160 ms ring and colour changes
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("wrote", name);
};
const env = { DATA_DIR: DATA }; // the run's own database comes in DATABASE_URL (useOwnStack)
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ...env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) =>
  fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
/** Genre and Tags inside the screen: every part of both sections within the screen's width (a phone emulated in the browser
 * widens its window to whatever is wider, so the page's own width can't tell). */
const fits = (page, w) =>
  page.evaluate((w) => [...document.querySelectorAll(".iconchoice *, .tags *")].every((e) => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= -0.5 && r.right <= w + 0.5); }), w);
/** The whole page's width against the screen's (a note, not a check: the header is not this branch's). */
const pageWidth = (page) => page.evaluate(() => document.documentElement.scrollWidth);
const file = (id, name) => (existsSync(join(DATA, "projects", id, name)) ? readFileSync(join(DATA, "projects", id, name), "utf8").trim() : null);

// ---- The stack ------------------------------------------------------------------------------------
const children = [];
function start(name, args, cwd, extra) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...extra }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
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
rmSync(DATA, { recursive: true, force: true });
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, {
    ...env,
    PORT: String(PORT.api),
    KEY_PROXY_PORT: String(PORT.proxy),
    DEV_AUTH: "1",
    AGENT_FAKE: "1",
    ADMIN_EMAILS: "",
    CORS_ORIGINS: base,
    BILLING_JOBS: "0",
    BETA_INVITE_ONLY: "",
  });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 90, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(PORT.games)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${PORT.games}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(PORT.site)], webDir, {
    NEXT_DIST_DIR: ".next/kinds",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_CLOSED_BETA: "",
    NEXT_PUBLIC_API_ORIGIN: apiBase,
    NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${PORT.games}`,
    NEXT_PUBLIC_PADDLE_ENV: "",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
  });
  await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 240, siteProc.log);
  console.log(`stack up: site :${PORT.site}, API :${PORT.api}, games :${PORT.games}`);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const IDEA = "A game about a fox who collects berries in a forest";
  const genreNames = (page) => page.locator(".iconchoice__name").allInnerTexts().then((t) => t.map((s) => s.trim()).join("|"));
  const pickedGenre = (page) => page.locator(".iconchoice__opt[data-on] .iconchoice__name").innerText().then((t) => t.trim(), () => "");
  const genreLine = (page) => page.locator(".iconchoice .field-hint[data-on]").innerText().then((t) => t.trim(), () => "");
  const tagLine = (page) => page.locator(".tags .field-hint[data-on]").innerText().then((t) => t.trim(), () => "");
  const pressed = (page) => page.locator('.tags .chip[aria-pressed="true"]').allInnerTexts().then((t) => t.map((s) => s.trim()).join("|"));
  const tag = (page, name) => page.locator(".tags .chip", { hasText: new RegExp(`^${name}$`) });
  const genre = (page, name) => page.locator(".iconchoice__opt", { hasText: name });
  /** The page answers taps once React has taken over the server's HTML (its props sit on the elements): before that, a
   * tap on a picture does nothing. */
  const hydrated = (page) =>
    page.waitForFunction(() => {
      const input = document.querySelector(".iconchoice input");
      return !!input && Object.keys(input).some((k) => k.startsWith("__reactProps"));
    }, null, { timeout: 300_000 });
  /** Where the sections under the picks start: a pick must never move them. */
  const tops = (page) =>
    page.evaluate(() => ["#tags-label", ".made", ".choices"].map((s) => Math.round((document.querySelector(s)?.getBoundingClientRect().top ?? -1) + window.scrollY)).join(","));
  async function signIn(page, idea = IDEA) {
    await page.goto(`${base}/create?prompt=${encodeURIComponent(idea)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", maker);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }

  // ---- A computer: signed out first (the picks survive the sign-in), then every way to pick ------------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desk.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  page.on("console", (m) => m.type() === "error" && console.log("console error:", m.text().slice(0, 300)));
  // The first visit compiles /create in `next dev`: minutes on a busy PC.
  await page.goto(`${base}/create?prompt=${encodeURIComponent(IDEA)}`, { waitUntil: "domcontentloaded", timeout: 300_000 });
  await page.locator(".iconchoice").waitFor({ timeout: 300_000 }).catch(async (e) => {
    console.log("the page instead:", (await page.locator("body").innerText().catch(() => "")).slice(0, 600));
    throw e;
  });
  await hydrated(page);
  check("signed out: Genre with the four pictures", (await genreNames(page)) === "Runner|Puzzle|Racer|Tower defence", await genreNames(page));
  check("…and Tags as toggles", (await page.locator(".tags .chip[aria-pressed]").count()) >= 3);
  await genre(page, "Puzzle").click();
  await tag(page, "Retro").click();
  await shot(page, "signed-out-picked-desktop");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".iconchoice").waitFor({ timeout: 60_000 });
  await hydrated(page);
  await page.waitForTimeout(400);
  check("the picks made signed out stay through a reload (the trip to Google)", (await pickedGenre(page)) === "Puzzle" && (await pressed(page)) === "Retro", `${await pickedGenre(page)} / ${await pressed(page)}`);
  await page.locator("#dev-email").waitFor({ timeout: 120_000 });
  await page.fill("#dev-email", maker);
  await page.getByRole("button", { name: "Dev sign-in" }).click();
  await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  check("…and through the sign-in", (await pickedGenre(page)) === "Puzzle" && (await pressed(page)) === "Retro", `${await pickedGenre(page)} / ${await pressed(page)}`);
  check("admin plan medium (room for the builds)", admin("plan", maker, "medium").status === 0);
  // Clear both, as a player would: tap the picked ones again.
  await genre(page, "Puzzle").click();
  await tag(page, "Retro").click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  check("cleared picks stay cleared after a reload", (await pickedGenre(page)) === "" && (await pressed(page)) === "");
  check("none picked: the line says the AI decides from the idea, and that one can be picked", /^None picked: the AI decides from your idea\. Pick one to choose it yourself\.$/.test(await genreLine(page)), await genreLine(page));
  check("no tags: the line says pick any, and the two pairs", /^Pick any that fit, or none\. 2D or 3D, Cozy or Hard: never both\.$/.test(await tagLine(page)), await tagLine(page));
  await shot(page, "create-none-desktop");
  await shot(page, "create-none-desktop-full", true);
  const at = await tops(page);
  const box = await page.locator("#idea").inputValue();

  // Genre: one at most.
  await genre(page, "Puzzle").click();
  check("a tap on Puzzle picks it", (await pickedGenre(page)) === "Puzzle" && (await page.locator("input[name=genre][value=puzzle]").isChecked()));
  check("Puzzle's line, and how to let the AI pick", /^Match, push or slide pieces on a board\. Pick it again to let the AI decide\.$/.test(await genreLine(page)), await genreLine(page));
  await page.waitForTimeout(300); // past the check's 160 ms fade
  check("the check over its corner shows", await page.locator(".iconchoice__opt[data-on] .iconchoice__check").evaluate((e) => getComputedStyle(e).opacity === "1"));
  check("no example idea goes into the box", (await page.locator("#idea").inputValue()) === box);
  await shot(page, "genre-puzzle-desktop");
  await genre(page, "Racer").click();
  check("a tap on Racer moves the pick: one genre at most", (await pickedGenre(page)) === "Racer" && (await page.locator(".iconchoice__opt[data-on]").count()) === 1);
  await genre(page, "Racer").click();
  check("a tap on the picked one picks none", (await pickedGenre(page)) === "" && /^None picked/.test(await genreLine(page)));
  check("picks don't move what is under them", (await tops(page)) === at, `${at}, then ${await tops(page)}`);
  // The keyboard: radios (the arrows move the pick, as in Made for), Space on the picked one picks none.
  await page.locator("input[name=genre][value=runner]").focus();
  await page.keyboard.press("Space");
  check("Space picks the focused genre (Runner)", (await pickedGenre(page)) === "Runner");
  await page.keyboard.press("ArrowRight");
  check("the arrow keys move the pick (Runner, then Puzzle)", (await pickedGenre(page)) === "Puzzle");
  check("the focus ring goes round the picture", await page.locator(".iconchoice__opt:has(input:focus-visible) .iconchoice__pic").evaluate((e) => getComputedStyle(e).outlineStyle === "solid" && getComputedStyle(e).outlineColor !== "rgb(23, 13, 51)"));
  await shot(page, "genre-keyboard-focus-desktop");
  await page.keyboard.press("Space");
  check("Space on the picked one picks none", (await pickedGenre(page)) === "");
  const a11y = await page.evaluate(() => ({
    legend: document.querySelector(".iconchoice legend")?.textContent?.trim(),
    radios: [...document.querySelectorAll("input[name=genre]")].map((r) => r.labels?.[0]?.textContent?.trim()).join("|"),
    described: [...document.querySelectorAll("input[name=genre]")].every((r) => !/again/.test(document.getElementById(r.getAttribute("aria-describedby") ?? "")?.textContent ?? "again")),
    optional: document.getElementById(document.querySelector(".iconchoice")?.getAttribute("aria-describedby") ?? "")?.textContent ?? "",
    group: document.querySelector(".tags")?.getAttribute("role") + ":" + document.getElementById(document.querySelector(".tags")?.getAttribute("aria-labelledby") ?? "")?.textContent?.trim(),
    toggles: [...document.querySelectorAll(".tags .chip")].every((b) => b.getAttribute("aria-pressed") === "false" && !!document.getElementById(b.getAttribute("aria-describedby") ?? "")),
  }));
  check("screen readers: the genre group named Genre, each radio by its name and described by its line", a11y.legend === "Genre" && a11y.radios === "Runner|Puzzle|Racer|Tower defence" && a11y.described && /^Optional\./.test(a11y.optional), JSON.stringify(a11y));
  check("screen readers: the tags a group named Tags, each a toggle (aria-pressed) described by its line", a11y.group === "group:Tags" && a11y.toggles, JSON.stringify(a11y));

  // Tags: several at once; 2D or 3D, never both.
  await tag(page, "3D").click();
  check("a tap on 3D presses it", (await pressed(page)) === "3D");
  check("3D's line", /^A 3D world/.test(await tagLine(page)), await tagLine(page));
  await shot(page, "tags-3d-desktop");
  await tag(page, "2D").click();
  check("a tap on 2D: 2D on, 3D off (never both)", (await pressed(page)) === "2D");
  await tag(page, "3D").click();
  check("a tap on 3D again: 3D on, 2D off", (await pressed(page)) === "3D");
  await tag(page, "Retro").click();
  check("Retro with 3D: several at once", (await pressed(page)) === "3D|Retro");
  check("Retro's line (the one touched last)", /^Big pixels/.test(await tagLine(page)), await tagLine(page));
  await tag(page, "Cozy").click();
  await tag(page, "Hard").click();
  check("Cozy, then Hard: Hard on, Cozy off (their rules contradict, never both)", (await pressed(page)) === "3D|Retro|Hard");
  await tag(page, "Cozy").click();
  check("…and Cozy again: Cozy on, Hard off", (await pressed(page)) === "3D|Retro|Cozy");
  await tag(page, "Cozy").click();
  // The keyboard on a chip: its focus ring (Tab from the genre's radio lands on the first chip).
  await page.locator(".tags .chip").first().focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  check("a chip takes the keyboard's focus ring", await page.evaluate(() => document.activeElement?.matches(".tags .chip:focus-visible") ?? false));
  await shot(page, "tags-keyboard-focus-desktop");
  const widths = await page.locator(".tags .chip").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)).join(","));
  await tag(page, "Retro").click();
  await tag(page, "Retro").click();
  check("a pressed chip keeps its width (the check takes the plus's place)", widths === (await page.locator(".tags .chip").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)).join(","))), widths);
  await genre(page, "Racer").click();
  check("tags and genre together don't move what is under them", (await tops(page)) === at, `${at}, then ${await tops(page)}`);
  await shot(page, "racer-3d-retro-desktop");
  await shot(page, "racer-3d-retro-desktop-full", true);

  // The build: Racer + 3D, sent and recorded; the next game starts with none.
  await tag(page, "Retro").click();
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/projects", { timeout: 30_000 });
  await page.getByRole("button", { name: "Build my game" }).click();
  const body = (await sent).postDataJSON();
  check("the build sends the picks: genre racer, tags 3d", body?.genre === "racer" && JSON.stringify(body?.tags) === '["3d"]', JSON.stringify(body));
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  const racer = page.url().split("/").pop();
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 90_000 });
  const row = (await db.query(`SELECT "pickedGenre", tags FROM "Project" WHERE id = $1`, [racer])).rows[0];
  check("the project records them", row?.pickedGenre === "racer" && row.tags.join() === "3d", JSON.stringify(row));
  check("the game folder too: GENRE racer, TAGS 3d (what every change follows)", file(racer, "GENRE") === "racer" && file(racer, "TAGS") === "3d", `${file(racer, "GENRE")} / ${file(racer, "TAGS")}`);
  await page.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  check("the next new game starts with none picked", (await pickedGenre(page)) === "" && (await pressed(page)) === "");
  // Picks made for an idea that was never built, then a new idea from the home page: it starts with none picked.
  await genre(page, "Runner").click();
  await tag(page, "Cute").click();
  await page.goto(`${base}/create?prompt=${encodeURIComponent("A frog that hops across a river")}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/create$/, { timeout: 60_000 });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  check("a new idea from the home page starts with none picked (the old picks were for another idea)", (await pickedGenre(page)) === "" && (await pressed(page)) === "" && /frog/.test(await page.locator("#idea").inputValue()));
  // Nothing picked: nothing sent (the AI decides, as before).
  await page.locator("#idea").fill(IDEA);
  const sent2 = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/projects", { timeout: 30_000 });
  await page.getByRole("button", { name: "Build my game" }).click();
  const body2 = (await sent2).postDataJSON();
  check("nothing picked: no genre and no tags sent (the AI decides)", body2 && body2.genre === undefined && body2.tags === undefined, JSON.stringify(body2));
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 90_000 });

  // ---- Worst cases (break-ui): picks kept by another version of the site or tampered with, the page while the build is
  // being sent, 200% zoom (1440 px at 200% is 720 css px) ------------------------------------------------------------
  await page.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await page.evaluate(() => localStorage.setItem("typeplay.picks", JSON.stringify({ genre: "shooter", tags: ["2d", "3d", "cozy", "hard", "sparkly", 1] })));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  check("picks kept in the browser that aren't ours: an unknown genre and tag dropped; of each pair the second (3D, Hard)", (await pickedGenre(page)) === "" && (await pressed(page)) === "3D|Hard", `${await pickedGenre(page)} / ${await pressed(page)}`);
  await page.evaluate(() => localStorage.setItem("typeplay.picks", "{not json"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(400);
  check("…and a value that isn't JSON: nothing picked, no error", (await pickedGenre(page)) === "" && (await pressed(page)) === "");
  // While the build is being sent (the answer held back 4 s): the picks stay, the rest fades, nothing can change.
  await page.locator("#idea").fill(IDEA);
  await genre(page, "Puzzle").click();
  await tag(page, "Cozy").click();
  await page.route("**/projects", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.waitForTimeout(400);
  const busy = await page.evaluate(() => ({
    fieldset: document.querySelector(".iconchoice")?.matches(":disabled"),
    chips: [...document.querySelectorAll(".tags .chip")].every((b) => b.disabled),
    picked: document.querySelector(".iconchoice__opt[data-on] .iconchoice__name")?.textContent,
    faded: getComputedStyle(document.querySelector(".iconchoice__opt:not([data-on])")).opacity,
  }));
  check("while the build is sent: genre and tags locked, the picks stay, the others fade", busy.fieldset && busy.chips && busy.picked === "Puzzle" && busy.faded === "0.5", JSON.stringify(busy));
  await shot(page, "busy-desktop");
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  await page.unroute("**/projects");
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto(`${base}/create`, { waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  await genre(page, "Tower defence").click();
  await tag(page, "Retro").click();
  await page.locator(".iconchoice").scrollIntoViewIfNeeded();
  check("at 200% zoom (720 css px): nothing wider than the screen, the four pictures in one row", (await fits(page, 720)) && new Set(await page.locator(".iconchoice__opt").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))).size === 1);
  await shot(page, "zoom-200");
  await desk.close();

  // ---- Phones by touch: 390 and 320 px, and 280 (a folded Galaxy Fold) ------------------------------------------------
  for (const [w, h] of [[390, 844], [320, 640], [280, 653]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    p.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(p);
    await p.locator(".made").waitFor({ timeout: 60_000 });
    await p.locator(".iconchoice").scrollIntoViewIfNeeded();
    check(`/create at ${w} px: Genre and Tags inside the screen`, await fits(p, w));
    const pw = await pageWidth(p);
    if (pw > w) console.log(`note: at ${w} px the page itself is ${pw} px wide (the header, not this branch)`);
    const row = await p.locator(".iconchoice__row").boundingBox();
    const tiles = await p.locator(".iconchoice__opt").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), left: r.left, right: r.right })));
    check(`the four pictures at ${w} px: one row inside the widget`, !!row && new Set(tiles.map((t) => t.top)).size === 1 && tiles.every((t) => t.left >= 0 && t.right <= w), JSON.stringify(tiles));
    const pics = await p.locator(".iconchoice__pic").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ left: Math.round(r.left), right: Math.round(r.right) })));
    check(`the pictures at ${w} px: whole, apart from each other (room for the picked ring)`, pics.every((r, i) => r.left >= 0 && r.right <= w && (i === 0 || r.left - pics[i - 1].right >= 8)), JSON.stringify(pics));
    const pAt = await tops(p);
    await shot(p, `create-none-${w}`);
    await genre(p, "Tower defence").tap();
    await p.waitForTimeout(300); // past the check's 160 ms scale
    const badge = await p.locator(".iconchoice__opt[data-on] .iconchoice__check").boundingBox();
    check(`the check at ${w} px: whole and on the screen`, !!badge && badge.x >= 0 && badge.x + badge.width <= w && badge.width >= 23, JSON.stringify(badge));
    for (const name of ["3D", "Retro"]) await tag(p, name).tap();
    check(`by touch at ${w} px: Tower defence, 3D and Retro picked`, (await pickedGenre(p)) === "Tower defence" && (await pressed(p)) === "3D|Retro");
    const chips = await p.locator(".tags .chip").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ h: Math.round(r.height), right: r.right })));
    check(`the tags at ${w} px: each a finger tall, none past the edge`, chips.every((c) => c.h >= 44 && c.right <= w), JSON.stringify(chips));
    check(`picks at ${w} px don't move what is under them`, (await tops(p)) === pAt, `${pAt}, then ${await tops(p)}`);
    check(`picked at ${w} px: Genre and Tags inside the screen`, await fits(p, w));
    await p.locator(".iconchoice").scrollIntoViewIfNeeded();
    await shot(p, `picked-${w}`);
    // Worst case: every tag that can go together pressed (3D, not 2D), the longest lines.
    for (const t of await p.locator('.tags .chip[aria-pressed="false"]').allInnerTexts()) if (t.trim() !== "2D") await tag(p, t.trim()).tap();
    check(`every tag that can go together pressed at ${w} px: inside the screen, nothing moved`, (await fits(p, w)) && (await tops(p)) === pAt && (await pressed(p)) === "3D|Retro|Cute|Hard", await pressed(p));
    await p.locator(".tags").scrollIntoViewIfNeeded();
    await shot(p, `worst-${w}`);
    await shot(p, `worst-${w}-full`, true);
    await phone.close();
  }
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
} finally {
  await browser?.close().catch(() => {});
  try {
    const closed = await api(maker, "DELETE", "/me", { confirm: "DELETE" }).catch(() => ({ status: 0 }));
    console.log(`closed ${maker}: ${closed.status}`);
  } catch (e) {
    console.log("cleanup:", e instanceof Error ? e.message : e);
  }
  await db.end().catch(() => {});
  stopAll(); // the run's database goes as the process exits (scripts/test-run.mjs)
  rmSync(DATA, { recursive: true, force: true });
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
