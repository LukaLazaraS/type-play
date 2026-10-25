// The platform choice (10-25), end to end with screenshots, on a stack of its own on spare ports so the local site on
// 3000-3002 is never touched: the API on :3051 (DEV_AUTH=1, AGENT_FAKE=1), the games origin on :3052, the site on :3050
// (`next dev` with its own NEXT_DIST_DIR, .next/platform; tsconfig.json is put back afterwards). Build the API first
// (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-platform.mjs [outDir]
// Shots in .impeccable/review/platform/. Checks: /create's Made for (Best fit / Phone / Computer / Any screen) starting
// on Best fit (Luka, 10-26: the agent picks the shape) on a computer and on a phone, its line per pick with the measured
// cost of Any screen, the pick sent with the build (Best fit: none, and the game records the shape the agent picked);
// the game page's preview opening on the game's device (iPhone for a phone game, Laptop for a
// computer game, Fill the window for one that fills every screen), the "Made for phones." hint on a computer-sized
// preview and none on the phone, its one tap putting the request in the chat (on a phone: the Chat tab), the hint gone
// once a change made the game fill every screen; a fill game played full screen on an upright phone with no turn hint
// and a wide one with it; phones at 390 and 320 px, worst cases (a 60-letter name, a long idea already in the box).
// Afterwards the test account closes (its games and builds go with it).
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useDevEnv } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/platform");
const SITE_PORT = 3050;
const API_PORT = 3051;
const GAMES_PORT = 3052;
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
mkdirSync(out, { recursive: true });
await useDevEnv();

const stamp = Date.now().toString(36);
const maker = `platform-${stamp}@dev.test`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(250); // past the switches' 160 ms colour change
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) =>
  fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
