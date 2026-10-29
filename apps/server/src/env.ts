// Settings, read once at startup. On Luka's PC from the repo's env files (env-files.ts: a local database from the
// committed .env.development or .env.autotest, the secrets from the git-ignored root .env), on the live server from the
// container's environment; the variables set in the shell win over the files. Never log the values.
import { createECDH } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { assertLocalDatabase, envMode, loadEnvFiles } from "./env-files.js";

/** The repo root (this file lives in apps/server/src or apps/server/dist). */
export const ROOT = resolve(import.meta.dirname, "../../..");

/** development, autotest, live (the admin CLI on the live database) or production (the live server). */
export const ENV_MODE = envMode();
/** Key names defined in the env files read: kept out of the game agent's environment (it can run shell commands). */
export const ENV_FILE_KEYS = loadEnvFiles(ROOT, ENV_MODE);
// Development and tests on this PC never reach the live database.
assertLocalDatabase(process.env.DATABASE_URL, ENV_MODE);

const env = process.env;
const num = (v: string | undefined, fallback: number) => (v && Number.isFinite(Number(v)) ? Number(v) : fallback);
/** A small text file's first line, or "" when it is not there. */
const readIfThere = (file: string) => {
  try {
    return readFileSync(file, "utf8").split("\n")[0].trim().slice(0, 200);
  } catch {
    return "";
  }
};

