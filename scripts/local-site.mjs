// The local site for Luka (UX batch 2.3, 10-24): this checkout's app on this PC, to look at changes without a deploy.
//   node scripts/local-site.mjs start    builds once, then runs everything in the background; it keeps running after the
//                                        terminal (or the session that started it) is closed, until `stop`
//   node scripts/local-site.mjs update   rebuilds the site and the API from the current files and restarts them
//   node scripts/local-site.mjs stop
//   node scripts/local-site.mjs status
// Open http://localhost:3000 and sign in with Google (Supabase only signs people in; everything else is local). The
// site runs from a built copy (`next start`, the API from apps/server/dist-site), so edits in this folder reach it only
// with `update`: work in progress never lands on the open page. Real builds, on this PC's Claude login (as
// `npm run dev`), charged in credits as on the live site. Its own database: a Postgres 17 of its own on :54329
// (portable binaries in data/local-site/pg), never the live one. The first start seeds Luka's account (Ultra+, 1,300
// credits) and the six showcase games (the polished ones) in the gallery.
// Everything runs below normal priority on 12 of the 16 cores (packages/agent/tools/cpu.mjs). Logs: data/local-site/logs.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STATE = join(ROOT, "data", "local-site");
const LOGS = join(STATE, "logs");
const CONTROL = join(STATE, "control");
const PID_FILE = join(STATE, "supervisor.json");
const PG_PKG = "@embedded-postgres/windows-x64@17.10.0-beta.17";
const PG_BIN = join(STATE, "pg", "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
const PG_DATA = join(STATE, "pgdata");
const PG_PORT = 54329;
const DB_URL = `postgres://postgres@127.0.0.1:${PG_PORT}/typeplay?sslmode=disable`;
const PORTS = { web: 3000, games: 3001, api: 3002 };
const OWNER_EMAIL = process.env.LOCAL_SITE_EMAIL ?? "lazarashvili02@gmail.com";
const node = process.execPath;
const mod = (...p) => join(ROOT, "node_modules", ...p);

const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const supervisorPid = () => {
  try {
    const { pid } = JSON.parse(readFileSync(PID_FILE, "utf8"));
    return alive(pid) ? pid : null;
  } catch {
    return null;
  }
};
const killTree = (pid) => spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
/** Runs a build step in this process's window; throws with the tail of its output when it fails. */
function step(what, cmd, args, opts = {}) {
  log(`  ${what}…`);
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: "utf8", windowsHide: true, ...opts, env: { ...process.env, ...opts.env } });
  if (r.status !== 0) throw new Error(`${what} failed:\n${`${r.stdout ?? ""}${r.stderr ?? ""}`.slice(-2000)}`);
  return r.stdout ?? "";
}

// ---- Health -------------------------------------------------------------------------------------------------------
async function up(name) {
  const url = { web: `http://127.0.0.1:${PORTS.web}/`, games: `http://127.0.0.1:${PORTS.games}/play.html`, api: `http://127.0.0.1:${PORTS.api}/health` }[name];
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000) });
    return r.ok;
  } catch {
    return false;
  }
}
async function status() {
  const pid = supervisorPid();
  const s = Object.fromEntries(await Promise.all(Object.keys(PORTS).map(async (n) => [n, await up(n)])));
  let phase = "";
  try {
    phase = JSON.parse(readFileSync(join(STATE, "status.json"), "utf8")).phase;
  } catch {
    // never started
  }
  return { running: !!pid, pid, phase, ...s };
}
async function waitReady(seconds) {
  let last = "";
  for (let i = 0; i < seconds / 2; i++) {
    const s = await status();
    if (s.phase !== last && s.phase) log(`  ${s.phase}`);
    last = s.phase;
    if (s.web && s.games && s.api && s.phase === "ready") return true;
    if (!s.running && i > 5) return false;
    await sleep(2000);
  }
  return false;
}

