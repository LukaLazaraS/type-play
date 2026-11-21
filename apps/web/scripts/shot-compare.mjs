// Before and after, side by side: every page and popup of the site at desktop (1440×900) and phone (390×844, touch)
// width, from two copies of apps/web running at once on one API and one database, compared pixel by pixel. Made for the
// shared components (10-26: "nothing changes except the differences listed"); any UI change can be checked the same way.
//   base:  apps/web at a git commit (--base, default HEAD), exported once to data/shots/base-<sha> (git-ignored)
//   after: this checkout's apps/web as it is now, uncommitted changes included
// Both run `next dev` (dev sign-in needs it) on a stack of their own on ports picked free (scripts/test-run.mjs): the API
// (DEV_AUTH, AGENT_FAKE, the closed beta, the Android fake) on a database of the run's own, typeplay_autotest_shot_compare_<id>
// (made fresh each run, dropped at the end; its game folders in data/shots/api-data), the games origin, the base site and
// this checkout's. Another walk-through in this checkout waits for it (their `next dev` share tsconfig.json; dev-env.mjs);
// other checkouts' runs go at the same time. Each scenario runs on both sites, one after the other, with the same data, the same frozen clock and reduced
// motion; states the fake API can't make (billing, Android builds, some errors) are its answers replaced in the browser,
// the same for both. No game ever starts (play.html answers a blank page), so nothing on the screen moves. Pictures
// resized by each site's own image optimizer differ by a few pixels between runs, and the Share menu's link shows each
// site's own address, so those are masked (their boxes still count).
// Build the API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-compare.mjs [--base <ref>] [--only <regex>]
//     [--every-shape] [--sale on|beta|off] [--base-only | --after-only] [--shapes <list>] [--texts <list>] [outDir]
// --every-shape (the whole pass, 2026-11-21): every page (PAGES below) at every phone shape, the tablet and desktop, each
//   at 100% and 200% text (dev-env.mjs doubleText, as the UI checks emulate a phone's large-text setting); the popups and
//   states at desktop and phone as before, plus the phone and 320 at 200%; focus and hover at 100% only.
// --sale: which way the site sells, by its build flags (content/billing.ts `sale`): on (the default: Paddle's client
//   token, the closed beta), beta (the closed beta without the token: typeplay.app today), off (open sign-up, no token).
//   The billing scenarios that need the token only run "on"; the others show their own state on every run.
// --base-only / --after-only: one site alone, measured, nothing compared (a quick inventory before a change, or of it).
// --shapes <viewports> and --texts <100,200>: a slice of --every-shape's pairs (viewports by name: phone, 320x568, ...).
// Every shot is measured: the page's width against the screen (and the outermost pieces past it), and the words broken
// across two lines inside the word (a hyphen the browser adds is named; "Platforme / r" is not one).
// Output in .impeccable/review/compare/ (compare-<sale> for beta and off): shots/<scenario>-<viewport>[-200]-<base|after>.png,
// diff/<scenario>-<viewport>[-200].png for the pairs that differ (the differing pixels red on a pale copy), report.json and
// index.html (differences first, then pages wider than the screen or with broken words).
import { chromium } from "playwright";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { urlOf } from "../../../scripts/local-db.mjs";
import { endedRunDatabases, freePorts, runDatabase } from "../../../scripts/test-run.mjs";
import { brokenWords, doubleText, fillPublicSupabase, ownNextDev, wideParts } from "./dev-env.mjs";
import { GIS_STUB } from "./gis-stub.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");

const opts = { base: "HEAD", only: null, out: null, every: false, sale: "on", one: false };
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === "--base") opts.base = process.argv[++i];
  else if (a === "--only") opts.only = new RegExp(process.argv[++i]);
  else if (a === "--every-shape") opts.every = true;
  else if (a === "--sale") opts.sale = process.argv[++i];
  else if (a === "--base-only") opts.one = "base";
  else if (a === "--after-only") opts.one = "after";
  else if (a === "--shapes") opts.shapes = process.argv[++i].split(",");
  else if (a === "--texts") opts.texts = process.argv[++i].split(",").map(Number);
  else opts.out = a;
}
if (!["on", "beta", "off"].includes(opts.sale)) throw new Error(`--sale is on, beta or off, not ${opts.sale}`);
const out = opts.out ?? join(root, ".impeccable/review", opts.sale === "on" ? "compare" : `compare-${opts.sale}`);
fillPublicSupabase(); // a checkout without the root .env: the public values stand in, as in the other walk-throughs
for (const d of ["shots", "diff", "logs"]) mkdirSync(join(out, d), { recursive: true });

const DATA = join(root, "data/shots/api-data");
await ownNextDev();
await cleanLeftovers();
const DB = (await runDatabase("shot_compare")).name;
const [api0, games0, base0, after0, proxy0] = await freePorts(5);
const PORT = { api: api0, games: games0, base: base0, after: after0, proxy: proxy0 };
const apiBase = `http://127.0.0.1:${PORT.api}`;
const gamesBase = `http://127.0.0.1:${PORT.games}`;
const IDEA = "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const log = (...a) => console.log(`[${String(Math.round((Date.now() - t0) / 1000)).padStart(4)} s]`, ...a);

// ---- The two copies of the site -------------------------------------------------------------------------------------
const sha = execFileSync("git", ["rev-parse", "--short=7", opts.base], { cwd: root, encoding: "utf8" }).trim();
/** apps/web at the base commit, exported once (its .next cache stays for the next run). */
function exportBase() {
  const dir = join(root, "data/shots", `base-${sha}`);
  const web = join(dir, "apps/web");
  if (existsSync(join(web, "package.json"))) return web;
  mkdirSync(dir, { recursive: true });
  const tarFile = join(dir, "web.tar");
  execFileSync("git", ["archive", "--format=tar", "-o", tarFile, sha, "apps/web"], { cwd: root });
  // Windows' own tar: Git Bash's GNU tar reads "C:" as a remote host.
  const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
  execFileSync(tar, ["-xf", tarFile, "-C", dir]);
  rmSync(tarFile);
  return web;
}
const SITES = [
  { id: "base", dir: exportBase(), url: `http://localhost:${PORT.base}`, port: PORT.base },
  { id: "after", dir: webDir, url: `http://localhost:${PORT.after}`, port: PORT.after },
].filter((s) => !opts.one || s.id === opts.one);

