// Google sign-in, every value of the switch NEXT_PUBLIC_GOOGLE_BUTTON (2026-11-04, docs/launch/google-sign-in-name.md),
// on a stack of its own (dev-env.mjs useOwnStack): the API (DEV_AUTH=1, AGENT_FAKE=1, the closed beta on), the games
// origin, and the site as `next dev` three times: the switch off (.next/signin-off), on ("1", .next/signin-on) and
// "only" (.next/signin-only). Build the API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-signin.mjs [outDir]
// Shots in .impeccable/review/signin/.
//
// Real Google and the live Supabase can't run here, and nothing reaches them: the test browser lets only this PC's
// stack through. Switch off, Supabase's authorize address (where today's button goes) is answered with a stub page.
// Switch on, a stand-in for Google's script draws a button of Google's size and, on a click, makes an ID token for the
// nonce the page gave it; Supabase's id_token grant is answered here after the checks Supabase's server makes (provider
// google, our client ID as the token's audience, the SHA-256 hex of the raw nonce equal to the token's nonce), with a
// session whose access token is a dev sign-in (`dev:<email>`), which the test API (DEV_AUTH=1) accepts. So dev sign-in
// stands in for the one step only real Google and Supabase can do; everything on our side runs as it will live.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { doubleText, useOwnStack } from "./dev-env.mjs";
import { GIS_STUB } from "./gis-stub.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] ?? join(root, ".impeccable/review/signin");
mkdirSync(out, { recursive: true });

// The public sign-in values the site is built with (content/app.ts; no secrets): the API needs Supabase's two.
const appTs = readFileSync(join(webDir, "src/content/app.ts"), "utf8");
const pick = (marker) => appTs.match(new RegExp(`"([^"]+)", // ${marker}`))?.[1] ?? "";
const SUPABASE = pick("supabase:url");
const SUPABASE_KEY = pick("supabase:publishableKey");
const CLIENT_ID = pick("google:clientId");
if (!SUPABASE || !SUPABASE_KEY || !CLIENT_ID) throw new Error("content/app.ts lacks a sign-in value");
const SUPABASE_HOST = new URL(SUPABASE).host;
const COOKIE = `sb-${SUPABASE_HOST.split(".")[0]}-auth-token`;

const [OFF_PORT, ON_PORT, ONLY_PORT, API_PORT, GAMES_PORT] = await useOwnStack("signin", 5);
const apiBase = `http://127.0.0.1:${API_PORT}`;
const stamp = Date.now().toString(36);
const invited = `signin-in-${stamp}@dev.test`;
const outsider = `signin-out-${stamp}@dev.test`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
/** A shot with `focus` (a selector) in the middle of the screen, once the page's fades have settled. */
const shot = async (page, name, focus = null) => {
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  if (focus) await page.locator(focus).first().evaluate((el) => el.scrollIntoView({ block: "center" })).catch(() => {});
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], {
    cwd: serverDir,
    encoding: "utf8",
    env: { ...process.env, ADMIN_NAME: "shots", SUPABASE_URL: SUPABASE, SUPABASE_PUBLISHABLE_KEY: SUPABASE_KEY },
    windowsHide: true,
  });
const sha256hex = (s) => createHash("sha256").update(s).digest("hex");
const claimsOf = (jwt) => JSON.parse(Buffer.from(String(jwt).split(".")[1] ?? "", "base64url").toString() || "{}");

// ---- The stand-in for Google's script: gis-stub.mjs

// ---- The test browser's network: this PC only; Google and Supabase answered here ---------------
const net = { leaked: [], gisLoads: 0, gisLangs: [], authorize: [], grants: [], logouts: 0, slowMs: 0 };
const cors = (req) => ({
  "access-control-allow-origin": req.headers()["origin"] ?? "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
});
/** `gis`: "stub" (the stand-in above), "blocked" (as a blocker would), "hang" (never answers: the place held while it
 * loads stays), or "none" (switch off: it must never be asked for). */
