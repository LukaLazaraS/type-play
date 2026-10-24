// Deploys TypePlay: the site (typeplay.app) and the API (api.typeplay.app) to Hetzner servers, the
// games (typeplay.dev) to R2.
//   node deploy/deploy.mjs setup    once (safe to re-run): SSH key, firewall, server, DNS, HTTPS, R2 bucket + domain
//   node deploy/deploy.mjs site     build the site on the server and switch to it
//   node deploy/deploy.mjs games    upload apps/games to R2 (apps/games/scripts/publish.mjs)
//   node deploy/deploy.mjs status   servers, addresses, live checks
//   node deploy/deploy.mjs ssh [command]   a shell (or one command) on the site's server
//   node deploy/deploy.mjs api-setup [--type cpx32] --yes   once: the API server, its firewall and DNS (costs money)
//   node deploy/deploy.mjs api-assets [--dry]   upload the 3D model library the catalogue uses (once, ~1.7 GB)
//   node deploy/deploy.mjs api [--force]   build the API on its server and switch to it
//   node deploy/deploy.mjs api-ssh [command]   a shell (or one command) on the API server
//   node deploy/deploy.mjs android-key   once: ANDROID_KEY_MASTER into the root .env (never printed); Luka copies it to his password manager
// Keys come from the root .env (deploy/README.md).
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, posix, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
process.loadEnvFile(join(repo, ".env"));
const env = process.env;

const SERVER = { name: "typeplay-web", type: "cx23", location: "fsn1", image: "ubuntu-24.04", role: "web" };
// The API server (docs/server-proposal.md: a CPX32 for beta 1; `api-setup --type cx33` if one is in stock).
const API_SERVER = { name: "typeplay-api", type: "cpx32", location: "fsn1", image: "ubuntu-24.04", role: "api" };
const SITE = "typeplay.app";
const API_HOST = `api.${SITE}`;
const API_DIR = "/opt/typeplay-api";
const GAMES = "typeplay.dev";
const BUCKET = "typeplay-games";
// Signed Android builds (private, no custom domain, presigned links; ANDROID_STORE=r2 in api/compose.yaml).
const EXPORTS_BUCKET = "typeplay-exports";
const EXPORTS_DAYS = 30;
const KEY = join(homedir(), ".ssh", "typeplay");
const KNOWN_HOSTS = join(homedir(), ".ssh", "typeplay_known_hosts");
const BUILD = join(import.meta.dirname, ".build");
const API_BUILD = join(import.meta.dirname, ".build-api");
// The only keys that go to the API server (its api.env). Never the Hetzner or Cloudflare API tokens,
// the Supabase secret key, the database password or the Google client secret.
const API_KEYS = ["DATABASE_URL", "DIRECT_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY",
  "CLOUDFLARE_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "ANTHROPIC_API_KEY",
  // Android export (package 7): the master key the upload keystores are encrypted under (`android-key` makes it).
  "ANDROID_KEY_MASTER", "ANDROID_KEY_MASTER_PREV"];
const OPTIONAL_API_KEYS = ["ANDROID_KEY_MASTER_PREV"];
// Paddle (payments): the server gets these names in api.env, from the root .env's PADDLE_LIVE_* (PADDLE_ENV "live" in
// api/compose.yaml) or PADDLE_SANDBOX_* ("sandbox": the live site's sandbox, ADMIN_EMAILS only); with "" none goes.
// Names no code on this PC reads, so development (its own sandbox keys in .env.local) and the tests never get a real key.
const PADDLE_KEYS = ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET", "PADDLE_WEBHOOK_SECRET_PREVIOUS"];
const paddleSource = (envName, key) => key.replace(/^PADDLE_/, `PADDLE_${envName.toUpperCase()}_`);

