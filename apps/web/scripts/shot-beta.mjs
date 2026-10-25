// Beta 1, end to end with screenshots: the closed-beta screen (signed in, not invited) and Send feedback, on a stack of
// its own on spare ports, so the dev stack on 3000-3002 is never touched: the API on :3041 with the closed beta on
// (BETA_INVITE_ONLY=1, DEV_AUTH=1, AGENT_FAKE=1), the games origin on :3042, the site on :3040 (`next dev` with its own
// NEXT_DIST_DIR, .next/beta; tsconfig.json is put back afterwards). Build the API first (npm run build -w @typeplay/server),
// then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-beta.mjs [outDir]
// Shots in .impeccable/review/beta/. Checks: an uninvited sign-in gets the closed-beta screen on /create, /games, /account
// and /billing (the saved idea, the address, Use another account, Sign out), the account place without credits,
// no user row; the public pages as before; Sign out; the beta code (10-25: the box at 390 and 320 px, digits only, too
// short, a wrong code with the API's sentence, the right one opens the app with its credits, in a browser of its own);
// then an invited tester builds a game and sends feedback from the game
// page's More menu (the tick box on, the game attached, the thanks) and from the account menu (on the game page with the
// game, on /games without), a draft kept across Escape, Send off while empty; phones at 390 and 320 px; worst cases: a
// 60-letter Georgian game name, a 4,000-letter note, emoji and Georgian, an unbreakable address, the day's 10 used.
// Afterwards: the test accounts closed (their notes go with them), invites and audit rows removed, FreeSpend put back.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useDevEnv } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/beta");
const SITE_PORT = 3040;
const API_PORT = 3041;
const GAMES_PORT = 3042;
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
mkdirSync(out, { recursive: true });
await useDevEnv();

