// /create shown again, and the cost question's main button (2026-10-29), end to end on a stack of its own on ports picked
// free and a database of its own (dev-env.mjs useOwnStack), fake builds (AGENT_FAKE=1). Build the API first
// (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-create-return.mjs [outDir]
// Shots in .impeccable/review/create-return/. Checks:
// 1. The bug: next.config.ts has cacheComponents, so Next keeps the last pages visited in a hidden <Activity> with their
//    React state. Build a game from /create, land on the game page, go home by the wordmark (a client-side move: the page
//    is not reloaded), type another idea there, Make my game: /create must open with Build my game ready (not
//    "Starting…"), genre, tags and pickers on, no question or error left, and the new idea in the box. Also with the
//    cost question open when the player leaves, and with an old error.
// 2. While the cost question shows (/create: "Build it?"; the chat: "Send it?"), the main button is aria-disabled (grey,
//    read as unavailable, still focusable, ignoring presses); editing the text, Not now or answering brings it back.
// 3. /create's question closes when the AI or the effort changes (they change the estimate it asked about; 10-29), at
//    1440 and 390 px; the screens and a tag leave it open (they don't change the estimate).
// Afterwards the test account closes and the database goes.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/create-return");
mkdirSync(out, { recursive: true });
const [site, apiPort, games, proxy] = await useOwnStack("create_return", 4);
const PORT = { site, api: apiPort, games, proxy };
const base = `http://localhost:${PORT.site}`;
const apiBase = `http://127.0.0.1:${PORT.api}`;
const DATA = join(root, "data/shots/create-return-data");

