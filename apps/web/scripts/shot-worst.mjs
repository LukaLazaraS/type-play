// Worst-case data for the app screens (the break-ui pass): the API's answers are replaced at the
// browser's network boundary with realistic extremes, so the screens render them exactly as they
// would real data. Needs only the site in dev with dev sign-in (no API, no games origin):
//   NEXT_PUBLIC_DEV_AUTH=1 npm run dev -w web
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-worst.mjs [outDir] [siteUrl] [apiUrl] [playIds]
// The share page (/play/<id>) reads the API on the server, so it can't be mocked here: pass the ids
// of real shared games with worst-case names as `playIds` (comma-separated) to screenshot them too.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? join(import.meta.dirname, "../../../.impeccable/review/app-worst");
const base = process.argv[3] ?? "http://localhost:3000";
const api = process.argv[4] ?? "http://127.0.0.1:3002";
const playIds = (process.argv[5] ?? "").split(",").filter(Boolean);
mkdirSync(out, { recursive: true });

const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

// ---- Fixtures --------------------------------------------------------------------------------
const longEmail = "bartholomew.fitzgerald@northwind-industries-holdings.example.com";
const me = (over = {}) => ({
  id: "dev-worst",
  email: longEmail,
  name: "Aleksandra Wiśniewska-Kowalczyk",
  avatarUrl: "https://lh3.googleusercontent.com/a/broken-picture-that-404s",
  plan: "free",
  models: ["fast"],
  credits: { available: 0, todayLeft: 0 },
  ...over,
});
const rich = me({ plan: "ultraplus", models: ["fast", "smart", "best"], credits: { available: 1287.4, todayLeft: null }, avatarUrl: null, name: "Jo" });
const nameless = me({ name: null, avatarUrl: null, email: "a@b.co", credits: { available: 1, todayLeft: 1 } });

// Billing (payments part 3): every strip at once on Ultra+ with 1,287.4 credits in five parts and 30
// payments of every kind and status; a Free user with 0 credits whose plan lapsed; a long card name.
const inDays = (d) => iso(-d * 1440);
const billing = (over = {}) => ({ mode: "sandbox", status: "active", pendingPlan: null, periodEndsAt: inDays(12), cancelsAt: null, hold: null, freeRefillAt: null, ...over });
const richBilling = me({ ...rich, billing: billing({ status: "past_due", pendingPlan: "medium", cancelsAt: inDays(12), hold: "chargeback" }) });
const zeroBilling = me({ billing: billing({ status: "free", periodEndsAt: null, freeRefillAt: inDays(9) }) });
const payKinds = ["Ultra+ plan", "Renewal: Ultra+", "Upgrade to Ultra+", "Credit pack"];
const payStatus = ["paid", "paid", "partly_refunded", "refunded", "disputed", "paid"];
const payments = Array.from({ length: 30 }, (_, i) => ({
  id: `txn_01jworst${String(i).padStart(18, "0")}`,
  at: iso(i * 1440 * 11 + 7),
  what: payKinds[i % payKinds.length],
  amountUsd: i === 1 ? 12345.67 : i === 2 ? 0.01 : i % 4 === 3 ? 10 : 200,
  taxUsd: i === 1 ? 2345.68 : i % 4 === 3 ? 1.9 : 38,
  invoiceNumber: i % 5 === 1 ? null : i === 0 ? "INV-2026-000000123456-REISSUED-A" : `TP-${1000 + i}`,
  refundableUntil: iso(i * 1440 * 11 + 7 - 14 * 1440),
  refundedUsd: payStatus[i % payStatus.length] === "partly_refunded" ? 42.18 : payStatus[i % payStatus.length] === "refunded" ? 200 : 0,
  status: payStatus[i % payStatus.length],
  refundPendingUsd: i === 0 ? 42.18 : null,
}));
const billWorst = {
  mode: "sandbox",
  plan: "ultraplus",
  subscription: { status: "past_due", renewsAt: null, endsAt: inDays(12), cancelsAt: inDays(12), pendingPlan: "medium", paymentFailedAt: iso(60), paymentMethod: "American Express ending 1005", lastPlan: "ultraplus" },
  credits: {
    parts: [
      { source: "free", left: 0.1, expiresAt: inDays(1) },
      { source: "plan", left: 1000, expiresAt: inDays(42) },
      { source: "upgrade", left: 87.5, expiresAt: inDays(42) },
      { source: "pack", left: 199.7, expiresAt: inDays(365) },
      { source: "admin", left: 0.1, expiresAt: null },
    ],
  },
  canBuyPack: true,
  payments,
  consent: { version: "v1", at: iso(400 * 1440) },
  hold: "chargeback",
};
const billEnded = {
  mode: "sandbox",
  plan: "free",
  subscription: { status: "past_due", renewsAt: null, endsAt: iso(2 * 1440), cancelsAt: null, pendingPlan: null, paymentFailedAt: iso(3 * 1440), paymentMethod: "Visa ending 4242", lastPlan: "high" },
  credits: { parts: [] },
  canBuyPack: false,
  payments: payments.slice(0, 1).map((p) => ({ ...p, what: "High plan", status: "paid", refundPendingUsd: null })),
  consent: { version: "v1", at: iso(40 * 1440) },
  hold: null,
};
const previewDown = { direction: "down", chargeNowUsd: 0, creditsNow: 0, nextRenewalUsd: 20, effectiveAt: inDays(12) };
const previewUp = { direction: "up", chargeNowUsd: 12345.67, creditsNow: 1287.4, nextRenewalUsd: 200, effectiveAt: iso(0) };

