// End-to-end test of the Android export's API against an API of its own on :3015 with fake runs and
// a fake Android job + signer (DEV_AUTH=1 AGENT_FAKE=1 ANDROID_EXPORT=1 ANDROID_FAKE=1): no JDK, no
// Godot, no network. Run after `npm run build -w @typeplay/server`; needs the dev database (root .env):
//   npm run test:android:e2e -w @typeplay/server
// Free → 403; setup makes the app + key (second setup 409, a taken name 409); a build goes queued →
// running → signing → done on the event stream with matching rows; the checks list is green; download
// and the 10-minute phone link (content type, name, bytes, no sign-in); the key zip (PKCS12 inside,
// README with the password) and its counter; a tampered export fails as mismatch; a game failure
// fails as game; chat during a build → 409 busy; cancel; the package lock after an AAB; user B → 404;
// /me/export lists Android without the key; delete removes rows and files; an interrupted build is
// marked failed at the next start. Also the app's icon (GET …/android/icon: the uploaded PNG, else the
// start screen; 404 for another user, before setup; 401 signed out), and the R2 store with a fake bucket
// (ANDROID_FAKE=1 ANDROID_STORE=r2: a folder stands in for R2, nothing leaves this PC): the phone link is
// the same short API link, opening it answers a 302 to a freshly presigned URL (checked against an
// independent SigV4 computation), a link refused once it has run out (ANDROID_LINK_SECONDS=4) or when
// its build is gone, and a build stored in the folder before still streams.
import { spawn, spawnSync } from "node:child_process";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, rmdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { crc32, deflateSync, inflateRawSync } from "node:zlib";
import pg from "pg";

