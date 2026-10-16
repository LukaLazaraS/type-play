// Publishes this folder to the live games origin: the R2 bucket behind https://typeplay.dev.
// Usage: node scripts/publish.mjs [--dry]
// Keys: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, CLOUDFLARE_ACCOUNT_ID from the root .env.
// Uploads play.html, engine/<version>/ and builds/<id>/; skips files whose content is already live.
import { createHash, createHmac } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { CLOUDFLARE_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: keyId, R2_SECRET_ACCESS_KEY: secret } = process.env;
const bucket = process.env.R2_GAMES_BUCKET || "typeplay-games";
const dry = process.argv.includes("--dry");
if (!account || !keyId || !secret) throw new Error("R2 keys missing: see the root .env");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".wasm": "application/wasm",
  ".pck": "application/octet-stream",
  ".json": "application/json",
};
// Engines and game packs never change under the same name; the loader and manifests do.
const cacheFor = (key) =>
  key === "play.html" || key.endsWith(".json") ? "no-cache" : "public, max-age=31536000, immutable";

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();

// One signed S3 request (AWS Signature V4, region "auto"), the format R2 speaks.
function s3(method, key, { body, headers = {} } = {}) {
  const url = new URL(`https://${account}.r2.cloudflarestorage.com/${bucket}/${key}`);
  const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = date.slice(0, 8);
  const payload = sha256(body ?? "");
  const signed = { ...headers, host: url.host, "x-amz-content-sha256": payload, "x-amz-date": date };
  const names = Object.keys(signed).sort();
  const canonical = [method, url.pathname, "", names.map((n) => `${n}:${signed[n]}\n`).join(""), names.join(";"), payload].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const signingKey = ["auto", "s3", "aws4_request"].reduce(hmac, hmac("AWS4" + secret, day));
  const signature = createHmac("sha256", signingKey).update(["AWS4-HMAC-SHA256", date, scope, sha256(canonical)].join("\n")).digest("hex");
  delete signed.host;
  signed.authorization = `AWS4-HMAC-SHA256 Credential=${keyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
  return fetch(url, { method, headers: signed, body });
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const files = [join(root, "play.html"), ...walk(join(root, "engine")), ...walk(join(root, "builds"))];

let uploaded = 0, skipped = 0, bytes = 0;
async function publish(file) {
  const key = relative(root, file).split(sep).join("/");
  if (!/^[a-z0-9._/-]+$/.test(key)) throw new Error(`unexpected file name: ${key}`);
  const ext = key.slice(key.lastIndexOf("."));
  if (!types[ext]) return console.warn(`  skip ${key} (not a served file type)`);
  const body = readFileSync(file);
  const md5 = createHash("md5").update(body).digest("hex");
  const head = await s3("HEAD", key);
  // R2's ETag is the file's MD5; it comes "weak" (W/"…") for types it could compress.
  if (head.ok && head.headers.get("etag")?.replace(/^W\//, "").replaceAll('"', "") === md5) return skipped++;
  if (head.ok && cacheFor(key) !== "no-cache") {
    console.warn(`  ! ${key} changed under the same name: browsers that cached it keep the old copy (use a new id)`);
  }
  if (dry) return console.log(`  would upload ${key}`);
  const res = await s3("PUT", key, { body, headers: { "content-type": types[ext], "cache-control": cacheFor(key) } });
  if (!res.ok) throw new Error(`upload ${key}: ${res.status} ${await res.text()}`);
  uploaded++;
  bytes += statSync(file).size;
  console.log(`  ${key}`);
}

// A few uploads at a time.
const queue = [...files];
await Promise.all(Array.from({ length: 6 }, async () => { while (queue.length) await publish(queue.shift()); }));
console.log(`${dry ? "dry run: " : ""}${uploaded} uploaded (${(bytes / 1e6).toFixed(1)} MB), ${skipped} unchanged → https://typeplay.dev/play.html?g=robot-runner`);