const log = (...a) => console.log("·", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- APIs ---------------------------------------------------------------------------------------

async function hetzner(method, path, body) {
  const res = await fetch("https://api.hetzner.cloud/v1" + path, {
    method,
    headers: { authorization: `Bearer ${env.HETZNER_TOKEN}`, "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const json = res.status === 204 ? {} : await res.json();
  if (!res.ok) throw new Error(`Hetzner ${method} ${path}: ${res.status} ${JSON.stringify(json.error ?? json)}`);
  return json;
}

async function cloudflare(method, path, body, { allow404 = false } = {}) {
  const res = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method,
    headers: { authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const json = await res.json();
  if (allow404 && res.status === 404) return null;
  if (!json.success) throw new Error(`Cloudflare ${method} ${path}: ${res.status} ${JSON.stringify(json.errors)}`);
  return json.result;
}

const zoneId = async (name) => (await cloudflare("GET", `/zones?name=${name}`))[0].id;
const findServer = async (spec = SERVER) => (await hetzner("GET", `/servers?name=${spec.name}`)).servers[0];

// --- SSH ----------------------------------------------------------------------------------------

const sshArgs = (ip) => ["-i", KEY, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new",
  "-o", `UserKnownHostsFile=${KNOWN_HOSTS}`, "-o", "ConnectTimeout=10", `root@${ip}`];

function ssh(ip, command, { quiet = false } = {}) {
  const r = spawnSync("ssh", [...sshArgs(ip), command], { stdio: quiet ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0 && !quiet) throw new Error(`ssh failed (${r.status}): ${command}`);
  return r;
}

/** One command on the server with `input` on its stdin (secrets: never on the command line, never printed). */
function sshInput(ip, command, input) {
  const r = spawnSync("ssh", [...sshArgs(ip), command], { input, stdio: ["pipe", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ssh failed (${r.status}): ${command}`);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status ?? r.error})`);
}

async function serverIp(spec = SERVER) {
  const server = await findServer(spec);
  if (!server) throw new Error(`no server "${spec.name}": run ${spec === API_SERVER ? "api-setup" : "setup"} first`);
  return server.public_net.ipv4.ip;
}

// --- setup --------------------------------------------------------------------------------------

async function sshKey() {
  if (!existsSync(KEY)) {
    log(`creating SSH key ${KEY}`);
    run("ssh-keygen", ["-t", "ed25519", "-N", "", "-C", "typeplay-deploy", "-f", KEY], { stdio: "pipe" });
  }
  const publicKey = readFileSync(KEY + ".pub", "utf8").trim();
  const existing = (await hetzner("GET", "/ssh_keys?name=typeplay-deploy")).ssh_keys[0];
  if (existing) {
    if (existing.public_key.split(" ").slice(0, 2).join(" ") !== publicKey.split(" ").slice(0, 2).join(" ")) {
      throw new Error("Hetzner has a different SSH key named typeplay-deploy: delete it there or restore ~/.ssh/typeplay");
    }
    return existing.id;
  }
  log("uploading SSH key to Hetzner");
  return (await hetzner("POST", "/ssh_keys", { name: "typeplay-deploy", public_key: publicKey })).ssh_key.id;
}

// SSH from anywhere (keys only); web traffic only from Cloudflare, so the server's address stays private.
async function firewall(spec = SERVER) {
  const ips = await (await fetch("https://api.cloudflare.com/client/v4/ips")).json();
  const cloudflareIps = [...ips.result.ipv4_cidrs, ...ips.result.ipv6_cidrs];
  const anywhere = ["0.0.0.0/0", "::/0"];
  const rules = [
    { description: "ssh", direction: "in", protocol: "tcp", port: "22", source_ips: anywhere },
    { description: "http from Cloudflare", direction: "in", protocol: "tcp", port: "80", source_ips: cloudflareIps },
    { description: "https from Cloudflare", direction: "in", protocol: "tcp", port: "443", source_ips: cloudflareIps },
    { description: "ping", direction: "in", protocol: "icmp", source_ips: anywhere },
  ];
  const existing = (await hetzner("GET", `/firewalls?name=${spec.name}`)).firewalls[0];
  if (existing) {
    await hetzner("POST", `/firewalls/${existing.id}/actions/set_rules`, { rules });
    log(`firewall ${spec.name}: rules refreshed (${cloudflareIps.length} Cloudflare ranges)`);
    return existing.id;
  }
  log(`creating firewall ${spec.name}`);
  return (await hetzner("POST", "/firewalls", { name: spec.name, rules, labels: { project: "typeplay" } })).firewall.id;
}

async function server(keyId, firewallId, spec = SERVER) {
  let s = await findServer(spec);
  if (!s) {
    log(`creating server ${spec.name} (${spec.type}, ${spec.location})`);
    s = (await hetzner("POST", "/servers", {
      name: spec.name,
      server_type: spec.type,
      location: spec.location,
      image: spec.image,
      ssh_keys: [keyId],
      firewalls: [{ firewall: firewallId }],
      user_data: readFileSync(join(import.meta.dirname, "server", "cloud-init.yaml"), "utf8"),
      labels: { project: "typeplay", role: spec.role },
      public_net: { enable_ipv4: true, enable_ipv6: true },
    })).server;
    spawnSync("ssh-keygen", ["-R", s.public_net.ipv4.ip, "-f", KNOWN_HOSTS], { stdio: "ignore" });
  }
  while (s.status !== "running") {
    await sleep(3000);
    s = await findServer(spec);
  }
  log(`server running: ${s.public_net.ipv4.ip}`);
  return s;
}

async function upsertRecord(zone, record) {
  const [existing] = await cloudflare("GET", `/zones/${zone}/dns_records?type=${record.type}&name=${record.name}`);
  if (existing && existing.content === record.content && existing.proxied === record.proxied) return;
  if (existing) await cloudflare("PUT", `/zones/${zone}/dns_records/${existing.id}`, record);
  else await cloudflare("POST", `/zones/${zone}/dns_records`, record);
  log(`DNS ${record.type} ${record.name} → ${record.content}`);
}

async function dns(s) {
  const zone = await zoneId(SITE);
  const ipv6 = s.public_net.ipv6.ip.replace(/\/\d+$/, "").replace(/::$/, "::1");
  await upsertRecord(zone, { type: "A", name: SITE, content: s.public_net.ipv4.ip, proxied: true, ttl: 1 });
  await upsertRecord(zone, { type: "AAAA", name: SITE, content: ipv6, proxied: true, ttl: 1 });
  await upsertRecord(zone, { type: "CNAME", name: `www.${SITE}`, content: SITE, proxied: true, ttl: 1 });
}

// Cloudflare checks the server's certificate ("Full (strict)"). "Always use HTTPS" stays off on the
// site: Caddy redirects to HTTPS itself and needs plain http on port 80 for certificate renewals.
async function https() {
  for (const name of [SITE, GAMES]) {
    const zone = await zoneId(name);
    await cloudflare("PATCH", `/zones/${zone}/settings/ssl`, { value: "strict" });
    await cloudflare("PATCH", `/zones/${zone}/settings/min_tls_version`, { value: "1.2" });
  }
  await cloudflare("PATCH", `/zones/${await zoneId(GAMES)}/settings/always_use_https`, { value: "on" });
  log("HTTPS: Full (strict), TLS 1.2+ on both domains");
}

async function r2() {
  const base = `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`;
  if (!(await cloudflare("GET", `${base}/${BUCKET}`, undefined, { allow404: true }))) {
    log(`creating R2 bucket ${BUCKET}`);
    await cloudflare("POST", base, { name: BUCKET, locationHint: "weur" });
  }
  const { domains } = await cloudflare("GET", `${base}/${BUCKET}/domains/custom`);
  if (!domains.some((d) => d.domain === GAMES)) {
    log(`connecting ${GAMES} to the bucket`);
    await cloudflare("POST", `${base}/${BUCKET}/domains/custom`, {
      domain: GAMES, zoneId: await zoneId(GAMES), enabled: true, minTLS: "1.2",
    });
  }
  log(`R2: ${BUCKET} on https://${GAMES}`);
}

async function waitForBoot(ip) {
  log("waiting for the server's first boot (updates + Docker, ~3 min)");
  for (let i = 0; i < 60; i++) {
    if (ssh(ip, "true", { quiet: true }).status === 0) break;
    await sleep(5000);
  }
  ssh(ip, "cloud-init status --wait >/dev/null; cloud-init status; docker --version; docker compose version");
}

async function setup() {
  const keyId = await sshKey();
  const firewallId = await firewall();
  const s = await server(keyId, firewallId);
  await dns(s);
  await https();
  await r2();
  await waitForBoot(s.public_net.ipv4.ip);
  log("setup done: next `node deploy/deploy.mjs games` and `node deploy/deploy.mjs site`");
}

// --- site ---------------------------------------------------------------------------------------

async function site() {
  const ip = await serverIp();
  log("packing the site (turbo prune web)");
  rmSync(BUILD, { recursive: true, force: true });
  mkdirSync(BUILD, { recursive: true });
  run("npx", ["turbo", "prune", "web", "--docker", "--out-dir", "deploy/.build/src"], { cwd: repo, stdio: "pipe", shell: true });
  cpSync(join(import.meta.dirname, "server", "Dockerfile"), join(BUILD, "src", "Dockerfile"));
  cpSync(join(import.meta.dirname, "server", "compose.yaml"), join(BUILD, "compose.yaml"));
  cpSync(join(import.meta.dirname, "server", "caddy"), join(BUILD, "caddy"), { recursive: true });
  run("tar", ["-czf", "../release.tgz", "."], { cwd: BUILD });

  log(`uploading to ${ip}`);
  run("scp", [...sshArgs(ip).slice(0, -1), join(BUILD, "..", "release.tgz"), `root@${ip}:/opt/typeplay/release.tgz`]);
  rmSync(join(BUILD, "..", "release.tgz"));
  log("building on the server and switching (the old version serves until the new one is up)");
  ssh(ip, [
    "set -e",
    "cd /opt/typeplay",
    "rm -rf src && tar -xzf release.tgz && rm release.tgz",
    "docker compose up -d --build --remove-orphans",
    "docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile",
    "docker image prune -f >/dev/null",
  ].join(" && "));
  await check(`https://${SITE}/`, 20);
  await indexNow();
}

// Tells Bing, Yandex, Naver and Seznam that the sitemap's pages may have changed (IndexNow; Google
// doesn't take part, it reads the sitemap in Search Console). The key is public by design: it is
// the file apps/web/public/<key>.txt that proves the site is ours.
const INDEXNOW_KEY = "55500354baed5d4122f52d78448b595d";
async function indexNow() {
  try {
    const xml = await (await fetch(`https://${SITE}/sitemap.xml`)).text();
    const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: SITE, key: INDEXNOW_KEY, keyLocation: `https://${SITE}/${INDEXNOW_KEY}.txt`, urlList }),
    });
    log(`IndexNow: ${urlList.length} pages announced (${res.status})`);
  } catch (e) {
    log(`IndexNow skipped: ${e.message}`);
  }
}

async function check(url, tries = 1) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.ok) return log(`${res.status} ${url}`);
      if (i === tries - 1) return log(`${res.status} ${url}  ← not OK`);
    } catch (e) {
      if (i === tries - 1) return log(`${url} failed: ${e.cause?.code ?? e.message}`);
    }
    await sleep(5000);
  }
}