/** No sideways scrolling on a phone: the page is no wider than the screen. */
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

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
    NEXT_DIST_DIR: ".next/platform",
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

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page, idea = "Make an endless runner where a cat jumps over boxes") {
    await page.goto(`${base}/create?prompt=${encodeURIComponent(idea)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", maker);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  const picked = (page) => page.locator(".made .switch__opt[data-on]").innerText().then((t) => t.trim(), () => "");
  const line = (page) => page.locator(".made .field-hint[data-on]").innerText().then((t) => t.trim(), () => "");
  /** Where Choose the AI starts: a new pick must not move it (the line under Made for keeps the longest line's room). */
  const aiTop = (page) => page.locator(".choices").first().evaluate((el) => Math.round(el.getBoundingClientRect().top + window.scrollY));
  /** Builds the idea in the box for `name` (Best fit / Phone / Computer / Any screen; none: the default), and waits for
   * version 1. */
  async function build(page, name) {
    if (name) await page.locator(".made .switch__opt", { hasText: name }).click();
    await page.getByRole("button", { name: "Build my game" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
    const id = page.url().split("/").pop();
    await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 90_000 });
    await page.waitForTimeout(800);
    return id;
  }
  const devicePill = (page) => page.locator(".devicepick").getAttribute("aria-label").catch(() => null);
  const pickDevice = async (page, name) => {
    await page.locator(".devicepick").click();
    await page.locator(".devicemenu:popover-open").waitFor({ timeout: 5_000 });
    await page.locator(".devicemenu .menu__list button", { hasText: name }).first().click();
    await page.waitForTimeout(400);
  };
  const hintText = (page) => page.locator(".stage__busy[data-hint]").innerText().then((t) => t.replace(/\s+/g, " ").trim(), () => "");
  const lineHeight = (page) => page.locator(".stage__busy").first().evaluate((el) => Math.round(el.getBoundingClientRect().height));

  // ---- A computer: the choice, a phone game, the preview, the hint and its one tap -------------------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desk.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(page);
  check("admin plan medium (room for the builds)", admin("plan", maker, "medium").status === 0);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  check("/create: Made for with Best fit, Phone, Computer, Any screen", (await page.locator(".made .switch__opt").allInnerTexts()).map((t) => t.trim()).join("|") === "Best fit|Phone|Computer|Any screen");
  check("on a computer it starts on Best fit", (await picked(page)) === "Best fit", await picked(page));
  check("Best fit's line: the AI picks, and the trade-off", /^The AI picks/.test(await line(page)) && /bars, or turned sideways/.test(await line(page)), await line(page));
  await shot(page, "create-best-fit-desktop");
  const aiBefore = await aiTop(page);
  await page.locator(".made .switch__opt", { hasText: "Computer" }).click();
  check("Computer's line", /^Wide/.test(await line(page)), await line(page));
  check("a new pick doesn't move Choose the AI", (await aiTop(page)) === aiBefore, `${aiBefore} px, then ${await aiTop(page)} px`);
  await shot(page, "create-computer-desktop");
  await page.locator(".made .switch__opt", { hasText: "Any screen" }).click();
  check("Any screen's line: side-view games small on an upright phone, and the measured cost", /side-view games come out small/.test(await line(page)) && /7% more credits and a minute longer/.test(await line(page)), await line(page));
  await shot(page, "create-every-screen-desktop");
  await page.locator(".made .switch__opt", { hasText: "Phone" }).click();
  check("one tap on Phone picks it", (await picked(page)) === "Phone" && /^Upright/.test(await line(page)));
  // Keyboard: the arrows move the pick, as radios do.
  await page.locator(".made input[value=phone]").focus();
  await page.keyboard.press("ArrowRight");
  check("the arrow keys move it (Phone, then Computer)", (await picked(page)) === "Computer");
  await page.keyboard.press("ArrowLeft");
  const phoneGame = await build(page, "Phone");
  const phoneRow = (await db.query(`SELECT platform::text AS platform FROM "Project" WHERE id = $1`, [phoneGame])).rows[0];
  check("the build was made for phones (the project says phone)", phoneRow?.platform === "phone", phoneRow?.platform);
  check("the preview opens on the iPhone", (await devicePill(page)) === "Preview size: iPhone", await devicePill(page));
  check("no hint on the phone it is made for", (await page.locator(".fithint").count()) === 0);
  await shot(page, "game-phone-on-iphone-desktop");
  await pickDevice(page, "Laptop");
  check("on the Laptop: 'Made for phones.' and the one tap", /^Made for phones\. Ask to make it fit computers$/.test(await hintText(page)), await hintText(page));
  await shot(page, "game-phone-on-laptop-desktop");
  await pickDevice(page, "iPad");
  check("no hint on the iPad (both shapes fit a tablet)", (await page.locator(".fithint").count()) === 0);
  await pickDevice(page, "Fill the window");
  check("Fill the window is a computer: the hint again", (await page.locator(".fithint").count()) === 1);
  await page.locator("#say").fill("Add coins");
  await page.getByRole("button", { name: "Ask to make it fit computers" }).click();
  await page.waitForTimeout(200);
  const asked = await page.locator("#say").inputValue();
  check("the tap adds the request to the box, after what was there; not sent", asked === "Add coins, make it fit computer screens too." || asked === "Add coins, Make it fit computer screens too." || asked.startsWith("Add coins") && /fit computer screens too/.test(asked), asked);
  check("the keyboard is in the box", await page.evaluate(() => document.activeElement?.id === "say"));
  check("nothing was sent (still version 1)", (await page.locator(".msg__meta", { hasText: "version 2" }).count()) === 0);
  await shot(page, "game-ask-filled-desktop");
  // The fake agent makes the game fill every screen on a change with FILL, as the agent does on "fit here too".
  const before = await lineHeight(page);
  await page.locator("#say").fill("Make it fit computer screens too. FILL");
  await page.keyboard.press("Enter");
  await page.locator(".stage__busy .pulse").waitFor({ timeout: 30_000 });
  const during = await lineHeight(page);
  check("while the change builds, the line keeps the hint's room (no jump in the frame)", before === during && (await page.locator(".fithint").count()) === 0, `${before} px, then ${during} px`);
  await page.locator(".msg__meta", { hasText: "version 2" }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  check("after the change the game fills every screen: no hint on any device", (await page.locator(".fithint").count()) === 0);
  await shot(page, "game-filled-desktop");

  // A computer game: the preview on the Laptop, the hint on a phone-sized preview.
  await page.goto(`${base}/create?prompt=${encodeURIComponent("Make a racing game on a wide road")}`, { waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  const computerGame = await build(page, "Computer");
  check("a computer game's preview opens on the Laptop", (await devicePill(page)) === "Preview size: Laptop", await devicePill(page));
  await pickDevice(page, "iPhone");
  check("on the iPhone it opens sideways (its own way up): the wide game fits, no hint", (await page.locator(".devicepick__turn").getAttribute("aria-label")) === "Turn the phone upright" && (await page.locator(".fithint").count()) === 0);
  await page.locator(".devicepick__turn").click();
  await page.waitForTimeout(300);
  check("the iPhone turned upright: 'Made for computers.' and the one tap", /^Made for computers\. Ask to make it fit phones$/.test(await hintText(page)), await hintText(page));
  await shot(page, "game-computer-on-iphone-desktop");
  // Best fit, the default: no pick sent; the game records the shape the agent picked (the fake agent keeps the template's
  // upright shape, as the real one does for most games: phone), so the preview and the hint follow it.
  await page.goto(`${base}/create?prompt=${encodeURIComponent("Make a game where a frog hops across a river")}`, { waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  check("the next new game starts on Best fit again", (await picked(page)) === "Best fit", await picked(page));
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/projects", { timeout: 30_000 });
  const bestGame = await build(page);
  check("Best fit sends no pick (the agent picks)", (await sent).postDataJSON()?.platform === undefined, (await sent).postData());
  const bestRow = (await db.query(`SELECT platform::text AS platform, orientation::text AS orientation FROM "Project" WHERE id = $1`, [bestGame])).rows[0];
  check("a Best fit game records the shape the agent picked (upright: phone)", bestRow?.platform === "phone" && bestRow?.orientation === "portrait", JSON.stringify(bestRow));
  check("its preview opens on the iPhone", (await devicePill(page)) === "Preview size: iPhone", await devicePill(page));
  await pickDevice(page, "Laptop");
  check("on the Laptop: 'Made for phones.', as for a game picked for phones", /^Made for phones. Ask to make it fit computers$/.test(await hintText(page)), await hintText(page));
  await shot(page, "game-best-fit-on-laptop-desktop");
  // A game that fills every screen from the start: the preview on Fill the window, no hint anywhere.
  await page.goto(`${base}/create?prompt=${encodeURIComponent("Make a puzzle for every screen")}`, { waitUntil: "domcontentloaded" });
  await page.locator(".made").waitFor({ timeout: 60_000 });
  const fillGame = await build(page, "Any screen");
  check("a fill game's preview opens on Fill the window", (await devicePill(page)) === "Preview size: Fill the window", await devicePill(page));
  await pickDevice(page, "iPhone");
  check("a fill game on the iPhone: upright (it turns with the phone), no hint", (await page.locator(".fithint").count()) === 0 && (await page.locator(".devicepick__turn").getAttribute("aria-label")) === "Turn the phone sideways");
  // Worst case: a 60-letter name beside the device pill and the hint.
  const longName = "A very long game name that keeps going past the end of the bar";
  check("rename the computer game to 60 letters", (await api(maker, "PATCH", `/projects/${computerGame}`, { name: longName.slice(0, 60) })).status === 200);
  await page.goto(`${base}/games/${computerGame}`, { waitUntil: "domcontentloaded" });
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await pickDevice(page, "Small phone");
  await page.locator(".devicepick__turn").click(); // upright: where the hint shows
  await page.waitForTimeout(300);
  check("a 60-letter name: the hint stays whole on its own line", /^Made for computers\. Ask to make it fit phones$/.test(await hintText(page)), await hintText(page));
  await shot(page, "game-worst-long-name-desktop");
  for (const [w, h] of [[1024, 700], [1280, 720], [1366, 768], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    check(`the hint at ${w}×${h}: inside the stage`, await page.evaluate(() => {
      const hint = document.querySelector(".fithint__ask")?.getBoundingClientRect();
      const stage = document.querySelector(".stage")?.getBoundingClientRect();
      return !!hint && !!stage && hint.left >= stage.left && hint.right <= stage.right + 0.5;
    }));
    // The bar with the device pill and Turn in it: the game's name keeps some room and More stays inside the stage.
    const bar = await page.evaluate(() => {
      const name = document.querySelector(".stage__name")?.getBoundingClientRect();
      const actions = [...document.querySelectorAll(".stage__actions > *")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      const stage = document.querySelector(".stage")?.getBoundingClientRect();
      return { name: Math.round(name?.width ?? 0), right: Math.round(Math.max(...actions.map((r) => r.right))), edge: Math.round(stage?.right ?? 0) };
    });
    check(`the stage bar at ${w}×${h}: the name shows, More inside the stage`, bar.name >= 80 && bar.right <= bar.edge, `name ${bar.name} px, actions end ${bar.right} of ${bar.edge}`);
    await shot(page, `game-hint-${w}`);
  }
  await desk.close();

  // ---- Phones: Best fit first, the switch at 390 and 320, the hint on a computer game, a fill game full screen ------
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    p.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(p);
    await p.locator(".made").waitFor({ timeout: 60_000 });
    check(`on a phone (${w} px) it starts on Best fit`, (await picked(p)) === "Best fit", await picked(p));
    check(`/create at ${w} px: nothing wider than the screen`, await fits(p));
    const box = await p.locator(".made__switch").boundingBox();
    const opts = await p.locator(".made .switch__opt").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    check(`the four segments at ${w} px: two rows of two inside the widget, each a finger tall`, !!box && box.x >= 0 && box.x + box.width <= w && opts.length === 4 && opts.every((hh) => hh >= 44), opts.map(Math.round).join(","));
    await p.locator(".made").scrollIntoViewIfNeeded();
    await p.locator(".made .switch__opt", { hasText: "Any screen" }).tap();
    await p.waitForTimeout(250);
    await shot(p, `create-${w}`);
    // The computer game on a phone: the Play tab says what it's made for; the tap goes to the Chat tab with the box filled.
    await p.goto(`${base}/games/${computerGame}`, { waitUntil: "domcontentloaded" });
    await p.locator(".ws__tabs").waitFor({ timeout: 60_000 });
    await p.waitForTimeout(800);
    if ((await p.locator("#ws-tab-play[aria-selected=true]").count()) === 0) await p.locator("#ws-tab-play").tap();
    await p.waitForTimeout(300);
    check(`a computer game on a ${w} px phone: 'Made for computers.'`, /^Made for computers\./.test(await hintText(p)), await hintText(p));
    check(`the device menu stays hidden on a phone`, !(await p.locator(".devicepick").isVisible().catch(() => false)));
    check(`the hint at ${w} px: nothing wider than the screen`, await fits(p));
    await shot(p, `game-hint-${w}`);
    await p.setViewportSize({ width: h, height: w });
    await p.waitForTimeout(400);
    check(`the phone turned sideways (${h}×${w}): the wide game fits, no hint`, (await p.locator(".fithint").count()) === 0);
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Ask to make it fit phones" }).tap();
    await p.waitForTimeout(300);
    check(`the tap at ${w} px: the Chat tab, the request in the box`, (await p.locator("#ws-tab-chat[aria-selected=true]").count()) === 1 && /fit phone screens too/.test(await p.locator("#say").inputValue()));
    await shot(p, `game-ask-${w}`);
    if (w === 390) {
      // Full screen on an upright phone: the wide game asks to turn the phone, the fill game doesn't.
      for (const [id, wants] of [[computerGame, true], [fillGame, false]]) {
        await p.goto(`${base}/games/${id}`, { waitUntil: "domcontentloaded" });
        await p.locator(".ws__tabs").waitFor({ timeout: 60_000 });
        await p.waitForTimeout(800);
        if ((await p.locator("#ws-tab-play[aria-selected=true]").count()) === 0) await p.locator("#ws-tab-play").tap();
        await p.locator(".gameframe__play").tap().catch(() => {});
        await p.waitForTimeout(2500);
        const rotate = await p.locator(".rotate").count();
        check(wants ? "the wide game full screen on an upright phone: the turn hint" : "the fill game full screen on an upright phone: no turn hint, the whole screen", wants ? rotate === 1 : rotate === 0 && (await p.locator(".gameframe[data-orientation=any]").count()) === 1);
        await shot(p, wants ? "full-wide-390" : "full-fill-390");
      }
    }
    await phone.close();
  }
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
} finally {
  await browser?.close().catch(() => {});
  try {
    const closed = await api(maker, "DELETE", "/me", { confirm: "DELETE" }).catch(() => ({ status: 0 }));
    console.log(`closed ${maker}: ${closed.status}`);
    await db.query(`DELETE FROM "ClosedAccount" WHERE id = $1`, [`dev-${maker.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`]);
  } catch (e) {
    console.log("cleanup:", e instanceof Error ? e.message : e);
  }
  await db.end().catch(() => {});
  stopAll();
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
