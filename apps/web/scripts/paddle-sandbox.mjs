// The Paddle sandbox, end to end on this PC (apps/web/README.md "Plan and billing"): real sandbox checkouts with
// Paddle's test cards against this PC's own database, webhooks through apps/server/scripts/webhook-tunnel.mjs.
// The keys are development's: the root .env.local (PADDLE_ENV=sandbox, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, the
// five PADDLE_PRICE_*) and apps/web/.env.local (NEXT_PUBLIC_PADDLE_ENV, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN).
// Build the API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/paddle-sandbox.mjs stack      the API on :3062 and the
//        site on :3060 (`next dev`, .next/sandbox) on typeplay_sandbox, until stopped (Ctrl+C or taskkill)
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/paddle-sandbox.mjs explore    a checkout opened, the
//        overlay's fields listed and a picture taken (.impeccable/review/sandbox)
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/paddle-sandbox.mjs buy <email> plan:medium|pack [card]
//        a real overlay checkout (4242…: paid; 4000 0038 0000 0446: 3-D Secure, completed; 4000 0000 0000 0002: refused)
//   node apps/web/scripts/paddle-sandbox.mjs call <email> <METHOD> </path> [json]   one API request as the buyer
//   node apps/web/scripts/paddle-sandbox.mjs state <email>    the plan, the subscription, the credits, the payments
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/paddle-sandbox.mjs page <email> [/path]   text + picture
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/paddle-sandbox.mjs portal <email>   Paddle's portal links
// The buyers sign in with DEV_AUTH (any email). DATABASE_URL defaults to this PC's typeplay_sandbox (never the
// live database: the API refuses that anyway).
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = join(root, ".impeccable/review/sandbox");
mkdirSync(out, { recursive: true });
const SITE = "http://localhost:3060";
const API = "http://127.0.0.1:3062";
const DB = process.env.DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/typeplay_sandbox";
const [cmd, ...args] = process.argv.slice(2);

