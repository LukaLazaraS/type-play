// The size check (2026-10-29), end to end with screenshots, on a stack of its own on ports picked free and a database of
// its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched: the API (DEV_AUTH=1,
// AGENT_FAKE=1: the fake's TOOBIG is a change the check stops), the games origin, the site (`next dev` with its own
// NEXT_DIST_DIR, .next/size; tsconfig.json is put back afterwards). Build the API first (npm run build -w @typeplay/server),
// then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-size.mjs [outDir]
// Shots in .impeccable/review/size/. Checks, at 1440 and 390 px (the Chat tab): a change sent on Fast that is too big stops
// (the answer, "Fast · 0.1 credits", no Play, no new version), the one tap "Use Smart for this" (Medium) puts the same
// message back in the box with Smart picked and sends nothing; a Free player's stop has no tap. Afterwards the test
// accounts close.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/size");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("size", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;

const stamp = Date.now().toString(36);
const paid = `size-paid-${stamp}@dev.test`; // Medium: the stop offers Smart
const free = `size-free-${stamp}@dev.test`; // Free: one part at a time only
const everyone = [paid, free];
const BIG = "Add 10 new levels and flying traps TOOBIG";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name) => {
  await page.waitForTimeout(300); // past the 220 ms line-in and the 160 ms colour changes
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) => {
  const send = () => fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return send()
    .catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)))
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
};
const fits = (page) => page.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, page.viewportSize().width);
const text = (page, sel) => page.locator(sel).last().innerText().then((t) => t.replace(/\s+/g, " ").trim(), () => "");
async function idle(email, id, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    const p = (await api(email, "GET", `/projects/${id}`)).body;
    if (p?.status === "idle") return p;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${id} never went idle`);
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

let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, { PORT: String(API_PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0" });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/size",
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

  // The accounts and their games (version 1 each), built through the API.
  for (const who of everyone) await api(who, "GET", "/me");
  check("paid: Medium + 40 credits", admin("plan", paid, "medium").status === 0 && admin("grant", paid, "40").status === 0);
  const games = {};
  for (const who of everyone) {
    const made = (await api(who, "POST", "/projects", { prompt: "Make an endless runner where a robot jumps over boxes", model: "fast" })).body;
    games[who] = (await idle(who, made.id)).id;
  }

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page, email) {
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", email);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  const picked = (page) => page.locator('input[name="switch-edit"]:checked').getAttribute("value");
  const box = (page) => page.locator("#say").inputValue();
  /** Sends BIG from the composer on Fast (a change's default) and waits for its answer. */
  async function sendBig(page) {
    check("the composer starts on Fast", (await picked(page)) === "fast", String(await picked(page)));
    const answers = await page.locator(".msg--agent").count(); // an earlier stop's answer may be in the chat already
    await page.fill("#say", BIG);
    await page.getByRole("button", { name: "Send" }).click();
    await page.waitForFunction((n) => document.querySelectorAll(".msg--agent").length > n, answers, { timeout: 30_000 });
    await page.locator(".msg--agent").last().locator(".msg__meta", { hasText: "0.1 credits" }).waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
  }

  for (const [label, viewport, phone] of [["desktop", { width: 1440, height: 900 }, false], ["phone", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, ...(phone ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("page error:", e.message));
    // ---- Medium: the stop and its one tap ----------------------------------------------------------
    await signIn(page, paid);
    await page.goto(`${base}/games/${games[paid]}`, { waitUntil: "domcontentloaded" });
    if (phone) await page.getByRole("tab", { name: "Chat" }).click();
    await page.locator("#say").waitFor({ timeout: 60_000 });
    const versionsBefore = (await api(paid, "GET", `/projects/${games[paid]}`)).body.versions.length;
    await sendBig(page);
    const answer = await text(page, ".msg--agent .bubble");
    check(`${label}: the answer says what is too big, one part to send, and Smart`, /more than Fast can finish in one message/.test(answer) && /Add flying traps/.test(answer) && /or pick Smart/.test(answer), answer);
    check(`${label}: its line "Fast · 0.1 credits", no version, no Play`, (await text(page, ".msg--agent .msg__meta")) === "Fast · 0.1 credits" && (await page.locator(".msg--agent").last().locator(".msg__play").count()) === 0, await text(page, ".msg--agent .msg__meta"));
    check(`${label}: no new version`, (await api(paid, "GET", `/projects/${games[paid]}`)).body.versions.length === versionsBefore);
    const tap = page.getByRole("button", { name: "Use Smart for this" });
    check(`${label}: the one tap "Use Smart for this" under it, no ideas`, (await tap.count()) === 1 && (await page.locator(".ideas__label").count()) === 0);
    check(`${label}: no sideways scrolling`, await fits(page));
    await shot(page, `stop-medium-${label}`);
    const messagesBefore = (await api(paid, "GET", `/projects/${games[paid]}`)).body.messages.length;
    await tap.click();
    await page.waitForTimeout(400);
    check(`${label}: the tap puts the same message back in the box`, (await box(page)) === BIG, await box(page));
    check(`${label}: …with Smart picked, and the box focused`, (await picked(page)) === "smart" && (await page.evaluate(() => document.activeElement?.id)) === "say", String(await picked(page)));
    check(`${label}: …and nothing sent`, (await api(paid, "GET", `/projects/${games[paid]}`)).body.messages.length === messagesBefore);
    await shot(page, `stop-medium-${label}-tapped`);
    await ctx.close();
  }

  // ---- Free: one part at a time only (phone) --------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await signIn(page, free);
  await page.goto(`${base}/games/${games[free]}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: "Chat" }).click();
  await page.locator("#say").waitFor({ timeout: 60_000 });
  await sendBig(page);
  const answer = await text(page, ".msg--agent .bubble");
  check("Free: the answer gives one part to send, no bigger AI", /more than Fast can finish in one message/.test(answer) && !/Smart|Best/.test(answer), answer);
  check("Free: no tap", (await page.getByRole("button", { name: /^Use .* for this$/ }).count()) === 0);
  await shot(page, "stop-free-phone");
  await ctx.close();
} catch (e) {
  check("the walk-through ran", false, e?.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  for (const who of everyone) await api(who, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  stopAll();
  writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