const stamp = Date.now().toString(36);
const outsider = `beta-out-${stamp}@dev.test`;
const tester = `beta-in-${stamp}@dev.test`;
/** Gets in with a beta code (the others never do), and a code no earlier run left behind. */
const coder = `beta-code-${stamp}@dev.test`;
const BETA_CODE = String(Date.now() % 1_000_000).padStart(6, "0");
const longOne = `${"unbreakable".repeat(9)}-${stamp}@a-very-long-company-name-for-testing.example`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
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
const devId = (email) => `dev-${email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
/** No sideways scrolling on a phone: the page is no wider than the screen. */
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

// ---- The stack ------------------------------------------------------------------------------------
const children = [];
/** Starts a child that is stopped with its whole process tree at the end (next dev runs its server in a child). */
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
    BETA_INVITE_ONLY: "1",
    ADMIN_EMAILS: "",
    CORS_ORIGINS: base,
    BILLING_JOBS: "0",
  });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).inviteOnly === true, 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/beta",
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_CLOSED_BETA: "1",
    NEXT_PUBLIC_API_ORIGIN: apiBase,
    NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${GAMES_PORT}`,
    NEXT_PUBLIC_PADDLE_ENV: "",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
  });
  await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 180, siteProc.log);
  console.log("stack up: site :3040, API :3041 (closed beta on), games :3042");

  browser = await chromium.launch({ channel: "msedge", headless: true });

  /** Dev sign-in on /create (with a saved idea from the address, or `draft` put straight into the browser's storage, as
   * a long one would be: the home page's box saves as you type), then whichever screen the API's answer leads to. */
  async function signIn(page, email, idea = "Make an endless runner where a cat jumps over boxes", draft = null) {
    const url = draft === null ? `${base}/create?prompt=${encodeURIComponent(idea)}` : `${base}/create`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
    if (draft !== null) await page.evaluate((text) => localStorage.setItem("typeplay.draft", text), draft);
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", email);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
  }
  const closedTitle = (page) => page.getByRole("heading", { name: "TypePlay is in a closed beta." });
  const openMenu = async (page) => {
    await page.locator(".account__me").click();
    await page.locator("#account-menu:popover-open").waitFor({ timeout: 5_000 });
    await page.waitForTimeout(220); // the 160 ms entrance
  };
  /** Opens the feedback dialog from a button, clicking again if the first click came before the page woke up. */
  const openFeedback = async (page, click) => {
    for (let i = 0; i < 6; i++) {
      await click();
      if (await page.locator("dialog.feedback[open]").waitFor({ timeout: 1500 }).then(() => true, () => false)) {
        await page.waitForTimeout(220);
        return;
      }
    }
    throw new Error("the feedback dialog didn't open");
  };
  const fromMenu = (page) => async () => {
    await openMenu(page);
    await page.locator("#account-menu .account__links button", { hasText: "Send feedback" }).click();
  };
  const fromMore = (page, gameId) => async () => {
    await page.getByRole("button", { name: /^More: rename/ }).click();
    await page.locator(`#game-menu-${gameId}:popover-open`).waitFor({ timeout: 5_000 });
    await page.locator(".menu__list button", { hasText: "Send feedback" }).click();
  };

  // ---- Signed in, not invited: the closed-beta screen ------------------------------------------------
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desk.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(page, outsider);
  await closedTitle(page).waitFor({ timeout: 30_000 });
  check("uninvited on /create: the closed-beta screen", true);
  check("it names the signed-in address", (await page.locator(".closed__who b").innerText()) === outsider);
  check("the saved idea is kept and quoted", (await page.locator(".closed__idea q").innerText()).includes("cat jumps over boxes"));
  check("Use another account and Sign out", (await page.getByRole("button", { name: "Use another account" }).count()) === 1 && (await page.getByRole("button", { name: "Sign out" }).count()) === 1);
  check("no Build my game, no credits in the status bar", (await page.getByRole("button", { name: "Build my game" }).count()) === 0 && (await page.locator(".account__credits").count()) === 0 && (await page.locator(".account__games").count()) === 0);
  check("one hot action on the screen", (await page.locator("main .button:not(.button--quiet)").count()) === 1);
  check("no user row for the uninvited address", (await db.query(`SELECT count(*) FROM "User" WHERE id = $1`, [devId(outsider)])).rows[0].count === "0");
  await page.waitForTimeout(300);
  await shot(page, "closed-create-desktop");
  await openMenu(page);
  const menuText = await page.locator("#account-menu").innerText();
  check("account menu: the address, the closed beta, Sign out; no Send feedback", menuText.includes(outsider) && /closed beta/.test(menuText) && !/Send feedback/.test(menuText));
  await shot(page, "closed-menu-desktop");
  await page.keyboard.press("Escape");
  for (const path of ["/games", "/account", "/billing"]) {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const shown = await closedTitle(page).waitFor({ timeout: 60_000 }).then(() => true, () => false);
    check(`uninvited on ${path}: the closed-beta screen`, shown);
  }
  await shot(page, "closed-billing-desktop");
  await page.goto(`${base}/pricing`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(".plan").first().waitFor({ timeout: 60_000 });
  check("the public pages as before (pricing)", (await closedTitle(page).count()) === 0 && (await page.locator(".plan").count()) >= 5);
  await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await closedTitle(page).waitFor({ timeout: 60_000 });
  await page.getByRole("button", { name: "Sign out" }).click();
  check("Sign out: back to the signed-out /create", await page.getByRole("button", { name: "Sign in with Google" }).waitFor({ timeout: 30_000 }).then(() => true, () => false));
  check("signed out, the closed beta is said before Google", /closed beta for now: sign in with Google, then type the beta code from your invitation/.test(await page.locator(".signin .field-hint").innerText()));

  // Phones: 390 and 320, touch.
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    await signIn(p, outsider);
    await closedTitle(p).waitFor({ timeout: 30_000 });
    check(`closed beta at ${w} px: nothing wider than the screen`, await fits(p));
    await p.waitForTimeout(300);
    await shot(p, `closed-create-${w}`, true);
    await openMenu(p);
    await shot(p, `closed-menu-${w}`);
    // The page behind the menu is dimmed on a phone: a tap on it must still close the menu.
    await p.touchscreen.tap(6, h - 60); // the sky in the side gutter: nothing to press under it
    await p.waitForTimeout(300);
    check(`account menu at ${w} px: a tap on the dimmed page closes it`, (await p.locator("#account-menu:popover-open").count()) === 0);
    await phone.close();
  }
  // Worst cases at 320 px: an address with no place to break, and the longest idea the /create box takes (4,000 letters).
  const narrow = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const np = await narrow.newPage();
  const longIdea = "Make a match-3 puzzle in Tbilisi at night with 🍇 grapes and ჩურჩხელა sweets, ".repeat(60).slice(0, 4000).replace(/[\ud800-\udbff]$/, "x");
  await signIn(np, longOne, "", longIdea);
  await closedTitle(np).waitFor({ timeout: 30_000 });
  check("an unbreakable address at 320 px: it wraps, nothing wider than the screen", await fits(np));
  const ideaHeight = await np.locator(".closed__idea q").evaluate((el) => el.getBoundingClientRect().height);
  check("a 4,000-letter saved idea: cut at three lines", ideaHeight > 40 && ideaHeight < 90, `${Math.round(ideaHeight)} px`);
  check("the main button stays inside its panel at 320 px", await np.evaluate(() => {
    const panel = document.querySelector(".closed__who")?.getBoundingClientRect();
    return [...document.querySelectorAll(".closed__actions .button")].every((b) => b.getBoundingClientRect().right <= (panel?.right ?? 0) + 0.5);
  }));
  await np.waitForTimeout(300); // the page's 160 ms fade-in
  await shot(np, "closed-worst-address-320", true);
  await narrow.close();

  // ---- A beta code (Luka, 10-24): wrong, then right; the app opens with the code's credits ----------------------------
  const made = admin("code", "add", BETA_CODE, "--uses", "1", "--credits", "30", "shots");
  check("admin code add", made.status === 0, made.stdout.trim() || made.stderr.trim());
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    await signIn(p, outsider);
    await closedTitle(p).waitFor({ timeout: 30_000 });
    const box = p.locator("#beta-code");
    check(`the code box at ${w} px: 16 px or more (no zoom), the number keyboard, one-time-code`, await box.evaluate((el) => parseFloat(getComputedStyle(el).fontSize) >= 16 && el.inputMode === "numeric" && el.autocomplete === "one-time-code"));
    check(`the code row at ${w} px: nothing wider than the screen, Join the beta below the box`, (await fits(p)) && (await p.evaluate(() => {
      const field = document.querySelector(".closed__field")?.getBoundingClientRect();
      const join = document.querySelector(".closed__code-row .button")?.getBoundingClientRect();
      return !!field && !!join && join.top >= field.bottom - 0.5;
    })));
    await p.waitForTimeout(300); // the page's 160 ms fade-in
    await shot(p, `closed-code-${w}`, true);
    // A short code on a phone: the sentence sits between the box and the button (the open keyboard covers what is below).
    await box.fill("123");
    await p.getByRole("button", { name: "Join the beta" }).tap();
    await p.locator("#beta-code-error").waitFor({ timeout: 5_000 });
    check(`the error at ${w} px: between the box and Join the beta, the box still focused`, await p.evaluate(() => {
      const field = document.querySelector(".closed__field")?.getBoundingClientRect();
      const error = document.querySelector("#beta-code-error")?.getBoundingClientRect();
      const join = document.querySelector(".closed__code-row .button")?.getBoundingClientRect();
      return !!field && !!error && !!join && error.top >= field.bottom - 0.5 && error.bottom <= join.top + 0.5 && document.activeElement?.id === "beta-code";
    }));
    await shot(p, `closed-code-error-${w}`);
    await phone.close();
  }
  // Its own browser (the dev sign-in lives in the browser's storage): the desktop page above stays signed out.
  const codeContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const cp = await codeContext.newPage();
  cp.on("pageerror", (e) => console.log("page error:", e.message));
  await signIn(cp, coder);
  await closedTitle(cp).waitFor({ timeout: 30_000 });
  await cp.locator("#beta-code").fill("12a34");
  check("the box keeps digits only", (await cp.locator("#beta-code").inputValue()) === "1234");
  await cp.getByRole("button", { name: "Join the beta" }).click();
  check("too short: said before asking the API", /6 digits/.test(await cp.locator("#beta-code-error").innerText()));
  await cp.locator("#beta-code").fill(BETA_CODE === "000001" ? "000002" : "000001");
  await cp.getByRole("button", { name: "Join the beta" }).click();
  await cp.locator("#beta-code-error").filter({ hasText: "isn't right" }).waitFor({ timeout: 15_000 });
  check("a wrong code: the API's sentence, the tries left", /4 tries left this hour/.test(await cp.locator("#beta-code-error").innerText()));
  check("the error is announced and tied to the box", (await cp.locator("#beta-code-error").getAttribute("role")) === "alert" && (await cp.locator("#beta-code").getAttribute("aria-describedby")) === "beta-code-error");
  check("after a wrong code the box keeps the focus and the code, selected", await cp.evaluate(() => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement && el.id === "beta-code" && el.selectionStart === 0 && el.selectionEnd === el.value.length && el.value.length === 6;
  }));
  check("the placeholder says what to type", (await cp.locator("#beta-code").getAttribute("placeholder")) === "6 digits");
  await cp.waitForTimeout(200);
  await shot(cp, "closed-code-wrong-desktop");
  await cp.locator("#beta-code").fill(`${BETA_CODE.slice(0, 3)} ${BETA_CODE.slice(3)}`);
  check("typed with a space: six digits", (await cp.locator("#beta-code").inputValue()) === BETA_CODE);
  await cp.getByRole("button", { name: "Join the beta" }).click();
  check("the right code: the app opens (Build my game)", await cp.getByRole("button", { name: "Build my game" }).waitFor({ timeout: 30_000 }).then(() => true, () => false));
  check("... with the Free plan's 20 credits and the code's 30", (await cp.locator(".account__credits b").innerText()) === "50");
  check("... saying so in one focused line: You're in the beta. We added 30 credits.", await cp.evaluate(() => {
    const line = document.querySelector(".joined");
    return line?.textContent === "You're in the beta. We added 30 credits." && document.activeElement === line;
  }));
  await cp.waitForTimeout(300);
  await shot(cp, "closed-code-in-desktop");
  await codeContext.close();

  // ---- Invited: the app, then Send feedback ------------------------------------------------------------
  const add = admin("invite", "add", tester, "shots");
  check("admin invite add", add.status === 0, add.stdout.trim() || add.stderr.trim());
  await signIn(page, tester);
  await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  check("invited: /create as usual (Build my game, credits)", (await page.getByRole("button", { name: "Build my game" }).count()) === 1 && (await page.locator(".account__credits b").innerText()) === "20");
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 60_000 });
  const gameId = page.url().split("/").pop();
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 90_000 });
  await page.waitForTimeout(600);

  await openFeedback(page, fromMore(page, gameId));
  const box = page.locator("dialog.feedback[open]");
  check("More > Send feedback: the dialog, the game's tick box on", (await box.locator(".feedback__attach input").isChecked()) && (await box.locator(".feedback__attach .feedback__game").innerText()).length > 0);
  check("Send waits for words", await box.getByRole("button", { name: "Send feedback" }).isDisabled());
  const boxHeight = await box.locator("textarea").first().evaluate((el) => el.getBoundingClientRect().height);
  check("the empty 'What happened?' box is three lines tall", boxHeight >= 88, `${Math.round(boxHeight)} px`);
  await shot(page, "feedback-game-desktop");
  await box.locator("textarea").first().fill("The cat jumped through the second box instead of over it.");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("closed: the keyboard is back on the More button", await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") ?? "").startsWith("More:")));
  await openFeedback(page, fromMore(page, gameId));
  check("closed with Escape and opened again: the words are still there", (await box.locator("textarea").first().inputValue()).startsWith("The cat jumped"));
  await box.locator("textarea").nth(1).fill("It jumps over every box.");
  await shot(page, "feedback-typed-desktop");
  await box.getByRole("button", { name: "Send feedback" }).click();
  await box.locator(".report__body[role=status]").waitFor({ timeout: 15_000 });
  check("sent: the thanks, with the address we'd write to", (await box.innerText()).includes("Thanks for telling us.") && (await box.innerText()).includes(tester));
  await page.waitForTimeout(250);
  await shot(page, "feedback-thanks-desktop");
  const row = (await db.query(`SELECT page, "projectId", "messageId", "versionN", browser, expected FROM "Feedback" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1`, [devId(tester)])).rows[0];
  check("the note: this page, the game, its answer, version 1, the browser, what they expected", row?.page === `/games/${gameId}` && row.projectId === gameId && !!row.messageId && row.versionN === 1 && /Edg|Chrome/.test(row.browser ?? "") && row.expected === "It jumps over every box.");
  await box.getByRole("button", { name: "Close" }).click();

  await openFeedback(page, fromMenu(page));
  check("account menu on the game page: the same game offered", (await box.locator(".feedback__attach .feedback__game").count()) === 1);
  await page.keyboard.press("Escape");
  await page.goto(`${base}/games`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(".account__me").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(800);
  await openFeedback(page, fromMenu(page));
  check("account menu on /games: no game to attach", (await box.locator(".feedback__attach").count()) === 0);
  await shot(page, "feedback-plain-desktop");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check("closed: the keyboard is back on the avatar", await page.evaluate(() => document.activeElement?.classList.contains("account__me") === true));

  // Worst cases on the game page: a 60-letter Georgian name, a 4,000-letter note in emoji and Georgian, the day's 10 used.
  const georgian = "ძალიან გრძელი სახელი თამაშისთვის რომელიც არასდროს მთავრდება ბოლომდე";
  const longName = [...georgian].slice(0, 60).join("");
  check("rename to a 60-letter Georgian name", (await api(tester, "PATCH", `/projects/${gameId}`, { name: longName })).status === 200);
  await page.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
  await openFeedback(page, fromMore(page, gameId));
  // 4,000 UTF-16 units, as the text box counts them, without half an emoji at the end.
  let note = "თამაში გაიყინა 🐸 after the second log, ".repeat(120).slice(0, 4000);
  if (/[\ud800-\udbff]$/.test(note)) note = `${note.slice(0, -1)}x`;
  await box.locator("textarea").first().fill(note.slice(0, 3999));
  await page.waitForTimeout(200);
  check("3,999 letters: '1 letter left'", /^1 letter left$/.test((await box.locator(".feedback__count").first().innerText()).trim()));
  await box.locator("textarea").first().fill(note);
  await page.waitForTimeout(200);
  check("4,000 letters: the counter says it's the most a note holds", /most one note holds/.test(await box.locator(".feedback__part .field-hint").first().innerText()));
  await shot(page, "feedback-worst-desktop");
  // The day's 10: eight more through the API (one was sent above), then the dialog's own.
  for (let i = 0; i < 8; i++) await api(tester, "POST", "/feedback", { text: `Note ${i + 2}`, page: "/games" });
  await box.getByRole("button", { name: "Send feedback" }).click();
  await box.locator(".report__body[role=status]").waitFor({ timeout: 15_000 });
  check("the 10th note (4,000 letters) goes through", true);
  await box.getByRole("button", { name: "Close" }).click();
  await openFeedback(page, fromMore(page, gameId));
  await box.locator("textarea").first().fill("One more thing about the frog.");
  await box.getByRole("button", { name: "Send feedback" }).click();
  await box.locator(".composer__error").waitFor({ timeout: 15_000 });
  const limit = await box.locator(".composer__error").innerText();
  check("the 11th: the API's limit said in the dialog, the words kept", /10 notes today/.test(limit) && (await box.locator("textarea").first().inputValue()).startsWith("One more"), limit);
  check("... and Send stays off after it", await box.getByRole("button", { name: "Send feedback" }).isDisabled());
  await shot(page, "feedback-worst-limit-desktop");
  await page.keyboard.press("Escape");

  // Phones: the dialog with the long name and a long note, at 390 and 320.
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const phone = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phone.newPage();
    await signIn(p, tester);
    await p.goto(`${base}/games/${gameId}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await p.locator(".ws__tabs").waitFor({ timeout: 60_000 });
    await p.waitForTimeout(800);
    await openFeedback(p, fromMore(p, gameId));
    const d = p.locator("dialog.feedback[open]");
    check(`feedback at ${w} px: the dialog fits the screen`, await d.evaluate((el) => el.getBoundingClientRect().width <= window.innerWidth - 16));
    check(`feedback at ${w} px: the empty box is three lines tall (its two-line hint fits)`, (await d.locator("textarea").first().evaluate((el) => el.getBoundingClientRect().height)) >= 88);
    await shot(p, `feedback-game-${w}`);
    await d.locator("textarea").first().fill(note);
    await p.waitForTimeout(200);
    await shot(p, `feedback-worst-${w}`);
    await phone.close();
  }
} catch (e) {
  check("the run finished", false, e instanceof Error ? (e.stack ?? e.message) : String(e));
} finally {
  await browser?.close().catch(() => {});
  // The test accounts: what their builds added to today's FreeSpend goes back out, then the accounts close (notes,
  // games and builds go with them); the invite and the audit rows that name it go too.
  try {
    for (const email of [tester, coder]) {
      const spent = await db.query(
        `SELECT coalesce(sum(m."costUsd"), 0)::float AS usd FROM "Message" m JOIN "Project" p ON p.id = m."projectId" WHERE p."ownerId" = $1 AND m.plan = 'free' AND m."createdAt" >= date_trunc('day', now() AT TIME ZONE 'UTC')`,
        [devId(email)],
      );
      if (spent.rows[0].usd > 0) await db.query(`UPDATE "FreeSpend" SET usd = greatest(0, usd - $1) WHERE day = date_trunc('day', now() AT TIME ZONE 'UTC')`, [spent.rows[0].usd]);
      const closed = await api(email, "DELETE", "/me", { confirm: "DELETE" }).catch(() => ({ status: 0 }));
      console.log(`closed ${email}: ${closed.status}`);
    }
    admin("invite", "remove", tester);
    admin("invite", "remove", coder);
    const { emailHash } = await import("../../server/dist/auth/tombstone.js");
    const { inviteMatch } = await import("../../server/dist/beta/invites.js");
    for (const email of [tester, coder]) {
      await db.query(`DELETE FROM "BillingAudit" WHERE details->>'emailHash' = $1 OR "userId" = $2`, [emailHash(inviteMatch(email)), devId(email)]);
      await db.query(`DELETE FROM "ClosedAccount" WHERE id = $1`, [devId(email)]);
    }
    // The code, its use and the wrong tries of this run; the code's own audit rows.
    await db.query(`DELETE FROM "BetaCode" WHERE code = $1`, [BETA_CODE]);
    await db.query(`DELETE FROM "BetaCodeTry" WHERE match = ANY($1)`, [[coder, outsider]]);
    await db.query(`DELETE FROM "BillingAudit" WHERE action IN ('code_add', 'beta_code') AND details->>'code' = $1`, [BETA_CODE]);
    const left = await db.query(`SELECT (SELECT count(*) FROM "User" WHERE id = ANY($1)) AS users, (SELECT count(*) FROM "Feedback" WHERE "userId" = ANY($1)) AS notes`, [[devId(tester), devId(outsider), devId(longOne), devId(coder)]]);
    check("cleaned up: no test users or notes left", left.rows[0].users === "0" && left.rows[0].notes === "0");
  } catch (e) {
    console.log("cleanup:", e instanceof Error ? e.message : e);
  }
  await db.end().catch(() => {});
  stopAll();
  // `next dev` with its own NEXT_DIST_DIR adds its type folders to tsconfig.json: put the file back as it was.
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