const describe = (s) =>
  `${s.name}: ${s.status}, ${s.server_type.name} in ${(s.location ?? s.datacenter?.location)?.name}, ${s.public_net.ipv4.ip}, ${s.public_net.ipv6.ip}`;

async function status() {
  const s = await findServer();
  if (!s) return log("no server yet: run setup");
  log(describe(s));
  for (const path of ["", "pricing", "terms", "privacy", "refunds"]) await check(`https://${SITE}/${path}`);
  await check(`https://${GAMES}/play.html?g=robot-runner`);
  const a = await findServer(API_SERVER);
  if (!a) return log("no API server yet (api-setup)");
  log(describe(a));
  const h = await apiHealth();
  log(h ? `https://${API_HOST}/health: ${JSON.stringify(h)}` : `https://${API_HOST}/health  ← not answering`);
}

// --- API (api.typeplay.app) -----------------------------------------------------------------------

const flagValue = (name) => {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
};

async function apiHealth() {
  try {
    const res = await fetch(`https://${API_HOST}/health`);
    return res.ok || res.status === 503 ? await res.json() : null;
  } catch {
    return null;
  }
}

// Once: the API server, its firewall and DNS. It creates a paid server, so it asks for --yes.
// The zone's HTTPS settings (Full strict, TLS 1.2) are the site's, already set by `setup`.
async function apiSetup() {
  if (flagValue("--type")) API_SERVER.type = flagValue("--type");
  if (!(await findServer(API_SERVER)) && !rest.includes("--yes")) {
    console.log([
      `This creates a paid Hetzner server: ${API_SERVER.type} "${API_SERVER.name}" in ${API_SERVER.location}`,
      `(CPX32: €35.49 / $41.99 a month + $0.60 for IPv4, docs/server-proposal.md), its firewall, and DNS ${API_HOST} → it.`,
      "Run it again with --yes to go ahead (--type cx33 for the cheaper box if Hetzner has it in stock).",
    ].join("\n"));
    return;
  }
  const keyId = await sshKey();
  const firewallId = await firewall(API_SERVER);
  const s = await server(keyId, firewallId, API_SERVER);
  const zone = await zoneId(SITE);
  const ipv6 = s.public_net.ipv6.ip.replace(/\/\d+$/, "").replace(/::$/, "::1");
  await upsertRecord(zone, { type: "A", name: API_HOST, content: s.public_net.ipv4.ip, proxied: true, ttl: 1 });
  await upsertRecord(zone, { type: "AAAA", name: API_HOST, content: ipv6, proxied: true, ttl: 1 });
  await waitForBoot(s.public_net.ipv4.ip);
  ssh(s.public_net.ipv4.ip, `mkdir -p ${API_DIR}/data ${API_DIR}/assets`);
  await exportsBucket();
  log("API server ready: next `node deploy/deploy.mjs api-assets` (once) and `node deploy/deploy.mjs api`");
}

