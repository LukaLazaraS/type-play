// Pair developing (2026-11-04; docs/design/pair-developing.md), end to end with screenshots, on a stack of its own on ports
// picked free and a database of its own (dev-env.mjs useOwnStack), so the local site and other runs are never touched:
// the API (DEV_AUTH=1, AGENT_FAKE=1: fake builds), the games origin, the site (`next dev` with its own NEXT_DIST_DIR,
// .next/members; tsconfig.json is put back afterwards). Build the API first (npm run build -w @typeplay/server), then,
// through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-members.mjs [outDir]
// Shots in .impeccable/review/members/. Two browsers, the owner's and a friend's, at 1440 and 390 px: the owner invites
// the friend from the chat header's People panel (the link to send); the friend sees the invitation in My games and on
// the link's page, accepts and lands in the game; both send a change and the chat says who sent each; the friend's
// composer says whose credits pay and has no Share or Android; My games shows the game under Shared with you; the
// friend's People panel and leaving; a worst case with a long name and many people (break-ui); the smallest phones'
// tab bar (320, 360, 375px) with 1, 3 and 10 people in. No sideways scrolling anywhere. Afterwards the test accounts close.
import { chromium } from "playwright";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const webDir = join(root, "apps/web");
const serverDir = join(root, "apps/server");
const out = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : join(root, ".impeccable/review/members");
mkdirSync(out, { recursive: true });
const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("members", 3);
const base = `http://localhost:${SITE_PORT}`;
const apiBase = `http://127.0.0.1:${API_PORT}`;
// The dev sign-in names an account by its address's start: these read as people's names in the shots.
const OWNER = "luka@pair.test";
const FRIEND = "ana@pair.test";
const LONG = "maximilianalexandervonhohenstein@pair.test"; // the worst case's long name
const EXTRA = Array.from({ length: 9 }, (_, i) => `p${i + 1}@pair.test`); // a full game, for the smallest phones' tab bar
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const shot = async (page, name) => {
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none"))).catch(() => {});
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log("wrote", name);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
const api = (who, method, path, body) =>
  fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${who}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
const fits = async (page) => {
  const wide = await page.evaluate((vw) => {
    if (document.documentElement.scrollWidth <= vw + 1) return null;
    const pinned = (e) => {
      for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).position === "fixed") return true;
      return false;
    };
    const outside = [...document.querySelectorAll("body *")].filter((e) => e.getBoundingClientRect().right > vw + 1 && !pinned(e));
    return `${document.documentElement.scrollWidth}px: ${outside.slice(0, 6).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join(".")} (${Math.round(e.getBoundingClientRect().right)})`).join(", ")}`;
  }, page.viewportSize().width);
  if (wide) console.log("  too wide:", wide);
  return !wide;
};
/** A popover's panel inside the screen (12px off each side, as Popover places it). */
const inside = async (page, selector) => {
  const box = await page.locator(selector).boundingBox();
  const vw = page.viewportSize().width;
  return !!box && box.x >= 0 && box.x + box.width <= vw;
};
async function idle(who, id) {
  for (let i = 0; i < 150; i++) {
    const p = (await api(who, "GET", `/projects/${id}`)).body;
    if (p?.status === "idle" && !["running", "queued"].includes(p.messages?.at(-1)?.status)) return p;
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${id} never went idle`);
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
function stopAll() {
  for (const { child } of children.reverse()) {
    if (child.exitCode !== null) continue;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    else child.kill("SIGKILL");
  }
}
async function until(what, test, seconds, log) {
  for (let i = 0; i < seconds * 2; i++) {
    if (await test().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${what} did not start: ${log?.() ?? ""}`);
}
const tsconfig = join(webDir, "tsconfig.json");
const tsconfigBefore = readFileSync(tsconfig, "utf8");

let browser = null;
try {
  const apiProc = start("api", ["dist/main.js"], serverDir, { PORT: String(API_PORT), DEV_AUTH: "1", AGENT_FAKE: "1", ADMIN_EMAILS: "", CORS_ORIGINS: base, BILLING_JOBS: "0", BETA_INVITE_ONLY: "" });
  await until("the API", async () => (await (await fetch(`${apiBase}/health`)).json()).agent === "fake", 60, apiProc.log);
  const gamesProc = start("games", [join(root, "apps/games/scripts/serve.mjs"), String(GAMES_PORT)], root, {});
  await until("the games origin", async () => (await fetch(`http://127.0.0.1:${GAMES_PORT}/play.html`)).ok, 30, gamesProc.log);
  const siteProc = start("site", [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(SITE_PORT)], webDir, {
    NEXT_DIST_DIR: ".next/members",
    NEXT_PUBLIC_APP: "1",
    NEXT_PUBLIC_DEV_AUTH: "1",
    NEXT_PUBLIC_CLOSED_BETA: "",
    NEXT_PUBLIC_API_ORIGIN: apiBase,
    NEXT_PUBLIC_GAMES_ORIGIN: `http://127.0.0.1:${GAMES_PORT}`,
    NEXT_PUBLIC_PADDLE_ENV: "",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "",
  });
  await until("the site", async () => (await fetch(`${base}/pricing`)).ok, 180, siteProc.log);
  console.log(`stack up: site :${SITE_PORT}, API :${API_PORT}, games :${GAMES_PORT}`);
  for (const who of [OWNER, FRIEND, LONG]) await api(who, "GET", "/me");
  check("the owner: Medium + 60 credits", admin("plan", OWNER, "medium").status === 0 && admin("grant", OWNER, "60").status === 0);

  browser = await chromium.launch({ channel: "msedge", headless: true });
  async function signIn(page, who) {
    await page.goto(`${base}/create`, { waitUntil: "domcontentloaded", timeout: 180_000 });
    await page.locator("#dev-email").waitFor({ timeout: 120_000 });
    await page.fill("#dev-email", who);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.locator("#dev-email").waitFor({ state: "detached", timeout: 60_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 60_000 });
  }
  async function openGame(page, id, phone) {
    await page.goto(`${base}/games/${id}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    // A phone opens on Play when there is a game: the chat (and its header) is the other tab.
    if (phone) {
      const chat = page.locator(".ws__tabs").getByRole("tab", { name: "Chat" });
      await chat.waitFor({ timeout: 60_000 });
      await chat.click();
      await page.locator(".ws__chat .composer").waitFor({ timeout: 60_000 });
    } else await page.locator(".ws__head").waitFor({ timeout: 60_000 });
    await page.waitForTimeout(300);
  }
  // The open People panel (each layout has its own: the chat header's on a computer, the tab bar's on a phone).
  const panel = (page) => page.locator(".people:popover-open");
  // The people button: in the chat's header on a computer, at the end of the page's tab bar on a phone.
  const pad = (page) => page.locator(".ws__head .people__button, .ws__tabs .people__button").locator("visible=true");

  for (const [label, viewport, phone] of [
    ["1440", { width: 1440, height: 900 }, false],
    ["390", { width: 390, height: 844 }, true],
  ]) {
    const made = await api(OWNER, "POST", "/projects", { prompt: `Sky Hopper ${label}: a bird hops between clouds`, model: "fast" });
    await idle(OWNER, made.body.id);
    // A fake build names its game "Game" (the template's name): the name a real build would give it.
    const game = (await api(OWNER, "PATCH", `/projects/${made.body.id}`, { name: "Sky Hopper" })).body;
    const ctx = (who) => browser.newContext({ viewport, ...(phone ? { deviceScaleFactor: 2, isMobile: true, hasTouch: true } : {}) });
    const ownerCtx = await ctx(OWNER);
    const friendCtx = await ctx(FRIEND);
    const o = await ownerCtx.newPage();
    const f = await friendCtx.newPage();
    for (const p of [o, f]) p.on("pageerror", (e) => console.log("page error:", e.message));
    await signIn(o, OWNER);
    await signIn(f, FRIEND);

    // ---- The owner invites the friend from the chat header ----------------------------------------
    await openGame(o, game.id, phone);
    check(`${label}: the people button is there (Invite)`, (await pad(o).count()) === 1 && /Invite/.test((await pad(o).getAttribute("aria-label")) ?? ""));
    check(`${label}: the game page, no sideways scrolling`, await fits(o));
    await shot(o, `owner-header-${label}`);
    await pad(o).click();
    await o.locator(".people:popover-open").waitFor({ timeout: 10_000 });
    check(`${label}: the panel: Build it together`, /Build it together/.test(await panel(o).innerText()));
    await shot(o, `owner-panel-${label}`);
    // The visible address box is named by its own label (the page holds a second panel, for the other layout).
    check(
      `${label}: the address box's label is its own`,
      await panel(o)
        .locator("input[type=email]")
        .evaluate((el) => !!el.labels?.[0] && el.labels[0].closest(".people") === el.closest(".people") && /Google account/.test(el.labels[0].textContent ?? "")),
    );
    if (phone) {
      // The arrow keys in the panel move in the box, not the page's tabs (the panel sits in the tab bar).
      await panel(o).locator("input[type=email]").fill("abc");
      await panel(o).locator("input[type=email]").focus();
      await o.keyboard.press("ArrowLeft");
      check(
        `${label}: ← in the address box stays in it (the Chat tab stays chosen)`,
        (await o.locator(".ws__tabs [role=tab][aria-selected=true]").innerText()).trim() === "Chat" && (await o.evaluate(() => document.activeElement?.getAttribute("type"))) === "email",
      );
    }
    // A wrong address: the API's sentence under the box, not at the panel's end.
    await panel(o).locator("input[type=email]").fill(OWNER);
    await panel(o).getByRole("button", { name: "Invite", exact: true }).click();
    await panel(o).locator(".people__form .error-line").waitFor({ timeout: 10_000 }).catch(() => {});
    check(`${label}: inviting yourself: the error under the address box`, /your own address/.test((await panel(o).locator(".people__form .error-line").innerText().catch(() => "")) ?? ""));
    await shot(o, `invite-error-${label}`);
    await panel(o).locator("input[type=email]").fill(FRIEND);
    await panel(o).getByRole("button", { name: "Invite", exact: true }).click();
    await panel(o).locator(".people__link").waitFor({ timeout: 15_000 });
    const link = await panel(o).locator(".people__url input").inputValue();
    check(`${label}: the invitation's link to send`, /\/invite\/[A-Za-z0-9_-]{43}$/.test(link), link);
    await o.waitForTimeout(200);
    check(`${label}: …the keyboard on sending it (Share… or Copy link)`, /^(Share…|Copy link)$/.test((await o.evaluate(() => document.activeElement?.textContent ?? "")).trim()));
    await panel(o).locator(".people__list").getByText(FRIEND).waitFor({ timeout: 10_000 }).catch(() => {});
    check(`${label}: …and the waiting invitation in the list`, /Invited/.test(await panel(o).locator(".people__list").innerText()));
    check(`${label}: the panel inside the screen`, await inside(o, ".people:popover-open"));
    await shot(o, `invite-${label}`);
    await o.keyboard.press("Escape");

    // ---- The friend: My games shows the invitation; the link's page; Accept --------------------------
    await f.goto(`${base}/games`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await f.locator(".invites .invite").first().waitFor({ timeout: 30_000 });
    check(`${label}: My games: the invitation, with who pays`, /luka invites you to build/.test(await f.locator(".invite").first().innerText()) && /paid from luka's credits/.test(await f.locator(".invite").first().innerText()));
    check(`${label}: My games with the invitation, no sideways scrolling`, await fits(f));
    await shot(f, `mygames-invitation-${label}`);
    await f.goto(`http://${link.replace(/^https?:\/\//, "")}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await f.getByRole("button", { name: "Accept and open it" }).waitFor({ timeout: 30_000 });
    check(`${label}: the invitation page: the game and who pays`, /Build Sky Hopper together/.test(await f.locator("main").innerText()) && /paid from luka's credits/.test(await f.locator("main").innerText()));
    check(`${label}: the invitation page, no sideways scrolling`, await fits(f));
    await shot(f, `invitepage-${label}`);
    await f.getByRole("button", { name: "Accept and open it" }).click();
    await f.waitForURL(`**/games/${game.id}`, { timeout: 60_000 });
    if (phone) await f.locator(".ws__tabs").getByRole("tab", { name: "Chat" }).click();
    await f.locator(".ws__chat .composer").waitFor({ timeout: 60_000 });
    check(`${label}: accepted: the friend is in the game's editor`, (await f.locator("#say").count()) === 1);
    // The link again, once accepted: it opens the game (not "ended").
    await f.goto(`http://${link.replace(/^https?:\/\//, "")}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const back = await f.waitForURL(`**/games/${game.id}`, { timeout: 30_000 }).then(() => true).catch(() => false);
    check(`${label}: the link once accepted opens the game`, back, f.url());
    if (phone) await f.locator(".ws__tabs").getByRole("tab", { name: "Chat" }).click();
    await f.locator(".ws__chat .composer").waitFor({ timeout: 60_000 });
    check(`${label}: the friend has no Share and no Android (the owner's)`, (await f.getByRole("button", { name: /Share this game|Shared: change sharing/ }).count()) === 0 && (await f.getByRole("link", { name: /^Android/ }).count()) === 0);

    // ---- Both send a change: the chat says who sent each --------------------------------------------
    await f.locator("#say").fill("Give the bird a red hat");
    check(`${label}: the friend's cost says who pays`, /luka pays/.test(await f.locator(".composer__cost").innerText()), await f.locator(".composer__cost").innerText());
    await shot(f, `friend-composer-${label}`);
    await f.locator("#say").press("Enter");
    await f.locator(".msg--agent .bubble--live").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await openGame(o, game.id, phone);
    await o.locator(".msg--other").first().waitFor({ timeout: 30_000 });
    check(`${label}: the owner sees the friend's change, by name`, /ana/.test(await o.locator(".msg--other .msg__by").first().innerText()));
    check(`${label}: …and that the build is for ana`, await o.locator(".msg__meta", { hasText: "for ana" }).count().then((n) => n > 0));
    check(`${label}: the owner can still stop it (the owner stops any build)`, (await o.locator(".composer").getByRole("button", { name: "Stop" }).count()) === 1);
    await shot(o, `owner-sees-building-${label}`);
    await idle(OWNER, game.id);
    await o.waitForTimeout(800);
    await o.locator("#say").fill("Make the clouds pink");
    await o.locator("#say").press("Enter");
    await f.locator(".msg--other").first().waitFor({ timeout: 30_000 });
    await f.locator("#say-tip", { hasText: "change is building now" }).waitFor({ timeout: 15_000 }).catch(() => {});
    check(`${label}: the friend sees the owner's change, by name, and Stop isn't theirs`, /luka/.test(await f.locator(".msg--other .msg__by").first().innerText()) && (await f.locator(".composer").getByRole("button", { name: "Stop" }).count()) === 0);
    check(`${label}: …the friend's tip says whose change builds`, /luka's change is building now/.test(await f.locator("#say-tip").innerText()));
    await shot(f, `friend-sees-building-${label}`);
    await idle(OWNER, game.id);
    await o.waitForTimeout(1200);
    await f.waitForTimeout(1200);
    check(`${label}: the chat with two people, no sideways scrolling`, (await fits(o)) && (await fits(f)));
    await shot(o, `chat-two-owner-${label}`);
    await shot(f, `chat-two-friend-${label}`);

    // ---- The friend's People panel, and Shared with you --------------------------------------------
    await pad(f).click();
    await f.locator(".people:popover-open").waitFor({ timeout: 10_000 });
    check(`${label}: the friend's panel: who is in, whose game, Leave`, /People in this game/.test(await panel(f).innerText()) && (await panel(f).getByRole("button", { name: "Leave this game" }).count()) === 1);
    check(`${label}: the friend's panel holds no email`, !/@pair\.test/.test(await panel(f).innerText()));
    await shot(f, `friend-panel-${label}`);
    await f.keyboard.press("Escape");
    await f.goto(`${base}/games`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await f.locator("#mine-shared").waitFor({ timeout: 30_000 });
    check(`${label}: My games: Shared with you, the game, whose it is`, /Sky Hopper/.test(await f.locator("section[aria-labelledby=mine-shared]").innerText()) && /luka's game/.test(await f.locator("section[aria-labelledby=mine-shared]").innerText()));
    check(`${label}: Shared with you, no sideways scrolling`, await fits(f));
    await shot(f, `shared-${label}`);

    // ---- The owner's panel with the friend in, then the worst case (break-ui) ------------------------
    await openGame(o, game.id, phone);
    await pad(o).click();
    await o.locator(".people:popover-open").waitFor({ timeout: 10_000 });
    await panel(o).locator(".people__list").getByText(/this month/).first().waitFor({ timeout: 10_000 }).catch(() => {});
    check(`${label}: the owner's panel: the friend with their email and their credits this month`, /ana@pair\.test/.test(await panel(o).locator(".people__list").innerText()) && /this month/.test(await panel(o).locator(".people__list").innerText()));
    await shot(o, `owner-panel-with-friend-${label}`);
    await o.keyboard.press("Escape");
    // Worst case: a long name in, and the game full of invitations to long addresses.
    const longIn = await api(OWNER, "POST", `/projects/${game.id}/invites`, { email: LONG });
    await api(LONG, "POST", `/invites/${longIn.body.invite.id}/accept`);
    await api(LONG, "POST", `/projects/${game.id}/messages`, { text: "Add a very long level with lots of clouds, birds, a sunset and a boss at the end", model: "fast" });
    await idle(OWNER, game.id);
    for (let i = 0; i < 8; i++) await api(OWNER, "POST", `/projects/${game.id}/invites`, { email: `someone.with.a.really.long.address.${i}@a-very-long-domain-name.example.com` });
    await openGame(o, game.id, phone);
    await o.waitForTimeout(1000);
    check(`${label}: worst: the chat with a long name, no sideways scrolling`, await fits(o));
    await shot(o, `worst-chat-${label}`);
    await pad(o).click();
    await o.locator(".people:popover-open").waitFor({ timeout: 10_000 });
    await o.waitForTimeout(800);
    check(`${label}: worst: the full panel says so, inside the screen`, /10 people are in or invited/.test(await panel(o).innerText()) && (await inside(o, ".people:popover-open")));
    check(
      `${label}: worst: every long address shows whole (it wraps)`,
      await panel(o)
        .locator(".people__address")
        .evaluateAll((els) => els.length > 0 && els.every((e) => e.scrollWidth <= e.clientWidth + 1)),
    );
    check(`${label}: worst: the panel, no sideways scrolling`, await fits(o));
    await shot(o, `worst-panel-${label}`);
    await o.locator(".people:popover-open").evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await shot(o, `worst-panel-end-${label}`);
    await o.keyboard.press("Escape");

    // ---- The friend leaves ----------------------------------------------------------------------
    await openGame(f, game.id, phone);
    await pad(f).click();
    await f.locator(".people:popover-open").waitFor({ timeout: 10_000 });
    await panel(f).getByRole("button", { name: "Leave this game" }).click();
    await panel(f).locator(".ask").waitFor({ timeout: 5_000 });
    await shot(f, `friend-leave-ask-${label}`);
    await panel(f).locator(".ask").getByRole("button", { name: "Leave this game" }).click();
    await f.waitForURL(`**/games`, { timeout: 30_000 });
    check(`${label}: left: back on My games, the game gone from Shared with you`, await f.locator("#mine-shared").count().then((n) => n === 0));
    await ownerCtx.close();
    await friendCtx.close();
  }

  // ---- The smallest phones: the tab bar with the people pill fits at 320, 360 and 375px, alone, 3 in and 10 in ------
  const small = await api(OWNER, "POST", "/projects", { prompt: "Tab bar check: a ball bounces", model: "fast" });
  await idle(OWNER, small.body.id);
  let inGame = 1;
  const fill = async (upTo) => {
    for (; inGame < upTo; inGame++) {
      const who = EXTRA[inGame - 1];
      await api(who, "GET", "/me");
      const inv = await api(OWNER, "POST", `/projects/${small.body.id}/invites`, { email: who });
      await api(who, "POST", `/invites/${inv.body.invite.id}/accept`);
    }
  };
  const phoneCtx = await browser.newContext({ viewport: { width: 375, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const s = await phoneCtx.newPage();
  await signIn(s, OWNER);
  for (const people of [1, 3, 10]) {
    await fill(people);
    await s.goto(`${base}/games/${small.body.id}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await s.locator(".ws__tabs .people__button").waitFor({ timeout: 60_000 });
    for (const width of [320, 360, 375]) {
      await s.setViewportSize({ width, height: 740 });
      await s.waitForTimeout(400);
      const bar = await s.locator(".ws__tabs").evaluate((el) => {
        const edge = el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight);
        const parts = [...el.querySelectorAll(".ws__back, .pillbar__item, .people__button")].map((k) => k.getBoundingClientRect());
        return { spill: Math.round(Math.max(0, ...parts.map((k) => k.right - edge))), smallest: Math.round(Math.min(...parts.map((k) => k.width))) };
      });
      check(`${width}px, ${people} in the game: the tab bar holds the people pill (no spill, every part 44px or more), no sideways scrolling`, bar.spill === 0 && bar.smallest >= 44 && (await fits(s)), JSON.stringify(bar));
      await s.screenshot({ path: join(out, `tabbar-${people}in-${width}.png`), clip: { x: 0, y: 0, width, height: 150 } });
    }
  }
  await phoneCtx.close();
} catch (e) {
  check("the walk-through ran", false, e?.stack ?? String(e));
} finally {
  await browser?.close().catch(() => {});
  for (const who of [FRIEND, LONG, ...EXTRA, OWNER]) await api(who, "DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  stopAll();
  writeFileSync(tsconfig, tsconfigBefore);
}
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n${failed} FAILED` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
