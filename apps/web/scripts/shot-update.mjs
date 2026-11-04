// The update bar and the build time (2026-11-04), end to end with screenshots, on a stack of its own on ports picked free
// and a database of its own (dev-env.mjs useOwnStack): the API (DEV_AUTH=1, AGENT_FAKE=1: every build is the robot runner
// demo, ~5 s), the games origin (this checkout's play.html) and the site (`next dev`, NEXT_DIST_DIR .next/update). Build the
// API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-update.mjs [outDir]
// Shots in .impeccable/review/update/. Checks: a change that finishes after the player pressed a key in the game waits behind
// the bar (Restart, Later, the New version chip), the game in the frame untouched and the focus where it was; one that
// finishes with no input loads by itself; a restore loads at once; full screen keeps the bar and stays full screen through
// Restart (desktop and phone); the build time on a finished, a stopped and a failed answer, and the line wrapping only
// between its items at 320, 390 and 1440 px. The account closes afterwards.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/update");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("update", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;

const stamp = Date.now().toString(36);
const maker = `update-maker-${stamp}@dev.test`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name) => {
  await page.waitForTimeout(400); // past the 260 ms entrance
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (method, path, body) => {
  const send = () => fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${maker}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return send()
    .catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)))
    .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fits = (page) => page.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, page.viewportSize().width);