const estimates = {
  new: { fast: [1.7, 1.2, 2.1], smart: [6.7, 5, 8.2], best: [17, 13, 24] },
  edit: { fast: [0.3, 0.1, 0.5], smart: [1.3, 0.8, 2.1], best: [3.3, 2.5, 4.2] },
};
const factor = { low: 0.8, medium: 1, high: 1.8 };

// The longest prompt people really paste: a whole design doc with a link in it (the API takes 4,000).
const longPrompt =
  "Make a tower defence game set on a floating island in the sky where little robots defend a crystal from waves of slimes. " +
  "There should be 5 tower types (laser, frost, cannon, tesla and a healer that repairs the others), every tower can be upgraded 3 times, " +
  "the slimes come in 12 waves that get harder, with a boss slime every 4th wave that splits into 3 smaller ones when it dies. " +
  "Coins drop from slimes; spend them between waves. Add a start menu, a pause button, a game over screen with the best score, " +
  "and make it look like the art here: https://www.example.com/really/long/reference/link/to/a/moodboard/with/no/spaces/at/all?ref=typeplay&utm_source=youtube_video_description_link " +
  "Also the music should be calm but get faster in the boss waves. Thanks!!";
// The API cuts a charge's prompt to 200 letters with an ellipsis (credits.service.ts).
const cut = (s) => (s.length > 200 ? `${s.slice(0, 199)}…` : s);
const longLink = "https://www.example.com/another/long/link/without/any/spaces/that/someone/pasted/for/reference/only?x=1";

// Names are at most 60 letters (the API's rename limit; the agent's names are cut to 60 too).
const names = [
  "Sky Crystal Defence: The Slime Invasion of the Floating Isles",
  "Q",
  "🐱 Cat Dash",
  "Кошачий бег по крышам ночного города",
  "Make an endless runner where a little",
  "Supercalifragilisticexpialidociousgame",
  "Tower defence",
  "Fruit Match Night",
  "Untitled",
  "A",
];
const games = Array.from({ length: 30 }, (_, i) => ({
  id: `worst${String(i).padStart(5, "0")}`,
  name: names[i % names.length],
  orientation: i % 3 ? "portrait" : "landscape",
  buildId: i % 7 === 1 ? null : `worst${i}-v${(i % 9) + 1}`,
  status: i === 0 || i === 4 ? "running" : "idle",
  createdAt: iso(60 * 24 * i + 5),
  updatedAt: iso(i === 0 ? 0 : 60 * (i * 7)),
  shared: i % 4 === 0,
  // Some start-screen pictures load (a wide one in a square icon), some 404 (the drawn tile).
  poster: i % 7 !== 1 && i % 2 === 0,
}));

