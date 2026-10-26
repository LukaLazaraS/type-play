// One automated test run, kept apart from every other on this PC (docs/environments.md "The automated tests"): a
// database of its own and ports picked free when it starts, so any number of runs, from any checkout, can go at once
// and none waits for or breaks another. Used by apps/server/test/test-db.mjs and the walk-throughs in apps/web/scripts.
//   await runDatabase("e2e")    typeplay_autotest_e2e_<8 hex> made on this PC's Postgres and brought up to date with this
//                               checkout's migrations; dropped when the process exits
//   await freePort()            a port nothing listens on, kept for this process (no other run is given it)
//   await lock(name)            one holder at a time on this PC: waits, and says who holds it; for what can't be split
//   node scripts/test-run.mjs clean    drops the databases of runs that have ended (and the shared ones used before
//                                      10-27, typeplay_autotest and typeplay_shots, when nothing is connected to them)
// How a run is told from a dead one: the process keeps one connection to the server for its whole life, and that
// connection holds an advisory lock for each database, port and lock name the run has. A process that dies, however
// it dies (Ctrl+C, taskkill, a crash), loses the connection, and Postgres frees its locks at once. Each run's start
// drops the databases whose lock is free (runs killed before they could drop their own), so nothing piles up.
import { spawnSync } from "node:child_process";
import { createHash, randomInt } from "node:crypto";
import { createServer } from "node:net";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { client, migrate, startServer, urlOf } from "./local-db.mjs";

const SELF = fileURLToPath(import.meta.url);
const ROOT = join(dirname(SELF), "..");
/** The advisory lock spaces (the first of the two keys): a run's database, a port, a named lock. */
const SPACE = { db: 0x54500001, port: 0x54500002, lock: 0x54500003 };
const NAME = /^typeplay_autotest_(?:[a-z0-9_]+_)?([0-9a-f]{8})$/;
/** Ports are picked here: below Windows' dynamic range (49152 up, where every outgoing connection takes its port). */
const PORTS = { from: 20_000, to: 40_000 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let conn = null;
/**
 * This process's connection to the server: opened once, it holds the locks. Idle, it doesn't keep the process alive (a
 * script that ends on its own still ends); a query on it does, until its answer is in.
 */
async function holder() {
  if (conn) return conn;
  await startServer();
  const who = `${basename(process.argv[1] ?? "node")} pid ${process.pid} in ${basename(ROOT)}`;
  const c = await client("postgres", { application_name: `typeplay ${who}`.slice(0, 63) });
  c.on("error", () => {}); // the server stopped under us: the run fails on its own database, not here
  const socket = c.connection?.stream;
  socket?.unref?.();
  let busy = 0;
  conn = {
    async query(sql, params) {
      if (busy++ === 0) socket?.ref?.();
      try {
        return await c.query(sql, params);
      } finally {
        if (--busy === 0) socket?.unref?.();
      }
    },
    end: () => c.end(),
  };
  return conn;
}
const tryLock = async (c, space, key) => (await c.query("SELECT pg_try_advisory_lock($1, $2) AS ok", [space, key])).rows[0].ok;
const unlock = (c, space, key) => c.query("SELECT pg_advisory_unlock($1, $2)", [space, key]);

// ---- A database per run ---------------------------------------------------------------------------------------------
/** The run databases this process made: kept by the sweep, dropped when the process exits. */
const mine = new Set();
/** A label as it appears in a database's name (e2e, android_e2e, shot_compare). */
const tagOf = (label) => String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30);

/**
 * A database of this run's own, typeplay_autotest_<label>_<8 hex>, made and migrated; returns its name and URL. The
 * process sets DATABASE_URL to it before it starts anything, so every API and admin CLI it starts uses it too.
 */
export async function runDatabase(label) {
  const c = await holder();
  const tag = tagOf(label);
  let id;
  do id = randomInt(1, 0x7fffffff);
  while (!(await tryLock(c, SPACE.db, id)));
  const name = `typeplay_autotest_${tag ? `${tag}_` : ""}${id.toString(16).padStart(8, "0")}`;
  if (!mine.size) dropAtExit();
  mine.add(name);
  await sweep(c);
  await c.query(`CREATE DATABASE "${name}"`);
  migrate(name);
  return { name, url: urlOf(name) };
}

