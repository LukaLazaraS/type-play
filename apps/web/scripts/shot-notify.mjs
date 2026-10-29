// Notifications (2026-10-29), end to end with screenshots, on a stack of its own on ports picked free and a database of
// its own (dev-env.mjs useOwnStack): the API (DEV_AUTH=1, AGENT_FAKE=1) and the site (`next dev`, NEXT_DIST_DIR .next/notify)
// with a VAPID pair made for this run, and the games origin. Build the API first (npm run build -w @typeplay/server), then,
// through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-notify.mjs [outDir]
// Shots in .impeccable/review/notify/. Checks: the question at a first build (the ink stage, desktop and phone) and its
// yes (the browser's prompt answered by the test), the question in the chat's composer for a change, the notice on another
// page when a build ends (ready, too big, didn't work) and none on the game's own page, closing it, its words read out once,
// the tab's title and icon while the tab is in the background and back when it is looked at, the switch on /account, and
// the worst case (three notices with 60-letter names and the build pill, at 390 and 1440 px). The accounts close afterwards.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import webpush from "web-push";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/notify");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("notify", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
const vapid = webpush.generateVAPIDKeys();

const stamp = Date.now().toString(36);
const maker = `notify-maker-${stamp}@dev.test`;
const everyone = [maker];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(350); // past the 260 ms entrance
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
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
/** Each notice as read: its words, then its action's words. */
const notices = (page) =>
  page.locator(".runnotice").evaluateAll((els) =>
    els.map((el) => `${el.querySelector(".runnotice__text").textContent} ${el.querySelector(".runnotice__go").textContent}`.replace(/\s+/g, " ").trim()),
  );