const messages = [];
let n = 0;
const push = (m) => messages.push({ id: `m${messages.length}`, createdAt: iso(400 - messages.length * 5), ...m });
push({ role: "user", text: longPrompt });
push({ role: "agent", text: "Your game is ready! Build towers on the grey tiles and press Start for the first wave.", model: "smart", effort: "medium", status: "done", credits: 7.4, versionN: ++n });
const edits = [
  ["make the slimes slower in the first 3 waves, they're too fast", "fast", "done", 0.3],
  ["add a sell button", "fast", "done", 0.1],
  ["the frost tower doesn't slow anything", "fast", "failed", 0],
  ["the frost tower doesn't slow anything, please fix it properly this time", "smart", "done", 1.9],
  ["make it violent with blood everywhere", "fast", "refused", 0],
  ["ok", "fast", "done", 0.1],
  [longLink, "best", "done", 24],
];
for (let r = 0; r < 4; r++)
  for (const [text, model, status, credits] of edits) {
    push({ role: "user", text });
    const ok = status === "done";
    push({
      role: "agent",
      text: ok
        ? "Done! The slimes in the first three waves now walk at about half speed, and the boss waves are unchanged."
        : status === "refused"
          ? "I can't make that one. Try a different idea. Nothing was charged."
          : "I couldn't get that change working, so your game is unchanged. Nothing was charged. Try again, maybe in other words.",
      model,
      effort: r === 1 ? "high" : r === 2 ? "low" : "medium",
      status,
      credits,
      ...(ok ? { versionN: ++n } : {}),
    });
  }
push({ role: "user", text: "make the boss bigger" });
push({ role: "agent", text: "", model: "fast", effort: "high", status: "running" });

const versions = Array.from({ length: n }, (_, i) => ({
  n: i + 1,
  label: i === 0 ? longPrompt : i % 5 === 0 ? `Restored version ${i - 2}` : edits[i % edits.length][0],
  buildId: "robot-runner",
  createdAt: iso(400 - i * 10),
}));
const project = {
  id: "worst00000",
  name: "Sky Crystal Defence: The Slime Invasion of the Floating Isles",
  orientation: "landscape",
  buildId: "robot-runner",
  status: "running",
  createdAt: iso(400),
  updatedAt: iso(1),
  shared: true,
  poster: false,
  messages,
  versions,
  currentVersion: n,
};

// The credit history: every kind, every length, a deleted game, a year ago, the biggest and smallest amounts.
const usageRows = [
  { amount: -24, kind: "charge", what: "Change on Best", prompt: cut(longLink), game: { id: "worst00000", name: names[0] } },
  { amount: -0.1, kind: "charge", what: "Change on Fast", prompt: "ok", game: { id: "worst00002", name: "🐱 Cat Dash" } },
  { amount: -7.4, kind: "charge", what: "New game on Smart", prompt: cut(longPrompt), game: { id: "worst00000", name: names[0] } },
  { amount: -1.9, kind: "charge", what: "Change on Smart", prompt: "the frost tower doesn't slow anything, please fix it properly this time", game: null, gameDeleted: true },
  { amount: 1300, kind: "grant", what: "Ultra+ plan, October", prompt: null, game: null },
  { amount: -12.5, kind: "refund", what: "Refund of 25 unused credits from the Medium plan (Paddle txn_01hv8x2k9m3n4p5q6r7s8t9u0v)", prompt: null, game: null },
  { amount: 40, kind: "grant", what: "Beta tester thank-you for finding the slime boss bug in wave 12", prompt: null, game: null },
  { amount: -1.7, kind: "charge", what: "New game on Fast", prompt: "Кошачий бег по крышам ночного города, коты прыгают через трубы", game: { id: "worst00003", name: names[3] } },
  { amount: -3.3, kind: "charge", what: "Change on Best", prompt: "Supercalifragilisticexpialidociousgamewithoutanyspacesatallbecausewhynot", game: { id: "worst00005", name: names[5] } },
  { amount: 20, kind: "grant", what: "Free plan credits", prompt: null, game: null },
];
const usage = Array.from({ length: 40 }, (_, i) => ({
  id: `usage-${String(i).padStart(3, "0")}`,
  at: iso(i < 3 ? i * 7 : 60 * 24 * (i * 11)), // the last ones are more than a year old
  ...usageRows[i % usageRows.length],
}));