async function wire(ctx, { gis }) {
  await ctx.route(
    () => true,
    async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (["localhost", "127.0.0.1"].includes(url.hostname)) return route.continue();
      if (url.host === "accounts.google.com" && url.pathname === "/gsi/client") {
        net.gisLoads++;
        net.gisLangs.push(url.searchParams.get("hl"));
        if (gis === "hang") return; // left unanswered until the context closes
        if (gis === "stub") return route.fulfill({ status: 200, contentType: "text/javascript", body: GIS_STUB });
        if (gis === "none") net.leaked.push(`asked for Google's script with the switch off`);
        return route.abort("blockedbyclient");
      }
      if (url.host === SUPABASE_HOST && url.pathname === "/auth/v1/authorize") {
        net.authorize.push(url);
        return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Supabase authorize (stub)</title><p>Supabase's authorize, answered by the test." });
      }
      if (url.host === SUPABASE_HOST && url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "id_token") {
        if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors(req) });
        const body = JSON.parse(req.postData() || "{}");
        const claims = claimsOf(body.id_token);
        const grant = {
          provider: body.provider,
          audOk: claims.aud === CLIENT_ID,
          nonceOk: typeof body.nonce === "string" && sha256hex(body.nonce) === claims.nonce,
          rawNonce: body.nonce,
          tokenNonce: claims.nonce,
          apikeyOk: req.headers()["apikey"] === SUPABASE_KEY,
          email: claims.email,
        };
        net.grants.push(grant);
        if (net.slowMs) await new Promise((r) => setTimeout(r, net.slowMs));
        const json = (status, o) => route.fulfill({ status, headers: cors(req), contentType: "application/json", body: JSON.stringify(o) });
        // What Supabase's server refuses (supabase/auth, internal/api/token_oidc.go): another audience, a nonce mismatch.
        if (body.provider !== "google" || !grant.audOk) return json(400, { code: 400, error_code: "bad_oauth_callback", msg: "Unacceptable audience in id_token" });
        if (!grant.nonceOk) return json(400, { code: 400, error_code: "bad_oauth_callback", msg: "Nonces mismatch" });
        const now = Math.floor(Date.now() / 1000);
        const id = createHash("sha256").update(claims.email).digest("hex");
        return json(200, {
          access_token: `dev:${claims.email}`,
          token_type: "bearer",
          expires_in: 3600,
          expires_at: now + 3600,
          refresh_token: `stub-${stamp}`,
          user: {
            id: `${id.slice(0, 8)}-${id.slice(8, 12)}-4${id.slice(13, 16)}-8${id.slice(17, 20)}-${id.slice(20, 32)}`,
            aud: "authenticated",
            role: "authenticated",
            email: claims.email,
            app_metadata: { provider: "google", providers: ["google"] },
            user_metadata: { full_name: claims.name, email: claims.email },
            identities: [],
            created_at: new Date().toISOString(),
          },
        });
      }
      if (url.host === SUPABASE_HOST && url.pathname === "/auth/v1/logout") {
        net.logouts++;
        return route.fulfill({ status: 204, headers: cors(req) });
      }
      net.leaked.push(`${req.method()} ${url.origin}${url.pathname}`);
      return route.abort("blockedbyclient");
    },
  );
}

// ---- The stack ------------------------------------------------------------------------------------
const children = [];
function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let log = "";
  child.stdout.on("data", (d) => (log = (log + d).slice(-4000)));
  child.stderr.on("data", (d) => (log = (log + d).slice(-4000)));
  children.push({ name, child });
  return { child, log: () => log };
}
function stop(child) {
  if (child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else child.kill("SIGKILL");
}
async function until(what, test, seconds, log) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await test().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} did not start: ${log?.() ?? ""}`);
}
/** The site with the switch at `value`: "" (off), "1" (on) or "only" (on, no redirect where Google's script can't load). */
/**
 * How wide the page scrolls with the dev-only test sign-in hidden (production has none; its email box runs past a 280px
 * screen at 200% text). The scroll width, not element boxes: a box a parent clips (the background's shapes) is no
 * wider page.
 */
const past = (page) =>
  page.evaluate(() => {
    const dev = [...document.querySelectorAll(".devsignin")];
    for (const el of dev) el.style.display = "none";
    const right = document.documentElement.scrollWidth;
    for (const el of dev) el.style.display = "";
    return { right };
  });

async function site(port, value) {
  const name = value === "" ? "off" : value === "1" ? "on" : value;
  const proc = start(`site-${name}`, [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(port)], webDir, {
    NEXT_DIST_DIR: `.next/signin-${name}`,
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_CLOSED_BETA: "1",
    NEXT_PUBLIC_GOOGLE_BUTTON: value,
    NEXT_PUBLIC_API_ORIGIN: apiBase,
    NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${GAMES_PORT}`,
    NEXT_PUBLIC_PADDLE_ENV: "",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
  });
  const base = `http://localhost:${port}`;
  await until(`the site (switch ${name})`, async () => (await fetch(`${base}/pricing`)).ok, 240, proc.log);
  return { base, proc };
}

