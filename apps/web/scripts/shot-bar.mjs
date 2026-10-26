// The game page's top bar (10-27): the game's name stays readable and More whole at every desktop width with every mix of
// pills (before, at 1440×900 with the device pill, Turn, Shared, Android, Full screen and New tab, the name had 0px and
// More was cut off). The API's answers are replaced at the browser's network boundary, as in shot-worst.mjs (no API, no
// database, no games origin), on a site of its own: `next dev` on :3090 (NEXT_DIST_DIR .next/bar; tsconfig.json and
// next-env.d.ts are put back afterwards).
//   The mix: a short and a 60-letter name; Android on and off; Shared on and off; the preview on a phone or a tablet
// (both with Turn), a laptop, or Fill the window (the longest device word). Then the worst names (one 60-letter word,
// Georgian, an emoji first) with "version 21 · 10M plays", in the fullest bars (every pill; Small phone too) and the
// emptiest. For each, every width from 1024 to 1920 in 8px steps (and 1366), up and then down again without a reload,
// is checked: the name shows whole or at least its first word with "…", More is whole inside the bar, nothing is wider
// than the screen, and where the words or the version line are gone, the bar with them was cramped. Phones (390 and 320,
// touch) are measured too. The bar's pictures at 1024, 1280, 1366, 1440 and 1920 go on contact sheets, one per width and
// group of names.
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-bar.mjs [--base <ref>] [outDir]
// --base: first the same on apps/web at that commit (exported as shot-compare.mjs does, to data/shots/base-<sha>), whose
// failures are only reported; then wherever the base bar already fit (and on phones always), this checkout's bar must be
// laid out exactly as the base's, to the half pixel. Shots in .impeccable/review/bar/<base-sha|this>/.
import { chromium } from "playwright";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const opts = { base: null, out: join(root, ".impeccable/review/bar") };
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === "--base") opts.base = process.argv[++i];
  else opts.out = process.argv[i];
}
const SITE_PORT = 3090;
const base = `http://localhost:${SITE_PORT}`;
// Nothing listens on these: every call is answered in the browser.
const api = "http://127.0.0.1:3091";
const games = "http://127.0.0.1:3092";
const SHOT_WIDTHS = [1024, 1280, 1366, 1440, 1920];
// Every 8px, and the screenshots' widths (1366 is off that grid).
const SWEEP = [...new Set([...Array.from({ length: (1920 - 1024) / 8 + 1 }, (_, i) => 1024 + i * 8), ...SHOT_WIDTHS])].sort((a, b) => a - b);
const PHONES = [390, 320];

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- Fixtures --------------------------------------------------------------------------------------------------------
const iso = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
// Names are at most 60 letters (projects.service.ts). The worst ones also get the longest version line, "version 21 · 10M plays".
const NAMES = {
  short: "Cat Box Jumper",
  long: "Sky Crystal Defence: The Slime Invasion of the Floating Isles",
  word: "Supercalifragilisticexpialidociousgamewithoutanyspacesatallx", // one 60-letter word: the floor's 12em cap
  georgian: "ჩემი პირველი თამაში: კატა ხტება ყუთებზე ღამის ქალაქში ბევრი", // another script, in the fallback font
  emoji: "🐱 Cat Dash", // its first word is an emoji
};
const WORST = ["word", "georgian", "emoji"];
const me = (android) => ({
  id: "dev-bar",
  email: "bar@dev.test",
  name: "Bar Test",
  avatarUrl: null,
  plan: "high",
  models: ["fast", "smart", "best"],
  credits: { available: 240, todayLeft: null },
  features: { android },
});
const project = ({ name, shared, platform, worst }) => {
  const last = worst ? 21 : 3;
  const messages = [];
  const say = (role, text, extra = {}) => messages.push({ id: `m${messages.length}`, role, text, createdAt: iso(300 - messages.length * 10), ...extra });
  say("user", "Make an endless runner where a cat jumps over boxes");
  for (let n = 1; n <= last; n++) {
    if (n > 1) say("user", n === 2 ? "Add coins to collect" : "Add a double jump");
    say("agent", n === 1 ? "Your game is ready! Tap to jump over the boxes." : "Done!", { model: "smart", effort: "medium", status: "done", credits: 1.3, versionN: n, startedAt: iso(300 - messages.length * 10) });
  }
  const label = (n) => (n === 1 ? "Make an endless runner where a cat jumps over boxes" : n === 2 ? "Add coins to collect" : "Add a double jump");
  return {
    id: "bar00000",
    name,
    orientation: platform === "computer" ? "landscape" : "portrait",
    platform,
    buildId: "bar00000-v3",
    status: "idle",
    createdAt: iso(300),
    updatedAt: iso(5),
    shared,
    poster: true,
    listed: false,
    galleryHidden: false,
    plays: worst ? 9_999_999 : 1234, // "version 3 · 1.2K plays", the worst "version 21 · 10M plays"
    messages,
    versions: Array.from({ length: last }, (_, i) => ({ n: i + 1, label: label(i + 1), buildId: `bar00000-v${i + 1}`, createdAt: iso(300 - (i + 1) * 10) })),
    currentVersion: last,
  };
};
const DEVICES = [
  { id: "iphone", platform: "phone" },
  { id: "ipad", platform: "phone", pick: "iPad" },
  { id: "laptop", platform: "computer" },
  { id: "fill", platform: "fill" },
];
const COMBOS = [];
const key = (nameKey, device, android, shared) => `${nameKey}-${device.id}${android ? "-android" : ""}${shared ? "-shared" : ""}`;
for (const nameKey of ["short", "long"])
  for (const device of DEVICES)
    for (const android of [false, true]) for (const shared of [false, true]) COMBOS.push({ nameKey, device, android, shared, key: key(nameKey, device, android, shared) });