// Android export (2026-10-18): the worst the Android page can get. A 60-letter app name (the API caps
// at 30; this is what an old row or a bypass would show), an 80-character package name (the limit),
// the key downloaded 5 times, 30 builds of every status (the newest waiting 7th in line, a failed one
// with a long error line and a 4 KB log with an unbreakable link, a finished one of 0 bytes and one of
// 213.7 MB expiring today, one whose checks fail with three permissions), today's builds used up, and
// a phone link whose URL is 199 characters (the longest the QR code takes).
const longPackage = "app.typeplay.sky_crystal_defence_the_slime_invasion_of_the_floating_isles_worst0";
const droidStatuses = ["queued", "running", "signing", "done", "failed", "expired", "cancelled", "done", "done", "failed"];
const longError =
  "Your game's code has an error that stops the Android build. Ask for a fix in the chat. The error: 'res://scenes/levels/level_12_the_floating_isles_of_the_sky_crystal/enemies/boss_slime_split_controller.gd:184 - Parse Error: Identifier \"slime_split_count_remaining_after_the_third_boss_wave\" not declared in the current scope.'";
const logTail = (
  "SCRIPT ERROR: Parse Error: Identifier \"slime_split_count_remaining_after_the_third_boss_wave\" not declared in the current scope.\n" +
  "   at: GDScript::reload (res://scenes/levels/level_12_the_floating_isles_of_the_sky_crystal/enemies/boss_slime_split_controller.gd:184)\n" +
  "https://docs.godotengine.org/en/4.7/classes/class_node.html#class-node-method-get-node-or-null-with-a-very-long-anchor-that-never-breaks\n"
)
  .repeat(20)
  .slice(-4096);
const droidChecks = (ok) => [
  { id: "format", ok: true, text: "Play package (.aab)" },
  { id: "signed", ok, text: ok ? "Signed with your upload key, not a debug key" : "Not signed with your upload key" },
  { id: "target", ok, text: ok ? "Targets Android 16 (API 36)" : "Targets API 34; Google Play needs 36 or higher" },
  { id: "arm64", ok: true, text: "64-bit (arm64)" },
  { id: "pages16k", ok: true, text: "16 KB pages" },
  { id: "version", ok: true, text: "Build number 24, higher than the last" },
  { id: "debuggable", ok: true, text: "Not debuggable" },
  { id: "permissions", ok, text: ok ? "Asks for no permissions" : "Asks for android.permission.INTERNET, android.permission.ACCESS_FINE_LOCATION, android.permission.RECORD_AUDIO" },
];
const droidBuilds = Array.from({ length: 30 }, (_, i) => {
  const status = droidStatuses[i % droidStatuses.length];
  const code = 31 - i;
  const versionN = Math.max(1, 21 - Math.floor(i / 2));
  const done = status === "done";
  return {
    id: `worst00000-a${code}`,
    versionN,
    format: i % 3 === 1 ? "aab" : "apk",
    versionCode: code,
    versionName: `${versionN}.${code}`,
    status,
    ...(status === "failed"
      ? { failCode: i % 2 ? "game" : "gradle", failMessage: i % 2 ? longError : "The packaging step failed. Try again; if it keeps failing, write to hello@typeplay.app with the build id.", logTail }
      : {}),
    ...(status === "cancelled" ? { failMessage: "Stopped." } : {}),
    ...(done ? { bytes: i === 3 ? 0 : i === 7 ? Math.round(1_048_576 * 213.7) : 25_412_378, sha256: "ab".repeat(32), expiresAt: inDays(i === 3 ? 0.2 : i === 7 ? 1 : 29) } : {}),
    icon: ["poster", "own", "placeholder"][i % 3],
    checks: done ? droidChecks(i !== 7) : [],
    godotVersion: "4.7.2",
    queuedAt: iso(i * 97 + 3),
    ...(status === "queued" ? { queue: { position: 7 } } : { startedAt: iso(i * 97 + 2) }),
    ...(["done", "failed", "expired", "cancelled"].includes(status) ? { finishedAt: iso(i * 97) } : {}),
  };
});
const droidState = (over = {}) => ({
  enabled: true,
  app: { packageName: longPackage, appName: names[0], versionCode: 31, packageLocked: true, hasIcon: false, createdAt: iso(5000) },
  key: { certSha256: "0f".repeat(32), createdAt: iso(5000), downloadedAt: iso(30), downloads: 5 },
  builds: droidBuilds,
  limits: { perGameToday: 0, perUserToday: 0 },
  ...over,
});
const droidLink = { url: `https://api.typeplay.app/android/dl/${"aB3_-xYz9".repeat(18)}Q`, expiresAt: inDays(10 / 1440) };