// ---- Builds (the copy the site runs) ------------------------------------------------------------------------------
function buildSite() {
  log("Building the local site from this folder's files (1-3 min):");
  step("the API's database client", node, [mod("prisma", "build", "index.js"), "generate"], { cwd: join(ROOT, "apps", "server") });
  step("the API", node, [mod("typescript", "bin", "tsc"), "-p", "tsconfig.json", "--outDir", "dist-site"], { cwd: join(ROOT, "apps", "server") });
  // next build may add its dist folder's types to tsconfig.json: put the file back as it was.
  const tsconfig = join(ROOT, "apps", "web", "tsconfig.json");
  const before = readFileSync(tsconfig, "utf8");
  try {
    step("the site (next build)", node, [mod("next", "dist", "bin", "next"), "build"], {
      cwd: join(ROOT, "apps", "web"),
      env: { NEXT_PUBLIC_APP: "1", NEXT_DIST_DIR: ".next/site", NEXT_TELEMETRY_DISABLED: "1" },
    });
  } finally {
    if (readFileSync(tsconfig, "utf8") !== before) writeFileSync(tsconfig, before);
  }
  writeFileSync(join(STATE, "built.json"), JSON.stringify({ at: new Date().toISOString() }));
}

// ---- Postgres -----------------------------------------------------------------------------------------------------
const pgCtl = (...args) => spawnSync(join(PG_BIN, "pg_ctl.exe"), args, { encoding: "utf8", windowsHide: true });
function startPostgres() {
  if (!existsSync(join(PG_BIN, "postgres.exe"))) {
    mkdirSync(join(STATE, "pg"), { recursive: true });
    spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["install", "--no-audit", "--no-fund", "--no-save", "--prefix", join(STATE, "pg"), PG_PKG], {
      stdio: "inherit",
      shell: true,
      windowsHide: true,
    });
  }
  if (!existsSync(join(PG_DATA, "PG_VERSION"))) {
    const r = spawnSync(join(PG_BIN, "initdb.exe"), ["-D", PG_DATA, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"], { encoding: "utf8", windowsHide: true });
    if (r.status !== 0) throw new Error(`initdb: ${r.stderr}`);
  }
  if (pgCtl("status", "-D", PG_DATA).status !== 0) {
    // No pipes: postgres inherits pg_ctl's handles, and a captured output would wait for postgres to end.
    spawnSync(join(PG_BIN, "pg_ctl.exe"), ["start", "-w", "-D", PG_DATA, "-l", join(LOGS, "postgres.log"), "-o", `-p ${PG_PORT} -h 127.0.0.1`], {
      stdio: "ignore",
      windowsHide: true,
    });
    if (pgCtl("status", "-D", PG_DATA).status !== 0) throw new Error(`postgres did not start (see ${join(LOGS, "postgres.log")})`);
  }
}
async function sql(text, params = []) {
  const { default: pg } = await import(`file://${mod("pg", "lib", "index.js").replaceAll("\\", "/")}`);
  const c = new pg.Client({ connectionString: DB_URL });
  await c.connect();
  try {
    return (await c.query(text, params)).rows;
  } finally {
    await c.end();
  }
}
async function prepareDatabase() {
  const { default: pg } = await import(`file://${mod("pg", "lib", "index.js").replaceAll("\\", "/")}`);
  const c = new pg.Client({ connectionString: DB_URL.replace("/typeplay?", "/postgres?") });
  await c.connect();
  if (!(await c.query(`SELECT 1 FROM pg_database WHERE datname = 'typeplay'`)).rowCount) await c.query("CREATE DATABASE typeplay");
  await c.end();
  step("the database's tables (prisma migrate deploy)", node, [mod("prisma", "build", "index.js"), "migrate", "deploy"], {
    cwd: join(ROOT, "apps", "server"),
    env: { DATABASE_URL: DB_URL, DIRECT_URL: DB_URL },
  });
}

// ---- Seed: Luka's account, the showcase games in the gallery (both only once) ---------------------------------------
const SHOWCASE = [
  { id: "showracer", build: "show-racer-polished", genre: "racer" },
  { id: "showarcade", build: "show-arcade-polished", genre: null },
  { id: "showtd", build: "show-td-polished", genre: "towerdefence" },
  { id: "showmatch3", build: "show-match3-polished", genre: "puzzle" },
  { id: "showrunner", build: "show-runner-polished", genre: "runner" },
  { id: "show3d", build: "show-3d-polished", genre: null },
];
/** Luka's sign-in id at Supabase, so his first local sign-in finds his account ready (read with the root .env's key). */
async function ownerIdentity() {
  const env = parseEnv(readFileSync(join(ROOT, ".env"), "utf8"));
  const base = env.SUPABASE_URL?.replace(/\/$/, "");
  const key = env.SUPABASE_SECRET_KEY;
  if (!base || !key) return null;
  for (let page = 1; page < 20; page++) {
    const r = await fetch(`${base}/auth/v1/admin/users?page=${page}&per_page=100`, { headers: { apikey: key, Authorization: `Bearer ${key}` } }).catch(() => null);
    if (!r?.ok) return null;
    const { users } = await r.json();
    const u = users.find((x) => (x.email ?? "").toLowerCase() === OWNER_EMAIL);
    if (u) return { id: u.id, name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? null };
    if (users.length < 100) return null;
  }
  return null;
}
async function seed() {
  const admin = (...args) =>
    step(`admin ${args[0]}`, node, [mod("tsx", "dist", "cli.mjs"), "src/admin.ts", ...args], {
      cwd: join(ROOT, "apps", "server"),
      env: { DATABASE_URL: DB_URL, DIRECT_URL: DB_URL, ADMIN_NAME: "local-site" },
    });
  if (!(await sql(`SELECT 1 FROM "User" WHERE email = $1`, [OWNER_EMAIL])).length) {
    const who = await ownerIdentity();
    if (who) {
      await sql(`INSERT INTO "User" (id, email, name) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [who.id, OWNER_EMAIL, who.name]);
      admin("plan", OWNER_EMAIL, "ultraplus");
      admin("grant", OWNER_EMAIL, "1300", "Local site");
    } else log("  (Luka's sign-in id not found: his first sign-in makes a Free account)");
  }
  await sql(`INSERT INTO "User" (id, email, name) VALUES ('local-showcase', 'showcase@typeplay.local', 'TypePlay') ON CONFLICT DO NOTHING`);
  const now = Date.now();
  for (const [i, g] of SHOWCASE.entries()) {
    const pack = join(ROOT, "apps", "games", "builds", g.build);
    if (!existsSync(join(pack, "game.json"))) continue;
    const meta = JSON.parse(readFileSync(join(pack, "game.json"), "utf8"));
    const at = new Date(now - i * 60_000);
    const made = await sql(
      `INSERT INTO "Project" (id, "ownerId", name, orientation, "currentVersion", shared, "sharedAt", listed, "listedAt", "createdAt", "updatedAt")
       VALUES ($1, 'local-showcase', $2, $3, 1, true, $4, true, $4, $4, $4) ON CONFLICT DO NOTHING RETURNING id`,
      [g.id, meta.name, meta.orientation === "landscape" ? "landscape" : "portrait", at],
    );
    if (!made.length) continue;
    await sql(`INSERT INTO "Version" (id, "projectId", n, label, "buildId", commit, poster) VALUES (gen_random_uuid(), $1, 1, 'A showcase game', $2, 'showcase', $3)`, [
      g.id,
      g.build,
      existsSync(join(pack, "poster.png")),
    ]);
    // The gallery reads a game's kind from its folder's GENRE file.
    const dir = join(STATE, "data", "projects", g.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "GENRE"), `${g.genre ?? "none"}\n`);
  }
}

// ---- The supervisor: runs detached, keeps the three servers up, takes restart and stop requests ----------------------
const SERVICES = {
  api: () => ({
    cmd: node,
    // Beside dist/, at the same depth: the API finds the repo's root from its own folder.
    args: [join(ROOT, "apps", "server", "dist-site", "main.js")],
    cwd: join(ROOT, "apps", "server"),
    // AGENT_LOG_DIR: the runs' records stay here, not in packages/agent's tracked runs.jsonl.
    env: {
      PORT: String(PORTS.api),
      DATABASE_URL: DB_URL,
      DIRECT_URL: DB_URL,
      DATA_DIR: join(STATE, "data"),
      AGENT_LOG_DIR: join(STATE, "agent-logs"),
      AGENT_FAKE: "",
      DEV_AUTH: "",
    },
  }),
  games: () => ({ cmd: node, args: [join(ROOT, "apps", "games", "scripts", "serve.mjs"), String(PORTS.games)], cwd: join(ROOT, "apps", "games"), env: {} }),
  web: () => ({
    cmd: node,
    args: [mod("next", "dist", "bin", "next"), "start", "-p", String(PORTS.web), "-H", "127.0.0.1"],
    cwd: join(ROOT, "apps", "web"),
    env: { NEXT_DIST_DIR: ".next/site", NEXT_TELEMETRY_DISABLED: "1" },
  }),
};

/** Below normal priority on 12 of the 16 cores, for this process and everything it starts (Luka's PC never lags). */
async function limit() {
  const { limitThisProcess } = await import(`file://${join(ROOT, "packages", "agent", "tools", "cpu.mjs").replaceAll("\\", "/")}`);
  limitThisProcess();
}

async function supervise() {
  await limit();
  mkdirSync(LOGS, { recursive: true });
  mkdirSync(CONTROL, { recursive: true });
  mkdirSync(join(STATE, "agent-logs"), { recursive: true });
  writeFileSync(PID_FILE, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }));
  const phase = (p) => writeFileSync(join(STATE, "status.json"), JSON.stringify({ phase: p, at: new Date().toISOString() }));
  const out = openSync(join(LOGS, "supervisor.log"), "a");
  const note = (t) => writeFileSync(out, `${new Date().toISOString()} ${t}\n`);
  for (const f of readdirSync(CONTROL)) rmSync(join(CONTROL, f), { force: true });

  let stopping = false;
  const children = {};
  const start = (name) => {
    const s = SERVICES[name]();
    const fd = openSync(join(LOGS, `${name}.log`), "a");
    const child = spawn(s.cmd, s.args, { cwd: s.cwd, env: { ...process.env, ...s.env }, stdio: ["ignore", fd, fd], windowsHide: true });
    children[name] = child;
    note(`${name} started (pid ${child.pid})`);
    child.on("exit", (code) => {
      if (children[name] !== child) return; // replaced by a restart
      delete children[name];
      note(`${name} exited (${code})`);
      if (!stopping) setTimeout(() => !stopping && !children[name] && start(name), 3000);
    });
  };
  const stopChild = (name) => {
    const c = children[name];
    if (!c) return;
    delete children[name];
    killTree(c.pid);
  };
  const shutdown = () => {
    stopping = true;
    for (const name of Object.keys(children)) stopChild(name);
    pgCtl("stop", "-D", PG_DATA, "-m", "fast");
    phase("stopped");
    note("stopped");
    rmSync(PID_FILE, { force: true });
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    phase("starting the database");
    startPostgres();
    phase("preparing the database");
    await prepareDatabase();
    phase("seeding Luka's account and the showcase games");
    await seed();
    phase("starting the servers");
    for (const name of Object.keys(SERVICES)) start(name);
    for (let i = 0; i < 90 && !(await Promise.all(Object.keys(PORTS).map(up))).every(Boolean); i++) await sleep(2000);
    phase("ready");
  } catch (e) {
    note(`failed: ${e.stack ?? e}`);
    phase(`failed: ${String(e.message ?? e).split("\n")[0]}`);
    shutdown();
  }
  // Requests from the CLI: a file per request in data/local-site/control.
  for (;;) {
    await sleep(1500);
    for (const f of readdirSync(CONTROL)) {
      rmSync(join(CONTROL, f), { force: true });
      if (f === "stop") shutdown();
      if (f.startsWith("restart-")) {
        const names = f.slice(8).split("+").filter((n) => n in SERVICES);
        phase(`restarting ${names.join(" and ")}`);
        for (const n of names) stopChild(n);
        await sleep(1500);
        for (const n of names) start(n);
        for (let i = 0; i < 90 && !(await Promise.all(names.map(up))).every(Boolean); i++) await sleep(2000);
        phase("ready");
      }
    }
  }
}

/** Starts the supervisor outside this process tree (Windows' process service starts it), hidden, below normal. */
function launchDetached() {
  const cmdLine = `"${node}" "${join(ROOT, "scripts", "local-site.mjs")}" supervise`.replaceAll("'", "''");
  const ps = [
    "$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0; PriorityClass=[uint32]16384}",
    `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='${cmdLine}'; CurrentDirectory='${ROOT.replaceAll("'", "''")}'; ProcessStartupInformation=$si}`,
    "Write-Output \"$($r.ReturnValue) $($r.ProcessId)\"",
  ].join("; ");
  const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8", windowsHide: true });
  const [code, pid] = (r.stdout ?? "").trim().split(/\s+/);
  if (code !== "0") throw new Error(`could not start the supervisor: ${r.stdout}${r.stderr}`);
  return Number(pid);
}

async function request(name, waitSeconds) {
  mkdirSync(CONTROL, { recursive: true });
  writeFileSync(join(CONTROL, name), "");
  await sleep(4000);
  return waitReady(waitSeconds);
}

const ADDRESS = `http://localhost:${PORTS.web}`;
const cmd = process.argv[2];
try {
  if (cmd === "supervise") {
    await supervise();
  } else if (cmd === "start") {
    if (supervisorPid()) {
      log(`Already running: ${ADDRESS}`);
    } else {
      mkdirSync(LOGS, { recursive: true });
      await limit();
      if (!existsSync(join(STATE, "built.json"))) buildSite();
      const pid = launchDetached();
      log(`Starting in the background (pid ${pid}):`);
      log((await waitReady(300)) ? `Ready: ${ADDRESS}` : `Not ready: see ${LOGS}`);
    }
  } else if (cmd === "update") {
    await limit();
    buildSite();
    if (supervisorPid()) {
      log("Restarting the site and the API:");
      log((await request("restart-api+web", 180)) ? `Ready: ${ADDRESS} (reload the page)` : `Not ready: see ${LOGS}`);
    } else log(`Built; not running. Start it with: node scripts/local-site.mjs start`);
  } else if (cmd === "stop") {
    const pid = supervisorPid();
    if (!pid) log("Not running.");
    else {
      writeFileSync(join(CONTROL, "stop"), "");
      for (let i = 0; i < 20 && alive(pid); i++) await sleep(1000);
      if (alive(pid)) killTree(pid);
      if (existsSync(join(PG_BIN, "pg_ctl.exe"))) pgCtl("stop", "-D", PG_DATA, "-m", "fast");
      log("Stopped.");
    }
  } else if (cmd === "status") {
    const s = await status();
    log(s.running ? `Running (pid ${s.pid}), ${s.phase}: site ${s.web ? "up" : "down"}, games ${s.games ? "up" : "down"}, API ${s.api ? "up" : "down"} · ${ADDRESS}` : "Not running.");
  } else {
    log("usage: node scripts/local-site.mjs start | update | stop | status");
    process.exit(2);
  }
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
