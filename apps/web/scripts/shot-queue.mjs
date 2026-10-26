// The build queue (2026-10-26), end to end with screenshots, on a stack of its own on spare ports so the local site on
// 3000-3002 is never touched: the API on :3081 with one builder (MAX_RUNS=1, DEV_AUTH=1, AGENT_FAKE=1), the games origin
// on :3082, the site on :3080 (`next dev` with its own NEXT_DIST_DIR, .next/queue; tsconfig.json is put back afterwards).
// Build the API first (npm run build -w @typeplay/server) and bring the dev database up to date (node scripts/local-db.mjs
// start), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-queue.mjs [outDir]
// Shots in .impeccable/review/queue/. A "HOLD" build keeps the one builder busy, so the next builds wait in line. Checks: a
// free first build waits (the chat's answer, the stage's still sky with its place and rough wait, the line that paid builds
// go first, games to play meanwhile, Stop in the composer), a paid build sent after it goes ahead and the page says so live,
// a change that waits (the stage's line over the game), the same at 390 and 320 px (both tabs), the /games tile, the build
// pill on another page, Stop on a waiting change, and the start once the builder is free (the answer and the tile turn into
// the building ones). Then the worst case (37 ahead, about 1 h 35 min, Best at high effort, a 60-letter name) at 320 px
// and on a desktop, answered at the browser's network boundary. Afterwards the test accounts close.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useDevEnv } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/queue");
const SITE_PORT = 3080;
const API_PORT = 3081;
const GAMES_PORT = 3082;
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
mkdirSync(out, { recursive: true });
await useDevEnv();