export const config = {
  port: num(env.PORT, 3002),
  host: env.HOST || "127.0.0.1",
  production: env.NODE_ENV === "production",
  /** Dev-only test sign-in: `Authorization: Bearer dev:<email>`. Refused in production. */
  devAuth: env.DEV_AUTH === "1",
  /** Simulated runs instead of the game agent (site development, tests). */
  agentFake: env.AGENT_FAKE === "1",
  /** Tests only (FAKE_METER=1, with AGENT_FAKE=1 and AGENT_AUTH=api, so never in production): fake runs make their model
   * calls through the key proxy (to ANTHROPIC_UPSTREAM, a mock), so the e2e sees what the live server meters. */
  fakeMeter: env.AGENT_FAKE === "1" && env.FAKE_METER === "1",
  /** Who pays for the game agent: `max` = the Claude Code login on Luka's PC (dev only), `api` = our
   * API key, added by the key proxy (src/runs/key-proxy.ts); the agent never sees the key. */
  agentAuth: (env.AGENT_AUTH === "api" ? "api" : "max") as "api" | "max",
  anthropicApiKey: env.ANTHROPIC_API_KEY || "",
  keyProxy: {
    /** Where the proxy listens: 127.0.0.1 on the PC; 0.0.0.0 in the api container (internal network only). */
    host: env.KEY_PROXY_HOST || "127.0.0.1",
    port: num(env.KEY_PROXY_PORT, 8787),
    /** The address the agent is given as ANTHROPIC_BASE_URL (http://api:8787 from the runner container). */
    url: (env.KEY_PROXY_URL || `http://127.0.0.1:${num(env.KEY_PROXY_PORT, 8787)}`).replace(/\/+$/, ""),
    /** Where the proxy forwards to (a mock in tests). */
    upstream: (env.ANTHROPIC_UPSTREAM || "https://api.anthropic.com").replace(/\/+$/, ""),
  },
  /** Set on the live server: game agent runs, Godot exports and git in game folders go to the runner
   * container through this Unix socket (apps/server/runner/runner.mjs). Unset: child processes here. */
  runnerSocket: env.RUNNER_SOCKET || "",
  supabaseUrl: (env.SUPABASE_URL || "").replace(/\/+$/, ""),
  supabasePublishableKey: env.SUPABASE_PUBLISHABLE_KEY || "",
  databaseUrl: env.DATABASE_URL || "",
  /** Game folders (data/projects/<id>/, a git repo each) and run logs (data/logs/). */
  dataDir: resolve(env.DATA_DIR || join(ROOT, "data")),
  /** Where published builds go: `folder` = gamesBuildsDir (the dev games origin on :3001 serves it),
   * `r2` = the typeplay-games bucket behind https://typeplay.dev (live). */
  gamesPublish: (env.GAMES_PUBLISH === "r2" ? "r2" : "folder") as "r2" | "folder",
  gamesBuildsDir: resolve(env.GAMES_BUILDS_DIR || join(ROOT, "apps/games/builds")),
  r2: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID || "",
    accessKeyId: env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: env.R2_SECRET_ACCESS_KEY || "",
    bucket: env.R2_GAMES_BUCKET || "typeplay-games",
  },
  godotVersion: env.GODOT_VERSION || "4.7.2",
  godotExe: env.GODOT_EXE || "C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe",
  agentRunner: join(ROOT, "packages/agent/run.mjs"),
  /** Game agent runs at once on this machine; one per project at a time regardless. Past it, builds wait in line. */
  maxRuns: num(env.MAX_RUNS, 3),
  /** A run that takes longer than this is stopped (and charged nothing). */
  runTimeoutMin: num(env.RUN_TIMEOUT_MIN, 40),
  /**
   * The build queue (runs/queue.service.ts): a waiting build that hasn't started this long after its turn leaves the line,
   * charged nothing (as an Android build after 30 minutes); a free build's turn comes this much after it was queued
   * (aging: paid builds that arrive within it go first, later ones never do). Shorter in the tests.
   */
  queue: {
    waitMin: num(env.QUEUE_WAIT_MIN, 30),
    freeDelayMin: num(env.QUEUE_FREE_DELAY_MIN, 10),
  },
  /** The ledger's 10-minute settle sweep (credits/ledger.service.ts), the webhook inbox's 30-second loop and the
   * refund lookup job (billing/); BILLING_JOBS=0 turns them off (tests). */
  billingJobs: env.BILLING_JOBS !== "0",
  /**
   * Paddle (docs/payments-design.md §5, §10). `env` unset or no key = billing off: /billing/* answers 503
   * billing_off and webhooks are refused. The five price ids come from `npm run paddle:catalog`.
   * `apiUrl` points the client at a stand-in (test/paddle-stub.mjs): tests only, refused in production.
   */
  paddle: {
    env: (env.PADDLE_ENV === "live" ? "live" : env.PADDLE_ENV === "sandbox" ? "sandbox" : null) as "live" | "sandbox" | null,
    apiKey: env.PADDLE_API_KEY || "",
    webhookSecret: env.PADDLE_WEBHOOK_SECRET || "",
    /** The old destination's secret while a rotation is going (a second destination, two secrets). */
    webhookSecretPrevious: env.PADDLE_WEBHOOK_SECRET_PREVIOUS || "",
    apiUrl: (env.PADDLE_API_URL || "").replace(/\/+$/, ""),
    prices: {
      medium: env.PADDLE_PRICE_MEDIUM || "",
      high: env.PADDLE_PRICE_HIGH || "",
      ultra: env.PADDLE_PRICE_ULTRA || "",
      ultraplus: env.PADDLE_PRICE_ULTRAPLUS || "",
      pack: env.PADDLE_PRICE_PACK || "",
    },
  },
  /**
   * Android export (docs/android-export-design.md; apps/server/README.md "Android export"). On with
   * ANDROID_EXPORT=1 and a usable ANDROID_KEY_MASTER; live, the signer sidecar's socket; on this PC, a JDK 17,
   * an Android SDK and bundletool (JAVA_HOME, ANDROID_HOME, BUNDLETOOL_JAR) or ANDROID_FAKE=1 (stub job and signer).
   */
  android: {
    on: env.ANDROID_EXPORT === "1",
    fake: env.ANDROID_FAKE === "1",
    masterKey: env.ANDROID_KEY_MASTER || "",
    masterKeyPrev: env.ANDROID_KEY_MASTER_PREV || "",
    /** The signer sidecar's Unix socket (live); unset = the same tools run in this process. */
    signerSocket: env.SIGNER_SOCKET || "",
    /** Where unsigned files wait for the signer: /exports (a volume shared with the signer) live; data/android/work here. */
    exportsDir: resolve(env.EXPORTS_DIR || join(resolve(env.DATA_DIR || join(ROOT, "data")), "android", "work")),
    maxBuilds: num(env.MAX_ANDROID_BUILDS, 1),
    buildTimeoutMin: num(env.ANDROID_BUILD_TIMEOUT_MIN, 14),
    /** How long a phone link lives: 10 minutes (the site says so). ANDROID_LINK_SECONDS shortens it, only with ANDROID_FAKE=1 (the e2e's expired-token case). */
    linkSeconds: env.ANDROID_FAKE === "1" ? Math.min(600, Math.max(1, num(env.ANDROID_LINK_SECONDS, 600))) : 600,
    /** Where signed files live: `folder` = data/android/<projectId>/ (served by the API), `r2` = the private typeplay-exports bucket (presigned links). */
    store: (env.ANDROID_STORE === "r2" ? "r2" : "folder") as "r2" | "folder",
    r2Bucket: env.R2_EXPORTS_BUCKET || "typeplay-exports",
    /** The toolchain fingerprint every build row records: ANDROID_TOOLCHAIN, else the image's /opt/android/TOOLCHAIN. */
    toolchain: env.ANDROID_TOOLCHAIN || readIfThere(env.ANDROID_TOOLCHAIN_FILE || "/opt/android/TOOLCHAIN"),
    /** This PC only (the runner has its own copies of these): the job's JAVA_HOME, ANDROID_HOME, the seed and the placeholder icons. */
    javaHome: env.JAVA_HOME || "",
    androidHome: env.ANDROID_HOME || "",
    bundletoolJar: env.BUNDLETOOL_JAR || "",
    gradleSeed: env.GRADLE_SEED || "",
    icons: resolve(env.ANDROID_ICONS || join(ROOT, "deploy/api/android/icons")),
  },
  /**
   * Notifications by Web Push (src/notify/push.service.ts, 2026-10-29): the VAPID key pair every push is signed with (RFC
   * 8292). The public key is also the site's NEXT_PUBLIC_VAPID_PUBLIC_KEY, which browsers subscribe with; the private key
   * is only in the API's git-ignored env files (this PC: .env.local for dev, .env.autotest.local for the tests; live: the
   * server's api.env, from the root .env's VAPID_LIVE_*: deploy/README.md). Without the pair nothing is sent (devices that
   * turn notifications on are still kept).
   */
  push: {
    publicKey: env.VAPID_PUBLIC_KEY || "",
    privateKey: env.VAPID_PRIVATE_KEY || "",
    /** How a push service reaches us about our pushes (RFC 8292: a mailto: or https: address). */
    subject: env.VAPID_SUBJECT || "mailto:hello@typeplay.app",
    /** Tests only (the e2e's stand-in push service on this PC): http addresses on 127.0.0.1 and localhost are taken too.
     * Refused in production. */
    allowLocal: env.PUSH_ALLOW_LOCAL === "1",
  },
  /** The API's public address, for links handed to phones (POST …/android/builds/:bid/link). */
  publicUrl: (env.API_PUBLIC_URL || `http://127.0.0.1:${num(env.PORT, 3002)}`).replace(/\/+$/, ""),
  /** Read the visitor's address from Cloudflare's CF-Connecting-IP (for the in-memory limits on plays and reports,
   * gallery/limits.ts): on the live server, where only Cloudflare reaches us; TRUST_PROXY=1 for tests. */
  trustProxy: env.NODE_ENV === "production" || env.TRUST_PROXY === "1",
  /** Sandbox billing on the live site is only for these (lower-case emails, comma-separated); in the closed beta they
   * always get in, so Luka can't lock himself out. */
  adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  /**
   * The closed beta (beta 1, PLAN.md package 6; src/beta/invites.ts): only invited emails (`admin invite add`) and
   * ADMIN_EMAILS get past the sign-in; anyone else is 403 invite_only on every signed-in route, and no user row is made.
   * On by default in production (BETA_INVITE_ONLY=0 opens the app to everyone), off on this PC unless BETA_INVITE_ONLY=1.
   */
  betaInviteOnly: env.NODE_ENV === "production" ? env.BETA_INVITE_ONLY !== "0" : env.BETA_INVITE_ONLY === "1",
  /**
   * Beta codes (src/beta/codes.ts): wrong codes allowed in an hour per signed-in email (Luka, 10-24: 5), and in all,
   * so six digits can't be guessed from many accounts either (50; then the code box waits for the hour, for everyone).
   */
  betaCodeTriesPerHour: num(env.BETA_CODE_TRIES_PER_HOUR, 5),
  betaCodeTriesPerHourAll: num(env.BETA_CODE_TRIES_PER_HOUR_ALL, 50),
  corsOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://typeplay.app",
    // Dev only: a second site for tests next to the one on :3000 (e.g. http://localhost:3010).
    ...(env.NODE_ENV === "production" ? [] : (env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean)),
  ],
};