if (cmd === "stack") {
  const children = [];
  const start = (name, argv, cwd, env) => {
    const child = spawn(process.execPath, argv, { cwd, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
    child.stderr.on("data", (d) => process.stdout.write(`[${name}] ${d}`));
    children.push(child);
    return child;
  };
  const tsconfig = join(webDir, "tsconfig.json");
  const tsconfigBefore = readFileSync(tsconfig, "utf8");
  const stop = () => {
    for (const child of children.reverse()) {
      if (child.exitCode !== null) continue;
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      else child.kill("SIGKILL");
    }
    // `next dev` with its own NEXT_DIST_DIR adds its type folders to tsconfig.json: put the file back as it was.
    if (readFileSync(tsconfig, "utf8") !== tsconfigBefore) writeFileSync(tsconfig, tsconfigBefore);
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  start("api", ["dist/main.js"], serverDir, { PORT: "3062", DATABASE_URL: DB, DIRECT_URL: DB, DEV_AUTH: "1", AGENT_FAKE: "1", CORS_ORIGINS: SITE });
  start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", "3060"], webDir, {
    NEXT_DIST_DIR: ".next/sandbox",
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_API_ORIGIN: API,
    NEXT_PUBLIC_GAMES_ORIGIN: "http://127.0.0.1:3061",
  });
  // A file the other commands (and a person) can watch: it stops the stack when deleted... kept simple: Ctrl+C.
  setInterval(() => {}, 60_000);
} else {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => console.log("page error:", e.message));
  const signIn = async (email) => {
    await page.goto(`${SITE}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 180_000 });
    await page.fill("#dev-email", email);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
  };
  try {
    if (cmd === "explore") {
      const email = args[0] ?? `sandbox-explore-${Date.now().toString(36)}@typeplay.app`;
      await signIn(email);
      await page.goto(`${SITE}/billing/checkout?item=plan:medium&back=/billing`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator("input[type=checkbox]").first().check({ timeout: 60_000 });
      await page.getByRole("button", { name: /Continue to payment/ }).click();
      const frameEl = await page.waitForSelector("iframe[name=paddle_frame], iframe.paddle-frame", { timeout: 60_000 });
      const frame = await frameEl.contentFrame();
      const dump = async (f) =>
        f.evaluate(() =>
          [...document.querySelectorAll("input, select, button, iframe")].map((el) =>
            [el.tagName.toLowerCase(), el.getAttribute("type"), el.getAttribute("name"), el.getAttribute("data-testid"),
              el.getAttribute("aria-label") ?? el.getAttribute("placeholder") ?? el.getAttribute("title") ?? (el.tagName === "BUTTON" ? el.textContent?.trim().slice(0, 40) : "")].join(" | "),
          ),
        );
      await page.waitForTimeout(6000);
      await page.screenshot({ path: join(out, "overlay-1.png") });
      console.log("step 1:\n  " + (await dump(frame)).join("\n  "));
      await frame.getByRole("button", { name: "Continue" }).click();
      await page.waitForTimeout(8000);
      await page.screenshot({ path: join(out, "overlay-2.png") });
      console.log("step 2:\n  " + (await dump(frame)).join("\n  "));
      for (const f of page.frames()) if (f !== frame && f.parentFrame() === frame) console.log("child frame:", f.url().split("?")[0], "\n  " + (await dump(f).catch(() => [])).join("\n  "));
    } else if (cmd === "buy") {
      // A purchase through the real overlay: the details step (email and country are prefilled), then the card.
      const [email, item = "plan:medium", card = "4242424242424242"] = args;
      const name = item.replace(":", "-");
      await signIn(email);
      await page.goto(`${SITE}/billing/checkout?item=${item}&back=/billing`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.locator("input[type=checkbox]").first().check({ timeout: 60_000 });
      await page.getByRole("button", { name: /Continue to payment/ }).click();
      const frame = await (await page.waitForSelector("iframe[name=paddle_frame], iframe.paddle-frame", { timeout: 60_000 })).contentFrame();
      const details = frame.locator("[data-testid=combinedAuthenticationLocationFormSubmitButton]");
      const cardBox = frame.locator("[data-testid=cardNumberInput]");
      await Promise.race([details.waitFor({ timeout: 60_000 }), cardBox.waitFor({ timeout: 60_000 })]);
      if (await details.isVisible()) await details.click();
      await cardBox.waitFor({ timeout: 60_000 });
      await cardBox.fill(card);
      await frame.locator("[data-testid=cardholderNameInput]").fill("Sandbox Buyer");
      await frame.locator("[data-testid=expiryDateField]").fill("12/30");
      await frame.locator("[data-testid=cardVerificationValueInput]").fill("100");
      await page.screenshot({ path: join(out, `${name}-card.png`) });
      await frame.locator("[data-testid=cardPaymentFormSubmitButton]").click();
      const started = Date.now();
      // Our page after Paddle's checkout.completed: "Paid. Adding your credits…", then the done state (<main data-done>).
      // A refused card: Paddle's own message in its frame. 3-D Secure (4000 0038 0000 0446): the bank's challenge
      // opens in a frame inside Paddle's; the sandbox's has a button that completes it.
      let outcome = "timeout";
      let challenged = false;
      while (Date.now() - started < 150_000) {
        if (await page.locator("main[data-done]").count()) {
          outcome = "done";
          break;
        }
        if (await frame.getByText(/declined|was not successful|failed|try another|couldn.t|could not|unable to/i).first().isVisible().catch(() => false)) {
          outcome = "refused";
          break;
        }
        for (const f of page.frames()) {
          if (f === page.mainFrame() || f === frame || challenged) continue;
          const button = f.getByRole("button", { name: /complete|authori[sz]e|confirm|submit|success|approve/i }).first();
          if (await button.isVisible().catch(() => false)) {
            await page.screenshot({ path: join(out, `${name}-3ds.png`) });
            console.log(`3-D Secure challenge (${f.url().split("?")[0]}): "${(await button.textContent())?.trim()}" clicked`);
            await button.click();
            challenged = true;
          }
        }
        await page.waitForTimeout(1000);
      }
      await page.screenshot({ path: join(out, `${name}-${outcome}.png`) });
      console.log(`${item} with ${card.slice(-4)}: ${outcome} after ${Math.round((Date.now() - started) / 1000)} s`);
      if (outcome !== "done") console.log("Paddle says: " + (await frame.locator("body").innerText().catch(() => "")).split("\n").filter(Boolean).slice(0, 12).join(" | "));
      console.log((await page.locator("main").innerText().catch(() => "")).split("\n").filter(Boolean).slice(0, 8).join(" | "));
    } else if (cmd === "call") {
      // One API request as the buyer: what the billing page's buttons send (plan changes, cancel, keep).
      const [email, method, path, body] = args;
      const res = await fetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer dev:${email}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body || undefined,
      });
      console.log(res.status, (await res.text()).slice(0, 1500));
    } else if (cmd === "page") {
      // A page as the buyer sees it (default /billing): its text and a picture.
      const [email, path = "/billing"] = args;
      await signIn(email);
      await page.goto(`${SITE}${path}`, { waitUntil: "networkidle", timeout: 180_000 });
      await page.screenshot({ path: join(out, `page${path.replace(/\W+/g, "-")}.png`), fullPage: true });
      console.log((await page.locator("main").innerText().catch(() => "")).split("\n").map((s) => s.trim()).filter(Boolean).join(" | "));
    } else if (cmd === "portal") {
      // POST /billing/portal: Paddle's portal links (temporary log-ins: never printed), each opened and pictured.
      const [email] = args;
      const res = await fetch(`${API}/billing/portal`, { method: "POST", headers: { Authorization: `Bearer dev:${email}` } });
      const links = await res.json();
      console.log(res.status, Object.entries(links).map(([k, v]) => `${k}: ${v ? new URL(v).host : v}`).join(", "));
      for (const [k, v] of Object.entries(links)) {
        if (!v) continue;
        await page.goto(v, { waitUntil: "networkidle", timeout: 90_000 }).catch(() => {});
        await page.screenshot({ path: join(out, `portal-${k}.png`) });
        console.log(`${k}: ` + (await page.locator("body").innerText().catch(() => "")).split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 14).join(" | "));
      }
    } else if (cmd === "state") {
      // What the API says about a buyer: the plan, the subscription, the credits by part, the payments.
      const [email] = args;
      const call = (path) => fetch(`${API}${path}`, { headers: { Authorization: `Bearer dev:${email}` } }).then((r) => r.json());
      const [me, billing] = await Promise.all([call("/me"), call("/billing")]);
      console.log(JSON.stringify({ plan: me.plan, credits: me.credits, billing }, null, 1).slice(0, 4000));
    } else {
      console.log("usage: paddle-sandbox.mjs stack | explore [email] | buy <email> <item> [card] | call <email> <METHOD> <path> [json] | state <email> | page <email> [path] | portal <email>");
    }
  } finally {
    await browser.close();
  }
}
