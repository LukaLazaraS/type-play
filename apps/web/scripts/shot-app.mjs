// End-to-end pass over the app screens with screenshots, against the real API in test mode:
//   API:  DEV_AUTH=1 AGENT_FAKE=1 node apps/server/dist/main.js   (port 3002)
//   site: NEXT_PUBLIC_DEV_AUTH=1 npm run dev -w web                 (port 3000)
//   games origin: node apps/games/scripts/serve.mjs                 (port 3001)
// Run it through the CPU limiter, one browser at a time:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-app.mjs [outDir] [siteUrl] [apiUrl]
// Signs in with "Dev sign-in" as a new test user, builds a game, plays it, sends a change, a failing
// change, restores version 1, checks the Free plan locks Smart and Best and the effort setting, then
// shares the game (its public page, signed out, and its link preview), renames and downloads it,
// unshares it (the page 404s), manages and deletes games on /games, the account page (credit history,
// download my data, delete-account asking first), the phone layouts, and finally closes a second
// test account for good.
// Payments (part 3): /billing with billing off on the API above, then a sandbox API of this script's
// own on :3017 pointed at the Paddle stub (apps/server/test/paddle-stub.mjs), with the browser's API
// calls sent there and window.Paddle replaced by a stand-in that completes the transaction at the
// stub: the checkout page up to the overlay and the done state, the plan picker and its preview, a
// downgrade and its undo, cancel and keep, the portal, the game page's credit panels (a Free user and
// a paid one with 0 credits, planted with the admin CLI), the past-due strip, and the phone layouts.
// For that part the site must have been started with NEXT_PUBLIC_PADDLE_ENV=sandbox
// NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_shots (any test_ token; nothing real is called).
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { androidPart, droidEmail } from "./shot-android.mjs";
import { galleryEmail, galleryPart } from "./shot-gallery.mjs";

const out = process.argv[2] ?? join(import.meta.dirname, "../../../.impeccable/review/app");
const base = process.argv[3] ?? "http://localhost:3000";
const apiBase = process.argv[4] ?? "http://127.0.0.1:3002";
mkdirSync(out, { recursive: true });

// ---- Payments on: a sandbox API + the Paddle stub, and a window.Paddle stand-in ---------------------
const serverDir = join(import.meta.dirname, "../../server");
const SANDBOX_PORT = 3017;
const SECRET = "pdl_ntfset_shots_secret_0000000000000000000000";
let sandbox = null;
/** The server in sandbox mode against the stub, like apps/server/test/billing.mjs starts it. */
async function startSandboxApi() {
  const { startStub, PRICE_IDS } = await import("../../server/test/paddle-stub.mjs");
  const { signBody } = await import("../../server/dist/billing/paddle.signature.js");
  const stub = await startStub();
  const env = {
    ...process.env,
    PORT: String(SANDBOX_PORT),
    PADDLE_ENV: "sandbox",
    PADDLE_API_KEY: "pdl_sdbx_apikey_shots0000000000000000000000_shots000000000000000000_000",
    PADDLE_API_URL: stub.url,
    PADDLE_WEBHOOK_SECRET: SECRET,
    PADDLE_PRICE_MEDIUM: PRICE_IDS.medium,
    PADDLE_PRICE_HIGH: PRICE_IDS.high,
    PADDLE_PRICE_ULTRA: PRICE_IDS.ultra,
    PADDLE_PRICE_ULTRAPLUS: PRICE_IDS.ultraplus,
    PADDLE_PRICE_PACK: PRICE_IDS.pack,
    BILLING_JOBS: "0",
    DEV_AUTH: "1",
    AGENT_FAKE: "1",
    CORS_ORIGINS: new URL(base).origin,
  };
  const child = spawn(process.execPath, ["dist/main.js"], { cwd: serverDir, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const url = `http://127.0.0.1:${SANDBOX_PORT}`;
  for (let i = 0; ; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode !== null || i > 90) throw new Error(`the sandbox API on :${SANDBOX_PORT} did not start: ${output.slice(-800)}`);
    const h = await fetch(`${url}/health`).then((r) => r.json()).catch(() => null);
    if (h?.billing?.ready) break;
  }
  let n = 0;
  /** A webhook as Paddle sends it, signed with the destination's secret; returns the status. */
  const hook = async (type, data) => {
    n++;
    const body = JSON.stringify({ event_id: `evt_shots${stamp}_${n}`, event_type: type, occurred_at: new Date().toISOString(), notification_id: `ntf_shots${stamp}_${n}`, data });
    const res = await fetch(`${url}/webhooks/paddle`, { method: "POST", headers: { "content-type": "application/json", "paddle-signature": signBody(body, SECRET, Math.floor(Date.now() / 1000)) }, body });
    await new Promise((r) => setTimeout(r, 1200)); // the inbox applies it right after answering
    return res.status;
  };
  return {
    url,
    stub,
    PRICE_IDS,
    hook,
    close: async () => {
      child.kill();
      await stub.close();
    },
  };
}
/** The browser's API calls go to another API than the one the site was started with (a call still in flight when its context closes is dropped quietly). */
const sendApiTo = (context, url) =>
  context.route(`${apiBase}/**`, async (route) => {
    try {
      await route.fulfill({ response: await route.fetch({ url: route.request().url().replace(apiBase, url) }) });
    } catch {
      await route.abort().catch(() => {});
    }
  });
/** What the stand-in does when a checkout opens: complete it at the stub, or close the overlay. */
let paddleMode = "complete";
/** window.Paddle as the pages see it: records Environment and Initialize, and "opens" a checkout. */
async function mockPaddle(context) {
  await context.exposeBinding("__paddleOpened", async ({ page }, transactionId) => {
    const name = paddleMode === "close" ? "checkout.closed" : "checkout.completed";
    if (name === "checkout.completed") sandbox.stub.complete(transactionId);
    setTimeout(() => void page.evaluate(([name, id]) => window.__paddle.cb?.({ name, data: { transaction_id: id } }), [name, transactionId]).catch(() => {}), 300);
  });
  await context.addInitScript(() => {
    window.__paddle = { opens: [] };
    window.Paddle = {
      Environment: { set: (env) => (window.__paddle.env = env) },
      Initialize: ({ token, eventCallback }) => Object.assign(window.__paddle, { token, cb: eventCallback }),
      Checkout: {
        open: (opts) => {
          window.__paddle.opens.push(opts);
          window.__paddleOpened(opts.transactionId);
        },
      },
    };
  });
}
/** The admin CLI (reads the root .env itself): credits given or taken by hand. */
const admin = (...args) =>
  spawnSync(process.execPath, [join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });

const stamp = Date.now().toString(36);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name, full = false) => {
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("wrote", name);
};