/** A Claude subscription (Max/Pro) login, which must never be on the live server (CLAUDE.md). */
const CLAUDE_LOGIN_VARS = ["CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CODE_OAUTH_REFRESH_TOKEN", "ANTHROPIC_AUTH_TOKEN"];
const claudeLoginFiles = () =>
  [env.CLAUDE_CONFIG_DIR, join(homedir(), ".claude")].filter((d): d is string => !!d).map((d) => join(d, ".credentials.json"));
/** OAuth tokens from `claude setup-token` start like this; Console API keys start sk-ant-api (or sk-ant-usr, the newer kind). */
const looksLikeOauth = (key: string) => /^sk-ant-oat/i.test(key);

export function assertSafeConfig() {
  if (config.devAuth && config.production) {
    throw new Error("DEV_AUTH=1 is not allowed with NODE_ENV=production: refusing to start.");
  }
  if (!config.databaseUrl) throw new Error("DATABASE_URL is missing (root .env).");
  if (!config.supabaseUrl) throw new Error("SUPABASE_URL is missing (root .env).");
  if (looksLikeOauth(config.anthropicApiKey)) {
    throw new Error("ANTHROPIC_API_KEY holds a Claude subscription token (sk-ant-oat…), not an API key: refusing to start.");
  }
  if (config.agentAuth === "api" && !config.agentFake && !config.anthropicApiKey) {
    throw new Error("AGENT_AUTH=api needs ANTHROPIC_API_KEY (the API account's key, root .env).");
  }
  if (config.gamesPublish === "r2" && !(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey)) {
    throw new Error("GAMES_PUBLISH=r2 needs CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.");
  }
  assertPaddleConfig();
  assertAndroidConfig();
  assertPushConfig();
  if (!config.production) return;

  // The live server: our API key for everyone, Luka included; the Max login never goes there.
  if (config.agentFake) throw new Error("AGENT_FAKE=1 is not allowed with NODE_ENV=production: refusing to start.");
  if (config.agentAuth !== "api") throw new Error("NODE_ENV=production needs AGENT_AUTH=api: refusing to start.");
  for (const k of CLAUDE_LOGIN_VARS) {
    if (env[k]) throw new Error(`${k} is set: a Claude login must never be on the live server. Refusing to start.`);
  }
  for (const f of claudeLoginFiles()) {
    if (existsSync(f)) throw new Error(`${f} exists: a Claude login must never be on the live server. Refusing to start.`);
  }
  // The agent runs shell commands from players' prompts: never in the process that holds our secrets.
  if (!config.runnerSocket && !config.agentFake) {
    throw new Error("NODE_ENV=production needs RUNNER_SOCKET: game agent runs happen only in the runner container.");
  }
  if (config.gamesPublish !== "r2") throw new Error("NODE_ENV=production needs GAMES_PUBLISH=r2.");
}