const here = resolve(import.meta.dirname, "..");
const root = resolve(here, "../..");
process.loadEnvFile(join(root, ".env"));
const PORT = 3015;
const API = `http://127.0.0.1:${PORT}`;
const DATA = resolve(process.env.DATA_DIR || join(root, "data"));
const MASTER = randomBytes(32).toString("hex");
const stamp = Date.now().toString(36);
const A = `dev:android-${stamp}-a@test.local`;
const B = `dev:android-${stamp}-b@test.local`;
const emailOf = (t) => t.slice(4);
/** The game's name is "A cat that jumps over boxes": its file slug (downloads are named after the game, not the app name). */
const SLUG = "a-cat-that-jumps-over-boxes";
const devId = (t) => `dev-${emailOf(t).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(token, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}
async function raw(token, path) {
  const res = await fetch(path.startsWith("http") ? path : API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, type: res.headers.get("content-type") ?? "", disposition: res.headers.get("content-disposition") ?? "", headers: res.headers, buf: Buffer.from(await res.arrayBuffer()) };
}
/** A link opened without following its redirect: the 302 itself. */
const hop = (url) => fetch(url, { redirect: "manual" });
/** A plain square PNG (one transparent colour), enough for the API's icon rules (a square of 512 or more, under 1 MB). */
function squarePng(size) {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (b) => {
    let c = 0xffffffff;
    for (const x of b) c = table[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.alloc((size * 4 + 1) * size))), chunk("IEND", Buffer.alloc(0))]);
}
const isPng = (buf) => buf.length > 33 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
/** A valid 512 px PNG of exactly `bytes` (a big tEXt chunk right after its header): for the icon's 1 MB limit. */
function bigPng(bytes) {
  const png = squarePng(512);
  const data = Buffer.concat([Buffer.from("Comment\0", "latin1"), Buffer.alloc(bytes - png.length - 12 - 8, 0x61)]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from("tEXt", "latin1"), data]);
  const sum = Buffer.alloc(4);
  sum.writeUInt32BE(crc32(body));
  return Buffer.concat([png.subarray(0, 33), len, body, sum, png.subarray(33)]);
}
/**
 * Whether a presigned GET URL carries the signature AWS Signature V4 gives it under `secret` (the spec's steps, written
 * out here on their own: canonical request, string to sign, the date/region/service key chain; region "auto" as R2 takes).
 */
function sigV4Valid(urlString, secret) {
  const u = new URL(urlString);
  const q = [...u.searchParams.entries()];
  const signature = q.find(([k]) => k === "X-Amz-Signature")?.[1];
  const enc = (v) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const canonicalQuery = q
    .filter(([k]) => k !== "X-Amz-Signature")
    .map(([k, v]) => [enc(k), enc(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const date = u.searchParams.get("X-Amz-Date") ?? "";
  const scope = `${date.slice(0, 8)}/auto/s3/aws4_request`;
  const canonicalRequest = ["GET", u.pathname, canonicalQuery, `host:${u.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", date, scope, createHash("sha256").update(canonicalRequest).digest("hex")].join("\n");
  const mac = (key, data) => createHmac("sha256", key).update(data).digest();
  const key = ["auto", "s3", "aws4_request"].reduce((k, part) => mac(k, part), mac("AWS4" + secret, date.slice(0, 8)));
  return mac(key, toSign).toString("hex") === signature && u.searchParams.get("X-Amz-Credential")?.endsWith("/" + scope);
}
/** "20261018T203000Z" → milliseconds. */
const amzTime = (d) => Date.parse(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${d.slice(9, 11)}:${d.slice(11, 13)}:${d.slice(13, 15)}Z`);
async function openEvents(token, id) {
  const ctrl = new AbortController();
  const res = await fetch(`${API}/projects/${id}/events`, { headers: { Authorization: `Bearer ${token}` }, signal: ctrl.signal });
  const events = [];
  const wake = new Set();
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
        reject(new Error(`timed out waiting; got ${events.map((e) => e.type + (e.build ? ":" + e.build.status : "")).join(",")}`));
      }, ms);
      wake.add(check);
      check();
    });
  return { events, until, close: () => ctrl.abort() };
}
function unzip(buf) {
  const end = buf.length - 22;
  const count = buf.readUInt16LE(end + 10);
  let at = buf.readUInt32LE(end + 16);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(at + 10);
    const size = buf.readUInt32LE(at + 20);
    const nameLen = buf.readUInt16LE(at + 28);
    const skip = buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
    const local = buf.readUInt32LE(at + 42);
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString("utf8");
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const body = buf.subarray(start, start + size);
    files.set(name, method === 8 ? inflateRawSync(body) : body);
    at += 46 + nameLen + skip;
  }
  return files;
}
const admin = (...args) => spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: here, encoding: "utf8" });

async function spawnApi(extraEnv = {}) {
  // A test API left on the port by an earlier run would answer in place of ours: refuse to go on.
  if (await fetch(`${API}/health`).then((r) => r.ok, () => false)) throw new Error(`something already answers on :${PORT}: stop it first`);
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: here,
    env: { ...process.env, PORT: String(PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ANDROID_EXPORT: "1", ANDROID_FAKE: "1", ANDROID_KEY_MASTER: MASTER, BILLING_JOBS: "0", ...extraEnv },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  for (let i = 0; i < 90; i++) {
    await sleep(500);
    if (child.exitCode !== null) throw new Error(`the test API exited: ${output.slice(-800)}`);
    const h = await fetch(`${API}/health`).then((r) => r.json()).catch(() => null);
    if (h?.agent === "fake") {
      // kill(): stops it and waits until the port no longer answers (a restart test spawns the next one).
      const kill = async () => {
        child.kill();
        for (let j = 0; j < 40; j++) {
          if (!(await fetch(`${API}/health`).then((r) => r.ok, () => false))) return;
          await sleep(250);
        }
      };
      return { health: h, kill, output: () => output };
    }
  }
  child.kill();
  throw new Error(`the test API on :${PORT} did not start: ${output.slice(-800)}`);
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
let server = await spawnApi();
const projects = [];
/** Every game this run made (`projects` is emptied once the delete case has passed): its build logs go at the end. */
const made = [];
const finished = (e) => e.type === "done" || e.type === "failed";
/** The one-build-a-minute guard, moved out of the way for the next build (this game's rows aged by 2 minutes). */
const ageBuilds = () => db.query('update "AndroidBuild" set "queuedAt" = now() - interval \'2 minutes\' where "projectId" = any($1)', [projects]);
const buildIs = (status, id) => (e) => e.type === "android" && e.build.status === status && (!id || e.build.id === id);
/** Polls the state until a build is over (a server started after the event stream was opened has no stream to wait on). */
async function settled(token, projectId, id, ms = 30_000) {
  const t0 = Date.now();
  for (;;) {
    const b = (await api(token, "GET", `/projects/${projectId}/android`)).body.builds.find((x) => x.id === id);
    if (b && !["queued", "running", "signing"].includes(b.status)) return b;
    if (Date.now() - t0 > ms) throw new Error(`build ${id} did not finish (${b?.status})`);
    await sleep(300);
  }
}

try {
  console.log("health and features");
  ok(server.health.android?.enabled === true && server.health.android.running === 0, "/health: android enabled, 0 running");
  const meA = await api(A, "GET", "/me");
  ok(meA.body.features?.android === true, "GET /me features.android true");

  console.log("a game to export");
  const created = await api(A, "POST", "/projects", { prompt: "A cat that jumps over boxes", model: "fast" });
  const p = created.body;
  ok(created.status === 201, `POST /projects: ${created.status} ${created.status === 201 ? "" : JSON.stringify(created.body)}`);
  projects.push(p.id);
  made.push(p.id);
  const s = await openEvents(A, p.id);
  await s.until(finished);
  ok((await api(A, "GET", `/projects/${p.id}`)).body.currentVersion === 1, "version 1 built (fake run)");

  console.log("Free: no export");
  ok((await api(A, "GET", `/projects/${p.id}/android`)).body.app === null, "GET state before setup: app null");
  ok((await raw(A, `/projects/${p.id}/android/icon`)).status === 404, "the icon before Android is set up: 404");
  const free = await api(A, "POST", `/projects/${p.id}/android`, {});
  ok(free.status === 403 && free.body.error === "plan_no_export", "setup on Free: 403 plan_no_export");
  ok((await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "apk" })).status === 403, "build on Free: 403");
  ok((await raw(A, `/projects/${p.id}/android/key`)).status === 403, "key on Free: 403");
  ok(/->/.test(admin("plan", emailOf(A), "medium").stdout), "admin: plan medium");

  console.log("setup");
  ok((await api(A, "POST", `/projects/${p.id}/android`, { packageName: "com.example.cat" })).body?.error === "bad_request", "com.example.* refused");
  ok((await api(A, "POST", `/projects/${p.id}/android`, { appName: "x".repeat(31) })).body?.error === "bad_request", "a 31-letter app name refused");
  const setup = await api(A, "POST", `/projects/${p.id}/android`, {});
  ok(setup.status === 201 && setup.body.app?.packageName === `app.typeplay.a_cat_that_jumps_ove_${p.id}` && setup.body.app.versionCode === 0 && setup.body.app.packageLocked === false, `setup: default package ${setup.body.app?.packageName} (slug cut to 20)`);
  ok(setup.body.app?.appName === "A cat that jumps over boxes" && setup.body.key?.certSha256.length === 64 && setup.body.key.downloads === 0 && setup.body.builds.length === 0, "app name from the game, a key with a fingerprint, no builds");
  ok(setup.body.limits.perGameToday === 10 && setup.body.limits.perUserToday === 30, "limits: 10 per game, 30 per user");
  const again = await api(A, "POST", `/projects/${p.id}/android`, {});
  ok(again.status === 409 && again.body.error === "busy", "second setup: 409 busy");
  const keyRow = await db.query('select "keyId", "certSha256", length(blob) as len from "AndroidKey" where "projectId" = $1', [p.id]);
  ok(keyRow.rows[0]?.keyId === 1 && keyRow.rows[0].len > 40, "the key row holds a sealed blob (never the keystore)");

  console.log("update");
  const upd = await api(A, "PATCH", `/projects/${p.id}/android`, { appName: "Cat Jump", packageName: "com.luka.catjump" });
  ok(upd.status === 200 && upd.body.app.appName === "Cat Jump" && upd.body.app.packageName === "com.luka.catjump", "rename app and package (free before the first AAB)");
  ok((await api(A, "PATCH", `/projects/${p.id}/android`, { iconPng: Buffer.from("nope").toString("base64") })).body?.error === "bad_request", "a non-PNG icon refused");
  ok((await api(A, "PATCH", `/projects/${p.id}/android`, {})).body?.error === "bad_request", "an empty update refused");

  console.log("the app's icon: GET …/android/icon");
  const iconUrl = `/projects/${p.id}/android/icon`;
  const posterFile = readFileSync(join(DATA, "projects", p.id, "export", "screenshot-start.png"));
  const fromPoster = await raw(A, iconUrl);
  ok(fromPoster.status === 200 && fromPoster.type === "image/png" && isPng(fromPoster.buf) && fromPoster.buf.equals(posterFile), "no upload yet: the start-screen picture a build would use");
  ok(fromPoster.headers.get("cache-control") === "private, max-age=300" && /Authorization/i.test(fromPoster.headers.get("vary") ?? "") && fromPoster.headers.get("x-content-type-options") === "nosniff" && Number(fromPoster.headers.get("content-length")) === posterFile.length, "…private for 5 minutes, per sign-in, nosniff, with its length");
  const ownIcon = squarePng(512);
  const uploaded = await api(A, "PATCH", `/projects/${p.id}/android`, { iconPng: ownIcon.toString("base64") });
  ok(uploaded.status === 200 && uploaded.body.app.hasIcon === true, "a 512 px PNG uploaded: hasIcon");
  const icon = await raw(A, iconUrl);
  ok(icon.status === 200 && icon.type === "image/png" && icon.buf.equals(ownIcon), "owner: the uploaded PNG, byte for byte");
  ok((await raw(B, iconUrl)).status === 404, "another user: 404");
  ok((await raw(null, iconUrl)).status === 401, "signed out: 401");
  ok((await raw(A, "/projects/nosuchgame/android/icon")).status === 404, "an unknown game: 404");
  // Security review 10-20: JSON bodies were read up to 1 MB, and a 1 MB icon is 1.4 MB as base64, so an icon over ~750 KB
  // failed with a 500. Now 1.5 MB.
  const nearMax = bigPng(1_000_000);
  const bigUp = await api(A, "PATCH", `/projects/${p.id}/android`, { iconPng: nearMax.toString("base64") });
  ok(bigUp.status === 200 && bigUp.body.app.hasIcon === true && (await raw(A, iconUrl)).buf.equals(nearMax), "a 1,000,000-byte PNG (1.33 MB as base64): uploaded, byte for byte (it was a 500)");
  const over = await api(A, "PATCH", `/projects/${p.id}/android`, { iconPng: bigPng(1_100_000).toString("base64") });
  ok(over.status === 400 && /under 1 MB/.test(over.body?.message ?? ""), "1.1 MB: the icon rule's own 400 (under 1 MB), not the body limit");
  const unset = await api(A, "PATCH", `/projects/${p.id}/android`, { iconPng: null });
  ok(unset.status === 200 && unset.body.app.hasIcon === false && (await raw(A, iconUrl)).buf.equals(posterFile), "removed again: hasIcon false, the route is back to the start screen");

  console.log("a build: queued → running → signing → done");
  const start = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "apk" });
  ok(start.status === 202 && start.body.id === `${p.id}-a1` && start.body.versionCode === 1 && start.body.versionName === "1.1" && start.body.format === "apk", `202 queued: ${start.body.id} v${start.body.versionN} #${start.body.versionCode}${start.status === 202 ? "" : ` (got ${start.status} ${JSON.stringify(start.body)})`}`);
  ok(["queued", "running"].includes(start.body.status) && start.body.checks.length === 0, "status queued/running, no checks yet");
  const chat = await api(A, "POST", `/projects/${p.id}/messages`, { text: "Add coins", model: "fast" });
  ok(chat.status === 409 && chat.body.error === "busy" && /Android/.test(chat.body.message), "chat during the build: 409 busy (Android wording)");
  ok((await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "aab" })).status === 409, "a second build while one goes: 409");
  const done = await s.until(buildIs("done", `${p.id}-a1`));
  const seen = s.events.filter((e) => e.type === "android" && e.build.id === `${p.id}-a1`).map((e) => e.build.status);
  ok(seen.includes("running") && seen.includes("signing") && seen.at(-1) === "done", `events: ${seen.join(" → ")}`);
  ok(done.build.bytes > 0 && /^[0-9a-f]{64}$/.test(done.build.sha256) && done.build.icon === "poster", "done: bytes, sha256, icon from the poster");
  ok(done.build.checks.length === 8 && done.build.checks.every((c) => c.ok), "checks list all green");
  ok(done.build.expiresAt && (Date.parse(done.build.expiresAt) - Date.now()) / 86_400_000 > 29, "expires in 30 days");
  const row = (await db.query('select status, path, "versionCode", checks from "AndroidBuild" where id = $1', [`${p.id}-a1`])).rows[0];
  ok(row.status === "done" && row.path === `data/android/${p.id}/${p.id}-a1.apk` && row.checks?.package === "com.luka.catjump", "row done with the file's path and inspect.json");
  ok(existsSync(join(DATA, "android", p.id, `${p.id}-a1.apk`)), "the signed file is in data/android/<project>/");
  ok((await api(A, "GET", `/projects/${p.id}`)).body.status === "idle", "the game is idle again");
  const health = await (await fetch(`${API}/health`)).json();
  ok(health.android.running === 0, "/health android.running back to 0");

  console.log("download, phone link");
  const dl = await raw(A, `/projects/${p.id}/android/builds/${p.id}-a1/download`);
  ok(dl.status === 200 && dl.type === "application/vnd.android.package-archive" && dl.disposition === `attachment; filename="${SLUG}-v1.apk"` && dl.buf.length === done.build.bytes, "download: APK mime, name <slug>-v1.apk, the bytes");
  ok(dl.buf.includes("SIGNED-FAKE"), "the file is the signed one");
  const link = await api(A, "POST", `/projects/${p.id}/android/builds/${p.id}-a1/link`);
  ok(link.status === 200 && /^http:\/\/127\.0\.0\.1:3015\/android\/dl\/[A-Za-z0-9_-]{40,}$/.test(link.body.url) && (Date.parse(link.body.expiresAt) - Date.now()) / 60_000 > 9, "link: a 10-minute token URL on the API");
  const phone = await raw(null, link.body.url);
  ok(phone.status === 200 && phone.buf.equals(dl.buf) && phone.disposition.includes(`${SLUG}-v1.apk`), "the link needs no sign-in and serves the same bytes");
  ok((await raw(null, `${API}/android/dl/${"x".repeat(43)}`)).status === 404, "a wrong token: 404");
  ok((await raw(B, `/projects/${p.id}/android/builds/${p.id}-a1/download`)).status === 404, "user B: 404 on the download");
  ok((await api(B, "GET", `/projects/${p.id}/android`)).status === 404, "user B: 404 on the state");

  console.log("the key");
  const kz = await raw(A, `/projects/${p.id}/android/key`);
  ok(kz.status === 200 && kz.type === "application/zip" && kz.disposition === `attachment; filename="${SLUG}-upload-key.zip"`, "key zip: 200, zip, named after the game");
  const files = unzip(kz.buf);
  const readme = files.get("README.txt")?.toString("utf8") ?? "";
  ok(files.has(`${SLUG}-upload-key.jks`) && files.get(`${SLUG}-upload-key.jks`).toString().startsWith("FAKE-PKCS12"), "the keystore is inside (the fake signer's)");
  ok(/Key alias: upload/.test(readme) && /Password \(keystore and key\): [A-Za-z0-9]{32}/.test(readme) && /Request upload key reset/.test(readme) && /Package name: com\.luka\.catjump/.test(readme), "README: alias, password, the Play reset path, the package name");
  const st = await api(A, "GET", `/projects/${p.id}/android`);
  ok(st.body.key.downloads === 1 && st.body.key.downloadedAt, "download counted");

  console.log("an AAB locks the package name");
  const tooSoon = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "aab" });
  ok(tooSoon.status === 429 && tooSoon.body.error === "too_many", "a second build within a minute: 429 too_many (one a minute per game)");
  await ageBuilds();
  const aab = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "aab" });
  ok(aab.status === 202 && aab.body.id === `${p.id}-a2` && aab.body.versionCode === 2 && aab.body.versionName === "1.2", "aab queued as build 2, version name 1.2");
  const aabDone = await s.until(buildIs("done", `${p.id}-a2`));
  ok(aabDone.build.checks.find((c) => c.id === "format")?.text.includes(".aab"), "checks: Play package (.aab)");
  const aabDl = await raw(A, `/projects/${p.id}/android/builds/${p.id}-a2/download`);
  ok(aabDl.status === 200 && aabDl.type === "application/octet-stream" && aabDl.disposition.includes(`${SLUG}-v2.aab`), "aab download: octet-stream, <slug>-v2.aab");
  const locked = await api(A, "GET", `/projects/${p.id}/android`);
  ok(locked.body.app.packageLocked === true, "package locked after the first AAB");
  const change = await api(A, "PATCH", `/projects/${p.id}/android`, { packageName: "com.luka.catjump2" });
  ok(change.status === 409 && change.body.error === "busy" && /new app/.test(change.body.message), "a package change now: 409 with the warning");
  ok((await api(A, "PATCH", `/projects/${p.id}/android`, { packageName: "com.luka.catjump2", confirmPackageChange: true })).body.app.packageName === "com.luka.catjump2", "…and goes through with confirmPackageChange");
  ok((await api(A, "PATCH", `/projects/${p.id}/android`, { appName: "Cat Jump" })).status === 200, "an app-name change needs no confirmation");

  console.log("failures: a tampered export, a game error");
  const q2 = await api(A, "POST", `/projects/${p.id}/android`, {}); // no-op: already set up
  ok(q2.status === 409, "(setup still 409)");
  await api(A, "PATCH", `/projects/${p.id}/android`, { appName: "Cat MISMATCH" }); // the fake job plants a tampered manifest
  await ageBuilds();
  const t2 = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "apk" });
  ok(t2.status === 202, "after a minute: queued");
  const tFail = await s.until((e) => e.type === "android" && e.build.id === t2.body.id && (e.build.status === "failed" || e.build.status === "done"));
  ok(tFail.build.status === "failed" && tFail.build.failCode === "mismatch" && /didn't come out the way we asked/.test(tFail.build.failMessage), "a tampered manifest: failed, mismatch, not signed");
  ok(!existsSync(join(DATA, "android", p.id, `${t2.body.id}.apk`)), "no file stored for it");
  await api(A, "PATCH", `/projects/${p.id}/android`, { appName: "Cat FAIL" });
  await ageBuilds();
  const g = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "apk" });
  const gFail = await s.until((e) => e.type === "android" && e.build.id === g.body.id && (e.build.status === "failed" || e.build.status === "done"));
  ok(gFail.build.status === "failed" && gFail.build.failCode === "game" && /Ask for a fix in the chat/.test(gFail.build.failMessage) && /Parse Error/.test(gFail.build.logTail ?? ""), `a game error: failed, game, the log tail behind Details (${gFail.build.status} ${gFail.build.failCode}; tail ${JSON.stringify((gFail.build.logTail ?? "").slice(0, 80))})`);
  await api(A, "PATCH", `/projects/${p.id}/android`, { appName: "Cat Jump" });

  console.log("cancel");
  await ageBuilds();
  const c = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "apk" });
  const cancelled = await api(A, "POST", `/projects/${p.id}/android/builds/${c.body.id}/cancel`);
  ok(cancelled.status === 200 && cancelled.body.status === "cancelled" && cancelled.body.failMessage === "Stopped.", "cancel: cancelled");
  ok((await api(A, "POST", `/projects/${p.id}/android/builds/nope/cancel`)).status === 404, "cancel of an unknown build: 404");
  ok((await api(A, "GET", `/projects/${p.id}`)).body.status === "idle", "the game is idle after the cancel");

  console.log("export, limits, state");
  const exp = await api(A, "GET", "/me/export");
  const game = exp.body.games.find((x) => x.id === p.id);
  ok(game?.android?.packageName === "com.luka.catjump2" && game.android.certSha256.length === 64 && game.android.builds.length === 5 && !JSON.stringify(exp.body).includes("FAKE-PKCS12"), "/me/export: Android without the key");
  ok(exp.body.notes.some((n) => /Android signing keys/.test(n)), "/me/export notes say where the key is");
  const state = await api(A, "GET", `/projects/${p.id}/android`);
  ok(state.body.builds.length === 5 && state.body.builds[0].id === c.body.id && state.body.limits.perGameToday === 5 && state.body.limits.perUserToday === 25, "state: 5 builds newest first, limits counted down");

  console.log("an interrupted build is failed at the next start");
  await db.query('update "AndroidBuild" set status = \'running\' where id = $1', [c.body.id]);
  await server.kill();
  server = await spawnApi();
  const after = (await db.query('select status, "failCode" from "AndroidBuild" where id = $1', [c.body.id])).rows[0];
  ok(after.status === "failed" && after.failCode === "interrupted", "running at start → failed, interrupted");

  console.log("R2 store, a folder standing in for the bucket: the short phone link redirects to a freshly presigned URL");
  const FAKE_R2 = { ANDROID_STORE: "r2", ANDROID_LINK_SECONDS: "4", R2_EXPORTS_BUCKET: "typeplay-exports", CLOUDFLARE_ACCOUNT_ID: "fakeaccount", R2_ACCESS_KEY_ID: "FAKEKEYID", R2_SECRET_ACCESS_KEY: "fakesecret" };
  await server.kill();
  server = await spawnApi(FAKE_R2);
  const bucketDir = join(DATA, "android", "_r2", "typeplay-exports", "android", p.id);
  await ageBuilds();
  const rb = await api(A, "POST", `/projects/${p.id}/android/builds`, { format: "apk" });
  ok(rb.status === 202, `a build with ANDROID_STORE=r2: queued (${rb.status}${rb.status === 202 ? "" : " " + JSON.stringify(rb.body)})`);
  const rbDone = await settled(A, p.id, rb.body.id);
  ok(rbDone.status === "done" && rbDone.checks.length === 8 && rbDone.checks.every((c) => c.ok), `…done, all checks green (${rbDone.status})`);
  const rbRow = (await db.query('select path, bytes from "AndroidBuild" where id = $1', [rb.body.id])).rows[0];
  ok(rbRow.path === `android/${p.id}/${rb.body.id}.apk`, "the row holds an R2 key, not a folder path");
  ok(existsSync(join(bucketDir, `${rb.body.id}.apk`)) && !existsSync(join(DATA, "android", p.id, `${rb.body.id}.apk`)), "…the file is in the (fake) bucket and not in the folder store");
  const rDl = await raw(A, `/projects/${p.id}/android/builds/${rb.body.id}/download`);
  ok(rDl.status === 200 && rDl.buf.length === rbRow.bytes && rDl.buf.includes("SIGNED-FAKE") && rDl.disposition.includes(`${SLUG}-v${rb.body.versionCode}.apk`), "the signed-in download streams it from the bucket");
  const rLink = await api(A, "POST", `/projects/${p.id}/android/builds/${rb.body.id}/link`);
  const opened = Date.now(); // the link lives 4 seconds from about here
  const short = rLink.body.url;
  ok(rLink.status === 200 && /^http:\/\/127\.0\.0\.1:3015\/android\/dl\/[A-Za-z0-9_-]{43}$/.test(short) && short.length < 100, `the phone link is the short API link (${short.length} characters), not a ~450-character presigned URL`);
  const lifeLeft = Date.parse(rLink.body.expiresAt) - opened;
  ok(lifeLeft > 2000 && lifeLeft <= 4100, `…good for the 4 seconds this run asked for (${lifeLeft} ms left)`);
  const h1 = await hop(short);
  const loc1 = h1.headers.get("location") ?? "";
  const q1 = new URL(loc1);
  ok(h1.status === 302 && h1.headers.get("cache-control") === "no-store", "opened: a 302 that is never cached");
  ok(q1.host === "fakeaccount.r2.cloudflarestorage.com" && q1.pathname === `/typeplay-exports/android/${p.id}/${rb.body.id}.apk`, "…to the object in the exports bucket");
  const expires1 = Number(q1.searchParams.get("X-Amz-Expires"));
  ok(expires1 >= 1 && expires1 <= 4, `…a presigned URL good for ${expires1} s: no longer than what is left of the link's life`);
  ok(sigV4Valid(loc1, "fakesecret"), "…whose signature is the one AWS Signature V4 gives it (computed again here, from the spec)");
  ok(q1.searchParams.get("response-content-disposition") === `attachment; filename="${SLUG}-v${rb.body.versionCode}.apk"`, "…that saves as <game>-v<build>.apk");
  ok(Math.abs(amzTime(q1.searchParams.get("X-Amz-Date")) - Date.now()) < 3000, "…made just now");
  await sleep(1200);
  const h2 = await hop(short);
  const loc2 = h2.headers.get("location") ?? "";
  ok(h2.status === 302 && loc2 !== loc1 && amzTime(new URL(loc2).searchParams.get("X-Amz-Date")) > amzTime(q1.searchParams.get("X-Amz-Date")) && sigV4Valid(loc2, "fakesecret"), "opened again a second later: another URL, signed fresh, also valid");
  const oldLink = await api(A, "POST", `/projects/${p.id}/android/builds/${p.id}-a1/link`);
  const oldOpen = await raw(null, oldLink.body.url);
  ok(oldLink.body.url.length < 100 && oldOpen.status === 200 && oldOpen.buf.equals(dl.buf), "a build stored in the folder before the switch: the same short link, streamed with no redirect");
  const waitFor = 4400 - (Date.now() - opened);
  if (waitFor > 0) await sleep(waitFor);
  const late = await hop(short);
  const lateBody = await late.json().catch(() => null);
  ok(late.status === 404 && lateBody?.error === "not_found" && /expired/.test(lateBody?.message ?? ""), "after its 4 seconds: refused, 404 this link has expired");
  ok(!late.headers.get("location"), "…and no redirect to follow");
  const goneLink = await api(A, "POST", `/projects/${p.id}/android/builds/${rb.body.id}/link`);
  await db.query("update \"AndroidBuild\" set status = 'expired', path = null where id = $1", [rb.body.id]); // what the 30-day sweep does
  const gone = await hop(goneLink.body.url);
  const goneBody = await gone.json().catch(() => null);
  ok(gone.status === 404 && /file is gone/.test(goneBody?.message ?? "") && !gone.headers.get("location"), "the build swept meanwhile: refused, 404 the file is gone");
  ok(existsSync(join(DATA, "android", p.id)), "files exist before");
  ok((await api(A, "DELETE", `/projects/${p.id}`)).status === 200, "DELETE /projects/:id");
  ok((await db.query('select count(*)::int as n from "AndroidBuild" where "projectId" = $1', [p.id])).rows[0].n === 0, "build rows gone (cascade)");
  ok((await db.query('select count(*)::int as n from "AndroidKey" where "projectId" = $1', [p.id])).rows[0].n === 0, "key row gone");
  ok(!existsSync(join(DATA, "android", p.id)) && !existsSync(bucketDir), "data/android/<project> gone, and the fake bucket's files");
  projects.length = 0;
  s.close();
} catch (e) {
  console.log(`  FAIL ${e.stack ?? e}`);
  console.log(`  server output (tail):
${server.output().slice(-2000)}`);
  failures++;
} finally {
  for (const id of projects) await api(A, "DELETE", `/projects/${id}`).catch(() => {});
  for (const t of [A, B]) await db.query('delete from "User" where id = $1', [devId(t)]).catch(() => {});
  for (const t of [A, B]) {
    const dir = join(DATA, "android", devId(t));
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  // The fake bucket's folders, once empty (a game left behind by a failed run is not touched).
  for (const d of [join(DATA, "android", "_r2", "typeplay-exports", "android"), join(DATA, "android", "_r2", "typeplay-exports"), join(DATA, "android", "_r2")]) {
    try {
      rmdirSync(d);
    } catch {
      // not there, or not empty
    }
  }
  for (const f of existsSync(join(DATA, "logs")) ? readdirSync(join(DATA, "logs")) : []) if (/^android-.*\.log$/.test(f) && (f.includes(stamp) || made.some((id) => f.startsWith(`android-${id}-a`)))) rmSync(join(DATA, "logs", f), { force: true });
  await server.kill();
  await db.end();
}
console.log(failures ? `${failures} FAILED` : "android e2e: all good");
process.exit(failures ? 1 : 0);