// The worst names in the fullest bars (every pill, the phone with the longest device word too) and the emptiest.
const SMALL = { id: "small", platform: "phone", pick: "Small phone" };
for (const nameKey of WORST)
  for (const [device, android, shared] of [[DEVICES[0], true, true], [SMALL, true, true], [DEVICES[2], false, false]])
    COMBOS.push({ nameKey, device, android, shared, worst: true, key: key(nameKey, device, android, shared) });
const comboLabel = (c) =>
  [c.worst ? `“${NAMES[c.nameKey]}”` : null, c.device.pick ?? { iphone: "iPhone", laptop: "Laptop", fill: "Fill the window" }[c.device.id], c.android ? "Android" : null, c.shared ? "Shared" : null].filter(Boolean).join(" · ");

async function mock(page, combo) {
  const proj = project({ name: NAMES[combo.nameKey], shared: combo.shared, platform: combo.device.platform, worst: combo.worst });
  await page.route(`${api}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const headers = { "Access-Control-Allow-Origin": "*" };
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS")
      return route.fulfill({ status: 204, headers: { ...headers, "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE" } });
    if (url.pathname === "/me") return json(me(combo.android));
    if (url.pathname === "/projects") return json([proj]);
    if (url.pathname === "/estimate") return json({ kind: "edit", model: "fast", typical: 0.3, low: 0.1, high: 0.5, needsConfirm: false });
    if (url.pathname.endsWith("/events"))
      return route.fulfill({ status: 200, headers: { ...headers, "Content-Type": "text/event-stream" }, body: `data: ${JSON.stringify({ type: "snapshot", project: proj })}\n\n` });
    if (url.pathname.startsWith("/projects/")) return json(proj);
    return json({ error: "not_found", message: "We couldn't find that." }, 404);
  });
  const poster = readFileSync(join(webDir, `public/games/${combo.device.platform === "computer" ? "runner_day" : "runner_night"}.jpg`));
  await page.route(`${games}/**`, (route) =>
    route.request().url().endsWith("/poster.png") ? route.fulfill({ status: 200, contentType: "image/jpeg", body: poster }) : route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html>" }),
  );
}

/**
 * The bar as laid out now: whether the name is readable (whole, or at least its first word and "…", measured with a
 * probe in the name's own font, independent of Stage.tsx's canvas), More whole inside the bar, the page no wider than the
 * screen, the words and the version shown, and every part's box. stepBack: also whether the bar one step back (the
 * words or the version line put back) was cramped, i.e. whether the step was needed.
 */
function measure({ stepBack }) {
  const bar = document.querySelector(".stage__bar");
  const r = (e) => e.getBoundingClientRect();
  const read = () => {
    const name = bar.querySelector(".stage__name");
    const more = bar.querySelector('[aria-label^="More"]');
    const cs = getComputedStyle(name);
    const text = name.textContent.trim();
    const word = text.split(/\s+/)[0];
    const probe = document.createElement("span");
    probe.textContent = word === text ? word : `${word}…`;
    Object.assign(probe.style, { position: "fixed", left: "-9999px", top: "0", visibility: "hidden", whiteSpace: "nowrap", fontFamily: cs.fontFamily, fontSize: cs.fontSize, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle, letterSpacing: cs.letterSpacing });
    document.body.append(probe);
    const floor = Math.min(r(probe).width, 12 * parseFloat(cs.fontSize)); // a 60-letter word can't have it all
    probe.remove();
    const edge = r(bar).right - parseFloat(getComputedStyle(bar).paddingRight);
    const version = bar.querySelector(".stage__version");
    const readable = name.scrollWidth <= name.clientWidth || r(name).width + 0.5 >= floor;
    const moreWhole = !!more && r(more).right <= edge + 0.5 && r(more).width >= 43;
    return { readable, moreWhole, nameW: Math.round(r(name).width), floor: Math.round(floor), moreRight: more ? Math.round(r(more).right) : null, edge: Math.round(edge), version: !!version && r(version).width > 0 };
  };
  const now = read();
  const labels = [...bar.querySelectorAll(".inkpill:not(.inkpill--small) .inkpill__label")];
  const half = (v) => Math.round(v * 2) / 2;
  const boxes = [...bar.querySelectorAll(".stage__name, .stage__version, .stage__actions > *")].map((e) => {
    const b = r(e);
    return [e.className.split(" ").at(-1), half(b.left), half(b.width)];
  });
  const fit = bar.dataset.fit ?? null;
  let needed = null;
  if (stepBack && fit) {
    if (fit === "tight") bar.dataset.fit = "icons";
    else delete bar.dataset.fit;
    const back = read();
    needed = !back.readable || !back.moreWhole;
    bar.dataset.fit = fit;
  }
  return { ...now, words: labels.some((l) => r(l).width > 2), fit, needed, boxes, page: document.documentElement.scrollWidth <= innerWidth };
}

// ---- One site: the matrix --------------------------------------------------------------------------------------------
const frame = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
async function open(browser, combo, viewport, phone = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone, reducedMotion: "reduce" });
  await ctx.addInitScript(() => localStorage.setItem("typeplay.devEmail", "bar@dev.test"));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`page error (${combo.key}):`, e.message));
  await mock(page, combo);
  await page.goto(`${base}/games/bar00000`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.locator(".stage__name").waitFor({ timeout: 120_000 });
  await page.locator('.stage__bar [aria-label^="More"]').waitFor({ timeout: 30_000 });
  if (!phone) await page.locator(".devicepick").waitFor({ timeout: 30_000 });
  if (combo.device.pick && !phone) {
    await page.locator(".devicepick").click();
    await page.locator('[id^="device-menu-"] button', { hasText: combo.device.pick }).click();
    await page.keyboard.press("Escape").catch(() => {});
  }
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none")));
  await sleep(300);
  return { ctx, page };
}