const text = (page, sel) => page.locator(sel).first().innerText().then((t) => t.replace(/\s+/g, " ").trim(), () => "");
async function idle(id, seconds = 90) {
  for (let i = 0; i < seconds * 2; i++) {
    const p = (await api("GET", `/projects/${id}`)).body;
    if (p?.status === "idle") return (await api("GET", `/projects/${id}`)).body;
    await sleep(500);
  }
  throw new Error(`${id} never went idle`);
}

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
    await sleep(500);
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
  apiProc = start("api", ["dist/main.js"], serverDir, { PORT: String(API_PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0" });
  await until("the API", async () => (await fetch(`${apiBase}/health`)).ok, 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/update",
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

  await api("GET", "/me");
  check("the maker: Medium + 200 credits", admin("plan", maker, "medium").status === 0 && admin("grant", maker, "200").status === 0);
  const made = (await api("POST", "/projects", { prompt: "Make an endless runner where a robot jumps over cactus", model: "fast" })).body;
  const id = made.id;
  let game = await idle(id);
  check("a game at version 1", game?.currentVersion === 1, `${game?.name}`);
  /** A change sent from elsewhere (the API), as the player's chat would send it; resolves once it is built. */
  const change = async (words) => {
    await api("POST", `/projects/${id}/messages`, { text: words, model: "fast" });
    game = await idle(id);
    return game;
  };

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page) {
    await page.goto(`${base}/create?prompt=${encodeURIComponent("Make a puzzle with ice blocks")}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", maker);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  /** The build the stage's frame runs, from its address (play.html?g=<build>). */
  const running = async (page) => {
    const src = await page.locator(".stage .gameframe__frame").getAttribute("src").catch(() => null);
    return src ? new URL(src).searchParams.get("g") : null;
  };
  const ready = (page) => page.locator(".stage .gameframe[data-ready]").waitFor({ timeout: 180_000 });
  /** Plays: a click on the game's canvas and a key, inside the game (trusted input in the games origin's page). */
  const play = async (page, touch = false) => {
    const canvas = page.frameLocator(".stage .gameframe__frame").locator("canvas");
    if (touch) await canvas.tap({ timeout: 30_000 });
    else {
      await canvas.click({ timeout: 30_000 });
      await page.keyboard.press("ArrowRight");
    }
    await sleep(500); // the loader's message crosses to the page
  };
  const focusInGame = (page) => page.evaluate(() => document.activeElement?.classList.contains("gameframe__frame") ?? false);
  // Notes whether the bar ever showed (for the case where it must not).
  const watchBar = (page) =>
    page.evaluate(() => {
      window.__sawBar = false;
      new MutationObserver(() => {
        if (document.querySelector(".stage__update, .gameframe__bar")) window.__sawBar = true;
      }).observe(document.body, { childList: true, subtree: true });
    });

  // ---- 1. Desktop: played, then a change finishes: the bar, Later, the chip, the chip loads it -------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desk.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(page);
  await page.goto(`${base}/games/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator(".stage .gameframe__play").click({ timeout: 120_000 });
  await ready(page);
  const firstSrc = await page.locator(".stage .gameframe__frame").getAttribute("src");
  await sleep(1500);
  check("the first Play loads the game once (its address doesn't change after its first frame)", (await page.locator(".stage .gameframe__frame").getAttribute("src")) === firstSrc, firstSrc ?? "");
  await play(page);
  check("playing version 1", (await running(page)) === `${id}-v1`);
  await change("Add coins to collect");
  await page.locator(".stage__update .updatebar").waitFor({ timeout: 60_000 });
  check("a change finished after a key in the game: 'Version 2 is ready.' over the game", (await text(page, ".stage__update .updatebar__text")) === "Version 2 is ready.");
  check("…with Restart and Later", (await page.locator(".stage__update .updatebar button").allInnerTexts()).map((t) => t.trim()).join("|") === "Restart|Later");
  check("…the game in the frame is still version 1 (not restarted)", (await running(page)) === `${id}-v1`);
  check("…the keyboard is still in the game (the bar took no focus)", await focusInGame(page));
  check("…read out once, politely (the stage's live line; the bar is not a live region)", (await text(page, ".stage__live[role=status] .sr-only")) === "Version 2 is ready. Your game keeps running until you restart it." && (await page.locator(".updatebar[role], .stage__update[role]").count()) === 0);
  check("…the versions strip: version 2 ready to play, version 1 playing now", (await text(page, ".version[data-current] .version__now")) === "Ready to play" && (await text(page, ".version:not([data-current]) .version__now")) === "Playing now" && (await page.locator(".version:not([data-current]) .version__restore").count()) === 0);
  check("…Restart's name says what it loads", (await page.locator(".stage__update .updatebar button", { hasText: "Restart" }).getAttribute("aria-label")) === "Restart with version 2");
  check("…the stage bar's version and the header still fit", await fits(page));
  await shot(page, "bar-1440");
  // The bar by keyboard: the game keeps every key (Godot takes Tab too), so Escape in the game brings the keyboard to the
  // bar's Restart; Tab goes on to Later.
  await page.keyboard.press("Escape");
  await sleep(400);
  check("…Escape in the game brings the keyboard to Restart", await page.evaluate(() => document.activeElement?.textContent?.trim() === "Restart"));
  await page.keyboard.press("Tab");
  check("…then Later", await page.evaluate(() => document.activeElement?.textContent?.trim() === "Later"));
  await page.keyboard.press("Enter");
  await page.locator(".stage__update .updatebar__chip").waitFor({ timeout: 10_000 });
  check("Later: the bar folds into the New version chip", (await text(page, ".stage__update .updatebar__chip")) === "New version" && (await page.locator(".stage__update .updatebar").count()) === 0);
  check("…its name says what it does", (await page.locator(".stage__update .updatebar__chip").getAttribute("aria-label")) === "New version: restart with version 2");
  check("…the game keeps running version 1, and has the keyboard back", (await running(page)) === `${id}-v1` && (await focusInGame(page)));
  check("…the announcer goes quiet (nothing more to read out)", (await page.locator(".stage__live .sr-only").count()) === 0);
  check("…the chip has the toast's edge (a dark game doesn't hide it)", (await page.locator(".stage__update .updatebar__chip").evaluate((e) => getComputedStyle(e).outlineWidth)) === "2px");
  await shot(page, "chip-1440");
  await sleep(800); // past the chip's guard against a tap meant for the game
  await page.locator(".stage__update .updatebar__chip").click();
  await ready(page);
  check("the chip loads version 2", (await running(page)) === `${id}-v2` && (await page.locator(".stage__update").count()) === 0);
  check("…and the strip says playing now again, on version 2 alone", (await text(page, ".version[data-current] .version__now")) === "Playing now" && (await page.locator(".version__now").count()) === 1);

  // ---- 2. Restart from the bar ----------------------------------------------------------------------------------------
  await play(page);
  await change("Add a shield power-up");
  await page.locator(".stage__update .updatebar").waitFor({ timeout: 60_000 });
  check("played again, then version 3: the bar again", (await text(page, ".stage__update .updatebar__text")) === "Version 3 is ready." && (await running(page)) === `${id}-v2`);
  // A device preview draws the game smaller: the bar keeps its own size over it.
  await page.getByRole("button", { name: /^Preview size/ }).click();
  await page.getByRole("button", { name: /^Laptop/ }).click();
  await sleep(600);
  const barH = await page.locator(".stage__update .updatebar").evaluate((e) => e.getBoundingClientRect().height);
  check("…over a scaled device (Laptop) the bar keeps its size", barH >= 44 && barH <= 60, `${barH.toFixed(0)} px tall`);
  await shot(page, "bar-1440-laptop");
  await page.getByRole("button", { name: /^Preview size/ }).click();
  await page.getByRole("button", { name: /^Fill the window/ }).click();
  // A tap that lands on Restart as the bar appears (meant for the game) does nothing; one a moment later restarts. This
  // version is made to fill every screen (FILL): the frame keeps the running build's shape until the player restarts.
  const shapeBefore = await page.locator(".stage .gameframe").getAttribute("data-orientation");
  await change("Add a speed boost FILL");
  await page.locator(".stage__update .updatebar__text", { hasText: "Version 4 is ready." }).waitFor({ timeout: 60_000 });
  check("a version for every screen waits: the frame keeps the running game's shape", shapeBefore !== "any" && (await page.locator(".stage .gameframe").getAttribute("data-orientation")) === shapeBefore, `${shapeBefore}`);
  await page.locator(".stage__update .updatebar button", { hasText: "Restart" }).click();
  check("a press on Restart the moment the bar appears is ignored (a tap meant for the game)", (await running(page)) === `${id}-v2` && (await page.locator(".stage__update .updatebar").count()) === 1);
  await sleep(800);
  await page.locator(".stage__update .updatebar button", { hasText: "Restart" }).click();
  await ready(page);
  check("Restart loads the newest (version 4)", (await running(page)) === `${id}-v4` && (await page.locator(".stage__update").count()) === 0);
  check("…in its own shape (it fills every screen)", (await page.locator(".stage .gameframe").getAttribute("data-orientation")) === "any");
  check("…and the keyboard stays in the game's frame", await focusInGame(page));

  // ---- 3. No input since it loaded: a new version loads by itself ------------------------------------------------------
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".stage .gameframe__play").click({ timeout: 120_000 });
  await ready(page);
  await watchBar(page);
  // The player types the next change meanwhile: the new version loading by itself leaves the keyboard in the chat's box.
  await page.locator("#say").click();
  await page.keyboard.type("Make the robot");
  await change("Add rain");
  await page.waitForFunction((want) => document.querySelector(".stage .gameframe__frame")?.getAttribute("src")?.includes(`g=${want}`), `${id}-v5`, { timeout: 60_000 });
  check("not touched since it loaded: version 5 loads by itself, as before", (await running(page)) === `${id}-v5` && !(await page.evaluate(() => window.__sawBar)));
  await ready(page);
  await sleep(500);
  check("…and leaves the keyboard in the chat's box, where the player was typing", await page.evaluate(() => document.activeElement?.id === "say"));
  await page.locator("#say").fill("");

  // ---- 4. A restore loads at once, even while playing -----------------------------------------------------------------
  await ready(page);
  await play(page);
  await watchBar(page);
  await page.locator(".version", { hasText: "Version 1 ·" }).locator(".version__restore").click();
  await page.locator(".version__actions button", { hasText: "Restore" }).click();
  await page.waitForFunction((want) => document.querySelector(".stage .gameframe__frame")?.getAttribute("src")?.includes(`g=${want}`), `${id}-v1`, { timeout: 30_000 });
  check("played, then a restore of version 1: it loads at once (no bar)", (await running(page)) === `${id}-v1` && !(await page.evaluate(() => window.__sawBar)));
  game = await idle(id);

  // ---- 5. Full screen (desktop): the bar over the game, Restart stays full screen --------------------------------------
  await ready(page);
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await page.locator(".stage .gameframe[data-immersive]").waitFor({ timeout: 10_000 });
  await play(page);
  await change("Add stars in the sky");
  await page.locator(".gameframe__bar .updatebar").waitFor({ timeout: 60_000 });
  check("full screen: the bar over the game (version 7)", (await text(page, ".gameframe__bar .updatebar__text")) === "Version 7 is ready." && (await page.locator(".stage__update").isVisible()) === false);
  check("…the game still runs the restored build", (await running(page)) === `${id}-v1`);
  await shot(page, "bar-fullscreen-1440");
  await sleep(800);
  await page.locator(".gameframe__bar .updatebar button", { hasText: "Restart" }).click();
  await ready(page);
  check("…Restart loads version 7 and stays full screen", (await running(page)) === `${id}-v7` && (await page.locator(".stage .gameframe[data-immersive]").count()) === 1);
  await page.locator(".gameframe__exit").click();

  // ---- 6. A phone: full screen by Play, a tap in the game, the bar; then on the page, Later, the chip -----------------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await phone.newPage();
  p.on("pageerror", (e) => console.log("page error (phone):", e.message));
  await signIn(p);
  await p.goto(`${base}/games/${id}`, { waitUntil: "domcontentloaded" });
  await p.locator(".stage .gameframe__play").tap({ timeout: 120_000 });
  await p.locator(".stage .gameframe[data-immersive]").waitFor({ timeout: 10_000 });
  await ready(p);
  await play(p, true);
  await change("Add birds");
  await p.locator(".gameframe__bar .updatebar").waitFor({ timeout: 60_000 });
  check("390 px full screen: a tap in the game, then the bar over it (version 8)", (await text(p, ".gameframe__bar .updatebar__text")) === "Version 8 is ready." && (await running(p)) === `${id}-v7`);
  const clear = await p.evaluate(() => {
    const bar = document.querySelector(".gameframe__bar")?.getBoundingClientRect();
    const exit = document.querySelector(".gameframe__exit")?.getBoundingClientRect();
    const overlap = bar && exit && !(bar.right <= exit.left || exit.right <= bar.left || bar.bottom <= exit.top || exit.bottom <= bar.top);
    return { inside: !!bar && bar.left >= 0 && bar.right <= innerWidth, overlap: !!overlap };
  });
  check("…inside the screen and clear of the close control", clear.inside && !clear.overlap, JSON.stringify(clear));
  await shot(p, "bar-fullscreen-390");
  await p.locator(".gameframe__exit").tap();
  await p.locator(".stage__update .updatebar").waitFor({ timeout: 10_000 });
  check("390 px page: the same bar over the game, nothing wider than the screen", (await running(p)) === `${id}-v7` && (await fits(p)));
  await shot(p, "bar-390");
  // The narrowest phone: Restart's word without its arrow, the sentence in its room.
  await p.setViewportSize({ width: 320, height: 640 });
  await sleep(500);
  const narrow = await p.evaluate(() => {
    const bar = document.querySelector(".stage__update .updatebar")?.getBoundingClientRect();
    const text = document.querySelector(".stage__update .updatebar__text")?.getBoundingClientRect();
    return { inside: !!bar && bar.left >= 0 && bar.right <= innerWidth, textW: Math.round(text?.width ?? 0) };
  });
  check("320 px: the bar fits the screen and its words keep their room", narrow.inside && narrow.textW >= 60 && (await fits(p)), JSON.stringify(narrow));
  await shot(p, "bar-320");
  await p.setViewportSize({ width: 390, height: 844 });
  await sleep(500);
  await p.locator(".stage__update .updatebar button", { hasText: "Later" }).tap();
  await p.locator(".stage__update .updatebar__chip").waitFor({ timeout: 10_000 });
  await shot(p, "chip-390");
  await sleep(800);
  await p.locator(".stage__update .updatebar__chip").tap();
  await ready(p);
  check("390 px: the chip loads version 8", (await running(p)) === `${id}-v8`);

  // ---- 7. The build time on the answers: finished, stopped, failed; the line at 320, 390 and 1440 ------------------------
  await api("POST", `/projects/${id}/messages`, { text: "Add fog HOLD", model: "fast" });
  for (let i = 0; i < 40; i++) {
    const m = (await api("GET", `/projects/${id}`)).body?.messages.at(-1);
    if (m?.status === "running" && m.startedAt) break;
    await sleep(500);
  }
  await sleep(2500);
  await api("POST", `/projects/${id}/cancel`);
  await idle(id);
  await change("Please FAIL now");
  const answers = game.messages.filter((m) => m.role === "agent");
  // Two answers as Luka's screenshot has them (Best, high effort, 61.4 credits): one at 20 min, one long (1 h 5 min, version 12).
  const [first, second] = answers;
  await db.query(`UPDATE "Message" SET model = 'best', effort = 'high', credits = 61.4, "startedAt" = "finishedAt" - interval '20 minutes' WHERE id = $1`, [first.id]);
  await db.query(`UPDATE "Message" SET model = 'best', effort = 'high', credits = 61.4, "versionN" = 12, "startedAt" = "finishedAt" - interval '65 minutes' WHERE id = $1`, [second.id]);
  const lines = async (pg2) => {
    await pg2.locator(".msg__meta").first().waitFor({ timeout: 60_000 });
    return pg2.locator(".msg--agent .msg__meta").evaluateAll((els) =>
      els.map((el) => {
        const node = el.firstChild;
        const all = el.textContent ?? "";
        if (!node || node.nodeType !== Node.TEXT_NODE) return { text: all, broken: ["(not one text)"], rows: 0 };
        const items = all.split(String.fromCharCode(0xa0) + "· ");
        const broken = [];
        let at = 0;
        const top = (i) => {
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          return r.getBoundingClientRect().top;
        };
        for (const item of items) {
          if (Math.abs(top(at) - top(at + item.length - 1)) > 2) broken.push(item);
          at += item.length + 3;
        }
        const whole = document.createRange();
        whole.selectNodeContents(node);
        const rows = new Set([...whole.getClientRects()].map((r) => Math.round(r.top))).size;
        return { text: all.replaceAll(String.fromCharCode(0xa0), " "), broken, rows };
      }),
    );
  };
  const expect = [
    /^Best, high effort · 20 min · 61\.4 credits · version 1$/,
    /^Best, high effort · 1 h 5 min · 61\.4 credits · version 12$/,
    // The rest as they ran, a few seconds each (the restore made a version with no answer).
    ...answers.slice(2, -2).map((m) => new RegExp(`^Fast · \\d+ s · 1\\.7 credits · version ${m.versionN}$`)),
    /^Fast · \d+ s · Didn't work, not charged$/, // stopped (HOLD, then Stop)
    /^Fast · \d+ s · Didn't work, not charged$/, // failed
  ];
  for (const [ctx, w, h, name] of [
    [desk, 1440, 900, "lines-1440"],
    [phone, 390, 844, "lines-390"],
    [phone, 320, 640, "lines-320"],
  ]) {
    const pg2 = await ctx.newPage();
    await pg2.setViewportSize({ width: w, height: h });
    await pg2.goto(`${base}/games/${id}`, { waitUntil: "domcontentloaded" });
    if (w < 960) await pg2.locator("#ws-tab-chat").tap();
    const got = await lines(pg2);
    const wrong = got.filter((l, i) => expect[i] && !expect[i].test(l.text));
    check(`${w} px: every answer that ran has its build time ("Best, high effort · 20 min · 61.4 credits · version 1")`, got.length === expect.length && wrong.length === 0, wrong.map((l) => l.text).join(" | ") || got.map((l) => l.text).join(" | "));
    check(`${w} px: the line breaks only between items, never inside one`, got.every((l) => l.broken.length === 0), got.filter((l) => l.broken.length).map((l) => l.broken.join("/")).join(" | "));
    if (w === 320) check("320 px: the long line does wrap (between items)", got[1]?.rows >= 2, `${got[1]?.rows} rows`);
    check(`${w} px: nothing wider than the screen`, await fits(pg2));
    // The long answer in view.
    await pg2.locator(".msg--agent .msg__meta").nth(1).scrollIntoViewIfNeeded();
    await shot(pg2, name);
    await pg2.close();
  }
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
  if (apiProc) console.log(apiProc.log().slice(-2000));
} finally {
  await browser?.close().catch(() => {});
  try {
    const closed = await api("DELETE", "/me", { confirm: "DELETE" }).catch(() => ({ status: 0 }));
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
