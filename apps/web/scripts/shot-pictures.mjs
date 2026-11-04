// Pictures with a message (2026-11-04), end to end with screenshots, on a stack of its own on ports picked free and a
// database of its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched: the API (DEV_AUTH=1,
// AGENT_FAKE=1), the games origin, the site (`next dev` with its own NEXT_DIST_DIR, .next/pictures; tsconfig.json is put
// back afterwards). Build the API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-pictures.mjs [outDir]
// Shots in .impeccable/review/pictures/. Checks, at 1440 and 390 px (and 320 for a full box): /create's idea box takes
// pictures from the picture button (several at once), shows them as tiles with Remove, refuses a program renamed .png in
// one line and the 11th picture; Build sends them, and the game's chat shows them over the first message; a tile opens the
// viewer (2 of 2, the arrow keys, Escape, the keyboard back on the tile); the composer takes a pasted and a dropped picture
// and sends them with a change. No sideways scrolling anywhere. Afterwards the test account closes.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const sharp = createRequire(join(serverDir, "package.json"))("sharp");
const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : join(root, ".impeccable/review/pictures");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("pictures", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;

const stamp = Date.now().toString(36);
const who = `pictures-${stamp}@dev.test`;
const IDEA = "Make an endless runner where my robot jumps over cactuses in a desert like my pictures";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name) => {
  await page.waitForTimeout(350); // past the 160 ms tile entrance and colour changes
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
async function idle(id, seconds = 60) {
  for (let i = 0; i < seconds * 2; i++) {
    const p = (await api(who, "GET", `/projects/${id}`)).body;
    if (p?.status === "idle") return p;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${id} never went idle`);
}

// ---- The pictures: drawn here (flat shapes in the site's palette), as a player's drawings and screenshots would be ---
const pics = join(root, "data/shots/pictures");
mkdirSync(pics, { recursive: true });
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const files = {
  robot: join(pics, "robot-sketch.png"),
  desert: join(pics, "desert-colours.jpg"),
  level: join(pics, "level-sketch.webp"),
  screen: join(pics, "a game I like.png"),
  tall: join(pics, "tall-character.png"),
  exe: join(pics, "cat.png"),
};
await sharp(
  svg(600, 600, `<rect width="600" height="600" fill="#fff8ee"/><rect x="200" y="150" width="200" height="190" rx="36" fill="#8fd3ff" stroke="#170d33" stroke-width="10"/>
  <circle cx="255" cy="235" r="26" fill="#fff" stroke="#170d33" stroke-width="8"/><circle cx="345" cy="235" r="26" fill="#fff" stroke="#170d33" stroke-width="8"/>
  <circle cx="258" cy="238" r="10" fill="#170d33"/><circle cx="348" cy="238" r="10" fill="#170d33"/><rect x="262" y="290" width="76" height="14" rx="7" fill="#ff5a36"/>
  <line x1="300" y1="150" x2="300" y2="95" stroke="#170d33" stroke-width="10"/><circle cx="300" cy="85" r="18" fill="#ff5a36" stroke="#170d33" stroke-width="8"/>
  <rect x="215" y="340" width="170" height="150" rx="24" fill="#8fd3ff" stroke="#170d33" stroke-width="10"/><rect x="230" y="490" width="50" height="60" rx="12" fill="#170d33"/><rect x="320" y="490" width="50" height="60" rx="12" fill="#170d33"/>`),
).png().toFile(files.robot);
await sharp(svg(1200, 800, `<rect width="1200" height="800" fill="#1c1240"/><rect y="160" width="1200" height="160" fill="#2a1858"/><rect y="320" width="1200" height="140" fill="#572877"/>
  <circle cx="860" cy="430" r="110" fill="#ffb347"/><path d="M0 560 C300 480 600 640 1200 520 L1200 800 L0 800Z" fill="#a63e68"/><path d="M0 650 C400 590 800 720 1200 640 L1200 800 L0 800Z" fill="#f3a35c"/>`))
  .jpeg({ quality: 88 })
  .toFile(files.desert);
await sharp(svg(900, 600, `<rect width="900" height="600" fill="#ffffff"/><g fill="none" stroke="#3d206b" stroke-width="8" stroke-linecap="round">
  <path d="M40 520 H300"/><path d="M380 430 H560"/><path d="M640 330 H860"/><path d="M120 470 l30 -50 l30 50"/><path d="M700 280 l25 -45 l25 45"/></g>
  <circle cx="80" cy="480" r="22" fill="#ff5a36"/><text x="770" y="300" font-size="40" font-family="Arial" fill="#2f9e44">END</text>`))
  .webp({ quality: 85 })
  .toFile(files.level);
await sharp(svg(1280, 720, `<rect width="1280" height="720" fill="#6a2c7a"/><rect y="560" width="1280" height="160" fill="#d9645a"/><rect x="180" y="440" width="90" height="120" rx="14" fill="#8fd3ff"/>
  <rect x="620" y="480" width="60" height="80" fill="#2f9e44"/><rect x="900" y="460" width="60" height="100" fill="#2f9e44"/><rect x="40" y="30" width="260" height="60" rx="14" fill="#170d33"/>
  <text x="70" y="72" font-size="34" font-family="Arial" fill="#ffffff">SCORE 120</text>`))
  .png()
  .toFile(files.screen);
await sharp(svg(400, 1000, `<rect width="400" height="1000" fill="#f1ecfa"/><rect x="120" y="120" width="160" height="760" rx="70" fill="#ffb347" stroke="#170d33" stroke-width="10"/>`))
  .png()
  .toFile(files.tall);
writeFileSync(files.exe, Buffer.concat([Buffer.from("4d5a90000300000004000000ffff0000b8000000000000004000000000000000", "hex"), Buffer.alloc(2048, 0x90)]));
const tens = [];
for (let i = 0; i < 11; i++) {
  const f = join(pics, `picture-${i + 1}.png`);
  await sharp(svg(240, 240, `<rect width="240" height="240" fill="hsl(${i * 33} 70% 62%)"/><text x="120" y="150" text-anchor="middle" font-size="90" font-family="Arial" fill="#170d33">${i + 1}</text>`)).png().toFile(f);
  tens.push(f);
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

/** A file handed to the page as a File, for a paste or a drop (what the browser makes of a real one). */
async function pageFile(page, path, name, type) {
  return page.evaluateHandle(
    ({ b64, name, type }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], name, { type }));
      return dt;
    },
    { b64: readFileSync(path).toString("base64"), name, type },
  );
}
/** Tiles in a box that are still on their way; when they never land, what the box shows is printed. */
const settled = (page, scope) =>
  page.waitForFunction((s) => document.querySelector(s) && !document.querySelector(`${s} .thumb[aria-busy="true"]`), scope, { timeout: 60_000 }).catch(async (e) => {
    console.log("  the box:", await page.evaluate(() => document.querySelector(".make__idea, .composer")?.innerText.replace(/\s+/g, " ").slice(0, 300)).catch(() => "?"));
    throw e;
  });
const only320 = process.argv.includes("--only-320");

let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, { PORT: String(API_PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0" });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/pictures",
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
  check("the account: Medium + 60 credits", admin("plan", who, "medium").status === 0 && admin("grant", who, "60").status === 0);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page) {
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", who);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }

  for (const [label, viewport, phone] of only320 ? [] : [["1440", { width: 1440, height: 900 }, false], ["390", { width: 390, height: 844 }, true]]) {
    const ctx = await browser.newContext({ viewport, ...(phone ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(page);

    // ---- /create: the idea box ----------------------------------------------------------------------
    await page.fill("#idea", IDEA);
    const add = page.locator(".make__idea").getByRole("button", { name: "Add pictures" });
    check(`${label}: /create has Add pictures in the idea box`, (await add.count()) === 1);
    await page.locator(".make__idea input[type=file]").setInputFiles([files.robot, files.desert, files.level, files.tall]);
    await settled(page, ".make__idea .tray");
    check(`${label}: four pictures in the box as tiles`, (await page.locator(".make__idea .tray .thumb").count()) === 4);
    check(`${label}: each with its Remove`, (await page.getByRole("button", { name: /^Remove / }).count()) === 4);
    check(`${label}: /create, no sideways scrolling`, await fits(page));
    await page.locator(".make__idea").scrollIntoViewIfNeeded();
    await shot(page, `create-${label}`);
    await page.getByRole("button", { name: "Remove tall-character.png" }).click();
    check(`${label}: Remove takes one out`, (await page.locator(".make__idea .tray .thumb").count()) === 3);
    await page.locator(".make__idea input[type=file]").setInputFiles([files.exe]);
    const refusal = page.locator(".make__idea .error-line");
    await refusal.waitFor({ timeout: 30_000 });
    const said = (await refusal.innerText()).trim();
    check(`${label}: a program renamed cat.png is refused in one line`, said === "“cat.png” isn't a PNG, JPG or WebP picture.", said);
    check(`${label}: …and not added`, (await page.locator(".make__idea .tray .thumb").count()) === 3);
    await shot(page, `create-refused-${label}`);

    // Build: the pictures go with the idea; the game's chat shows them over the first message.
    await page.getByRole("button", { name: "Build my game" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 120_000 });
    const gameId = page.url().split("/").pop();
    if (phone) await page.getByRole("tab", { name: "Chat" }).click();
    const firstTiles = page.locator(".msg--you").first().locator(".thumb");
    await firstTiles.first().waitFor({ timeout: 60_000 });
    check(`${label}: the first message shows its 3 pictures`, (await firstTiles.count()) === 3);
    await page.waitForFunction(() => [...document.querySelectorAll(".msg--you .thumb img")].length === 3, null, { timeout: 30_000 });
    await idle(gameId);
    await page.waitForTimeout(800);
    check(`${label}: the game page, no sideways scrolling`, await fits(page));
    await shot(page, `chat-${label}`);

    // The viewer: a tap opens the picture whole; the arrow keys move; Escape closes, the keyboard back on the tile.
    await firstTiles.nth(1).click();
    const viewer = page.getByRole("dialog");
    await viewer.waitFor({ timeout: 10_000 });
    await page.locator(".viewer__frame img").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(400);
    check(`${label}: the viewer opens on that picture ("2 of 3")`, ((await page.locator(".viewer__count").innerText()).trim()) === "2 of 3");
    await shot(page, `viewer-${label}`);
    await page.keyboard.press("ArrowRight");
    check(`${label}: → shows the next ("3 of 3")`, ((await page.locator(".viewer__count").innerText()).trim()) === "3 of 3");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const back = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    check(`${label}: Escape closes it, the keyboard back on the tile`, (await page.locator("dialog[open]").count()) === 0 && back === "Open your picture 2 of 3", String(back));

    // The composer: a pasted picture and a dropped one, sent with a change.
    const say = page.locator("#say");
    await say.click();
    await say.fill("Make the robot look like this");
    // A paste as the browser makes it (a ClipboardEvent carrying the copied picture).
    await say.evaluate((el, b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const dt = new DataTransfer();
      dt.items.add(new File([bytes], "a game I like.png", { type: "image/png" }));
      el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    }, readFileSync(files.screen).toString("base64"));
    const dropped = await pageFile(page, files.robot, "robot-sketch.png", "image/png");
    await page.locator("form.composer").dispatchEvent("dragenter", { dataTransfer: dropped });
    await page.locator("form.composer").dispatchEvent("dragover", { dataTransfer: dropped });
    check(`${label}: files over the composer: its box wears the ring`, (await page.locator(".composer__field.field--ringed").count()) === 1);
    await page.locator("form.composer").dispatchEvent("drop", { dataTransfer: dropped });
    await settled(page, ".composer .tray");
    check(`${label}: a pasted and a dropped picture in the composer`, (await page.locator(".composer .tray .thumb").count()) === 2);
    check(`${label}: the composer, no sideways scrolling`, await fits(page));
    await shot(page, `composer-${label}`);
    const before = (await api(who, "GET", `/projects/${gameId}`)).body.messages.length;
    await page.getByRole("button", { name: "Send" }).click();
    await page.waitForFunction((n) => document.querySelectorAll(".log > li.msg").length > n, before, { timeout: 30_000 });
    await idle(gameId);
    const sent = (await api(who, "GET", `/projects/${gameId}`)).body.messages.at(-2);
    check(`${label}: the change went with its 2 pictures`, sent?.role === "user" && sent.images?.length === 2, JSON.stringify(sent?.images?.length));
    check(`${label}: the composer's box is empty again`, (await page.locator(".composer .tray .thumb").count()) === 0);
    await page.waitForTimeout(800);
    await shot(page, `chat-sent-${label}`);
    await ctx.close();
  }

  // ---- 320 px: a full box (10 pictures) and the 11th ------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await signIn(page);
    await page.fill("#idea", IDEA);
    await page.locator(".make__idea input[type=file]").setInputFiles(tens);
    await settled(page, ".make__idea .tray");
    const said = (await page.locator(".make__idea .error-line").innerText().catch(() => "")).trim();
    check("320: ten pictures in the box, the 11th left out with a line", (await page.locator(".make__idea .tray .thumb").count()) === 10 && said === "A message can carry up to 10 pictures: 1 was left out.", said);
    check("320: no sideways scrolling", await fits(page));
    await page.locator(".make__idea").scrollIntoViewIfNeeded();
    await shot(page, "create-ten-320");
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
