// End-to-end test of the API, on the automated tests' own database (typeplay_autotest, emptied first: test/test-db.mjs):
//   npm run test:e2e -w @typeplay/server     (after npm run build) starts its API on :3023 with DEV_AUTH=1 and
//                                            AGENT_FAKE=1; API_URL runs it against a server of yours instead
// Uses fresh dev users (dev:e2e-<time>-a@test.local) and deletes them, their games and builds at the end.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { crc32, inflateRawSync } from "node:zlib";
import pg from "pg";

import { useTestDatabase } from "./test-db.mjs";

const here = resolve(import.meta.dirname, "..");
const root = resolve(here, "../..");
await useTestDatabase();
// The API under test: one of our own on the test database (stopped at the end), unless API_URL names one.
const mainApi = process.env.API_URL ? null : await spawnApi(3023);
const API = process.env.API_URL || mainApi.url;
const DATA = resolve(process.env.DATA_DIR || join(root, "data"));
const BUILDS = resolve(process.env.GAMES_BUILDS_DIR || join(root, "apps/games/builds"));
const { creditsForUsd, estimate } = await import("../dist/credits/credits.js");

const stamp = Date.now().toString(36);
const A = `dev:e2e-${stamp}-a@test.local`;
const B = `dev:e2e-${stamp}-b@test.local`;
const C = `dev:e2e-${stamp}-c@test.local`; // closes their account
const D = `dev:e2e-${stamp}-d@test.local`; // Free, for the per-user and global run caps
const E = `dev:e2e-${stamp}-e@test.local`;
const F = `dev:e2e-${stamp}-f@test.local`; // signs up with an email that closed an account lately
const emailOf = (token) => token.slice(4);
let failures = 0;
const projects = [];

function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}

async function api(token, method, path, body) {
  const send = () =>
    fetch(API + path, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  // The server closes idle keep-alive sockets after 5 s; a request that picks one up just then is
  // reset before it reaches the server (after the admin CLI's pauses): send it again once.
  const res = await send().catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)));
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Reads the project's SSE stream with fetch (as the site does) and collects the events. */
async function openEvents(token, id) {
  const ctrl = new AbortController();
  const res = await fetch(`${API}/projects/${id}/events`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
  const events = [];
  const wake = new Set();
  if (res.ok) {
    (async () => {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            for (const line of chunk.split("\n")) if (line.startsWith("data: ")) events.push(JSON.parse(line.slice(6)));
            wake.forEach((w) => w());
          }
        }
      } catch {
        // aborted
      }
    })();
  }
  const until = (pred, ms = 30_000) =>
    new Promise((resolveP, reject) => {
      const check = () => {
        const e = events.find(pred);
        if (e) {
          wake.delete(check);
          clearTimeout(timer);
          resolveP(e);
        }
      };
      const timer = setTimeout(() => {
        wake.delete(check);
        reject(new Error(`timed out waiting; got ${events.map((e) => e.type).join(",")}`));
      }, ms);
      wake.add(check);
      check();
    });
  return { status: res.status, contentType: res.headers.get("content-type"), events, until, close: () => ctrl.abort() };
}

/** A download: status, headers and the raw bytes. */
async function raw(token, path) {
  const send = () => fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const res = await send().catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)));
  return { status: res.status, type: res.headers.get("content-type") ?? "", disposition: res.headers.get("content-disposition") ?? "", buf: Buffer.from(await res.arrayBuffer()) };
}

/** Reads a .zip (central directory, stored or deflated): name -> bytes. Checks every CRC. */
function unzip(buf) {
  const end = buf.length - 22;
  if (buf.readUInt32LE(end) !== 0x06054b50) throw new Error("no zip end record");
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(at) !== 0x02014b50) throw new Error("bad central directory");
    const method = buf.readUInt16LE(at + 10);
    const crc = buf.readUInt32LE(at + 16);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const skip = buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    const data = method === 8 ? inflateRawSync(body) : body;
    if (crc32(data) >>> 0 !== crc) throw new Error(`CRC mismatch in ${name}`);
    files.set(name, data);
    at += 46 + nameLen + skip;
  }
  return files;
}

const finished = (e) => e.type === "done" || e.type === "failed";
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: here, encoding: "utf8" });
/** `admin audit [email]`: exit 0 and "ok:" when the ledger's invariants hold. */
const auditOk = (email) => {
  const r = admin("audit", ...(email ? [email] : []));
  if (r.status !== 0) console.log(r.stdout);
  return r.status === 0 && /^ok:/m.test(r.stdout);
};
const daysUntil = (iso) => (Date.parse(iso) - Date.now()) / 86_400_000;
const devId = (token) => `dev-${emailOf(token).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
const gitIn = (id, ...args) => spawnSync("git", args, { cwd: join(DATA, "projects", id), encoding: "utf8" }).stdout.trim();
/** A database connection for the checks that look at rows directly. */
const dbMain = new pg.Client({ connectionString: process.env.DATABASE_URL });
await dbMain.connect();
/**
 * The kill switch's number: today's Free spend (FreeSpend, one row per UTC day; a deleted game's runs still count).
 * The day is computed in SQL: Prisma writes UTC into timestamp(3) columns, while pg would send a JS Date in local time.
 */
const UTC_TODAY = `date_trunc('day', now() AT TIME ZONE 'UTC')`;
const freeToday = async () => Number((await dbMain.query(`SELECT usd FROM "FreeSpend" WHERE day = ${UTC_TODAY}`)).rows[0]?.usd ?? 0);

/**
 * A second API of our own (another port, fake runs), for what can't be driven through a running
 * server: the run timeout and the recovery of a run interrupted by a restart. Stopped with kill().
 */
async function spawnApi(port, extraEnv = {}) {
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: here,
    env: { ...process.env, PORT: String(port), DEV_AUTH: "1", AGENT_FAKE: "1", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode !== null) throw new Error(`the test API on :${port} exited: ${output.slice(-800)}`);
    const h = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json()).catch(() => null);
    if (h?.agent === "fake") return { url: `http://127.0.0.1:${port}`, kill: () => child.kill(), output: () => output };
  }
  child.kill();
  throw new Error(`the test API on :${port} did not start: ${output.slice(-800)}`);
}

/**
 * Security review 10-20 (apps/server/README.md "Security review 10-20"), against an API of our own on :3033 with
 * AGENT_AUTH=api and FAKE_METER=1: fake runs make one model call through the key proxy, to a mock Anthropic here. The Free
 * kill switch counts what the proxy metered, so a Stop (the agent cut before its record: $0 reported) still counts what
 * the model cost; a build is charged the larger of what the agent reports and the meter. And a body past the API's limit
 * is a 413 in one plain sentence (it was a 500 with a stack in the log), while 1.2 MB is still read.
 */