// The private bucket for signed Android builds: no custom domain (presigned links only), objects
// deleted 30 days after they are written (the API's hourly sweep expires them first; this is the
// backstop). Safe to re-run. Until it exists, api/compose.yaml keeps ANDROID_STORE=folder (/data/android).
async function exportsBucket() {
  const base = `/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/r2/buckets`;
  if (!(await cloudflare("GET", `${base}/${EXPORTS_BUCKET}`, undefined, { allow404: true }))) {
    log(`creating private R2 bucket ${EXPORTS_BUCKET}`);
    await cloudflare("POST", base, { name: EXPORTS_BUCKET, locationHint: "weur" });
  }
  await cloudflare("PUT", `${base}/${EXPORTS_BUCKET}/lifecycle`, {
    rules: [{ id: "expire-builds", enabled: true, conditions: { prefix: "" }, deleteObjectsTransition: { condition: { type: "Age", maxAge: EXPORTS_DAYS * 86400 } } }],
  });
  log(`R2: ${EXPORTS_BUCKET} (private, objects deleted after ${EXPORTS_DAYS} days); set ANDROID_STORE: r2 in deploy/api/compose.yaml to use it`);
}

// ANDROID_KEY_MASTER: 32 random bytes as 64 hex chars, written into the root .env if absent. Never
// printed (only its length). Losing it means a Play upload-key reset for every game: Luka copies it
// from .env into his password manager.
function androidKey() {
  const file = join(repo, ".env");
  if (env.ANDROID_KEY_MASTER) {
    if (!/^[0-9a-f]{64}$/i.test(env.ANDROID_KEY_MASTER)) throw new Error("ANDROID_KEY_MASTER in .env is not 64 hex chars: fix it by hand (the API refuses it)");
    return log(`ANDROID_KEY_MASTER is already in .env (${env.ANDROID_KEY_MASTER.length} chars); nothing changed`);
  }
  const key = randomBytes(32).toString("hex");
  const text = existsSync(file) ? readFileSync(file, "utf8") : "";
  appendFileSync(file, `${text && !text.endsWith("\n") ? "\n" : ""}ANDROID_KEY_MASTER=${key}\n`);
  log(`ANDROID_KEY_MASTER written to .env (${key.length} chars). Copy that line into your password manager now: without it every game's Android key is lost.`);
}

