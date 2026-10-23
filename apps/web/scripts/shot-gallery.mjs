// The public gallery, end to end, with screenshots: the gallery empty (when the database has no listed games),
// the Share menu's second switch (only once shared; on; the line under it), a play counted when the share page's
// frame says the game started (once per page view) and the count where the maker sees it, /explore signed out
// (the top game in its frame, listings with plays and genre, Popular and New), Report this game on the share
// page and from a listing (the dialog, a reason, the thanks, the row, a second report from the same visitor),
// an admin hide (out of the gallery, the share link still works, the maker's Share menu says so), the phone,
// then worst cases planted in the database: 300 games, 60-letter and unbreakable names, 9,999,999 plays,
// missing and broken pictures, a wide game on top, Show more, 320 px.
// The API under test: DEV_AUTH=1 AGENT_FAKE=1 (fake builds). Part of shot-app.mjs (galleryPart), or alone,
// through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-gallery.mjs [outDir] [siteUrl] [apiUrl]
import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const root = join(import.meta.dirname, "../../..");

/** The part's own test user; the caller closes it at the end, whatever happened. */
export const galleryEmail = (stamp) => `gallery-${stamp}@dev.test`;

/** Runs the gallery part with the test user `email`. The rest are shot-app's helpers: check, shot, devSignIn, admin. */
export async function galleryPart({ browser, base, apiBase, email, check, shot, devSignIn, admin, stamp }) {
  process.loadEnvFile(join(root, ".env"));
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const DATA = process.env.DATA_DIR || join(root, "data");
  const BUILDS = process.env.GAMES_BUILDS_DIR || join(root, "apps/games/builds");
  const api = (method, path, body) =>
    fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
      status: r.status,
      body: await r.json().catch(() => null),
    }));
  const listed = async () => (await fetch(`${apiBase}/public/gallery?sort=new&limit=48`).then((r) => r.json())).games ?? [];
  const plays = async (id) => (await db.query(`SELECT coalesce(sum(count), 0)::int AS n FROM "PlayCount" WHERE "projectId" = $1`, [id])).rows[0].n;
  const untilIdle = async (id) => {
    for (let i = 0; i < 120; i++) {
      if ((await api("GET", `/projects/${id}`)).body?.status === "idle") return;
      await new Promise((r) => setTimeout(r, 500));
    }
  };
  /** Clicks until the report dialog is open: a click that lands before the page has woken up does nothing
   * (a dev server's first compile of a page is slow). */
  const openReport = async (p, button) => {
    for (let i = 0; i < 10; i++) {
      await button.click();
      if (await p.locator("dialog.report[open]").waitFor({ timeout: 1500 }).then(() => true, () => false)) return;
    }
    throw new Error("the report dialog didn't open");
  };
  /** innerText with the figures' no-break spaces as plain ones. */
  const text = async (locator) => (await locator.innerText()).replace(/\u00a0/g, " ");
  // Next's dev-mode badge floats over a corner of the page: out of the pictures.
  const noBadge = (page) => page.evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none")));
  const worstId = `dev-gallery-worst-${stamp}`;
  const wideBuild = `wst${stamp}w-v1`;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const visitor = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  try {
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log("page error (gallery):", e.message));
    const v = await visitor.newPage();
    v.on("pageerror", (e) => console.log("page error (gallery visitor):", e.message));

    // ---- The gallery with nothing in it ----------------------------------------------------------
    if ((await listed()).length === 0) {
      await v.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await v.locator(".explore__empty").waitFor({ timeout: 60_000 });
      check("an empty gallery says so, with Make a game", (await v.locator(".explore__empty-title").innerText()) === "No games here yet." && (await v.getByRole("link", { name: "Make a game" }).getAttribute("href")) === "/create");
      check("/explore is kept out of search (noindex)", (await v.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex") === true);
      await noBadge(v);
      await shot(v, "explore-empty-desktop");
    } else console.log("skip: the database already has listed games, so the empty gallery isn't shown");

    // ---- A maker with three games ------------------------------------------------------------------
    await devSignIn(page, email, "Make an endless runner where a fox jumps over logs");
    admin("plan", email, "high"); // two builds at a time, no daily limit
    await page.getByRole("button", { name: "Build my game" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 30_000 });
    const gameUrl = page.url();
    const g1 = gameUrl.split("/").pop();
    const g2 = (await api("POST", "/projects", { prompt: "Make a match-3 puzzle with cute fruit", model: "fast" })).body?.id;
    await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
    const g3 = (await api("POST", "/projects", { prompt: "Make a racing game with tiny cars", model: "fast" })).body?.id;
    await untilIdle(g2);
    await untilIdle(g3);
    check("three games built (one through the page, two through the API)", !!g1 && !!g2 && !!g3);
    await api("PATCH", `/projects/${g1}`, { name: "Fox Log Jumper" });
    await api("PATCH", `/projects/${g2}`, { name: "Fruit Pop" });
    await api("PATCH", `/projects/${g3}`, { name: "Tiny Laps" });
    writeFileSync(join(DATA, "projects", g1, "GENRE"), "runner\n");
    writeFileSync(join(DATA, "projects", g2, "GENRE"), "puzzle\n");
    writeFileSync(join(DATA, "projects", g3, "GENRE"), "racer\n");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".stage__name", { hasText: "Fox Log Jumper" }).waitFor({ timeout: 30_000 });

    // ---- The Share menu: share first, then the gallery ---------------------------------------------
    const openShare = async (p = page) => {
      await p.getByRole("button", { name: /^(Share this game|Shared: change sharing)$/ }).click();
      await p.locator(`#share-${g1}:popover-open`).waitFor({ timeout: 5_000 });
      await p.waitForTimeout(220);
    };
    await openShare();
    check("not shared: no gallery switch yet", (await page.getByRole("switch", { name: "Show it in the gallery" }).count()) === 0);
    await page.getByRole("switch", { name: "Share this game" }).click();
    const gallerySwitch = page.getByRole("switch", { name: "Show it in the gallery" });
    await gallerySwitch.waitFor({ timeout: 10_000 });
    check("shared: the gallery switch appears, off", (await gallerySwitch.getAttribute("aria-checked")) === "false" && (await page.locator(`#gallery-state-${g1}`).innerText()).startsWith("Off"));
    await page.waitForTimeout(200);
    await shot(page, "game-share-gallery-off-desktop");
    await gallerySwitch.click();
    await page.locator(`[role="switch"][aria-labelledby="gallery-title-${g1}"][aria-checked="true"]`).waitFor({ timeout: 10_000 });
    check("the gallery switch on: it says anyone can find it on Explore", (await page.locator(`#gallery-state-${g1}`).innerText()) === "Anyone can find it on Explore.");
    check("the API has it listed", (await api("GET", `/projects/${g1}`)).body?.listed === true);
    await page.waitForTimeout(200);
    await shot(page, "game-share-gallery-on-desktop");
    await page.keyboard.press("Escape");

    // One game in the gallery (when nothing else is listed): the top game alone, no listings.
    if ((await listed()).length === 1) {
      await v.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await v.locator(".feature").waitFor({ timeout: 60_000 });
      check("one game in the gallery: it is the top game, with no listings under it", (await v.locator(".feature__name").innerText()) === "Fox Log Jumper" && (await v.locator(".glist").count()) === 0);
      check("a lone upright game still has its invitation beside it (and none at the end on a wide screen)", await v.evaluate(() => { const f = document.querySelector(".feature")?.getBoundingClientRect(); const m = document.querySelector(".explore__top .play__made")?.getBoundingClientRect(); const end = document.querySelector("main > .explore__made"); return !!f && !!m && m.left >= f.right && !!end && getComputedStyle(end).display === "none"; }));
      await noBadge(v);
      await shot(v, "explore-one-desktop");
    }
    for (const id of [g2, g3]) {
      await new Promise((r) => setTimeout(r, 30));
      await api("PATCH", `/projects/${id}`, { shared: true, listed: true });
    }

    // ---- A play: counted when the share page's frame says ready, once per page view ----------------
    const playOnce = async () => {
      await v.goto(`${base}/play/${g1}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await v.locator(".play__name").waitFor({ timeout: 60_000 });
      const sent = v.waitForResponse((r) => r.url().endsWith(`/public/games/${g1}/play`) && r.request().method() === "POST", { timeout: 120_000 });
      await v.getByRole("button", { name: /^Play / }).click();
      await v.locator(".gameframe[data-ready]").waitFor({ timeout: 90_000 });
      return (await sent).status();
    };
    const before = await plays(g1);
    check("the share page's game started: one play sent (204)", (await playOnce()) === 204);
    await v.waitForTimeout(500);
    check("the database counts it: one more play", (await plays(g1)) === before + 1);
    let second = 0;
    v.on("request", (r) => r.url().endsWith(`/public/games/${g1}/play`) && second++);
    await v.getByRole("button", { name: "Full screen" }).click();
    await v.waitForTimeout(1200);
    await v.keyboard.press("Escape");
    await v.waitForTimeout(600);
    check("the same page view: Full screen and back send no second play", second === 0 && (await plays(g1)) === before + 1);
    await playOnce();
    await v.waitForTimeout(500);
    check("a new page view counts again (2 plays)", (await plays(g1)) === before + 2);
    await v.reload({ waitUntil: "domcontentloaded" });
    await v.locator(".play__by").waitFor({ timeout: 60_000 });
    check("the share page says its plays", (await v.locator(".play__by").innerText()) === "Made with TypePlay · 2 plays", await v.locator(".play__by").innerText());
    check("the share page links to the gallery", (await v.getByRole("link", { name: "More games made with TypePlay" }).getAttribute("href")) === "/explore");
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".stage__version").waitFor({ timeout: 30_000 });
    check("the maker sees the plays in the game's bar", (await page.locator(".stage__version").innerText()) === "version 1 · 2 plays", await page.locator(".stage__version").innerText());
    await openShare();
    check("and in the Share menu, as figures", (await page.locator(`#share-${g1} .share__plays`).innerText()) === "2 plays");
    await page.keyboard.press("Escape");
    await page.goto(`${base}/games`, { waitUntil: "domcontentloaded" });
    await page.locator(".mine__grid a.app").first().waitFor({ timeout: 30_000 });
    check("and under the icon on /games", (await page.locator(".mine__grid a.app", { hasText: "Fox Log Jumper" }).locator(".app__stat").innerText()) === "2 plays");
    check("/games links to Explore", (await page.getByRole("link", { name: "Explore games" }).getAttribute("href")) === "/explore");
    await page.getByRole("button", { name: "Manage" }).click();
    await page.locator(".manage__row").first().waitFor({ timeout: 10_000 });
    check("Manage says shared, in the gallery, and the plays", (await page.locator(".manage__row", { hasText: "Fox Log Jumper" }).locator(".manage__meta").innerText()).includes("shared, in the gallery · 2 plays"));
    await noBadge(page);
    await shot(page, "games-manage-plays-desktop");

    // ---- /explore, signed out ------------------------------------------------------------------------
    await v.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await v.locator(".feature").waitFor({ timeout: 60_000 });
    check("/explore: its title", (await v.title()) === "Explore games | TypePlay", await v.title());
    check("Popular: the most played this week is on top, in its frame, with this week's plays", (await v.locator(".feature__name").innerText()) === "Fox Log Jumper" && (await text(v.locator(".feature__figures"))) === "2 plays this week · Runner", await text(v.locator(".feature__figures")));
    check("an upright top game sits beside the invitation (as on an upright share page)", await v.evaluate(() => { const f = document.querySelector(".feature")?.getBoundingClientRect(); const m = document.querySelector(".explore__top .play__made")?.getBoundingClientRect(); return !!f && !!m && m.left >= f.right && Math.abs(m.top - f.top) < 2; }));
    check("the top game's frame has its size (an upright game, beside its words)", await v.locator(".feature__frame").evaluate((f) => f.getBoundingClientRect().width > 200 && f.getBoundingClientRect().height > 350));
    const names = await v.locator(".glist__name").allInnerTexts();
    check("the others as listings: no plays this week says nothing, then the genre", names.includes("Fruit Pop") && names.includes("Tiny Laps") && (await text(v.locator(".glist", { hasText: "Fruit Pop" }).locator(".glist__meta"))) === "Puzzle");
    check("the page ends on the invitation as well", (await v.locator("main > .explore__made").count()) === 1);
    check("a listing opens the game's share page", (await v.getByRole("link", { name: "Play Tiny Laps" }).getAttribute("href")) === `/play/${g3}`);
    check("the order bar says Popular is the one shown", (await v.locator('.explore__sort a[aria-current="page"]').innerText()) === "Popular");
    await noBadge(v);
    await v.waitForTimeout(400);
    await shot(v, "explore-desktop");
    await shot(v, "explore-desktop-full", true);
    // While New is on its way (its request held for 2 s), its pill already looks chosen: paper with ink text.
    await v.route(/\/explore\?sort=new/, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.continue().catch(() => {});
    });
    await v.getByRole("link", { name: "New" }).click();
    await v.waitForTimeout(400);
    const pending = await v.evaluate(() => {
      const a = document.querySelector(".explore__sort a:has([data-pending])");
      const s = a && getComputedStyle(a);
      return s ? `${s.backgroundColor} ${s.color}` : "none";
    });
    check("New on its way: its pill takes the paper with ink text at once", pending === "rgb(255, 255, 255) rgb(23, 13, 51)", pending);
    await shot(v, "explore-sort-pending-desktop");
    await v.waitForURL(/\/explore\?sort=new$/, { timeout: 30_000 });
    await v.unroute(/\/explore\?sort=new/);
    await v.locator('.explore__sort a[aria-current="page"]', { hasText: "New" }).waitFor({ timeout: 30_000 });
    check("New: the latest to join the gallery on top", (await v.locator(".feature__name").innerText()) === "Tiny Laps" && (await text(v.locator(".feature__figures"))) === "Newest in the gallery · Racer", await text(v.locator(".feature__figures")));
    check("New: the listings say all their plays, over the genre", (await text(v.locator(".glist", { hasText: "Fox Log Jumper" }).locator(".glist__meta"))) === "2 plays\nRunner");
    await noBadge(v);
    await shot(v, "explore-new-desktop");

    // ---- Report this game: from a listing, then on the share page ----------------------------------
    await v.goto(`${base}/explore`, { waitUntil: "domcontentloaded" });
    await v.locator(".glist").first().waitFor({ timeout: 60_000 });
    const flag = v.getByRole("button", { name: "Report Fruit Pop" });
    await openReport(v, flag);
    const dialog = v.locator("dialog.report[open]");
    await v.waitForTimeout(250);
    check("a listing's flag opens the report for that game", (await dialog.locator(".report__title").innerText()) === "Report Fruit Pop");
    check("Send waits for a reason", await v.getByRole("button", { name: "Send report" }).isDisabled());
    await shot(v, "report-dialog-desktop");
    await v.keyboard.press("Escape");
    await v.waitForTimeout(300);
    check("Escape closes it, and the focus is back on the flag", (await dialog.count()) === 0 && (await v.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Report Fruit Pop");
    await v.goto(`${base}/play/${g2}`, { waitUntil: "domcontentloaded" });
    await openReport(v, v.getByRole("button", { name: "Report this game" }));
    await v.locator(".report__reason", { hasText: "Copies someone else's characters, art or music" }).click();
    await v.locator("dialog.report textarea").fill("The fruit look like the ones in Fruit Ninja");
    check("a reason picked: Send is ready", await v.getByRole("button", { name: "Send report" }).isEnabled());
    await v.waitForTimeout(200);
    await shot(v, "report-filled-desktop");
    await v.getByRole("button", { name: "Send report" }).click();
    await dialog.locator('[role="status"]').waitFor({ timeout: 15_000 });
    check("sent: Thanks for telling us", (await dialog.locator(".report__title").innerText()) === "Thanks for telling us.");
    await v.waitForTimeout(300); // the thanks' 160 ms fade
    await shot(v, "report-sent-desktop");
    const rows = (await db.query(`SELECT reason, text FROM "GameReport" WHERE "projectId" = $1`, [g2])).rows;
    check("database: the report, its reason and its words, nothing about the sender", rows.length === 1 && rows[0].reason === "copied" && rows[0].text === "The fruit look like the ones in Fruit Ninja");
    await v.getByRole("button", { name: "Close" }).click();
    await openReport(v, v.getByRole("button", { name: "Report this game" }));
    await v.locator(".report__reason", { hasText: "Something else" }).click();
    await v.getByRole("button", { name: "Send report" }).click();
    await dialog.locator('[role="status"]').waitFor({ timeout: 15_000 });
    check("the same visitor again: thanked, not stored twice", /already have your report/.test(await dialog.locator(".report__text").innerText()) && (await db.query(`SELECT count(*)::int AS n FROM "GameReport" WHERE "projectId" = $1`, [g2])).rows[0].n === 1);
    await v.keyboard.press("Escape");

    // ---- An admin takes a game out of the gallery --------------------------------------------------
    check("admin gallery hide", admin("gallery", "hide", g3, "shots").status === 0);
    await v.goto(`${base}/explore`, { waitUntil: "domcontentloaded" });
    await v.locator(".feature").waitFor({ timeout: 60_000 });
    check("hidden: out of the gallery", !(await v.locator(".glist__name").allInnerTexts()).includes("Tiny Laps") && (await v.locator(".feature__name").innerText()) !== "Tiny Laps");
    const still = await v.goto(`${base}/play/${g3}`, { waitUntil: "domcontentloaded" });
    check("hidden: its share page still works (200)", still?.status() === 200);
    await page.goto(`${base}/games/${g3}`, { waitUntil: "domcontentloaded" });
    await page.locator(".stage__name").waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: /^(Share this game|Shared: change sharing)$/ }).click();
    await page.locator(`#share-${g3}:popover-open`).waitFor({ timeout: 5_000 });
    await page.waitForTimeout(220);
    check("the maker's Share menu says it was taken out", (await page.locator(`#gallery-state-${g3}`).innerText()) === "We took it out of the gallery after a report.");
    const hiddenSwitch = page.getByRole("switch", { name: "Show it in the gallery" });
    check("and its switch reads off and waits", (await hiddenSwitch.getAttribute("aria-checked")) === "false" && (await hiddenSwitch.isDisabled()));
    await shot(page, "game-share-gallery-hidden-desktop");
    await page.keyboard.press("Escape");
    admin("gallery", "unhide", g3);

    // ---- Phones ------------------------------------------------------------------------------------
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      const p = await phone.newPage();
      p.on("pageerror", (e) => console.log("page error (gallery phone):", e.message));
      await p.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await p.locator(".feature").waitFor({ timeout: 60_000 });
      await noBadge(p);
      await p.waitForTimeout(400);
      await shot(p, "explore-phone");
      await shot(p, "explore-phone-full", true);
      check("phone: nothing wider than the screen", await p.evaluate(() => document.documentElement.scrollWidth <= 390));
      await openReport(p, p.getByRole("button", { name: "Report Fruit Pop" }));
      await p.waitForTimeout(250);
      await shot(p, "report-dialog-phone");
      await p.keyboard.press("Escape");
      await p.goto(`${base}/play/${g1}`, { waitUntil: "domcontentloaded" });
      await p.locator(".play__name").waitFor({ timeout: 60_000 });
      await noBadge(p);
      await shot(p, "play-report-phone", true);
      await devSignIn(p, email);
      await p.goto(gameUrl, { waitUntil: "domcontentloaded" });
      await p.locator(".ws__tabs").waitFor({ timeout: 30_000 });
      await openShare(p);
      await shot(p, "game-share-gallery-phone");
      await p.keyboard.press("Escape");
    } finally {
      await phone.close();
    }

    // ---- Worst cases, planted: 300 games, long and unbreakable names, 9,999,999 plays, pictures missing
    // or broken, a wide game on top; then Show more, a phone and 320 px. -----------------------------
    const g1Build = (await api("GET", `/projects/${g1}`)).body?.buildId;
    mkdirSync(join(BUILDS, wideBuild), { recursive: true });
    for (const f of ["game.json", "index.pck"]) copyFileSync(join(BUILDS, "robot-runner", f), join(BUILDS, wideBuild, f));
    const widePoster = join(root, "packages/agent/output/runner-v2/export/screenshot-start.png");
    if (existsSync(widePoster)) copyFileSync(widePoster, join(BUILDS, wideBuild, "poster.png"));
    const names300 = [
      "The Extraordinarily Long Adventure of Captain Whiskerbottom!",
      "Supercalifragilisticexpialidociousmegaultrarunnerdeluxeedition",
      "A",
      "🐸 Frog Hop: the Lily Pad Leap 🐸",
      "კატის დიდი ხტუნვა",
      "ねこのジャンプ大冒険",
      "Space Rocks",
      "Untitled game 7",
    ];
    await db.query(`INSERT INTO "User" (id, email) VALUES ($1, $2)`, [worstId, `gallery-worst-${stamp}@dev.test`]);
    const n = 300;
    const ids = Array.from({ length: n }, (_, i) => `wst${stamp}${String(i).padStart(3, "0")}`);
    const rowName = (i) => (i === 0 ? names300[0] : `${names300[i % names300.length]}${i % names300.length === 2 ? "" : ` ${i}`}`.slice(0, 60));
    const orient = ids.map((_, i) => (i === 0 || i % 9 === 4 ? "landscape" : "portrait"));
    const build = ids.map((_, i) => (orient[i] === "landscape" ? wideBuild : i % 7 === 3 ? `wst${stamp}gone-v1` : g1Build));
    const poster = ids.map((_, i) => i % 5 !== 2);
    await db.query(
      `INSERT INTO "Project" (id, "ownerId", name, orientation, "currentVersion", shared, "sharedAt", listed, "listedAt", "createdAt", "updatedAt")
       SELECT id, $2, name, o::"Orientation", 1, true, now(), true, now() AT TIME ZONE 'UTC' - (k || ' minutes')::interval, now(), now()
       FROM unnest($1::text[], $3::text[], $4::text[], $5::int[]) AS t(id, name, o, k)`,
      [ids, worstId, ids.map((_, i) => rowName(i)), orient, ids.map((_, i) => i + 10)],
    );
    await db.query(
      `INSERT INTO "Version" (id, "projectId", n, label, "buildId", commit, poster)
       SELECT gen_random_uuid()::text, id, 1, 'planted', b, 'planted', p FROM unnest($1::text[], $2::text[], $3::bool[]) AS t(id, b, p)`,
      [ids, build, poster],
    );
    await db.query(
      `INSERT INTO "PlayCount" ("projectId", day, count)
       SELECT id, (now() AT TIME ZONE 'UTC')::date, c FROM unnest($1::text[], $2::int[]) AS t(id, c)`,
      [ids, ids.map((_, i) => (i === 0 ? 9_999_999 : i < 4 ? [0, 1_234, 999_999, 12_345][i] : (n - i) * 3))],
    );
    for (const [i, g] of [[0, "towerdefence"], [1, "runner"], [2, "puzzle"], [3, "racer"]]) {
      mkdirSync(join(DATA, "projects", ids[i]), { recursive: true });
      writeFileSync(join(DATA, "projects", ids[i], "GENRE"), `${g}\n`);
    }
    await v.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await v.locator(".feature").waitFor({ timeout: 60_000 });
    check("worst case: the wide game on top with 9,999,999 plays says 10M plays", (await v.locator(".feature").getAttribute("data-orientation")) === "landscape" && (await text(v.locator(".feature__figures"))) === "10M plays this week · Tower defence", await text(v.locator(".feature__figures")));
    // A failed picture is swapped for the drawn tile a moment after it fails: wait for that, don't sample once.
    const noBroken = await v
      .waitForFunction(() => [...document.querySelectorAll(".glist__pic img")].every((i) => !(i.complete && i.naturalWidth === 0)), null, { timeout: 10_000 })
      .then(() => true, () => false);
    check("worst case: pictures that fail (before or after the page woke up) show the drawn tile, not a broken image", noBroken && (await v.locator(".glist__pic svg").count()) > 0);
    check("worst case: a 60-letter name on top stays inside the stage", await v.evaluate(() => { const n = document.querySelector(".feature__name"); const s = document.querySelector(".feature"); return !!n && !!s && n.getBoundingClientRect().right <= s.getBoundingClientRect().right + 1; }));
    const counts = await Promise.all([/^1\.2K\splays/, /^1M\splays/, /^12\.3K\splays/].map((t) => v.locator(".glist__meta", { hasText: t }).count()));
    check("worst case: big counts read short (1.2K, 1M, 12.3K)", counts.every((c) => c > 0), counts.join());
    const first = await v.locator(".glist").count();
    check("worst case: the first page is the top game and 23 listings", first === 23, String(first));
    await noBadge(v);
    await v.waitForTimeout(800);
    await shot(v, "explore-worst-desktop");
    await v.getByRole("button", { name: "Show more games" }).click();
    await v.waitForFunction((k) => document.querySelectorAll(".glist").length > k, first, { timeout: 30_000 });
    await v.getByRole("button", { name: "Show more games" }).click();
    await v.waitForFunction((k) => document.querySelectorAll(".glist").length > k + 24, first, { timeout: 30_000 });
    const shown = await v.locator(".glist__link").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    check("Show more twice: 24 more each time, no game twice", shown.length === first + 48 && new Set(shown).size === shown.length, String(shown.length));
    const clamped = await v.locator(".glist__name").evaluateAll((els) => els.every((e) => e.clientHeight <= Math.ceil(parseFloat(getComputedStyle(e).lineHeight) * 2) + 2));
    check("long names stop at two lines", clamped);
    await noBadge(v);
    await shot(v, "explore-worst-desktop-full", true);
    const small = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    try {
      const s = await small.newPage();
      await s.goto(`${base}/explore`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await s.locator(".feature").waitFor({ timeout: 60_000 });
      await noBadge(s);
      await s.waitForTimeout(600);
      await shot(s, "explore-worst-phone");
      await shot(s, "explore-worst-phone-full", true);
      await s.setViewportSize({ width: 320, height: 640 });
      await s.waitForTimeout(400);
      check("320 px: nothing wider than the screen", await s.evaluate(() => document.documentElement.scrollWidth <= 320));
      await shot(s, "explore-worst-320");
      await shot(s, "explore-worst-320-full", true);
      await openReport(s, s.locator(".glist__report").first());
      await s.waitForTimeout(250);
      check("320 px: the report dialog fits", await s.evaluate(() => { const d = document.querySelector("dialog.report[open]"); return !!d && d.getBoundingClientRect().width <= 320 && document.documentElement.scrollWidth <= 320; }));
      await shot(s, "report-dialog-320");
    } finally {
      await small.close();
    }
  } finally {
    await ctx.close();
    await visitor.close();
    // The planted rows go with their user (cascade); their folders and the wide build too.
    await db.query(`DELETE FROM "User" WHERE id = $1`, [worstId]).catch(() => {});
    rmSync(join(BUILDS, wideBuild), { recursive: true, force: true });
    for (let i = 0; i < 4; i++) rmSync(join(DATA, "projects", `wst${stamp}${String(i).padStart(3, "0")}`), { recursive: true, force: true });
    await db.end();
  }
}