// ---- The stack ------------------------------------------------------------------------------------------------------
const children = [];
function start(name, args, cwd, env) {
  const file = createWriteStream(join(out, "logs", `${name}.log`));
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let tail = "";
  const keep = (d) => {
    file.write(d);
    tail = (tail + d).slice(-3000);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);
  children.push(child);
  return { child, tail: () => tail };
}
function stopAll() {
  for (const child of children.reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGKILL");
  }
}
async function until(what, test, seconds, proc) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await test().catch(() => false)) return;
    if (proc && proc.child.exitCode !== null) break;
    await sleep(500);
  }
  throw new Error(`${what} did not start: ${proc?.tail() ?? ""}`);
}
const apiEnv = {
  PORT: String(PORT.api),
  DATABASE_URL: urlOf(DB),
  DIRECT_URL: urlOf(DB),
  DATA_DIR: DATA,
  DEV_AUTH: "1",
  AGENT_FAKE: "1",
  BETA_INVITE_ONLY: opts.sale === "off" ? "" : "1",
  ADMIN_EMAILS: "",
  ANDROID_EXPORT: "1",
  ANDROID_FAKE: "1",
  ANDROID_KEY_MASTER: "5a".repeat(32),
  ANDROID_KEY_MASTER_PREV: "",
  CORS_ORIGINS: SITES.map((s) => s.url).join(","),
  API_PUBLIC_URL: apiBase,
  KEY_PROXY_PORT: String(PORT.proxy),
  BILLING_JOBS: "0",
  PADDLE_ENV: "",
  PADDLE_API_KEY: "",
};
const siteEnv = {
  // One build folder per sale state: the flags are compiled into the pages.
  NEXT_DIST_DIR: opts.sale === "on" ? ".next/shots" : `.next/shots-${opts.sale}`,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_APP: "1",
  NEXT_PUBLIC_DEV_AUTH: "1",
  NEXT_PUBLIC_CLOSED_BETA: opts.sale === "off" ? "" : "1",
  NEXT_PUBLIC_API_ORIGIN: apiBase,
  NEXT_PUBLIC_GAMES_ORIGIN: gamesBase,
  // Billing pages render "on" only with a client token; whether a user has billing is GET /me's (patched per scenario).
  NEXT_PUBLIC_PADDLE_ENV: opts.sale === "on" ? "sandbox" : "",
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: opts.sale === "on" ? "test_shots" : "",
  // Google's own button, as live since 2026-11-20 (deploy/server/compose.yaml); its script is the stand-in (contextFor).
  NEXT_PUBLIC_GOOGLE_BUTTON: "1",
  // The account's Notifications card shows only with a key: one stand-in for both sites, as this checkout's
  // apps/web/.env.local has the real one and an exported base has none (every account page differed by the card).
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "test_shots",
};
const admin = (...args) => {
  const r = spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], {
    cwd: serverDir,
    encoding: "utf8",
    env: { ...process.env, ...apiEnv, ADMIN_NAME: "shots" },
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`admin ${args.join(" ")}: ${r.stdout}${r.stderr}`);
  return r.stdout;
};
async function api(email, method, path, body) {
  const send = () =>
    fetch(`${apiBase}${path}`, {
      method,
      headers: { Authorization: `Bearer dev:${email}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  // The API closes idle keep-alive sockets after 5 s; a request that picks one up just then is reset before it reaches
  // the API (after the admin CLI's pauses): send it again once, as the e2e's api() does.
  const r = await send().catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)));
  const json = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${method} ${path} as ${email}: ${r.status} ${JSON.stringify(json)}`);
  return json;
}
async function idle(email, id) {
  for (let i = 0; i < 180; i++) {
    const p = await api(email, "GET", `/projects/${id}`);
    if (p.status !== "running") return p;
    await sleep(500);
  }
  throw new Error(`game ${id} is still building after 90 s`);
}
/** A game built by the fake agent (~5 s a build), its changes after it, then its name. */
async function game(email, prompt, { model = "fast", platform, name, edits = [] } = {}) {
  let p = await api(email, "POST", "/projects", { prompt, model, platform, confirm: true });
  p = await idle(email, p.id);
  for (const text of edits) {
    await api(email, "POST", `/projects/${p.id}/messages`, { text, model: "fast", confirm: true });
    p = await idle(email, p.id);
  }
  if (name) p = await api(email, "PATCH", `/projects/${p.id}`, { name });
  return p;
}

// ---- The people and their games ---------------------------------------------------------------------------------------
const USERS = {
  maker: { email: "maker@dev.test", name: "Lena Maker", invited: true },
  free: { email: "free@dev.test", name: "Sam Free", invited: true },
  fresh: { email: "new@dev.test", name: null, invited: true },
  outsider: { email: "outsider@dev.test", name: null, invited: false },
};
const G = {}; // the games, by role, once seeded
let FROZEN = new Date(); // every page's clock: set after seeding, the same for both sites
const day = (n) => new Date(FROZEN.getTime() + n * 86_400_000).toISOString();
const minutes = (n) => new Date(FROZEN.getTime() + n * 60_000).toISOString();

const tsconfig = join(webDir, "tsconfig.json");
const nextEnv = join(webDir, "next-env.d.ts");
// next-env.d.ts is git-ignored: a new checkout has none until `next` first runs in it (then there is nothing to put back).
const kept = Object.fromEntries([tsconfig, nextEnv].filter((f) => existsSync(f)).map((f) => [f, readFileSync(f, "utf8")]));
const putBack = () => {
  for (const [file, text] of Object.entries(kept)) if (readFileSync(file, "utf8") !== text) writeFileSync(file, text);
};

/** A run that was stopped hard (taskkill) left its database and the builds its games published: the builds go first
 * (the database goes with this run's start, scripts/test-run.mjs). */
async function cleanLeftovers() {
  for (const left of await endedRunDatabases("shot_compare")) {
    const old = new pg.Client({ connectionString: urlOf(left) });
    try {
      await old.connect();
      const builds = join(root, "apps/games/builds");
      const ids = (await old.query('SELECT id FROM "Project"')).rows.map((r) => r.id);
      for (const name of existsSync(builds) ? readdirSync(builds) : []) {
        if (ids.some((id) => name.startsWith(`${id}-`))) rmSync(join(builds, name), { recursive: true, force: true });
      }
    } catch {
      // no tables yet, or another run's start dropped it meanwhile
    } finally {
      await old.end().catch(() => {});
    }
  }
}

// ---- Answers replaced in the browser (the same for both sites) ---------------------------------------------------------
const corsHeaders = (route) => ({
  "access-control-allow-origin": route.request().headers()["origin"] ?? "*",
  "access-control-allow-credentials": "true",
});
/** GET path: the API's own answer with its JSON changed by `edit`. */
const editJson = (path, edit) => async (page) =>
  page.route(`${apiBase}${path}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    await route.fulfill({ response: res, json: edit(await res.json()) });
  });
/** METHOD path (a glob): a fixed answer instead of the API's (preflights still go to the API, which allows both sites). */
const answer = (method, path, status, json) => async (page) =>
  page.route(`${apiBase}${path}`, async (route) => {
    if (route.request().method() !== method) return route.continue();
    await route.fulfill({ status, json: typeof json === "function" ? json() : json, headers: corsHeaders(route) });
  });
const BILLING_OFF = { mode: "off", status: "free", pendingPlan: null, periodEndsAt: null, cancelsAt: null, hold: null, freeRefillAt: null };
const ALL_MODELS = ["fast", "smart", "best"];
const meFree = (me) => ({
  ...me,
  plan: "free",
  models: ["fast"],
  credits: { available: 14, todayLeft: 3, expiring: { amount: 14, at: day(6) } },
  billing: { ...BILLING_OFF, mode: "sandbox", freeRefillAt: day(6) },
});
const mePaid = (me, billing = {}) => ({
  ...me,
  plan: "high",
  models: ALL_MODELS,
  credits: { available: 203.4, todayLeft: null, expiring: { amount: 163.4, at: day(52) } },
  billing: { ...BILLING_OFF, mode: "sandbox", status: "active", periodEndsAt: day(22), ...billing },
});
const subscription = (over = {}) => ({
  status: "active",
  renewsAt: day(22),
  endsAt: day(22),
  cancelsAt: null,
  pendingPlan: null,
  paymentFailedAt: null,
  paymentMethod: "Visa ending 4242",
  lastPlan: "high",
  ...over,
});
const payments = () => [
  { id: "txn_01shots03", at: day(-8), what: "Upgrade to High", amountUsd: 24.5, taxUsd: 4.41, invoiceNumber: "325-10003", refundableUntil: day(6), refundedUsd: 0, status: "paid", refundPendingUsd: null },
  { id: "txn_01shots02", at: day(-20), what: "Credit pack", amountUsd: 10, taxUsd: 1.8, invoiceNumber: "325-10002", refundableUntil: day(-6), refundedUsd: 0, status: "paid", refundPendingUsd: null },
  { id: "txn_01shots01", at: day(-38), what: "Medium plan", amountUsd: 20, taxUsd: 3.6, invoiceNumber: "325-10001", refundableUntil: day(-24), refundedUsd: 5, status: "partly_refunded", refundPendingUsd: null },
];
const billingFree = () => ({
  mode: "sandbox",
  plan: "free",
  subscription: null,
  credits: { parts: [{ source: "free", left: 14, expiresAt: day(6) }] },
  canBuyPack: false,
  payments: [],
  consent: null,
  hold: null,
});
const billingPaid = (over = {}) => ({
  mode: "sandbox",
  plan: "high",
  subscription: subscription(),
  credits: {
    parts: [
      { source: "plan", left: 163.4, expiresAt: day(52) },
      { source: "pack", left: 40, expiresAt: day(340) },
    ],
  },
  canBuyPack: true,
  payments: payments(),
  consent: { version: "v1", at: day(-38) },
  hold: null,
  ...over,
});
const asBilling = (info) => answer("GET", "/billing", 200, info);
const asMe = (edit) => editJson("/me", edit);
const confirmEstimates = editJson("/estimate?**", (e) => ({ ...e, high: Math.max(e.high, 31.5), needsConfirm: true }));
const sendFails = (status, error, message) => answer("POST", "/projects/*/messages", status, { error, message, statusCode: status });
const CHECKS_OK = [
  { id: "format", ok: true, text: "An APK, made for phones." },
  { id: "signed", ok: true, text: "Signed with this game's own key." },
  { id: "target", ok: true, text: "Targets Android 15, as Google Play asks." },
  { id: "arm64", ok: true, text: "Runs on 64-bit phones." },
  { id: "pages16k", ok: true, text: "Ready for phones with 16 KB memory pages." },
  { id: "version", ok: true, text: "Build number 5, higher than the last one." },
  { id: "debuggable", ok: true, text: "Not a debug build." },
];
const androidHub = ({ locked = false } = {}) => {
  const id = G.runner.id;
  const build = (n, over) => ({
    id: `${id}-a${n}`,
    versionN: 3,
    format: "apk",
    versionCode: n,
    versionName: `3.${n}`,
    status: "done",
    icon: "poster",
    checks: [],
    godotVersion: "4.7.2",
    queuedAt: minutes(-40 * n),
    ...over,
  });
  return {
    enabled: true,
    app: { packageName: `app.typeplay.robot_runner_${id}`, appName: "Robot Runner", versionCode: 6, packageLocked: locked, hasIcon: false, createdAt: day(-2) },
    key: { certSha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", createdAt: day(-2), downloadedAt: day(-1), downloads: 1 },
    builds: [
      build(6, { status: "running", queuedAt: minutes(-2), startedAt: minutes(-1.5) }),
      build(5, {
        bytes: 31_457_280,
        finishedAt: minutes(-60),
        expiresAt: day(29),
        checks: [...CHECKS_OK, { id: "permissions", ok: false, text: "Asks for android.permission.ACCESS_FINE_LOCATION: Google Play will ask you why." }],
      }),
      build(4, { format: "aab", bytes: 28_311_552, finishedAt: minutes(-170), expiresAt: day(28), checks: CHECKS_OK }),
      build(3, {
        status: "failed",
        failCode: "game",
        failMessage: "The game's code has an error, so Godot couldn't export it. Ask for a fix in the chat.",
        logTail: "@@icon poster\nERROR: res://main.gd:1 - Parse Error: fake failure\n",
      }),
      build(2, { status: "expired", bytes: 30_408_704 }),
      build(1, { status: "cancelled" }),
    ],
    limits: { perGameToday: 7, perUserToday: 27 },
  };
};

// ---- Scenarios ------------------------------------------------------------------------------------------------------
// { name, who, path, vps, full, init, patch, ready, act }: who signs in (none: signed out); path a string or a function
// (the games' ids come with the seed); patch the answers replaced for this page; ready waits for the page; act does what
// a person would, the same on both sites. A step changes the data between scenarios (once, for both sites).
const S = [];
const add = (s) => S.push(s);
const step = (name, run) => S.push({ step: name, run });
const T = 120_000;
const heading = (name) => (p) => p.getByRole("heading", { name }).first().waitFor({ timeout: T });
const text = (t) => (p) => p.getByText(t).first().waitFor({ timeout: T });
const button = (name) => (p) => p.getByRole("button", { name }).first().waitFor({ timeout: T });
/** The idea saved in this browser (the home page's box hands it over): an init script, given the words as its argument. */
const draft = (idea) => ({ init: (words) => localStorage.setItem("typeplay.draft", words), initArg: () => idea });
const click = (p, name) => p.getByRole("button", { name }).first().click();
const chatTab = async (p, vp) => {
  if (vp === "phone") await p.getByRole("tab", { name: /^Chat/ }).click();
};
const openAccount = async (p) => {
  await p.getByRole("button", { name: /^Account:/ }).click();
  await p.locator("#account-menu").waitFor({ state: "visible" });
};
const dialogOpen = (p) => p.locator("dialog[open]").waitFor({ timeout: T });
/** Clicks `target` until `opened` shows: a click that lands before the page has woken up (hydrated) does nothing, as
 * shot-gallery's openReport found. Once it is open no further click is made. */
const clickUntilOpen = async (target, opened) => {
  for (let i = 0; i < 10; i++) {
    await target.click({ timeout: 10_000 }).catch(() => {});
    if (await opened.waitFor({ timeout: 1500 }).then(() => true, () => false)) return;
  }
  throw new Error("it didn't open after 10 clicks");
};
const pop = (p) => p.locator(":popover-open").first();
const gamePage = (key, name) => ({ who: "maker", path: () => `/games/${G[key].id}`, ready: (p) => p.locator("h1", { hasText: name }).first().waitFor({ state: "attached", timeout: T }) });

// Public pages (signed out).
add({ name: "home", path: "/", full: true, ready: heading(/Type it/), act: async (p) => {
  await p.locator("#how").scrollIntoViewIfNeeded();
  await p.getByRole("button", { name: "Play it again" }).waitFor({ timeout: T });
} });
add({ name: "home-launcher", path: "/", ready: heading(/Type it/), act: async (p) => {
  await clickUntilOpen(p.getByRole("button", { name: /^Open / }).first(), p.getByRole("dialog"));
  await p.waitForTimeout(500);
} });
add({ name: "pricing", path: "/pricing", full: true, ready: heading(/Pay for what/) });
for (const doc of ["terms", "privacy", "refunds"]) add({ name: doc, path: `/${doc}`, full: true, ready: (p) => p.locator("article").waitFor({ timeout: T }) });
add({ name: "not-found", path: "/no-such-page", ready: heading("No such screen.") });
add({ name: "create-out", path: "/create", ...draft(IDEA), full: true, ready: button("Sign in with Google") });
// The header's Sign in (?signin=1&next=): Google's button first, with the note on where you go back to.
add({ name: "create-signin", path: "/create?signin=1&next=/explore", full: true, ready: button("Sign in with Google") });
// A plan's button from /pricing, signed out: the answer by sale state at the top, then Google's button.
add({ name: "create-plan-out", path: "/create?plan=medium", full: true, ready: button("Sign in with Google") });
add({ name: "games-out", path: "/games", full: true, ready: button("Sign in with Google") });
add({ name: "explore-empty", path: "/explore", full: true, ready: heading("No games here yet.") });
step("share four games and put them in the gallery", async () => {
  // Popular: Robot Runner (upright) first; New: Desert Racer (wide) first, so both stage layouts show.
  for (const [key, email] of [["runner", "maker"], ["fruit", "free"], ["cat", "maker"], ["racer", "maker"]]) {
    await api(USERS[email].email, "PATCH", `/projects/${G[key].id}`, { shared: true });
    await api(USERS[email].email, "PATCH", `/projects/${G[key].id}`, { listed: true });
    await sleep(50);
  }
});
add({ name: "explore", path: "/explore", full: true, ready: heading("Every game.") });
add({ name: "explore-new", path: "/explore?sort=new", full: true, ready: heading("Every game.") });
add({ name: "explore-report", path: "/explore", ready: heading("Every game."), act: async (p) => {
  await clickUntilOpen(p.getByRole("button", { name: "Report Desert Racer" }).first(), p.locator("dialog[open]"));
  await p.locator("dialog[open] label").nth(2).click();
} });
add({ name: "play", path: () => `/play/${G.runner.id}`, full: true, ready: heading("Robot Runner") });
add({ name: "play-wide", path: () => `/play/${G.racer.id}`, full: true, ready: heading("Desert Racer") });
add({ name: "play-report", path: () => `/play/${G.runner.id}`, ready: heading("Robot Runner"), act: async (p) => {
  await clickUntilOpen(p.getByRole("button", { name: "Report this game" }).first(), p.locator("dialog[open]"));
  await p.locator("dialog[open] label").first().click();
  await p.locator("dialog[open] textarea").fill("The music is from a film.");
} });
add({ name: "play-report-sent", path: () => `/play/${G.runner.id}`, patch: [answer("POST", "/public/games/*/report", 200, {})], ready: heading("Robot Runner"), act: async (p) => {
  await clickUntilOpen(p.getByRole("button", { name: "Report this game" }).first(), p.locator("dialog[open]"));
  await p.locator("dialog[open] label").first().click();
  await p.locator("dialog[open]").getByRole("button", { name: "Send report" }).click();
  await p.getByText("Thanks for telling us.").first().waitFor();
} });
add({ name: "play-gone", path: "/play/zzzzzzzzzz", ready: heading("This game isn't here.") });

// Signed in: the maker (Ultra+), her games, her account.
add({ name: "create", who: "maker", path: "/create", full: true, ready: button("Build my game") });
add({ name: "create-ask", who: "maker", path: "/create", ...draft(IDEA), patch: [confirmEstimates], full: true, ready: button("Build my game"), act: async (p) => {
  await click(p, "Build my game");
  await p.getByRole("button", { name: "Build it" }).waitFor();
} });
add({ name: "create-error", who: "maker", path: "/create", full: true, ready: button("Build my game"), act: async (p) => {
  await p.locator("#idea").fill("A game");
  await click(p, "Build my game");
  await p.getByText("Say a little more").first().waitFor();
} });
add({ name: "games", who: "maker", path: "/games", full: true, ready: heading("Your games.") , act: (p) => p.getByText("Robot Runner").first().waitFor() });
add({ name: "games-manage", who: "maker", path: "/games", full: true, ready: button("Manage"), act: (p) => click(p, "Manage") });
add({ name: "games-rename", who: "maker", path: "/games", full: true, ready: button("Manage"), act: async (p) => {
  await click(p, "Manage");
  await click(p, "Rename Robot Runner");
} });
add({ name: "games-delete", who: "maker", path: "/games", full: true, ready: button("Manage"), act: async (p) => {
  await click(p, "Manage");
  await click(p, "Delete Robot Runner");
  await p.getByText("Delete it for good?").first().waitFor();
} });
add({ name: "account", who: "maker", path: "/account", full: true, ready: text(/New game on/) });
add({ name: "account-close", who: "maker", path: "/account", full: true, ready: text(/New game on/), act: async (p) => {
  await click(p, "Delete my account");
  await p.locator("#confirm-delete").fill("DELE");
} });
add({ name: "account-menu", who: "maker", path: "/games", ready: heading("Your games."), act: openAccount });
add({ name: "feedback", who: "maker", path: "/games", ready: heading("Your games."), act: async (p) => {
  await openAccount(p);
  await p.locator("#account-menu").getByRole("button", { name: "Send feedback" }).click();
  await dialogOpen(p);
  await p.getByLabel("What happened?").fill("The game froze after the second level, and the music kept playing.");
} });
add({ name: "feedback-sent", who: "maker", path: "/games", patch: [answer("POST", "/feedback", 200, { id: "fb_shots" })], ready: heading("Your games."), act: async (p) => {
  await openAccount(p);
  await p.locator("#account-menu").getByRole("button", { name: "Send feedback" }).click();
  await dialogOpen(p);
  await p.getByLabel("What happened?").fill("The jump button stopped working.");
  await p.locator("dialog[open]").getByRole("button", { name: "Send feedback" }).click();
  await p.getByText("Thanks for telling us.").first().waitFor();
} });

// The game page: Robot Runner (upright, made for phones, three versions, shared and in the gallery).
const runner = gamePage("runner", "Robot Runner");
add({ name: "game", ...runner });
add({ name: "game-chat", ...runner, vps: ["phone"], act: chatTab });
add({ name: "game-ideas", ...runner, act: async (p, vp) => {
  await chatTab(p, vp);
  await click(p, "More ideas");
  await p.waitForTimeout(400);
} });
add({ name: "game-share", ...runner, act: async (p) => {
  await click(p, /Shared: change sharing/);
  await p.getByText("Show it in the gallery").first().waitFor();
} });
add({ name: "game-more", ...runner, act: async (p) => {
  await click(p, /^More: /);
  await pop(p).getByRole("button", { name: "Rename" }).waitFor();
} });
add({ name: "game-more-delete", ...runner, act: async (p) => {
  await click(p, /^More: /);
  await pop(p).getByRole("button", { name: "Delete game" }).click();
  await p.getByText("Delete Robot Runner?").first().waitFor();
} });
add({ name: "game-device", ...runner, vps: ["desktop"], act: async (p) => {
  await click(p, /^Preview size/);
  await pop(p).getByText("Fill the window").first().waitFor();
} });
add({ name: "game-fit-hint", ...runner, vps: ["desktop"], act: async (p) => {
  await click(p, /^Preview size/);
  await pop(p).getByRole("button", { name: /^Laptop/ }).click();
  await p.getByText("Made for phones.").first().waitFor();
} });
add({ name: "game-rename", ...runner, act: async (p) => {
  await click(p, /^More: /);
  await pop(p).getByRole("button", { name: "Rename" }).click();
  await p.getByLabel("Name of the game").waitFor();
} });
add({ name: "game-restore", ...runner, act: async (p) => {
  await click(p, "Restore");
  await p.getByText(/^Play version/).first().waitFor();
} });
add({ name: "game-feedback", ...runner, act: async (p) => {
  await click(p, /^More: /);
  await pop(p).getByRole("button", { name: "Send feedback" }).click();
  await dialogOpen(p);
} });
add({ name: "game-ask", ...runner, patch: [confirmEstimates], act: async (p, vp) => {
  await chatTab(p, vp);
  await p.locator("#say").fill("Add a boss fight at the end of every level");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.getByRole("button", { name: "Send it" }).waitFor();
} });
add({ name: "game-no-credits", ...runner, patch: [sendFails(402, "no_credits", "You're out of credits.")], act: async (p, vp) => {
  await chatTab(p, vp);
  await p.locator("#say").fill("Add a shop for hats");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.getByRole("link", { name: /^Add 40 credits/ }).waitFor();
} });
add({ name: "game-error", ...runner, patch: [sendFails(500, "server_error", "Something went wrong on our side. Please try again.")], act: async (p, vp) => {
  await chatTab(p, vp);
  await p.locator("#say").fill("Add a shop for hats");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.getByText("Something went wrong on our side.").first().waitFor();
} });
add({ name: "game-past-due", ...runner, patch: [asMe((me) => mePaid(me, { status: "past_due", periodEndsAt: day(-2) }))], act: async (p, vp) => {
  await chatTab(p, vp);
  await p.getByRole("link", { name: "Update card" }).waitFor();
} });
step("take Robot Runner out of the gallery", async () => admin("gallery", "hide", G.runner.id, "shots"));
add({ name: "game-share-hidden", ...runner, act: async (p) => {
  await click(p, /Shared: change sharing/);
  await p.getByText("We took it out of the gallery after a report.").first().waitFor();
} });
step("put Robot Runner back", async () => admin("gallery", "unhide", G.runner.id));
add({ name: "game-share-off", ...gamePage("bee", "Bee Flap"), act: async (p) => {
  await click(p, "Share this game");
  await p.getByText("Only you can play it now.").first().waitFor();
} });
add({ name: "game-wide", ...gamePage("racer", "Desert Racer") });
add({ name: "game-failed", who: "maker", path: () => `/games/${G.failed.id}`, ready: (p) => p.getByText("No game yet.").first().waitFor({ state: "attached", timeout: T }), act: async (p, vp) => {
  // A phone opens a game that never built on its chat; the stage is on the Play tab.
  if (vp === "phone") await p.getByRole("tab", { name: /^Play/ }).click();
  await p.getByText("No game yet.").first().waitFor();
} });
step("start two builds that hold (a first build, a change)", async () => {
  G.held = await api(USERS.maker.email, "POST", "/projects", { prompt: "Make a tower defence game with little robots HOLD", model: "fast" });
  await api(USERS.maker.email, "POST", `/projects/${G.bee.id}/messages`, { text: "Add a night level HOLD", model: "fast" });
  await sleep(1500); // past the first progress line (300 ms)
});
add({ name: "game-building", who: "maker", path: () => `/games/${G.held.id}`, ready: text("Play one while you wait"), act: (p) => p.getByRole("button", { name: /^Play / }).first().waitFor({ timeout: T }) });
add({ name: "game-building-play", who: "maker", path: () => `/games/${G.held.id}`, ready: text("Play one while you wait"), act: async (p) => {
  await p.getByRole("button", { name: /^Play / }).first().click();
  await p.getByRole("button", { name: /Close/ }).first().waitFor({ timeout: T });
  await p.waitForTimeout(600);
} });
add({ name: "game-building-change", ...gamePage("bee", "Bee Flap"), act: (p) => p.getByText(/^Making version 2/).first().waitFor({ timeout: T }) });
add({ name: "buildpill", who: "maker", path: "/explore", init: (id) => sessionStorage.setItem("typeplay:waiting", id), initArg: () => G.held.id, ready: text("Building your game") });
step("stop the two builds", async () => {
  await api(USERS.maker.email, "POST", `/projects/${G.held.id}/cancel`).catch(() => {});
  await api(USERS.maker.email, "POST", `/projects/${G.bee.id}/cancel`).catch(() => {});
  await idle(USERS.maker.email, G.held.id);
  await idle(USERS.maker.email, G.bee.id);
});

// Plan and billing: the API runs with billing off; the "on" states are its answers replaced.
add({ name: "billing-off", who: "maker", path: "/billing", ready: text(/opens here|on sale yet/) });
add({ name: "billing-free", who: "maker", path: "/billing", patch: [asMe(meFree), asBilling(billingFree)], full: true, ready: button("Get a plan") });
add({ name: "billing-free-picker", who: "maker", path: "/billing", patch: [asMe(meFree), asBilling(billingFree)], full: true, ready: button("Get a plan"), act: async (p) => {
  await click(p, "Get a plan");
  await heading("Pick a plan")(p);
} });
add({ name: "billing-paid", who: "maker", path: "/billing", patch: [asMe(mePaid), asBilling(billingPaid)], full: true, ready: button("Change plan") });
add({ name: "billing-paid-picker", who: "maker", path: "/billing", patch: [asMe(mePaid), asBilling(billingPaid)], full: true, ready: button("Change plan"), act: async (p) => {
  await click(p, "Change plan");
  await p.getByRole("button", { name: "Switch at renewal" }).first().waitFor();
} });
add({ name: "billing-preview", who: "maker", path: "/billing", full: true, ready: button("Change plan"), patch: [
  asMe(mePaid),
  asBilling(billingPaid),
  answer("GET", "/billing/plan-change?**", 200, () => ({ direction: "up", chargeNowUsd: 49.5, taxNowUsd: 8.91, creditsNow: 325, nextRenewalUsd: 100, effectiveAt: FROZEN.toISOString() })),
], act: async (p) => {
  await click(p, "Change plan");
  await click(p, "Upgrade");
  await p.getByText(/^You pay/).first().waitFor();
} });
add({ name: "billing-cancel", who: "maker", path: "/billing", patch: [asMe(mePaid), asBilling(billingPaid)], full: true, ready: button("Change plan"), act: async (p) => {
  await click(p, "Cancel plan");
  await p.getByText("Cancel at the end of your period?").first().waitFor();
} });
add({ name: "billing-strips", who: "maker", path: "/billing", full: true, ready: text(/didn't go through/), patch: [
  asMe((me) => mePaid(me, { status: "past_due", periodEndsAt: day(-2), hold: "chargeback" })),
  asBilling(() => {
    const info = billingPaid({ subscription: subscription({ status: "past_due", renewsAt: null, endsAt: day(-2), paymentFailedAt: day(-2) }), hold: "chargeback" });
    info.payments[0].refundPendingUsd = 24.5;
    return info;
  }),
] });
add({ name: "billing-strips-cancel", who: "maker", path: "/billing", full: true, ready: text(/Your plan ends on/), patch: [
  asMe((me) => mePaid(me, { status: "canceling", cancelsAt: day(22), pendingPlan: "medium" })),
  asBilling(() => billingPaid({ subscription: subscription({ renewsAt: null, cancelsAt: day(22), pendingPlan: "medium" }) })),
] });
add({ name: "checkout", who: "maker", path: "/billing/checkout?item=plan:medium", patch: [asMe(meFree)], ready: button("Continue to payment"), act: (p) => p.getByRole("checkbox").check() });
add({ name: "checkout-pack-free", who: "maker", path: "/billing/checkout?item=pack", patch: [asMe(meFree)], ready: text("Credit packs are for paid plans") });
add({ name: "checkout-has-plan", who: "maker", path: "/billing/checkout?item=plan:ultra", patch: [asMe(mePaid)], ready: text("You already have a plan") });
add({ name: "checkout-off", who: "maker", path: "/billing/checkout?item=plan:medium", ready: text(/opens here soon|on sale yet/) });
add({ name: "checkout-none", who: "maker", path: "/billing/checkout", ready: heading("Pick a plan.") });

// Android: setup on Desert Racer; the hub on Robot Runner, its builds replaced with every state a build can be in.
const hub = { who: "maker", path: () => `/games/${G.runner.id}/android`, full: true, ready: text("Your builds") };
const linkAnswer = answer("POST", "/projects/*/android/builds/*/link", 200, () => ({ url: `${apiBase}/android/dl/shots0000000000000000000000000000`, expiresAt: minutes(10) }));
add({ name: "android-setup", who: "maker", path: () => `/games/${G.racer.id}/android`, full: true, ready: text("Set up Android.") });
add({ name: "android-setup-done", who: "maker", path: () => `/games/${G.racer.id}/android`, full: true, ready: text("Set up Android."), patch: [answer("POST", "/projects/*/android", 200, () => androidHub())], act: async (p) => {
  await click(p, "Set up Android");
  await p.getByText("Your builds").first().waitFor();
} });
add({ name: "android", ...hub, patch: [editJson("/projects/*/android", () => androidHub())] });
add({ name: "android-phone", ...hub, patch: [editJson("/projects/*/android", () => androidHub()), linkAnswer], act: async (p) => {
  await click(p, "Phone link");
  await p.getByText("On your phone").first().waitFor();
} });
add({ name: "android-checks", ...hub, patch: [editJson("/projects/*/android", () => androidHub())], act: async (p) => {
  await click(p, "Checks");
  await p.getByText(/ACCESS_FINE_LOCATION/).first().waitFor();
} });
add({ name: "android-details", ...hub, patch: [editJson("/projects/*/android", () => androidHub())], act: async (p) => {
  await click(p, "Details");
  await p.getByText(/Parse Error/).first().waitFor();
} });
add({ name: "android-key", ...hub, patch: [editJson("/projects/*/android", () => androidHub())], act: (p) => click(p, "If you lose it") });
add({ name: "android-change", ...hub, patch: [editJson("/projects/*/android", () => androidHub())], act: async (p) => {
  await click(p, "Change");
  await p.getByRole("button", { name: "Use my own" }).waitFor();
} });
add({ name: "android-package-ask", ...hub, patch: [editJson("/projects/*/android", () => androidHub({ locked: true }))], act: async (p) => {
  await click(p, "Change");
  await click(p, "Use my own");
  await p.locator("#droid-package").fill("com.lenamaker.robotrunner");
  await click(p, "Save");
  await p.getByRole("button", { name: "Change it anyway" }).waitFor();
} });
add({ name: "android-no-game", who: "maker", path: () => `/games/${G.failed.id}/android`, full: true, ready: heading(/^(Android.|Can.t open this page.)$/) });
add({ name: "android-off", who: "maker", path: () => `/games/${G.runner.id}/android`, full: true, patch: [asMe((me) => ({ ...me, features: { android: false } }))], ready: heading("Android.") });

// The Free plan: Sam and his fruit game.
add({ name: "create-free", who: "free", path: "/create", full: true, ready: button("Build my game") });
add({ name: "create-short", who: "free", path: "/create", ...draft(IDEA), full: true, patch: [asMe((me) => ({ ...me, credits: { available: 0.4, todayLeft: 0.4, expiring: null } }))], ready: (p) => p.getByRole("link", { name: "Get credits" }).waitFor({ timeout: T }) });
add({ name: "game-free", who: "free", path: () => `/games/${G.fruit.id}`, ready: (p) => p.locator("h1", { hasText: "Fruit Pop" }).first().waitFor({ state: "attached", timeout: T }), act: chatTab });
add({ name: "game-daily-limit", who: "free", path: () => `/games/${G.fruit.id}`, patch: [sendFails(402, "daily_limit", "Today's free credits are used.")], ready: (p) => p.locator("h1", { hasText: "Fruit Pop" }).first().waitFor({ state: "attached", timeout: T }), act: async (p, vp) => {
  await chatTab(p, vp);
  await p.locator("#say").fill("Add a bomb fruit");
  await p.getByRole("button", { name: "Send", exact: true }).click();
  await p.getByRole("link", { name: /^Get Medium/ }).waitFor();
} });
add({ name: "account-free", who: "free", path: "/account", full: true, ready: text(/New game on/) });
add({ name: "android-free", who: "free", path: () => `/games/${G.fruit.id}/android`, full: true, ready: text("Android builds come with a plan.") });
add({ name: "games-empty", who: "fresh", path: "/games", ready: text("No games yet.") });

// The closed beta: signed in, not invited.
const closed = { who: "outsider", path: "/create", ...draft(IDEA), full: true, ready: heading("TypePlay is in a closed beta.") };
add({ name: "closed", ...closed });
add({ name: "closed-short", ...closed, act: async (p) => {
  await p.locator("#beta-code").fill("12");
  await click(p, "Join the beta");
  await p.getByText(/^Type the 6 digits/).first().waitFor();
} });
add({ name: "closed-wrong", ...closed, patch: [answer("POST", "/beta/code", 403, { error: "code_wrong", message: "That code isn't right. Check the six digits in your invitation.", statusCode: 403 })], act: async (p) => {
  await p.locator("#beta-code").fill("123456");
  await click(p, "Join the beta");
  await p.getByText("That code isn't right.", { exact: false }).first().waitFor();
} });
add({ name: "closed-menu", ...closed, act: async (p) => {
  await openAccount(p);
  await p.getByText("TypePlay is in a closed beta for now.").first().waitFor();
} });

// The keyboard's focus ring on each kind of surface, and the hot button under a pointer (the contrast fix, 10-26).
/** The keyboard on `pick(page)` as after a Tab: a key press first, so the browser draws the ring (`:focus-visible`). */
const keyFocus = (pick) => async (p, vp) => {
  const el = pick(p, vp);
  await p.keyboard.press("Shift");
  await el.focus();
  if (!(await el.evaluate((n) => n.matches(":focus-visible")))) throw new Error("no focus ring");
};
/** The pointer over `pick(page)`, checked: the page settled first, so nothing moves out from under it. */
const pointAt = (pick) => async (p) => {
  const el = pick(p);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(800);
  await el.hover();
  if (!(await el.evaluate((n) => n.matches(":hover")))) throw new Error("not under the pointer");
};
add({ name: "focus-home-prompt", path: "/", ready: heading(/Type it/), act: keyFocus((p) => p.locator("#prompt")) });
add({ name: "focus-home-button", path: "/", ready: heading(/Type it/), act: keyFocus((p) => p.getByRole("button", { name: "Make my game" })) });
add({ name: "focus-home-icon", path: "/", ready: heading(/Type it/), act: keyFocus((p) => p.getByRole("button", { name: /^Open / }).first()) });
add({ name: "focus-pricing-quiet", path: "/pricing", ready: heading(/Pay for what/), act: keyFocus((p) => p.locator(".plan a").first()) });
add({ name: "focus-pricing-lead", path: "/pricing", ready: heading(/Pay for what/), act: keyFocus((p) => p.locator(".plan a.button--ink").first()) });
add({ name: "focus-footer", path: "/pricing", ready: heading(/Pay for what/), act: keyFocus((p) => p.locator("footer a").last()) });
add({ name: "focus-create-idea", who: "maker", path: "/create", ready: button("Build my game"), act: keyFocus((p) => p.locator("#idea")) });
add({ name: "focus-create-model", who: "maker", path: "/create", ready: button("Build my game"), act: keyFocus((p) => p.locator(".choice input:checked").last()) });
add({ name: "focus-create-build", who: "maker", path: "/create", ...draft(IDEA), ready: button("Build my game"), act: keyFocus((p) => p.getByRole("button", { name: "Build my game" })) });
add({ name: "hover-create-build", who: "maker", path: "/create", ...draft(IDEA), vps: ["desktop"], ready: button("Build my game"), act: pointAt((p) => p.getByRole("button", { name: "Build my game" })) });
add({ name: "hover-home-button", path: "/", vps: ["desktop"], ready: heading(/Type it/), act: pointAt((p) => p.getByRole("button", { name: "Make my game" })) });
add({ name: "focus-explore-card", path: "/explore", ready: heading("Every game."), act: keyFocus((p) => p.locator(".gamecard__link").first()) });
add({ name: "focus-game-segment", ...runner, act: async (p, vp) => {
  await chatTab(p, vp);
  await keyFocus((pg) => pg.locator(".composer .switch__opt input:checked").first())(p, vp);
} });
add({ name: "focus-game-pill", ...runner, act: async (p, vp) => {
  if (vp === "phone") await p.getByRole("tab", { name: /^Play/ }).click();
  await keyFocus((pg) => pg.locator(".stage .inkpill:visible").first())(p, vp);
} });
add({ name: "focus-checkout-box", who: "maker", path: "/billing/checkout?item=plan:medium", patch: [asMe(meFree)], ready: button("Continue to payment"), act: keyFocus((p) => p.getByRole("checkbox")) });
add({ name: "focus-android-heading", ...hub, full: false, patch: [editJson("/projects/*/android", () => androidHub())], act: keyFocus((p) => p.locator("#droid-build")) });

// ---- Which scenarios run where ----------------------------------------------------------------------------------------
// The pages (a screen as it opens, no popup): with --every-shape, each at every shape and at 100% and 200% text.
const PAGES = new Set([
  "home", "pricing", "terms", "privacy", "refunds", "not-found", "create-out", "create-signin", "create-plan-out", "games-out",
  "explore-empty", "explore", "explore-new", "play", "play-wide", "play-gone", "create", "games", "account", "game",
  "game-chat", "game-wide", "game-failed", "game-building", "billing-off", "billing-free", "billing-paid", "checkout",
  "checkout-off", "checkout-none", "android-setup", "android", "android-no-game", "android-off", "create-free",
  "create-short", "game-free", "account-free", "android-free", "games-empty", "closed",
]);
// What needs Paddle's client token (billing on), and the closed beta's own page (not at open sign-up).
for (const s of S) {
  if (!s.name) continue;
  if (/^(billing-(free|paid|preview|cancel|strips)|checkout(-pack-free|-has-plan)?$|focus-checkout-box$|game-(past-due|no-credits|daily-limit)$)/.test(s.name)) s.sales = ["on"];
  if (/^closed/.test(s.name)) s.sales = ["on", "beta"];
}

// ---- Shooting and comparing -----------------------------------------------------------------------------------------
/** Phones (upright and sideways) and the tablet are touch screens; desktop has a mouse. `phone` is 390x844. */
const shape = (width, height) => {
  const touch = Math.max(width, height) < 1100;
  return { viewport: { width, height }, deviceScaleFactor: 1, ...(touch ? { isMobile: true, hasTouch: true } : {}) };
};
const VIEWPORTS = {
  desktop: shape(1440, 900),
  phone: shape(390, 844),
  "280x653": shape(280, 653),
  "320x568": shape(320, 568),
  "360x780": shape(360, 780),
  "375x667": shape(375, 667),
  "412x915": shape(412, 915),
  "430x932": shape(430, 932),
  "844x390": shape(844, 390),
  "768x1024": shape(768, 1024),
};
/** The layout a scenario's act sees: the game page's tabs (Chat / Play) show below 960px. */
const kindOf = (vp) => (VIEWPORTS[vp].viewport.width < 960 ? "phone" : "desktop");
/** [viewport, text %] pairs for a scenario: as before (desktop and phone at 100%), or the whole pass (--every-shape),
 * narrowed by --shapes and --texts when given (a quicker slice of the same pass). */
function shotsOf(s) {
  const own = s.vps ?? ["desktop", "phone"];
  let pairs;
  if (!opts.every) pairs = own.map((vp) => [vp, 100]);
  else if (PAGES.has(s.name)) {
    const kinds = new Set(own.map(kindOf));
    const all = Object.keys(VIEWPORTS).filter((vp) => kinds.has(kindOf(vp)));
    pairs = [100, 200].flatMap((text) => all.map((vp) => [vp, text]));
  } else if (/^(focus|hover)-/.test(s.name)) pairs = own.map((vp) => [vp, 100]);
  else pairs = [...own.map((vp) => [vp, 100]), ...["phone", "320x568"].filter((vp) => own.some((o) => kindOf(o) === "phone")).map((vp) => [vp, 200])];
  return pairs.filter(([vp, text]) => (!opts.shapes || opts.shapes.includes(vp)) && (!opts.texts || opts.texts.includes(text)));
}
let browser = null;
const contexts = new Map();
async function contextFor(site, vp, who) {
  const key = `${site.id}:${vp}:${who ?? "out"}`;
  if (contexts.has(key)) return contexts.get(key);
  const ctx = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: "reduce", locale: "en-US", timezoneId: "UTC", serviceWorkers: "block" });
  await ctx.clock.setFixedTime(FROZEN);
  await ctx.addInitScript((email) => {
    try {
      if (email) localStorage.setItem("typeplay.devEmail", email);
      else localStorage.removeItem("typeplay.devEmail");
    } catch {
      /* no storage */
    }
    // Paddle.js stands in: nothing is fetched from Paddle.
    window.Paddle = { Environment: { set() {} }, Initialize() {}, Checkout: { open() {} } };
  }, who ? USERS[who].email : null);
  // Google's button (on, as live): its script is answered by the stand-in, never Google's.
  await ctx.route((url) => url.host === "accounts.google.com" && url.pathname === "/gsi/client", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: GIS_STUB }),
  );
  // No game ever starts: the frame shows a blank page instead of the engine.
  await ctx.route(`${gamesBase}/play.html**`, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><body style=\"margin:0;background:#2a1858\"></body>" }));
  contexts.set(key, ctx);
  return ctx;
}
/** Fonts and pictures loaded (below the fold too, for full pages), the dev overlay hidden, the page still. */
async function settle(page, full) {
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  if (full) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(60);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => {
        i.addEventListener("load", r, { once: true });
        i.addEventListener("error", r, { once: true });
        setTimeout(r, 5000);
      })),
    );
  });
  // The status bar's account place answered (Sign in, or the credits): a session still loading drew an empty place on
  // one side only (2026-11-21: /no-such-page's Sign in missing from the after picture at six shapes, there in the page).
  await page
    .waitForFunction(() => !document.querySelector(".account__wait") && ![...document.querySelectorAll(".account__credits b")].some((b) => b.textContent === "…"), null, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(500);
}
const problems = [];
/** The tallest piece of a page in one picture (see shoot). */
const SEGMENT = 8000;
/** A pair's name in files and the report: the scenario, the viewport, "-200" at 200% text. */
const tagOf = (name, vp, text) => `${name}-${vp}${text === 200 ? "-200" : ""}`;
async function shoot(sc, vp, text, site) {
  const ctx = await contextFor(site, vp, sc.who);
  const page = await ctx.newPage();
  const tag = tagOf(sc.name, vp, text);
  page.on("pageerror", (e) => problems.push(`${tag} ${site.id}: page error: ${e.message}`));
  try {
    if (sc.init) await page.addInitScript(sc.init, sc.initArg?.());
    for (const p of sc.patch ?? []) await p(page);
    const path = typeof sc.path === "function" ? sc.path() : sc.path;
    await page.goto(site.url + path, { waitUntil: "domcontentloaded", timeout: 240_000 });
    if (sc.ready) await sc.ready(page);
    if (sc.act) await sc.act(page, kindOf(vp));
    // The dev-only sign-in isn't on the live site: out of the picture and the measures.
    await page.addStyleTag({ content: ".devsignin{display:none!important}" }).catch(() => {});
    if (text === 200) {
      await doubleText(page);
      await page.waitForTimeout(300);
    }
    await settle(page, sc.full);
    const measured = { ...(await wideParts(page)), broken: await brokenWords(page) };
    // A page taller than the browser draws in one picture (16384px: past it the picture repeats the page's top, as a
    // long page at 200% text on a phone is) is shot in pieces of SEGMENT, `<tag>~2-<site>.png` and on.
    const height = sc.full ? await page.evaluate(() => document.documentElement.scrollHeight) : 0;
    const pieces = height > SEGMENT * 1.5 ? Math.ceil(height / SEGMENT) : 1;
    const files = [];
    const shot = { animations: "disabled", caret: "hide", mask: [page.locator("iframe"), page.locator('img[src*="/_next/image"]'), page.getByLabel("Link to the game")], maskColor: "#ff00ff" };
    // A touch screen's whole page: Chromium's full-page picture drops the touch emulation while it draws, so the
    // finger-sized rules (pointer: coarse) were missing from every full phone picture while the measures had them
    // (2026-11-21: /create's Effort row wrapped on the phone, one line in its picture). The viewport is made as tall as
    // the page (or a piece) instead and drawn as it is. A page wider than the screen keeps the full-page picture, which
    // shows how far it runs out.
    const tallViewport = sc.full && VIEWPORTS[vp].hasTouch && measured.width <= measured.screen;
    const screenSize = page.viewportSize();
    try {
      for (let i = 0; i < pieces; i++) {
        const file = join(out, "shots", `${tag}${i ? `~${i + 1}` : ""}-${site.id}.png`);
        const pieceHeight = pieces > 1 ? Math.min(SEGMENT, height - i * SEGMENT) : height;
        if (tallViewport) {
          await page.setViewportSize({ width: screenSize.width, height: pieceHeight });
          await page.evaluate((top) => window.scrollTo(0, top), i * SEGMENT);
          await page.waitForTimeout(150);
          await page.screenshot({ path: file, ...shot });
        } else {
          const clip = pieces > 1 ? { clip: { x: 0, y: i * SEGMENT, width: measured.width, height: pieceHeight } } : {};
          await page.screenshot({ path: file, fullPage: !!sc.full, ...clip, ...shot });
        }
        files.push(file);
      }
    } finally {
      if (tallViewport) await page.setViewportSize(screenSize);
    }
    return { files, ...measured };
  } finally {
    await page.close();
  }
}
let comparer = null;
/** Pixel by pixel in a page of its own: how many differ (a channel by more than 2), where, and a picture of them. */
async function compare(fileA, fileB, diffFile) {
  const a = `data:image/png;base64,${readFileSync(fileA).toString("base64")}`;
  const b = `data:image/png;base64,${readFileSync(fileB).toString("base64")}`;
  const r = await comparer.evaluate(
    async ({ a, b }) => {
      const load = (src) => new Promise((ok, no) => Object.assign(new Image(), { onload() { ok(this); }, onerror: no, src }));
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const w = Math.max(ia.width, ib.width);
      const h = Math.max(ia.height, ib.height);
      const pixels = (img) => {
        const c = new OffscreenCanvas(w, h).getContext("2d");
        c.drawImage(img, 0, 0);
        return c.getImageData(0, 0, w, h).data;
      };
      const pa = pixels(ia);
      const pb = pixels(ib);
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext("2d");
      const shown = ctx.createImageData(w, h);
      let n = 0;
      let box = null;
      for (let i = 0; i < pa.length; i += 4) {
        const differs = Math.abs(pa[i] - pb[i]) > 2 || Math.abs(pa[i + 1] - pb[i + 1]) > 2 || Math.abs(pa[i + 2] - pb[i + 2]) > 2 || Math.abs(pa[i + 3] - pb[i + 3]) > 2;
        if (differs) {
          n++;
          const x = (i / 4) % w;
          const y = Math.floor(i / 4 / w);
          box = box ? [Math.min(box[0], x), Math.min(box[1], y), Math.max(box[2], x), Math.max(box[3], y)] : [x, y, x, y];
          shown.data.set([255, 0, 0, 255], i);
        } else {
          const g = 170 + Math.round(((pa[i] + pa[i + 1] + pa[i + 2]) / 3) * 0.33);
          shown.data.set([g, g, g, 255], i);
        }
      }
      if (!n) return { n, w, h, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], box, png: null };
      ctx.putImageData(shown, 0, 0);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return { n, w, h, sizeA: [ia.width, ia.height], sizeB: [ib.width, ib.height], box, png: btoa(bin) };
    },
    { a, b },
  );
  if (r.png) writeFileSync(diffFile, Buffer.from(r.png, "base64"));
  else rmSync(diffFile, { force: true });
  return { pixels: r.n, size: r.sizeA.join("×") === r.sizeB.join("×") ? r.sizeA.join("×") : `${r.sizeA.join("×")} vs ${r.sizeB.join("×")}`, box: r.box };
}
/** A word broken where it shouldn't be: not at a hyphen the browser shows, and not a word longer than its whole line. */
const badBreak = (w) => !w.endsWith("(hyphen)") && !w.endsWith("(longer than its line)");
/** A shot that doesn't fit: wider than the screen, or a word broken where it shouldn't be (badBreak). */
const faulty = (m, screen) => !!m && (m.width > screen || m.broken.some(badBreak));
function report(results) {
  const rank = (r) => (r.pixels > 0 ? 2 : 0) + (faulty(r.after ?? r.base, r.screen) ? 1 : 0);
  const sorted = [...results].sort((x, y) => rank(y) - rank(x) || x.tag.localeCompare(y.tag));
  const sides = SITES.map((s) => s.id);
  const summary = Object.fromEntries(sides.map((id) => [id, { wide: results.filter((r) => r[id] && r[id].width > r.screen).length, broken: results.filter((r) => r[id]?.broken.some(badBreak)).length }]));
  writeFileSync(join(out, "report.json"), JSON.stringify({ base: sha, sale: opts.sale, at: new Date().toISOString(), summary, results: sorted, problems }, null, 2));
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const fit = (r, id) => {
    const m = r[id];
    if (!m) return "";
    const wide = m.width > r.screen ? `<b>${m.width}px</b> ${esc(m.parts.join(", "))}` : "fits";
    return `${wide}${m.broken.length ? `<br>${esc(m.broken.join("; "))}` : ""}`;
  };
  const row = (r) => `<tr><td>${r.name}</td><td>${r.vp}${r.text === 200 ? " · 200%" : ""}</td><td>${r.error ?? (opts.one ? "" : r.pixels ? `<b>${r.pixels.toLocaleString("en-US")} px</b>` : "same")}</td><td>${r.size ?? ""}</td><td>${r.box ? r.box.join(", ") : ""}</td>` +
    sides.map((id) => `<td>${fit(r, id)}</td>`).join("") +
    `<td>${Array.from({ length: r.pieces ?? 1 }, (_, i) => {
      const at = i ? `~${i + 1}` : "";
      return `${i ? `<br>piece ${i + 1}: ` : ""}${sides.map((s) => `<a href="shots/${r.tag}${at}-${s}.png">${s}</a>`).join(" · ")}${r.pixels && existsSync(join(out, "diff", `${r.tag}${at}.png`)) ? ` · <a href="diff/${r.tag}${at}.png">diff</a>` : ""}`;
    }).join("")}</td></tr>`;
  writeFileSync(join(out, "index.html"), `<!doctype html><meta charset="utf-8"><title>shot-compare ${sha}</title><style>body{font:14px system-ui;margin:24px}td{padding:4px 10px;border-bottom:1px solid #ddd;vertical-align:top}</style>` +
    `<h1>${opts.one ? (opts.one === "base" ? `Base ${sha} alone` : "This checkout alone") : `Base ${sha} vs this checkout`} (sale: ${opts.sale})</h1><p>${opts.one ? "" : `${results.filter((r) => r.pixels).length} of ${results.length} pairs differ; `}${problems.length} problems. ` +
    sides.map((id) => `${id}: ${summary[id].wide} wider than the screen, ${summary[id].broken} with a word broken inside`).join("; ") + `.</p>` +
    `<table><tr><th>Scenario</th><th>Viewport</th><th>Differs</th><th>Size</th><th>Where</th>${sides.map((id) => `<th>Fits (${id})</th>`).join("")}<th>Pictures</th></tr>${sorted.map(row).join("")}</table>` +
    (problems.length ? `<h2>Problems</h2><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>` : ""));
}

// ---- Run ------------------------------------------------------------------------------------------------------------
const results = [];
try {
  log(`base ${sha} in ${SITES[0].dir}; database ${DB}; ports ${Object.entries(PORT).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  rmSync(DATA, { recursive: true, force: true });
  const apiProc = start("api", ["dist/main.js"], serverDir, apiEnv);
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 90, apiProc);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(PORT.games)], root, {});
  await until("the games origin", async () => (await fetch(`${gamesBase}/play.html`)).ok, 30, gamesProc);
  const next = join(root, "node_modules/next/dist/bin/next");
  const siteProcs = SITES.map((s) => start(`site-${s.id}`, [next, "dev", "-p", String(s.port)], s.dir, siteEnv));
  log("stack starting: API, games origin, both sites");

  // The data, while the sites compile.
  for (const u of Object.values(USERS)) if (u.invited) admin("invite", "add", u.email);
  for (const u of [USERS.maker, USERS.free, USERS.fresh]) await api(u.email, "GET", "/me");
  admin("plan", USERS.maker.email, "ultraplus");
  admin("grant", USERS.maker.email, "1300", "Ultra+ for the screenshots");
  const userDb = new pg.Client({ connectionString: urlOf(DB) });
  await userDb.connect();
  for (const u of Object.values(USERS)) if (u.name) await userDb.query(`UPDATE "User" SET name = $1 WHERE email = $2`, [u.name, u.email]);
  const maker = USERS.maker.email;
  G.runner = await game(maker, IDEA, { model: "smart", platform: "phone", name: "Robot Runner", edits: ["Add coins to collect", "Add a double jump"] });
  G.racer = await game(maker, "Make a racing game on a wide desert road at sunset", { model: "smart", platform: "computer", name: "Desert Racer" });
  G.bee = await game(maker, "Make a flappy game with a bee between flowers", { name: "Bee Flap" });
  G.cat = await game(maker, "Make a platformer with a cat that jumps on clouds NOPOSTER", { name: "Cloud Cat" });
  G.failed = await game(maker, "Make a puzzle with falling blocks FAIL");
  G.fruit = await game(USERS.free.email, "Make a match-3 game with fruit that pops", { name: "Fruit Pop" });
  const today = new Date().toISOString().slice(0, 10);
  for (const [key, n] of [["runner", 1234], ["racer", 340], ["fruit", 12]]) {
    await userDb.query(`INSERT INTO "PlayCount" ("projectId", day, count) VALUES ($1, $2, $3)`, [G[key].id, today, n]);
  }
  await userDb.end();
  log(`seeded: ${Object.entries(G).map(([k, g]) => `${k} ${g.id}`).join(", ")}`);
  // One clock for every page of the run: an hour after the seed, on the minute.
  FROZEN = new Date(Math.ceil(Date.now() / 60_000) * 60_000 + 60 * 60_000);

  for (const [i, s] of SITES.entries()) await until(`the ${s.id} site`, async () => (await fetch(`${s.url}/pricing`)).ok, 300, siteProcs[i]);
  putBack();
  log("stack up");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  comparer = await (await browser.newContext()).newPage();

  for (const s of S) {
    if (s.step) {
      log(`step: ${s.step}`);
      await s.run();
      continue;
    }
    if (opts.only && !opts.only.test(s.name)) continue;
    if (s.sales && !s.sales.includes(opts.sale)) continue;
    for (const [vp, text] of shotsOf(s)) {
      const shots = {};
      for (const site of SITES) {
        try {
          shots[site.id] = await shoot(s, vp, text, site);
        } catch (e) {
          shots[site.id] = null;
          problems.push(`${tagOf(s.name, vp, text)} ${site.id}: ${(e instanceof Error ? e.message : String(e)).split("\n")[0]}`);
        }
      }
      const r = { name: s.name, vp, text, tag: tagOf(s.name, vp, text), screen: VIEWPORTS[vp].viewport.width };
      for (const id of ["base", "after"]) if (shots[id]) r[id] = { width: shots[id].width, parts: shots[id].parts, broken: shots[id].broken };
      if (shots.base && shots.after) {
        // Piece by piece (a tall page); a piece only one side has counts as all its pixels differing.
        const n = Math.max(shots.base.files.length, shots.after.files.length);
        Object.assign(r, { pixels: 0, size: null, box: null, pieces: n });
        for (let i = 0; i < n; i++) {
          const [a, b] = [shots.base.files[i], shots.after.files[i]];
          const c = a && b ? await compare(a, b, join(out, "diff", `${r.tag}${i ? `~${i + 1}` : ""}.png`)) : { pixels: 1, size: `piece ${i + 1} on ${a ? "base" : "after"} only`, box: null };
          r.pixels += c.pixels;
          if (i === 0 || c.size?.includes("vs") || c.size?.includes("only")) r.size = i === 0 ? c.size : `${r.size}; ${c.size}`;
          if (c.box && !r.box) r.box = [c.box[0], c.box[1] + i * SEGMENT, c.box[2], c.box[3] + i * SEGMENT];
        }
      }
      else if (!opts.one || !shots[opts.one]) r.error = `not shot on ${SITES.map((x) => x.id).filter((id) => !shots[id]).join(" and ")}`;
      results.push(r);
      const fit = (m) => (m ? `${m.width > r.screen ? `${m.width}px wide` : "fits"}${m.broken.length ? `, ${m.broken.length} broken` : ""}` : "-");
      log(`${r.tag}: ${r.error ?? (opts.one ? fit(r[opts.one]) : `${r.pixels ? `${r.pixels} px differ${r.box ? ` in ${r.box.join(",")}` : ""}` : "same"}; base ${fit(r.base)}, after ${fit(r.after)}`)}`);
      report(results);
    }
  }
} catch (e) {
  problems.push(`the run stopped: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  console.error(e);
} finally {
  await browser?.close().catch(() => {});
  for (const u of [USERS.maker, USERS.free, USERS.fresh]) await api(u.email, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  stopAll();
  putBack();
  // The run's database is dropped as the process exits (scripts/test-run.mjs).
  rmSync(DATA, { recursive: true, force: true });
  report(results);
  const differing = results.filter((r) => r.pixels);
  const unfit = (id) => results.filter((r) => faulty(r[id], r.screen)).map((r) => r.tag);
  console.log(`\n${results.length} ${opts.one ? "shots" : `pairs: ${results.length - differing.length - results.filter((r) => r.error).length} the same, ${differing.length} differ` +
    `${differing.length ? `: ${differing.map((r) => r.tag).join(", ")}` : ""}`}; ${problems.length} problems${problems.length ? `:\n  ${problems.join("\n  ")}` : ""}`);
  for (const id of SITES.map((s) => s.id)) console.log(`${id}: ${unfit(id).length} don't fit (wider than the screen or a word broken inside)${unfit(id).length ? `: ${unfit(id).join(", ")}` : ""}`);
  console.log(`report: ${join(out, "index.html")}`);
}
process.exit(problems.length ? 1 : 0);