async function shootBar(page, file) {
  const clip = await page.evaluate(() => {
    const s = document.querySelector(".stage").getBoundingClientRect();
    const b = document.querySelector(".stage__bar").getBoundingClientRect();
    return { x: s.left, y: b.top, width: s.width, height: b.height + 2 };
  });
  await page.screenshot({ path: file, clip });
}

async function runSite(browser, label, stepBack) {
  const dir = join(opts.out, label);
  mkdirSync(join(dir, "bars"), { recursive: true });
  const states = {};
  const failures = [];
  const tightest = [];
  for (const combo of COMBOS) {
    const { ctx, page } = await open(browser, combo, { width: 1920, height: 900 });
    for (const [pass, widths] of [["up", SWEEP], ["down", [...SWEEP].reverse()]]) {
      for (const w of widths) {
        await page.setViewportSize({ width: w, height: 900 });
        await frame(page);
        const m = await page.evaluate(measure, { stepBack });
        if (pass === "up") states[`${combo.key}@${w}`] = m;
        else {
          const up = states[`${combo.key}@${w}`];
          if (up.fit !== m.fit || up.words !== m.words || up.version !== m.version) failures.push(`${combo.key} at ${w}: ${up.fit ?? "words"} going up, ${m.fit ?? "words"} coming down`);
        }
        // At its last step the bar has nothing more to give: a name still short of its floor then shows what fits (a 60-letter
        // word beside every pill at 1024px), reported, as long as More is whole.
        if (!m.readable && m.fit === "tight" && m.moreWhole && m.page) {
          if (pass === "up") tightest.push(`${combo.key} at ${w}: name ${m.nameW}px of ${m.floor}`);
        }
        else if (!m.readable || !m.moreWhole || !m.page) failures.push(`${combo.key} at ${w} (${pass}): name ${m.nameW}px of ${m.floor}, More ends ${m.moreRight} of ${m.edge}${m.page ? "" : ", wider than the screen"}`);
        if (m.needed === false) failures.push(`${combo.key} at ${w} (${pass}): "${m.fit}" though the bar fit without it`);
        if (pass === "up" && SHOT_WIDTHS.includes(w)) await shootBar(page, join(dir, "bars", `${w}-${combo.key}.png`));
      }
    }
    // The whole page once, with everything in the bar.
    if (combo.key === "long-iphone-android-shared")
      for (const w of SHOT_WIDTHS) {
        await page.setViewportSize({ width: w, height: { 1024: 768, 1280: 800, 1366: 768, 1440: 900, 1920: 1080 }[w] });
        await frame(page);
        await page.screenshot({ path: join(dir, `page-${w}.png`) });
      }
    await ctx.close();
    process.stdout.write(".");
  }
  console.log();
  // Phones: the device pill and Turn are hidden there, so 8 mixes at each width.
  for (const combo of COMBOS.filter((c) => c.device.id === "iphone"))
    for (const w of PHONES) {
      const { ctx, page } = await open(browser, combo, { width: w, height: w === 390 ? 844 : 640 }, true);
      const m = await page.evaluate(measure, { stepBack: false });
      states[`${combo.key}@phone${w}`] = m;
      if (!m.page) failures.push(`${combo.key} on a ${w}px phone: wider than the screen`);
      await shootBar(page, join(dir, "bars", `phone${w}-${combo.key}.png`));
      await ctx.close();
    }
  writeFileSync(join(dir, "states.json"), JSON.stringify(states));
  return { dir, states, failures, tightest };
}

