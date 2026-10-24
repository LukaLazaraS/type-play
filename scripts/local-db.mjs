// This PC's Postgres 17 for development and the automated tests (docs/environments.md): one server for every checkout,
// two databases.
//   typeplay_dev        `npm run dev`, the local site, the admin CLI (.env.development): kept, test data only
//   typeplay_autotest   the automated test scripts (.env.autotest): emptied at the start of every run
// The live database is never used on this PC, and real users' data is never copied here.
//   node scripts/local-db.mjs start        starts it if needed (in the background, below normal priority; it keeps
//                                          running after the terminal closes, until `stop` or a restart of the PC),
//                                          makes both databases and brings their tables up to date (prisma migrate deploy)
//   node scripts/local-db.mjs stop | status
//   node scripts/local-db.mjs reset-autotest   the automated tests' database dropped and made again from the migrations
// Portable Postgres binaries (npm @embedded-postgres/windows-x64) and the data live outside every checkout, in
// %LOCALAPPDATA%\TypePlay\postgres-17; it listens on 127.0.0.1:54329 only, user postgres without a password.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const HOME = join(process.env.LOCALAPPDATA ?? join(process.env.USERPROFILE ?? ".", "AppData", "Local"), "TypePlay", "postgres-17");
const PKG = "@embedded-postgres/windows-x64@17.10.0-beta.17";
const BIN = join(HOME, "pkg", "node_modules", "@embedded-postgres", "windows-x64", "native", "bin");
export const DATA = join(HOME, "data");
const LOG = join(HOME, "postgres.log");
export const PORT = 54329;
export const DATABASES = ["typeplay_dev", "typeplay_autotest"];
export const urlOf = (db) => `postgres://postgres@127.0.0.1:${PORT}/${db}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pgCtl = (...args) => spawnSync(join(BIN, "pg_ctl.exe"), args, { encoding: "utf8", windowsHide: true });
export const running = () => existsSync(join(BIN, "pg_ctl.exe")) && pgCtl("status", "-D", DATA).status === 0;

async function client(db) {
  const { default: pg } = await import(`file:///${join(ROOT, "node_modules", "pg", "lib", "index.js").replaceAll("\\", "/")}`);
  const c = new pg.Client({ connectionString: urlOf(db) });
  await c.connect();
  return c;
}