// ---- Wiring ----------------------------------------------------------------------------------
async function mock(page, { who = me(), list = games, proj = project, usagePages = usage, usageFails = false, bill = billWorst, preview = previewDown, droid = droidState() } = {}) {
  await page.route(`${api}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "Content-Disposition" };
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: { ...headers, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE" },
      });
    }
    if (url.pathname === "/me") return json(who);
    if (url.pathname === "/billing") return json(bill);
    if (url.pathname === "/billing/plan-change") return json(preview);
    if (url.pathname === "/billing/portal") return json({ overview: "https://example.test/portal", cancel: null, updatePaymentMethod: null });
    if (url.pathname === "/me/usage") {
      if (usageFails) return json({ error: "server_error", message: "Something went wrong on our side. Please try again." }, 500);
      const limit = Number(url.searchParams.get("limit") ?? 25);
      const start = url.searchParams.get("cursor") ? usagePages.findIndex((e) => e.id === url.searchParams.get("cursor")) + 1 : 0;
      const entries = usagePages.slice(start, start + limit);
      return json({ entries, next: start + limit < usagePages.length ? entries.at(-1).id : null });
    }
    if (url.pathname === "/estimate") {
      const f = factor[url.searchParams.get("effort") ?? "medium"];
      const [typical, low, high] = estimates[url.searchParams.get("kind")][url.searchParams.get("model")].map((c) => Math.max(0.1, Math.round(c * f * 10) / 10));
      return json({ kind: url.searchParams.get("kind"), model: url.searchParams.get("model"), typical, low, high, needsConfirm: high > (who.plan === "free" ? 3 : 25) });
    }
    if (url.pathname === "/projects") return json(list);
    if (url.pathname.endsWith("/events")) {
      return route.fulfill({
        status: 200,
        headers: { ...headers, "Content-Type": "text/event-stream" },
        body:
          `data: ${JSON.stringify({ type: "snapshot", project: proj })}\n\n` +
          `data: ${JSON.stringify({ type: "progress", messageId: proj.messages.at(-1).id, text: "Making the boss slime three times bigger and giving it a shadow so it reads from far away", at: iso(0) })}\n\n`,
      });
    }
    // Android: the state (also after setup and a change), a queued build, the phone link, a cancel; a download fails like the project's below.
    if (url.pathname.endsWith("/android")) return json(droid);
    if (url.pathname.endsWith("/android/builds")) return json(droid.builds[0], 202);
    if (url.pathname.endsWith("/link")) return json(droidLink);
    if (url.pathname.includes("/android/builds/") && url.pathname.endsWith("/cancel")) return json({ ...droid.builds[0], status: "cancelled", failMessage: "Stopped." });
    if (url.pathname.endsWith("/download")) return json({ error: "busy", message: "This game is being changed right now. Download it when the build is done." }, 409);
    if (url.pathname.startsWith("/projects/") && req.method() === "DELETE") return json({ ok: true });
    if (url.pathname.startsWith("/projects/")) return json(proj);
    return json({ error: "not_found", message: "We couldn't find that." }, 404);
  });
  // Start-screen pictures: a wide screenshot for some games (cropped into square icons), 404 for the rest.
  const wide = readFileSync(join(import.meta.dirname, "../public/games/runner_day.jpg"));
  await page.route("**/builds/*/poster.png", (route) =>
    /worst(0|4|6|8)-/.test(route.request().url())
      ? route.fulfill({ status: 200, contentType: "image/jpeg", body: wide })
      : route.fulfill({ status: 404, body: "not found" }),
  );
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const shots = [];
try {
  // SHOT_FILTER=<regex> renders only the screens whose name matches (iterating on one screen).
  const only = process.env.SHOT_FILTER ? new RegExp(process.env.SHOT_FILTER) : null;
  const run = async (name, viewport, path, setup, after, full) => {
    if (only && !only.test(name)) return;
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
    await ctx.addInitScript(() => localStorage.setItem("typeplay.devEmail", "worst@dev.test"));
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log(`page error (${name}):`, e.message));
    await mock(page, setup);
    await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForTimeout(2500);
    if (after) await after(page);
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: full ?? !path.startsWith("/games/") });
    shots.push(name);
    console.log("wrote", name);
    await ctx.close();
  };
  const desk = { width: 1440, height: 900 };
  const phone = { width: 390, height: 844 };
  const tiny = { width: 320, height: 640 };
  const pop = (button, panel) => async (p) => {
    await p.getByRole("button", { name: button }).click();
    await p.locator(`${panel}:popover-open`).waitFor({ timeout: 5_000 });
    await p.waitForTimeout(300);
  };

  await run("create-zero-credits", desk, "/create?prompt=" + encodeURIComponent(longPrompt), {});
  await run("create-zero-credits-menu", desk, "/create", {}, (p) => p.locator(".account__me").click().then(() => p.waitForTimeout(300)));
  await run("create-ultra", desk, "/create", { who: rich });
  await run("create-ultra-phone", phone, "/create", { who: rich });
  await run("create-320", tiny, "/create?prompt=" + encodeURIComponent(longPrompt), {});
  await run("games-30", desk, "/games", {});
  await run("games-30-phone", phone, "/games", {});
  await run("games-empty", desk, "/games", { list: [] });
  await run("game-worst", desk, "/games/worst00000", {});
  await run("game-worst-phone-chat", phone, "/games/worst00000", {}, (p) => p.getByRole("tab", { name: "Chat" }).click().then(() => p.waitForTimeout(500)));
  await run("game-worst-phone-play", phone, "/games/worst00000", {});
  await run("game-worst-320-chat", tiny, "/games/worst00000", {}, (p) => p.getByRole("tab", { name: "Chat" }).click().then(() => p.waitForTimeout(500)));
  await run("game-first-build-failed", desk, "/games/worst00000", {
    proj: {
      ...project,
      buildId: null,
      status: "idle",
      currentVersion: null,
      versions: [],
      messages: [messages[0], { ...messages[1], text: "I couldn't build that game this time. Nothing was charged. Try again, maybe in other words.", status: "failed", credits: 0, versionN: undefined }],
    },
  });

  // ---- Added 2026-10-18: effort, Share, More, rename, Manage, the account page ----
  await run("game-worst-effort-high", desk, "/games/worst00000", {}, async (p) => {
    await p.locator(".composer .effort label", { hasText: "High" }).click();
    await p.waitForTimeout(400);
  });
  await run("game-worst-share", desk, "/games/worst00000", {}, pop("Shared: change sharing", "#share-worst00000"));
  await run("game-worst-share-320", tiny, "/games/worst00000", {}, pop("Shared: change sharing", "#share-worst00000"));
  await run("game-worst-menu", desk, "/games/worst00000", {}, pop(/^More: rename/, "#game-menu-worst00000"));
  await run("game-worst-menu-delete-ask-320", tiny, "/games/worst00000", {}, async (p) => {
    await pop(/^More: rename/, "#game-menu-worst00000")(p);
    await p.locator(".menu__list button", { hasText: "Delete game" }).click();
    await p.waitForTimeout(300);
  });
  await run("game-worst-rename", desk, "/games/worst00000", {}, async (p) => {
    await pop(/^More: rename/, "#game-menu-worst00000")(p);
    await p.locator(".menu__list button", { hasText: "Rename" }).click();
    await p.locator("#rename").waitFor();
    await p.waitForTimeout(300);
  });
  await run("game-worst-rename-phone", phone, "/games/worst00000", {}, async (p) => {
    await pop(/^More: rename/, "#game-menu-worst00000")(p);
    await p.locator(".menu__list button", { hasText: "Rename" }).click();
    await p.locator("#rename").waitFor();
    await p.waitForTimeout(300);
  });
  const manage = async (p) => {
    await p.getByRole("button", { name: "Manage" }).click();
    await p.locator(".manage__row").first().waitFor();
    await p.waitForTimeout(600);
  };
  await run("games-manage-30", desk, "/games", {}, manage);
  await run("games-manage-30-phone", phone, "/games", {}, manage);
  await run("games-manage-320-asks", tiny, "/games", {}, async (p) => {
    await manage(p);
    await p.locator(".manage__row").nth(0).getByRole("button", { name: /^Delete / }).click();
    await p.locator(".manage__row").nth(2).getByRole("button", { name: /^Rename / }).click();
    await p.waitForTimeout(300);
  });
  await run("account-worst", desk, "/account", {}, async (p) => {
    await p.getByRole("button", { name: "Show more" }).click();
    await p.waitForTimeout(800);
  });
  await run("account-worst-phone", phone, "/account", {});
  await run("account-worst-320", tiny, "/account", {}, async (p) => {
    await p.getByRole("button", { name: "Delete my account" }).click();
    await p.waitForTimeout(300);
  });
  await run("account-rich-delete-ask", desk, "/account", { who: rich }, async (p) => {
    await p.getByRole("button", { name: "Delete my account" }).click();
    await p.fill("#confirm-delete", "DELETE");
    await p.waitForTimeout(300);
  });
  await run("account-nameless-one-entry", phone, "/account", { who: nameless, usagePages: usage.slice(9, 10) });
  await run("account-usage-error", desk, "/account", { usageFails: true });
  await run("billing-ultra", desk, "/billing", { who: rich });

  // ---- Added 2026-10-20: plan and billing, the checkout ----
  const picker = async (p) => {
    await p.getByRole("button", { name: "Change plan" }).click();
    await p.locator(".picker__row", { hasText: "Medium" }).getByRole("button").click();
    await p.locator(".picker__preview p", { hasText: /Nothing now|You pay/ }).waitFor({ timeout: 10_000 });
    await p.waitForTimeout(300);
  };
  await run("billing-worst", desk, "/billing", { who: richBilling }, picker);
  await run("billing-worst-phone", phone, "/billing", { who: richBilling }, picker);
  await run("billing-worst-320", tiny, "/billing", { who: richBilling }, picker);
  await run("billing-worst-upgrade-preview", desk, "/billing", { who: me({ ...richBilling, plan: "medium", billing: billing() }), bill: { ...billWorst, plan: "medium", hold: null, subscription: { ...billWorst.subscription, status: "active", cancelsAt: null, pendingPlan: null, renewsAt: inDays(12) } }, preview: previewUp }, async (p) => {
    await p.getByRole("button", { name: "Change plan" }).click();
    await p.locator(".picker__row", { hasText: "Ultra+" }).getByRole("button", { name: "Upgrade" }).click();
    await p.locator(".picker__preview p", { hasText: "You pay" }).waitFor({ timeout: 10_000 });
    await p.waitForTimeout(300);
  });
  await run("billing-cancel-ask-320", tiny, "/billing", { who: me({ ...richBilling, billing: billing() }), bill: { ...billWorst, hold: null, subscription: { ...billWorst.subscription, status: "active", cancelsAt: null, pendingPlan: null, renewsAt: inDays(12) } } }, (p) => p.getByRole("button", { name: "Cancel plan" }).click().then(() => p.waitForTimeout(300)));
  await run("billing-zero-ended", desk, "/billing", { who: zeroBilling, bill: billEnded });
  await run("billing-zero-ended-phone", phone, "/billing", { who: zeroBilling, bill: billEnded });
  await run("checkout-worst-320", tiny, "/billing/checkout?item=plan:ultraplus&back=%2Fgames%2Fworst00000", { who: zeroBilling, bill: billEnded }, (p) => p.locator(".consent input").check().then(() => p.waitForTimeout(300)));
  await run("checkout-worst-phone", phone, "/billing/checkout?item=plan:medium", { who: zeroBilling, bill: billEnded });
  await run("checkout-pack-on-free-phone", phone, "/billing/checkout?item=pack&back=%2Fgames%2Fworst00000", { who: zeroBilling, bill: billEnded });
  await run("checkout-plan-while-subscribed", desk, "/billing/checkout?item=plan:high", { who: richBilling });
  await run("checkout-no-item", desk, "/billing/checkout", { who: zeroBilling });

  // ---- Added 2026-10-18: the Android page (the hub with 30 builds, the edit form, setup, the plan panel, the server
  // without a toolchain) and the game page while an Android build runs, or on a server without Android ----
  const droidMe = me({ ...rich, features: { android: true } });
  const openRow = async (p, status, nth, button) => {
    await p.locator(`.builds__row[data-status="${status}"]`).nth(nth).getByRole("button", { name: button }).click();
    await p.waitForTimeout(400);
  };
  const worstHub = async (p) => {
    await openRow(p, "failed", 0, "Details");
    await openRow(p, "done", 0, "Phone link"); // an APK of 0 bytes, expiring today
    await openRow(p, "done", 1, "Checks"); // an AAB of 213.7 MB whose checks fail
    await p.locator(".qrpanel__steps").waitFor({ timeout: 10_000 });
    await p.waitForTimeout(300);
  };
  await run("android-worst", desk, "/games/worst00000/android", { who: droidMe }, worstHub, true);
  // Phones get 12 of the 30 builds and 320 px gets 8 (every status is among them): a full-page capture of 30 phone rows passes Chromium's 16,384 px limit.
  await run("android-worst-phone", phone, "/games/worst00000/android", { who: droidMe, droid: droidState({ builds: droidBuilds.slice(0, 12) }) }, worstHub, true);
  await run("android-worst-320", tiny, "/games/worst00000/android", { who: droidMe, droid: droidState({ builds: droidBuilds.slice(0, 8) }) }, worstHub, true);
  await run("android-worst-edit", desk, "/games/worst00000/android", { who: droidMe }, async (p) => {
    await p.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await p.fill("#droid-package", "com.example.x");
    await p.locator("#droid-name").focus();
    await p.waitForTimeout(300);
  }, true);
  await run("android-worst-setup-phone", phone, "/games/worst00000/android", { who: droidMe, droid: droidState({ app: null, key: null, builds: [] }) }, (p) => p.getByRole("button", { name: "Use my own" }).click().then(() => p.waitForTimeout(300)), true);
  await run("android-worst-plan-320", tiny, "/games/worst00000/android", { who: me({ features: { android: true } }) }, null, true);
  await run("android-worst-off", desk, "/games/worst00000/android", { who: me({ ...droidMe, features: { android: false } }) }, null, true);
  await run("game-worst-exporting", desk, "/games/worst00000", { who: droidMe, proj: { ...project, status: "exporting" } });
  await run("game-worst-exporting-phone-chat", phone, "/games/worst00000", { who: droidMe, proj: { ...project, status: "exporting" } }, (p) => p.getByRole("tab", { name: "Chat" }).click().then(() => p.waitForTimeout(500)));
  await run("game-worst-no-android", desk, "/games/worst00000", { who: rich });

  // The share page reads the API on the server: real shared games with worst-case names.
  for (const id of playIds) {
    for (const [label, viewport] of [["desk", desk], ["phone", phone], ["320", tiny]]) {
      const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 500 ? 2 : 1, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
      const page = await ctx.newPage();
      page.on("pageerror", (e) => console.log(`page error (play ${id}):`, e.message));
      await page.goto(`${base}/play/${id}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(out, `play-${id}-${label}.png`), fullPage: true });
      shots.push(`play-${id}-${label}`);
      console.log("wrote", `play-${id}-${label}`);
      if (label === "desk") {
        const og = await page.locator('meta[property="og:image"]').getAttribute("content");
        if (og) {
          const res = await page.request.get(base + new URL(og).pathname + new URL(og).search);
          const { writeFileSync } = await import("node:fs");
          writeFileSync(join(out, `play-${id}-card.png`), await res.body());
          console.log("wrote", `play-${id}-card`, res.status());
        }
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`${shots.length} screenshots in ${out}`);
