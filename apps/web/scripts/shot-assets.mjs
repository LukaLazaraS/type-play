// The Assets tab (2026-11-04), end to end with screenshots, on a stack of its own on ports picked free and a database of
// its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched: the API (DEV_AUTH=1,
// AGENT_FAKE=1: fake builds with assets, src/runs/fake-assets.ts), the games origin, the site (`next dev` with its own
// NEXT_DIST_DIR, .next/assets; tsconfig.json is put back afterwards). Build the API first (npm run build -w
// @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-assets.mjs [outDir]
// Shots in .impeccable/review/assets/. Checks, at 1440, 390 and 320 px: the tab (a computer's switch in the game's bar, a
// phone's third tab) lists a 2D game's 9 assets with chips and counts; the arrow keys move between tiles; a tile opens the
// viewer (an animated look, a sound, a font, "2 of 9", the arrow keys, Escape and the keyboard back on the tile); Change it
// puts the picture into the chat box as a tile with the starter sentence (a phone opens the Chat tab, a computer keeps the
// list open); a 3D game's model turns in model-viewer; a game with nothing to list and one listed from its files say so.
// No sideways scrolling anywhere. Afterwards the test account closes.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : join(root, ".impeccable/review/assets");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("assets", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
const who = `assets-${Date.now().toString(36)}@dev.test`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name) => {
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (method, path, body) =>
  fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${who}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
const fits = async (page) => {
  const wide = await page.evaluate((vw) => {
    if (document.documentElement.scrollWidth <= vw + 1) return null;
    const pinned = (e) => { for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).position === "fixed") return true; return false; };
    const outside = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 1 && !pinned(e));
    return `${document.documentElement.scrollWidth}px: ${outside.slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} (${Math.round(e.getBoundingClientRect().right)})`).join(", ")}`;
  }, page.viewportSize().width);
  if (wide) console.log("  too wide:", wide);
  return !wide;
};
async function built(prompt) {
  const made = await api("POST", "/projects", { prompt, model: "fast" });
  if (made.status !== 201) throw new Error(`POST /projects: ${made.status} ${JSON.stringify(made.body)}`);
  for (let i = 0; i < 120; i++) {
    const p = (await api("GET", `/projects/${made.body.id}`)).body;
    if (p?.status === "idle" && p.buildId) return p;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`"${prompt}" never built`);
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
    NEXT_DIST_DIR: ".next/assets",
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
  check("the account: Medium + 60 credits", admin("plan", who, "medium").status === 0 && admin("grant", who, "60").status === 0);
  const g2 = await built("Slime Cave: slimes and bats in a cave ASSETS");
  const g3 = await built("City Drive: a car in a little city ASSETS3D");
  const g0 = await built("Dot Dash: a game that draws everything as it runs");
  const gf = await built("Old Cave: made before the asset list ASSETS NOCAPTURE");
  const gw = await built("Worst Case: the longest real names, the oddest sizes, 112 assets ASSETSWORST");
  check("four games built (a 2D game, a 3D game, one with nothing to list, one listed from its files)", !!(g2 && g3 && g0 && gf));

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page) {
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", who);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  /** The game's page with its Assets tab open: a computer's switch in the bar, a phone's third tab. */
  async function openAssets(page, id, phone) {
    await page.goto(`${base}/games/${id}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const tab = phone ? page.locator(".ws__tabs").getByRole("tab", { name: "Assets" }) : page.locator(".stage__switch").getByRole("tab", { name: "Assets" });
    await tab.waitFor({ timeout: 60_000 });
    await tab.click();
    await page.locator("#ws-assets").waitFor({ timeout: 30_000 });
    await page.waitForFunction(() => !document.querySelector("#ws-assets [role=status] .pulse"), null, { timeout: 30_000 }).catch(() => {});
  }
  const thumbsIn = (page, n) => page.waitForFunction((k) => document.querySelectorAll(".assets__grid .assettile__square img").length >= k, n, { timeout: 30_000 });

  for (const [label, viewport, phone] of [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true], ["320", { width: 320, height: 640 }, true]]) {
    const ctx = await browser.newContext({ viewport, ...(phone ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(page);

    // ---- A 2D game: its 9 assets -------------------------------------------------------------------
    await openAssets(page, g2.id, phone);
    const tiles = page.locator(".assets__grid .assettile__open");
    await tiles.first().waitFor({ timeout: 30_000 });
    check(`${label}: the 2D game lists its 9 assets`, (await tiles.count()) === 9, String(await tiles.count()));
    const chips = (await page.locator(".assets__kinds [role=radio]").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
    check(`${label}: chips by kind, with counts`, chips.join(" | ") === "All 9 | Pictures 5 | Sounds 3 | Fonts 1", chips.join(" | "));
    await thumbsIn(page, viewport.height < 700 ? 3 : 5); // only tiles near the screen fetch their pictures
    check(`${label}: the tab, no sideways scrolling`, await fits(page));
    await shot(page, `assets-2d-${label}`);
    if (!phone) {
      check(`${label}: the game's frame pills go while the list shows (Full screen)`, (await page.getByRole("button", { name: /Full screen/ }).count()) === 0);
      await tiles.first().focus();
      await page.keyboard.press("ArrowRight");
      const at = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
      check(`${label}: → moves to the next tile`, /^Enemy slime/.test(at ?? ""), String(at));
      await page.keyboard.press("End");
      check(`${label}: End goes to the last tile`, /^Font/.test((await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) ?? ""));
    }
    // Pictures only.
    await page.locator(".assets__kinds").getByRole("radio", { name: /Sounds/ }).click();
    check(`${label}: the Sounds chip shows the 3 sounds`, (await tiles.count()) === 3);
    await shot(page, `assets-sounds-${label}`);
    await page.locator(".assets__kinds").getByRole("radio", { name: /All/ }).click();

    // ---- The viewer: the animated slime, then the arrow keys, Escape ----------------------------------
    await tiles.nth(1).click();
    const dialog = page.locator("dialog[open]");
    await dialog.waitFor({ timeout: 10_000 });
    await page.locator("dialog[open] .assetview__frames").waitFor({ timeout: 30_000 });
    check(`${label}: the viewer shows the animated look, "2 of 9"`, (await page.locator("dialog[open] .viewer__count").innerText()).trim() === "2 of 9");
    check(`${label}: …its name, how it was made, where it is used`, (await dialog.locator(".assetview__name").innerText()) === "Enemy slime" && /drew in code/.test(await dialog.locator(".assetview__made").innerText()) && (await dialog.locator(".assetview__where").innerText()) === "Used in Enemy");
    check(`${label}: the viewer, no sideways scrolling`, await fits(page));
    await shot(page, `viewer-anim-${label}`);
    if (!phone) {
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), dialog.getByRole("button", { name: "Download" }).click()]);
      check(`${label}: Download saves the sprite sheet as enemy-slime.png`, download.suggestedFilename() === "enemy-slime.png", download.suggestedFilename());
    }
    await page.keyboard.press("ArrowRight");
    check(`${label}: → the next asset ("3 of 9")`, (await page.locator("dialog[open] .viewer__count").innerText()).trim() === "3 of 9");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    check(`${label}: Escape closes it, the keyboard back on the tile`, (await page.locator("dialog[open]").count()) === 0 && /^Enemy slime/.test(back ?? ""), String(back));
    // A sound: the play button has the keyboard first.
    await page.getByRole("button", { name: /^Jump, sound/ }).click();
    await dialog.waitFor({ timeout: 10_000 });
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    check(`${label}: a sound's viewer: Play has the keyboard`, focused === "Play Jump", String(focused));
    await shot(page, `viewer-sound-${label}`);
    await page.keyboard.press("Escape");
    // The font, in itself.
    await page.getByRole("button", { name: /^Font, font/ }).click();
    await page.waitForFunction(() => document.querySelector("dialog[open] .assetview__font")?.getAttribute("aria-busy") === null, null, { timeout: 30_000 });
    await shot(page, `viewer-font-${label}`);
    await page.keyboard.press("Escape");

    // ---- Change it: the coin's picture into the chat box, with its sentence --------------------------
    await page.getByRole("button", { name: /^Gold coin, picture/ }).click();
    await dialog.waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Change it" }).click();
    await page.locator("dialog[open]").waitFor({ state: "detached", timeout: 30_000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll(".composer .tray .thumb img").length === 1 && !document.querySelector(".composer .tray .thumb[aria-busy=true]"), null, { timeout: 30_000 });
    const said = await page.locator("#say").inputValue();
    check(`${label}: Change it: the picture in the box and the sentence`, said === "Change the picture “Gold coin” (coin): ", JSON.stringify(said));
    check(`${label}: …${phone ? "the Chat tab opens" : "the list stays open beside it"}`, phone ? (await page.locator(".ws").getAttribute("data-tab")) === "chat" : (await page.locator("#ws-assets").isVisible()));
    check(`${label}: …the keyboard in the box`, (await page.evaluate(() => document.activeElement?.id)) === "say");
    await shot(page, `change-${label}`);

    // ---- A 3D game: the model turns ------------------------------------------------------------------
    await openAssets(page, g3.id, phone);
    await tiles.first().waitFor({ timeout: 30_000 });
    await thumbsIn(page, 1);
    check(`${label}: the 3D game lists its models, a picture and the music`, (await tiles.count()) === 4, String(await tiles.count()));
    await shot(page, `assets-3d-${label}`);
    await page.getByRole("button", { name: /^Sedan, 3D model/ }).click();
    await dialog.waitFor({ timeout: 10_000 });
    const turned = await page.waitForFunction(() => {
      const mv = document.querySelector("dialog[open] model-viewer");
      return mv && mv.loaded === true;
    }, null, { timeout: 60_000 }).then(() => true, () => false);
    check(`${label}: the model loads in model-viewer (turnable)`, turned);
    check(`${label}: …with its credit`, /Car Kit by Kenney/.test(await dialog.locator(".assetview__made").innerText()));
    await page.waitForTimeout(1200);
    await shot(page, `viewer-3d-${label}`);
    await page.keyboard.press("Escape");

    // ---- Nothing to list; listed from the files --------------------------------------------------------
    await openAssets(page, g0.id, phone);
    await page.locator("#ws-assets .assets__lead").waitFor({ timeout: 30_000 });
    check(`${label}: a game with nothing to list says so`, /draws everything as it runs/.test(await page.locator("#ws-assets").innerText()));
    await shot(page, `assets-empty-${label}`);
    await page.getByRole("button", { name: "Ask in the chat" }).click();
    await page.waitForFunction(() => document.activeElement?.id === "say", null, { timeout: 10_000 }).catch(() => {});
    check(`${label}: …and its button takes the keyboard to the chat box`, (await page.evaluate(() => document.activeElement?.id)) === "say");
    await openAssets(page, gf.id, phone);
    await tiles.first().waitFor({ timeout: 30_000 });
    check(`${label}: a game listed from its files says what is missing`, /art the AI drew in code shows here after your next change/.test(await page.locator("#ws-assets .assets__note").innerText()) && (await tiles.count()) === 3);
    await shot(page, `assets-files-${label}`);

    // ---- The worst real data (break-ui): long and non-Latin names, odd sizes, 24 frames, 3 minutes of music, 112 assets -
    await openAssets(page, gw.id, phone);
    await tiles.first().waitFor({ timeout: 30_000 });
    check(`${label}: worst: 112 assets listed, with a search box`, (await tiles.count()) === 112 && (await page.locator("#assets-search").count()) === 1, String(await tiles.count()));
    await thumbsIn(page, 3);
    check(`${label}: worst: the list, no sideways scrolling`, await fits(page));
    await shot(page, `worst-list-${label}`);
    await page.fill("#assets-search", "boss");
    check(`${label}: worst: "boss" finds the boss, its theme and the long key`, (await tiles.count()) === 3, String(await tiles.count()));
    await shot(page, `worst-search-${label}`);
    await page.fill("#assets-search", "zzz");
    check(`${label}: worst: a search with no match says so`, /Nothing here is called “zzz”/.test(await page.locator("#ws-assets").innerText()));
    await page.locator("#assets-search").press("Escape");
    for (const [name, file] of [[/^Raketen-Turm/, "german"], [/^Laser beam/, "tall"], [/^Ground/, "wide"], [/^Big explosion/, "frames24"], [/^Boss battle theme/, "music"], [/^Img 2026/i, "photo"]]) {
      await page.getByRole("button", { name }).first().click();
      await page.locator("dialog[open]").waitFor({ timeout: 10_000 });
      await page.waitForTimeout(600);
      const box = await page.locator("dialog[open] .assetview__stage").boundingBox();
      const vw = viewport.width;
      check(`${label}: worst: the ${file} asset's preview within the screen's width`, !!box && box.x >= -1 && box.x + box.width <= vw + 1, JSON.stringify(box && { x: Math.round(box.x), w: Math.round(box.width), h: Math.round(box.height) }));
      check(`${label}: worst: the ${file} viewer, no sideways scrolling`, await fits(page));
      await shot(page, `worst-viewer-${file}-${label}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
    }
    await ctx.close();
  }
} catch (e) {
  check("the walk-through ran", false, e?.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  await api("DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  stopAll();
  writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