/** One picture per width and name: the bar of each mix, labelled. */
async function sheets(browser, dir, label) {
  const page = await browser.newPage();
  for (const w of [...SHOT_WIDTHS, ...PHONES.map((p) => `phone${p}`)])
    for (const [group, title] of [["short", "a short name"], ["long", "a 60-letter name"], ["worst", "the worst names, version 21 · 10M plays"]]) {
      const rows = COMBOS.filter((c) => (group === "worst" ? c.worst : c.nameKey === group) && (typeof w === "number" || c.device.id === "iphone"))
        .map((c) => {
          const file = join(dir, "bars", `${w}-${c.key}.png`);
          if (!existsSync(file)) return "";
          const png = readFileSync(file).toString("base64");
          const what =
            typeof w === "number"
              ? comboLabel(c)
              : [c.worst ? `“${NAMES[c.nameKey]}”` : null, c.android ? "Android" : null, c.shared ? "Shared" : null].filter(Boolean).join(" · ") || "neither";
          return `<figure><figcaption>${what}</figcaption><img src="data:image/png;base64,${png}"${typeof w === "number" ? "" : ' style="width:50%"'}></figure>`;
        })
        .join("");
      await page.setContent(
        `<style>body{margin:0;padding:16px;background:#fff;font:600 14px system-ui}h1{font-size:18px;margin:0 0 12px}figure{margin:0 0 10px}figcaption{margin:0 0 4px;color:#333}img{display:block}</style><h1>${label}: ${w}${typeof w === "number" ? "px" : ""}, ${title}</h1>${rows}`,
      );
      await page.setViewportSize({ width: (typeof w === "number" ? Math.ceil(w * 0.75) : 420) + 32, height: 400 });
      await page.screenshot({ path: join(dir, `sheet-${w}-${group}.png`), fullPage: true });
    }
  await page.close();
}

