// HQ heartbeat: a dead-man's switch for Luka's HQ PC, on the API server, in its own tiny container.
// Not part of the product: no database, no game, no user; touches nothing of the API, runner or queue.
//
//   POST /hq-heartbeat/<secret>        a good ping: stores the time (if the PC was marked silent: "back online")
//   POST /hq-heartbeat/<secret>/fail   HQ reports a problem: the text body (at most 10 KB) goes to Telegram at once
//   any other path or a wrong secret   a plain 404
//
// Every 5 minutes: no good ping for 70 minutes -> one Telegram message, repeated every 60 minutes while it stays silent.
// Before the very first ping nothing is "silent". State: one small JSON file. No dependencies, Node 22 only.
// Env: HQ_HEARTBEAT_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (from hq-heartbeat.env, never logged);
// optional PORT (8788), STATE_FILE, THRESHOLD_MIN (70), REPEAT_MIN (60), CHECK_INTERVAL_S (300) for tests.
import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";

const env = process.env;
const SECRET = env.HQ_HEARTBEAT_SECRET ?? "";
const TOKEN = env.TELEGRAM_BOT_TOKEN ?? "";
const CHAT = env.TELEGRAM_CHAT_ID ?? "";
if (SECRET.length < 32 || !TOKEN || !CHAT) {
  console.error("hq-heartbeat: HQ_HEARTBEAT_SECRET (32+ chars), TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required");
  process.exit(1);
}
const PORT = Number(env.PORT ?? 8788);
const STATE_FILE = env.STATE_FILE ?? "/state/state.json";
const THRESHOLD_MS = Number(env.THRESHOLD_MIN ?? 70) * 60_000;
const REPEAT_MS = Number(env.REPEAT_MIN ?? 60) * 60_000;
const CHECK_MS = Number(env.CHECK_INTERVAL_S ?? 300) * 1000;
const MAX_BODY = 10 * 1024;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const tbilisi = (ms) => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", hour: "2-digit", minute: "2-digit", hour12: false }).format(ms);

// { lastPing: ms | null, alerting: bool, lastAlert: ms | null }
let state = { lastPing: null, alerting: false, lastAlert: null };
try { state = { ...state, ...JSON.parse(readFileSync(STATE_FILE, "utf8")) }; } catch { /* first start */ }
function save() {
  writeFileSync(`${STATE_FILE}.tmp`, JSON.stringify(state));
  renameSync(`${STATE_FILE}.tmp`, STATE_FILE);
}

/** Bot API sendMessage only. Returns Telegram's `ok`. Never logs the token (fetch errors can carry the URL). */
async function telegram(text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: CHAT, text: text.slice(0, 4000) }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json().catch(() => ({}));
    log(`telegram sendMessage: ok=${j.ok === true} http=${r.status}${j.ok ? "" : ` ${j.description ?? ""}`}`);
    return j.ok === true;
  } catch (e) {
    log(`telegram sendMessage failed: ${e?.name ?? "error"}`);
    return false;
  }
}

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      if (size < MAX_BODY) chunks.push(c.subarray(0, MAX_BODY - size));
      size += c.length; // the rest is read and dropped
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(""));
  });
}

const notFound = (res) => { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found\n"); };

const server = createServer(async (req, res) => {
  const m = /^\/hq-heartbeat\/([^/]+)(\/fail)?\/?$/.exec((req.url ?? "").split("?")[0]);
  if (!m || req.method !== "POST" || !same(m[1], SECRET)) return notFound(res); // the secret is URL-safe, so no decoding
  const body = await readBody(req);
  if (m[2]) {
    await telegram(`🔴 HQ reports a problem:\n${body.trim() || "(no details)"}`);
  } else {
    const wasSilent = state.alerting;
    state = { lastPing: Date.now(), alerting: false, lastAlert: null };
    save();
    if (wasSilent) await telegram("✅ HQ PC back online");
  }
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("OK\n");
});
server.headersTimeout = 10_000;
server.requestTimeout = 20_000;

async function check() {
  const now = Date.now();
  if (state.lastPing === null || now - state.lastPing <= THRESHOLD_MS) return;
  if (state.alerting && now - state.lastAlert < REPEAT_MS) return;
  const sent = await telegram(`⚠️ HQ PC silent since ${tbilisi(state.lastPing)} (Tbilisi): power, internet or the PC is down.`);
  if (sent) { state.alerting = true; state.lastAlert = now; save(); } // not sent: try again in 5 minutes
}

setInterval(() => check().catch((e) => log("check failed:", e?.name)), CHECK_MS).unref?.();
server.listen(PORT, "0.0.0.0", () => log(`hq-heartbeat listening on ${PORT}, threshold ${THRESHOLD_MS / 60_000} min, last ping ${state.lastPing ? new Date(state.lastPing).toISOString() : "never"}`));
