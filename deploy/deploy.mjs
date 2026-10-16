// Deploys TypePlay: the site (typeplay.app) to the Hetzner server, the games (typeplay.dev) to R2.
//   node deploy/deploy.mjs setup    once (safe to re-run): SSH key, firewall, server, DNS, HTTPS, R2 bucket + domain
//   node deploy/deploy.mjs site     build the site on the server and switch to it
//   node deploy/deploy.mjs games    upload apps/games to R2 (apps/games/scripts/publish.mjs)
//   node deploy/deploy.mjs status   server, addresses, live checks
//   node deploy/deploy.mjs ssh [command]   a shell (or one command) on the server
// Keys come from the root .env (deploy/README.md).
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const repo = resolve(import.meta.dirname, "..");
process.loadEnvFile(join(repo, ".env"));
const env = process.env;

const SERVER = { name: "typeplay-web", type: "cx23", location: "fsn1", image: "ubuntu-24.04" };
const SITE = "typeplay.app";
const GAMES = "typeplay.dev";
const BUCKET = "typeplay-games";
const KEY = join(homedir(), ".ssh", "typeplay");
const KNOWN_HOSTS = join(homedir(), ".ssh", "typeplay_known_hosts");
const BUILD = join(import.meta.dirname, ".build");

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
const findServer = async () => (await hetzner("GET", `/servers?name=${SERVER.name}`)).servers[0];

// --- SSH ----------------------------------------------------------------------------------------

const sshArgs = (ip) => ["-i", KEY, "-o", "IdentitiesOnly=yes", "-o", "StrictHostKeyChecking=accept-new",
  "-o", `UserKnownHostsFile=${KNOWN_HOSTS}`, "-o", "ConnectTimeout=10", `root@${ip}`];

function ssh(ip, command, { quiet = false } = {}) {
  const r = spawnSync("ssh", [...sshArgs(ip), command], { stdio: quiet ? "pipe" : "inherit", encoding: "utf8" });
  if (r.status !== 0 && !quiet) throw new Error(`ssh failed (${r.status}): ${command}`);
  return r;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status ?? r.error})`);
}

async function serverIp() {
  const server = await findServer();
  if (!server) throw new Error(`no server "${SERVER.name}": run setup first`);
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
async function firewall() {
  const ips = await (await fetch("https://api.cloudflare.com/client/v4/ips")).json();
  const cloudflareIps = [...ips.result.ipv4_cidrs, ...ips.result.ipv6_cidrs];
  const anywhere = ["0.0.0.0/0", "::/0"];
  const rules = [
    { description: "ssh", direction: "in", protocol: "tcp", port: "22", source_ips: anywhere },
    { description: "http from Cloudflare", direction: "in", protocol: "tcp", port: "80", source_ips: cloudflareIps },
    { description: "https from Cloudflare", direction: "in", protocol: "tcp", port: "443", source_ips: cloudflareIps },
    { description: "ping", direction: "in", protocol: "icmp", source_ips: anywhere },
  ];
  const existing = (await hetzner("GET", `/firewalls?name=${SERVER.name}`)).firewalls[0];
  if (existing) {
    await hetzner("POST", `/firewalls/${existing.id}/actions/set_rules`, { rules });
    log(`firewall rules refreshed (${cloudflareIps.length} Cloudflare ranges)`);
    return existing.id;
  }
  log("creating firewall");
  return (await hetzner("POST", "/firewalls", { name: SERVER.name, rules, labels: { project: "typeplay" } })).firewall.id;
}

async function server(keyId, firewallId) {
  let s = await findServer();
  if (!s) {
    log(`creating server ${SERVER.name} (${SERVER.type}, ${SERVER.location})`);
    s = (await hetzner("POST", "/servers", {
      name: SERVER.name,
      server_type: SERVER.type,
      location: SERVER.location,
      image: SERVER.image,
      ssh_keys: [keyId],
      firewalls: [{ firewall: firewallId }],
      user_data: readFileSync(join(import.meta.dirname, "server", "cloud-init.yaml"), "utf8"),
      labels: { project: "typeplay", role: "web" },
      public_net: { enable_ipv4: true, enable_ipv6: true },
    })).server;
    spawnSync("ssh-keygen", ["-R", s.public_net.ipv4.ip, "-f", KNOWN_HOSTS], { stdio: "ignore" });
  }
  while (s.status !== "running") {
    await sleep(3000);
    s = await findServer();
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

async function status() {
  const s = await findServer();
  if (!s) return log("no server yet: run setup");
  log(`${s.name}: ${s.status}, ${s.server_type.name} in ${(s.location ?? s.datacenter?.location)?.name}, ${s.public_net.ipv4.ip}, ${s.public_net.ipv6.ip}`);
  for (const path of ["", "pricing", "terms", "privacy", "refunds"]) await check(`https://${SITE}/${path}`);
  await check(`https://${GAMES}/play.html?g=robot-runner`);
}

// --- main ---------------------------------------------------------------------------------------

const [command, ...rest] = process.argv.slice(2);
const commands = {
  setup,
  site,
  status,
  games: () => run("node", ["scripts/publish.mjs", ...rest], { cwd: join(repo, "apps", "games") }),
  ssh: async () => spawnSync("ssh", [...sshArgs(await serverIp()), ...rest], { stdio: "inherit" }),
};
if (!commands[command]) {
  console.log("usage: node deploy/deploy.mjs setup | site | games | status | ssh [command]");
  process.exit(1);
}
await commands[command]();