/** Drops the run databases whose run has ended (its lock is free); returns their names. */
async function sweep(c) {
  const { rows } = await c.query(String.raw`SELECT datname FROM pg_database WHERE datname LIKE 'typeplay\_autotest\_%'`);
  const dropped = [];
  for (const { datname } of rows) {
    const m = NAME.exec(datname);
    if (!m || mine.has(datname)) continue;
    const id = parseInt(m[1], 16);
    if (!(await tryLock(c, SPACE.db, id))) continue; // its run is still going
    try {
      await c.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`);
      dropped.push(datname);
    } catch {
      // another run's sweep got there first
    } finally {
      await unlock(c, SPACE.db, id);
    }
  }
  return dropped;
}

/** Run databases whose run ended without dropping them, for a script that tidies what such a run left (shot-compare). */
export async function endedRunDatabases(label) {
  const c = await holder();
  const tag = tagOf(label);
  const { rows } = await c.query(String.raw`SELECT datname FROM pg_database WHERE datname LIKE 'typeplay\_autotest\_%'`);
  const ended = [];
  for (const { datname } of rows) {
    const m = NAME.exec(datname);
    if (!m || mine.has(datname) || !datname.startsWith(`typeplay_autotest_${tag}_`)) continue;
    const id = parseInt(m[1], 16);
    if (await tryLock(c, SPACE.db, id)) {
      await unlock(c, SPACE.db, id);
      ended.push(datname);
    }
  }
  return ended;
}

/**
 * The run's databases go when the process exits, however it ends: a normal end, process.exit, an uncaught error, or
 * Ctrl+C (turned into an exit). An exit handler can't wait for a query, so a short child process drops them.
 */
function dropAtExit() {
  process.once("exit", () => {
    for (const name of mine) spawnSync(process.execPath, [SELF, "drop", name], { stdio: "ignore", windowsHide: true, timeout: 60_000 });
  });
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.once(signal, () => process.exit(130));
}

// ---- Ports ----------------------------------------------------------------------------------------------------------
const given = new Set();
/** Whether a port can be listened on at `host` right now (an address this PC doesn't have counts as free). */
const canListen = (port, host) =>
  new Promise((resolve) => {
    const s = createServer();
    s.once("error", (e) => resolve(!["EADDRINUSE", "EACCES"].includes(e.code)));
    s.listen({ port, host, exclusive: true }, () => s.close(() => resolve(true)));
  });

/**
 * A port for something this run starts: free on 127.0.0.1 (the API, the games origin) and on every address (`next dev`
 * listens on ::), and kept for this process until it exits, so no other run on this PC is given it meanwhile.
 */
export async function freePort() {
  const c = await holder();
  for (let i = 0; i < 200; i++) {
    const port = randomInt(PORTS.from, PORTS.to);
    if (given.has(port) || !(await canListen(port, "127.0.0.1")) || !(await canListen(port, "::"))) continue;
    if (!(await tryLock(c, SPACE.port, port))) continue; // another run has it
    given.add(port);
    return port;
  }
  throw new Error(`no free port between ${PORTS.from} and ${PORTS.to} after 200 tries`);
}
export async function freePorts(n) {
  const ports = [];
  for (let i = 0; i < n; i++) ports.push(await freePort());
  return ports;
}

// ---- A lock shared by every checkout ---------------------------------------------------------------------------------
const held = new Set();
/**
 * Waits until no other process on this PC holds `name`, then holds it until this process exits. While it waits it says
 * who holds it; a holder that died has already let go (its connection closed).
 */
export async function lock(name) {
  if (held.has(name)) return;
  const c = await holder();
  const key = createHash("sha256").update(name).digest().readUInt32BE(0) & 0x7fffffff;
  let said = "";
  for (;;) {
    if (await tryLock(c, SPACE.lock, key)) {
      held.add(name);
      if (said) console.log(`[lock] got "${name}"`);
      return;
    }
    const { rows } = await c.query(
      `SELECT a.application_name AS who, a.backend_start AS since FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
        WHERE l.locktype = 'advisory' AND l.granted AND l.classid = $1 AND l.objid = $2 AND l.objsubid = 2`,
      [SPACE.lock, key],
    );
    const who = rows[0] ? `${rows[0].who.replace(/^typeplay /, "")}, running since ${rows[0].since.toTimeString().slice(0, 5)}` : "a process that is letting go";
    if (who !== said) console.log(`[lock] waiting for "${name}": held by ${who}`);
    said = who;
    await sleep(2000);
  }
}

// ---- The command line -----------------------------------------------------------------------------------------------
if (process.argv[1] && SELF === process.argv[1]) {
  const [cmd, arg] = process.argv.slice(2);
  try {
    if (cmd === "drop" && NAME.test(arg ?? "")) {
      const c = await client("postgres");
      await c.query(`DROP DATABASE IF EXISTS "${arg}" WITH (FORCE)`);
      await c.end();
    } else if (cmd === "clean") {
      const c = await holder();
      const dropped = await sweep(c);
      for (const old of ["typeplay_autotest", "typeplay_shots"]) {
        try {
          if ((await c.query("SELECT 1 FROM pg_database WHERE datname = $1", [old])).rowCount) {
            await c.query(`DROP DATABASE ${old}`);
            dropped.push(old);
          }
        } catch {
          console.log(`${old}: in use by a checkout that hasn't merged the per-run databases yet; kept`);
        }
      }
      console.log(dropped.length ? `dropped: ${dropped.join(", ")}` : "nothing to drop");
      await c.end();
    } else {
      console.log("usage: node scripts/test-run.mjs clean");
      process.exit(2);
    }
  } catch (e) {
    console.error(String(e?.message ?? e));
    process.exit(1);
  }
}
