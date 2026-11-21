// The env the screenshot scripts share with the API they drive (docs/environments.md): this PC's development database
// (typeplay_dev, from .env.development), never the live one. Needs the API built (npm run build -w @typeplay/server).
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { freePorts, lock, runDatabase } from "../../../scripts/test-run.mjs";

const root = join(import.meta.dirname, "../../..");

export async function useDevEnv() {
  const { assertLocalDatabase, loadEnvFiles } = await import("../../server/dist/env-files.js");
  loadEnvFiles(root, "development");
  assertLocalDatabase(process.env.DATABASE_URL, "development");
}

/**
 * For a walk-through that starts a stack of its own (shot-beta, shot-compare, shot-kinds, shot-platform, shot-queue), so
 * any number of them, from any checkout, run at once beside the local site and the tests (scripts/test-run.mjs): the env above,
 * then a database of the run's own (typeplay_autotest_shot_<name>_<id>, dropped at the end) that the API it starts and
 * the admin CLI use instead of typeplay_dev, and `count` ports picked free. First it waits for this checkout's `next dev`
 * to be its own: two walk-throughs in one checkout would share tsconfig.json (`next dev` writes its type folders into
 * it, and each puts it back as it found it) and, the same one twice, its .next folder. Other checkouts never wait.
 */
export async function useOwnStack(name, count) {
  await useDevEnv();
  await ownNextDev();
  const { url } = await runDatabase(`shot_${name}`);
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  return freePorts(count);
}

/** This checkout's `next dev` for this walk-through alone, until it exits (see above); held, it returns at once. */
export const ownNextDev = () => lock(`next dev in ${join(root, "apps/web")}`);

/** 200% text (a phone's large-text setting), as shot-launch emulates it: every font size and line height doubled. Not
 * the stand-in for Google's sign-in button (gis-stub.mjs): Google's real one is its own page in a frame of the size we
 * ask for, which draws its words itself, so its doubled words in a 40px pill would be a fault of the stand-in only.
 * Then the viewport one pixel wider and back: Edge keeps a container query in em (the large-text layouts: IconChoice,
 * the credits table) as it was until a container's size changes, not its font size, and a phone's setting is there
 * before the page is first laid out (2026-11-21). */
export const doubleText = async (page) => {
  await page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")].filter((el) => !el.closest(".stub-gis"));
    const sizes = els.map((el) => [parseFloat(getComputedStyle(el).fontSize), getComputedStyle(el).lineHeight]);
    els.forEach((el, i) => {
      el.style.fontSize = `${sizes[i][0] * 2}px`;
      if (sizes[i][1].endsWith("px")) el.style.lineHeight = `${parseFloat(sizes[i][1]) * 2}px`;
    });
  });
  const vp = page.viewportSize();
  if (vp) {
    await page.setViewportSize({ width: vp.width + 1, height: vp.height });
    await page.setViewportSize(vp);
  }
};

/** Where the page grows wider than the screen: its width, and the outermost pieces that stick out (not inside a box that
 * clips; screen-reader-only words and Next's dev overlay don't count), then words that run out of a box that stays inside.
 * `{ width, screen, parts }`. */