async function securityChecks() {
  console.log("security review 10-20: the kill switch counts the key proxy's meter (an API of our own on :3033, a mock Anthropic); 413 for a big body");
  const { usageCostUsd } = await import("../dist/credits/prices.js");
  const usd = (tokens) => usageCostUsd("haiku", { input: 0, output: tokens, cacheWrite: 0, cacheRead: 0 });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const keys = [];
  // The mock Anthropic: every call answers with as many output tokens as it asked for (max_tokens).
  const upstream = createServer((req, res) => {
    keys.push(req.headers["x-api-key"]);
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let tokens = 0;
      try {
        tokens = Number(JSON.parse(body).max_tokens) || 0;
      } catch {
        /* not JSON: no usage */
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ id: "msg_e2e", type: "message", role: "assistant", content: [{ type: "text", text: "ok" }], usage: { input_tokens: 0, output_tokens: tokens, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }));
    });
  });
  await new Promise((r) => upstream.listen(0, "127.0.0.1", r));
  const sec = await spawnApi(3033, {
    AGENT_AUTH: "api",
    ANTHROPIC_API_KEY: "sk-ant-api-e2e-only",
    ANTHROPIC_UPSTREAM: `http://127.0.0.1:${upstream.address().port}`,
    KEY_PROXY_PORT: "8797",
    KEY_PROXY_URL: "http://127.0.0.1:8797",
    FAKE_METER: "1",
    BILLING_JOBS: "0",
  });
  const M = `dev:e2e-${stamp}-m@test.local`;
  const call = async (method, path, body) => {
    const res = await fetch(sec.url + path, {
      method,
      headers: { Authorization: `Bearer ${M}`, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const idle = async (id) => {
    for (let i = 0; i < 60 && id; i++) {
      const r = await call("GET", `/projects/${id}`);
      if (r.body?.status === "idle") return r.body;
      await sleep(500);
    }
    return null;
  };
  const agentRow = async (id) =>
    (await dbMain.query(`SELECT status, credits::float AS credits, "costUsd"::float AS cost, "meteredUsd"::float AS metered FROM "Message" WHERE "projectId" = $1 AND role = 'agent' ORDER BY "createdAt" DESC LIMIT 1`, [id])).rows[0];
  try {
    // A Stop 1.5 s in: the fake agent is cut before its record ($0 reported), after one model call the proxy metered.
    const before = await freeToday();
    const stopped = (await call("POST", "/projects", { prompt: "METER:6000000 A runner I stop", model: "fast" })).body;
    if (stopped?.id) projects.push(stopped.id);
    await sleep(1500);
    await call("POST", `/projects/${stopped?.id}/cancel`);
    await idle(stopped?.id);
    const s = await agentRow(stopped?.id);
    ok(s?.status === "failed" && s.credits === 0 && s.cost === 0 && Math.abs(s.metered - usd(6_000_000)) < 1e-6, `a Stop: nothing charged, $0 reported, $${usd(6_000_000).toFixed(2)} metered (one model call through the proxy)`);
    const afterStop = await freeToday();
    ok(afterStop - before >= usd(6_000_000) - 1e-4, `... and the Free kill switch counts it: +$${(afterStop - before).toFixed(2)} today (before 10-20: +$0.00)`);
    ok(keys.length === 1 && keys[0] === "sk-ant-api-e2e-only", "only our key reached the model API, never the run's token");
    // A build with $0.30 metered: charged the larger of the agent's $0.10 and the meter; the kill switch counts the larger of $0.14 and $0.30.
    const built = (await call("POST", "/projects", { prompt: "METER:600000 A runner I keep", model: "fast" })).body;
    if (built?.id) projects.push(built.id);
    await idle(built?.id);
    const b = await agentRow(built?.id);
    ok(b?.status === "done" && b.credits === creditsForUsd(usd(600_000)) && Math.abs(b.metered - usd(600_000)) < 1e-6, `a build: ${creditsForUsd(usd(600_000))} credits, from the metered $${usd(600_000).toFixed(2)} (more than the agent's $0.10)`);
    ok((await freeToday()) - afterStop >= usd(600_000) - 1e-4, `... and the kill switch counts the metered $${usd(600_000).toFixed(2)}, not the reported $0.14`);
    // Bodies past the limit (1.5 MB; it was 1 MB, too small for a 1 MB Android icon as base64).
    const post = (n) =>
      fetch(`${sec.url}/public/games/abcdefghij/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "other", text: "x".repeat(n) }) }).then(async (r) => ({
        status: r.status,
        body: await r.json().catch(() => null),
      }));
    const tooBig = await post(1_600_000);
    ok(tooBig.status === 413 && tooBig.body?.error === "bad_request" && /too big/.test(tooBig.body?.message ?? ""), "a body past 1.5 MB, signed out: 413 in one plain sentence (it was a 500)");
    const read = await post(1_200_000);
    ok(read.status === 400 && /under 500 letters/.test(read.body?.message ?? ""), "1.2 MB is read (a 1 MB icon is 1.4 MB as base64): the route's own 400");
    ok(!/PayloadTooLargeError/.test(sec.output()), "no error with a stack in the API's log for it");
  } finally {
    sec.kill();
    upstream.close();
  }
}

/**
 * The public gallery, play counts and reports, against an API of our own on :3019 started with TRUST_PROXY=1: a
 * test can then be several visitors (CF-Connecting-IP), and the in-memory limits start from nothing.
 */
async function galleryChecks(db) {
  console.log("the gallery: opt-in, play counts and their limits, the gallery's pages, reports, admin (an API of our own on :3019)");
  const { addressKey } = await import("../dist/gallery/limits.js");
  ok(addressKey("203.0.113.9") === "203.0.113.9" && addressKey("::ffff:203.0.113.9") === "203.0.113.9", "an IPv4 address, also when written as IPv6, is one address");
  ok(addressKey("2001:db8:1:2::1") === addressKey("2001:0db8:0001:0002:ffff:0:0:3") && addressKey("2001:db8:1:2::1") !== addressKey("2001:db8:1:3::1"), "IPv6: a whole /64 is one address, the next /64 another");
  const gal = await spawnApi(3019, { TRUST_PROXY: "1" });
  const GA = `dev:e2e-${stamp}-ga@test.local`;
  const GB = `dev:e2e-${stamp}-gb@test.local`;
  const call = async (token, method, path, body, ip) => {
    const send = () =>
      fetch(gal.url + path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(ip ? { "CF-Connecting-IP": ip } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    // As api() above: a keep-alive socket the server closed during an admin CLI pause is reset; send once more.
    const res = await send().catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const play = (id, ip) => call(null, "POST", `/public/games/${id}/play`, undefined, ip);
  const report = (id, body, ip) => call(null, "POST", `/public/games/${id}/report`, body, ip);
  const playsInDb = async (id) => (await db.query(`SELECT coalesce(sum(count), 0)::int AS n FROM "PlayCount" WHERE "projectId" = $1`, [id])).rows[0].n;
  const listedAt = async (id) => (await db.query(`SELECT "listedAt" FROM "Project" WHERE id = $1`, [id])).rows[0]?.listedAt ?? null;
  const build = async (token, prompt) => {
    const r = await call(token, "POST", "/projects", { prompt, model: "fast" });
    if (r.body?.id) projects.push(r.body.id);
    return r.body?.id ?? null;
  };
  const untilIdle = async (token, id) => {
    for (let i = 0; i < 120 && id; i++) {
      const r = await call(token, "GET", `/projects/${id}`);
      if (r.body?.status === "idle") return r.body;
      await new Promise((res) => setTimeout(res, 500));
    }
    return null;
  };
  /** Every page of the gallery, `limit` at a time: the games in the order served. */
  const gallery = async (sort, limit) => {
    const games = [];
    let cursor = null;
    for (let i = 0; i < 200; i++) {
      const r = await call(null, "GET", `/public/gallery?sort=${sort}${limit ? `&limit=${limit}` : ""}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      if (r.status !== 200) return { status: r.status, games };
      games.push(...r.body.games);
      cursor = r.body.next;
      if (!cursor) break;
    }
    return { status: 200, games };
  };
  try {
    await call(GA, "GET", "/me");
    await call(GB, "GET", "/me");
    ok(admin("plan", emailOf(GA), "high").status === 0 && admin("plan", emailOf(GB), "high").status === 0, "two makers on High (two builds at a time)");
    const g1 = await build(GA, "A gallery game, one");
    const g2 = await build(GA, "A gallery game, two");
    const g4 = await build(GB, "A gallery game, four");
    for (const [t, id] of [[GA, g1], [GA, g2], [GB, g4]]) await untilIdle(t, id);
    const g3 = await build(GA, "A gallery game, three");
    const g5 = await build(GB, "A gallery game that will FAIL");
    await untilIdle(GA, g3);
    await untilIdle(GB, g5);
    const ours = [g1, g2, g3, g4];
    const mine = (games) => games.filter((g) => ours.includes(g.id)).map((g) => g.id).join();
    ok(ours.every(Boolean) && !!g5 && (await call(GB, "GET", `/projects/${g5}`)).body?.buildId === null, "four built games, and one whose build failed");

    console.log("  opt-in: share first, then the gallery");
    const fresh = (await call(GA, "GET", `/projects/${g1}`)).body;
    ok(fresh.listed === false && fresh.plays === 0 && fresh.galleryHidden === false, "a new game: not in the gallery, 0 plays, not hidden");
    const early = await call(GA, "PATCH", `/projects/${g1}`, { listed: true });
    ok(early.status === 400 && early.body.error === "bad_request" && /Share the game first/.test(early.body.message), "the gallery before sharing: 400, share it first");
    ok((await call(GA, "PATCH", `/projects/${g1}`, { listed: "yes" })).body?.error === "bad_request", "listed must be true or false");
    ok((await call(GA, "PATCH", `/projects/${g1}`, { shared: false, listed: true })).status === 400, "unshare and list at once: 400");
    ok((await call(GB, "PATCH", `/projects/${g1}`, { shared: true, listed: true })).status === 404, "another user can't list it (404)");
    const both = await call(GA, "PATCH", `/projects/${g1}`, { shared: true, listed: true });
    ok(both.status === 200 && both.body.shared === true && both.body.listed === true, "share and list in one go");
    const firstListed = await listedAt(g1);
    ok(firstListed instanceof Date, "database: listedAt set");
    const unshared = (await call(GA, "PATCH", `/projects/${g1}`, { shared: false })).body;
    ok(unshared.shared === false && unshared.listed === false, "unsharing takes it out of the gallery too");
    ok((await call(GA, "PATCH", `/projects/${g1}`, { shared: true })).body?.listed === false, "sharing again doesn't put it back in the gallery by itself");
    await new Promise((r) => setTimeout(r, 30));
    const back = await call(GA, "PATCH", `/projects/${g1}`, { listed: true });
    ok(back.body?.listed === true && (await listedAt(g1))?.getTime() === firstListed.getTime(), "back in the gallery: listedAt stays the first one (no jumping up in New)");
    ok((await play(g2, "198.51.100.1")).status === 204 && (await playsInDb(g2)) === 0, "a play of a private game: 204, nothing counted");
    ok((await play("NOPE!", "198.51.100.1")).status === 404, "a play of something that isn't a game id: 404");
    for (const [t, id] of [[GA, g2], [GA, g3], [GB, g4]]) {
      await new Promise((r) => setTimeout(r, 20));
      await call(t, "PATCH", `/projects/${id}`, { shared: true, listed: true });
    }

    console.log("  play counts");
    const sent = [];
    for (let i = 0; i < 4; i++) sent.push((await play(g1, "198.51.100.7")).status);
    ok(sent.every((s) => s === 204) && (await playsInDb(g1)) === 3, "one address: 3 plays an hour of a game count, the 4th doesn't (204 all the same)");
    await play(g1, "198.51.100.8");
    ok((await playsInDb(g1)) === 4, "another address counts");
    for (const ip of ["2001:db8:7:7::1", "2001:db8:7:7::2", "2001:db8:7:7:abcd::3", "2001:db8:7:7::4"]) await play(g3, ip);
    ok((await playsInDb(g3)) === 3, "IPv6: four addresses in one /64 count as one (3 plays)");
    // 60 plays an hour from one address in all: 60 plays of games that don't exist use them up, then a real one doesn't count.
    for (let i = 0; i < 60; i++) await play(`zz${stamp}p${i}`, "198.51.100.9");
    await play(g2, "198.51.100.9");
    ok((await playsInDb(g2)) === 0, "one address past 60 plays an hour (of any games): not counted");
    await play(g2, "198.51.100.10");
    ok((await playsInDb(g2)) === 1, "another address still counts meanwhile");
    const flood = await Promise.all(Array.from({ length: 125 }, (_, i) => play(g4, `203.0.113.${i + 1}`)));
    ok(flood.every((r) => r.status === 204) && (await playsInDb(g4)) === 120, "a game takes at most 120 plays a minute, whatever the addresses (125 sent, 120 counted)");
    const view = (await call(GA, "GET", `/projects/${g1}`)).body;
    const list = (await call(GA, "GET", "/projects")).body;
    ok(view.plays === 4 && list.find((g) => g.id === g1)?.plays === 4, "the maker sees 4 plays on the game page and in the list");
    ok((await call(null, "GET", `/public/games/${g1}`)).body?.plays === 4, "the share page gets the 4 plays");
    const columns = async (table) => (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1 ORDER BY column_name`, [table])).rows.map((r) => r.column_name).join();
    ok((await columns("PlayCount")) === "count,day,projectId", "database: a play count is a game, a day and a number: no address, no visitor id");
    ok((await columns("GameReport")) === "createdAt,handledAt,id,projectId,reason,text", "database: a report keeps nothing about who sent it");
    // Plays from before the week: in the total, not in Popular.
    await db.query(`INSERT INTO "PlayCount" ("projectId", day, count) VALUES ($1, (now() AT TIME ZONE 'UTC')::date - 10, 1000)`, [g2]);

    console.log("  the gallery's pages");
    const pop = await gallery("popular");
    ok(pop.status === 200 && mine(pop.games) === [g4, g1, g3, g2].join(), "Popular: most plays in the last 7 days first (120, 4, 3, 1)");
    const g2Card = pop.games.find((g) => g.id === g2);
    ok(g2Card?.plays === 1001 && g2Card.playsWeek === 1, "a card shows all-time plays (1001); Popular sorts by the week's (1)");
    const neu = await gallery("new");
    ok(neu.status === 200 && mine(neu.games) === [g4, g3, g2, g1].join(), "New: the latest to join the gallery first");
    const paged = await gallery("popular", 2);
    ok(mine(paged.games) === [g4, g1, g3, g2].join() && new Set(paged.games.map((g) => g.id)).size === paged.games.length && paged.games.length === pop.games.length, "Popular two at a time: the same order, every game once");
    const pagedNew = await gallery("new", 1);
    ok(mine(pagedNew.games) === [g4, g3, g2, g1].join() && pagedNew.games.length === neu.games.length, "New one at a time: the same order, every game once");
    const card = pop.games.find((g) => g.id === g1);
    ok(Object.keys(card ?? {}).sort().join() === "buildId,genre,id,listedAt,name,orientation,platform,plays,playsWeek,poster", "a card carries the game and its figures, nothing about its maker");
    writeFileSync(join(DATA, "projects", g1, "GENRE"), "runner\n");
    writeFileSync(join(DATA, "projects", g3, "GENRE"), "<b>runner</b>\n");
    const genres = (await gallery("new")).games;
    ok(genres.find((g) => g.id === g1)?.genre === "runner" && genres.find((g) => g.id === g3)?.genre === null, "genre: from the game's GENRE file when it names a genre skill, else null");
    await db.query(`UPDATE "Project" SET shared = true, listed = true, "listedAt" = now() AT TIME ZONE 'UTC' WHERE id = $1`, [g5]);
    ok(!(await gallery("new")).games.some((g) => g.id === g5), "listed and shared but never built (planted): not in the gallery");
    await db.query(`UPDATE "Project" SET shared = false, listed = false WHERE id = $1`, [g5]);
    await call(GA, "PATCH", `/projects/${g3}`, { shared: false });
    ok(!mine((await gallery("new")).games).includes(g3), "unshared: out of the gallery");
    await call(GA, "PATCH", `/projects/${g3}`, { shared: true });
    ok(!mine((await gallery("new")).games).includes(g3), "shared again, not listed: still out");
    const bad = await Promise.all(["sort=best", "cursor=nonsense", "limit=49", "limit=0"].map((q) => call(null, "GET", `/public/gallery?${q}`)));
    ok(bad.every((r) => r.status === 400 && r.body?.error === "bad_request"), "a bad sort, cursor or limit: 400");

    console.log("  admin: hide and unhide");
    const before = (await call(GA, "GET", `/projects/${g2}`)).body;
    ok(admin("gallery", "hide", g2, "e2e", "check").status === 0, "admin gallery hide");
    ok(!mine((await gallery("new")).games).includes(g2) && (await call(null, "GET", `/public/games/${g2}`)).status === 200, "hidden: out of the gallery, its share link still works");
    const hiddenView = (await call(GA, "GET", `/projects/${g2}`)).body;
    ok(hiddenView.galleryHidden === true && hiddenView.listed === true, "the maker's view: still listed, and hidden (the Share menu says so)");
    ok((await db.query(`SELECT "hiddenReason" FROM "Project" WHERE id = $1`, [g2])).rows[0]?.hiddenReason === "e2e check", "database: the admin's reason");
    ok(admin("gallery", "unhide", g2).status === 0 && mine((await gallery("new")).games).includes(g2), "admin gallery unhide: back in");
    ok((await call(GA, "GET", `/projects/${g2}`)).body.updatedAt === before.updatedAt, "hide and unhide don't move the game up its maker's list");

    console.log("  reports");
    ok((await report(g5, { reason: "other" }, "192.0.2.1")).status === 404, "a report on a game that isn't shared: 404");
    ok((await report(g1, { reason: "rude" }, "192.0.2.1")).body?.error === "bad_request", "a reason not on the list: 400");
    ok((await report(g1, { reason: "other", text: "x".repeat(501) }, "192.0.2.1")).body?.error === "bad_request", "501 letters: 400");
    ok((await report(g1, { reason: "other", text: 5 }, "192.0.2.1")).body?.error === "bad_request", "text that isn't text: 400");
    ok((await report(g4, { reason: "copied", text: "  Looks like\u0007 a copy\nof Mario  " }, "192.0.2.1")).status === 204, "a report: 204");
    const rows = (await db.query(`SELECT reason, text, "handledAt" FROM "GameReport" WHERE "projectId" = $1`, [g4])).rows;
    ok(rows.length === 1 && rows[0].reason === "copied" && rows[0].text === "Looks like a copy of Mario" && rows[0].handledAt === null, "database: the reason and the line, tidied to one line without control characters");
    const twice = await report(g4, { reason: "copied" }, "192.0.2.1");
    ok(twice.status === 429 && twice.body.error === "too_many", "the same address about the same game again: 429 too_many");
    for (let i = 0; i < 5; i++) await report(`zz${stamp}r${i}`, { reason: "other" }, "192.0.2.2");
    ok((await report(g1, { reason: "other" }, "192.0.2.2")).status === 429, "5 reports an hour from one address, then 429");
    ok((await report(g4, { reason: "copied" }, "192.0.2.3")).status === 204 && (await call(GB, "GET", `/projects/${g4}`)).body.galleryHidden === false, "2 open reports: still in the gallery");
    ok((await report(g4, { reason: "scam" }, "192.0.2.4")).status === 204, "a third report from a third address");
    const auto = (await call(GB, "GET", `/projects/${g4}`)).body;
    ok(auto.galleryHidden === true && !mine((await gallery("new")).games).includes(g4) && (await call(null, "GET", `/public/games/${g4}`)).status === 200, "3 open reports: out of the gallery by itself; the share link still works");
    ok((await db.query(`SELECT count(*)::int AS n FROM "BillingAudit" WHERE "userId" = $1 AND actor = 'job:reports' AND action = 'gallery_hide'`, [devId(GB)])).rows[0].n === 1, "audited (actor job:reports)");
    const open = admin("gallery", "reports");
    ok(open.status === 0 && open.stdout.includes(g4) && open.stdout.includes("3 reports, waiting for a look") && open.stdout.includes('"Looks like a copy of Mario"'), "admin gallery reports: the game, why it is hidden, the reports' words");
    ok(admin("gallery", "unhide", g4).status === 0 && (await call(GB, "GET", `/projects/${g4}`)).body.galleryHidden === false && mine((await gallery("new")).games).includes(g4), "admin gallery unhide: back in the gallery");
    ok(!admin("gallery", "reports").stdout.includes(g4) && admin("gallery", "reports", "--all").stdout.includes("(handled)"), "its reports are handled: off the open list, still in --all");
    await report(g1, { reason: "hate" }, "192.0.2.5");
    ok(admin("gallery", "dismiss", g1).status === 0 && !admin("gallery", "reports").stdout.includes(g1) && mine((await gallery("new")).games).includes(g1), "admin gallery dismiss: the reports handled, the game stays");
    // Security review 10-20: a game keeps at most MAX_OPEN_REPORTS open reports; past that a report is thanked and not
    // stored, so made-up addresses (an IPv6 /48 is 65,536 /64s) can't fill the database with one game's reports.
    const { MAX_OPEN_REPORTS } = await import("../dist/gallery/gallery.service.js");
    const reportFlood = [];
    for (let i = 0; i < MAX_OPEN_REPORTS + 5; i++) reportFlood.push((await report(g1, { reason: "other", text: "a flood" }, `198.51.100.${i + 1}`)).status);
    const keptOpen = (await db.query(`SELECT count(*)::int AS n FROM "GameReport" WHERE "projectId" = $1 AND "handledAt" IS NULL`, [g1])).rows[0].n;
    ok(reportFlood.every((s) => s === 204) && keptOpen === MAX_OPEN_REPORTS, `${MAX_OPEN_REPORTS + 5} reports from as many addresses: all thanked (204), ${MAX_OPEN_REPORTS} kept (${keptOpen})`);
    ok(admin("gallery", "unshare", g1, "e2e").status === 0, "admin gallery unshare");
    const un = (await call(GA, "GET", `/projects/${g1}`)).body;
    ok(un.shared === false && un.listed === false && (await call(null, "GET", `/public/games/${g1}`)).status === 404 && !mine((await gallery("new")).games).includes(g1), "unshared by an admin: the share page 404s, out of the gallery");
    ok(admin("gallery", "hide").status === 1 && admin("gallery", "hide", "nosuchgame1").status === 1, "a missing game id, or an unknown one: exit 1");
    const actions = (await db.query(`SELECT action FROM "BillingAudit" WHERE "userId" = $1 AND actor LIKE 'admin:%' ORDER BY at`, [devId(GA)])).rows.map((r) => r.action).join();
    ok(actions === "plan,gallery_hide,gallery_unhide,gallery_dismiss,gallery_unshare", `every gallery command wrote an audit row (${actions})`);
  } finally {
    gal.kill();
  }
}

/**
 * "Send feedback" (beta 1) against the main API: POST /feedback's checks (nothing stored for a bad one), what a note keeps
 * (the words as written, the page without its query, the browser, the game, its answer and the version then), the 10 a
 * day, the export, `admin feedback list | show | done` and their audit rows, a deleted game, a closed account.
 */
async function feedbackChecks(db, othersGame) {
  console.log("feedback: the note and its checks, the 10 a day, the export, admin feedback list | show | done");
  const FB = `dev:e2e-${stamp}-fb@test.local`;
  const fbId = devId(FB);
  const UA = "Mozilla/5.0 (e2e) TypePlayTest/1.0";
  const post = (token, body) =>
    fetch(API + "/feedback", {
      method: "POST",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify(body),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));
  const notes = async () => Number((await db.query(`SELECT count(*) FROM "Feedback" WHERE "userId" = $1`, [fbId])).rows[0].count);
  const game = (await api(FB, "POST", "/projects", { prompt: "A frog that hops over logs", model: "fast" })).body;
  projects.push(game.id);
  const ev = await openEvents(FB, game.id);
  await ev.until(finished);
  ev.close();
  const full = (await api(FB, "GET", `/projects/${game.id}`)).body;
  const answer = full.messages.findLast((m) => m.role === "agent");
  ok(full.currentVersion === 1 && answer?.status === "done", "a game at version 1, its answer done");

  ok((await post(null, { text: "Hi", page: "/create" })).status === 401, "no sign-in: 401");
  const bad = [
    [{ page: "/create" }, 400, "no text"],
    [{ text: "  \n\t ", page: "/create" }, 400, "only spaces"],
    [{ text: 42, page: "/create" }, 400, "text that isn't text"],
    [{ text: "x".repeat(4001), page: "/create" }, 400, "4,001 letters"],
    [{ text: "Hi", expected: "y".repeat(4001), page: "/create" }, 400, "what they expected: 4,001 letters"],
    [{ text: "Hi" }, 400, "no page"],
    [{ text: "Hi", page: "create" }, 400, "a page without its slash"],
    [{ text: "Hi", page: "/a b" }, 400, "a page with a space"],
    [{ text: "Hi", page: "/x".repeat(101) }, 400, "a page over 200 characters"],
    [{ text: "Hi", page: "/games", gameId: othersGame }, 404, "another user's game"],
    [{ text: "Hi", page: "/games", gameId: "nosuchgame" }, 404, "no such game"],
    [{ text: "Hi", page: "/games", messageId: answer.id }, 400, "a message without its game"],
    [{ text: "Hi", page: "/games", gameId: game.id, messageId: randomUUID() }, 400, "a message that isn't the game's"],
  ];
  for (const [body, status, what] of bad) {
    const r = await post(FB, body);
    ok(r.status === status && r.body?.error === (status === 404 ? "not_found" : "bad_request") && r.body.message, `${what}: ${status}, said plainly`);
  }
  ok((await notes()) === 0, "none of them stored a note");

  const words = "Le jeu s'est figé \u{1F438}\u{1F468}‍\u{1F469}‍\u{1F467}\nთამაში გაიყინა\u0007 after the second log";
  const r1 = await post(FB, { text: `  ${words}\r\n`, expected: "  The third log  ", page: `/games/${game.id}?tab=play#top`, gameId: game.id, messageId: answer.id });
  ok(r1.status === 201 && /^[a-z0-9]{10}$/.test(r1.body?.id ?? ""), "a note with the game attached: 201 and a 10-letter id");
  const row = (await db.query(`SELECT * FROM "Feedback" WHERE id = $1`, [r1.body?.id])).rows[0];
  ok(row?.text === words.replace("\u0007", "") && row.expected === "The third log", "kept as written: the line break, emoji and Georgian; the control character dropped; trimmed");
  ok(row?.page === `/games/${game.id}` && row.browser === UA, "the page without its query, the browser from the User-Agent header");
  ok(row?.projectId === game.id && row.messageId === answer.id && row.versionN === 1 && row.buildId === `${game.id}-v1`, "the game, its answer and the version playing then (build v1)");
  ok((await post(FB, { text: "ა".repeat(4000), page: "/create" })).status === 201, "4,000 Georgian letters: 201");
  const r3 = await post(FB, { text: "No game this time", expected: "", page: "/account" });
  const row3 = (await db.query(`SELECT expected, "projectId", "versionN" FROM "Feedback" WHERE id = $1`, [r3.body?.id])).rows[0];
  ok(r3.status === 201 && row3?.expected === null && row3.projectId === null && row3.versionN === null, "without a game, and an empty 'expected': stored as nothing");
  for (let i = 0; i < 7; i++) await post(FB, { text: `Note ${i + 4}`, page: "/games" });
  const over = await post(FB, { text: "One more", page: "/games" });
  ok(over.status === 429 && over.body?.error === "too_many" && /10 notes today/.test(over.body.message), "the 11th note in a day: 429 too_many, said plainly");
  ok((await notes()) === 10, "10 notes stored");

  const exp = await raw(FB, "/me/export");
  const data = exp.status === 200 ? JSON.parse(exp.buf.toString("utf8")) : {};
  ok(
    data.feedback?.length === 10 && data.feedback.some((f) => f.id === r1.body.id && f.gameId === game.id && f.messageId === answer.id && f.text === row.text && f.done === false),
    "the export carries the account's notes",
  );

  const open = admin("feedback", "list", "--open");
  ok(open.status === 0 && open.stdout.includes(r1.body.id) && open.stdout.includes(emailOf(FB)) && /OPEN/.test(open.stdout), "admin feedback list --open: the note, who sent it, OPEN");
  const show = admin("feedback", "show", r1.body.id);
  ok(
    show.status === 0 &&
      show.stdout.includes(`play.html?g=${game.id}-v1`) &&
      show.stdout.includes("თამაში") &&
      show.stdout.includes("The third log") &&
      show.stdout.includes(UA) &&
      !show.stdout.includes("\u0007"),
    "admin feedback show: the build to play, the words (Georgian kept), what they expected, the browser",
  );
  ok(
    admin("feedback", "done", r1.body.id).status === 0 && !admin("feedback", "list", "--open").stdout.includes(r1.body.id) && admin("feedback", "list").stdout.includes(r1.body.id),
    "admin feedback done: out of list --open, still in list",
  );
  ok(/already done/.test(admin("feedback", "done", r1.body.id).stdout), "done twice: says so");
  ok(admin("feedback", "show", "nosuchnote").status === 1 && admin("feedback", "show").status === 1 && admin("feedback", "nothing").status === 1, "an unknown id, no id, an unknown command: exit 1");
  const actions = (await db.query(`SELECT action FROM "BillingAudit" WHERE "userId" = $1 AND actor LIKE 'admin:%' ORDER BY at`, [fbId])).rows.map((r) => r.action).join();
  ok(actions === "feedback_show,feedback_done,feedback_done", `admin show and done wrote audit rows (${actions})`);

  ok((await api(FB, "DELETE", `/projects/${game.id}`)).status === 200, "the game deleted");
  const kept = (await db.query(`SELECT "projectId", "messageId", text FROM "Feedback" WHERE id = $1`, [r1.body.id])).rows[0];
  ok(kept?.projectId === null && kept.messageId === null && kept.text === row.text, "a deleted game leaves the note, without the game");
  ok(/deleted since/.test(admin("feedback", "show", r1.body.id).stdout), "admin feedback show: the game was deleted since");
  ok((await api(FB, "DELETE", "/me", { confirm: "DELETE" })).status === 200 && (await notes()) === 0, "closing the account deletes its notes");
}

/**
 * The closed beta (BETA_INVITE_ONLY), against an API of our own on :3021 started with it on: an uninvited email is 403
 * invite_only on every signed-in route and makes no user; an invite lets it in (Gmail's dots, a +tag and capitals don't
 * matter), admin grant works for it, removing the invite locks the account out again; ADMIN_EMAILS always get in;
 * admin invite add | list | remove and their audit rows. The main API runs with it off (this PC's default): every other
 * check in this file is "as today".
 */
async function inviteChecks(db) {
  console.log("the closed beta: invite only on an API of our own on :3021 (BETA_INVITE_ONLY=1); admin invite add | list | remove");
  const { inviteMatch } = await import("../dist/beta/invites.js");
  const { emailHash } = await import("../dist/auth/tombstone.js");
  ok(
    inviteMatch("Luka.L+beta@Gmail.com") === "lukal@gmail.com" && inviteMatch("a.b@googlemail.com") === "ab@gmail.com" && inviteMatch("A.B+x@Example.com") === "a.b+x@example.com",
    "matching: Gmail without its dots and +tag, other domains as they are",
  );
  ok((await (await fetch(`${API}/health`)).json()).inviteOnly === false, "the main API (this PC's default): invite only off, so every check above ran as today");
  const BOSS = `dev:e2e-${stamp}-boss@test.local`;
  const beta = await spawnApi(3021, { BETA_INVITE_ONLY: "1", ADMIN_EMAILS: emailOf(BOSS) });
  const U = `dev:e2e-${stamp}-u@test.local`; // never invited
  const I = `dev:e2e-${stamp}-inv@gmail.com`; // invited as written below
  const given = `E2E-${stamp}-I.N.V+beta@Gmail.com`;
  const call = async (token, method, path, body) => {
    const send = () =>
      fetch(beta.url + path, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    const res = await send().catch((e) => (e?.cause?.code === "ECONNRESET" ? send() : Promise.reject(e)));
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = { raw: text.slice(0, 80) };
    }
    return { status: res.status, body: parsed };
  };
  try {
    ok((await (await fetch(`${beta.url}/health`)).json()).inviteOnly === true, "/health says inviteOnly: true");
    const routes = [
      ["GET", "/me"],
      ["GET", "/estimate?kind=new&model=fast"],
      ["GET", "/me/usage"],
      ["GET", "/me/export"],
      ["DELETE", "/me", { confirm: "DELETE" }],
      ["GET", "/projects"],
      ["POST", "/projects", { prompt: "A game for a stranger", model: "fast" }],
      ["GET", "/projects/abcdefghij"],
      ["GET", "/projects/abcdefghij/events"],
      ["POST", "/projects/abcdefghij/messages", { text: "Add coins", model: "fast" }],
      ["POST", "/projects/abcdefghij/restore", { n: 1 }],
      ["POST", "/projects/abcdefghij/cancel"],
      ["PATCH", "/projects/abcdefghij", { name: "Mine" }],
      ["DELETE", "/projects/abcdefghij"],
      ["GET", "/projects/abcdefghij/download"],
      ["GET", "/projects/abcdefghij/android"],
      ["GET", "/billing"],
      ["POST", "/billing/checkout", { item: "plan:medium", consentVersion: "v1", acceptedTerms: true }],
      ["POST", "/feedback", { text: "Let me in", page: "/create" }],
    ];
    // Security review 10-20: and every other signed-in route in the contract's route list (packages/shared/src/index.ts):
    // its downloads, the Android routes, the billing routes, whatever is added there later. The sign-in check is global,
    // so a route is public only with @Public() (checked after).
    const contractRoutes = new Set();
    for (const line of readFileSync(join(root, "packages/shared/src/index.ts"), "utf8").split("\n")) {
      if (line.startsWith("//")) for (const m of line.matchAll(/\b(GET|POST|PATCH|DELETE)\s+(\/[^\s,?]*)/g)) contractRoutes.add(`${m[1]} ${m[2]}`);
    }
    const isPublicRoute = (r) => /^(GET|POST) \/(public|webhooks|android\/dl)\//.test(r);
    const signedIn = [...contractRoutes].filter((r) => !isPublicRoute(r));
    const asked = new Set(routes.map(([method, path]) => `${method} ${path.split("?")[0]}`));
    for (const r of signedIn) {
      const [method, template] = r.split(" ");
      const path = template.replace(":bid", "abcdefghij-a1").replace(":id", "abcdefghij");
      if (!asked.has(`${method} ${path}`)) routes.push([method, path, method === "GET" || method === "DELETE" ? undefined : {}]);
      asked.add(`${method} ${path}`);
    }
    ok(signedIn.length >= 35 && [...contractRoutes].filter(isPublicRoute).length >= 6, `the contract lists ${signedIn.length} signed-in routes and ${[...contractRoutes].filter(isPublicRoute).length} public ones`);
    const answers = [];
    for (const [method, path, body] of routes) answers.push([`${method} ${path}`, await call(U, method, path, body)]);
    const wrong = answers.filter(([, r]) => r.status !== 403 || r.body?.error !== "invite_only");
    ok(!wrong.length, `uninvited: 403 invite_only on all ${routes.length} signed-in routes${wrong.length ? ` (not: ${wrong.map(([p, r]) => `${p} ${r.status}`).join(", ")})` : ""}`);
    ok(/closed beta/.test(answers[0][1].body?.message ?? ""), "GET /me says why, in one sentence the site can show");
    const left = (await db.query(`SELECT (SELECT count(*) FROM "User" WHERE id = $1) AS users, (SELECT count(*) FROM "CreditEntry" WHERE "userId" = $1) AS credits`, [devId(U)])).rows[0];
    ok(left.users === "0" && left.credits === "0", "no user row and no credits for the uninvited email");
    ok((await call(null, "GET", "/public/gallery")).status === 200 && (await call(null, "GET", "/me")).status === 401, "the public routes still answer everyone; no sign-in is still 401");
    // The public surface (security review 10-20): @Public() only on the phone link, the Paddle webhook and /public/*, and
    // main.ts's one route of its own is /health. A new @Public() fails here until it is looked at.
    const publicIn = [];
    const walk = (dir) => {
      for (const d of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, d.name);
        if (d.isDirectory()) {
          if (d.name !== "generated") walk(p);
        } else if (p.endsWith(".ts")) {
          const n = (readFileSync(p, "utf8").match(/^\s*@Public\(\)/gm) ?? []).length;
          if (n) publicIn.push(`${p.slice(join(here, "src").length + 1).replace(/\\/g, "/")}:${n}`);
        }
      }
    };
    walk(join(here, "src"));
    const ownRoutes = readFileSync(join(here, "src/main.ts"), "utf8").match(/\)\.(get|post|put|patch|delete|all|use)\("[^"]*"/g) ?? [];
    ok(
      publicIn.sort().join() === "android/android.controller.ts:1,billing/webhooks.controller.ts:1,public.controller.ts:1" && ownRoutes.join() === ').get("/health"',
      `the public surface: @Public() on ${publicIn.join(", ")}; main.ts's own route ${ownRoutes.join(", ")}`,
    );
    ok((await call(BOSS, "GET", "/me")).status === 200, "ADMIN_EMAILS get in without an invite");
    ok((await call(I, "GET", "/me")).status === 403, "the tester before the invite: 403");

    const add = admin("invite", "add", given, "e2e", "tester");
    ok(add.status === 0 && /invited/.test(add.stdout), "admin invite add: invited");
    const meI = await call(I, "GET", "/me");
    ok(meI.status === 200 && meI.body?.credits?.available === 20, "invited (written with dots, a +tag and capitals): signs in with the Free plan's 20 credits");
    const inv = (await db.query(`SELECT email, note, "usedAt" FROM "Invite" WHERE match = $1`, [emailOf(I)])).rows[0];
    ok(inv?.email === given.toLowerCase() && inv.note === "e2e tester" && inv.usedAt, "the invite: the address as given (lower case), its note, the first sign-in noted");
    ok(
      (await call(I, "GET", "/projects")).status === 200 && (await call(I, "POST", "/feedback", { text: "I'm in", page: "/create" })).status === 201,
      "the invited tester uses the app as anyone: their games, a note",
    );
    ok(admin("grant", emailOf(I), "5", "Beta 1").status === 0 && (await call(I, "GET", "/me")).body?.credits?.available === 25, "admin grant works for an invited tester: 25 credits");
    ok(/already invited/.test(admin("invite", "add", emailOf(I)).stdout), "inviting again (another spelling): already invited");
    ok(/note changed/.test(admin("invite", "add", emailOf(I), "a", "new", "note").stdout), "... with a note: the note changes");
    const list = admin("invite", "list");
    ok(
      list.status === 0 &&
        list.stdout.includes(given.toLowerCase()) &&
        /first sign-in \d{4}-\d\d-\d\d/.test(list.stdout) &&
        list.stdout.includes(`signs in as ${emailOf(I)}`) &&
        /25 credits/.test(list.stdout) &&
        list.stdout.includes('"a new note"'),
      "admin invite list: the invite, its first sign-in, the account it lets in and its credits, the note",
    );
    ok(admin("invite", "remove", emailOf(I)).status === 0, "admin invite remove (the address as Google has it)");
    const again = await call(I, "GET", "/me");
    ok(again.status === 403 && again.body?.error === "invite_only", "removed: 403 invite_only again");
    ok((await db.query(`SELECT count(*) FROM "User" WHERE id = $1`, [devId(I)])).rows[0].count === "1", "the account stays (its games and credits), locked out until invited again");
    ok(admin("invite", "remove", emailOf(I)).status === 1 && admin("invite", "add", "not-an-email").status === 1 && admin("invite").status === 1, "removing twice, a bad address, no command: exit 1");
    const audits = (await db.query(`SELECT action, details FROM "BillingAudit" WHERE actor LIKE 'admin:%' AND details->>'emailHash' = $1 ORDER BY at`, [emailHash(emailOf(I))])).rows;
    ok(
      audits.map((a) => a.action).join() === "invite_add,invite_add,invite_add,invite_remove" && !JSON.stringify(audits).includes("@"),
      `every invite command wrote an audit row, the address scrambled (${audits.map((a) => a.action).join()})`,
    );
  } finally {
    beta.kill();
  }
}

/**
 * The Free plan's mark (game.json `badge`, which apps/games/play.html shows) and Godot's import cache. A build follows its
 * owner's plan when it is published: Free true, a paid plan false. A later plan change rewrites no build, and a restore
 * plays the old build, so it keeps that build's mark. A restore and a failed run's reset take the game folder's `.godot/`
 * with them (git-ignored, so git alone would leave it).
 */
async function badgeChecks() {
  console.log("the Free plan's mark (game.json badge); Godot's import cache after a restore and a reset");
  const { mkdirSync } = await import("node:fs");
  const K = `dev:e2e-${stamp}-badge@test.local`;
  const gameJson = (buildId) => {
    try {
      return JSON.parse(readFileSync(join(BUILDS, buildId, "game.json"), "utf8"));
    } catch {
      return {};
    }
  };
  const cache = (id) => join(DATA, "projects", id, ".godot");
  /** A stale import cache like the one Godot leaves (every game's .gitignore lists .godot/, the fake runs' too). */
  const plantCache = (id) => {
    mkdirSync(join(cache(id), "imported"), { recursive: true });
    writeFileSync(join(cache(id), "imported", "gone.png-0123abcd.ctex"), "stale");
    writeFileSync(join(cache(id), "uid_cache.bin"), "stale");
  };
  ok((await api(K, "GET", "/me")).body?.plan === "free", "a maker on Free");
  const made = await api(K, "POST", "/projects", { prompt: "A fox that collects berries", model: "fast" });
  const id = made.body?.id;
  if (!id) return ok(false, `the Free maker's game starts (${made.status})`);
  projects.push(id);
  const s = await openEvents(K, id);
  try {
    const v1 = await s.until(finished);
    ok(v1.type === "done" && gameJson(`${id}-v1`).badge === true, "a Free owner's build: game.json badge true");
    ok(admin("plan", emailOf(K), "medium").status === 0, "admin plan medium");
    await api(K, "POST", `/projects/${id}/messages`, { text: "Add a river", model: "fast" });
    const v2 = await s.until((e) => (e.type === "done" && e.version?.n === 2) || e.type === "failed");
    ok(v2.type === "done" && gameJson(`${id}-v2`).badge === false, "a paid owner's (Medium) next build: badge false");
    ok(gameJson(`${id}-v1`).badge === true, "the plan change rewrote no build: version 1 keeps its badge");
    plantCache(id);
    ok(gitIn(id, "status", "--porcelain", "--ignored").split("\n").includes("!! .godot/"), "a stale import cache planted (.godot/, ignored by git)");
    const restored = await api(K, "POST", `/projects/${id}/restore`, { n: 1 });
    const v3 = restored.body?.versions?.at(-1);
    ok(restored.status === 200 && v3?.n === 3 && v3.buildId === `${id}-v1` && gameJson(v3.buildId).badge === true, "restore 1 on Medium: version 3 plays v1's build, so it keeps the badge");
    ok(!existsSync(cache(id)), "the restore cleared Godot's import cache (.godot/ gone)");
    ok(existsSync(join(DATA, "projects", id, "project.godot")) && gitIn(id, "status", "--porcelain") === "", "the game's files stay, the folder clean");
    plantCache(id);
    await api(K, "POST", `/projects/${id}/messages`, { text: "Please FAIL now", model: "fast" });
    const failed = await s.until((e) => e.type === "failed");
    ok(failed.message?.credits === 0 && !existsSync(cache(id)), "a failed run's reset clears the import cache too");
    ok(gitIn(id, "status", "--porcelain") === "" && !existsSync(join(DATA, "projects", id, "junk.txt")), "and leaves the folder clean at version 3");
    const back = await api(K, "POST", `/projects/${id}/restore`, { n: 2 });
    ok(back.status === 200 && back.body.buildId === `${id}-v2` && gameJson(`${id}-v2`).badge === false, "restore 2: its own build, no badge");
  } finally {
    s.close();
  }
}

/**
 * The screens a game is made for (the platform choice, 2026-10-25): the new-game request's pick reaches the agent, the
 * project records what the game's folder says after each build (the agent's own pick resolved to a shape, a change
 * that makes it fill every screen), and a restore puts the older version's back.
 */
async function platformChecks() {
  console.log("the platform: phone, computer, every screen; a change that makes it fill; a restore");
  const P = `dev:e2e-${stamp}-platform@test.local`;
  await api(P, "GET", "/me");
  ok(admin("plan", emailOf(P), "medium").status === 0, "a maker on Medium (six builds in a row)");
  ok((await api(P, "POST", "/projects", { prompt: "A cat on a tablet", model: "fast", platform: "tablet" })).body?.error === "bad_request", "platform tablet: bad_request");
  const s = { stream: null };
  const build = async (body) => {
    const made = await api(P, "POST", "/projects", { model: "fast", ...body });
    if (!made.body?.id) return null;
    projects.push(made.body.id);
    s.stream = await openEvents(P, made.body.id);
    const end = await s.stream.until(finished);
    s.stream.close();
    return { id: made.body.id, made: made.body, end };
  };
  const word = (id) => readFileSync(join(DATA, "projects", id, "PLATFORM"), "utf8").trim();
  const phone = await build({ prompt: "A frog that hops over logs", platform: "phone" });
  ok(phone?.made.platform === "phone", "the pick is on the project at once (the preview opens on it)");
  ok(phone?.end.type === "done" && phone.end.project.platform === "phone" && phone.end.project.orientation === "portrait" && word(phone.id) === "phone", "phone: recorded, portrait, the folder says phone");
  const computer = await build({ prompt: "A car that races on a wide road", platform: "computer" });
  ok(computer?.end.type === "done" && computer.end.project.platform === "computer" && computer.end.project.orientation === "landscape", "computer: recorded, landscape");
  const fill = await build({ prompt: "A puzzle for every screen", platform: "fill" });
  ok(fill?.end.type === "done" && fill.end.project.platform === "fill" && word(fill.id) === "fill", "every screen: recorded as fill");
  const auto = await build({ prompt: "A game with no pick" });
  ok(auto?.made.platform === null && auto?.end.type === "done" && auto.end.project.platform === "phone" && word(auto.id) === "auto", "no pick: the agent's own shape (the template's portrait), recorded as phone");
  if (!phone) return;
  const list = (await api(P, "GET", "/projects")).body;
  ok(Array.isArray(list) && list.find((g) => g.id === phone.id)?.platform === "phone", "the games list carries it");
  // The "Made for phones" hint's request: the fake agent fills on a change with FILL, as the agent switches on "fit here too".
  const ev = await openEvents(P, phone.id);
  try {
    await api(P, "POST", `/projects/${phone.id}/messages`, { text: "Make it fit computer screens too FILL", model: "fast" });
    const v2 = await ev.until((e) => (e.type === "done" && e.version?.n === 2) || e.type === "failed");
    ok(v2.type === "done" && v2.project.platform === "fill", "a change that makes it fill every screen: the project says fill");
    const back = await api(P, "POST", `/projects/${phone.id}/restore`, { n: 1 });
    ok(back.status === 200 && back.body.platform === "phone", "restore version 1: phone again");
  } finally {
    ev.close();
  }
}

async function main() {
  console.log(`e2e against ${API}`);
  // Never against a real server: a run would burn the agent, and cleanup deletes users under it.
  const health = await (await fetch(`${API}/health`)).json().catch(() => null);
  if (health?.agent !== "fake") throw new Error("the e2e needs a server started with DEV_AUTH=1 AGENT_FAKE=1 (GET /health says agent: fake)");

  console.log("credit math");
  ok(creditsForUsd(0.1) === 1.7, "$0.10 -> 1.7 credits");
  ok(creditsForUsd(0) === 0.1, "minimum 0.1");
  ok(creditsForUsd(0.06) === 1 && creditsForUsd(0.0601) === 1.1, "rounds up to 0.1");
  ok(estimate("new", "smart", "free").needsConfirm && !estimate("new", "best", "medium").needsConfirm, "ask-first limits 3 / 25");

  console.log("auth and /me");
  ok((await api(null, "GET", "/me")).status === 401, "no token: 401");
  ok((await api("not-a-jwt", "GET", "/me")).body?.error === "unauthorized", "bad token: unauthorized");
  // Forged sign-ins: a well-formed ES256 token from a key that isn't Supabase's, alg "none", and
  // HS256 with a made-up secret. Each is refused everywhere, and none makes a user.
  const { SignJWT, generateKeyPair } = await import("jose");
  const issuer = `${process.env.SUPABASE_URL.replace(/\/+$/, "")}/auth/v1`;
  const forgedSub = randomUUID();
  const claims = { sub: forgedSub, email: `forged-${stamp}@test.local`, role: "authenticated", user_metadata: { name: "Forged" } };
  const { privateKey } = await generateKeyPair("ES256");
  const es256 = await new SignJWT(claims).setProtectedHeader({ alg: "ES256", kid: "not-supabase" }).setIssuer(issuer).setAudience("authenticated").setIssuedAt().setExpirationTime("1h").sign(privateKey);
  const hs256 = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience("authenticated").setIssuedAt().setExpirationTime("1h").sign(randomBytes(32));
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ ...claims, iss: issuer, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.`;
  for (const [name, token] of [["ES256 from another key", es256], ["alg none", none], ["HS256 with a made-up secret", hs256]]) {
    const me = await api(token, "GET", "/me");
    ok(me.status === 401 && me.body?.error === "unauthorized", `${name}: GET /me 401 unauthorized`);
  }
  const me = await api(A, "GET", "/me");
  ok(me.status === 200 && me.body.plan === "free" && me.body.models.join() === "fast", "new user: Free, fast only");
  ok(me.body.credits.available === 20 && me.body.credits.todayLeft === 5, "20 credits, 5 today");
  ok(me.body.credits.expiring?.amount === 20 && daysUntil(me.body.credits.expiring.at) >= 27 && daysUntil(me.body.credits.expiring.at) <= 32, "the 20 free credits end in a month (credits.expiring)");
  const est = await api(A, "GET", "/estimate?kind=new&model=fast");
  ok(est.body.typical === 1.7 && est.body.low === 1.2 && est.body.high === 2.1 && est.body.needsConfirm === false, "estimate fast new");
  ok((await api(A, "GET", "/estimate?kind=x&model=fast")).body?.error === "bad_request", "bad estimate: bad_request");
  const high = (await api(A, "GET", "/estimate?kind=new&model=fast&effort=high")).body;
  ok(high.typical === 3.1 && high.low === 2.2 && high.high === 3.8 && high.needsConfirm && high.effort === "high", "estimate fast new, high effort: x1.8, asks first on Free");
  const lowE = (await api(A, "GET", "/estimate?kind=edit&model=fast&effort=low")).body;
  ok(lowE.typical === 0.2 && lowE.low === 0.1 && lowE.high === 0.4 && lowE.effort === "low", "estimate fast edit, low effort: x0.8, at least 0.1");
  ok((await api(A, "GET", "/estimate?kind=new&model=fast&effort=max")).body?.error === "bad_request", "bad effort: bad_request");
  ok((await api(A, "POST", "/projects", { prompt: "A frog that hops", model: "fast", effort: "high" })).body?.error === "needs_confirm", "high effort on Free past 3 credits: needs_confirm");

  console.log("create a game");
  const smart = await api(A, "POST", "/projects", { prompt: "A cat that jumps", model: "smart" });
  ok(smart.status === 403 && smart.body.error === "model_not_in_plan", "Free + smart: 403 model_not_in_plan");
  ok((await api(A, "POST", "/projects", { model: "fast" })).body?.error === "bad_request", "no prompt: bad_request");
  const created = await api(A, "POST", "/projects", { prompt: "A cat that jumps over boxes", model: "fast" });
  const p = created.body;
  projects.push(p.id);
  ok(created.status === 201 && p.status === "running" && /^[a-z0-9]{10}$/.test(p.id), "201, running, 10-char id");
  ok(p.messages.length === 2 && p.messages[0].role === "user" && p.messages[1].status === "running", "prompt + running agent message");
  ok(p.versions.length === 0 && p.buildId === null && p.currentVersion === null, "no version yet");

  const s1 = await openEvents(A, p.id);
  ok(s1.status === 200 && /text\/event-stream/.test(s1.contentType), "events: 200 text/event-stream");
  const done1 = await s1.until(finished);
  ok(s1.events[0].type === "snapshot" && s1.events[0].project.id === p.id, "snapshot first");
  ok(s1.events.some((e) => e.type === "progress" && e.text), "progress events");
  ok(done1.type === "done" && done1.version?.n === 1 && done1.version.buildId === `${p.id}-v1`, "done: version 1");
  ok(done1.message.status === "done" && done1.message.credits === 1.7 && done1.message.versionN === 1, "agent message done, 1.7 credits");
  // The fake run reports $0.14 of work (costUsd, both attempts) and $0.10 in the game kept (chargeUsd).
  ok(creditsForUsd(0.14) === 2.4 && done1.message.credits === 1.7, "charged for the kept attempt ($0.10 -> 1.7), not every attempt ($0.14 -> 2.4)");
  ok(done1.credits.available === 18.3 && done1.credits.todayLeft === 3.3, "credits 18.3, 3.3 left today");
  ok(done1.project.status === "idle" && done1.project.buildId === `${p.id}-v1`, "project idle with build");
  const build1 = join(BUILDS, `${p.id}-v1`);
  const meta = existsSync(join(build1, "game.json")) ? JSON.parse(readFileSync(join(build1, "game.json"), "utf8")) : {};
  ok(existsSync(join(build1, "index.pck")) && meta.source === "user" && meta.pack === "index.pck" && meta.engine, "build folder published");
  const poster = existsSync(join(build1, "poster.png")) ? readFileSync(join(build1, "poster.png")) : Buffer.alloc(0);
  ok(poster.subarray(0, 4).toString("latin1") === "\x89PNG" && done1.project.poster === true, "poster.png published next to the build");
  ok(done1.project.shared === false, "private by default");

  console.log("edit, busy, restore");
  const edit = await api(A, "POST", `/projects/${p.id}/messages`, { text: "Add coins", model: "fast" });
  ok(edit.status === 201 && edit.body.status === "running" && edit.body.messages.length === 4, "edit started");
  const busy = await api(A, "POST", `/projects/${p.id}/messages`, { text: "Add more", model: "fast" });
  ok(busy.status === 409 && busy.body.error === "busy", "second message while running: 409 busy");
  ok((await api(A, "POST", `/projects/${p.id}/restore`, { n: 1 })).status === 409, "restore while running: 409");
  // A stream opened mid-run gets the snapshot, then the "building…" line so far (the last progress).
  const editMsgId = edit.body.messages.at(-1).id;
  await s1.until((e) => e.type === "progress" && e.messageId === editMsgId);
  const mid = await openEvents(A, p.id);
  await mid.until((e) => e.type === "snapshot");
  ok(mid.events[0].project.status === "running", "snapshot mid-run says running");
  await mid.until((e) => e.type === "progress");
  const seenLines = s1.events.filter((e) => e.type === "progress" && e.messageId === editMsgId).map((e) => e.text);
  ok(mid.events[1]?.type === "progress" && seenLines.includes(mid.events[1].text), `mid-run: the progress so far comes right after the snapshot ("${mid.events[1]?.text}")`);
  ok((await api(null, "GET", `/projects/${p.id}/events`)).status === 401, "events without a token: 401 (no stream)");
  ok((await api(es256, "GET", `/projects/${p.id}/events`)).status === 401, "events with a forged token: 401 (no stream)");
  const done2 = await s1.until((e) => e.type === "done" && e.version?.n === 2);
  ok(done2.message.credits === 1.7 && done2.credits.available === 16.6, "version 2, 16.6 credits");
  await mid.until((e) => e.type === "done");
  mid.close();
  ok(gitIn(p.id, "status", "--porcelain") === "", "folder clean after the edit");
  // The daily rule is the balance rule: 1.6 left today is under a high-effort new game's low (2.2), the same line the site shows.
  const nearly = await api(A, "POST", "/projects", { prompt: "A big game", model: "fast", effort: "high", confirm: true });
  ok(nearly.status === 402 && nearly.body.error === "daily_limit" && /^Not enough of today's 5 free credits left for this \(1\.6 left; it needs at least 2\.2\)/.test(nearly.body.message), "1.6 left today, high-effort new game needs 2.2: 402 daily_limit, says what's left");

  const restore = await api(A, "POST", `/projects/${p.id}/restore`, { n: 1 });
  const v3 = restore.body.versions?.at(-1);
  ok(restore.status === 200 && restore.body.currentVersion === 3 && v3?.label === "Restored version 1", "restore 1 -> version 3");
  ok(v3?.buildId === `${p.id}-v1` && restore.body.buildId === `${p.id}-v1`, "version 3 plays v1's build");
  ok(readFileSync(join(DATA, "projects", p.id, "FAKE.md"), "utf8").trim().split("\n").length === 1, "files are v1's again");
  ok((await api(A, "POST", `/projects/${p.id}/restore`, { n: 99 })).body?.error === "not_found", "restore missing version: not_found");

  console.log("failure and cancel are free");
  const commitBefore = gitIn(p.id, "rev-parse", "HEAD");
  await api(A, "POST", `/projects/${p.id}/messages`, { text: "Please FAIL now", model: "fast" });
  const failed = await s1.until((e) => e.type === "failed");
  ok(failed.message.status === "failed" && failed.message.credits === 0, "failed run: 0 credits");
  ok(failed.credits.available === 16.6 && failed.project.buildId === `${p.id}-v1`, "balance and version unchanged");
  // The fake failure committed a half-done change and left junk.txt: both gone.
  ok(gitIn(p.id, "rev-parse", "HEAD") === commitBefore && gitIn(p.id, "status", "--porcelain") === "" && !existsSync(join(DATA, "projects", p.id, "junk.txt")), "folder back at version 3: the failed run's commit and its junk file gone");

  await api(A, "POST", `/projects/${p.id}/messages`, { text: "Add stars", model: "fast" });
  const cancelled = await api(A, "POST", `/projects/${p.id}/cancel`);
  ok(cancelled.status === 200 && cancelled.body.status === "idle" && cancelled.body.currentVersion === 3, "cancel: idle, still version 3");
  ok(cancelled.body.messages.at(-1).status === "failed" && cancelled.body.messages.at(-1).credits === 0, "cancelled message: failed, 0 credits");
  ok(gitIn(p.id, "rev-parse", "HEAD") === commitBefore && gitIn(p.id, "status", "--porcelain") === "", "folder clean after cancel");

  // A Stop that lands after the agent finished, while the build is being published ("SLOW" makes
  // the fake run's publish take 3 s): still no version, no charge, no build on the games origin.
  await api(A, "POST", `/projects/${p.id}/messages`, { text: "Add rain SLOW", model: "fast" });
  await new Promise((r) => setTimeout(r, 6500)); // the fake agent exits at ~5.3 s; publishing then waits 3 s
  const late = await api(A, "POST", `/projects/${p.id}/cancel`);
  ok(late.status === 200 && late.body.status === "idle" && late.body.currentVersion === 3 && late.body.versions.length === 3, "stop after the agent finished: still version 3, no version 4");
  ok(late.body.messages.at(-1).status === "failed" && late.body.messages.at(-1).credits === 0 && /Stopped/.test(late.body.messages.at(-1).text), "late stop: message says stopped, 0 credits");
  ok((await api(A, "GET", "/me")).body.credits.available === 16.6 && !existsSync(join(BUILDS, `${p.id}-v4`)), "late stop: balance unchanged, the published build taken back");
  ok(gitIn(p.id, "rev-parse", "HEAD") === commitBefore && gitIn(p.id, "status", "--porcelain") === "", "folder clean after the late stop");

  console.log("Free daily limit");
  await api(A, "POST", `/projects/${p.id}/messages`, { text: "Make it night", model: "fast" });
  const done4 = await s1.until((e) => e.type === "done" && e.version?.n === 4);
  ok(done4.credits.available === 14.9 && done4.credits.todayLeft === 0, "after 5.1 credits today: 0 left");
  const daily = await api(A, "POST", `/projects/${p.id}/messages`, { text: "One more", model: "fast" });
  ok(daily.status === 402 && daily.body.error === "daily_limit" && /used today's 5/.test(daily.body.message), "402 daily_limit");
  s1.close();
  const meA = await api(A, "GET", "/me");
  ok(meA.body.credits.available === 14.9, "ledger: 20 - 3 x 1.7 = 14.9");
  const list = await api(A, "GET", "/projects");
  ok(list.body.length === 1 && list.body[0].id === p.id && list.body[0].buildId === `${p.id}-v4`, "project list");
  const full = await api(A, "GET", `/projects/${p.id}`);
  ok(full.body.versions.map((v) => v.n).join() === "1,2,3,4" && full.body.messages.length === 12, "4 versions, 12 messages");

  console.log("another user");
  ok((await api(B, "GET", `/projects/${p.id}`)).status === 404, "can't read A's project (404)");
  ok((await api(B, "POST", `/projects/${p.id}/messages`, { text: "hi", model: "fast" })).status === 404, "can't send to it (404)");
  ok((await openEvents(B, p.id)).status === 404, "can't stream it (404)");
  ok((await api(B, "GET", "/projects")).body.length === 0, "B sees no projects");

  console.log("no credits, paid plan, holds, capacity");
  await api(B, "GET", "/me");
  ok(admin("grant", emailOf(B), "-20", "e2e").status === 0, "admin grant -20");
  const broke = await api(B, "POST", "/projects", { prompt: "A frog game", model: "fast" });
  ok(broke.status === 402 && broke.body.error === "no_credits", "402 no_credits");
  ok(admin("plan", emailOf(B), "high").status === 0 && admin("grant", emailOf(B), "9").status === 0, "admin plan high + 9 credits");
  const meB = await api(B, "GET", "/me");
  ok(meB.body.plan === "high" && meB.body.models.length === 3 && meB.body.credits.todayLeft === null && meB.body.credits.available === 9, "paid: 3 models, no daily limit");
  ok(admin("list").stdout.includes(emailOf(B)), "admin list shows the user");
  // Holds: a run going holds its estimate's high (a Smart new game: 8.2 of the 9), so a second
  // message can't spend the same credits; the charge (1.7) replaces the hold when it finishes.
  const first = await api(B, "POST", "/projects", { prompt: "Game number 0", model: "smart" });
  ok(first.status === 201, "Smart new game with 9 credits: starts (holds 8.2)");
  projects.push(first.body.id);
  const held = await api(B, "POST", "/projects", { prompt: "Another while it builds", model: "fast" });
  ok(held.status === 402 && held.body.error === "no_credits" && /build that's going/.test(held.body.message), "a second game while the first holds the credits: 402 no_credits, says why");
  const sFirst = await openEvents(B, first.body.id);
  await sFirst.until(finished);
  sFirst.close();
  ok((await api(B, "GET", "/me")).body.credits.available === 7.3, "charged 1.7, not the 8.2 held: 7.3 left");
  // The race: two messages at the same moment on credits that cover one (2.0 for a Fast new game,
  // low 1.2, hold 2.1): exactly one starts, the other is refused in the same tick.
  ok(admin("grant", emailOf(B), "-5.3").status === 0, "admin grant -5.3 (2.0 left)");
  const race = await Promise.all([0, 1].map((i) => api(B, "POST", "/projects", { prompt: `Race ${i}`, model: "fast" })));
  const raceWon = race.filter((r) => r.status === 201);
  ok(raceWon.length === 1 && race.some((r) => r.status === 402 && r.body.error === "no_credits"), "two parallel messages on credits for one: one starts, one 402");
  for (const r of raceWon) {
    projects.push(r.body.id);
    const s = await openEvents(B, r.body.id);
    await s.until(finished);
    s.close();
  }
  ok((await api(B, "GET", "/me")).body.credits.available === 0.3, "the one that started was charged: 0.3 left");
  ok(admin("grant", emailOf(B), "30").status === 0, "admin grant 30 (30.3)");
  // Runs at once: High builds two at a time, Free and Medium one; MAX_RUNS (3 on this PC) over everyone.
  const runs = [first.body.id];
  for (let i = 1; i < 3; i++) {
    const r = await api(B, "POST", "/projects", { prompt: `Game number ${i}`, model: "fast" });
    if (r.body?.id) {
      projects.push(r.body.id);
      runs.push(r.body.id);
    }
  }
  ok(runs.length === 3, "High: two builds at once");
  const third = await api(B, "POST", "/projects", { prompt: "Game number 3", model: "fast" });
  ok(third.status === 409 && third.body.error === "busy" && /2 games at a time/.test(third.body.message), "a third at once on High: 409 busy (the plan's two)");
  ok((await api(D, "GET", "/me")).body.credits.available === 20, "D signs up (Free)");
  const dRun = await api(D, "POST", "/projects", { prompt: "D's game", model: "fast" });
  ok(dRun.status === 201, "D's build starts: 3 running in all");
  if (dRun.body?.id) projects.push(dRun.body.id);
  const dSecond = await api(D, "POST", "/projects", { prompt: "D's second game", model: "fast" });
  ok(dSecond.status === 409 && dSecond.body.error === "busy" && /one game at a time/.test(dSecond.body.message), "D's second at once: 409 busy (Free: one at a time)");
  const eRun = await api(E, "POST", "/projects", { prompt: "E's game", model: "fast" });
  ok(eRun.status === 409 && eRun.body.error === "busy" && /as many games as it can/.test(eRun.body.message), "E, with 3 running in all: 409 busy (MAX_RUNS)");
  // All three streams open before waiting: the three fake runs end within the same second, so a stream opened after the
  // first one ended would only get the snapshot, never its run's end.
  const streams = [];
  for (const [token, id] of [[B, runs[1]], [B, runs[2]], [D, dRun.body?.id]]) if (id) streams.push(await openEvents(token, id));
  for (const s of streams) {
    await s.until(finished);
    s.close();
  }
  ok((await api(B, "GET", "/me")).body.credits.available === 26.9, "B's 3 runs charged: 30.3 - 5.1 = 26.9");
  ok((await api(E, "POST", "/projects", { prompt: "E's game", model: "fast" })).status === 201, "E can build once a slot is free");
  {
    const eId = (await api(E, "GET", "/projects")).body[0]?.id;
    if (eId) {
      projects.push(eId);
      const s = await openEvents(E, eId);
      await s.until(finished);
      s.close();
    }
  }
  // Ask first, then confirm: a Best new game at high effort (up to 43.2 credits) needs confirm: true
  // exactly; the string "true" doesn't count.
  const bestHigh = { prompt: "An epic game", model: "best", effort: "high" };
  ok((await api(B, "POST", "/projects", bestHigh)).body?.error === "needs_confirm", "Best new game at high effort: 409 needs_confirm");
  ok((await api(B, "POST", "/projects", { ...bestHigh, confirm: "true" })).body?.error === "needs_confirm", 'confirm: "true" (a string) still asks');
  const confirmed = await api(B, "POST", "/projects", { ...bestHigh, confirm: true });
  ok(confirmed.status === 201 && confirmed.body.messages[1].effort === "high" && confirmed.body.messages[1].model === "best", "confirm: true starts it, at high effort on Best");
  if (confirmed.body?.id) {
    projects.push(confirmed.body.id);
    const s = await openEvents(B, confirmed.body.id);
    await s.until(finished);
    s.close();
  }
  ok((await api(B, "GET", "/me")).body.credits.available === 25.2, "the confirmed build charged 1.7 (the hold of 43.2 released): 25.2");

  console.log("rename");
  const listBefore = (await api(A, "GET", "/projects")).body;
  const renamed = await api(A, "PATCH", `/projects/${p.id}`, { name: "  My   Cat\nGame " });
  ok(renamed.status === 200 && renamed.body.name === "My Cat Game", "rename: spaces and line breaks tidied");
  ok((await api(A, "GET", "/projects")).body[0].updatedAt === listBefore[0].updatedAt, "a rename doesn't move the game up the list");
  ok((await api(A, "PATCH", `/projects/${p.id}`, { name: "   " })).body?.error === "bad_request", "empty name: bad_request");
  ok((await api(A, "PATCH", `/projects/${p.id}`, { name: "x".repeat(61) })).body?.error === "bad_request", "61 letters: bad_request");
  ok((await api(A, "PATCH", `/projects/${p.id}`, { name: "🐱".repeat(60) })).status === 200, "60 emoji are 60 letters: ok");
  await api(A, "PATCH", `/projects/${p.id}`, { name: "My Cat Game" });
  ok((await api(A, "PATCH", `/projects/${p.id}`, {})).body?.error === "bad_request", "nothing to change: bad_request");
  ok((await api(B, "PATCH", `/projects/${p.id}`, { name: "Mine now" })).status === 404, "another user can't rename it (404)");
  ok((await api(A, "GET", `/projects/${p.id}`)).body.name === "My Cat Game", "name unchanged by the other user");

  // The game agent names games in project.godot; a player's rename wins over it, an unrenamed game takes it.
  const setAgentName = (id) => {
    const file = join(DATA, "projects", id, "project.godot");
    const text = readFileSync(file, "utf8").replace(/^config\/name=.*$/m, 'config/name="Agent Picked"');
    writeFileSync(file, text.includes('config/name="Agent Picked"') ? text : text.replace(/^\[application\]\s*$/m, '[application]\n\nconfig/name="Agent Picked"'));
  };
  const [keepId, takeId] = runs.slice(1);
  await api(B, "PATCH", `/projects/${keepId}`, { name: "Frog Boss" });
  for (const id of [keepId, takeId]) {
    setAgentName(id);
    const s = await openEvents(B, id);
    await s.until((e) => e.type === "snapshot");
    await api(B, "POST", `/projects/${id}/messages`, { text: "Add a lily pad", model: "fast" });
    await s.until((e) => e.type === "done");
    s.close();
  }
  ok((await api(B, "GET", `/projects/${keepId}`)).body.name === "Frog Boss", "renamed game keeps its name after a build");
  ok((await api(B, "GET", `/projects/${takeId}`)).body.name === "Agent Picked", "an unrenamed game takes the game agent's name");

  console.log("share page: edges");
  // A game with no build can't be shared; a shared game keeps serving its last build while a new one
  // is made, and a build whose picture isn't a PNG publishes without a poster (NOPOSTER).
  const noBuild = (await api(B, "POST", "/projects", { prompt: "A game that will FAIL", model: "fast" })).body;
  projects.push(noBuild.id);
  {
    const s = await openEvents(B, noBuild.id);
    await s.until(finished);
    s.close();
  }
  const shareNoBuild = await api(B, "PATCH", `/projects/${noBuild.id}`, { shared: true });
  ok(shareNoBuild.status === 400 && shareNoBuild.body.error === "bad_request" && (await api(B, "GET", `/projects/${noBuild.id}`)).body.shared === false, "no build yet: can't share (400), stays private");
  const takeBefore = (await api(B, "GET", `/projects/${takeId}`)).body.buildId;
  ok((await api(B, "PATCH", `/projects/${takeId}`, { shared: true })).body.shared === true, "share the built game");
  const sTake = await openEvents(B, takeId);
  await sTake.until((e) => e.type === "snapshot");
  await api(B, "POST", `/projects/${takeId}/messages`, { text: "Add fog NOPOSTER", model: "fast" });
  const duringRebuild = await api(null, "GET", `/public/games/${takeId}`);
  ok(duringRebuild.status === 200 && duringRebuild.body.buildId === takeBefore, "while a new version is being made, the public page serves the last build");
  const noPoster = await sTake.until((e) => e.type === "done");
  sTake.close();
  ok(noPoster.project.poster === false && !existsSync(join(BUILDS, noPoster.version.buildId, "poster.png")), "NOPOSTER: the build publishes without a poster");
  const pubTake = await api(null, "GET", `/public/games/${takeId}`);
  ok(pubTake.body.buildId === noPoster.version.buildId && pubTake.body.poster === false, "the public page now has the new build, poster false");
  ok((await api(B, "PATCH", `/projects/${takeId}`, { shared: false })).body.shared === false, "unshare it again");

  console.log("share page");
  ok((await api(null, "GET", `/public/games/${p.id}`)).status === 404, "private game: public page 404");
  ok((await api(B, "PATCH", `/projects/${p.id}`, { shared: true })).status === 404, "another user can't share it (404)");
  ok((await api(A, "PATCH", `/projects/${p.id}`, { shared: "yes" })).body?.error === "bad_request", "shared must be true or false");
  const shared = await api(A, "PATCH", `/projects/${p.id}`, { shared: true });
  ok(shared.status === 200 && shared.body.shared === true, "share: shared true");
  const pub = await api(null, "GET", `/public/games/${p.id}`);
  ok(pub.status === 200 && pub.body.name === "My Cat Game" && pub.body.buildId === `${p.id}-v4` && pub.body.poster === true, "public page: name, build, poster, no sign-in");
  ok(Object.keys(pub.body).sort().join() === "buildId,id,name,orientation,platform,plays,poster,updatedAt", "public page shows nothing else (no prompts, no owner)");
  ok((await api(B, "GET", `/projects/${p.id}`)).status === 404, "sharing doesn't open the project itself to others");
  ok((await api(null, "GET", "/public/games/../me")).status === 404 && (await api(null, "GET", "/public/games/NOPE!")).status === 404, "odd ids: 404");
  const sharedAt = async () => (await dbMain.query(`SELECT "sharedAt" FROM "Project" WHERE id = $1`, [p.id])).rows[0]?.sharedAt ?? null;
  ok((await sharedAt()) instanceof Date, "database: sharedAt set when shared");
  ok((await api(A, "PATCH", `/projects/${p.id}`, { shared: false })).body.shared === false, "unshare");
  ok((await sharedAt()) === null, "database: sharedAt cleared when unshared");
  ok((await api(null, "GET", `/public/games/${p.id}`)).status === 404, "after unsharing: public page 404 at once");

  console.log("download the project");
  const zipRes = await raw(A, `/projects/${p.id}/download`);
  ok(zipRes.status === 200 && zipRes.type === "application/zip" && /filename="my-cat-game\.zip"/.test(zipRes.disposition), "200 application/zip, my-cat-game.zip");
  let files = new Map();
  try {
    files = unzip(zipRes.buf);
  } catch (e) {
    ok(false, `zip reads: ${e.message}`);
  }
  const names = [...files.keys()];
  ok(names.includes("my-cat-game/project.godot") && names.includes("my-cat-game/main.tscn"), "has project.godot and the scenes");
  ok(!names.some((n) => /\/(\.git|\.godot|export)\//.test(n) || n.endsWith(".agent-log.jsonl")), "no .git, .godot, export or agent log");
  const readmeText = files.get("my-cat-game/README.txt")?.toString("utf8") ?? "";
  ok(readmeText.startsWith("My Cat Game") && readmeText.includes("Godot 4.7") && readmeText.includes("project.godot"), "README.txt: how to open it in Godot 4.7");
  ok(files.get("my-cat-game/FAKE.md")?.toString("utf8").trim().split("\n").length === 2, "files are the current version's (v4 = v1 + 1 change)");
  ok((await raw(B, `/projects/${p.id}/download`)).status === 404, "another user can't download it (404)");

  console.log("credit history");
  const page1 = await api(A, "GET", "/me/usage?limit=2");
  const page2 = await api(A, "GET", `/me/usage?limit=2&cursor=${page1.body.next}`);
  const all = [...page1.body.entries, ...(page2.body.entries ?? [])];
  ok(page1.status === 200 && page1.body.entries.length === 2 && page1.body.next, "page 1: 2 entries and a cursor");
  ok(page2.body.entries.length === 2 && page2.body.next === null, "page 2: the other 2, last page");
  ok(new Set(all.map((e) => e.id)).size === 4, "no entry twice across pages");
  ok(all.map((e) => e.what).join("|") === "Change on Fast|Change on Fast|New game on Fast|Free plan credits", "what: change, change, new game, Free plan");
  ok(all.map((e) => e.prompt).join("|") === "Make it night|Add coins|A cat that jumps over boxes|", "the prompt of each charge");
  ok(all.slice(0, 3).every((e) => e.game?.name === "My Cat Game" && e.amount === -1.7 && e.kind === "charge"), "charges: -1.7 on My Cat Game");
  ok(all[3].amount === 20 && all[3].kind === "grant" && all[3].game === null, "the signup grant: +20");
  ok(Math.round(all.reduce((s, e) => s + e.amount, 0) * 10) / 10 === 14.9, "entries add up to the balance");
  ok((await api(A, "GET", "/me/usage?limit=0")).body?.error === "bad_request", "limit 0: bad_request");
  ok((await api(B, "GET", "/me/usage?limit=100")).body.entries.every((e) => e.game?.id !== p.id), "B's history has none of A's game");

  console.log("download my data");
  const exp = await raw(A, "/me/export");
  const data = exp.status === 200 ? JSON.parse(exp.buf.toString("utf8")) : {};
  ok(exp.status === 200 && /attachment; filename="typeplay-data-\d{4}-\d\d-\d\d\.json"/.test(exp.disposition), "export: a JSON file to save");
  ok(data.account?.email === emailOf(A) && data.account?.plan === "free" && data.account?.createdAt, "export: the account");
  ok(data.games?.length === 1 && data.games[0].messages.length === 12 && data.games[0].versions.length === 4, "export: the game with its 12 messages and 4 versions");
  ok(data.credits?.available === 14.9 && data.credits.entries.length === 4 && data.notes?.length >= 3, "export: credits, history and notes");
  ok(Array.isArray(data.payments) && data.payments.length === 0 && data.billing === null && data.notes.some((n) => /payments/.test(n)), "export: the payments list (none on Free) and the subscription (none), with a note on where invoices are");

  console.log("delete a game");
  const [gone] = runs;
  const goneBuilds = () => (existsSync(BUILDS) ? readdirSync(BUILDS).filter((b) => b.startsWith(`${gone}-v`)) : []);
  ok(goneBuilds().length === 1 && existsSync(join(DATA, "projects", gone)), "before: one build, the folder");
  ok((await api(A, "DELETE", `/projects/${gone}`)).status === 404 && (await api(B, "GET", `/projects/${gone}`)).status === 200, "another user can't delete it (404), it stays");
  const balanceB = (await api(B, "GET", "/me")).body.credits.available;
  const del = await api(B, "DELETE", `/projects/${gone}`);
  ok(del.status === 200 && del.body.ok === true, "delete: ok");
  ok((await api(B, "GET", `/projects/${gone}`)).status === 404 && !(await api(B, "GET", "/projects")).body.some((g) => g.id === gone), "gone from the API and the list");
  ok(!existsSync(join(DATA, "projects", gone)) && goneBuilds().length === 0, "its folder and builds are gone");
  ok(!readdirSync(join(DATA, "logs")).some((f) => f.startsWith(`${gone}-`)), "its run logs are gone");
  ok((await api(B, "GET", "/me")).body.credits.available === balanceB, "the balance stays (the ledger keeps the charge)");
  const deletedEntry = (await api(B, "GET", "/me/usage?limit=100")).body.entries.find((e) => e.prompt === "Game number 0" || (e.gameDeleted && e.kind === "charge"));
  ok(deletedEntry?.gameDeleted === true && deletedEntry.game === null, "history: the charge says the game was deleted");
  ok((await api(B, "DELETE", `/projects/${gone}`)).status === 404, "deleting twice: 404");

  const building = await api(B, "POST", "/projects", { prompt: "A game to throw away", model: "fast" });
  projects.push(building.body.id);
  const delRunning = await api(B, "DELETE", `/projects/${building.body.id}`);
  ok(delRunning.status === 200 && !existsSync(join(DATA, "projects", building.body.id)), "delete while building: stops it, then deletes");
  ok((await api(B, "GET", "/me")).body.credits.available === balanceB, "the stopped build cost nothing");

  console.log("close an account");
  ok((await api(C, "GET", "/me")).body?.credits?.available === 20, "C signs up: 20 credits");
  const cGame = (await api(C, "POST", "/projects", { prompt: "A bird that flaps", model: "fast" })).body;
  projects.push(cGame.id);
  const sc = await openEvents(C, cGame.id);
  await sc.until(finished);
  sc.close();
  const freeSpentBefore = await freeToday();
  ok(freeSpentBefore >= 0.14, `C's Free build counts towards today's Free spend ($${freeSpentBefore.toFixed(2)} today)`);
  await api(C, "PATCH", `/projects/${cGame.id}`, { shared: true });
  ok((await api(null, "GET", `/public/games/${cGame.id}`)).status === 200, "C's game is shared");
  ok((await api(C, "DELETE", "/me")).body?.error === "bad_request", "no confirm: bad_request");
  ok((await api(C, "DELETE", "/me", { confirm: "delete" })).body?.error === "bad_request", "confirm must be DELETE exactly");
  ok((await api(C, "GET", "/me")).status === 200, "still there after a wrong confirm");
  const closed = await api(C, "DELETE", "/me", { confirm: "DELETE" });
  ok(closed.status === 200 && closed.body.ok === true, "DELETE /me: ok");
  ok((await api(C, "GET", "/me")).status === 401, "the old sign-in no longer works (401), and doesn't make a new account");
  ok((await freeToday()) >= freeSpentBefore, "the game and its messages are gone, but today's Free spend did not go down (the kill switch keeps counting it)");
  ok((await api(null, "GET", `/public/games/${cGame.id}`)).status === 404, "its share page is gone");
  ok(!existsSync(join(DATA, "projects", cGame.id)) && !readdirSync(BUILDS).some((b) => b.startsWith(`${cGame.id}-v`)), "its game files and builds are gone");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const cId = `dev-${emailOf(C).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
  const counts = await db.query(
    `SELECT (SELECT count(*) FROM "User" WHERE id = $1) AS users, (SELECT count(*) FROM "Project" WHERE "ownerId" = $1) AS games,
            (SELECT count(*) FROM "CreditEntry" WHERE "userId" = $1) AS credits, (SELECT count(*) FROM "Message" WHERE "projectId" = $2) AS messages`,
    [cId, cGame.id],
  );
  const row = counts.rows[0];
  ok(row.users === "0" && row.games === "0" && row.credits === "0" && row.messages === "0", "database: no user, games, messages or credit entries left");
  const tomb = await db.query(`SELECT "emailHash" FROM "ClosedAccount" WHERE id = $1`, [cId]);
  const { emailHash } = await import("../dist/auth/tombstone.js");
  ok(tomb.rows[0]?.emailHash === emailHash(emailOf(C)) && !tomb.rows[0].emailHash.includes("test.local"), "database: the tombstone stays (old id, the email scrambled), so a restart can't bring the account back");
  // A sign-up whose email closed an account in the last 90 days gets no free credits (planted as a
  // 10-day-old tombstone: a dev sign-in keeps its id, so the real path, a fresh Supabase id, is this one).
  await db.query(`INSERT INTO "ClosedAccount" (id, "emailHash", "closedAt") VALUES ($1, $2, now() - interval '10 days')`, [`dev-e2e-${stamp}-old-id`, emailHash(emailOf(F))]);
  const meF = await api(F, "GET", "/me");
  ok(meF.status === 200 && meF.body.credits.available === 0 && /closed less than 90 days ago/.test(meF.body.notice ?? ""), "F (same email as an account closed 10 days ago): signs in, 0 credits, told why");
  ok((await api(F, "POST", "/projects", { prompt: "A free game", model: "fast" })).body?.error === "no_credits", "F can't build for free again");
  const costRow = await db.query(`SELECT max("costUsd")::text AS cost FROM "Message" WHERE "projectId" = $1 AND status = 'done'`, [p.id]);
  ok(Number(costRow.rows[0]?.cost) === 0.14, "database: the run's whole cost ($0.14, both attempts) is kept for our accounting");
  ok((await db.query(`SELECT count(*) FROM "User" WHERE id = $1`, [forgedSub])).rows[0].count === "0", "database: the forged sign-ins made no user");

  console.log("credit ledger: the Free month, expiry, debt, the kill switch, admin audit");
  const G = `dev:e2e-${stamp}-g@test.local`;
  const gId = devId(G);
  const meG = await api(G, "GET", "/me");
  ok(meG.body.credits.available === 20 && meG.body.credits.expiring?.amount === 20, "G signs up: 20 free credits, all of them ending in a month");
  ok(auditOk(emailOf(G)), "admin audit: the invariants hold after sign-up");
  const gGame = (await api(G, "POST", "/projects", { prompt: "G's game", model: "fast" })).body;
  projects.push(gGame.id);
  {
    const s = await openEvents(G, gGame.id);
    await s.until(finished);
    s.close();
  }
  ok((await api(G, "GET", "/me")).body.credits.available === 18.3, "G builds once: 18.3");
  ok((await db.query(`SELECT plan FROM "Message" WHERE "projectId" = $1 AND role = 'agent'`, [gGame.id])).rows[0]?.plan === "free", "database: the run's message carries the plan it started on (the kill switch's key)");
  const gAlloc = await db.query(`SELECT b.source, a.tenths FROM "CreditAllocation" a JOIN "CreditBucket" b ON b.id = a."bucketId" JOIN "CreditEntry" e ON e.id = a."entryId" WHERE e."userId" = $1 AND e.kind = 'charge'`, [gId]);
  ok(gAlloc.rows.length === 1 && gAlloc.rows[0].source === "free" && gAlloc.rows[0].tenths === 17, "database: the charge was taken from the free bucket (one allocation of 17 tenths)");
  ok(auditOk(emailOf(G)), "audit holds after a charge");
  // The Free month, with the rows moved back in time: the bucket is 32 days old and the cycle ended yesterday.
  await db.query(`UPDATE "CreditBucket" SET "startsAt" = now() - interval '32 days', "expiresAt" = now() - interval '1 day' WHERE "userId" = $1 AND source = 'free'`, [gId]);
  await db.query(`UPDATE "User" SET "freeCycleEndsAt" = now() - interval '1 day', "nextSettleAt" = now() - interval '1 day' WHERE id = $1`, [gId]);
  const month = await api(G, "GET", "/me");
  ok(month.body.credits.available === 20 && month.body.credits.todayLeft === 3.3, "a month on: the unused 18.3 ended and 20 new credits came; today's 1.7 still counts against the day");
  ok(month.body.credits.expiring?.amount === 20 && daysUntil(month.body.credits.expiring.at) >= 27 && daysUntil(month.body.credits.expiring.at) <= 32, "the new credits end in a month");
  const gHist = (await api(G, "GET", "/me/usage?limit=10")).body.entries;
  ok(
    gHist.map((e) => `${e.kind}:${e.what}:${e.amount}`).join("|") === "grant:Free plan credits:20|expire:Free credits ended:-18.3|charge:New game on Fast:-1.7|grant:Free plan credits:20",
    'history: "Free plan credits" +20, "Free credits ended" -18.3, the charge, the first grant',
  );
  ok(auditOk(emailOf(G)), "audit holds after the month's refresh");
  // At most one free grant a month: the cycle due again an hour ago, but the last grant was just now.
  await db.query(`UPDATE "User" SET "freeCycleEndsAt" = now() - interval '1 hour', "nextSettleAt" = now() - interval '1 hour' WHERE id = $1`, [gId]);
  ok((await api(G, "GET", "/me")).body.credits.available === 20 && (await api(G, "GET", "/me/usage?limit=10")).body.entries.length === 4, "the cycle due again: no second grant this month (a cancel-and-return can't farm it)");
  const cycle = (await db.query(`SELECT "freeCycleEndsAt" > now() + interval '27 days' AS pushed, "nextSettleAt" = "freeCycleEndsAt" AS due FROM "User" WHERE id = $1`, [gId])).rows[0];
  ok(cycle.pushed && cycle.due, "database: the cycle now ends a month after the last grant, and that is the next settle");
  // Credits that end by date: an admin grant made to look like October's plan credits, ended an hour ago.
  ok(admin("grant", emailOf(G), "5", "Medium plan, October").status === 0 && (await api(G, "GET", "/me")).body.credits.available === 25, "admin grant 5: 25");
  await db.query(`UPDATE "CreditBucket" SET source = 'plan', "startsAt" = '2026-10-01', "expiresAt" = now() - interval '1 hour' WHERE "userId" = $1 AND source = 'admin'`, [gId]);
  await db.query(`UPDATE "User" SET "nextSettleAt" = now() - interval '1 hour' WHERE id = $1`, [gId]);
  ok((await api(G, "GET", "/me")).body.credits.available === 20, "plan credits past their date ended: 25 -> 20");
  const gHist2 = (await api(G, "GET", "/me/usage?limit=2")).body.entries;
  ok(gHist2[0].kind === "expire" && gHist2[0].what === "Credits from October ended" && gHist2[0].amount === -5, 'history: "Credits from October ended", -5');
  ok(gHist2[1].kind === "grant" && gHist2[1].what === "Medium plan, October" && gHist2[1].amount === 5, "the grant row shows its note as written");
  const closedBucket = (await db.query(`SELECT "closedWhy", "remainingTenths" FROM "CreditBucket" WHERE "userId" = $1 AND source = 'plan'`, [gId])).rows[0];
  ok(closedBucket?.closedWhy === "expired" && closedBucket.remainingTenths === 0, "database: the bucket is closed (expired) with 0 left");
  ok((await api(G, "GET", "/me/export").then((r) => r.body?.credits?.entries?.length)) === 6, "export: all 6 ledger rows, expiries included");
  ok(auditOk(emailOf(G)), "audit holds after an expiry");
  // The kill switch: $20 of AI on Free runs today across TypePlay (planted in FreeSpend, the day's row that a
  // deleted game can't lower; a planted Message would count for nothing) pauses Free, not paid plans.
  // The planted $20 comes out again in `finally`: this database is the live beta's too (security review 10-20), so a test
  // that stopped here would otherwise pause Free builds for real testers until midnight UTC.
  await db.query(`INSERT INTO "FreeSpend" (day, usd) VALUES (${UTC_TODAY}, 20) ON CONFLICT (day) DO UPDATE SET usd = "FreeSpend".usd + 20`);
  try {
    const paused = await api(G, "POST", `/projects/${gGame.id}/messages`, { text: "One more", model: "fast" });
    ok(paused.status === 402 && paused.body.error === "free_paused" && /paused until 00:00 UTC/.test(paused.body.message), "Free runs past $20 of AI today: 402 free_paused, says until when");
    const paidStill = await api(B, "POST", "/projects", { prompt: "Paid plans keep building", model: "fast" });
    ok(paidStill.status === 201, "a paid plan builds on while Free is paused");
    if (paidStill.body?.id) {
      projects.push(paidStill.body.id);
      const s = await openEvents(B, paidStill.body.id);
      await s.until(finished);
      s.close();
    }
  } finally {
    await db.query(`UPDATE "FreeSpend" SET usd = usd - 20 WHERE day = ${UTC_TODAY}`);
  }
  const resumed = await api(G, "POST", `/projects/${gGame.id}/messages`, { text: "Add a sun", model: "fast" });
  ok(resumed.status === 201, "under $20 again: Free builds");
  {
    const s = await openEvents(G, gGame.id);
    await s.until((e) => e.type === "done" && e.version?.n === 2);
    s.close();
  }
  ok((await api(G, "GET", "/me")).body.credits.available === 18.3, "charged from the new month's credits: 18.3");
  // Debt: a paid user whose run cost more than they had (the check passes on the low estimate).
  const H = `dev:e2e-${stamp}-h@test.local`;
  const hId = devId(H);
  await api(H, "GET", "/me");
  ok(admin("plan", emailOf(H), "medium").status === 0 && admin("grant", emailOf(H), "-18.7").status === 0 && (await api(H, "GET", "/me")).body.credits.available === 1.3, "H: Medium with 1.3 credits (a Fast new game's low is 1.2)");
  const hGame = await api(H, "POST", "/projects", { prompt: "H's game", model: "fast" });
  ok(hGame.status === 201, "H's build starts on 1.3");
  if (hGame.body?.id) {
    projects.push(hGame.body.id);
    const s = await openEvents(H, hGame.body.id);
    await s.until(finished);
    s.close();
  }
  ok((await api(H, "GET", "/me")).body.credits.available === -0.4, "charged 1.7 on 1.3: -0.4 (debt)");
  ok((await api(H, "POST", "/projects", { prompt: "Another", model: "fast" })).body?.error === "no_credits", "in debt: 402 no_credits");
  ok((await db.query(`SELECT "debtTenths" FROM "User" WHERE id = $1`, [hId])).rows[0].debtTenths === 4, "database: debt 4 tenths, as a null-bucket allocation");
  ok(auditOk(emailOf(H)), "audit holds with debt");
  ok(admin("grant", emailOf(H), "10").status === 0 && (await api(H, "GET", "/me")).body.credits.available === 9.6, "admin grant 10 settles the debt first: 9.6");
  const hBucket = (await db.query(`SELECT "remainingTenths", (SELECT "debtTenths" FROM "User" WHERE id = $1) AS debt FROM "CreditBucket" WHERE "userId" = $1 AND source = 'admin' ORDER BY "startsAt" DESC LIMIT 1`, [hId])).rows[0];
  ok(hBucket.remainingTenths === 96 && hBucket.debt === 0, "database: the new bucket holds 9.6, debt 0 (the debt allocation moved onto it)");
  ok(auditOk(emailOf(H)), "audit holds after the debt was settled");
  const userOut = admin("user", emailOf(H));
  ok(userOut.status === 0 && /buckets \(2\)/.test(userOut.stdout) && !/owes/.test(userOut.stdout) && /admin\s+9\.6 of 10/.test(userOut.stdout), "admin user: the two buckets (free, admin), what is left of each");
  await db.query(`UPDATE "User" SET "billingFlag" = 'chargeback' WHERE id = $1`, [hId]);
  ok(/FLAG chargeback/.test(admin("list").stdout), "admin list shows a flag");
  ok(admin("flag", emailOf(H), "clear").status === 0 && (await db.query(`SELECT "billingFlag" FROM "User" WHERE id = $1`, [hId])).rows[0].billingFlag === null, "admin flag clear");
  const auditRows = (await db.query(`SELECT action FROM "BillingAudit" WHERE "userId" = $1 ORDER BY at, action`, [hId])).rows.map((r) => r.action);
  ok(auditRows.join() === "plan,grant,audit,grant,audit,user,flag_clear", `every admin command wrote a BillingAudit row (${auditRows.join()})`);
  ok(auditOk(), "admin audit over everyone: the invariants hold");

  console.log("run timeout and an interrupted run (an API of our own on :3013)");
  // RUN_TIMEOUT_MIN=0.05: 3 s, less than the fake run's 5.3 s, so every build times out.
  const T = `dev:e2e-${stamp}-t@test.local`;
  const slow = await spawnApi(3013, { RUN_TIMEOUT_MIN: "0.05" });
  let tGame = null;
  try {
    const tApi = (method, path, body) => api(T, method, path, body).catch(() => ({ status: 0, body: null }));
    const send = (method, path, body) =>
      fetch(slow.url + path, { method, headers: { Authorization: `Bearer ${T}`, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined }).then(
        async (r) => ({ status: r.status, body: await r.json().catch(() => null) }),
      );
    void tApi;
    tGame = (await send("POST", "/projects", { prompt: "A slow game", model: "fast" })).body;
    projects.push(tGame.id);
    let full;
    for (let i = 0; i < 40 && !full; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const r = await send("GET", `/projects/${tGame.id}`);
      if (r.body?.status === "idle") full = r.body;
    }
    const last = full?.messages.at(-1);
    ok(full && last?.status === "failed" && last.credits === 0 && /took too long/.test(last.text), "a build past RUN_TIMEOUT_MIN: failed, 'took too long', 0 credits");
    ok(!existsSync(join(DATA, "projects", tGame.id)), "timed out before a first version: the folder is gone");
    ok((await send("GET", "/me")).body.credits.available === 20, "nothing charged for the timed-out build");
    // Now pretend the API died mid-run: the message is 'running' again when a new API starts.
    await db.query(`UPDATE "Message" SET status = 'running', text = '' WHERE id = $1`, [last.id]);
    slow.kill();
    await new Promise((r) => setTimeout(r, 1500));
    const again = await spawnApi(3013, { RUN_TIMEOUT_MIN: "0.05" });
    try {
      const after = (await send("GET", `/projects/${tGame.id}`)).body;
      const recovered = after?.messages.at(-1);
      ok(recovered?.status === "failed" && /interrupted/.test(recovered.text) && recovered.credits === 0, "a run left 'running' by a dead API: marked failed ('interrupted'), 0 credits, at the next start");
      ok(/marked 1 interrupted run/.test(again.output()), "the new API logged the interrupted run");
    } finally {
      again.kill();
    }
  } finally {
    slow.kill();
  }

  await galleryChecks(db);
  await feedbackChecks(db, p.id);
  await inviteChecks(db);
  await badgeChecks();
  await platformChecks();
  await securityChecks();

  // The Supabase sign-in record: the API deletes it with this statement (account.service.ts). Real
  // Google users can't sign in here, so try it on a throwaway Supabase user made with the admin API.
  // Only where the database is a Supabase project's (the online test environment, later): typeplay_autotest on this PC
  // has no auth schema, and the tests never touch the live project's sign-ins (docs/environments.md).
  const supabaseDb = (await db.query("SELECT to_regclass('auth.users') AS t")).rows[0].t !== null;
  if (!supabaseDb) {
    console.log("  skip  the sign-in record check (the database isn't a Supabase project's: it runs in the online test environment)");
  } else if (process.env.SUPABASE_SECRET_KEY) {
    const key = process.env.SUPABASE_SECRET_KEY;
    const admin = (method, path, body) =>
      fetch(`${process.env.SUPABASE_URL}/auth/v1/admin${path}`, {
        method,
        headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
    const made = await admin("POST", "/users", { email: `e2e-${stamp}@test.local`, email_confirm: true });
    const authId = made.ok ? (await made.json()).id : null;
    if (authId) {
      const r = await db.query("DELETE FROM auth.users WHERE id = $1::uuid", [authId]);
      ok(r.rowCount === 1 && (await admin("GET", `/users/${authId}`)).status === 404, "the sign-in record goes too (auth.users, same statement as the API)");
      if (r.rowCount !== 1) await admin("DELETE", `/users/${authId}`);
    } else {
      ok(false, `could not make a throwaway Supabase user (${made.status})`);
    }
  } else {
    console.log("  skip  the sign-in record check (no SUPABASE_SECRET_KEY in .env)");
  }
  await db.end();
}

async function cleanup() {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  // What this run's Free builds added to today's FreeSpend comes out again (the rows are deleted below with
  // their users; the dev database's kill switch must not trip on test runs).
  const spent = await db.query(
    // As runs.service adds it (aiSpentUsd): what the agent reported, or the key proxy's meter when that is more.
    `SELECT coalesce(sum(greatest(m."costUsd", coalesce(m."meteredUsd", 0))), 0)::float AS usd FROM "Message" m JOIN "Project" p ON p.id = m."projectId" WHERE p."ownerId" LIKE $1 AND m.plan = 'free' AND m."createdAt" >= ${UTC_TODAY}`,
    [`dev-e2e-${stamp}-%`],
  );
  if (spent.rows[0].usd > 0) await db.query(`UPDATE "FreeSpend" SET usd = greatest(0, usd - $1) WHERE day = ${UTC_TODAY}`, [spent.rows[0].usd]);
  const r = await db.query(`DELETE FROM "User" WHERE id LIKE $1`, [`dev-e2e-${stamp}-%`]);
  await db.query(`DELETE FROM "ClosedAccount" WHERE id LIKE $1`, [`dev-e2e-${stamp}-%`]);
  // The closed beta's invites (no user relation) and their audit rows (the address scrambled: emailHash of the matched form).
  await db.query(`DELETE FROM "Invite" WHERE match LIKE $1`, [`e2e-${stamp}-%`]);
  const { emailHash } = await import("../dist/auth/tombstone.js");
  await db.query(`DELETE FROM "BillingAudit" WHERE details->>'emailHash' = $1`, [emailHash(`e2e-${stamp}-inv@gmail.com`)]);
  // The admin CLI's audit rows (no cascade: they outlive accounts), including this run's `list`, `audit`, `gallery reports`, `invite list` and
  // `feedback list` over everyone. The start as UTC text: `at` is a timestamp without a zone holding UTC, and pg would send a Date in
  // local time, which Postgres reads without its offset (on a PC east of UTC the rows of the run would look older than its start).
  await db.query(
    `DELETE FROM "BillingAudit" WHERE "userId" LIKE $1 OR ("userId" IS NULL AND at >= $2 AND action IN ('list', 'audit', 'gallery_reports', 'invite_list', 'feedback_list'))`,
    [`dev-e2e-${stamp}-%`, new Date(parseInt(stamp, 36)).toISOString()],
  );
  await db.end();
  await dbMain.end().catch(() => {});
  for (const id of projects) {
    rmSync(join(DATA, "projects", id), { recursive: true, force: true });
    if (existsSync(BUILDS)) for (const b of readdirSync(BUILDS)) if (b.startsWith(`${id}-v`)) rmSync(join(BUILDS, b), { recursive: true, force: true });
    if (existsSync(join(DATA, "logs"))) for (const f of readdirSync(join(DATA, "logs"))) if (f.startsWith(id)) rmSync(join(DATA, "logs", f), { force: true });
  }
  console.log(`cleaned up: ${r.rowCount} test users, ${projects.length} games`);
}

try {
  await main();
} catch (e) {
  failures++;
  console.error("  FAIL", e);
} finally {
  await cleanup();
  mainApi?.kill();
}
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