// The server's secrets file (api.env, mode 600): only API_KEYS, checked before anything is uploaded.
function apiEnv() {
  const compose = readFileSync(join(import.meta.dirname, "api", "compose.yaml"), "utf8");
  // The Android master key is needed only while Android export is on (ANDROID_EXPORT in api/compose.yaml).
  const androidOn = /ANDROID_EXPORT: "1"/.test(compose);
  const optional = androidOn ? OPTIONAL_API_KEYS : [...OPTIONAL_API_KEYS, "ANDROID_KEY_MASTER"];
  const missing = API_KEYS.filter((k) => !env[k] && !optional.includes(k));
  if (missing.includes("ANTHROPIC_API_KEY")) {
    throw new Error("ANTHROPIC_API_KEY is not in the root .env yet: create the key in the Anthropic Console " +
      "(the API account, parked #6), paste it into .env as ANTHROPIC_API_KEY=..., then run this again.");
  }
  if (missing.includes("ANDROID_KEY_MASTER")) {
    throw new Error("Android export is on (ANDROID_EXPORT: \"1\" in deploy/api/compose.yaml) but ANDROID_KEY_MASTER is not in .env: " +
      "run `node deploy/deploy.mjs android-key` and save the key in your password manager, or set ANDROID_EXPORT back to \"0\".");
  }
  if (missing.length) throw new Error(`the root .env is missing ${missing.join(", ")}`);
  if (/^sk-ant-oat/i.test(env.ANTHROPIC_API_KEY)) {
    throw new Error("ANTHROPIC_API_KEY holds a Claude subscription token (sk-ant-oat…), not an API key: a Claude login never goes on the server.");
  }
  // Billing on the server follows PADDLE_ENV in api/compose.yaml: "" (off: no Paddle key goes), "live" or "sandbox"
  // (that account's key and webhook secret, from PADDLE_LIVE_* / PADDLE_SANDBOX_* in the root .env). A key goes only
  // with its webhook secret and only when its prefix matches (the API checks the same at start and refuses a mismatch).
  const composeEnv = /PADDLE_ENV: "(\w*)"/.exec(compose)?.[1] || null;
  const paddle = {};
  if (composeEnv) {
    for (const k of PADDLE_KEYS) if (env[paddleSource(composeEnv, k)]) paddle[k] = env[paddleSource(composeEnv, k)];
    const [keyName, secretName] = PADDLE_KEYS.map((k) => paddleSource(composeEnv, k));
    if (!paddle.PADDLE_API_KEY) throw new Error(`deploy/api/compose.yaml says PADDLE_ENV: "${composeEnv}", but the root .env has no ${keyName} (docs/beta/runbook.md "Go paid").`);
    if (!paddle.PADDLE_WEBHOOK_SECRET) throw new Error(`${keyName} is in .env without ${secretName}: add the notification destination's secret (apps/server/README.md 'Billing').`);
    const keyEnv = /^pdl_live_/.test(paddle.PADDLE_API_KEY) ? "live" : /^pdl_sdbx_/.test(paddle.PADDLE_API_KEY) ? "sandbox" : null;
    if (keyEnv !== composeEnv) {
      throw new Error(`${keyName} in .env is a ${keyEnv ?? "non-Paddle"} key but deploy/api/compose.yaml says PADDLE_ENV: "${composeEnv}": the API would refuse to start.`);
    }
  } else if (Object.keys(env).some((k) => /^PADDLE_(LIVE|SANDBOX)_/.test(k))) {
    log("billing is off on the server (PADDLE_ENV: \"\" in deploy/api/compose.yaml): no Paddle key goes to it");
  }
  const lines = [...API_KEYS.filter((k) => env[k]).map((k) => [k, env[k]]), ...Object.entries(paddle)];
  return lines.map(([k, v]) => {
    if (/['\r\n]/.test(v)) throw new Error(`${k} has a quote or a line break: api.env can't hold it`);
    return `${k}='${v}'`; // single quotes: Docker Compose takes the value literally
  }).join("\n") + "\n";
}

async function api() {
  const envFile = apiEnv();
  const ip = await serverIp(API_SERVER);
  const health = await apiHealth();
  if (health?.runs > 0 && !rest.includes("--force")) {
    throw new Error(`${health.runs} build(s) running: a deploy restarts the runner and stops them (players are not charged). ` +
      "Wait a few minutes, or run again with --force.");
  }
  if (health?.android?.running > 0 && !rest.includes("--force")) {
    throw new Error(`${health.android.running} Android build(s) running: a deploy restarts the runner and stops them. Wait a few minutes, or run again with --force.`);
  }
  log("packing the API (turbo prune @typeplay/server @typeplay/agent @typeplay/shared)");
  rmSync(API_BUILD, { recursive: true, force: true });
  mkdirSync(API_BUILD, { recursive: true });
  run("npx", ["turbo", "prune", "@typeplay/server", "@typeplay/agent", "@typeplay/shared", "--docker", "--out-dir", "deploy/.build-api/src"],
    { cwd: repo, stdio: "pipe", shell: true });
  // This PC's run records stay here; the server keeps its own (data/agent-logs).
  for (const f of ["runs.jsonl", "learn/errors.jsonl"]) rmSync(join(API_BUILD, "src", "full", "packages", "agent", f), { force: true });
  cpSync(join(import.meta.dirname, "api", "Dockerfile"), join(API_BUILD, "src", "Dockerfile"));
  cpSync(join(import.meta.dirname, "api", "android"), join(API_BUILD, "src", "android"), { recursive: true }); // the seed's files, next to the Dockerfile
  cpSync(join(import.meta.dirname, "api", "compose.yaml"), join(API_BUILD, "compose.yaml"));
  cpSync(join(import.meta.dirname, "api", "caddy"), join(API_BUILD, "caddy"), { recursive: true });
  const tgz = join(import.meta.dirname, "release-api.tgz");
  run("tar", ["-czf", "../release-api.tgz", "."], { cwd: API_BUILD });

  log(`uploading to ${ip}`);
  run("scp", [...sshArgs(ip).slice(0, -1), tgz, `root@${ip}:${API_DIR}/release.tgz`]);
  rmSync(tgz);
  log("writing api.env on the server (only the keys the API needs)");
  sshInput(ip, `umask 077 && mkdir -p ${API_DIR} && cat > ${API_DIR}/api.env`, envFile);
  log("building on the server and switching (the first build downloads Godot, its templates and the Android toolchain, ~1.5 GB, and warms the Gradle seed: 10-15 minutes)");
  ssh(ip, [
    "set -e",
    `cd ${API_DIR}`,
    "rm -rf src && tar -xzf release.tgz && rm release.tgz",
    "mkdir -p data assets",
    "docker compose up -d --build --remove-orphans --wait",
    "docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile",
    "docker image prune -f >/dev/null",
  ].join(" && "));
  await check(`https://${API_HOST}/health`, 24);
  // The live API must run the real agent on our key: a fake-run server would charge credits for demo builds.
  const live = await apiHealth();
  if (live?.agent !== "api") throw new Error(`https://${API_HOST}/health says agent: ${JSON.stringify(live?.agent)} (must be "api"): check AGENT_AUTH and AGENT_FAKE in the api service`);
  log(`agent: ${live.agent}, runner: ${live.runner}`);
}

// The 3D model library: only the files the catalogue points at (models, their textures, previews,
// licences: ~14,000 files, ~1.7 GB), streamed from Luka's library into the server's assets/ folder
// (the runner's read-only /assets, ASSET_LIBRARY). Again after the catalogue grows.
async function apiAssets() {
  const catalogue = JSON.parse(readFileSync(join(repo, "packages", "agent", "assets", "catalogue.json"), "utf8"));
  const library = flagValue("--from") || env.ASSET_LIBRARY || catalogue.root;
  const files = new Set();
  for (const m of catalogue.models) {
    files.add(m.path);
    for (const f of m.deps ?? []) files.add(m.moved?.[f] ?? posix.join(posix.dirname(m.path), f));
    if (m.preview) files.add(m.preview);
  }
  for (const p of Object.values(catalogue.packs)) for (const f of [p.preview, p.licenseFile]) if (f) files.add(f);
  const list = [...files].filter((f) => existsSync(join(library, f)));
  const bytes = list.reduce((n, f) => n + statSync(join(library, f)).size, 0);
  log(`${list.length} files, ${(bytes / 1e9).toFixed(2)} GB from ${library}` + (files.size > list.length ? ` (${files.size - list.length} missing)` : ""));
  if (rest.includes("--dry")) return;
  const ip = await serverIp(API_SERVER);
  mkdirSync(API_BUILD, { recursive: true });
  const listFile = join(API_BUILD, "assets.txt").replaceAll("\\", "/");
  writeFileSync(listFile, list.join("\n") + "\n");
  log(`uploading to ${ip}:${API_DIR}/assets in one stream (~${Math.ceil(bytes / 2.5e6 / 60)} min at 20 Mbit/s)`);
  await new Promise((resolve, reject) => {
    const tar = spawn("tar", ["-cf", "-", "-T", listFile], { cwd: library, stdio: ["ignore", "pipe", "inherit"] });
    const remote = spawn("ssh", [...sshArgs(ip), `mkdir -p ${API_DIR}/assets && tar -xf - -C ${API_DIR}/assets && chmod -R a+rX ${API_DIR}/assets`],
      { stdio: ["pipe", "inherit", "inherit"] });
    tar.stdout.pipe(remote.stdin);
    let left = 2;
    const done = (name) => (code) => (code !== 0 ? reject(new Error(`${name} failed (${code})`)) : --left === 0 && resolve());
    tar.on("close", done("tar"));
    remote.on("close", done("ssh"));
  });
  rmSync(listFile, { force: true });
  log("library uploaded: the runner reads it at /assets");
}

// --- main ---------------------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);
const commands = {
  setup,
  site,
  status,
  games: () => run("node", ["scripts/publish.mjs", ...rest], { cwd: join(repo, "apps", "games") }),
  ssh: async () => spawnSync("ssh", [...sshArgs(await serverIp()), ...rest], { stdio: "inherit" }),
  "api-setup": apiSetup,
  "api-assets": apiAssets,
  api,
  "api-ssh": async () => spawnSync("ssh", [...sshArgs(await serverIp(API_SERVER)), ...rest], { stdio: "inherit" }),
  "android-key": androidKey,
};
if (!commands[command]) {
  console.log("usage: node deploy/deploy.mjs setup | site | games | status | ssh [command] | api-setup [--yes] | api-assets [--dry] | api [--force] | api-ssh [command] | android-key");
  process.exit(1);
}
try {
  await commands[command]();
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