// Alone: a browser of its own, the same helpers as shot-app.mjs, and the test account closed at the end.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const out = process.argv[2] ?? join(import.meta.dirname, "../../../.impeccable/review/app");
  const base = process.argv[3] ?? "http://localhost:3000";
  const apiBase = process.argv[4] ?? "http://127.0.0.1:3002";
  mkdirSync(out, { recursive: true });
  const stamp = Date.now().toString(36);
  const results = [];
  const check = (name, ok, detail = "") => {
    results.push({ name, ok });
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  };
  const shot = async (page, name, full = false) => {
    await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
    console.log("wrote", name);
  };
  const devSignIn = async (page, email, prompt = "Make an endless runner where a cat jumps over boxes") => {
    await page.goto(`${base}/create?prompt=${encodeURIComponent(prompt)}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    await page.locator("#dev-email").waitFor({ timeout: 60_000 });
    await page.fill("#dev-email", email);
    await page.getByRole("button", { name: "Dev sign-in" }).click();
    await page.getByRole("button", { name: "Build my game" }).waitFor({ timeout: 30_000 });
    await page.locator(".make__balance b").waitFor({ timeout: 30_000 });
  };
  const serverDir = join(import.meta.dirname, "../../server");
  const admin = (...args) =>
    spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const email = galleryEmail(stamp);
  try {
    await galleryPart({ browser, base, apiBase, email, check, shot, devSignIn, admin, stamp });
  } catch (e) {
    check(`the gallery part ran through (${e.message})`, false);
  } finally {
    await browser.close();
    // Whatever happened, the test account goes (its games, builds, plays, reports and rows with it); 401 = never made.
    const closed = await fetch(`${apiBase}/me`, { method: "DELETE", headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) })
      .then((r) => r.status)
      .catch(() => 0);
    check("cleanup: the test account closed", closed === 200 || closed === 401, String(closed));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${out}`);
  process.exit(failed.length ? 1 : 0);
}
