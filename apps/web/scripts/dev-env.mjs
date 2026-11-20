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

/** 200% text (a phone's large-text setting), as shot-launch emulates it: every font size and line height doubled. */
export const doubleText = (page) =>
  page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")];
    const sizes = els.map((el) => [parseFloat(getComputedStyle(el).fontSize), getComputedStyle(el).lineHeight]);
    els.forEach((el, i) => {
      el.style.fontSize = `${sizes[i][0] * 2}px`;
      if (sizes[i][1].endsWith("px")) el.style.lineHeight = `${parseFloat(sizes[i][1]) * 2}px`;
    });
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