// ---- The site --------------------------------------------------------------------------------------------------------
/** apps/web at a commit, exported once to data/shots/base-<sha> (the same place shot-compare.mjs keeps it). */
function exportBase(ref) {
  const sha = execFileSync("git", ["rev-parse", "--short=7", ref], { cwd: root, encoding: "utf8" }).trim();
  const dir = join(root, "data/shots", `base-${sha}`);
  const web = join(dir, "apps/web");
  if (!existsSync(join(web, "package.json"))) {
    mkdirSync(dir, { recursive: true });
    const tarFile = join(dir, "web.tar");
    execFileSync("git", ["archive", "--format=tar", "-o", tarFile, sha, "apps/web"], { cwd: root });
    const tar = process.platform === "win32" ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe") : "tar";
    execFileSync(tar, ["-xf", tarFile, "-C", dir]);
    rmSync(tarFile);
  }
  return { sha, web };
}
let site = null;
function startSite(dir) {
  site = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], {
    cwd: dir,
    env: {
      ...process.env,
      NEXT_DIST_DIR: ".next/bar",
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_APP: "1",
      NEXT_PUBLIC_DEV_AUTH: "1",
      NEXT_PUBLIC_CLOSED_BETA: "",
      NEXT_PUBLIC_API_ORIGIN: api,
      NEXT_PUBLIC_GAMES_ORIGIN: games,
      NEXT_PUBLIC_PADDLE_ENV: "",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let tail = "";
  site.stdout.on("data", (d) => (tail = (tail + d).slice(-3000)));
  site.stderr.on("data", (d) => (tail = (tail + d).slice(-3000)));
  return () => tail;
}
function stopSite() {
  if (!site || site.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(site.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else site.kill("SIGKILL");
}
async function siteUp(tail) {
  for (let i = 0; i < 360; i++) {
    if (await fetch(`${base}/pricing`).then((r) => r.ok, () => false)) return;
    if (site.exitCode !== null) break;
    await sleep(500);
  }
  throw new Error(`the site did not start: ${tail()}`);
}

// next-env.d.ts is git-ignored: a fresh checkout has none until `next dev` writes it.
const kept = Object.fromEntries([join(webDir, "tsconfig.json"), join(webDir, "next-env.d.ts")].filter((f) => existsSync(f)).map((f) => [f, readFileSync(f, "utf8")]));
const putBack = () => {
  for (const [file, text] of Object.entries(kept)) if (readFileSync(file, "utf8") !== text) writeFileSync(file, text);
};

let browser = null;
try {
  if (await fetch(`${base}/`).then(() => true, () => false)) throw new Error(`port ${SITE_PORT} is taken: another run of this script?`);
  browser = await chromium.launch({ channel: "msedge", headless: true });
  let before = null;
  if (opts.base) {
    const { sha, web } = exportBase(opts.base);
    const tail = startSite(web);
    await siteUp(tail);
    console.log(`base ${sha} up on :${SITE_PORT}`);
    before = await runSite(browser, `base-${sha}`, false);
    stopSite();
    await sleep(1500);
    await sheets(browser, before.dir, `before (${sha})`);
    console.log(`base ${sha}: ${before.failures.length} places where the name or More didn't fit (reported, not failed)`);
    for (const f of before.failures.slice(0, 12)) console.log(`  ${f}`);
  }
  const tail = startSite(webDir);
  await siteUp(tail);
  putBack();
  console.log(`this checkout up on :${SITE_PORT}`);
  const after = await runSite(browser, "this", true);
  await sheets(browser, after.dir, "after");
  check(`every mix at every width (${COMBOS.length} mixes × ${SWEEP.length} widths, up and down; phones at ${PHONES.join(" and ")}): the name readable, More whole, nothing wider than the screen, each step needed, the same going up and down`, after.failures.length === 0, after.failures.slice(0, 20).join("; "));
  if (after.tightest.length)
    console.log(`at the bar's last step (icons, no version line) and still under the name's floor, More whole (${after.tightest.length}): ${after.tightest.slice(0, 6).join("; ")}${after.tightest.length > 6 ? "; …" : ""}`);
  if (before) {
    const changed = [];
    for (const [key, b] of Object.entries(before.states)) {
      const a = after.states[key];
      const phone = key.includes("@phone");
      if (!phone && !(b.readable && b.moreWhole)) continue; // the base didn't fit here: the fix may change it
      if (JSON.stringify(a.boxes) !== JSON.stringify(b.boxes) || a.words !== b.words || a.version !== b.version) changed.push(key);
    }
    const fitting = Object.values(before.states).filter((b) => b.readable && b.moreWhole).length;
    check(`wherever the base bar fit (${fitting} of ${Object.keys(before.states).length} mix-widths) and on phones: laid out exactly as before`, changed.length === 0, changed.slice(0, 20).join(", "));
  }
  console.log(`shots and sheets in ${opts.out}`);
} catch (e) {
  check("the run", false, e instanceof Error ? e.stack : String(e));
} finally {
  await browser?.close().catch(() => {});
  stopSite();
  putBack();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