export const wideParts = (page) =>
  page.evaluate(() => {
    const vw = window.innerWidth;
    const desc = (el) => `${el.tagName.toLowerCase()}${el.classList.length ? "." + [...el.classList].join(".") : ""}`;
    const right = (el) => el.getBoundingClientRect().right;
    const clipped = (el) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== "visible") return true;
      return false;
    };
    const out = [...document.querySelectorAll("body *")].filter((el) => el.getClientRects().length && !el.closest(".sr-only, nextjs-portal") && right(el) > vw + 1 && !clipped(el));
    // The outermost pieces past the edge; when the page itself grew (a grid or flex box made as wide as what is in it, so
    // every box up to <body> is past the edge), the innermost ones instead: what made it grow.
    let picked = out.filter((el) => !(el.parentElement && out.includes(el.parentElement)));
    if (!picked.length || picked.every((el) => el.parentElement === document.body)) picked = out.filter((el) => ![...el.children].some((c) => out.includes(c)));
    const parts = picked.slice(0, 6).map((el) => `${desc(el)} to ${Math.round(right(el))}px`);
    // Words that run past the edge out of a box that doesn't (an unbreakable address in a paragraph): their text, too.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && parts.length < 10; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent.trim() || el.closest("svg, .wallpaper, .sr-only, nextjs-portal, script, style") || clipped(el) || right(el) > vw + 1) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width && r.right > vw + 1) parts.push(`"${n.textContent.trim().slice(0, 40)}" in ${desc(el)} to ${Math.round(r.right)}px`);
    }
    // Still nothing while the page is wider: the innermost boxes past the edge, inside a clipping box or not (an
    // absolutely placed box is clipped only by a box it is placed in), drawings and screen-reader-only words too.
    if (!parts.length && document.documentElement.scrollWidth > vw) {
      const all = [...document.querySelectorAll("body *")].filter((el) => el.getClientRects().length && !el.closest(".wallpaper, nextjs-portal") && right(el) > vw + 1);
      for (const el of all.filter((el) => ![...el.children].some((c) => all.includes(c))).slice(0, 6)) parts.push(`${desc(el)} to ${Math.round(right(el))}px (in a clipping box)`);
    }
    return { width: document.documentElement.scrollWidth, screen: vw, parts };
  });

/** Words the layout breaks across two lines inside the word (a large-text fault: "Platforme / r"), each with where it is
 * and whether the browser may show a hyphen there (a soft hyphen in the word, or `hyphens: auto`). A hyphen, dash or
 * slash is a place to break, so "power-up" is two words, and so are an address's places (ui/Address.tsx): after "@" and
 * "_", before a dot that starts a word ("hello@" / "typeplay.app" is not a broken word; "1.2K" stays one word). A word
 * wider than the page's column it is in is named "(longer than its line)": breaking it is right, the others are faults. Visible text only; screen-reader-only words, Next's dev overlay and logs (`pre`: machine text, which by convention breaks
 * anywhere) don't count. */
export const brokenWords = (page) =>
  page.evaluate(() => {
    const found = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && found.length < 12; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || !n.textContent.trim() || el.closest(".sr-only, nextjs-portal, script, style, noscript, [hidden], pre")) continue;
      for (const m of n.textContent.matchAll(/[^\s\-\u2010\u2013\u2014/@_.]+(?:\.(?![A-Za-z])[^\s\-\u2010\u2013\u2014/@_.]*)*/g)) {
        if (m[0].replace(/\u00AD/g, "").length < 2) continue;
        const range = document.createRange();
        range.setStart(n, m.index);
        range.setEnd(n, m.index + m[0].length);
        const rects = [...range.getClientRects()].filter((r) => r.width > 0);
        const tops = rects.map((r) => Math.round(r.top));
        if (tops.length < 2 || Math.max(...tops) - Math.min(...tops) < 4) continue;
        // Longer than any line it could have: wider, whole, than the page's column it is in (the nearest box at least 60%
        // of the screen wide: a card's inside, a widget's), as a 7-letter word in a 72px headline on a 280px phone.
        // Breaking that one is the only way; the fault is a word that would fit (a narrow column, a pill beside it).
        let box = el;
        while (box.parentElement && box !== document.body && box.getBoundingClientRect().width < 0.6 * window.innerWidth) box = box.parentElement;
        const bs = getComputedStyle(box);
        const room = box.clientWidth - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight);
        const whole = rects.reduce((sum, r) => sum + r.width, 0);
        const longer = whole > room - 1; // broken, so not whole on a line: its pieces' sum can round to the room itself
        const cs = getComputedStyle(el);
        const hyphen = m[0].includes("\u00AD") || cs.hyphens === "auto";
        const where = el.closest("h1, h2, h3, button, a, label, p, li, td, th, dd, dt, span, div") ?? el;
        found.push(`"${m[0].replace(/\u00AD/g, "")}" in ${where.tagName.toLowerCase()}${where.classList.length ? "." + [...where.classList].join(".") : ""}${hyphen ? " (hyphen)" : ""}${longer ? " (longer than its line)" : ""}`);
      }
    }
    return found;
  });