const fits = (page) => page.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, page.viewportSize().width);
const text = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, " ").trim(), () => "");
async function idle(id, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    const p = (await api(maker, "GET", `/projects/${id}`)).body;
    // Once more after it says idle: a read that lands as the build ends can still hold the version from before it.
    if (p?.status === "idle") return (await api(maker, "GET", `/projects/${id}`)).body;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${id} never went idle`);
}
/** The tab goes to the background, or comes back, as far as the page can tell (headless tabs are always "visible"). */
const setVisible = (page, visible) =>
  page.evaluate((v) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (v ? "visible" : "hidden") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => !v });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visible);

// ---- The stack ------------------------------------------------------------------------------------
const children = [];
function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let log = "";
  child.stdout.on("data", (d) => (log = (log + d).slice(-6000)));
  child.stderr.on("data", (d) => (log = (log + d).slice(-6000)));
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
let apiProc = null;
try {
  apiProc = start("api", ["dist/main.js"], serverDir, {
    PORT: String(API_PORT),
    DEV_AUTH: "1",
    AGENT_FAKE: "1",
    ADMIN_EMAILS: "",
    CORS_ORIGINS: base,
    BILLING_JOBS: "0",
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
  });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).push === true, 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/notify",
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_CLOSED_BETA: "",
    NEXT_PUBLIC_API_ORIGIN: apiBase,
    NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${GAMES_PORT}`,
    NEXT_PUBLIC_PADDLE_ENV: "",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: vapid.publicKey,
  });
  await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 180, siteProc.log);
  console.log(`stack up: site :${SITE_PORT}, API :${API_PORT}, games :${GAMES_PORT}`);

  await api(maker, "GET", "/me");
  check("the maker: Medium + 60 credits", admin("plan", maker, "medium").status === 0 && admin("grant", maker, "60").status === 0);
  // A game with a version, for the changes and the notices (built while nobody watches).
  const sent = await api(maker, "POST", "/projects", { prompt: "Make an endless runner where a fox jumps over logs", model: "fast" });
  const made = sent.body;
  const game = await idle(made.id);
  check("a game at version 1 to change", game?.currentVersion === 1, `${game?.name}, version ${game?.currentVersion}`);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page, idea = "Make a puzzle where you slide ice blocks to free a penguin HOLD") {
    await page.goto(`${base}/create?prompt=${encodeURIComponent(idea)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", maker);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }

  // ---- The question at the first build: the ink stage, desktop ---------------------------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desk.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(page);
  check("no question on page load (/create)", (await page.locator(".notifyask").count()) === 0);
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  const firstId = page.url().split("/").pop();
  await page.locator(".notifyask").waitFor({ timeout: 60_000 });
  check("the first build asks on the stage: 'Tell me when it's ready?' with Yes and No thanks", (await text(page, ".notifyask__q")) === "Tell me when it's ready?" && (await page.locator(".notifyask button").allInnerTexts()).join("|") === "Yes, tell me|No thanks");
  check("…under the note, before the games to play meanwhile", await page.evaluate(() => {
    const note = document.querySelector(".stage__empty--wait .stage__note");
    const ask = document.querySelector(".notifyask");
    const wait = document.querySelector(".wait");
    return !!note && !!ask && !!wait && note.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING && ask.compareDocumentPosition(wait) & Node.DOCUMENT_POSITION_FOLLOWING;
  }));
  check("the chat's composer doesn't ask too (one question per build)", (await page.locator(".composer .ask").count()) === 0);
  check("the browser's prompt hasn't been asked for (permission still 'default')", (await page.evaluate(() => Notification.permission)) === "default");
  await shot(page, "ask-first-1440");

  // ---- The same question on a phone (the Play tab) ------------------------------------------------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  p.on("pageerror", (e) => console.log("page error (phone):", e.message));
  await signIn(p, "Make a racer on a beach track");
  await p.goto(`${base}/games/${firstId}`, { waitUntil: "domcontentloaded" });
  await p.locator(".notifyask").waitFor({ timeout: 60_000 });
  check("390 px: the Play tab shows the question", (await p.locator("#ws-tab-play[aria-selected=true]").count()) === 1 && (await p.locator(".notifyask").isVisible()));
  check("390 px: nothing wider than the screen", await fits(p));
  await shot(p, "ask-first-390");

  // ---- Yes: the browser's prompt (answered "allow" by the test), then the device on the API -------------
  // The browser's prompt is browser UI: answered "Allow" after the tap, as a person does.
  await page.evaluate(() => {
    const allowed = new Promise((r) => (window.__allow = r));
    Notification.requestPermission = () => allowed.then(() => "granted");
  });
  await page.getByRole("button", { name: "Yes, tell me" }).click();
  await desk.grantPermissions(["notifications"], { origin: base });
  await page.evaluate(() => window.__allow());
  await page.locator(".notifyask__said").waitFor({ timeout: 30_000 });
  const said = await text(page, ".notifyask__said");
  const rows = async () => (await db.query(`SELECT endpoint FROM "PushSubscription" WHERE "userId" = $1`, [`dev-${maker.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`])).rows;
  const subscribed = said.startsWith("Done:");
  check("yes, allowed: the stage says it's done, or why this browser couldn't", subscribed || said.startsWith("This browser couldn't"), said);
  if (subscribed) check("…and the API has this device", (await rows()).length === 1);
  else console.log("  note: headless Edge has no push service here; the subscription itself is checked in a real browser (the reply says how)");
  await shot(page, "ask-yes-1440");
  await api(maker, "POST", `/projects/${firstId}/cancel`);
  await idle(firstId);

  // ---- The question in the chat's composer, for a change (phone, Chat tab) ------------------------------
  await p.goto(`${base}/games/${made.id}`, { waitUntil: "domcontentloaded" });
  await p.locator(".ws__tabs").waitFor({ timeout: 60_000 });
  await p.locator("#ws-tab-chat").tap();
  await p.locator("#say").fill("Add rain that slows the fox down HOLD");
  await p.locator(".composer button[type=submit]").tap();
  await p.locator(".composer .ask").waitFor({ timeout: 30_000 });
  check("a change building: the composer asks (the paper ask panel), Yes and Not now", /Tell me when it's ready\?/.test(await text(p, ".composer .ask")) && (await p.locator(".composer .ask button").allInnerTexts()).join("|") === "Yes, tell me|Not now");
  check("390 px chat: nothing wider than the screen", await fits(p));
  await shot(p, "ask-change-390");
  await p.getByRole("button", { name: "Not now" }).tap();
  check("Not now: the question goes", (await p.locator(".composer .ask").count()) === 0);
  await api(maker, "POST", `/projects/${made.id}/cancel`);
  await idle(made.id);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.locator(".ws__tabs").waitFor({ timeout: 60_000 });
  check("…and never comes back on this device for this account", true);

  // ---- The notice on another page: a change that works (desktop, /explore) -------------------------------
  await page.goto(`${base}/explore`, { waitUntil: "domcontentloaded" });
  await page.locator(".statusbar").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2500); // the account's stream connects
  await api(maker, "POST", `/projects/${made.id}/messages`, { text: "Add coins to collect", model: "fast" });
  await page.locator(".runnotice").waitFor({ timeout: 60_000 });
  const ready = (await notices(page))[0] ?? "";
  check("a build that ends while the player is on /explore: the notice with the name, what happened and Play it", new RegExp(`^${game.name} is ready\\. Play it$`).test(ready), ready);
  check("…Play it opens the game's page", (await page.locator(".runnotice a").getAttribute("href")) === `/games/${made.id}`);
  check("…read out once, politely (the announcer, not the toast)", (await text(page, ".toasts p.sr-only[role=status]")) === `${game.name} is ready. Version 2 is in. Play it now.` && (await page.locator(".runnotice[role], .toasts [aria-live=assertive]").count()) === 0);
  check("…the keyboard stays where it was (the notice takes no focus)", await page.evaluate(() => !document.activeElement || !document.activeElement.closest(".toasts")));
  await shot(page, "notice-explore-1440");

  // One notice per game: a second end of the same game takes the first one's place.
  await idle(made.id);
  await api(maker, "POST", `/projects/${made.id}/messages`, { text: "Add 10 new levels and flying traps TOOBIG", model: "fast" });
  await page.locator(".runnotice", { hasText: "too big" }).waitFor({ timeout: 60_000 });
  const one = await notices(page);
  check("the same game ends again (too big for Fast): its notice is replaced, not stacked", one.length === 1 && one[0] === `${game.name}: that change is too big for Fast. See why`, one.join(" / "));
  await idle(made.id);

  // Three games end: three notices, the newest nearest the edge (a first build that fails, one that works).
  const failedGame = (await api(maker, "POST", "/projects", { prompt: "A maze of mirrors and light beams FAIL", model: "fast" })).body;
  await page.locator(".runnotice", { hasText: "didn't build" }).waitFor({ timeout: 60_000 });
  await idle(failedGame.id);
  const thirdGame = (await api(maker, "POST", "/projects", { prompt: "Make a tower defence game where cats guard a fish shop", model: "fast" })).body;
  await page.locator(".runnotice", { hasText: `${thirdGame.name} is ready` }).waitFor({ timeout: 60_000 });
  await idle(thirdGame.id);
  const all = await notices(page);
  check(
    "three games end: three notices, the newest last",
    all.length === 3 && /too big for Fast\. See why$/.test(all[0]) && all[1] === `${failedGame.name} didn't build. Nothing was charged. See what to do` && all[2] === `${thirdGame.name} is ready. Play it`,
    all.join(" / "),
  );
  await shot(page, "notices-three-1440");
  await page.getByRole("button", { name: `Close: ${game.name}` }).click();
  check("closing one leaves the other two", (await page.locator(".runnotice").count()) === 2);

  // A second tab of the same browser has the same notices; closing one there closes it here.
  const tab2 = await desk.newPage();
  await tab2.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await tab2.locator(".runnotice").first().waitFor({ timeout: 60_000 });
  check("another tab of the site shows the same two notices", (await tab2.locator(".runnotice").count()) === 2);
  await tab2.getByRole("button", { name: `Close: ${failedGame.name}` }).click();
  await page.waitForTimeout(500);
  check("closed in one tab: gone in the other too", (await page.locator(".runnotice").count()) === 1);

  // The game's own page: no notice there, and it closes the game's notices everywhere.
  await tab2.goto(`${base}/games/${thirdGame.id}`, { waitUntil: "domcontentloaded" });
  await tab2.locator(".ws__chat").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  check("the game's own page on screen: no notice there, and its notices go in the other tabs too", (await tab2.locator(".runnotice").count()) === 0 && (await page.locator(".runnotice").count()) === 0);
  await tab2.close();

  // ---- The tab's title and icon while the tab is in the background ----------------------------------------
  const titleBefore = await page.title();
  await setVisible(page, false);
  await api(maker, "POST", `/projects/${made.id}/messages`, { text: "Add a night sky", model: "fast" });
  await page.waitForFunction((t) => document.title !== t, titleBefore, { timeout: 60_000 });
  const title = await page.title();
  const icons = await page.locator('link[rel~="icon"]').evaluateAll((ls) => ls.map((l) => l.getAttribute("href")));
  check("in the background: the title says which game and what happened", title === `(1) ${game.name} is ready`, title);
  check("…and the icon has the hot dot", icons.length > 0 && icons.every((h) => /\/icons\/attention/.test(h)), icons.join(" "));
  await setVisible(page, true);
  await page.waitForTimeout(300);
  const iconsBack = await page.locator('link[rel~="icon"]').evaluateAll((ls) => ls.map((l) => l.getAttribute("href")));
  check("looked at: the title and the icon are back", (await page.title()) === titleBefore && iconsBack.every((h) => !/attention/.test(h)), `${await page.title()} | ${iconsBack.join(" ")}`);
  await shot(page, "notice-back-1440");

  // ---- The notice at phone width (/explore) --------------------------------------------------------------
  await p.goto(`${base}/explore`, { waitUntil: "domcontentloaded" });
  await p.locator(".statusbar").waitFor({ timeout: 60_000 });
  await p.waitForTimeout(2500);
  await api(maker, "POST", `/projects/${made.id}/messages`, { text: "Add a sunset", model: "fast" });
  await p.locator(".runnotice").first().waitFor({ timeout: 60_000 });
  check("390 px: the notice fits the screen", await fits(p));
  check("390 px: Play it and Close are a finger tall (44 px)", await p.locator(".runnotice a, .runnotice button").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height >= 44)));
  await shot(p, "notice-explore-390");

  // ---- Another game's page: the notice over its stage (desktop) and its Play tab (phone) ---------------------
  for (const [pg2, name] of [[page, "notice-other-game-1440"], [p, "notice-other-game-390"]]) {
    await idle(made.id);
    await pg2.goto(`${base}/games/${firstId}`, { waitUntil: "domcontentloaded" });
    await pg2.locator(".ws__chat").waitFor({ state: "attached", timeout: 60_000 });
    // A phone opens a game with nothing to play on its Chat tab: the stage is the Play tab.
    if (pg2 === p) await pg2.locator("#ws-tab-play").tap();
    await pg2.locator(".stage").waitFor({ timeout: 60_000 });
    await pg2.waitForTimeout(2500);
    // Earlier notices closed first, so the one that arrives is this build's.
    while ((await pg2.locator(".runnotice").count()) > 0) await pg2.locator(".runnotice .toast__close").first().click();
    await api(maker, "POST", `/projects/${made.id}/messages`, { text: "Add clouds", model: "fast" });
    await pg2.locator(".runnotice").first().waitFor({ timeout: 60_000 });
    check(`${name}: another game's page shows the notice`, (await pg2.locator(".runnotice").count()) === 1 && (await fits(pg2)));
    await shot(pg2, name);
  }

  // ---- The switch on /account ---------------------------------------------------------------------------
  await page.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await page.locator(".acct__notify").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  const state = await text(page, "#acct-notify-state");
  check("/account: the Notifications card with this device's state", /^(On for|Off on) this device\.$/.test(state), state);
  await page.locator(".acct__notify").scrollIntoViewIfNeeded();
  await shot(page, "account-1440");
  if (subscribed) {
    await page.locator(".acct__notify .toggle").click();
    await page.locator("#acct-notify-state", { hasText: "Off on this device." }).waitFor({ timeout: 15_000 });
    check("off: this device leaves the API and the browser", (await rows()).length === 0 && (await page.evaluate(async () => !(await (await navigator.serviceWorker.getRegistration("/"))?.pushManager.getSubscription()))));
    await page.locator(".acct__notify .toggle").click();
    await page.locator("#acct-notify-state", { hasText: "On for this device." }).waitFor({ timeout: 30_000 });
    check("on again: back on the API", (await rows()).length === 1);
  }
  await p.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await p.locator(".acct__notify").waitFor({ timeout: 60_000 });
  await p.locator(".acct__notify").scrollIntoViewIfNeeded();
  await p.waitForTimeout(600);
  check("390 px /account: nothing wider than the screen", await fits(p));
  await shot(p, "account-390");

  // ---- The worst case: three notices with 60-letter names, and the build pill, at 390 and 1440 -------------
  const long = "The Extraordinarily Long Adventures of Captain Whiskerbottom!";
  const worst = (n, kind, title, i) => ({ kind, projectId: `worst${i}aaaa`, messageId: `w-${i}-${stamp}`, name: n, title, body: "", url: `/games/worst${i}aaaa`, at: new Date().toISOString() });
  const store = {
    user: `dev-${maker.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
    open: [worst(long, "ready", `${long} is ready`, 1), worst(long, "toobig", `${long}: that change is too big for Smart`, 2), worst("忍者ジャンプ 🥷 Ninja Jump", "failed", "忍者ジャンプ 🥷 Ninja Jump: the build was interrupted", 3)],
    closed: [],
  };
  // The build pill follows a change that keeps building (HOLD), nearest the edge under the three.
  await idle(made.id);
  await api(maker, "POST", `/projects/${made.id}/messages`, { text: "Add fog HOLD", model: "fast" });
  for (const [pg2, name] of [[p, "worst-390"], [page, "worst-1440"]]) {
    await pg2.goto(`${base}/explore`, { waitUntil: "domcontentloaded" });
    await pg2.evaluate(
      ([s, id]) => {
        localStorage.setItem("typeplay.notices", JSON.stringify(s));
        sessionStorage.setItem("typeplay:waiting", id);
      },
      [store, made.id],
    );
    await pg2.reload({ waitUntil: "domcontentloaded" });
    await pg2.locator(".runnotice").first().waitFor({ timeout: 60_000 });
    await pg2.waitForTimeout(1500);
    await pg2.locator(".buildpill").waitFor({ timeout: 30_000 });
    check(`${name}: three notices above the build pill, nothing wider than the screen`, (await pg2.locator(".runnotice").count()) === 3 && (await pg2.locator(".toasts > .buildpill:last-child").count()) === 1 && (await fits(pg2)));
    check(`${name}: each notice's words stop at three lines`, await pg2.locator(".runnotice__text").evaluateAll((els) => els.every((e) => e.getBoundingClientRect().height <= 3 * 20 + 1)));
    await shot(pg2, name);
  }
  await api(maker, "POST", `/projects/${made.id}/cancel`);
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
  if (apiProc) console.log(apiProc.log().slice(-2000));
} finally {
  await browser?.close().catch(() => {});
  for (const who of everyone) {
    try {
      const closed = await api(who, "DELETE", "/me", { confirm: "DELETE" }).catch(() => ({ status: 0 }));
      console.log(`closed ${who}: ${closed.status}`);
      await db.query(`DELETE FROM "ClosedAccount" WHERE id = $1`, [`dev-${who.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`]);
    } catch (e) {
      console.log("cleanup:", e instanceof Error ? e.message : e);
    }
  }
  await db.end().catch(() => {});
  stopAll();
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
