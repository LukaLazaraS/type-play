// The status bar on phones (2026-10-27): signed in and signed out, on the pages it is on, at 280, 320, 360, 390 and 430
// px, as a phone shows them (isMobile, touch), on a stack of its own (dev-env.mjs useOwnStack): the API (DEV_AUTH=1,
// AGENT_FAKE=1), the games origin, the site (`next dev`, NEXT_DIST_DIR .next/header; tsconfig.json put back). Build the
// API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-header.mjs [outDir]
// Shots in .impeccable/review/header/. Checks, on every page and width: nothing wider than the screen, measured against
// the viewport the context was given (a phone context lets the page grow wider and window.innerWidth with it, so a check
// against innerWidth passes whatever overflows: the 10-27 header bug), the bar's last control (the avatar, or Sign in)
// whole on the screen, Games there; signed in, the credits in the bar or, where it has no room, in the account menu.
// Worst cases: a Free account (20 credits), 1,299.1 and 12,345.6 credits.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/header");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("header", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;

const WIDTHS = [280, 320, 360, 390, 430];
const stamp = Date.now().toString(36);
const accounts = [
  { email: `header-free-${stamp}@dev.test`, credits: "20" },
  { email: `header-1299-${stamp}@dev.test`, credits: "1,299.1", grant: "1279.1" },
  { email: `header-12345-${stamp}@dev.test`, credits: "12,345.6", grant: "12325.6" },
];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) => {
  const send = () => fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  // The server closes idle keep-alive sockets after 5 s: one picked up just then (after the admin CLI's pauses) is reset
  // before it reaches the server. Send it again once, as the e2e does.
  return send()
    .catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)))
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
};

/**
 * The bar as the phone shows it, measured against the width the context was given (never window.innerWidth: on a phone
 * the page grows to fit what overflows, and innerWidth with it). What is shown in it, left to right, and what sticks out.
 */
const bar = (page) =>
  page.evaluate((vw) => {
    const shown = (el) => !!el && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().width > 0;
    const parts = [...document.querySelectorAll(".statusbar .wordmark, .statusbar nav > *")].filter(shown);
    const last = parts.at(-1)?.getBoundingClientRect();
    return {
      page: document.documentElement.scrollWidth,
      fits: document.documentElement.scrollWidth <= vw,
      lastWhole: !!last && last.left >= 0 && last.right <= vw,
      // Squeezed, a control breaks onto two lines ("Sign / in") instead of overflowing: that fails too.
      oneLine: parts.every((el) => el.getBoundingClientRect().height <= 48),
      games: shown(document.querySelector('.statusbar nav a[href="/explore"]')),
      credits: shown(document.querySelector(".account__credits")) ? document.querySelector(".account__credits").textContent.replace(/\s+/g, " ").trim() : null,
      parts: parts.map((el) => `${(el.textContent || el.getAttribute("aria-label") || el.className).replace(/\s+/g, " ").trim().slice(0, 18)}@${Math.round(el.getBoundingClientRect().left)}-${Math.round(el.getBoundingClientRect().right)}`).join(" "),
    };
  }, page.viewportSize().width);

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
let browser = null;
let gameId = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, { PORT: String(API_PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0" });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/header",
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

  for (const a of accounts) {
    await api(a.email, "GET", "/me");
    if (a.grant) check(`${a.credits} credits planted`, admin("plan", a.email, "ultraplus").status === 0 && admin("grant", a.email, a.grant).status === 0);
  }
  // A game for the game page's bar (the fake agent builds it in seconds).
  gameId = (await api(accounts[2].email, "POST", "/projects", { prompt: "Make a racing game with tiny cars", model: "fast" })).body?.id ?? null;
  for (let i = 0; i < 60 && gameId && (await api(accounts[2].email, "GET", `/projects/${gameId}`)).body?.status !== "idle"; i++) await new Promise((r) => setTimeout(r, 500));
  // What each account's credits read now (the build charged a little), as the bar and the menu write them.
  const figure = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  for (const a of accounts) a.shown = figure.format((await api(a.email, "GET", "/me")).body?.credits?.available ?? NaN);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const phone = (w) => browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  /** Every page once at `w`, the bar checked on each; a shot of the bar on the first. */
  async function walk(p, w, who, pages) {
    for (const [i, path] of pages.entries()) {
      await p.goto(base + path, { waitUntil: "domcontentloaded", timeout: 180_000 });
      // The account place says "…" until /me answers: the bar is measured once the credits (or Sign in) are in.
      await p.locator(".statusbar .pill, .statusbar .avatarbutton").first().waitFor({ timeout: 60_000 });
      await p.waitForFunction(() => document.querySelector(".account__credits b")?.textContent !== "…", null, { timeout: 30_000 });
      await p.waitForTimeout(600);
      const b = await bar(p);
      const ok = b.fits && b.lastWhole && b.oneLine && b.games;
      check(`${who} ${path} at ${w} px: nothing wider than the screen, the last control whole, each on one line, Games there`, ok, ok ? b.parts : `page ${b.page} px${b.oneLine ? "" : ", a control on two lines"}; ${b.parts}`);
      if (i === 0) {
        await p.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none")));
        await p.screenshot({ path: join(out, `${who}-${w}.png`), clip: { x: 0, y: 0, width: w, height: 72 } });
      }
    }
  }
  const signedInPages = ["/games", "/", "/pricing", "/explore", "/account", ...(gameId ? [`/games/${gameId}`] : [])];
  for (const w of WIDTHS) {
    for (const a of accounts) {
      const ctx = await phone(w);
      const p = await ctx.newPage();
      p.on("pageerror", (e) => console.log("page error:", e.message));
      await p.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await p.locator("#dev-email").waitFor({ timeout: 120_000 });
      await p.fill("#dev-email", a.email);
      await p.getByRole("button", { name: "Dev sign-in" }).click();
      await p.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
      // The worst case (the longest credits) on every page; the others on /games only.
      await walk(p, w, `in-${a.credits.replace(/\D/g, "")}`, a === accounts[2] ? signedInPages : ["/games"]);
      // The credits stay reachable: in the bar, or in the account menu where the bar has no room for them.
      const inBar = (await bar(p)).credits;
      let reach = inBar ? `bar: ${inBar}` : null;
      if (!reach) {
        await p.locator(".statusbar .avatarbutton").tap();
        await p.locator("#account-menu:popover-open").waitFor({ timeout: 5_000 });
        reach = `menu: ${(await p.locator("#account-menu .account__facts").innerText()).replace(/\s+/g, " ")}`;
        await p.keyboard.press("Escape");
      }
      check(`${a.shown} credits at ${w} px: reachable`, reach.includes(a.shown), reach);
      await ctx.close();
    }
    const ctx = await phone(w);
    const p = await ctx.newPage();
    await walk(p, w, "out", ["/explore", "/", "/pricing", "/create"]);
    await ctx.close();
  }
  // A tablet, every link in the bar and the longest credits (the 641-680px band gives the word way too).
  for (const w of [641, 700, 768]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await p.locator("#dev-email").waitFor({ timeout: 120_000 });
    await p.fill("#dev-email", accounts[2].email);
    await p.getByRole("button", { name: "Dev sign-in" }).click();
    await p.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await walk(p, w, "in-tablet", ["/games"]);
    await ctx.close();
  }
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
} finally {
  await browser?.close().catch(() => {});
  if (gameId) await api(accounts[2].email, "DELETE", `/projects/${gameId}`).catch(() => {});
  stopAll();
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