/**
 * The Android guards: ANDROID_EXPORT=1 needs a 64-hex ANDROID_KEY_MASTER (and ANDROID_KEY_MASTER_PREV, when set,
 * the same shape); production needs the signer sidecar's socket and refuses ANDROID_FAKE. Called by assertSafeConfig().
 */
export function assertAndroidConfig() {
  const a = config.android;
  if (!a.on) return;
  const hex64 = (k: string) => /^[0-9a-f]{64}$/i.test(k);
  if (!hex64(a.masterKey)) throw new Error("ANDROID_EXPORT=1 needs ANDROID_KEY_MASTER (64 hex chars): `node deploy/deploy.mjs android-key` makes one.");
  if (a.masterKeyPrev && !hex64(a.masterKeyPrev)) throw new Error("ANDROID_KEY_MASTER_PREV must be 64 hex chars (or unset).");
  if (a.masterKeyPrev && a.masterKeyPrev.toLowerCase() === a.masterKey.toLowerCase()) throw new Error("ANDROID_KEY_MASTER_PREV is the same as ANDROID_KEY_MASTER: refusing to start.");
  if (!config.production) return;
  if (a.fake) throw new Error("ANDROID_FAKE=1 is not allowed with NODE_ENV=production: refusing to start.");
  if (!a.signerSocket) throw new Error("NODE_ENV=production with ANDROID_EXPORT=1 needs SIGNER_SOCKET: keystores are used only in the signer sidecar.");
  if (!config.runnerSocket) throw new Error("NODE_ENV=production with ANDROID_EXPORT=1 needs RUNNER_SOCKET: Android exports run only in the runner container.");
}