const stamp = Date.now().toString(36);
const maker = `return-${stamp}@dev.test`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("wrote", name);
};
const env = { DATA_DIR: DATA };
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ...env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) =>
  fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));

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
let cur = null; // the page in use, for a look at it when the run fails
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
    NEXT_DIST_DIR: ".next/create-return",
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
  const IDEA2 = "A frog that hops across a river on lily pads";
  const hydrated = (page) =>
    page.waitForFunction(() => {
      const input = document.querySelector(".iconchoice input");
      return !!input && Object.keys(input).some((k) => k.startsWith("__reactProps"));
    }, null, { timeout: 300_000 });
  const goal = (page) => page.getByRole("button", { name: /^(Build my game|Starting…)$/ });
  /** What a player sees of /create's state: the button, whether it works, and what is locked. */
  const state = (page) =>
    page.evaluate(() => {
      const b = document.querySelector(".make__send button[type=submit]");
      return {
        label: b?.textContent?.trim(),
        busy: b?.getAttribute("aria-busy") === "true",
        disabled: b?.getAttribute("aria-disabled") === "true" || b?.disabled === true,
        locked: document.querySelector(".iconchoice")?.matches(":disabled") || [...document.querySelectorAll(".tags .chip")].some((c) => c.disabled),
        ask: !!document.querySelector(".make .ask"),
        error: !!document.querySelector(".make .error-line, .make [role=alert]:not(.ask)"),
        idea: document.querySelector("#idea")?.value,
      };
    });
  /** The dev sign-in box answers once React has taken over its HTML (before that a typed email is put back to the default). */
  const devReady = (page) =>
    page.waitForFunction(() => {
      const input = document.querySelector("#dev-email");
      return !!input && Object.keys(input).some((k) => k.startsWith("__reactProps"));
    }, null, { timeout: 300_000 });
  /** The visible /create (a hidden <Activity> copy of a page stays in the DOM: only the one that is shown counts). */
  async function signIn(page) {
    await page.goto(`${base}/create?prompt=${encodeURIComponent(IDEA)}`, { waitUntil: "domcontentloaded", timeout: 300_000 });
    await page.locator("#dev-email").waitFor({ timeout: 300_000 });
    await devReady(page);
    await page.fill("#dev-email", maker);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
    await hydrated(page);
  }
  /** Home by the wordmark (no reload), an idea in the home page's box, Make my game. */
  async function homeAndBack(page, idea) {
    await page.getByRole("link", { name: "TypePlay home" }).first().click();
    await page.locator("#prompt").waitFor({ timeout: 120_000 });
    await page.locator("#prompt").fill(idea);
    await page.getByRole("button", { name: "Make my game" }).click();
    await page.waitForURL(/\/create$/, { timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
  }

  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = (cur = await desk.newPage());
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(page);
  // The account appears with its first answer to /me: the page has shown its credits, so it is there (a few tries for a slow database).
  let plan = admin("plan", maker, "medium");
  for (let i = 0; i < 10 && plan.status !== 0; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    plan = admin("plan", maker, "medium");
  }
  const granted = plan.status === 0 ? admin("grant", maker, "100") : plan;
  check("admin plan medium and 100 credits (room for the builds, Best at High effort included)", plan.status === 0 && granted.status === 0, plan.status === 0 ? "" : `${(plan.stderr || plan.stdout).slice(-300)} / users: ${JSON.stringify((await db.query('SELECT email FROM "User"')).rows)}`);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  await hydrated(page);

  // ---- 1. The bug -----------------------------------------------------------------------------------------------
  await page.locator("#idea").fill(IDEA + ", then more berries"); // typed in the box: the page keeps it as its own edit
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  await page.locator(".msg__meta:visible", { hasText: "version 1" }).waitFor({ timeout: 240_000 });
  await homeAndBack(page, IDEA2);
  let s = await state(page);
  check("after a build, home, a new idea, Make my game: /create's button is ready (not Starting…)", s.label === "Build my game" && !s.busy && !s.disabled, JSON.stringify(s));
  check("…genre, tags and pickers are not locked", !s.locked, JSON.stringify(s));
  check("…and the idea from the home page is in the box", s.idea === IDEA2, JSON.stringify(s));
  await shot(page, "return-after-build-desktop");
  // The second build works from there.
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  await page.locator(".msg__meta:visible", { hasText: "version 1" }).waitFor({ timeout: 240_000 });
  check("…and it builds the second game", true);

  // Left with the cost question open: shown again, it is gone.
  await homeAndBack(page, IDEA);
  await page.locator('input[name="model-new"][value="best"]').check({ force: true }); // Best at High effort passes Medium's ask-first limit
  await page.locator('input[name="effort-create"][value="high"]').check({ force: true });
  await page.waitForTimeout(600);
  await goal(page).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  const askFirst = await state(page);
  check("the cost question is open (High effort passes the ask-first limit)", askFirst.ask, JSON.stringify(askFirst));
  await homeAndBack(page, IDEA2);
  s = await state(page);
  check("left with the question open, shown again: no question, the new idea wins, the button works", !s.ask && s.idea === IDEA2 && s.label === "Build my game" && !s.disabled, JSON.stringify(s));

  // ---- 2. The question's main button ---------------------------------------------------------------------------
  // /create: High effort passes the ask-first limit, so the API's own estimate asks.
  await page.locator('input[name="model-new"][value="best"]').check({ force: true }); // Best at High effort passes Medium's ask-first limit
  await page.locator('input[name="effort-create"][value="high"]').check({ force: true });
  await page.waitForTimeout(600);
  await goal(page).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  s = await state(page);
  check("question open on /create: Build my game is aria-disabled (and not busy)", s.disabled && !s.busy && s.label === "Build my game", JSON.stringify(s));
  check("…it stays focusable (focus where the press left it)", await page.evaluate(() => document.activeElement?.matches(".make__send button[type=submit]") ?? false));
  await page.waitForTimeout(400); // past the colour's 160 ms fade
  const grey = await goal(page).evaluate((e) => getComputedStyle(e).backgroundColor);
  check("…grey like a disabled button", grey === "rgb(207, 198, 226)", grey);
  const asked = await page.locator(".make .ask").innerText();
  await goal(page).click({ force: true });
  await page.keyboard.press("Enter");
  check("…pressing it (or Enter) again does nothing: the same question stays, nothing sent", (await page.locator(".make .ask").innerText()) === asked && page.url().endsWith("/create"));
  await shot(page, "create-ask-desktop");
  await page.getByRole("button", { name: "Not now" }).click();
  s = await state(page);
  check("Not now: the question goes, the button works again", !s.ask && !s.disabled, JSON.stringify(s));
  await goal(page).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  await page.locator("#idea").fill(IDEA2 + " today");
  s = await state(page);
  check("editing the text closes the question and the button works again", !s.ask && !s.disabled, JSON.stringify(s));
  // The AI and the effort change the estimate the question was about: it closes. The screens and the tags don't: it stays.
  await goal(page).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  await page.locator('input[name="platform"][value="phone"]').check({ force: true });
  await page.getByRole("button", { name: "Retro" }).click();
  await page.waitForTimeout(300);
  s = await state(page);
  check("picking the screens or a tag keeps the question (they don't change the estimate)", s.ask && s.disabled, JSON.stringify(s));
  await page.getByRole("button", { name: "Retro" }).click(); // off again
  await page.locator('input[name="platform"][value="auto"]').check({ force: true });
  await page.locator('input[name="model-new"][value="smart"]').check({ force: true });
  await page.waitForTimeout(300);
  s = await state(page);
  check("changing the AI closes the question and the button works again", !s.ask && !s.disabled, JSON.stringify(s));
  await shot(page, "create-ask-ai-changed-desktop");
  await page.locator('input[name="model-new"][value="best"]').check({ force: true });
  await page.waitForTimeout(600);
  await goal(page).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  await page.locator('input[name="effort-create"][value="medium"]').check({ force: true });
  await page.waitForTimeout(300);
  s = await state(page);
  check("changing the effort closes the question and the button works again", !s.ask && !s.disabled, JSON.stringify(s));
  await page.locator('input[name="effort-create"][value="high"]').check({ force: true });
  await page.waitForTimeout(600);
  await goal(page).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  const sent = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/projects", { timeout: 30_000 });
  await page.getByRole("button", { name: "Build it" }).click();
  check("Build it sends the build (with confirm)", (await sent).postDataJSON()?.confirm === true);
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  await page.locator(".msg__meta:visible", { hasText: "version 1" }).waitFor({ timeout: 240_000 });

  // The chat: the estimate for a change is made to ask (a real one needs a long build).
  await page.route("**/estimate?**", async (route) => {
    const res = await route.fetch();
    const e = await res.json();
    await route.fulfill({ response: res, json: { ...e, high: Math.max(e.high, 31.5), needsConfirm: true } });
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#say").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await page.locator("#say").fill("Make the frog green");
  const sendBtn = page.locator(".composer__row button[type=submit]");
  await sendBtn.click();
  await page.locator(".composer .ask").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(400);
  const chat = await sendBtn.evaluate((e) => ({ aria: e.getAttribute("aria-disabled"), busy: e.getAttribute("aria-busy"), focus: document.activeElement === e, bg: getComputedStyle(e).backgroundColor }));
  check("question open in the chat: Send is aria-disabled, not busy, focus kept, grey", chat.aria === "true" && chat.busy === null && chat.focus && chat.bg === "rgb(207, 198, 226)", JSON.stringify(chat));
  const chatAsk = await page.locator(".composer .ask").innerText();
  await sendBtn.click({ force: true });
  await page.locator("#say").focus();
  await page.keyboard.press("Enter");
  check("…pressing Send (or Enter) again does nothing: the same question stays", (await page.locator(".composer .ask").innerText()) === chatAsk);
  await shot(page, "chat-ask-desktop");
  await page.locator("#say").fill("Make the frog blue");
  check("editing the message closes the question and Send works again", (await page.locator(".composer .ask").count()) === 0 && (await sendBtn.getAttribute("aria-disabled")) === null);
  await sendBtn.click();
  await page.locator(".composer .ask").waitFor({ timeout: 15_000 });
  await page.locator(".composer .ask").getByRole("button", { name: "Not now" }).click();
  check("Not now in the chat: Send works again", (await sendBtn.getAttribute("aria-disabled")) === null);
  await sendBtn.click();
  await page.locator(".composer .ask").waitFor({ timeout: 15_000 });
  await page.unroute("**/estimate?**");
  await desk.close();

  // ---- Phones: the question open on /create and in the chat -------------------------------------------------------
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = (cur = await phone.newPage());
    p.on("pageerror", (e) => console.log("page error:", e.message));
    await p.goto(`${base}/create?prompt=${encodeURIComponent(IDEA)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await p.locator("#dev-email").waitFor({ timeout: 120_000 });
    await devReady(p);
    await p.fill("#dev-email", maker);
    await p.getByRole("button", { name: "Dev sign-in" }).click();
    await p.locator(".make__balance b").waitFor({ timeout: 60_000 });
    await hydrated(p);
    console.log("phone signed in:", (await p.locator(".make__balance").innerText()).replace(/s+/g, " "));
    await p.locator('label:has(input[name="model-new"][value="best"])').tap(); // Best at High effort passes Medium's ask-first limit
    await p.locator('input[name="effort-create"][value="high"]').check({ force: true });
    await p.waitForTimeout(600);
    await goal(p).tap();
    await p.locator(".make .ask").waitFor({ timeout: 15_000 });
    await p.waitForTimeout(600);
    const fit = await p.evaluate((w) => [...document.querySelectorAll(".make *")].every((e) => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= -0.5 && r.right <= w + 0.5); }), w);
    check(`/create at ${w} px with the question open: nothing past the screen`, fit);
    await shot(p, `create-ask-${w}`);
    await p.locator('label:has(input[name="model-new"][value="smart"])').tap();
    await p.waitForTimeout(400);
    check(`/create at ${w} px: tapping another AI closes the question`, (await p.locator(".make .ask").count()) === 0);
    await shot(p, `create-ask-ai-changed-${w}`);
    // The chat of a built game with its question open.
    const games = (await api(maker, "GET", "/projects")).body;
    const built = (Array.isArray(games) ? games : (games?.projects ?? [])).find((g) => g.buildId) ?? null;
    if (!built) check(`a built game to open the chat at ${w} px`, false, JSON.stringify(games)?.slice(0, 200));
    else {
      await p.route("**/estimate?**", async (route) => {
        const res = await route.fetch();
        const e = await res.json();
        await route.fulfill({ response: res, json: { ...e, high: Math.max(e.high, 31.5), needsConfirm: true } });
      });
      await p.goto(`${base}/games/${built.id}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      // On a phone the game page opens on Play: the Chat tab first.
      await p.getByRole("tab", { name: "Chat" }).or(p.getByRole("button", { name: "Chat", exact: true })).first().tap();
      await p.locator("#say").waitFor({ timeout: 120_000 });
      await p.waitForTimeout(800);
      await p.locator("#say").fill("Make the frog green");
      await p.locator(".composer__row button[type=submit]").tap();
      await p.locator(".composer .ask").waitFor({ timeout: 15_000 });
      await p.waitForTimeout(600);
      const chatFit = await p.evaluate((w) => [...document.querySelectorAll(".composer *")].every((e) => { const r = e.getBoundingClientRect(); return r.width === 0 || (r.left >= -0.5 && r.right <= w + 0.5); }), w);
      const sendOff = await p.locator(".composer__row button[type=submit]").getAttribute("aria-disabled");
      check(`the chat at ${w} px with the question open: Send aria-disabled, nothing past the screen`, chatFit && sendOff === "true", `fit ${chatFit}, aria-disabled ${sendOff}`);
      await shot(p, `chat-ask-${w}`);
    }
    await phone.close();
  }
} catch (e) {
  await cur?.screenshot({ path: join(out, "failed.png") }).catch(() => {});
  console.log("the page at the end:", (await cur?.locator("body").innerText().catch(() => ""))?.slice(0, 800));
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
  stopAll();
  rmSync(DATA, { recursive: true, force: true });
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