async function devSignIn(page, email, prompt = "Make an endless runner where a cat jumps over boxes") {
  await page.goto(`${base}/create?prompt=${encodeURIComponent(prompt)}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.locator("#dev-email").waitFor({ timeout: 60_000 });
  await page.fill("#dev-email", email);
  await page.getByRole("button", { name: "Dev sign-in" }).click();
  await page.getByRole("button", { name: "Build my game" }).waitFor({ timeout: 30_000 });
  await page.locator(".make__balance b").waitFor({ timeout: 30_000 });
}

const headerCredits = (page) => page.locator(".account__credits b").innerText();
/** Opens a popover from its button and waits for it to be open. */
const openPop = async (page, button, panel) => {
  await button.click();
  await page.locator(`${panel}:popover-open`).waitFor({ timeout: 5_000 });
  await page.waitForTimeout(220); // the 160 ms entrance
};

const mainEmail = `shots-${stamp}@dev.test`;
const leaverEmail = `leaver-${stamp}@dev.test`;
const buyerEmail = `buyer-${stamp}@dev.test`;
const droidMail = droidEmail(stamp);
const galleryMail = galleryEmail(stamp);
/** Closes a test account through the API (its games, builds and rows go with it); 401 = already closed. */
const closeAccount = (email, at = apiBase) =>
  fetch(`${at}/me`, { method: "DELETE", headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) })
    .then((r) => r.status)
    .catch(() => 0);
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  // ---- Desktop -------------------------------------------------------------------------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));

  await page.goto(`${base}/create?prompt=${encodeURIComponent("Make a tower defence game with cats")}`, {
    waitUntil: "domcontentloaded",
    timeout: 120_000,
  });
  await page.getByRole("button", { name: "Sign in with Google" }).waitFor({ timeout: 60_000 });
  check("signed out: the sentence and Sign in with Google", (await page.locator("#idea").inputValue()).includes("tower defence"));
  await page.waitForTimeout(400);
  await shot(page, "create-signed-out-desktop");

  await devSignIn(page, mainEmail);
  check("signed in: the saved sentence is kept", (await page.locator("#idea").inputValue()).includes("cat jumps"));
  check("free plan: Smart locked", (await page.locator('.model[data-locked] input[value="smart"]').count()) === 1);
  check("free plan: Best locked", (await page.locator('.model[data-locked] input[value="best"]').count()) === 1);
  check("free plan: Fast picked", await page.locator('input[value="fast"]').isChecked());
  const estimate = await page.locator(".make__send .figures").innerText();
  check("estimate next to Build", /about 1\.7 credits/.test(estimate), estimate);
  check("header credits", (await headerCredits(page)) === "20", await headerCredits(page));
  check("effort: Medium by default on /create", await page.locator('input[name="effort-create"][value="medium"]').isChecked());
  await page.locator(".make__effort label", { hasText: "High" }).click();
  await page.waitForFunction(() => /3\.1 credits/.test(document.querySelector(".make__send .figures")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
  check("effort High: the estimate follows (1.7 x 1.8 = 3.1)", /about 3\.1 credits/.test(await page.locator(".make__send .figures").innerText()));
  check("effort High: its honest line", (await page.locator(".make__effort .field-hint").innerText()).startsWith("High effort"));
  await page.getByRole("button", { name: /Puzzle/ }).click();
  check("starter fills the box", (await page.locator("#idea").inputValue()).includes("match-3"));
  await page.getByRole("button", { name: /Runner/ }).click();
  await page.waitForTimeout(300);
  await shot(page, "create-desktop");

  // Build at High effort: on Free that passes the ask-first limit (up to 3.8 credits), so the API
  // answers 409 needs_confirm and the page asks; "Build it" sends it again with confirm: true.
  await page.getByRole("button", { name: "Build my game" }).click();
  await page.locator(".make .ask").waitFor({ timeout: 15_000 });
  check("ask first on /create: the API's real needs_confirm", /3\.8 credits/.test(await page.locator(".make .ask").innerText()), await page.locator(".make .ask").innerText());
  await shot(page, "create-ask-first-desktop");
  await page.getByRole("button", { name: "Build it" }).click();
  await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 30_000 });
  const gameUrl = page.url();
  const gameId = gameUrl.split("/").pop();
  await page.locator(".bubble--live").waitFor({ timeout: 30_000 });
  await page.waitForTimeout(2200);
  const line = await page.locator(".bubble--live").innerText();
  check("live building line", line.length > 3 && line !== "Getting started", line);
  await shot(page, "game-building-desktop");
  await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
  const meta1 = await page.locator(".msg__meta", { hasText: "version 1" }).innerText();
  check("cost under the reply, and the effort it ran at", meta1.includes("1.7 credits") && meta1.includes("high effort"), meta1);
  check("header credits after the build", (await headerCredits(page)) === "18.3", await headerCredits(page));

  // Play (the start screen's picture shows before Play)
  check("the frame shows the start screen's picture", (await page.locator(".gameframe__poster").getAttribute("src"))?.endsWith("/poster.png") === true);
  await page.getByRole("button", { name: /^Play / }).click();
  await page.locator(".gameframe[data-ready]").waitFor({ timeout: 90_000 });
  check("the game plays in the frame", true);
  await page.waitForTimeout(1500);
  await shot(page, "game-desktop");

  // A change -> version 2, the frame reloads and keeps playing
  const firstFrame = await page.locator(".gameframe iframe").getAttribute("src");
  await page.fill("#say", "Make the robot jump higher");
  check("composer defaults to Fast", await page.locator('input[name="switch-edit"][value="fast"]').isChecked());
  check("composer estimate", (await page.locator(".composer__cost").innerText()).includes("0.3"), await page.locator(".composer__cost").innerText());
  check("composer effort: Medium by default", await page.locator('input[name="effort-edit"][value="medium"]').isChecked());
  await page.locator(".composer .effort label", { hasText: "High" }).click();
  await page.waitForFunction(() => /0\.5 credits/.test(document.querySelector(".composer__cost")?.textContent ?? ""), null, { timeout: 10_000 }).catch(() => {});
  check("composer effort High: about 0.5 credits, and its line", (await page.locator(".composer__cost").innerText()).includes("0.5") && (await page.locator("#say-tip").innerText()).startsWith("High effort"));
  await shot(page, "game-effort-desktop");
  await page.locator(".composer .effort label", { hasText: "Medium" }).click();
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByRole("button", { name: "Stop" }).waitFor({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await shot(page, "game-change-building-desktop");
  await page.locator(".msg__meta", { hasText: "version 2" }).waitFor({ timeout: 60_000 });
  await page.locator(".gameframe[data-ready]").waitFor({ timeout: 90_000 });
  const secondFrame = await page.locator(".gameframe iframe").getAttribute("src");
  check("version 2 plays (frame reloaded)", firstFrame !== secondFrame, `${firstFrame} -> ${secondFrame}`);
  check("stage says version 2", (await page.locator(".stage__version").innerText()) === "version 2");

  // A failing change: nothing charged
  const before = await headerCredits(page);
  await page.fill("#say", "Please FAIL this one");
  await page.getByRole("button", { name: "Send" }).click();
  await page.locator(".msg__meta", { hasText: "Didn't work, not charged" }).waitFor({ timeout: 60_000 });
  check("failed message says not charged", true);
  check("credits unchanged after a failure", (await headerCredits(page)) === before, `${before} -> ${await headerCredits(page)}`);

  // Restore version 1 -> version 3
  await page.locator(".version", { hasText: "Version 1" }).getByRole("button", { name: "Restore" }).click();
  await page.waitForTimeout(250);
  await shot(page, "game-restore-ask-desktop");
  await page.locator(".version").getByRole("button", { name: "Restore", exact: true }).first().click();
  await page.locator(".stage__version", { hasText: "version 3" }).waitFor({ timeout: 30_000 });
  check("restore made version 3", (await page.locator(".version").first().innerText()).includes("Restored version 1"));
  await page.locator(".gameframe[data-ready]").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(800);
  await shot(page, "game-after-restore-desktop");

  // Ask first in the chat: the API's 409 is played back here (a real one needs Smart or Best, which
  // the Free plan hasn't got); the real flow is checked on /create above.
  let asked = false;
  await page.route("**/projects/*/messages", async (route) => {
    if (asked || route.request().method() !== "POST") return route.continue();
    asked = true;
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "needs_confirm", message: "This could cost up to 30 credits. Send it again to confirm." }),
    });
  });
  await page.fill("#say", "Turn it into a 3D open world with 20 levels");
  await page.getByRole("button", { name: "Send" }).click();
  await page.locator(".composer .ask").waitFor({ timeout: 10_000 });
  check("ask first shows inline", (await page.locator(".composer .ask").innerText()).includes("Send it"));
  await shot(page, "game-ask-first-desktop");
  await page.getByRole("button", { name: "Not now" }).click();
  await page.unroute("**/projects/*/messages");
  await page.fill("#say", "");

  // Rename from the game's menu
  await openPop(page, page.getByRole("button", { name: /^More: rename/ }), `#game-menu-${gameId}`);
  await shot(page, "game-menu-desktop");
  await page.locator(".menu__list button", { hasText: "Rename" }).click();
  await page.locator("#rename").waitFor({ timeout: 5_000 });
  await page.fill("#rename", "Cat Box Jumper");
  await shot(page, "game-rename-desktop");
  await page.press("#rename", "Enter");
  await page.locator(".stage__name", { hasText: "Cat Box Jumper" }).waitFor({ timeout: 10_000 });
  check("rename: the bar shows the new name", true);

  // Download the project from the menu
  await openPop(page, page.getByRole("button", { name: /^More: rename/ }), `#game-menu-${gameId}`);
  const [zip] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    page.locator(".menu__list button", { hasText: "Download the project" }).click(),
  ]);
  const zipPath = await zip.path();
  const zipBytes = zipPath ? readFileSync(zipPath) : Buffer.alloc(0);
  check("download: cat-box-jumper.zip", zip.suggestedFilename() === "cat-box-jumper.zip" && zipBytes.subarray(0, 2).toString() === "PK", zip.suggestedFilename());
  check("download: README.txt and project.godot inside", zipBytes.includes(Buffer.from("cat-box-jumper/README.txt")) && zipBytes.includes(Buffer.from("cat-box-jumper/project.godot")));

  // Share: private by default; turn it on, the link and the public page
  const shareButton = page.getByRole("button", { name: /^(Share this game|Shared: change sharing)$/ });
  await openPop(page, shareButton, `#share-${gameId}`);
  check("share: private by default", (await page.getByRole("switch", { name: "Share this game" }).getAttribute("aria-checked")) === "false");
  await shot(page, "game-share-off-desktop");
  await page.getByRole("switch", { name: "Share this game" }).click();
  await page.locator(".share__link input").waitFor({ timeout: 10_000 });
  const shareLink = await page.locator(".share__link input").inputValue();
  check("share: the link to the public page", shareLink.endsWith(`/play/${gameId}`), shareLink);
  await page.waitForTimeout(250);
  await shot(page, "game-share-on-desktop");
  await page.keyboard.press("Escape");

  // The public page, signed out
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const v = await visitor.newPage();
  v.on("pageerror", (e) => console.log("page error (visitor):", e.message));
  const playUrl = `${base}/play/${gameId}`;
  const res = await v.goto(playUrl, { waitUntil: "domcontentloaded", timeout: 120_000 });
  check("public page: 200 for anyone with the link", res?.status() === 200, String(res?.status()));
  await v.locator(".play__name").waitFor({ timeout: 30_000 });
  check("public page: the name and Made with TypePlay", (await v.locator(".play__name").innerText()) === "Cat Box Jumper" && (await v.locator(".play__by").innerText()) === "Made with TypePlay");
  check("public page: Make your own goes to /create", (await v.getByRole("link", { name: "Make your own" }).getAttribute("href")) === "/create");
  check("public page: kept out of search (noindex)", (await v.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex") === true);
  check("public page: its title", (await v.title()) === "Cat Box Jumper | TypePlay", await v.title());
  const ogUrl = await v.locator('meta[property="og:image"]').getAttribute("content");
  const og = ogUrl ? await v.request.get(base + new URL(ogUrl).pathname + new URL(ogUrl).search) : null;
  check("public page: link preview picture (1200x630 PNG)", og?.status() === 200 && og.headers()["content-type"] === "image/png", ogUrl ?? "none");
  await v.waitForTimeout(800);
  await shot(v, "play-desktop", true);
  await v.getByRole("button", { name: /^Play / }).click();
  await v.locator(".gameframe[data-ready]").waitFor({ timeout: 90_000 });
  check("public page: the game plays", true);
  await v.waitForTimeout(1200);
  await shot(v, "play-playing-desktop");

  // Your games: Manage
  await page.goto(`${base}/games`, { waitUntil: "domcontentloaded" });
  await page.locator(".mine__grid a.app").first().waitFor({ timeout: 30_000 });
  check("games list shows the game", (await page.locator(".mine__grid a.app").count()) === 1);
  check("games list: the icon is the game's start screen", (await page.locator(".mine__grid a.app img").getAttribute("src"))?.endsWith("/poster.png") === true);
  await page.waitForTimeout(500);
  await shot(page, "games-desktop");
  await page.getByRole("button", { name: "Manage" }).click();
  await page.locator(".manage__row").first().waitFor({ timeout: 10_000 });
  check("manage: the row says shared", (await page.locator(".manage__meta").first().innerText()).includes("shared"));
  await shot(page, "games-manage-desktop");
  await page.getByRole("button", { name: "Delete Cat Box Jumper" }).click();
  await page.waitForTimeout(200);
  await shot(page, "games-manage-delete-ask-desktop");
  await page.getByRole("button", { name: "Keep it" }).click();
  check("manage: Keep it keeps the game", (await page.locator(".manage__row").count()) === 1);

  // Account menu, then the account page
  await page.locator(".account__me").click();
  await page.waitForTimeout(300);
  await shot(page, "account-menu-desktop");
  await page.keyboard.press("Escape");
  await page.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await page.locator(".usage__row:not(.usage__row--ghost)").first().waitFor({ timeout: 30_000 });
  const rows = await page.locator(".usage__row").allInnerTexts();
  check("account: the credit history (2 charges, the Free plan grant; the failed change cost nothing)", rows.length === 3 && rows.at(-1).includes("Free plan credits") && rows.at(-1).includes("+20"), String(rows.length));
  check("account: charges name the game and what ran", rows[0].includes("Change on Fast") && rows[0].includes("Cat Box Jumper") && rows[0].includes("1.7"));
  check("account: email and plan", (await page.locator(".acct__who").innerText()).includes(mainEmail) && (await page.locator(".acct__facts").innerText()).includes("Free"));
  check("account: Plan and billing links to /billing", (await page.getByRole("link", { name: "Plan and billing" }).getAttribute("href")) === "/billing");
  await shot(page, "account-desktop", true);
  const [dataFile] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByRole("button", { name: "Download my data" }).click()]);
  const dataPath = await dataFile.path();
  const data = dataPath ? JSON.parse(readFileSync(dataPath, "utf8")) : {};
  check("download my data: a JSON file with the account and the game", data.account?.email === mainEmail && data.games?.[0]?.name === "Cat Box Jumper" && data.games[0].messages.length === 6, dataFile.suggestedFilename());
  await page.getByRole("button", { name: "Delete my account" }).click();
  await page.locator("#confirm-delete").waitFor({ timeout: 5_000 });
  await page.fill("#confirm-delete", "delete");
  check("delete account: asks for DELETE (lower case is not enough)", await page.getByRole("button", { name: "Delete everything" }).isDisabled());
  await page.fill("#confirm-delete", "DELETE");
  check("delete account: DELETE unlocks the button", await page.getByRole("button", { name: "Delete everything" }).isEnabled());
  await shot(page, "account-delete-ask-desktop", true);
  await page.getByRole("button", { name: "Keep my account" }).click();
  await page.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
  await page.locator(".make__lead", { hasText: "You are on Free" }).waitFor({ timeout: 30_000 });
  check("billing: says the plan, and how credits work in the beta", (await page.locator(".make__lead").innerText()).includes("added by hand"));
  await page.waitForTimeout(300);
  await shot(page, "billing-desktop");
  await page.goto(`${base}/billing/checkout?item=pack`, { waitUntil: "domcontentloaded" });
  await page.locator(".make__lead", { hasText: "opens here soon" }).waitFor({ timeout: 60_000 });
  check("checkout with billing off: says it opens here soon, nothing else", (await page.locator("h1").innerText()) === "Credit pack.");

  // ---- Billing with payments on: a sandbox API of our own, pointed at the Paddle stub ---------
  console.log(`billing with payments on (a sandbox API on :${SANDBOX_PORT} + the Paddle stub)`);
  sandbox = await startSandboxApi();
  const sbApi = (method, path, body) =>
    fetch(`${sandbox.url}${path}`, { method, headers: { Authorization: `Bearer dev:${buyerEmail}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  const shop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await sendApiTo(shop, sandbox.url);
  await mockPaddle(shop);
  await shop.route("https://customer-portal.paddle.test/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>Paddle portal (stub)</title>" }));
  const b = await shop.newPage();
  b.on("pageerror", (e) => console.log("page error (buyer):", e.message));
  await devSignIn(b, buyerEmail);
  check("the buyer's calls reach the sandbox API (GET /me says billing sandbox)", (await sbApi("GET", "/me")).body?.billing?.mode === "sandbox");
  await b.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
  // The plan card (billing on), or the beta text (no token in the build); never the loading state in between.
  await b.locator(".bill__planname, .make__lead:has-text('opens here soon')").first().waitFor({ timeout: 60_000 });
  const paddleOnSite = (await b.locator(".bill__planname").count()) === 1;
  check("the site carries a Paddle client token (start it with NEXT_PUBLIC_PADDLE_ENV=sandbox NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_shots)", paddleOnSite);
  if (paddleOnSite) {
    // The Free plan card and the picker
    const freeCard = await b.locator(".bill__plan").innerText();
    check("billing on Free: the plan card", (await b.locator(".bill__planname").innerText()) === "Free" && /20 credits a month, up to 5 a day, on Fast\./.test(freeCard), freeCard);
    const freeLine = await b.locator(".bill__credits").innerText();
    check("billing on Free: left, today, and when 20 more come", /^20 left, 5 more today\. 20 more on \d+ \w+\.$/.test(freeLine), freeLine);
    check("billing on Free: no payments yet", (await b.locator(".usage__empty").innerText()) === "No payments yet.");
    await b.waitForTimeout(300);
    await shot(b, "billing-free-desktop", true);
    await b.getByRole("button", { name: "Get a plan" }).click();
    await b.locator(".picker").waitFor({ timeout: 10_000 });
    const rowsFree = await b.locator(".picker__action").allInnerTexts();
    check("the picker on Free: Get Medium / High / Ultra / Ultra+", rowsFree.join("|") === "Get Medium|Get High|Get Ultra|Get Ultra+", rowsFree.join("|"));
    check("the picker: Get Medium goes to the checkout and back here", (await b.getByRole("link", { name: "Get Medium" }).getAttribute("href")) === "/billing/checkout?item=plan:medium&back=%2Fbilling");
    await shot(b, "billing-picker-free-desktop", true);

    // /pricing → Get Medium → /create?plan=medium → the checkout page
    await b.goto(`${base}/pricing`, { waitUntil: "domcontentloaded" });
    await b.getByRole("link", { name: "Get Medium" }).click();
    await b.waitForURL(/\/billing\/checkout\?item=plan:medium/, { timeout: 60_000 });
    check("pricing's Get Medium: /create?plan=medium sends a signed-in user on to the checkout", true);
    await b.locator(".consent input").waitFor({ timeout: 60_000 });
    const sum = await b.locator(".checkout__sum").innerText();
    check("checkout: the title and the sum", (await b.getByRole("heading", { level: 1 }).innerText()) === "Get Medium." && sum === "$20 a month, plus tax where it applies. Renews every month until you cancel. 100 credits a month; unused ones carry over once, up to 100.", sum);
    check("checkout: the tick box carries wording v1", (await b.locator(".consent span").innerText()) === "Start now: I ask TypePlay to begin right away. If I withdraw within 14 days, I pay for the credits I've used. Once all credits from this purchase are used, I can no longer withdraw.");
    check("checkout: the acceptance line links the terms and the refund policy", (await b.locator(".checkout__accept a").evaluateAll((as) => as.map((a) => a.getAttribute("href")).join("|"))) === "/terms|/refunds");
    const cont = b.getByRole("button", { name: "Continue to payment" });
    check("checkout: Continue waits for the tick", await cont.isDisabled());
    await b.locator(".consent input").check();
    check("checkout: ticked, Continue is live", await cont.isEnabled());
    await shot(b, "checkout-plan-desktop");
    await cont.click();
    await b.locator(".checkout__paid").waitFor({ timeout: 30_000 });
    check(
      "checkout: Paddle opened as an overlay, in the sandbox, with the client token and a txn_ id",
      await b.evaluate(() => {
        const p = window.__paddle;
        const o = p.opens[0];
        return p.env === "sandbox" && p.token === "test_shots" && /^txn_/.test(o?.transactionId ?? "") && o.settings.displayMode === "overlay" && o.settings.theme === "light" && o.settings.locale === "en" && o.settings.allowLogout === false;
      }),
    );
    const txnCall = sandbox.stub.callsTo("POST", /^\/transactions$/).at(-1);
    check("the API opened the transaction with the item and the consent", txnCall?.body.custom_data.item === "plan:medium" && txnCall.body.custom_data.consentVersion === "v1" && txnCall.body.items[0].price_id === sandbox.PRICE_IDS.medium);
    check("checkout: 'Paid. Adding your credits…' while the credits land", (await b.locator(".checkout__paid").innerText()).includes("Paid. Adding your credits"));
    await shot(b, "checkout-paid-desktop");
    // No webhook comes from the stub: at 20 s the page asks the API to verify, which pulls the transaction.
    await b.locator("main[data-done]").waitFor({ timeout: 40_000 });
    check("checkout done through the 20 s verify: You're on Medium, 100 credits added", (await b.getByRole("heading", { level: 1 }).innerText()) === "You're on Medium." && /100 credits added/.test(await b.locator(".make__lead").innerText()));
    check("checkout done: Make a game (no back link) and Plan and billing", (await b.getByRole("link", { name: "Make a game" }).getAttribute("href")) === "/create");
    await b.waitForFunction(() => document.querySelector(".account__credits b")?.textContent === "120", null, { timeout: 15_000 }).catch(() => {});
    check("header credits after the plan: 120", (await headerCredits(b)) === "120", await headerCredits(b));
    await shot(b, "checkout-done-desktop");

    // A closed overlay charges nothing; then the pack, confirmed by a webhook this time.
    await b.goto(`${base}/billing/checkout?item=pack&back=%2Fbilling`, { waitUntil: "domcontentloaded" });
    await b.locator(".consent input").waitFor({ timeout: 60_000 });
    check("the pack's checkout: its sum", (await b.getByRole("heading", { level: 1 }).innerText()) === "Credit pack." && (await b.locator(".checkout__sum").innerText()) === "Add 40 credits. $10 plus tax. Good for 12 months; used after your plan credits.");
    await b.locator(".consent input").check();
    paddleMode = "close";
    await b.getByRole("button", { name: "Continue to payment" }).click();
    await b.locator(".checkout__note").waitFor({ timeout: 15_000 });
    check("overlay closed before paying: 'Nothing was charged.'", (await b.locator(".checkout__note").innerText()) === "Nothing was charged." && (await headerCredits(b)) === "120");
    await shot(b, "checkout-closed-desktop");
    paddleMode = "complete";
    await b.getByRole("button", { name: "Continue to payment" }).click();
    await b.locator(".checkout__paid").waitFor({ timeout: 15_000 });
    const packTxn = [...sandbox.stub.state.transactions.values()].filter((t) => t.status === "completed").at(-1);
    check("the pack's transaction completed at the stub", /^txn_/.test(packTxn?.id ?? "") && packTxn.items[0].price.id === sandbox.PRICE_IDS.pack);
    check("the webhook transaction.completed is taken (200)", (await sandbox.hook("transaction.completed", packTxn)) === 200);
    await b.locator("main[data-done]").waitFor({ timeout: 15_000 });
    check("the pack lands through the webhook within seconds: '40 credits added'", (await b.getByRole("heading", { level: 1 }).innerText()) === "Credits added." && /40 credits added/.test(await b.locator(".make__lead").innerText()));
    await b.waitForFunction(() => document.querySelector(".account__credits b")?.textContent === "160", null, { timeout: 15_000 }).catch(() => {});
    check("header credits after the pack: 160", (await headerCredits(b)) === "160", await headerCredits(b));

    // The billing page on a paid plan
    await b.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
    await b.locator(".bill__planname").waitFor({ timeout: 60_000 });
    const paidCard = await b.locator(".bill__plan").innerText();
    check("billing on Medium: the plan, its price and the next payment with the card", (await b.locator(".bill__planname").innerText()) === "Medium" && /\$20 a month\./.test(paidCard) && /Next payment \d+ \w+: \$20 plus tax, Visa ending 4242\./.test(paidCard), paidCard.replace(/\n/g, " | "));
    const creditsLine = await b.locator(".bill__credits").innerText();
    check("billing on Medium: credits to spend, by part", /^160 credits to spend: 20 free \(until \d+ \w+\), 100 from Medium \(carry over to \d+ \w+, up to 100\) and 40 from a pack \(until \d+ \w+ \d{4}\)\.$/.test(creditsLine), creditsLine);
    const pays = await b.locator(".pays__row").allInnerTexts();
    check("billing: two payments, newest first, with tax, the invoice and the refund window", pays.length === 2 && /Credit pack/.test(pays[0]) && /\$11\.00/.test(pays[0]) && /\$10 \+ \$1 tax/.test(pays[0]) && /Medium plan/.test(pays[1]) && /\$22\.00/.test(pays[1]) && /invoice TP-/.test(pays[1]) && /paid, refundable until \d+ \w+/.test(pays[1]), pays.join(" || ").replace(/\n/g, " "));
    const consentLine = await b.locator("[data-consent]").innerText();
    check("billing: the consent record", /^On \d+ \w+ you asked us to start right away \(wording v1\)\.$/.test(consentLine), consentLine);
    check("billing: Buy a credit pack / Change plan / Cancel plan", (await b.locator(".bill__plan .acct__buttons").innerText()).replace(/\s+/g, " ").trim() === "Buy a credit pack Change plan Cancel plan");
    await b.waitForTimeout(300);
    await shot(b, "billing-paid-desktop", true);

    // Upgrade: the preview line, then the change; the credits arrive with Paddle's transaction
    await b.getByRole("button", { name: "Change plan" }).click();
    await b.locator(".picker").waitFor({ timeout: 10_000 });
    const rowsPaid = await b.locator(".picker__action").allInnerTexts();
    check("the picker on Medium: Your plan, then Upgrade", rowsPaid.join("|") === "Your plan|Upgrade|Upgrade|Upgrade", rowsPaid.join("|"));
    await b.locator(".picker__row", { hasText: "High" }).getByRole("button", { name: "Upgrade" }).click();
    await b.locator(".picker__preview p", { hasText: "You pay" }).waitFor({ timeout: 15_000 });
    const previewLine = await b.locator(".picker__preview p").innerText();
    check("the upgrade preview line", /^You pay \$16\.50 now \(tax included\), charged to Visa ending 4242, and get about 87\.5 credits now; then \$50 a month from \d+ \w+\.$/.test(previewLine), previewLine);
    await shot(b, "billing-upgrade-preview-desktop", true);
    await b.getByRole("button", { name: "Upgrade to High" }).click();
    await b.locator(".picker__preview p", { hasText: "Done." }).waitFor({ timeout: 15_000 });
    check(
      "upgrade applied: Paddle PATCHed (prorated now), the page says the credits are on their way",
      /Paddle is charging Visa ending 4242 \$16\.50 now; 87\.5 credits arrive within a minute/.test(await b.locator(".picker__preview p").innerText()) && sandbox.stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.proration_billing_mode === "prorated_immediately",
    );
    const planTxn = [...sandbox.stub.state.transactions.values()].find((t) => t.subscription_id);
    const upTxn = sandbox.stub.makeTransaction({ origin: "subscription_update", customerId: planTxn.customer_id, subscriptionId: planTxn.subscription_id, customData: planTxn.custom_data, lines: [{ price_id: sandbox.PRICE_IDS.high, rate: 0.5 }, { price_id: sandbox.PRICE_IDS.medium, rate: 0.5, negative: true }] });
    await sandbox.hook("transaction.completed", upTxn);
    await b.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
    await b.locator(".bill__planname", { hasText: "High" }).waitFor({ timeout: 60_000 });
    await b.waitForFunction(() => document.querySelector(".account__credits b")?.textContent === "247.5", null, { timeout: 15_000 }).catch(() => {});
    check("after Paddle's upgrade transaction: High, 247.5 credits, 'Upgrade to High' in the payments", (await headerCredits(b)) === "247.5" && /Upgrade to High/.test(await b.locator(".pays").innerText()), await headerCredits(b));

    // Downgrade at renewal: the preview, the strip, Keep High
    await b.getByRole("button", { name: "Change plan" }).click();
    await b.locator(".picker__row", { hasText: "Medium" }).getByRole("button", { name: "Switch at renewal" }).click();
    await b.locator(".picker__preview p", { hasText: "Nothing now" }).waitFor({ timeout: 15_000 });
    const downLine = await b.locator(".picker__preview p").innerText();
    check("the downgrade preview line", /^Nothing now\. From \d+ \w+ you pay \$20 a month and get 100 credits a month; High and all its credits stay until then\.$/.test(downLine), downLine);
    await b.getByRole("button", { name: "Switch to Medium" }).click();
    await b.locator('[data-strip="downgrade"]').waitFor({ timeout: 15_000 });
    const downStrip = await b.locator('[data-strip="downgrade"] p').innerText();
    check("the downgrade strip", /^You move to Medium on \d+ \w+\. Until then High and all its credits stay\.$/.test(downStrip), downStrip);
    await b.waitForTimeout(300);
    await shot(b, "billing-downgrade-strip-desktop", true);
    await b.getByRole("button", { name: "Keep High" }).click();
    await b.locator('[data-strip="downgrade"]').waitFor({ state: "detached", timeout: 15_000 });
    check("Keep High: the strip is gone, Paddle PATCHed back to High", sandbox.stub.callsTo("PATCH", /^\/subscriptions\/sub_[^/]+$/).at(-1)?.body.items[0].price_id === sandbox.PRICE_IDS.high);

    // Cancel: asks first, then the strip, then Keep my plan
    await b.getByRole("button", { name: "Cancel plan" }).click();
    await b.locator(".bill__ask").waitFor({ timeout: 10_000 });
    const cancelAsk = await b.locator(".bill__ask p").innerText();
    check("Cancel plan asks first", /^Cancel at the end of your period\? High and its credits stay until \d+ \w+; pack credits keep working for their 12 months\.$/.test(cancelAsk), cancelAsk);
    await shot(b, "billing-cancel-ask-desktop", true);
    await b.locator(".bill__ask").getByRole("button", { name: "Cancel plan" }).click();
    await b.locator('[data-strip="cancel"]').waitFor({ timeout: 15_000 });
    const cancelStrip = await b.locator('[data-strip="cancel"] p').innerText();
    check("the cancel strip", /^Your plan ends on \d+ \w+\. Your credits stay until then; pack credits keep working for their 12 months\.$/.test(cancelStrip), cancelStrip);
    check("while cancelled: 'Ends on …' and no Cancel plan button", /Ends on \d+ \w+\./.test(await b.locator(".bill__plan").innerText()) && (await b.locator(".bill__plan").getByRole("button", { name: "Cancel plan" }).count()) === 0);
    await shot(b, "billing-cancel-strip-desktop", true);
    await b.getByRole("button", { name: "Keep my plan" }).click();
    await b.locator('[data-strip="cancel"]').waitFor({ state: "detached", timeout: 15_000 });
    check("Keep my plan: the strip is gone, Cancel plan is back", (await b.locator(".bill__plan").getByRole("button", { name: "Cancel plan" }).count()) === 1);

    // The portal: a fresh link in a new tab
    const [portalTab] = await Promise.all([shop.waitForEvent("page", { timeout: 15_000 }), b.getByRole("button", { name: "Invoices and receipts" }).click()]);
    await portalTab.waitForURL(/customer-portal\.paddle\.test/, { timeout: 15_000 });
    check("Invoices and receipts opens Paddle's portal (a fresh link) in a new tab", /customer-portal\.paddle\.test\/ctm_.*overview/.test(portalTab.url()) && sandbox.stub.callsTo("POST", /\/portal-sessions$/).length >= 1, portalTab.url());
    await portalTab.close();

    // The account page with a plan: renews, and closing cancels it
    await b.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
    await b.locator(".acct__facts").waitFor({ timeout: 60_000 }); // rendered once GET /me answered
    check("account on High: 'Renews on …'", /Renews on \d+ \w+\./.test(await b.locator(".acct__plan").innerText()), (await b.locator(".acct__plan").innerText()).replace(/\n/g, " | "));
    await b.getByRole("button", { name: "Delete my account" }).click();
    await b.locator("#confirm-delete").waitFor({ timeout: 5_000 });
    check("account: closing says the plan is cancelled with it", /Your High plan is still active: it is cancelled when the account closes\./.test(await b.locator(".acct__confirm").innerText()));
    await shot(b, "account-paid-delete-ask-desktop", true);

    // The game page on a paid plan: out of credits (planted with the admin CLI), then past due
    await b.goto(`${base}/create?prompt=${encodeURIComponent("Make a puzzle game with frogs")}`, { waitUntil: "domcontentloaded" });
    await b.getByRole("button", { name: "Build my game" }).waitFor({ timeout: 60_000 });
    await b.locator(".make__balance b").waitFor({ timeout: 30_000 });
    await b.getByRole("button", { name: "Build my game" }).click();
    await b.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 30_000 });
    const buyerGame = b.url().split("/").pop();
    // The routed context buffers the live-update stream (route.fetch waits for the whole body), so the
    // build's end is read from the sandbox API itself, then the page is loaded again.
    for (let i = 0; i < 300 && (await sbApi("GET", `/projects/${buyerGame}`)).body?.status !== "idle"; i++) await b.waitForTimeout(300);
    await b.reload({ waitUntil: "domcontentloaded" });
    await b.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
    await b.waitForFunction(() => document.querySelector(".account__credits b")?.textContent !== "…", null, { timeout: 15_000 }).catch(() => {});
    const buyerLeft = await headerCredits(b);
    const taken = admin("grant", buyerEmail, `-${buyerLeft.replace(/,/g, "")}`, "shots: out of credits");
    check("admin grant takes the buyer's credits away (0 left)", taken.status === 0 && (await sbApi("GET", "/me")).body?.credits.available === 0, taken.stderr.slice(-300));
    await b.reload({ waitUntil: "domcontentloaded" });
    await b.locator("#say").waitFor({ timeout: 60_000 });
    await b.fill("#say", "Make the frogs bigger");
    await b.getByRole("button", { name: "Send" }).click();
    await b.locator('[data-panel="no_credits"]').waitFor({ timeout: 15_000 });
    const paidPanel = await b.locator('[data-panel="no_credits"] p').innerText();
    check("out of credits on High: the panel", /^You're out of credits until \d+ \w+\. Add 40 for \$10 now, or move up to Ultra \(600 a month\)\.$/.test(paidPanel), paidPanel);
    check(
      "its buttons: Add 40 credits, $10 (to the checkout and back to this game), Upgrade, Not now",
      (await b.locator('[data-panel="no_credits"] a', { hasText: "Add 40 credits" }).getAttribute("href")) === `/billing/checkout?item=pack&back=%2Fgames%2F${buyerGame}` && (await b.locator('[data-panel="no_credits"] a', { hasText: "Upgrade" }).getAttribute("href")) === "/billing?change=1",
    );
    await shot(b, "game-out-of-credits-paid-desktop");
    await b.getByRole("button", { name: "Not now" }).click();
    await b.route(`${apiBase}/me`, async (route) => {
      const res = await route.fetch({ url: `${sandbox.url}/me` });
      const me = await res.json();
      me.billing.status = "past_due";
      await route.fulfill({ response: res, json: me });
    });
    await b.reload({ waitUntil: "domcontentloaded" });
    await b.locator('[data-strip="past-due"]').waitFor({ timeout: 60_000 });
    const pastDue = await b.locator('[data-strip="past-due"] p').innerText();
    check("past due: the strip above the composer", /^Your \d+ \w+ payment for High didn't go through\. Update your card and Paddle will try again for up to 30 days\. You keep your credits until a day after your period ends; no new ones until a payment goes through\.$/.test(pastDue), pastDue);
    check("past due: Update card goes to /billing", (await b.locator('[data-strip="past-due"] a').getAttribute("href")) === "/billing");
    await shot(b, "game-past-due-desktop");
    await b.unroute(`${apiBase}/me`);

    // Phones, and the narrowest ones: the billing page with the picker open, and the checkout
    const shopPhone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await sendApiTo(shopPhone, sandbox.url);
    await mockPaddle(shopPhone);
    const bp = await shopPhone.newPage();
    bp.on("pageerror", (e) => console.log("page error (buyer, phone):", e.message));
    await devSignIn(bp, buyerEmail);
    await bp.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
    await bp.locator(".bill__planname").waitFor({ timeout: 60_000 });
    await bp.getByRole("button", { name: "Change plan" }).click();
    await bp.locator(".picker").waitFor({ timeout: 10_000 });
    await bp.waitForTimeout(400);
    await shot(bp, "billing-phone", true);
    await bp.goto(`${base}/billing/checkout?item=pack&back=%2Fbilling`, { waitUntil: "domcontentloaded" });
    await bp.locator(".consent input").waitFor({ timeout: 60_000 });
    await bp.waitForTimeout(300);
    await shot(bp, "checkout-phone", true);
    await bp.setViewportSize({ width: 320, height: 640 });
    await bp.waitForTimeout(300);
    check("checkout at 320 px: nothing wider than the screen", await bp.evaluate(() => document.documentElement.scrollWidth <= 320));
    await shot(bp, "checkout-320", true);
    await bp.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
    await bp.locator(".bill__planname").waitFor({ timeout: 60_000 });
    await bp.getByRole("button", { name: "Change plan" }).click();
    await bp.locator(".picker").waitFor({ timeout: 10_000 });
    await bp.waitForTimeout(300);
    check("billing at 320 px: nothing wider than the screen", await bp.evaluate(() => document.documentElement.scrollWidth <= 320));
    await shot(bp, "billing-320", true);
    await shopPhone.unrouteAll({ behavior: "ignoreErrors" });
    await shopPhone.close();
  }
  await shop.unrouteAll({ behavior: "ignoreErrors" });
  await shop.close();
  const buyerClosed = await sbApi("DELETE", "/me", { confirm: "DELETE" });
  check("the buyer's account closes through the sandbox API (its plan cancelled at the stub first)", buyerClosed.status === 200 && sandbox.stub.callsTo("POST", /\/cancel$/).at(-1)?.body.effective_from === "immediately", JSON.stringify(buyerClosed.body));

  // ---- The game page on Free: this month's credits used, the daily limit, the kill switch, a hold ----
  const mainLeft = await headerCredits(page);
  const takenMain = admin("grant", mainEmail, `-${mainLeft.replace(/,/g, "")}`, "shots: out of credits");
  check("admin grant empties the main user's free credits", takenMain.status === 0, takenMain.stderr.slice(-300));
  await page.goto(gameUrl, { waitUntil: "domcontentloaded" });
  await page.locator("#say").waitFor({ timeout: 60_000 });
  await page.waitForFunction(() => document.querySelector(".account__credits b")?.textContent === "0", null, { timeout: 15_000 }).catch(() => {});
  await page.fill("#say", "Make the cat faster");
  await page.getByRole("button", { name: "Send" }).click();
  await page.locator('[data-panel="no_credits"]').waitFor({ timeout: 15_000 });
  const freePanel = await page.locator('[data-panel="no_credits"] p').innerText();
  check("out of credits on Free: the panel", /^You've used this month's free credits\. 20 more arrive on \d+ \w+\. Or get Medium: 100 credits a month, Smart and Best, no daily cap\.$/.test(freePanel), freePanel);
  check("its button: Get Medium, $20 a month, back to this game", (await page.locator('[data-panel="no_credits"] a').getAttribute("href")) === `/billing/checkout?item=plan:medium&back=%2Fgames%2F${gameId}`);
  await shot(page, "game-out-of-credits-free-desktop");
  await page.getByRole("button", { name: "Not now" }).click();
  const playedBack = [
    ["daily_limit", 402, /^Today's 5 free credits are used\. More in (about \d+ hours|about an hour|less than an hour), or get Medium: no daily cap\.$/],
    ["free_paused", 402, /^Free builds are paused; they start again in (about \d+ hours|about an hour|less than an hour): today's free allowance is used up across TypePlay\. Get a plan to keep going\.$/],
    ["billing_hold", 403, /^A payment was disputed with your bank\. Buying is paused; write to hello@typeplay\.app\.$/],
  ];
  for (const [code, status, text] of playedBack) {
    await page.route("**/projects/*/messages", (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: code, message: "played back" }) }));
    await page.fill("#say", "Make the cat faster");
    await page.getByRole("button", { name: "Send" }).click();
    await page.locator(`[data-panel="${code}"]`).waitFor({ timeout: 15_000 });
    const panelText = await page.locator(`[data-panel="${code}"] p`).innerText();
    check(`${code}: the panel`, text.test(panelText), panelText);
    await shot(page, `game-${code.replace("_", "-")}-desktop`);
    await page.getByRole("button", { name: "Not now" }).click();
    await page.unroute("**/projects/*/messages");
  }

  // ---- Android export (scripts/shot-android.mjs; the API must run with ANDROID_EXPORT=1 ANDROID_FAKE=1) ----
  console.log("Android export");
  await androidPart({ browser, base, apiBase, email: droidMail, check, shot, devSignIn, admin, stamp });

  // ---- The public gallery (scripts/shot-gallery.mjs): the Share menu's second switch, plays, /explore, reports ----
  console.log("the public gallery");
  await galleryPart({ browser, base, apiBase, email: galleryMail, check, shot, devSignIn, admin, stamp });

  // ---- Phone ---------------------------------------------------------------------------------
  const phone = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const p = await phone.newPage();
  p.on("pageerror", (e) => console.log("page error (phone):", e.message));
  await devSignIn(p, mainEmail);
  await p.waitForTimeout(400);
  await shot(p, "create-phone", true);
  await p.goto(gameUrl, { waitUntil: "domcontentloaded" });
  await p.locator(".ws__tabs").waitFor({ timeout: 30_000 });
  await p.waitForTimeout(800);
  check("phone opens on Play when there is a game", (await p.locator('.ws__tab[aria-selected="true"]').innerText()).startsWith("Play"));
  await shot(p, "game-play-phone");
  await openPop(p, p.getByRole("button", { name: /^(Share this game|Shared: change sharing)$/ }), `#share-${gameId}`);
  await shot(p, "game-share-phone");
  await p.keyboard.press("Escape");
  await openPop(p, p.getByRole("button", { name: /^More: rename/ }), `#game-menu-${gameId}`);
  check("phone: Play in a new tab moves into the menu", await p.locator(".menu__newtab").isVisible());
  await shot(p, "game-menu-phone");
  await p.keyboard.press("Escape");
  await p.getByRole("tab", { name: "Chat" }).click();
  await p.waitForTimeout(400);
  await shot(p, "game-chat-phone");
  await p.goto(`${base}/games`, { waitUntil: "domcontentloaded" });
  await p.locator(".mine__grid a.app").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(400);
  await shot(p, "games-phone");
  await p.getByRole("button", { name: "Manage" }).click();
  await p.locator(".manage__row").first().waitFor({ timeout: 10_000 });
  await shot(p, "games-manage-phone");
  await p.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await p.locator(".usage__row:not(.usage__row--ghost)").first().waitFor({ timeout: 30_000 });
  await p.waitForTimeout(300);
  await shot(p, "account-phone", true);
  const pv = await phone.newPage(); // the public page on a phone: still shared
  await pv.goto(playUrl, { waitUntil: "domcontentloaded" });
  await pv.locator(".play__name").waitFor({ timeout: 30_000 });
  await pv.waitForTimeout(600);
  await shot(pv, "play-phone", true);
  await phone.close();

  // Unshare: the public page is gone at once
  await page.goto(gameUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".stage__name").waitFor({ timeout: 30_000 });
  await openPop(page, page.getByRole("button", { name: /^(Share this game|Shared: change sharing)$/ }), `#share-${gameId}`);
  await page.getByRole("switch", { name: "Share this game" }).click();
  await page.locator('[role="switch"][aria-checked="false"]').waitFor({ timeout: 10_000 });
  await page.keyboard.press("Escape");
  const gone = await v.goto(playUrl, { waitUntil: "domcontentloaded" });
  check("after unsharing: the public page is a 404", gone?.status() === 404, String(gone?.status()));
  await v.locator("h1").waitFor({ timeout: 30_000 });
  check("after unsharing: it says the game isn't here", (await v.locator("h1").innerText()).startsWith("This game isn"));
  await shot(v, "play-gone-desktop");
  const ogGone = ogUrl ? await v.request.get(base + new URL(ogUrl).pathname) : null;
  check("after unsharing: no link preview either (404)", ogGone?.status() === 404, String(ogGone?.status()));
  await visitor.close();

  // Delete the game from Manage
  await page.goto(`${base}/games`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Delete Cat Box Jumper" }).click();
  await page.getByRole("button", { name: "Delete game" }).click();
  await page.locator(".mine__empty").waitFor({ timeout: 30_000 });
  check("manage: Delete game removes it (no games left)", (await page.locator(".manage__row").count()) === 0);
  await page.waitForTimeout(300);
  await shot(page, "games-empty-after-delete-desktop");
  await ctx.close();

  // ---- Close an account for good (a second test user) ----------------------------------------
  const leaver = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const l = await leaver.newPage();
  await devSignIn(l, leaverEmail);
  await l.goto(`${base}/account`, { waitUntil: "domcontentloaded" });
  await l.getByRole("button", { name: "Delete my account" }).click();
  await l.fill("#confirm-delete", "DELETE");
  await l.getByRole("button", { name: "Delete everything" }).click();
  await l.locator(".make__title", { hasText: "Your account is deleted." }).waitFor({ timeout: 30_000 });
  check("delete account: the goodbye screen", true);
  await l.waitForTimeout(300);
  await shot(l, "account-deleted-desktop");
  const after = await fetch(`${apiBase}/me`, { headers: { Authorization: `Bearer dev:${leaverEmail}` } }).catch(() => null);
  check("delete account: the old sign-in no longer works (401)", after?.status === 401, String(after?.status));
  await leaver.close();
} finally {
  await browser.close();
  // Whatever happened above, no test account stays behind (a run that stopped halfway used to leave
  // its game folder, builds and rows): close all three, then make sure the main one is really gone.
  // The buyer has a plan, so its close goes through the sandbox API (billing off refuses to close an
  // account with a plan it can't cancel); the Android part's user too; then the sandbox API and the stub stop.
  const closed = await Promise.all([closeAccount(mainEmail), closeAccount(leaverEmail), closeAccount(droidMail), closeAccount(galleryMail), sandbox ? closeAccount(buyerEmail, sandbox.url) : 401]);
  await sandbox?.close();
  const left = await fetch(`${apiBase}/me`, { headers: { Authorization: `Bearer dev:${mainEmail}` } }).then((r) => r.status).catch(() => 0);
  check("cleanup: every test account closed (the main one answers 401 now)", left === 401 && closed.every((s) => s === 200 || s === 401), `${closed.join(", ")}; /me ${left}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${out}`);
process.exit(failed.length ? 1 : 0);