/** A checkout without the root .env (a fresh worktree): the site's public Supabase values (content/app.ts, the URL and
 * the publishable key, nothing secret) stand in for the API this process starts. Set values are kept. */
export function fillPublicSupabase() {
  const appTs = readFileSync(join(root, "apps/web/src/content/app.ts"), "utf8");
  const pick = (marker) => appTs.match(new RegExp(`"([^"]+)", // ${marker}`))?.[1] ?? "";
  process.env.SUPABASE_URL ||= pick("supabase:url");
  process.env.SUPABASE_PUBLISHABLE_KEY ||= pick("supabase:publishableKey");
}

/**
 * The stack a walk-through of its own drives (2026-11-20, for shot-search and shot-gallery alone), on the three ports
 * useOwnStack gave: the API (DEV_AUTH=1, AGENT_FAKE=1: fake builds) on the run's database, the games origin, and the site
 * as `next dev` (an app build with dev sign-in, the closed beta and billing off) in `.next/<name>`. Needs the API built
 * and, for the games to play, the engine and a demo build in apps/games (git-ignored: a checkout without them copies
 * apps/games/engine and builds/robot-runner from the main one). The site's public Supabase values (content/app.ts) stand
 * in when the root .env isn't there, as in a fresh worktree. `stopApi()` ends the API alone (a check with the API down),
 * `startApi()` brings it back;
 * `stop()` ends everything and puts tsconfig.json back (`next dev` writes its type folders into it).
 */
export async function startStack(name, [sitePort, apiPort, gamesPort], { api = {}, site = {} } = {}) {
  const webDir = join(root, "apps/web");
  fillPublicSupabase();
  const tsconfig = join(webDir, "tsconfig.json");
  const tsconfigBefore = readFileSync(tsconfig, "utf8");
  const children = [];
  const start = (label, args, cwd, env) => {
    const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let log = "";
    child.stdout.on("data", (d) => (log = (log + d).slice(-4000)));
    child.stderr.on("data", (d) => (log = (log + d).slice(-4000)));
    children.push(child);
    return { child, log: () => log };
  };
  const kill = (child) => {
    if (child.exitCode !== null) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGKILL");
  };
  const until = async (what, test, seconds, log) => {
    for (let i = 0; i < seconds * 2; i++) {
      if (await test().catch(() => false)) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`${what} did not start: ${log?.() ?? ""}`);
  };
  const base = `http://localhost:${sitePort}`;
  const apiBase = `http://127.0.0.1:${apiPort}`;
  const gamesBase = `http://127.0.0.1:${gamesPort}`;
  const stop = () => {
    for (const child of children.reverse()) kill(child);
    writeFileSync(tsconfig, tsconfigBefore);
  };
  try {
    let apiProc = null;
    const startApi = async () => {
      apiProc = start("api", ["dist/main.js"], join(root, "apps/server"), { PORT: String(apiPort), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0", ...api });
      await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
    };
    await startApi();
    const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(gamesPort)], root, {});
    await until("the games origin", async () => (await fetch(`${gamesBase}/play.html`)).ok, 30, gamesProc.log);
    const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(sitePort)], webDir, {
      NEXT_DIST_DIR: `.next/${name}`,
      NEXT_PUBLIC_APP: "1",
      NEXT_PUBLIC_DEV_AUTH: "1",
      NEXT_PUBLIC_CLOSED_BETA: "",
      NEXT_PUBLIC_API_ORIGIN: apiBase,
      NEXT_PUBLIC_GAMES_ORIGIN: gamesBase,
      NEXT_PUBLIC_PADDLE_ENV: "",
      NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
      ...site,
    });
    await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 240, siteProc.log);
    console.log(`stack up: site :${sitePort}, API :${apiPort}, games :${gamesPort}`);
    // apiLog: the API's last output, for a check that finds it gone (its exit code is in apiExit); startApi: back after
    // stopApi, on the same port.
    return { base, apiBase, gamesBase, stopApi: () => kill(apiProc.child), startApi, apiLog: () => apiProc.log(), apiExit: () => apiProc.child.exitCode ?? apiProc.child.signalCode, siteLog: siteProc.log, stop };
  } catch (e) {
    stop();
    throw e;
  }
}