/** Starts the server when it isn't running: outside this process tree (Windows' process service starts it), below normal. */
export async function startServer() {
  if (!existsSync(join(BIN, "postgres.exe"))) {
    mkdirSync(join(HOME, "pkg"), { recursive: true });
    const r = spawnSync("npm", ["install", "--no-audit", "--no-fund", "--no-save", "--prefix", join(HOME, "pkg"), PKG], { stdio: "inherit", shell: true, windowsHide: true });
    if (r.status !== 0) throw new Error("could not install the Postgres binaries");
  }
  if (!existsSync(join(DATA, "PG_VERSION"))) {
    const r = spawnSync(join(BIN, "initdb.exe"), ["-D", DATA, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"], { encoding: "utf8", windowsHide: true });
    if (r.status !== 0) throw new Error(`initdb: ${r.stderr}`);
  }
  const started = !running();
  if (started) {
    const cmd = `"${join(BIN, "pg_ctl.exe")}" start -w -D "${DATA}" -l "${LOG}" -o "-p ${PORT} -h 127.0.0.1"`;
    const ps = [
      "$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ShowWindow=[uint16]0; PriorityClass=[uint32]16384}",
      `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine='${cmd.replaceAll("'", "''")}'; ProcessStartupInformation=$si}`,
      "Write-Output $r.ReturnValue",
    ].join("; ");
    const r = spawnSync("powershell", ["-NoProfile", "-Command", ps], { encoding: "utf8", windowsHide: true });
    if ((r.stdout ?? "").trim() !== "0") throw new Error(`could not start Postgres: ${r.stdout}${r.stderr}`);
    for (let i = 0; i < 60 && !running(); i++) await sleep(500);
  }
  for (let i = 0; i < 40; i++) {
    let c;
    try {
      c = await client("postgres");
    } catch {
      await sleep(500);
      continue;
    }
    try {
      // UTC, as on the live database (Supabase): Prisma writes UTC into the timestamp columns, and SQL's now() and date
      // arithmetic must agree with it (in this PC's +04 zone the ledger's month and day checks were 4 hours off).
      if ((await c.query("SHOW timezone")).rows[0].TimeZone !== "UTC") {
        await c.query("ALTER SYSTEM SET timezone TO 'UTC'");
        await c.query("ALTER SYSTEM SET log_timezone TO 'UTC'");
        await c.query("SELECT pg_reload_conf()");
      }
    } finally {
      await c.end();
    }
    if (started) keepCoresFree();
    return;
  }
  throw new Error(`Postgres did not start: see ${LOG}`);
}

/** The server off 4 of the cores, like every heavy process here (packages/agent/tools/cpu.mjs); its workers inherit it. */
function keepCoresFree() {
  try {
    const pid = Number(readFileSync(join(DATA, "postmaster.pid"), "utf8").split("\n")[0]);
    const n = availableParallelism();
    const heavy = Math.max(1, n - 4);
    const mask = (2 ** heavy - 1) * 2 ** (n - heavy);
    if (pid) spawnSync("powershell", ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).ProcessorAffinity = ${mask}`], { stdio: "ignore", windowsHide: true, timeout: 15_000 });
  } catch {
    // below normal priority still holds
  }
}

export async function createDatabase(db) {
  const c = await client("postgres");
  try {
    if (!(await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [db])).rowCount) await c.query(`CREATE DATABASE ${db}`);
  } finally {
    await c.end();
  }
}

/** The database's tables brought up to date with this checkout's migrations. */
export function migrate(db) {
  const r = spawnSync(process.execPath, [join(ROOT, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy"], {
    cwd: join(ROOT, "apps", "server"),
    env: { ...process.env, DATABASE_URL: urlOf(db), DIRECT_URL: urlOf(db) },
    encoding: "utf8",
    windowsHide: true,
  });
  if (r.status !== 0) throw new Error(`prisma migrate deploy on ${db} failed:\n${`${r.stdout}${r.stderr}`.slice(-1500)}`);
}

/** Every table emptied (the migrations' own record kept): the start of a test run. */
export async function emptyDatabase(db) {
  if (db !== "typeplay_autotest") throw new Error(`${db} is kept; only typeplay_autotest is emptied`);
  const c = await client(db);
  try {
    const tables = (await c.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`)).rows.map((r) => `"${r.tablename}"`);
    if (tables.length) await c.query(`TRUNCATE ${tables.join(", ")} RESTART IDENTITY CASCADE`);
  } finally {
    await c.end();
  }
}

/** Running, both databases there and up to date. */
export async function start() {
  await startServer();
  for (const db of DATABASES) {
    await createDatabase(db);
    migrate(db);
  }
  await dropOldTestDatabase();
}

/** The automated tests' database was typeplay_test until 10-25 ("test" names the online environment, later): gone once
 * nothing is connected to it (a test run of an older checkout keeps it until it ends). */
async function dropOldTestDatabase() {
  const c = await client("postgres");
  try {
    await c.query("DROP DATABASE IF EXISTS typeplay_test");
  } catch {
    // in use: dropped on a later start
  } finally {
    await c.end();
  }
}

/** The automated tests' database, fresh: migrated and empty (the test scripts call this first). */
export async function freshAutotestDatabase() {
  await startServer();
  await createDatabase("typeplay_autotest");
  migrate("typeplay_autotest");
  await emptyDatabase("typeplay_autotest");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const cmd = process.argv[2];
  try {
    if (cmd === "start") {
      await start();
      console.log(`Postgres 17 on 127.0.0.1:${PORT}: ${DATABASES.join(", ")} up to date (${HOME})`);
    } else if (cmd === "stop") {
      console.log(running() ? (pgCtl("stop", "-D", DATA, "-m", "fast").status === 0 ? "Stopped." : "Could not stop it.") : "Not running.");
    } else if (cmd === "status") {
      console.log(running() ? `Running on 127.0.0.1:${PORT} (${HOME})` : "Not running.");
    } else if (cmd === "reset-autotest") {
      await startServer();
      const c = await client("postgres");
      await c.query("DROP DATABASE IF EXISTS typeplay_autotest WITH (FORCE)");
      await c.end();
      await createDatabase("typeplay_autotest");
      migrate("typeplay_autotest");
      console.log("typeplay_autotest made again from the migrations.");
    } else {
      console.log("usage: node scripts/local-db.mjs start | stop | status | reset-autotest");
      process.exit(2);
    }
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
