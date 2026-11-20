// The launch pages (2026-11-20): the home page and /pricing at every phone shape, and the paths a fresh visitor takes from
// them, in the two states the build flags give while billing is off:
//   beta  the closed beta: NEXT_PUBLIC_CLOSED_BETA=1 with the API's BETA_INVITE_ONLY=1, no Paddle token
//   open  open sign-up, billing still off: neither flag, no Paddle token
// (Billing on is shot-app's walk: pricing → Get Medium → the checkout, against the Paddle stub.)
// A stack of its own (dev-env.mjs useOwnStack: a database of the run's own, dropped at the end, and ports picked free): the
// API (DEV_AUTH=1, AGENT_FAKE=1), the games origin and the site (`next dev`, one NEXT_DIST_DIR per state; tsconfig.json is
// put back afterwards); the API and the site restart between the states. Build the API first (npm run build -w
// @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-launch.mjs [outDir] [--only beta|open]
// Shots in .impeccable/review/launch/<state>/: <page>-<width>x<height>.png (whole pages) and the paths' steps.
// Checks, every shape: nothing wider than the screen; every button at least 44 px tall on the touch shapes (phones,
// sideways too, and the tablet); worst-case data still fits at 320 and 360 (set once React has hydrated the page, and
// proved still there as it is measured); 200% text at 320 and 390 (every font size doubled, the status bar's too): no
// sideways scrolling, nothing out of its table cell, card or box, no price broken inside its number or "/ month". Stacked
// on a phone, Free is the first plan while paid plans aren't on sale, in the page as on the screen. The first screen:
// sideways (844x390) the home hero's Make my game and the line under it; /create?plan=medium signed out, the answer and
// Sign in, above the idea box, at 320, 390 and 844x390. The credits table's numbers are the API's own estimate (a change
// and a simple new game at "usually", then "about" a big one at the top of the range) and its dollars Medium's; the
// pricing FAQ keeps its seven questions and Paddle's text word for word; no demo video while its address is unset. Per
// state: the words under the prompt box, the pricing lead, every paid card's line and button, where Medium's button leads
// (signed out: the answer at the top, then Google; signed in: the closed-beta page's waitlist, or /create saying Medium
// isn't on sale and Free is how to start, with Build), the checkout and /billing with billing off, the home page's last
// box (its own prompt box, which hands its sentence to /create like the first).
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const args = process.argv.slice(2);
const onlyAt = args.indexOf("--only");
const only = onlyAt >= 0 ? args[onlyAt + 1] : null;
// The first argument that isn't a flag or --only's value (with no --only, onlyAt + 1 is 0: the first argument itself).
const out = args.find((a, i) => !a.startsWith("--") && (onlyAt < 0 || i !== onlyAt + 1)) ?? join(root, ".impeccable/review/launch");
const STATES = ["beta", "open"].filter((s) => !only || s === only);