/**
 * The notification guards: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY come together, as a P-256 pair in base64url (65 and 32
 * bytes) whose halves belong to each other (a mismatched pair would make every push service refuse every push), and the
 * subject is a mailto: or https: address. PUSH_ALLOW_LOCAL is for tests only. Called by assertSafeConfig().
 */
export function assertPushConfig() {
  const p = config.push;
  if (p.allowLocal && config.production) throw new Error("PUSH_ALLOW_LOCAL=1 is for tests only and is not allowed with NODE_ENV=production: refusing to start.");
  if (!p.publicKey && !p.privateKey) return;
  if (!p.publicKey || !p.privateKey) throw new Error("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY come together (or neither: notifications off): refusing to start.");
  const pub = Buffer.from(p.publicKey, "base64url");
  const priv = Buffer.from(p.privateKey, "base64url");
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY is not a P-256 public key (65 bytes, base64url): refusing to start.");
  if (priv.length !== 32) throw new Error("VAPID_PRIVATE_KEY is not a P-256 private key (32 bytes, base64url): refusing to start.");
  const ecdh = createECDH("prime256v1");
  try {
    ecdh.setPrivateKey(priv);
  } catch {
    throw new Error("VAPID_PRIVATE_KEY is not a usable P-256 private key: refusing to start.");
  }
  if (!ecdh.getPublicKey().equals(pub)) throw new Error("VAPID_PUBLIC_KEY doesn't belong to VAPID_PRIVATE_KEY: refusing to start.");
  if (!/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(p.subject)) throw new Error("VAPID_SUBJECT is a mailto: or https: address: refusing to start.");
}

/** Sandbox keys start with pdl_sdbx_apikey_, live ones with pdl_live_apikey_ (docs/research/paddle-2026.md R-E2). */
export const paddleKeyEnv = (key: string): "sandbox" | "live" | null =>
  /^pdl_sdbx_apikey_/.test(key) ? "sandbox" : /^pdl_live_apikey_/.test(key) ? "live" : null;

/** Billing is on when PADDLE_ENV and a key are set; then the env, the key and the five prices must agree. */
export const paddleMode = (): "off" | "sandbox" | "live" => (config.paddle.env && config.paddle.apiKey ? config.paddle.env : "off");

/** The Paddle guards (docs/payments-design.md §10): a key must match its environment; production never
 * points the client elsewhere, and a live key needs the webhook secret. Called by assertSafeConfig(). */
export function assertPaddleConfig() {
  const p = config.paddle;
  if (env.PADDLE_ENV && !p.env) throw new Error(`PADDLE_ENV is "${env.PADDLE_ENV}": it is sandbox or live (or unset: billing off).`);
  if (p.apiKey && !p.env) throw new Error("PADDLE_API_KEY is set without PADDLE_ENV (sandbox or live): refusing to start.");
  if (p.apiKey) {
    const keyEnv = paddleKeyEnv(p.apiKey);
    if (keyEnv !== p.env) {
      throw new Error(
        keyEnv
          ? `PADDLE_API_KEY is a ${keyEnv} key but PADDLE_ENV is ${p.env}: refusing to start.`
          : "PADDLE_API_KEY does not look like a Paddle API key (pdl_sdbx_apikey_… or pdl_live_apikey_…): refusing to start.",
      );
    }
    const missing = (Object.keys(p.prices) as (keyof typeof p.prices)[]).filter((k) => !p.prices[k]).map((k) => `PADDLE_PRICE_${k.toUpperCase()}`);
    if (missing.length) throw new Error(`${missing.join(", ")} missing: run \`npm run paddle:catalog -w @typeplay/server -- --env ${p.env}\` and put its ids in .env.`);
    const ids = Object.values(p.prices);
    if (new Set(ids).size !== ids.length) throw new Error("two PADDLE_PRICE_* keys hold the same price id: refusing to start.");
  }
  if (!config.production) return;
  if (p.apiUrl) throw new Error("PADDLE_API_URL is for tests only and is not allowed with NODE_ENV=production: refusing to start.");
  if (p.env === "live" && p.apiKey && !p.webhookSecret) {
    throw new Error("A live Paddle key needs PADDLE_WEBHOOK_SECRET (the notification destination's secret): refusing to start.");
  }
}