const stamp = Date.now().toString(36);
const holder = `queue-hold-${stamp}@dev.test`; // Medium: keeps the builder busy
const paid = `queue-paid-${stamp}@dev.test`; // Medium: a paid build that goes ahead
const maker = `queue-maker-${stamp}@dev.test`; // Free: the first build in the shots
const editor = `queue-edit-${stamp}@dev.test`; // Free: a change that waits
const everyone = [holder, paid, maker, editor];
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.waitForTimeout(250); // past the 160 ms colour changes
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) => {
  const send = () => fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  // The server closes idle keep-alive sockets after 5 s: a request that picks one up just then (after the admin CLI's
  // pauses) is reset before it reaches the server. Send it again once, as the e2e does.
  return send()
    .catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)))
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
};
/** No sideways scrolling on a phone: the page is no wider than the screen. */
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const text = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, " ").trim(), () => "");
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
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, {
    PORT: String(API_PORT),
    DEV_AUTH: "1",
    AGENT_FAKE: "1",
    MAX_RUNS: "1",
    ADMIN_EMAILS: "",
    CORS_ORIGINS: base,
    BILLING_JOBS: "0",
  });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/queue",
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

  // The accounts: two on Medium, two on Free; the editor's game is built while the builder is still free.
  for (const who of everyone) await api(who, "GET", "/me");
  for (const who of [holder, paid]) check(`${who.split("@")[0]}: Medium + 40 credits`, admin("plan", who, "medium").status === 0 && admin("grant", who, "40").status === 0);
  const edited = (await api(editor, "POST", "/projects", { prompt: "Make an endless runner where a fox jumps over logs", model: "fast" })).body;
  await idle(editor, edited.id);
  const hold = (await api(holder, "POST", "/projects", { prompt: "Keep the only builder busy HOLD", model: "fast" })).body;
  check("a HOLD build takes the one builder", hold?.status === "running");

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page, email, idea = "Make a puzzle where you slide ice blocks to free a penguin") {
    await page.goto(`${base}/create?prompt=${encodeURIComponent(idea)}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", email);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  const answerMeta = (page) => text(page, ".msg--agent .msg__meta");
  /** The answer as seen: the screen reader's copy of its place (inside it, hidden) left out. */
  const answer = (page) => page.locator(".msg--agent .bubble").first().evaluate((el) => {
    const copy = el.cloneNode(true);
    copy.querySelectorAll(".sr-only").forEach((n) => n.remove());
    return copy.textContent.replace(/\s+/g, " ").trim();
  }).catch(() => "");
  /** What the page's one announcer says about a build in line (read out whichever tab shows). */
  const heard = (page) => text(page, "main.ws > p.sr-only[role=status]");

  // ---- A free first build waits (desktop) ----------------------------------------------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desk.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(page, maker);
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  const gameId = page.url().split("/").pop();
  await page.locator(".msg--agent .msg__meta", { hasText: "1st in the queue" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  check("the chat's answer: 'Waiting for its turn', the still dot", (await answer(page)) === "Waiting for its turn" && (await page.locator(".msg--agent .pulse--still").count()) === 1, await answer(page));
  check("a screen reader hears the state and the place, from one announcer (not the bubble, not the stage)", (await heard(page)) === "Waiting for its turn: 1st in the queue" && (await page.locator(".msg--agent [role=status], .stage__line[role=status]").count()) === 0, await heard(page));
  check("its line: the model, 1st in the queue, a rough wait", /^Fast · 1st in the queue · about \d+ min$/.test(await answerMeta(page)), await answerMeta(page));
  check("the stage: the empty sky standing still (nothing built yet)", (await page.locator(".stage__build.build--waiting").count()) === 1);
  check("the stage's line: the state, and the place on a line of its own", /^Waiting for its turn 1st in the queue · about \d+ min$/.test(await text(page, ".stage__line")) && (await page.locator(".stage__line .stage__place").evaluate((el) => getComputedStyle(el).display)) === "block", await text(page, ".stage__line"));
  check("the waiting tile: the sky and the ground, standing still (the sun and the robot not yet)", (await page.locator(".stage__build.build--waiting .build__layer").evaluateAll((els) => els.map((e) => getComputedStyle(e).visibility).join())) === "visible,visible,hidden,hidden");
  check("the note says it starts by itself, nothing is charged, and paid builds go first (a free build)", /starts by itself.*nothing is charged.*Builds on paid plans go first\.$/.test(await text(page, ".stage__note")), await text(page, ".stage__note"));
  check("games to play while it waits", (await page.locator(".wait__games .gamecard, .wait__games li").count()) >= 3);
  check("the composer: Stop, what Stop does, and (Free) why the place can move back", (await page.locator(".composer button", { hasText: "Stop" }).count()) === 1 && /^Waiting for its turn\. .*Stop to take this one out of the queue\. Builds on paid plans go first\.$/.test(await text(page, "#say-tip")), await text(page, "#say-tip"));
  await shot(page, "first-waiting-desktop");

  // A paid build sent after it goes ahead: the page hears it, no reload.
  const ahead = (await api(paid, "POST", "/projects", { prompt: "Make a racer on a beach track", model: "fast" })).body;
  check("a paid build sent now waits too, 1st in the queue (ahead of the free one)", ahead?.status === "queued" && ahead.queue?.ahead === 0 && ahead.queue.lane === "paid");
  await page.locator(".msg--agent .msg__meta", { hasText: "1 build ahead" }).waitFor({ timeout: 15_000 }).catch(() => {});
  check("the free build's page says it live: 1 build ahead", /^Fast · 1 build ahead · about \d+ min$/.test(await answerMeta(page)) && /1 build ahead/.test(await text(page, ".stage__line")), await answerMeta(page));
  check("…and the announcer says the new place", (await heard(page)) === "Waiting for its turn: 1 build ahead", await heard(page));
  await shot(page, "first-moved-desktop");

  // A change that waits: the stage's line over the game (the editor's game has version 1).
  const change = await api(editor, "POST", `/projects/${edited.id}/messages`, { text: "Make the logs roll", model: "fast" });
  check("a change while the builder is busy: queued, 2 builds ahead", change.body?.status === "queued" && change.body.queue?.ahead === 2, JSON.stringify(change.body?.queue));
  const deskEdit = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const editPage = await deskEdit.newPage();
  await signIn(editPage, editor);
  await editPage.goto(`${base}/games/${edited.id}`, { waitUntil: "domcontentloaded" });
  await editPage.locator(".stage__busy .stage__busy-text", { hasText: "waiting for its turn" }).waitFor({ timeout: 60_000 });
  await editPage.waitForTimeout(800);
  check("the stage over the game: 'Version 2 is waiting for its turn: 2 builds ahead, about N min'", /^Version 2 is waiting for its turn: 2 builds ahead, about \d+ min$/.test(await text(editPage, ".stage__busy-text")), await text(editPage, ".stage__busy-text"));
  check("…with the still dot, and the frame still plays version 1", (await editPage.locator(".stage__busy .pulse--still").count()) === 1 && (await editPage.locator(".gameframe").count()) === 1);
  check("restore is off while it waits", (await editPage.locator(".versions button:not([disabled])", { hasText: "Restore" }).count()) === 0);
  await shot(editPage, "edit-waiting-desktop");

  // ---- Phones: both tabs at 390 and 320 --------------------------------------------------------------
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    p.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(p, maker);
    await p.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded" });
    await p.locator(".ws__tabs").waitFor({ timeout: 60_000 });
    await p.locator(".stage__line", { hasText: "Waiting for its turn" }).waitFor({ timeout: 60_000 });
    await p.waitForTimeout(800);
    check(`a ${w} px phone opens on the Play tab while the first build waits`, (await p.locator("#ws-tab-play[aria-selected=true]").count()) === 1);
    check(`the Play tab at ${w} px: nothing wider than the screen`, await fits(p));
    await shot(p, `first-waiting-${w}-play`);
    await p.locator("#ws-tab-chat").tap();
    await p.waitForTimeout(400);
    check(`the Chat tab at ${w} px: the answer and Stop`, (await answer(p)) === "Waiting for its turn" && (await p.locator(".composer button", { hasText: "Stop" }).isVisible()), await answer(p));
    check(`the Chat tab at ${w} px: nothing wider than the screen`, await fits(p));
    await shot(p, `first-waiting-${w}-chat`);
    if (w === 390) {
      // /games: the waiting first build's icon.
      await p.goto(`${base}/games`, { waitUntil: "domcontentloaded" });
      await p.locator(".mine__grid .app__stat", { hasText: "in the queue" }).waitFor({ timeout: 60_000 });
      await shot(p, "games-390");
      // The editor's waiting change on a phone (an account of its own): the line over the game.
      const other = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const e = await other.newPage();
      await signIn(e, editor);
      await e.goto(`${base}/games/${edited.id}`, { waitUntil: "domcontentloaded" });
      await e.locator(".stage__busy-text", { hasText: "waiting for its turn" }).waitFor({ timeout: 60_000 }).catch(() => {});
      if ((await e.locator("#ws-tab-play[aria-selected=true]").count()) === 0) await e.locator("#ws-tab-play").tap();
      await e.waitForTimeout(600);
      check("the waiting change on a 390 px phone: the line fits", await fits(e), await text(e, ".stage__busy-text"));
      await shot(e, "edit-waiting-390");
      await other.close();
    }
    await phone.close();
  }

  // ---- /games and the build pill (desktop) --------------------------------------------------------------
  await page.goto(`${base}/games`, { waitUntil: "domcontentloaded" });
  await page.locator(".mine__grid .app__stat", { hasText: "in the queue" }).waitFor({ timeout: 60_000 });
  check("/games: the waiting game's icon is the still sky and ground, 'in the queue'", (await page.locator(".mine__grid .build--waiting").count()) === 1);
  await shot(page, "games-desktop");
  await page.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".wait__more").waitFor({ timeout: 60_000 });
  await page.locator(".wait__more").click();
  await page.waitForURL(/\/explore/, { timeout: 60_000 });
  await page.locator(".buildpill", { hasText: "Your game is in the queue" }).waitFor({ timeout: 60_000 });
  await page.waitForTimeout(500);
  check("away from the game: the pill says your game is in the queue, with its place", /^Your game is in the queue ?1 build ahead · ?about \d+ min ?Back to it/.test(await text(page, ".buildpill")), await text(page, ".buildpill"));
  await shot(page, "pill-desktop");
  {
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    await signIn(p, maker);
    await p.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded" });
    await p.locator(".wait__more").waitFor({ timeout: 60_000 });
    await p.locator(".wait__more").tap();
    await p.waitForURL(/\/explore/, { timeout: 60_000 });
    await p.locator(".buildpill", { hasText: "Your game is in the queue" }).waitFor({ timeout: 60_000 });
    await p.waitForTimeout(500);
    check("the pill on a 390 px phone: nothing wider than the screen, 'Your game is in the queue' whole (no ellipsis)", (await fits(p)) && (await p.locator(".buildpill__text").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)), await text(p, ".buildpill"));
    await shot(p, "pill-390");
    await phone.close();
  }

  // ---- Stop on the waiting change ------------------------------------------------------------------------
  await editPage.locator(".composer button", { hasText: "Stop" }).click();
  await editPage.locator(".msg--agent .bubble", { hasText: "Stopped" }).last().waitFor({ timeout: 30_000 });
  await editPage.waitForTimeout(500);
  const stoppedMeta = await editPage.locator(".msg--agent .msg__meta").last().innerText();
  check("Stop on the waiting change: 'Stopped. … nothing was charged.', 'Didn't start, not charged'", /Stopped\. Your game is unchanged, and nothing was charged\./.test(await editPage.locator(".msg--agent .bubble").last().innerText()) && /Didn't start, not charged/.test(stoppedMeta), stoppedMeta);
  check("…and the announcer says so", /^Stopped\./.test(await text(editPage, "main.ws > p.sr-only[role=status]")), await text(editPage, "main.ws > p.sr-only[role=status]"));
  check("…the stage's line is gone and Send is back", (await editPage.locator(".stage__busy .pulse").count()) === 0 && (await editPage.locator(".composer button", { hasText: "Send" }).count()) === 1);
  await shot(editPage, "edit-stopped-desktop");

  // ---- The builder free: the paid build runs, then the free one starts ------------------------------------
  await page.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded" });
  await page.locator(".stage__line", { hasText: "Waiting for its turn" }).waitFor({ timeout: 60_000 });
  await api(holder, "POST", `/projects/${hold.id}/cancel`);
  await page.locator(".msg--agent .msg__meta", { hasText: "1st in the queue" }).waitFor({ timeout: 15_000 }).catch(() => {});
  check("the builder free: the paid build starts, the free one is 1st in the queue", /1st in the queue/.test(await answerMeta(page)), await answerMeta(page));
  await page.locator(".msg--agent .bubble--live .pulse:not(.pulse--still)").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(700);
  check("its turn: the answer is the building one (the breathing dot, the clock)", /building \d+:\d\d$/.test(await answerMeta(page)) && (await page.locator(".stage__build.build:not(.build--waiting)").count()) === 1, await answerMeta(page));
  check("…its tile starts with the sky and ground landed (no blink), and the announcer says it's its turn", (await page.locator(".stage__build.build--landed").count()) === 1 && (await heard(page)) === "It's your turn: building now.", await heard(page));
  await shot(page, "first-started-desktop");
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
  check("then it is built: version 1", true);
  await desk.close();
  await deskEdit.close();

  // ---- The worst case, answered at the browser's network boundary ---------------------------------------
  const worstName = "The Extremely Long Name Of A Game That Keeps Going On And On";
  const project = (await api(maker, "GET", `/projects/${gameId}`)).body;
  const worst = {
    ...project,
    name: worstName.slice(0, 60),
    status: "queued",
    buildId: null,
    currentVersion: null,
    versions: [],
    // It would leave the queue in 30 minutes, long before its rough wait: the page says the queue is long.
    queue: { ahead: 37, waitMin: 95, lane: "free", leavesAt: new Date(Date.now() + 30 * 60_000).toISOString() },
    messages: [
      { ...project.messages[0], text: "Make a huge open world where a knight rides a dragon across seven kingdoms, with a shop, a map, boss fights and a day and night cycle." },
      { id: project.messages[1].id, role: "agent", text: "", model: "best", effort: "high", status: "queued", createdAt: project.messages[1].createdAt },
    ],
  };
  const mockWorst = (p) =>
    p.route(`${apiBase}/projects/${gameId}**`, (route) => {
      const headers = { "Access-Control-Allow-Origin": "*" };
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Headers": "Authorization, Content-Type" } });
      if (route.request().url().endsWith("/events")) {
        return route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "text/event-stream" }, body: `data: ${JSON.stringify({ type: "snapshot", project: worst })}\n\n` });
      }
      return route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify(worst) });
    });
  for (const [w, h, phoneLike] of [[320, 640, true], [1440, 900, false]]) {
    const ctx = await browser.newContext(phoneLike ? { viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: w, height: h } });
    const p = await ctx.newPage();
    await signIn(p, maker);
    await mockWorst(p);
    await p.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded" });
    await p.locator(".stage__line", { hasText: "37 builds ahead" }).waitFor({ timeout: 60_000 });
    await p.waitForTimeout(800);
    check(`worst case at ${w} px: '37 builds ahead · about 1 h 35 min'`, /37 builds ahead · about 1 h 35 min/.test(await text(p, ".stage__line")), await text(p, ".stage__line"));
    check(`worst case at ${w} px: nothing wider than the screen`, await fits(p));
    check(`worst case at ${w} px: the queue is long, and when it would leave it is said`, /^The queue is long right now: if yours hasn't started by \d\d:\d\d, it leaves the queue and nothing is charged\. Builds on paid plans go first\.$/.test(await text(p, ".stage__note")), await text(p, ".stage__note"));
    await shot(p, `worst-${w}${phoneLike ? "-play" : ""}`);
    if (phoneLike) {
      await p.locator("#ws-tab-chat").tap();
      await p.waitForTimeout(400);
      check("worst case: the answer's line 'Best, high effort · 37 builds ahead · about 1 h 35 min'", /^Best, high effort · 37 builds ahead · about 1 h 35 min$/.test(await answerMeta(p)), await answerMeta(p));
      check(`worst case chat at ${w} px: nothing wider than the screen`, await fits(p));
      await shot(p, `worst-${w}-chat`);
    }
    await ctx.close();
  }
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
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
