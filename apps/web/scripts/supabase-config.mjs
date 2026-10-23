// Copies the two public Supabase values (URL, publishable key) from the repo's root .env into
// src/content/app.ts. Prints only lengths, never values, and never touches any other .env key.
//   node scripts/supabase-config.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..", "..");
const target = join(import.meta.dirname, "..", "src", "content", "app.ts");

const env = {};
for (const line of readFileSync(join(root, ".env"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*(SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = (env.SUPABASE_URL ?? "").replace(/\/+$/, "");
const key = env.SUPABASE_PUBLISHABLE_KEY ?? "";
if (!url.startsWith("https://") || !key) {
  console.error("SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY missing in the root .env");
  process.exit(1);
}
// A publishable key starts sb_publishable_ (or is the legacy anon JWT); refuse anything that looks secret.
if (key.startsWith("sb_secret_") || /service_role/.test(Buffer.from(key.split(".")[1] ?? "", "base64url").toString())) {
  console.error("That key is a secret key, not the publishable one. Nothing written.");
  process.exit(1);
}

let src = readFileSync(target, "utf8");
const put = (marker, value) => {
  const re = new RegExp(`(\\w+: )"[^"]*"(, \\/\\/ supabase:${marker})`);
  if (!re.test(src)) throw new Error(`marker supabase:${marker} not found in app.ts`);
  src = src.replace(re, `$1${JSON.stringify(value)}$2`);
};
put("url", url);
put("publishableKey", key);
writeFileSync(target, src);
console.log(`app.ts: url ${url.length} chars, publishable key ${key.length} chars`);