const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("launch", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
const { estimate, PLAN_CREDITS, PLAN_PRICE_CENTS } = await import("../../server/dist/credits/credits.js");

/** facts.md "Phone shapes": every screen, every shape (CSS px). */
const SHAPES = [
  [320, 568],
  [360, 780],
  [375, 667],
  [390, 844],
  [412, 915],
  [430, 932],
  [844, 390],
  [768, 1024],
  [1280, 800],
  [1440, 900],
];
const PAID = [
  ["medium", "Medium"],
  ["high", "High"],
  ["ultra", "Ultra"],
  ["ultra-plus", "Ultra+"],
];

const stamp = Date.now().toString(36);
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok || !detail ? "" : `: ${detail}`}`);
};
let dir = out;
const shot = async (page, name, full = true) => {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(dir, `${name}.png`), fullPage: full });
};
const words = (s) => (s ?? "").replace(/\s+/g, " ").trim();
/** No sideways scrolling: the page no wider than the viewport the context was given (never window.innerWidth, which a
 * phone context grows with the page). */
const fits = (page) => page.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, page.viewportSize().width);

// ---- The stack --------------------------------------------------------------------------------------------------------
const children = [];
function start(name, cmd, cwd, env) {
  const child = spawn(process.execPath, cmd, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let log = "";
  child.stdout.on("data", (d) => (log = (log + d).slice(-4000)));
  child.stderr.on("data", (d) => (log = (log + d).slice(-4000)));
  const entry = { name, child };
  children.push(entry);
  return { child, log: () => log, stop: () => stop(entry) };
}
function stop(entry) {
  const { child } = entry;
  if (child.exitCode === null) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGKILL");
  }
  children.splice(children.indexOf(entry), 1);
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

/** Phones (upright and sideways, 844x390) and the tablet (768x1024) are touch screens; the laptop shapes have a mouse. */
const touch = (width, height) => Math.max(width, height) < 1100;
/** A fresh visitor: a context of its own (no session, no saved idea), touch on the touch shapes. */
async function visitor(width, height) {
  const phone = touch(width, height);
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  return { context, page: await context.newPage() };
}
async function open(page, path) {
  await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.locator("main").first().waitFor({ timeout: 120_000 });
  await page.evaluate(() => document.fonts.ready);
}
/** Down the page and back, so lazy pictures load before a whole-page shot. */
async function walkDown(page) {
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = page.viewportSize().height;
  for (let y = 0; y < h; y += step) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
}
/** Buttons and button-looking links in the page's main part shorter than 44 px (inline text links are exempt). */
const shortTargets = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main .button, main button")]
      .filter((el) => el.getClientRects().length)
      .map((el) => [el.textContent?.trim().slice(0, 30), Math.round(el.getBoundingClientRect().height)])
      .filter(([, h]) => h < 44),
  );
/** A press before React has woken the page (hydrated) posts the form natively, to the page itself: wait for React's
 * props on the element first (as shot-create-return does). */
const hydrated = (page, selector) =>
  page.waitForFunction((sel) => {
    const el = document.querySelector(sel);
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps"));
  }, selector, { timeout: 300_000 });
/** 200% text (a phone's large-text setting, WCAG 1.4.4), as the UI check emulates it: every element's computed font size
 * and line height doubled, all read first so none is doubled twice; the status bar's too. */
const doubleText = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")];
    const sizes = els.map((el) => {
      const cs = getComputedStyle(el);
      return [parseFloat(cs.fontSize), cs.lineHeight];
    });
    els.forEach((el, i) => {
      el.style.fontSize = `${sizes[i][0] * 2}px`;
      if (sizes[i][1].endsWith("px")) el.style.lineHeight = `${parseFloat(sizes[i][1]) * 2}px`;
    });
  });
/** What runs out of its box at the moment (each `[selector, box selector, what]`: the element itself and every line of its
 * visible text, bare text nodes too, inside its nearest box; screen-reader-only words don't count). */
const outOfBox = (page, pairs) =>
  page.evaluate((pairs) => {
    const bad = [];
    const rects = (el) => {
      const all = [el.getBoundingClientRect()];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim() || n.parentElement?.closest(".sr-only")) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        all.push(...range.getClientRects());
      }
      return all;
    };
    for (const [sel, boxSel, what] of pairs)
      for (const el of document.querySelectorAll(sel)) {
        const box = el.closest(boxSel)?.getBoundingClientRect();
        if (!box || !el.getClientRects().length || el.closest(".sr-only")) continue;
        const out = Math.max(0, ...rects(el).map((r) => Math.max(box.left - r.left, r.right - box.right)));
        if (out > 1) bad.push(`${what} "${el.textContent.trim().slice(0, 24)}" ${Math.round(out)}px out`);
      }
    return bad;
  }, pairs);
/** Pictures of single pieces of the page (`[selector, name]`), each scrolled into view: for pages too tall for one. */
async function pieces(page, prefix, list) {
  await page.evaluate(() => window.scrollTo(0, 0));
  for (const [sel, name] of list) {
    const el = page.locator(sel).first();
    if (await el.count()) await el.screenshot({ path: join(dir, `${prefix}-${name}.png`) }).catch(() => {});
  }
}
/** Where the page grows wider than the screen: the outermost pieces that stick out (not inside a box that clips). */
const stickingOut = (page) =>
  page.evaluate((vw) => {
    const desc = (el) => `${el.tagName.toLowerCase()}${el.classList.length ? "." + [...el.classList].join(".") : ""}`;
    const right = (el) => el.getBoundingClientRect().right;
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
      return false;
    };
    return [...document.querySelectorAll("body *")]
      .filter((el) => el.getClientRects().length && !el.closest(".sr-only, nextjs-portal") && right(el) > vw + 1 && !(el.parentElement && right(el.parentElement) > vw + 1) && !clipped(el))
      .slice(0, 6)
      .map((el) => `${desc(el)} to ${Math.round(right(el))}px`);
  }, page.viewportSize().width);
async function devSignIn(page, email) {
  await page.locator("#dev-email").waitFor({ timeout: 120_000 });
  await page.fill("#dev-email", email);
  await page.getByRole("button", { name: "Dev sign-in" }).click();
  await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
}

try {
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  browser = await chromium.launch({ channel: "msedge", headless: true });

  for (const state of STATES) {
    const beta = state === "beta";
    dir = join(out, state);
    mkdirSync(dir, { recursive: true });
    console.log(`\n---- ${beta ? "the closed beta" : "open sign-up, billing off"} ----`);
    const apiProc = start("api", ["dist/main.js"], serverDir, {
      PORT: String(API_PORT),
      DEV_AUTH: "1",
      AGENT_FAKE: "1",
      BETA_INVITE_ONLY: beta ? "1" : "",
      PADDLE_ENV: "",
      PADDLE_API_KEY: "", // the root .env.local carries the sandbox key; with PADDLE_ENV blank the API refuses to start
      ADMIN_EMAILS: "",
      CORS_ORIGINS: base,
      BILLING_JOBS: "0",
    });
    await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).inviteOnly === beta, 180, apiProc.log);
    const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
      NEXT_DIST_DIR: `.next/launch-${state}`,
      NEXT_PUBLIC_APP: "1",
      NEXT_PUBLIC_DEV_AUTH: "1",
      NEXT_PUBLIC_CLOSED_BETA: beta ? "1" : "",
      NEXT_PUBLIC_API_ORIGIN: apiBase,
      NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${GAMES_PORT}`,
      NEXT_PUBLIC_PADDLE_ENV: "",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
    });
    await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 300, siteProc.log);
    await until("the home page", async () => (await fetch(`${base}/`)).ok, 300, siteProc.log);
    console.log(`stack up: site :${SITE_PORT}, API :${API_PORT}, games :${GAMES_PORT}`);

    // ---- Both pages at every shape ----
    const wide = [];
    const short = [];
    for (const [w, h] of SHAPES) {
      const { context, page } = await visitor(w, h);
      for (const [name, path] of [
        ["home", "/"],
        ["pricing", "/pricing"],
      ]) {
        await open(page, path);
        await walkDown(page);
        if (!(await fits(page))) wide.push(`${name} ${w}x${h}`);
        if (touch(w, h)) for (const [label, px] of await shortTargets(page)) short.push(`${name} ${w}x${h} "${label}" ${px}px`);
        await shot(page, `${name}-${w}x${h}`);
      }
      await context.close();
      console.log(`shot ${w}x${h}`);
    }
    check(`${state}: home and pricing never wider than the screen, at all ${SHAPES.length} shapes`, wide.length === 0, wide.join(", "));
    check(`${state}: every button on both pages at least 44 px tall on the touch shapes`, short.length === 0, short.join("; "));

    // ---- Worst case (break-ui): bigger numbers, longer words and lines than today's, on the two smallest phones ----
    // Four-digit credits, a long unbroken word in a row's example and on a card, the billing-off lines three times over.
    // Nothing may push the page sideways or run out of a table cell. The page is changed only once React has hydrated it
    // (before that, hydration puts the real words back), and the check proves the worst case is still there as it measures.
    {
      const bad = [];
      for (const [w, h] of [
        [320, 568],
        [360, 780],
      ]) {
        const { context, page } = await visitor(w, h);
        await open(page, "/pricing");
        await hydrated(page, ".credits__usd");
        await hydrated(page, ".plan__action a");
        await page.evaluate(() => {
          const long = "Supercalifragilisticexpialidocious-level-select";
          document.querySelectorAll(".credits__num").forEach((n) => (n.innerHTML = "<small>about </small>1,300<small> credits</small>"));
          document.querySelectorAll(".credits__usd").forEach((n) => (n.textContent = "$260.00"));
          document.querySelectorAll(".credits__size span").forEach((n) => (n.textContent = `${n.textContent} ${long}`));
          document.querySelectorAll(".plan__off, .pricing__state").forEach((n) => (n.textContent = Array(3).fill(n.textContent).join(" ")));
          const li = document.querySelector(".plan li");
          if (li) li.append(` ${long}`);
        });
        await page.waitForTimeout(400);
        if (!(await fits(page))) bad.push(`pricing ${w}x${h} wider than the screen: ${(await stickingOut(page)).join(", ")}`);
        const clipped = await outOfBox(page, [
          [".credits__table th, .credits__table td", "th, td", "table cell"],
          [".credits__table", ".credits", "table"],
          [".plan li, .plan__off", ".plan", "card"],
        ]);
        if (clipped.length) bad.push(`pricing ${w}x${h} out of its box: ${clipped.join(" | ")}`);
        const there = await page.evaluate(
          () =>
            [...document.querySelectorAll(".credits__usd")].every((n) => n.textContent === "$260.00") &&
            [...document.querySelectorAll(".credits__num")].every((n) => n.textContent === "about 1,300 credits") &&
            (document.querySelector(".plan li")?.textContent ?? "").includes("Supercalifragilistic"),
        );
        if (!there) bad.push(`pricing ${w}x${h}: the worst case was gone when measured (hydration put the page back)`);
        await shot(page, `worst-pricing-${w}x${h}`);
        await open(page, "/");
        await hydrated(page, ".cta--start p");
        await hydrated(page, "#prompt");
        await page.evaluate(() => {
          const p = document.querySelector(".cta--start p");
          if (p) p.textContent = Array(3).fill(p.textContent).join(" ");
          document.querySelectorAll("#models .figures").forEach((f) => f.append(" about 1,300 credits a new game"));
        });
        await page.waitForTimeout(400);
        if (!(await fits(page))) bad.push(`home ${w}x${h} wider than the screen: ${(await stickingOut(page)).join(", ")}`);
        const homeThere = await page.evaluate(
          () =>
            (document.querySelector("#models .figures")?.textContent ?? "").includes("1,300") &&
            (document.querySelector(".cta--start p")?.textContent ?? "").length > 200,
        );
        if (!homeThere) bad.push(`home ${w}x${h}: the worst case was gone when measured (hydration put the page back)`);
        await shot(page, `worst-home-${w}x${h}`);
        await context.close();
      }
      check(`${state}: worst case (4-digit credits, long words, long lines) still fits at 320 and 360`, bad.length === 0, bad.join("; "));
    }

    // ---- 200% text on the two upright phones: both pages, the status bar included ----
    // No sideways scrolling; each table cell's words inside their own column; a price never broken inside its number,
    // "/ month" on one line; a card's line and button, Make my game and the last box's buttons, inside their boxes.
    {
      const bad = [];
      for (const [w, h] of [
        [320, 568],
        [390, 844],
      ]) {
        const { context, page } = await visitor(w, h);
        await open(page, "/pricing");
        await hydrated(page, ".plan__action a");
        await doubleText(page);
        await page.waitForTimeout(400);
        if (!(await fits(page))) bad.push(`pricing ${w}x${h} wider than the screen: ${(await stickingOut(page)).join(", ")}`);
        bad.push(
          ...(await outOfBox(page, [
            [".credits__table th, .credits__table td", "th, td", "table cell"],
            [".credits__table", ".credits", "table"],
            [".plan__price, .plan__off, .plan__action .button", ".plan, .pack", "card"],
          ])).map((b) => `pricing ${w}x${h} ${b}`),
        );
        const prices = await page.locator(".plan__price").evaluateAll((els) =>
          els.map((el) => {
            const small = el.querySelector("small");
            const number = document.createRange();
            number.setStart(el, 0);
            if (small) number.setEndBefore(small);
            else number.setEnd(el, el.childNodes.length);
            const lines = (rects) => new Set([...rects].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
            return { price: el.textContent, number: lines(number.getClientRects()), period: small ? lines(small.getClientRects()) : 1 };
          }),
        );
        for (const p of prices) {
          if (p.number > 1) bad.push(`pricing ${w}x${h} "${p.price}": the number breaks over ${p.number} lines`);
          if (p.period > 1) bad.push(`pricing ${w}x${h} "${p.price}": "/ month" breaks over ${p.period} lines`);
        }
        await walkDown(page);
        await shot(page, `zoom200-pricing-${w}x${h}`);
        // A page this tall passes the browser's largest picture (about 16,000 px): the parts that matter, each on its own.
        await shot(page, `zoom200-pricing-${w}x${h}-top`, false);
        await pieces(page, `zoom200-pricing-${w}x${h}`, [
          [".plans:not(.plans--big)", "plans"],
          [".plans--big", "big-plans"],
          [".credits", "table"],
        ]);
        await open(page, "/");
        await hydrated(page, "#prompt-end");
        await doubleText(page);
        await page.waitForTimeout(400);
        if (!(await fits(page))) bad.push(`home ${w}x${h} wider than the screen: ${(await stickingOut(page)).join(", ")}`);
        bad.push(
          ...(await outOfBox(page, [
            [".cta--start .button", ".cta--start", "last box"],
            [".prompt__field .button", ".prompt__field", "prompt box"],
          ])).map((b) => `home ${w}x${h} ${b}`),
        );
        await walkDown(page);
        await shot(page, `zoom200-home-${w}x${h}`);
        await shot(page, `zoom200-home-${w}x${h}-top`, false);
        await pieces(page, `zoom200-home-${w}x${h}`, [
          [".ship", "ship"],
          [".cta--start", "endbox"],
        ]);
        await context.close();
      }
      check(`${state}: 200% text fits at 320 and 390 (table cells, prices, cards' lines and buttons, the prompt boxes' and last box's buttons, the status bar)`, bad.length === 0, bad.join("; "));
    }

    // ---- The plans' order on a phone: Free first while paid plans aren't on sale, in the page as on the screen ----
    {
      const { context, page } = await visitor(390, 844);
      await open(page, "/pricing");
      const cards = await page.locator(".plans:not(.plans--big) .plan").evaluateAll((els) =>
        els.map((el) => [el.querySelector(".plan__name")?.textContent, Math.round(el.getBoundingClientRect().top)]),
      );
      const shown = [...cards].sort((a, b) => a[1] - b[1]).map(([n]) => n);
      const inPage = cards.map(([n]) => n);
      check(`pricing (${state}): stacked at 390, Free is the first card, and the screen's order is the page's (Tab's)`, shown[0] === "Free" && shown.join() === inPage.join(), `shown ${shown.join(", ")}; in the page ${inPage.join(", ")}`);
      await context.close();
    }

    // ---- The first screen: the hero's box and Make my game sideways; /create?plan= signed out, the answer and Sign in ----
    {
      const { context, page } = await visitor(844, 390);
      await open(page, "/");
      const hero = await page.evaluate(() => {
        const button = document.querySelector(".home__widget button[type=submit]")?.getBoundingClientRect();
        const hint = document.querySelector("#prompt-hint")?.getBoundingClientRect();
        return { button: button ? Math.round(button.bottom) : null, hint: hint ? Math.round(hint.bottom) : null };
      });
      check(`home (${state}): sideways (844x390), Make my game and the line under it on the first screen`, hero.button !== null && hero.button <= 390 && hero.hint !== null && hero.hint <= 390, JSON.stringify(hero));
      await shot(page, "first-home-844x390", false);
      await context.close();
      const late = [];
      for (const [w, h] of [
        [320, 568],
        [390, 844],
        [844, 390],
      ]) {
        const { context, page } = await visitor(w, h);
        await open(page, "/create?plan=medium");
        await page.locator(".signin .field-hint").waitFor({ timeout: 120_000 });
        const at = await page.evaluate(() => {
          const bottom = (sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r ? Math.round(r.bottom) : null;
          };
          const top = (sel) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            return r ? Math.round(r.top) : null;
          };
          return { lead: bottom(".make__lead"), signIn: bottom(".signin > :first-child"), signInTop: top(".signin"), idea: top("#idea") };
        });
        if (at.lead === null || at.lead > h) late.push(`${w}x${h} the answer ends at ${at.lead}`);
        if (at.signIn === null || at.signIn > h) late.push(`${w}x${h} Sign in ends at ${at.signIn}`);
        if (at.signInTop === null || at.idea === null || at.signInTop > at.idea) late.push(`${w}x${h} Sign in is under the idea box`);
        await shot(page, `first-create-plan-signed-out-${w}x${h}`, false);
        await context.close();
      }
      check(`/create?plan=medium (${state}), signed out: the answer and Sign in on the first screen, above the idea box, at 320, 390 and 844x390`, late.length === 0, late.join("; "));
    }

    // ---- Pricing at 1440: the table, the cards, the FAQ ----
    {
      const { context, page } = await visitor(1440, 900);
      await open(page, "/pricing");
      const cells = await page.locator(".credits__row").evaluateAll((rows) =>
        rows.map((r) => [...r.querySelectorAll(".credits__cell")].map((c) => [c.querySelector(".credits__num")?.textContent, c.querySelector(".credits__usd")?.textContent])),
      );
      const perCredit = PLAN_PRICE_CENTS.medium / 100 / PLAN_CREDITS.medium;
      const want = [
        ["fast", "smart", "best"].map((m) => estimate("edit", m, "medium", "medium").typical),
        ["fast", "smart", "best"].map((m) => estimate("new", m, "medium", "medium").typical),
        ["fast", "smart", "best"].map((m) => estimate("new", m, "medium", "medium").high),
      ];
      const got = cells.map((row) => row.map(([n]) => words(n)));
      const expected = want.map((row, i) => row.map((n) => `${i === 2 ? "about " : ""}${n} credits`));
      check("pricing: the credits table is the API's estimate (a change, a simple new game, then \"about\" a big one at the top of the range; Fast, Smart, Best)", JSON.stringify(got) === JSON.stringify(expected), JSON.stringify(got));
      const usd = cells.map((row) => row.map(([, d]) => words(d)));
      const usdWant = want.map((row) => row.map((n) => `$${(n * perCredit).toFixed(2)}`));
      check("pricing: each number's dollars at Medium's price", JSON.stringify(usd) === JSON.stringify(usdWant), JSON.stringify(usd));
      check("pricing: the table has its row and column headers", (await page.locator(".credits__table th[scope=row]").count()) === 3 && (await page.locator(".credits__table th[scope=col]").count()) === 3);
      check("pricing: the AI headers say who has them (Fast on Free too, Smart and Best on paid plans)", words(await page.locator(".credits__head").innerText()) === "Fast On Free too Smart Paid plans Best Paid plans", words(await page.locator(".credits__head").innerText()));
      const faq = await page.locator(".faq b").allTextContents();
      check("pricing: the FAQ keeps its questions, with the download one", faq.join("|") === "What is a credit?|Does Ultra make better games?|What if I run out?|Can I change plans?|Can I cancel or get a refund?|Can I download my game?|Who are you buying from?", faq.join("|"));
      check(
        "pricing: Paddle's text word for word",
        words(await page.locator(".faq .faq__wide p").textContent()) === "Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Paddle provides all customer service inquiries and handles returns.",
      );
      check("pricing: the credit pack is shown, with its price and credits", /40 credits for \$10, on any paid plan/.test(words(await page.locator(".pack").textContent())));
      const lead = words(await page.locator(".pricing__state").textContent().catch(() => ""));
      check(
        `pricing (${state}): the lead says paid plans aren't on sale yet`,
        lead === (beta ? "TypePlay is in a closed beta: building is by invitation, and paid plans aren't on sale yet." : "Paid plans aren't on sale yet. Free is how to start."),
        lead,
      );
      check("pricing: no Get Medium / High / Ultra / Ultra+ while billing is off", (await page.getByRole("link", { name: /^Get (Medium|High|Ultra)/ }).count()) === 0);
      const cards = await page.locator(".plan").evaluateAll((els) =>
        els.map((el) => ({ name: el.querySelector(".plan__name")?.textContent, off: el.querySelector(".plan__off")?.textContent ?? null, button: el.querySelector(".plan__action a")?.textContent, href: el.querySelector(".plan__action a")?.getAttribute("href") })),
      );
      const freeCard = cards.find((c) => c.name === "Free");
      check("pricing: Free's card says Start free, to /create, with no line", freeCard?.button === "Start free" && freeCard.href === "/create" && freeCard.off === null, JSON.stringify(freeCard));
      const cardLine = beta ? "Not on sale during the closed beta." : "Not on sale yet. Free is how to start.";
      const cardButton = beta ? "Join the waitlist" : "Start free";
      const wrong = PAID.map(([id, name]) => [cards.find((c) => c.name === name), id]).filter(([c, id]) => !c || c.off !== cardLine || c.button !== cardButton || c.href !== `/create?plan=${id}`);
      check(`pricing (${state}): each paid card says "${cardLine}" over "${cardButton}", to /create?plan=`, wrong.length === 0, JSON.stringify(wrong));
      check("pricing: the lead links to the credits table", (await page.locator(".section--top .lead a[href='#credits']").count()) === 1);
      await context.close();
    }

    // ---- Home at 1440: the words by state, the last box ----
    {
      const { context, page } = await visitor(1440, 900);
      await open(page, "/");
      const hint = words(await page.locator("#prompt-hint").textContent());
      check(
        `home (${state}): the words under the prompt box`,
        hint === (beta ? "A closed beta for now, by invitation. No coding needed; it plays right here in the browser." : "Free to start. No coding needed. It plays right here in the browser."),
        hint,
      );
      check("home: no demo video while its address is unset (content/demo.ts)", (await page.locator("#video").count()) === 0);
      check("home: no test-era words (\"Test games\")", !(await page.locator("main").textContent()).includes("Test games"));
      const endLine = words(await page.locator(".cta--start p").first().textContent());
      check(
        `home (${state}): the last box's line`,
        endLine ===
          (beta
            ? "20 free credits a month on Fast, once sign-up opens. During the closed beta, building is by invitation."
            : "20 free credits a month on Fast, played in the browser. Paid plans, from $20 a month, aren't on sale yet."),
        endLine,
      );
      check("home: the last box points at the credits table", (await page.locator(".cta--start a[href='/pricing#credits']").count()) === 1);
      check("home: the AI list says what a new game usually costs, and links the table", /about 15 credits a new game/.test(await page.locator("#models").textContent()) && (await page.locator("#models a[href='/pricing#credits']").count()) === 1);
      check("home: the games strip links the gallery", (await page.locator("#games a[href='/explore']").count()) === 1);
      // The last box is a prompt box of its own: its sentence goes to /create like the first's.
      const idea = `Make a racing game where a snail races snails on a garden path ${stamp}`;
      await hydrated(page, "#prompt-end");
      await page.locator("#prompt-end").fill(idea);
      await page.locator(".cta--start").getByRole("button", { name: "Make my game" }).click();
      await page.waitForURL(/\/create/, { timeout: 120_000 });
      await page.locator("#idea").waitFor({ timeout: 120_000 });
      check("home: the last box's Make my game opens /create with its sentence", (await page.locator("#idea").inputValue()) === idea);
      const note = words(await page.locator(".signin .field-hint").textContent({ timeout: 60_000 }));
      check(
        `the path (${state}): before Google, /create says ${beta ? "the closed beta and the waitlist" : "Free and that the idea is kept"}`,
        beta
          ? note === "A closed beta for now: sign in with Google, then type the beta code from your invitation. No code yet? Sign in anyway to join the waitlist. Your idea stays here."
          : note === "Free to start: 20 credits a month on Fast. Your idea stays here while you sign in, ready to build.",
        note,
      );
      await shot(page, "path-create-signed-out-1440", false);
      await context.close();
    }

    // ---- The path from Medium's card, signed out then signed in, at 390 ----
    {
      const { context, page } = await visitor(390, 844);
      await open(page, "/pricing");
      const medium = page.locator(".plan--lead .plan__action a");
      await medium.scrollIntoViewIfNeeded();
      await shot(page, "path-pricing-medium-390", false);
      await medium.click();
      await page.waitForURL(/\/create\?plan=medium/, { timeout: 120_000 });
      const note = words(await page.locator(".signin .field-hint").textContent({ timeout: 120_000 }));
      const answer = words(await page.locator(".make__lead").textContent({ timeout: 60_000 }));
      check(
        `the path (${state}): Medium's button, signed out, answers at the top that Medium isn't on sale ${beta ? "and how the closed beta works" : "and Free is how to start"}, then Sign in`,
        beta
          ? answer === "Medium isn't on sale yet. A closed beta for now: sign in with Google, then type the beta code from your invitation. No code yet? Sign in anyway to join the waitlist." &&
              note === "Your idea stays here while you sign in."
          : answer === "Medium isn't on sale yet. Free is how to start: 20 credits a month on Fast, up to 5 a day." && note === "Your idea stays here while you sign in, ready to build.",
        `${answer} | ${note}`,
      );
      await shot(page, "path-create-plan-signed-out-390", false);
      const email = `launch-${state}-${stamp}@dev.test`;
      await devSignIn(page, email);
      if (beta) {
        const ask = page.getByRole("button", { name: "Tell me when it opens" });
        await ask.waitFor({ timeout: 120_000 });
        check("the path (beta): signed in without an invitation, Medium's path ends at the closed-beta page's waitlist", await ask.isVisible());
        await shot(page, "path-closed-beta-390", true);
      } else {
        const lead = page.locator(".make__lead");
        await lead.waitFor({ timeout: 120_000 });
        check(
          "the path (open): signed in, /create?plan=medium stays and says Medium isn't on sale yet, Free is how to start",
          words(await lead.textContent()) === "Medium isn't on sale yet. Free is how to start: 20 credits a month on Fast, up to 5 a day." && page.url().includes("/create"),
          words(await lead.textContent()),
        );
        check("the path (open): the composer and Build my game are there", await page.getByRole("button", { name: "Build my game" }).isVisible({ timeout: 60_000 }));
        await shot(page, "path-create-plan-signed-in-390", true);
        await page.goto(`${base}/billing/checkout?item=plan:medium`, { waitUntil: "domcontentloaded" });
        const checkoutLead = page.locator(".make__lead", { hasText: "on sale yet" });
        await checkoutLead.waitFor({ timeout: 120_000 });
        check(
          "the path (open): the checkout says Medium isn't on sale yet, Free is how to start, with Make a game; no tick box",
          words(await checkoutLead.textContent()) === "Medium isn't on sale yet. Free is how to start: 20 credits a month on Fast, up to 5 a day." &&
            (await page.getByRole("link", { name: "Make a game" }).getAttribute("href")) === "/create" &&
            (await page.locator(".checkbox").count()) === 0,
          words(await checkoutLead.textContent()),
        );
        await shot(page, "path-checkout-off-390", true);
        await page.goto(`${base}/billing`, { waitUntil: "domcontentloaded" });
        const billing = page.locator(".make__lead", { hasText: "You are on Free" });
        await billing.waitFor({ timeout: 120_000 });
        check("the path (open): /billing says the plan, and that paid plans aren't on sale yet", words(await billing.textContent()).endsWith("Paid plans aren't on sale yet."), words(await billing.textContent()));
      }
      await context.close();
    }

    siteProc.stop();
    apiProc.stop();
  }
} catch (e) {
  check("the walk ran to the end", false, e instanceof Error ? e.stack : String(e));
} finally {
  await browser?.close().catch(() => {});
  for (const entry of [...children].reverse()) stop(entry);
  // `next dev` with its own NEXT_DIST_DIR adds its type folders to tsconfig.json: put the file back as it was.
  if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed${failed.length ? `; failed: ${failed.map((f) => f.name).join("; ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
