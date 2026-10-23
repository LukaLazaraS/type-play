// Cloudflare R2 through its S3 API (AWS Signature V4, region "auto"): the typeplay-games bucket
// behind https://typeplay.dev, and (Android export, 2026-10-18) the private typeplay-exports bucket,
// read back through presigned GET links. Same signing as apps/games/scripts/publish.mjs. Keys: the
// R2 object keys only (Object Read & Write), never the Cloudflare API token (docs/cloudflare.md).
import { createHash, createHmac } from "node:crypto";
import { config } from "../env.js";

const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

const checkKey = (key: string) => {
  if (!/^[a-z0-9._/-]+$/.test(key)) throw new Error(`unexpected R2 key: ${key}`);
};
const SCOPE = ["auto", "s3", "aws4_request"];
const signingKeyFor = (day: string) => SCOPE.reduce<Buffer>((k, part) => hmac(k, part), hmac("AWS4" + config.r2.secretAccessKey, day));

function s3(method: "PUT" | "HEAD" | "DELETE" | "GET", key: string, body?: Buffer, headers: Record<string, string> = {}, bucket = config.r2.bucket) {
  const { accountId, accessKeyId } = config.r2;
  checkKey(key);
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`);
  const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = date.slice(0, 8);
  const payload = sha256(body ?? "");
  const signed: Record<string, string> = { ...headers, host: url.host, "x-amz-content-sha256": payload, "x-amz-date": date };
  const names = Object.keys(signed).sort();
  const canonical = [method, url.pathname, "", names.map((n) => `${n}:${signed[n]}\n`).join(""), names.join(";"), payload].join("\n");
  const scope = `${day}/auto/s3/aws4_request`;
  const signature = createHmac("sha256", signingKeyFor(day)).update(["AWS4-HMAC-SHA256", date, scope, sha256(canonical)].join("\n")).digest("hex");
  delete signed.host;
  signed.authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`;
  return fetch(url, { method, headers: signed, body: body ? new Uint8Array(body) : undefined });
}

export async function r2Put(key: string, body: Buffer, contentType: string, cacheControl: string, bucket?: string): Promise<void> {
  const res = await s3("PUT", key, body, { "content-type": contentType, "cache-control": cacheControl }, bucket);
  if (!res.ok) throw new Error(`R2 upload ${key}: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

/** The object as a Response (its body streams), or null when there is none. */
export async function r2Get(key: string, bucket?: string): Promise<Response | null> {
  const res = await s3("GET", key, undefined, {}, bucket);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 get ${key}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res;
}

/**
 * A presigned GET link (SigV4 in the query string): anyone with it can read that one object until it
 * expires (1 s to 7 days); `filename` sets the download's name through response-content-disposition.
 * Only against the <account>.r2.cloudflarestorage.com endpoint, never a custom domain.
 */
export function r2PresignGet(key: string, o: { bucket?: string; expiresSec: number; filename?: string }): string {
  const { accountId, accessKeyId } = config.r2;
  checkKey(key);
  const url = new URL(`https://${accountId}.r2.cloudflarestorage.com/${o.bucket ?? config.r2.bucket}/${key}`);
  const date = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = date.slice(0, 8);
  const scope = `${day}/auto/s3/aws4_request`;
  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKeyId}/${scope}`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(Math.max(1, Math.min(604_800, Math.round(o.expiresSec)))),
    "X-Amz-SignedHeaders": "host",
  };
  if (o.filename) query["response-content-disposition"] = `attachment; filename="${o.filename.replace(/["\\\r\n]/g, "")}"`;
  const enc = (v: string) => encodeURIComponent(v).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const canonicalQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join("&");
  const canonical = ["GET", url.pathname, canonicalQuery, `host:${url.host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const signature = createHmac("sha256", signingKeyFor(day)).update(["AWS4-HMAC-SHA256", date, scope, sha256(canonical)].join("\n")).digest("hex");
  url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
  return url.toString();
}

/** The object's MD5 (R2's ETag), or null when there is none. */
export async function r2Etag(key: string): Promise<string | null> {
  const res = await s3("HEAD", key);
  return res.ok ? (res.headers.get("etag") ?? "").replace(/^W\//, "").replaceAll('"', "") : null;
}

export async function r2Delete(key: string, bucket?: string): Promise<void> {
  const res = await s3("DELETE", key, undefined, {}, bucket);
  if (!res.ok && res.status !== 404) throw new Error(`R2 delete ${key}: ${res.status} ${(await res.text()).slice(0, 300)}`);
}
