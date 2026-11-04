// Questions before a build (2026-11-04), end to end with screenshots, on a stack of its own on ports picked free and a
// database of its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched: the API (DEV_AUTH=1,
// AGENT_FAKE=1: "VAGUE" asks, "LONGQ" asks the worst case), the games origin, the site (`next dev` with its own
// NEXT_DIST_DIR, .next/questions; tsconfig.json is put back afterwards). Build the API first (npm run build -w
// @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-questions.mjs [outDir]
// Shots in .impeccable/review/questions/. Checks, at 1440 and 390 px (320 and the worst case at the end): /create's "Ask
// me first" is ticked at first; a vague idea opens its game page with the AI's questions in the chat (a phone's stage says
// so, and "Answer them" brings the keyboard to them); the pills are radios (the arrow keys move the pick), You decide is
// picked at first, Type my own opens a box; Build it builds with the answers, and the chat then lists the questions under
// the AI's line with the answers in the player's bubble; the composer's tick is off at first, remembered once ticked, and
// a change it asks about takes a typed answer from the box. No sideways scrolling anywhere. Afterwards the account closes.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : join(root, ".impeccable/review/questions");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("questions", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;

const stamp = Date.now().toString(36);
const who = `questions-${stamp}@dev.test`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name) => {
  await page.waitForTimeout(400); // past the 220 ms entrance and colour changes
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (email, method, path, body) =>
  fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
/** No sideways scrolling; when there is, what sticks out is printed. */
const fits = async (page) => {
  const wide = await page.evaluate((vw) => {
    if (document.documentElement.scrollWidth <= vw + 1) return null;
    const pinned = (e) => { for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).position === "fixed") return true; return false; };
    const out = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 1 && !pinned(e));
    return `${document.documentElement.scrollWidth}px: ${out.slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} (${Math.round(e.getBoundingClientRect().right)})`).join(", ")}`;
  }, page.viewportSize().width);
  if (wide) console.log("  too wide:", wide);
  return !wide;
};
/** Nothing inside the chat column sticks out past its right edge (a pill or a question too wide for it). */
const inChat = async (page) =>
  page.evaluate(() => {
    const log = document.querySelector(".log");
    if (!log) return true;
    const right = log.getBoundingClientRect().right + 1;
    return [...log.querySelectorAll(".questions *, .asked *")].every((e) => e.getBoundingClientRect().right <= right);
  });
async function idle(id, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    const p = (await api(who, "GET", `/projects/${id}`)).body;
    if (p?.status === "idle") return p;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${id} never went idle`);
}

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
    NEXT_DIST_DIR: ".next/questions",
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
  await api(who, "GET", "/me");
  check("the account: Medium + 80 credits", admin("plan", who, "medium").status === 0 && admin("grant", who, "80").status === 0);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page) {
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", who);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  /** A vague idea from /create: Build, then the game page with its questions open in the chat. */
  async function ask(page, idea, phone) {
    await page.fill("#idea", idea);
    await page.getByRole("button", { name: "Build my game" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 120_000 });
    const id = page.url().split("/").pop();
    await idle(id);
    if (phone) {
      // A phone opens on Play while the first run goes: the stage says the questions wait in the chat.
      const go = page.getByRole("button", { name: "Answer them" });
      await go.waitFor({ timeout: 30_000 });
    } else {
      await page.locator("#questions-form").waitFor({ timeout: 30_000 });
    }
    return id;
  }

  for (const [label, viewport, phone] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, ...(phone ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(page);

    // ---- /create: the tick, ticked at first ----
    const tick = page.getByRole("checkbox", { name: /Ask me first/ });
    check(`${label}: /create has "Ask me first", ticked at first`, (await tick.count()) === 1 && (await tick.isChecked()));
    await page.fill("#idea", "Make a game VAGUE");
    await tick.scrollIntoViewIfNeeded();
    check(`${label}: /create, no sideways scrolling`, await fits(page));
    await shot(page, `create-tick-${label}`);

    // ---- a vague idea: the questions in the chat ----
    const gameId = await ask(page, "Make a game VAGUE", phone);
    if (phone) {
      check(`${label}: the stage says the questions wait in the chat`, (await page.locator(".stage__line").innerText()).includes("A few questions first."));
      await shot(page, `stage-questions-${label}`);
      await page.getByRole("button", { name: "Answer them" }).click();
      await page.locator("#questions-form").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(300);
      const focused = await page.evaluate(() => document.activeElement?.closest("#questions-form") && document.activeElement?.getAttribute("type"));
      check(`${label}: "Answer them" opens the chat with the keyboard on the first question`, focused === "radio", String(focused));
    }
    const form = page.locator("#questions-form");
    const groups = form.locator("fieldset");
    const named = await page.getByRole("group", { name: "Who do you play as?" }).count();
    check(`${label}: two questions, each a group of radios named by its question`, (await groups.count()) === 2 && named === 1 && (await groups.first().locator("input[type=radio]").count()) === 5);
    const picked = await form.locator("input[type=radio]:checked").evaluateAll((els) => els.map((e) => e.closest("label")?.innerText.trim()));
    check(`${label}: You decide is picked at first on each`, picked.length === 2 && picked.every((t) => t === "You decide"), picked.join(", "));
    check(`${label}: Build it beside the AI it builds on and its cost`, (await form.getByRole("button", { name: "Build it" }).count()) === 1 && /^Builds on Smart · about [\d.]+ credits$/.test((await form.locator(".questions__cost").innerText()).trim()), (await form.locator(".questions__cost").innerText()).trim());
    check(`${label}: while they are open the composer is the box and Send only (one AI, one price: the card's)`, (await page.locator("form.composer").getByRole("group", { name: "Choose the AI" }).count()) === 0 && (await page.locator("form.composer").getByRole("group", { name: "Effort" }).count()) === 0);
    if (!phone) check(`${label}: beside the chat the stage has no button to it`, !(await page.getByRole("button", { name: "Answer them" }).isVisible()));
    check(`${label}: the questions fit the chat column`, await inChat(page));
    check(`${label}: the game page, no sideways scrolling`, await fits(page));
    await form.scrollIntoViewIfNeeded();
    await shot(page, `chat-questions-${label}`);

    // The arrow keys move the pick, as radios do.
    await groups.first().locator("input[type=radio]:checked").focus();
    await page.keyboard.press("ArrowLeft");
    const afterArrow = await groups.first().locator("input[type=radio]:checked").evaluate((e) => e.closest("label")?.innerText.trim());
    check(`${label}: ← moves the pick to the answer before You decide`, afterArrow === "A dragon", String(afterArrow));
    await groups.first().getByText("A cat", { exact: true }).click();
    await groups.nth(1).getByText("Type my own", { exact: true }).click();
    const own = groups.nth(1).locator("xpath=..").locator("textarea");
    await own.first().waitFor({ timeout: 5_000 });
    const ownFocused = await page.evaluate(() => document.activeElement?.tagName === "TEXTAREA");
    check(`${label}: Type my own opens a box with the keyboard in it`, ownFocused);
    await page.keyboard.type("Collect every star before the night ends");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(300);
    const afterEnter = await page.evaluate(() => document.activeElement?.textContent?.trim());
    check(`${label}: Enter in the last own answer goes to Build it and builds nothing`, afterEnter === "Build it" && (await form.count()) === 1, String(afterEnter));
    await form.scrollIntoViewIfNeeded();
    await shot(page, `chat-answering-${label}`);

    // ---- Build it ----
    await form.getByRole("button", { name: "Build it" }).click();
    await page.locator("#questions-form").waitFor({ state: "detached", timeout: 30_000 });
    await idle(gameId);
    await page.waitForTimeout(800);
    const bubble = (await page.locator(".msg--you").last().innerText()).trim();
    check(`${label}: the player's bubble reads the answers`, bubble === "You play: A cat\nGoal: Collect every star before the night ends", JSON.stringify(bubble));
    check(`${label}: the AI's line keeps its questions listed, read only`, (await page.locator(".asked li").count()) === 2);
    check(`${label}: the game page after the build, no sideways scrolling`, await fits(page));
    if (phone) await page.getByRole("tab", { name: "Chat" }).click().catch(() => {});
    await page.locator(".asked").first().scrollIntoViewIfNeeded();
    await shot(page, `chat-after-${label}`);

    // ---- the composer's tick: off at first, remembered once ticked ----
    const ctick = page.locator("form.composer").getByRole("checkbox", { name: /Ask me first/ });
    check(`${label}: the composer's "Ask me first" is off at first`, (await ctick.count()) === 1 && !(await ctick.isChecked()));
    await ctick.check();
    await page.waitForTimeout(500);
    check(`${label}: ticked, the tip says what it does`, (await page.locator("#say-tip").innerText()).startsWith("Ask me first:"));
    check(`${label}: … and the account remembers it`, (await api(who, "GET", "/me")).body?.askFirst?.edit === true);
    check(`${label}: the composer, no sideways scrolling`, await fits(page));
    await shot(page, `composer-tick-${label}`);

    // ---- a change it asks about, answered in the box ----
    await page.locator("#say").fill("add a second player VAGUE");
    await page.locator("form.composer").getByRole("button", { name: "Send" }).click();
    await page.locator("#questions-form").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(500);
    check(`${label}: a change the AI asks about: one question in the chat`, (await page.locator("#questions-form fieldset").count()) === 1);
    check(`${label}: while it is open the tick is gone and the box takes the answer`, (await ctick.count()) === 0 && (await page.locator("#say").getAttribute("placeholder")) === "Or type your answer");
    // The page was open when it came: its arrival is read out once (the page's announcer).
    const said = await page.locator("main [role=status].sr-only").first().innerText();
    check(`${label}: its arrival is read out`, said === "The AI has a question before it builds. It's in the chat.", said);
    if (!phone) check(`${label}: a change's stage line says a question waits`, (await page.locator(".stage__live").innerText()).includes("A question before version 2."));
    await page.locator("#questions-form").scrollIntoViewIfNeeded();
    await shot(page, `chat-change-question-${label}`);
    // A tap on the card, then words typed in the box: Send carries both.
    await page.locator("#questions-form").getByText("Both at once", { exact: true }).click();
    await page.locator("#say").fill("on one screen, split keys");
    await page.locator("form.composer").getByRole("button", { name: "Send" }).click();
    await page.locator("#questions-form").waitFor({ state: "detached", timeout: 30_000 });
    await idle(gameId);
    const both = (await api(who, "GET", `/projects/${gameId}`)).body;
    check(`${label}: the tap and the typed words built version 2 together`, both?.currentVersion === 2 && both.messages.at(-2)?.text === "Two players: Both at once\non one screen, split keys", JSON.stringify(both?.messages.at(-2)?.text));
    await api(who, "PATCH", "/me", { askFirst: { edit: false } });
    await ctx.close();
  }

  // ---- 320 px and the worst case: three questions at the length limits ----
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await signIn(page);
    await ask(page, "Ein Spiel VAGUE LONGQ", true);
    await page.getByRole("button", { name: "Answer them" }).click();
    await page.locator("#questions-form").waitFor({ timeout: 10_000 });
    check("320: three long questions fit the chat column", await inChat(page));
    check("320: Type my own in the questions' language, the card's lang set", (await page.locator("#questions-form").getByText("Selbst schreiben").count()) === 3 && (await page.locator("#questions-form").getAttribute("lang")) === "de");
    check("320: no sideways scrolling", await fits(page));
    await page.locator("#questions-form").scrollIntoViewIfNeeded();
    await shot(page, "worst-questions-320");
    await page.locator("#questions-form fieldset").nth(2).scrollIntoViewIfNeeded();
    await shot(page, "worst-questions-320-end");
    await ctx.close();
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await signIn(page);
    await ask(page, "Ein Spiel VAGUE LONGQ", false);
    check("1440: the worst case fits the chat column", await inChat(page));
    await page.locator("#questions-form").scrollIntoViewIfNeeded();
    await shot(page, "worst-questions-1440");
    await ctx.close();
  }
} catch (e) {
  check("the walk-through ran", false, e?.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  await api(who, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  stopAll();
  writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
