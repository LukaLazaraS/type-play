// This PC's Postgres 17 for development and the automated tests (docs/environments.md): one server for every checkout.
//   typeplay_dev                   `npm run dev`, the local site, the admin CLI (.env.development): kept, test data only
//   typeplay_autotest_<run>_<id>   one per automated test run, made and dropped by the run (scripts/test-run.mjs)
// The live database is never used on this PC, and real users' data is never copied here.
//   node scripts/local-db.mjs start        starts it if needed (in the background, below normal priority; it keeps
//                                          running after the terminal closes, until `stop` or a restart of the PC),
//                                          makes typeplay_dev and brings its tables up to date (prisma migrate deploy)
//   node scripts/local-db.mjs stop | status
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
export const DATABASES = ["typeplay_dev"];
export const urlOf = (db) => `postgres://postgres@127.0.0.1:${PORT}/${db}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pgCtl = (...args) => spawnSync(join(BIN, "pg_ctl.exe"), args, { encoding: "utf8", windowsHide: true });
export const running = () => existsSync(join(BIN, "pg_ctl.exe")) && pgCtl("status", "-D", DATA).status === 0;

/** A connection to one of the server's databases (`options`: pg.Client's own, such as application_name). */
export async function client(db, options = {}) {
  const { default: pg } = await import(`file:///${join(ROOT, "node_modules", "pg", "lib", "index.js").replaceAll("\\", "/")}`);
  const c = new pg.Client({ connectionString: urlOf(db), ...options });
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
      // Room for many test runs at once (each has a database and APIs of its own: two e2e runs together peaked at 36
      // connections, 10-27); Postgres' default is 100. Takes effect at the server's next start (a PC restart, or stop
      // and start), so a running server is never restarted under the runs using it.
      const max = (await c.query("SELECT setting::int AS n, pending_restart AS pending FROM pg_settings WHERE name = 'max_connections'")).rows[0];
      if (max.n < 300 && !max.pending) {
        await c.query("ALTER SYSTEM SET max_connections = 300");
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

/** Running, typeplay_dev there and up to date. */
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
    } else {
      console.log("usage: node scripts/local-db.mjs start | stop | status");
      process.exit(2);
    }
  } catch (e) {
    console.error(String(e.message ?? e));
    process.exit(1);
  }
}