const tsconfig = join(webDir, "tsconfig.json");
const tsconfigBefore = readFileSync(tsconfig, "utf8");
let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, {
    PORT: String(API_PORT),
    DEV_AUTH: "1",
    AGENT_FAKE: "1",
    BETA_INVITE_ONLY: "1",
    ADMIN_EMAILS: "",
    CORS_ORIGINS: [OFF_PORT, ON_PORT, ONLY_PORT].map((p) => `http://localhost:${p}`).join(","),
    BILLING_JOBS: "0",
    SUPABASE_URL: SUPABASE,
    SUPABASE_PUBLISHABLE_KEY: SUPABASE_KEY,
  });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).inviteOnly === true, 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const add = admin("invite", "add", invited, "shots");
  check("admin invite add (the invited tester)", add.status === 0, (add.stdout || add.stderr).trim().slice(0, 160));

  browser = await chromium.launch({ channel: "msedge", headless: true });
  const desk = (o = {}) => browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1, ...o });
  const phone = () => browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const devSignIn = async (page, base, email) => {
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", email);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
  };
  const buildButton = (page) => page.getByRole("button", { name: "Build my game" });
  const closedTitle = (page) => page.getByRole("heading", { name: "TypePlay is in a closed beta." });
  const redirectButton = (page) => page.locator(".signin > button.button", { hasText: "Sign in with Google" });

  // ==== Switch off: exactly the sign-in as before ====================================================
  {
    const { base, proc } = await site(OFF_PORT, "");
    console.log(`switch off: site :${OFF_PORT}, API :${API_PORT} (closed beta on), games :${GAMES_PORT}`);
    const ctx = await desk();
    await wire(ctx, { gis: "none" });
    const page = await ctx.newPage();
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await redirectButton(page).waitFor({ timeout: 120_000 });
    check("off: /create signed out shows our own Sign in with Google button", (await redirectButton(page).count()) === 1);
    check("off: no Google button frame on the page", (await page.locator(".googlebutton").count()) === 0);
    await shot(page, "off-create-desktop", ".signin");
    await redirectButton(page).click();
    await page.waitForURL((u) => u.host === SUPABASE_HOST, { timeout: 30_000 });
    const az = net.authorize.at(-1);
    const back = az ? new URL(az.searchParams.get("redirect_to") ?? "") : null;
    check(
      "off: the button goes to Supabase's authorize (provider google, PKCE), back to /auth/callback?next=/create",
      az && az.searchParams.get("provider") === "google" && !!az.searchParams.get("code_challenge") && back?.origin === base && back?.pathname === "/auth/callback" && back?.searchParams.get("next") === "/create",
      az ? `${az.origin}${az.pathname}?provider=${az.searchParams.get("provider")}&redirect_to=${az.searchParams.get("redirect_to")}` : "no authorize request",
    );
    await page.goto(`${base}/auth/callback?next=%2Fgames`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.waitForURL(/\/create\?signin=failed/, { timeout: 60_000 });
    const said = await page.getByText("Sign-in didn't finish. Please try again.").waitFor({ timeout: 30_000 }).then(() => true, () => false);
    check("off: /auth/callback without a code lands on /create?signin=failed, which says so", said);
    await ctx.close();

    // The closed beta: an uninvited dev sign-in, then "Use another account" = Google's chooser through Supabase.
    const ctx2 = await desk();
    await wire(ctx2, { gis: "none" });
    const p2 = await ctx2.newPage();
    await devSignIn(p2, base, outsider);
    await closedTitle(p2).waitFor({ timeout: 60_000 });
    const another = p2.getByRole("button", { name: "Use another account" });
    check("off: the closed-beta screen's Use another account is our own quiet button", (await another.count()) === 1 && (await p2.locator(".googlebutton").count()) === 0);
    await another.click();
    await p2.waitForURL((u) => u.host === SUPABASE_HOST, { timeout: 30_000 });
    const az2 = net.authorize.at(-1);
    check("off: Use another account asks Google's account chooser (prompt=select_account) through Supabase", az2?.searchParams.get("prompt") === "select_account" && az2?.searchParams.get("provider") === "google");
    await ctx2.close();

    const ctx3 = await desk();
    await wire(ctx3, { gis: "none" });
    const p3 = await ctx3.newPage();
    await devSignIn(p3, base, invited);
    await buildButton(p3).waitFor({ timeout: 60_000 });
    check("off: dev sign-in as an invited tester: /create as usual (Build my game)", true);
    await ctx3.close();
    check("off: Google's script was never asked for, and nothing left this PC", net.gisLoads === 0 && net.leaked.length === 0, net.leaked.join("; "));
    stop(proc);
  }

  // ==== Switch on: Google's own button ===============================================================
  {
    net.authorize.length = 0;
    const { base, proc } = await site(ON_PORT, "1");
    console.log(`switch on: site :${ON_PORT}`);
    const gis = (page) => page.evaluate(() => {
      const g = window.__gis;
      return g ? { configs: g.configs.map(({ callback, ...c }) => ({ ...c, hasCallback: typeof callback === "function" })), renders: g.renders, disabled: g.disabled, credentials: g.credentials.length } : null;
    });
    const googleIn = (page) => page.locator(".googlebutton__frame .stub-gis");

    // 1. Signed out on /create: Google's button, the right config, a one-time nonce.
    const ctx = await desk();
    await wire(ctx, { gis: "stub" });
    const page = await ctx.newPage();
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await googleIn(page).waitFor({ timeout: 120_000 });
    await page.locator(".googlebutton__hold").waitFor({ state: "detached", timeout: 10_000 });
    const g1 = await gis(page);
    const c1 = g1?.configs.at(-1) ?? {};
    check("on: /create signed out shows Google's button, not ours", (await googleIn(page).count()) === 1 && (await redirectButton(page).count()) === 0);
    check(
      "on: Google's client: our client ID, a 64-hex nonce, popup with Chrome's own dialog (FedCM), never automatic",
      c1.client_id === CLIENT_ID && /^[0-9a-f]{64}$/.test(c1.nonce ?? "") && c1.ux_mode === "popup" && c1.use_fedcm_for_button === true && c1.auto_select === false && c1.button_auto_select === false && c1.hasCallback,
      JSON.stringify(c1),
    );
    const r1 = g1?.renders.at(-1) ?? {};
    check("on: the dark button (filled_black, large, Sign in with Google, pill, English)", r1.theme === "filled_black" && r1.size === "large" && r1.text === "signin_with" && r1.shape === "pill" && r1.locale === "en", JSON.stringify(r1));
    check("on: Google's script asked for in English (hl=en: its frame doesn't pick the language from where the visitor is)", net.gisLangs.length > 0 && net.gisLangs.every((l) => l === "en"), net.gisLangs.join(","));
    check(
      "on: Google's frame in its own light scheme (no white slab under the page's dark one), no empty paragraph under it",
      (await page.locator(".googlebutton__frame").evaluate((el) => getComputedStyle(el).colorScheme)) === "light" && (await page.locator(".signin p:empty").count()) === 0,
    );
    await shot(page, "on-create-desktop", ".signin");

    // 2. A token with the wrong nonce: Supabase refuses it, the page says so and stays signed out.
    await page.evaluate(() => (window.__gis.mode = "wrong-nonce"));
    await page.evaluate((email) => (window.__gis.email = email), invited);
    await googleIn(page).click();
    await page.getByText("Sign-in didn't finish. Please try again.").waitFor({ timeout: 20_000 });
    const bad = net.grants.at(-1);
    check("on: a token whose nonce isn't the page's: Supabase refuses (Nonces mismatch), the page says so, still signed out", bad && !bad.nonceOk && (await page.locator("#dev-email").count()) === 1);
    const g2 = await gis(page);
    check("on: after each try a fresh nonce (Google's client started again)", g2.configs.length >= 2 && g2.configs.at(-1).nonce !== c1.nonce, `${g2.configs.length} configs`);
    await shot(page, "on-create-error", ".signin");

    // 3. A replayed callback for the old nonce is never sent to Supabase.
    const grantsBefore = net.grants.length;
    await page.evaluate(() => {
      const g = window.__gis;
      const old = g.configs[0];
      old.callback({ credential: g.credentials[0].credential, select_by: "btn" });
    });
    await page.waitForTimeout(800);
    check("on: a token for an older nonce is never sent", net.grants.length === grantsBefore);

    // 4. The real thing: Google's token to Supabase with the raw nonce, then /create signed in.
    await page.evaluate(() => (window.__gis.mode = "ok"));
    net.slowMs = 1500;
    await googleIn(page).click();
    const busyShown = await page.locator(".googlebutton--busy[inert]").waitFor({ timeout: 1_400 }).then(() => true, () => false);
    const signingIn = await page.locator(".signin .field-hint", { hasText: "Signing in…" }).isVisible().catch(() => false);
    check("on: while Supabase answers, Google's button takes no second press (inert, dimmed) and the page says Signing in…", busyShown && signingIn);
    net.slowMs = 0;
    await buildButton(page).waitFor({ timeout: 60_000 });
    const good = net.grants.at(-1);
    check(
      "on: Supabase gets provider google, Google's token, the raw nonce (its SHA-256 = the token's nonce) and our publishable key",
      good && good.provider === "google" && good.nonceOk && good.audOk && good.apikeyOk && good.rawNonce !== good.tokenNonce,
      good ? `raw ${good.rawNonce.length} chars, token nonce ${good.tokenNonce.slice(0, 8)}…` : "no grant",
    );
    const cookies = await ctx.cookies(base);
    check("on: the session is in this browser's cookies (the proxy and /auth pages read it as before)", cookies.some((c) => c.name.startsWith(COOKIE)));
    check("on: signed in on /create (Build my game, the account button)", (await page.locator(".avatarbutton").count()) === 1);
    // The credits in the bar come from GET /me with this session's token: the API answered for it (a new Free account).
    const credits = await page
      .waitForFunction(() => {
        const t = document.querySelector(".account__credits b")?.textContent ?? "…";
        return t !== "…" && t;
      }, null, { timeout: 30_000 })
      .then((h) => h.jsonValue(), () => null);
    check("on: the API answered GET /me for this session (the Free plan's 20 credits in the bar)", credits === "20", String(credits));
    await shot(page, "on-create-signed-in", ".make__go, .make");

    // 5. Sign out: the session goes from the cookies.
    await page.locator(".avatarbutton").click();
    await page.locator("#account-menu:popover-open").waitFor({ timeout: 5_000 });
    await page.locator("#account-menu button", { hasText: "Sign out" }).click();
    await googleIn(page).waitFor({ timeout: 60_000 });
    const after = await ctx.cookies(base);
    check("on: Sign out empties the session cookies and shows Google's button again", !after.some((c) => c.name.startsWith(COOKIE) && c.value));
    await ctx.close();

    // 6. From the pricing page's Get Medium (/create?plan=medium). Billing is off in this build, as live (no Paddle token:
    // content/billing.ts `sale`; since 11-20 there is no checkout to go on to): the sign-in comes back to the same address
    // with the plan kept, and the page says the plan isn't on sale. With a token, `next` is the checkout instead.
    const ctxP = await desk();
    await wire(ctxP, { gis: "stub" });
    const pp = await ctxP.newPage();
    await pp.goto(`${base}/create?plan=medium`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await googleIn(pp).waitFor({ timeout: 120_000 });
    await pp.evaluate((email) => (window.__gis.email = email), invited);
    await googleIn(pp).click();
    await pp.locator(".avatarbutton").waitFor({ timeout: 60_000 });
    const planUrl = new URL(pp.url());
    check(
      "on: a sign-in from /create?plan=medium comes back to it signed in, the plan kept, saying Medium isn't on sale (billing off, as live)",
      planUrl.pathname === "/create" && planUrl.searchParams.get("plan") === "medium" && (await pp.getByText("Medium isn't on sale yet.").count()) > 0,
      planUrl.pathname + planUrl.search,
    );
    await ctxP.close();

    // 6b. The status bar's Sign in, from /pricing on a phone: Google's button on the first screen (above the idea box), and
    // the sign-in comes back to /pricing.
    const ctxS = await phone();
    await wire(ctxS, { gis: "stub" });
    const ps = await ctxS.newPage();
    await ps.goto(`${base}/pricing`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await ps.locator(".statusbar").getByRole("link", { name: "Sign in" }).click();
    await googleIn(ps).waitFor({ timeout: 120_000 });
    const pill = new URL(ps.url());
    const first = await ps.evaluate(() => ({ google: document.querySelector(".googlebutton")?.getBoundingClientRect().bottom ?? 9999, idea: document.querySelector("#idea")?.getBoundingClientRect().top ?? 0, h: innerHeight }));
    check(
      "on: the status bar's Sign in opens /create with Google's button on a phone's first screen, above the idea box",
      pill.pathname === "/create" && pill.searchParams.get("signin") === "1" && pill.searchParams.get("next") === "/pricing" && first.google <= first.h && first.google <= first.idea,
      `${pill.pathname}${pill.search}; Google ends at ${Math.round(first.google)} of ${first.h}, the idea box at ${Math.round(first.idea)}`,
    );
    await shot(ps, "on-signin-pill-phone");
    // Its note says where the sign-in goes (fix round 2), with the closed beta's words where the beta is on: two
    // sentences (2026-11-21, they were five).
    const pillNote = (await ps.locator(".signin .field-hint").textContent()).replace(/\s+/g, " ").trim();
    check(
      "on: …its note says the closed beta and that the sign-in goes back to the page you were on, the idea kept, in two sentences",
      pillNote === "A closed beta for now: sign in with Google, then type the beta code from your invitation or join the waitlist. You come back to the page you were on, and your idea stays here.",
      pillNote,
    );
    await ps.evaluate((email) => (window.__gis.email = email), invited);
    await googleIn(ps).click();
    await ps.waitForURL((u) => u.pathname === "/pricing", { timeout: 60_000 });
    await ps.locator(".avatarbutton").waitFor({ timeout: 60_000 });
    check("on: …and the sign-in comes back to /pricing, signed in", new URL(ps.url()).pathname === "/pricing");
    await ctxS.close();

    // 7. The closed beta: signed in uninvited, then Use another account with Google's light button.
    const ctx2 = await desk();
    await wire(ctx2, { gis: "stub" });
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await googleIn(p2).waitFor({ timeout: 120_000 });
    await p2.evaluate((email) => (window.__gis.email = email), outsider);
    await googleIn(p2).click();
    await closedTitle(p2).waitFor({ timeout: 60_000 });
    await googleIn(p2).waitFor({ timeout: 60_000 });
    const r2 = (await gis(p2))?.renders.at(-1) ?? {};
    check("on: uninvited: the closed-beta screen, Use another account is Google's light button (outline, medium: never shows an account)", r2.theme === "outline" && r2.size === "medium" && r2.text === "continue_with" && (await p2.getByRole("button", { name: "Use another account" }).count()) === 0, JSON.stringify(r2));
    await shot(p2, "on-closed-beta-desktop", ".closed__who");
    // Side by side from 641px: Sign out's words on the middle of Google's button (fix round 2: they sat 5.5px above it).
    const side = await p2.evaluate(() => {
      const mid = (el) => (el ? (({ top, bottom }) => (top + bottom) / 2)(el.getBoundingClientRect()) : null);
      const out = [...document.querySelectorAll(".closed__actions .textbutton")].find((b) => b.textContent === "Sign out");
      return { google: mid(document.querySelector(".closed__actions .googlebutton")), out: mid(out) };
    });
    check("on, desktop, closed beta: Sign out on the middle of Google's button (within 1px)", side.google !== null && side.out !== null && Math.abs(side.google - side.out) <= 1, JSON.stringify(side));
    await p2.evaluate((email) => (window.__gis.email = email), invited);
    await googleIn(p2).click();
    await buildButton(p2).waitFor({ timeout: 60_000 });
    check("on: the other (invited) account picked in Google's window replaces the sign-in: /create as usual", (await closedTitle(p2).count()) === 0);
    await ctx2.close();

    // 8. Google's script blocked (a blocker, offline): our own button and the redirect, as before.
    const ctx3 = await desk();
    await wire(ctx3, { gis: "blocked" });
    const p3 = await ctx3.newPage();
    await p3.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await redirectButton(p3).waitFor({ timeout: 60_000 });
    check("on, Google's script blocked: our own button instead", (await p3.locator(".googlebutton").count()) === 0);
    await shot(p3, "on-blocked-fallback", ".signin");
    await redirectButton(p3).click();
    await p3.waitForURL((u) => u.host === SUPABASE_HOST, { timeout: 30_000 });
    check("on, Google's script blocked: the fallback goes through Supabase's authorize as before", net.authorize.at(-1)?.searchParams.get("provider") === "google");
    await ctx3.close();

    // 9. Phone width: Google's button and the closed-beta screen fit.
    const ctx4 = await phone();
    await wire(ctx4, { gis: "stub" });
    const p4 = await ctx4.newPage();
    await p4.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await googleIn(p4).waitFor({ timeout: 120_000 });
    const fits = await p4.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, 390);
    const box = await googleIn(p4).boundingBox();
    check("on, phone 390: nothing wider than the screen, Google's button whole on it", fits && box && box.x >= 0 && box.x + box.width <= 390, box ? `${Math.round(box.x)}-${Math.round(box.x + box.width)}` : "");
    await shot(p4, "on-create-phone", ".signin");
    await p4.evaluate((email) => (window.__gis.email = email), outsider);
    await googleIn(p4).click();
    await closedTitle(p4).waitFor({ timeout: 60_000 });
    await googleIn(p4).waitFor({ timeout: 60_000 });
    const fits2 = await p4.evaluate((vw) => document.documentElement.scrollWidth <= vw + 1, 390);
    const g = await googleIn(p4).boundingBox();
    const out2 = await p4.locator(".closed__actions .textbutton", { hasText: "Sign out" }).boundingBox();
    check("on, phone 390: the closed-beta screen fits, Google's light button across the panel, Sign out (words) under it", fits2 && g && out2 && out2.y + out2.height / 2 > g.y + g.height && g.x >= 0 && g.x + g.width <= 390, g && out2 ? `Google ${Math.round(g.width)} px, Sign out ${Math.round(out2.width)} px` : "");
    await shot(p4, "on-closed-beta-phone", ".closed__who");
    await ctx4.close();

    // 10. The narrowest phone (280px, a folded Galaxy Fold): Google's words fit, or its shortest ("Sign in") does.
    const ctx5 = await browser.newContext({ viewport: { width: 280, height: 653 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await wire(ctx5, { gis: "stub" });
    const p5 = await ctx5.newPage();
    await p5.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await googleIn(p5).waitFor({ timeout: 120_000 });
    const narrow1 = await p5.evaluate(() => ({ page: document.documentElement.scrollWidth, text: document.querySelector(".googlebutton__frame .stub-gis")?.textContent }));
    check("on, phone 280: /create fits, Google's dark button keeps its words", narrow1.page <= 281 && narrow1.text === "Sign in with Google", JSON.stringify(narrow1));
    await p5.evaluate((email) => (window.__gis.email = email), outsider);
    await googleIn(p5).click();
    await closedTitle(p5).waitFor({ timeout: 60_000 });
    await googleIn(p5).waitFor({ timeout: 60_000 });
    const narrow2 = await p5.evaluate(() => {
      const panel = document.querySelector(".closed__who").getBoundingClientRect();
      const g = document.querySelector(".googlebutton__frame .stub-gis").getBoundingClientRect();
      return { page: document.documentElement.scrollWidth, inside: g.left >= panel.left && g.right <= panel.right, text: document.querySelector(".googlebutton__frame .stub-gis").textContent, g: Math.round(g.width), panel: Math.round(panel.width) };
    });
    check("on, phone 280: the closed-beta screen fits, Google's light button inside its panel with its full words", narrow2.page <= 281 && narrow2.inside && narrow2.text === "Continue with Google", JSON.stringify(narrow2));
    await shot(p5, "on-closed-beta-280", ".closed__who");
    await ctx5.close();

    check("on: nothing left this PC (Google and Supabase answered by the test)", net.leaked.length === 0, net.leaked.join("; "));
    stop(proc);
  }

  // ==== Large text (200%) at 280px: the place held while Google loads, our own button, the closed-beta pair ============
  {
    const { base, proc } = await site(ON_PORT, "1");
    const googleIn = (page) => page.locator(".googlebutton__frame .stub-gis");
    const narrow = () => browser.newContext({ viewport: { width: 280, height: 653 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    // Google's script still on its way: "Loading…" stays inside its place.
    const ctxH = await narrow();
    await wire(ctxH, { gis: "hang" });
    const ph = await ctxH.newPage();
    await ph.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await ph.locator(".googlebutton__hold span").waitFor({ timeout: 120_000 });
    await doubleText(ph);
    await ph.waitForTimeout(700);
    const hold = await ph.evaluate(() => {
      const box = document.querySelector(".googlebutton__hold").getBoundingClientRect();
      const words = document.querySelector(".googlebutton__hold span");
      return { text: words.textContent, inside: words.getBoundingClientRect().right <= box.right + 0.5 && box.right <= innerWidth };
    });
    const holdPast = await past(ph);
    check("on, 280 at 200% text: the place held while Google's script loads says Loading… inside itself, nothing past the screen", hold.text === "Loading…" && hold.inside && holdPast.right <= 281, JSON.stringify({ ...hold, ...holdPast }));
    await shot(ph, "on-loading-280-text200", ".signin");
    await ctxH.close();
    // Google's script blocked: our own orange button wraps inside the column.
    const ctxB = await narrow();
    await wire(ctxB, { gis: "blocked" });
    const pb = await ctxB.newPage();
    await pb.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await redirectButton(pb).waitFor({ timeout: 60_000 });
    const plain = await pb.evaluate(() => document.documentElement.scrollWidth);
    await doubleText(pb);
    await pb.waitForTimeout(500);
    const fallback = await pb.evaluate(() => {
      const b = document.querySelector(".signin > button.button").getBoundingClientRect();
      const col = document.querySelector(".signin").getBoundingClientRect();
      const g = document.querySelector(".signin > button.button > svg").getBoundingClientRect();
      return { inside: b.left >= col.left - 0.5 && b.right <= col.right + 0.5, g: Math.round(g.width) };
    });
    const fallbackPast = await past(pb);
    check("on, Google's script blocked, 280: our own button inside its column, its G whole (20px), at 100% and 200% text, nothing past the screen", plain <= 281 && fallback.inside && fallback.g >= 19 && fallbackPast.right <= 281, `${plain} / ${JSON.stringify({ ...fallback, ...fallbackPast })}`);
    await shot(pb, "on-blocked-280-text200", ".signin");
    await ctxB.close();
    // Signed in uninvited at 280: the sentence before Google's light button says what its short "Sign in" does; Sign out
    // is words under it.
    const ctxC = await narrow();
    await wire(ctxC, { gis: "stub" });
    const pc = await ctxC.newPage();
    await pc.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await googleIn(pc).waitFor({ timeout: 120_000 });
    await pc.evaluate((email) => (window.__gis.email = email), outsider);
    await googleIn(pc).click();
    await closedTitle(pc).waitFor({ timeout: 60_000 });
    await googleIn(pc).waitFor({ timeout: 60_000 });
    const pair = await pc.evaluate(() => {
      const g = document.querySelector(".googlebutton__frame .stub-gis").getBoundingClientRect();
      const out = [...document.querySelectorAll(".closed__actions .textbutton")].find((b) => b.textContent === "Sign out")?.getBoundingClientRect();
      return { said: document.querySelector(".closed__who").textContent.includes("Sign in with that Google account."), out: !!out && out.top + out.height / 2 > g.bottom, scheme: getComputedStyle(document.querySelector(".googlebutton__frame")).colorScheme };
    });
    check("on, 280, closed beta: \"Sign in with that Google account.\" before Google's button, Sign out as words under it, Google's frame light", pair.said && pair.out && pair.scheme === "light", JSON.stringify(pair));
    await shot(pc, "on-closed-beta-pair-280", ".closed__who");
    await ctxC.close();
    stop(proc);
  }

  // ==== Switch "only": Google's button, and no redirect through Supabase at all =========================
  {
    net.authorize.length = 0;
    const { base, proc } = await site(ONLY_PORT, "only");
    console.log(`switch only: site :${ONLY_PORT}`);
    const blockedLine = (page) => page.getByText("Google's sign-in didn't load here.", { exact: false });

    const ctx = await desk();
    await wire(ctx, { gis: "stub" });
    const page = await ctx.newPage();
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator(".googlebutton__frame .stub-gis").waitFor({ timeout: 120_000 });
    check("only: /create signed out shows Google's button", (await redirectButton(page).count()) === 0);
    await ctx.close();

    const ctx2 = await desk();
    await wire(ctx2, { gis: "blocked" });
    const p2 = await ctx2.newPage();
    await p2.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await blockedLine(p2).waitFor({ timeout: 60_000 });
    check("only, Google's script blocked: a line saying what to do, no redirect button", (await redirectButton(p2).count()) === 0 && (await p2.locator(".googlebutton").count()) === 0);
    await shot(p2, "only-blocked", ".signin");
    {
      const p2n = await ctx2.newPage();
      await p2n.setViewportSize({ width: 280, height: 653 });
      await p2n.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await blockedLine(p2n).waitFor({ timeout: 60_000 });
      await doubleText(p2n);
      await p2n.waitForTimeout(500);
      const line = await p2n.evaluate(() => {
        const l = document.querySelector(".signin .error-line").getBoundingClientRect();
        const col = document.querySelector(".signin").getBoundingClientRect();
        return { inside: l.right <= col.right + 0.5 };
      });
      const linePast = await past(p2n);
      check("only, blocked, 280 at 200% text: the line (accounts.google.com) breaks inside its column, nothing past the screen", linePast.right <= 281 && line.inside, JSON.stringify({ ...line, ...linePast }));
      await shot(p2n, "only-blocked-280-text200", ".signin");
      await p2n.close();
    }
    // Signed in uninvited (dev sign-in) with Google's script blocked: the closed-beta screen keeps Sign out and says why.
    await p2.fill("#dev-email", outsider);
    await p2.getByRole("button", { name: "Dev sign-in" }).click();
    await closedTitle(p2).waitFor({ timeout: 60_000 });
    await blockedLine(p2).waitFor({ timeout: 60_000 });
    check(
      "only, Google's script blocked, closed beta: the line, Sign out, no Use another account",
      (await p2.getByRole("button", { name: "Use another account" }).count()) === 0 && (await p2.locator(".closed__actions .textbutton", { hasText: "Sign out" }).count()) === 1,
    );
    await shot(p2, "only-blocked-closed-beta", ".closed__who");
    await ctx2.close();
    check("only: never sent to Supabase's authorize, nothing left this PC", net.authorize.length === 0 && net.leaked.length === 0, net.leaked.join("; "));
    stop(proc);
  }
} catch (e) {
  check("the walk-through ran to the end", false, e?.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  for (const { child } of children.reverse()) stop(child);
  writeFileSync(tsconfig, tsconfigBefore);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; failed: ${failed.map((f) => f.name).join(" | ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
