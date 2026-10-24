// The Android screens, end to end, with screenshots: the pill on the game page, the Free plan
// panel, setup (the names, "Use my own" and a bad package name, an uploaded icon), an APK build
// queued → building → done with its checks, the download, the phone link and its QR code (fetched
// without sign-in), the key zip, an AAB and the package lock (a change asks first), a failing build
// and its Details, Stop on a running build, the game page while a build runs, then phones and 320 px.
// The API under test must run with the Android fake (a stub job and signer: no JDK, no Godot):
//   DEV_AUTH=1 AGENT_FAKE=1 ANDROID_EXPORT=1 ANDROID_FAKE=1 ANDROID_KEY_MASTER=<64 hex> node apps/server/dist/main.js
// Part of shot-app.mjs (which calls androidPart), or alone, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-android.mjs [outDir] [siteUrl] [apiUrl]
import { chromium } from "playwright";
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { useDevEnv } from "./dev-env.mjs";

/**
 * A square PNG made here, so the test needs no picture file. `rgb` is one colour, or a function of
 * (x, y, size) that gives each pixel's colour (the Sub filter keeps a drawn picture well under 1 MB).
 */
export function squarePng(size = 512, rgb = [255, 90, 54]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const rows = [];
  for (let y = 0; y < size; y++) {
    const line = Buffer.from(Array.from({ length: size }, (_, x) => (typeof rgb === "function" ? rgb(x, y, size) : rgb)).flat());
    const filtered = Buffer.alloc(line.length + 1);
    filtered[0] = 1; // Sub: each byte minus the one a pixel to its left
    for (let i = 0; i < line.length; i++) filtered[i + 1] = (line[i] - (i >= 3 ? line[i - 3] : 0)) & 255;
    rows.push(filtered);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}

/** A game-like icon: a dusk gradient (indigo to orange) with a white play triangle, so a tile shows more than one colour. */
export function iconPixel(x, y, size) {
  const u = x / size;
  const v = y / size;
  const t = Math.min(1, Math.max(0, v * 0.8 + u * 0.2));
  const inside = (ax, ay, bx, by, cx, cy) => {
    const d = (px, py, qx, qy, rx, ry) => (px - rx) * (qy - ry) - (qx - rx) * (py - ry);
    const d1 = d(u, v, ax, ay, bx, by);
    const d2 = d(u, v, bx, by, cx, cy);
    const d3 = d(u, v, cx, cy, ax, ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  if (inside(0.38, 0.27, 0.38, 0.73, 0.74, 0.5)) return [255, 255, 255];
  return [Math.round(42 + 213 * t), Math.round(27 + 63 * t), Math.round(92 - 38 * t)];
}

/** The file name the API gives downloads: the game's name as a slug. */
const slugOf = (name) =>
  name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The part's own test user; the caller closes it at the end, whatever happened. */
export const droidEmail = (stamp) => `droid-${stamp}@dev.test`;

/** Runs the Android part with the test user `email`. The rest are shot-app's helpers: check, shot, devSignIn, admin. */
export async function androidPart({ browser, base, apiBase, email, check, shot, devSignIn, admin, stamp }) {
  const health = await fetch(`${apiBase}/health`).then((r) => r.json()).catch(() => null);
  check("the API under test builds Android apps with the fake (start it with ANDROID_EXPORT=1 ANDROID_FAKE=1 ANDROID_KEY_MASTER=<64 hex>)", health?.android?.enabled === true);
  if (!health?.android?.enabled) return;
  // The one-build-a-minute guard, moved out of the way between builds (this game's rows aged by 2 minutes), as the API's own e2e does.
  await useDevEnv();
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const age = (projectId) => db.query('update "AndroidBuild" set "queuedAt" = now() - interval \'2 minutes\' where "projectId" = $1', [projectId]);
  const api = (method, path, body) =>
    fetch(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("page error (android):", e.message));
  const ICON = squarePng(512, iconPixel);
  // The helpers take a page: hand them something that screenshots one element.
  // (Next's dev-mode "N" badge floats over the corner of a page: hidden, it is not part of the card.)
  const shotOf = async (locator, name) => {
    await locator.page().evaluate(() => document.querySelectorAll("nextjs-portal").forEach((e) => (e.style.display = "none")));
    await shot({ screenshot: ({ path }) => locator.screenshot({ path }) }, name);
  };
  // Every request the page makes for the app's icon (the API sends it only to the signed-in owner).
  const iconRequests = [];
  page.on("request", (r) => /\/projects\/[^/]+\/android\/icon$/.test(r.url()) && r.method() === "GET" && iconRequests.push(r.url()));
  try {
    // A game to export (the fake run builds it in seconds)
    await devSignIn(page, email, "Make an endless runner where a cat jumps over boxes");
    await page.getByRole("button", { name: "Build my game" }).click();
    await page.waitForURL(/\/games\/[a-z0-9]+$/, { timeout: 30_000 });
    const gameUrl = page.url();
    const gameId = gameUrl.split("/").pop();
    const androidUrl = `${gameUrl}/android`;
    await page.locator(".msg__meta", { hasText: "version 1" }).waitFor({ timeout: 60_000 });
    const gameName = await page.locator(".stage__name").innerText();
    const slug = slugOf(gameName);

    // The pill on the game page, then the Free plan panel
    const pill = page.locator(`a.inkpill[href="/games/${gameId}/android"]`);
    check("the Android pill sits in the game's bar (the API says features.android)", (await pill.count()) === 1 && (await pill.innerText()).trim() === "Android");
    await pill.click();
    await page.waitForURL(/\/android$/, { timeout: 15_000 });
    await page.locator('[data-panel="plan"]').waitFor({ timeout: 30_000 });
    check("on Free: 'Android builds come with a plan' and See the plans → /billing", (await page.locator('[data-panel="plan"] h2').innerText()) === "Android builds come with a plan." && (await page.getByRole("link", { name: "See the plans" }).getAttribute("href")) === "/billing?change=1");
    check("the page is named after the game", (await page.title()) === `Android: ${gameName} | TypePlay` && (await page.locator(".droid__back").innerText()).includes(gameName));
    await page.waitForTimeout(300);
    await shot(page, "android-plan-desktop");
    const planned = admin("plan", email, "medium");
    check("admin: plan medium", planned.status === 0, planned.stderr.slice(-300));

    // Setup: the names, Use my own, a bad name, the icon
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".droid__setup").waitFor({ timeout: 30_000 });
    // The game's name, cut to 30 at a word (the fake's names are whole prompts).
    const appName = gameName.length <= 30 ? gameName : gameName.slice(0, 30).replace(/ \S*$/, "");
    check("setup: the app name is the game's, cut at a word", (await page.inputValue("#droid-name")) === appName, await page.inputValue("#droid-name"));
    const suggested = await page.inputValue("#droid-package");
    check("setup: the suggested package name, read-only", new RegExp(`^app\\.typeplay\\.[a-z0-9_]{1,20}_${gameId}$`).test(suggested) && (await page.locator("#droid-package").getAttribute("readonly")) !== null, suggested);
    await page.getByRole("button", { name: "Use my own" }).click();
    check("Use my own: the field opens", (await page.locator("#droid-package").getAttribute("readonly")) === null);
    await page.fill("#droid-package", "com.example.cat");
    await page.locator("#droid-name").focus();
    const problem = await page.locator("#droid-package-hint").innerText();
    check("a com.example name is refused before sending", /Google Play doesn't allow/.test(problem), problem);
    await page.fill("#droid-package", `com.shots.cat${stamp}`);
    await page.setInputFiles('input[type="file"]', { name: "icon.png", mimeType: "image/png", buffer: ICON });
    await page.locator('.ident__tile img[src^="blob:"]').waitFor({ timeout: 10_000 });
    check("an uploaded 512×512 PNG shows in the tile", true);
    await page.setInputFiles('input[type="file"]', { name: "small.png", mimeType: "image/png", buffer: squarePng(300) });
    await page.locator(".ident__icon .field-hint--error").waitFor({ timeout: 5_000 });
    check("a 300×300 PNG is refused", /512×512/.test(await page.locator(".ident__icon .field-hint--error").innerText()));
    await page.waitForTimeout(200);
    await shot(page, "android-setup-desktop", true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await shot(page, "android-setup-phone", true);
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(300);
    check("setup at 320 px: nothing wider than the screen", await page.evaluate(() => document.documentElement.scrollWidth <= 320));
    await shot(page, "android-setup-320", true);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole("button", { name: "Set up Android" }).click();
    await page.locator(".droid__build").waitFor({ timeout: 30_000 });
    check("set up: the line says so, and the keyboard is on Build", (await page.locator(".droid__notice").innerText()) === "Android is set up. Build the APK to put the game on your phone." && (await page.evaluate(() => document.activeElement?.id)) === "droid-build", await page.evaluate(() => document.activeElement?.id ?? "none"));
    const identity = await page.locator(".droid__app").innerText();
    check("set up: the hub, with the name, com.shots.cat<stamp> and the uploaded icon", identity.includes(appName) && identity.includes(`com.shots.cat${stamp}`) && identity.includes("Your own PNG"), identity.replace(/\n/g, " | "));
    await page.getByRole("button", { name: "If you lose it" }).click();
    await page.locator(".droid__fingerprint").waitFor({ timeout: 5_000 });
    check("the key card: 'Not downloaded yet', and the fingerprint behind If you lose it", /([0-9A-F]{2}:){31}[0-9A-F]{2}/.test((await page.locator(".droid__fingerprint").innerText()).replace(/\s/g, "")) && (await page.locator(".droid__key").innerText()).includes("Not downloaded yet"));
    check("no builds yet", (await page.locator(".droid__builds").innerText()).includes("No builds yet"));
    await page.waitForTimeout(300);
    await shot(page, "android-hub-empty-desktop", true);

    // The icon on a later visit: this visit's upload is in memory; after a reload the card asks the API for the PNG (with the sign-in header) and shows that.
    const tile = page.locator(".droid__app .ident__tile");
    check("set up: the tile shows the uploaded icon from memory, no request for it", (await tile.locator('img[src^="blob:"]').count()) === 1 && iconRequests.length === 0, String(iconRequests.length));
    const [iconRes] = await Promise.all([
      page.waitForResponse((r) => /\/projects\/[^/]+\/android\/icon$/.test(r.url()) && r.request().method() === "GET", { timeout: 30_000 }),
      page.reload({ waitUntil: "domcontentloaded" }),
    ]);
    await tile.locator('img[src^="blob:"]').waitFor({ timeout: 15_000 });
    check("a later visit: the card asks the API for the icon with the sign-in header (200, image/png)", iconRes.status() === 200 && iconRes.headers()["content-type"] === "image/png" && ((await iconRes.request().allHeaders()).authorization ?? "").startsWith("Bearer dev:"), `${iconRes.status()} ${iconRes.headers()["content-type"]}`);
    const shownIcon = await tile.locator("img").evaluate(async (img) => ({ w: img.naturalWidth, bytes: (await (await fetch(img.src)).blob()).size }));
    check("…and the tile shows the very PNG that was uploaded (512 px, the same bytes)", shownIcon.w === 512 && shownIcon.bytes === ICON.length, JSON.stringify(shownIcon));
    check("…the card still names the source: your own PNG", /Your own PNG/.test(await page.locator(".droid__app").innerText()));
    await page.waitForTimeout(300);
    await shotOf(page.locator(".droid__app"), "android-this-app-1440");
    await page.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await page.locator('.droid__app .ident__icon .ident__tile img[src^="blob:"]').waitFor({ timeout: 5_000 });
    check("Change: the form's tile shows the stored icon too, with Upload another and Use the game's picture", (await page.locator(".droid__app .ident__icon").getByRole("button", { name: "Upload another" }).count()) === 1 && (await page.locator(".droid__app .ident__icon").getByRole("button", { name: "Use the game's picture" }).count()) === 1);
    await page.waitForTimeout(300);
    await shotOf(page.locator(".droid__app"), "android-this-app-edit-1440");
    await page.locator(".droid__app").getByRole("button", { name: "Cancel" }).click();
    await page.locator(".droid__app .droid__who").waitFor({ timeout: 5_000 });

    // An icon the API can't send: the card keeps working with the neutral icon.
    await page.route(/\/projects\/[^/]+\/android\/icon$/, (route) => route.abort());
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator(".droid__build").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);
    check("an icon that can't be fetched: the neutral icon in the tile, the rest of the card as ever", (await tile.locator("img").count()) === 0 && (await tile.locator("svg").count()) === 1 && /Your own PNG/.test(await page.locator(".droid__app").innerText()) && (await page.locator(".droid__app").getByRole("button", { name: "Change" }).isEnabled()));
    await page.unroute(/\/projects\/[^/]+\/android\/icon$/);
    await page.reload({ waitUntil: "domcontentloaded" });
    await tile.locator('img[src^="blob:"]').waitFor({ timeout: 15_000 });

    // This app at phone widths, with the real icon (the rule: 1440 above, then 390 and 320).
    for (const [w, h] of [
      [390, 844],
      [320, 640],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(350);
      await page.locator(".droid__app").scrollIntoViewIfNeeded();
      const box = await page.locator(".droid__app").boundingBox();
      const tileBox = await tile.boundingBox();
      const nameBox = await page.locator(".droid__appname").boundingBox();
      check(`this app at ${w} px: inside the screen with a side gutter, the tile beside the name, nothing wider than the screen`, !!box && !!tileBox && !!nameBox && box.x >= 15.5 && box.x + box.width <= w - 15.5 && tileBox.x + tileBox.width <= nameBox.x && Math.abs(tileBox.y + tileBox.height / 2 - (nameBox.y + nameBox.height / 2)) < 40 && (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)), JSON.stringify({ box, tileBox, nameBox }));
      await shotOf(page.locator(".droid__app"), `android-this-app-${w}`);
    }
    await page.setViewportSize({ width: 1440, height: 900 });

    // An APK: queued → building → done, the checks, the download
    await page.getByRole("button", { name: "APK for your phone" }).click();
    await page.locator(".droid__live").waitFor({ timeout: 10_000 });
    const live = await page.locator(".droid__live").innerText();
    check("the live state: waiting or building, a clock, Stop, 'You can leave this page'", /Waiting for its turn|Building|Signing/.test(live) && /\d:\d\d/.test(live) && /You can leave this page/.test(live), live.replace(/\n/g, " | "));
    await shot(page, "android-building-desktop");
    await page.locator('.builds__row[data-status="done"][data-format="apk"]').waitFor({ timeout: 60_000 });
    await page.locator(".droid__live").waitFor({ state: "detached", timeout: 10_000 });
    const row = page.locator('.builds__row[data-format="apk"]').first();
    const rowText = await row.innerText();
    check("the row: Ready, version 1, build 1 (1.1), a size, download within 30 days, your PNG", /Ready/.test(rowText) && /version 1 · build 1 \(1\.1\)/.test(rowText) && /\d+ (B|KB|MB)/.test(rowText) && /Download it within (29|30) days/.test(rowText) && /icon: your PNG/.test(rowText), rowText.replace(/\n/g, " | "));
    await row.getByRole("button", { name: "Checks" }).click();
    await row.locator(".checks").waitFor({ timeout: 5_000 });
    check("checks: 8, all good, incl. 'Signed with your upload key'", (await row.locator(".checks__item[data-ok]").count()) === 8 && (await row.locator(".checks").innerText()).includes("Signed with your upload key"));
    await page.waitForTimeout(300);
    await shot(page, "android-hub-desktop", true);
    const [apk] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), row.getByRole("button", { name: "Download" }).click()]);
    const apkPath = await apk.path();
    check(`download: ${slug}-v1.apk, the signed file`, apk.suggestedFilename() === `${slug}-v1.apk` && (apkPath ? readFileSync(apkPath).includes("SIGNED-FAKE") : false), apk.suggestedFilename());

    // The phone link: opened by the download itself; the QR code and the link, usable without sign-in
    await row.locator(".qr").waitFor({ timeout: 15_000 });
    check("after a download the phone panel opens by itself, the steps first", (await row.locator('[aria-expanded="true"]').innerText()) === "Phone link");
    const linkUrl = await row.locator(".qr").getAttribute("data-text");
    check("phone link: a 10-minute link on the API, as a QR code and in the box", new RegExp(`^${apiBase}/android/dl/[A-Za-z0-9_-]{40,}$`).test(linkUrl ?? "") && (await row.locator(".qrpanel__link input").inputValue()) === linkUrl && /Good for (9|10) more minutes/.test(await row.locator(".qrpanel__life").innerText()), `${linkUrl} · ${await row.locator(".qrpanel__life").innerText()}`);
    check("the QR is a real code (version 5, 37 modules + the quiet zone)", (await row.locator(".qr").getAttribute("viewBox")) === "0 0 45 45");
    const phone = await fetch(linkUrl);
    check("the link needs no sign-in and serves the APK", phone.status === 200 && (phone.headers.get("content-disposition") ?? "").includes(`${slug}-v1.apk`) && (await phone.arrayBuffer()).byteLength > 0, String(phone.status));
    check("the install steps are there (allow your browser, Play Protect)", /allow it once/.test(await row.locator(".qrpanel__steps").innerText()) && /Play Protect/.test(await row.locator(".qrpanel__steps").innerText()));
    await page.waitForTimeout(300);
    await shot(page, "android-phone-link-desktop", true);
    await row.getByRole("button", { name: "Phone link" }).click();
    await row.locator(".qr").waitFor({ state: "detached", timeout: 5_000 });

    // The key
    const [key] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), page.getByRole("button", { name: "Download signing key" }).click()]);
    const keyPath = await key.path();
    check(`the key: ${slug}-upload-key.zip, a zip`, key.suggestedFilename() === `${slug}-upload-key.zip` && (keyPath ? readFileSync(keyPath).subarray(0, 2).toString() === "PK" : false), key.suggestedFilename());
    await page.locator(".droid__key", { hasText: "Downloaded once" }).waitFor({ timeout: 10_000 });
    check("the key card counts the download", true);

    // An AAB locks the package name: a change asks first
    await age(gameId);
    await page.getByRole("button", { name: "AAB for Google Play" }).click();
    await page.locator('.builds__row[data-status="done"][data-format="aab"]').waitFor({ timeout: 60_000 });
    const aabRow = page.locator('.builds__row[data-format="aab"]').first();
    check("the AAB row: build 2 (1.2), no Phone link (an AAB is for Google Play)", /build 2 \(1\.2\)/.test(await aabRow.innerText()) && (await aabRow.getByRole("button", { name: "Phone link" }).count()) === 0);
    await page.locator(".droid__app", { hasText: "Fixed by your first Play package" }).waitFor({ timeout: 10_000 });
    check("the package name is now fixed", true);
    await page.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await page.locator("#droid-package").waitFor({ timeout: 5_000 });
    await page.fill("#droid-package", `com.shots.cat${stamp}2`);
    await page.getByRole("button", { name: "Save" }).click();
    await page.locator(".ident__ask").waitFor({ timeout: 5_000 });
    check("changing it asks first: a new app on Google Play", /Google Play will treat it as a new app/.test(await page.locator(".ident__ask").innerText()));
    await page.waitForTimeout(200);
    await shot(page, "android-package-lock-ask-desktop");
    await page.getByRole("button", { name: "Change it anyway" }).click();
    await page.locator(".droid__package", { hasText: `com.shots.cat${stamp}2` }).waitFor({ timeout: 10_000 });
    check("…and goes through with the confirmation", true);

    // A failing build (the fake fails a game whose app name says FAIL), with its Details
    await page.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await page.fill("#droid-name", "Cat FAIL");
    await page.getByRole("button", { name: "Save" }).click();
    await page.locator(".droid__appname", { hasText: "Cat FAIL" }).waitFor({ timeout: 10_000 });
    await age(gameId);
    await page.getByRole("button", { name: "APK for your phone" }).click();
    await page.locator('.builds__row[data-status="failed"]').waitFor({ timeout: 60_000 });
    const failed = page.locator('.builds__row[data-status="failed"]').first();
    check("a failed build: the sentence from the server", /Ask for a fix in the chat/.test(await failed.innerText()));
    await failed.getByRole("button", { name: "Details" }).click();
    await failed.locator(".builds__log").waitFor({ timeout: 5_000 });
    check("Details: the log tail", /Parse Error/.test(await failed.locator(".builds__log").innerText()));
    check("a game-code failure offers Open the chat (to the game), not Build again", (await failed.getByRole("link", { name: "Open the chat" }).getAttribute("href")) === `/games/${gameId}` && (await failed.getByRole("button", { name: "Build again" }).count()) === 0);
    await page.waitForTimeout(300);
    await shot(page, "android-failed-desktop", true);
    await page.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await page.fill("#droid-name", "Cat Box App");
    await page.getByRole("button", { name: "Save" }).click();
    await page.locator(".droid__appname", { hasText: "Cat Box App" }).waitFor({ timeout: 10_000 });

    // Stop a running build
    await age(gameId);
    await page.getByRole("button", { name: "APK for your phone" }).click();
    await page.locator(".droid__live").getByRole("button", { name: "Stop" }).click();
    await page.locator('.builds__row[data-status="cancelled"]').waitFor({ timeout: 30_000 });
    check("Stop: the row says Stopped", /Stopped/.test(await page.locator('.builds__row[data-status="cancelled"]').first().innerText()));
    check("Build again on a stopped row; the game is idle again", (await page.locator('.builds__row[data-status="cancelled"]').first().getByRole("button", { name: "Build again" }).count()) === 1 && (await api("GET", `/projects/${gameId}`)).body?.status === "idle");
    const limits = (await api("GET", `/projects/${gameId}/android`)).body?.limits;
    check("limits counted down (4 builds today)", limits?.perGameToday === 6 && limits?.perUserToday === 26, JSON.stringify(limits));

    // The game page while an Android build runs (played back: the fake is over in two seconds)
    await page.route(`${apiBase}/projects/${gameId}`, async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const p = await res.json();
      await route.fulfill({ response: res, json: { ...p, status: "exporting" } });
    });
    await page.route(`${apiBase}/projects/${gameId}/events`, async (route) => {
      if (route.request().method() !== "GET") return route.continue(); // the CORS preflight goes to the API
      const p = (await api("GET", `/projects/${gameId}`)).body;
      await route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "text/event-stream" }, body: `data: ${JSON.stringify({ type: "snapshot", project: { ...p, status: "exporting" } })}\n\n` });
    });
    await page.goto(gameUrl, { waitUntil: "domcontentloaded" });
    await page.locator("#say-tip", { hasText: "An Android build is running" }).waitFor({ timeout: 30_000 });
    check("while a build runs: Send is off, typing is allowed, and the tip says why", (await page.locator("#say-tip").innerText()) === "An Android build is running. You can type your next change and send it when it's done." && (await page.getByRole("button", { name: "Send" }).isDisabled()) && (await page.locator("#say").isEnabled()));
    check("…the stage says it, and the Android pill is lit", /Building the Android version/.test(await page.locator(".stage__busy").innerText()) && (await page.locator(`a.inkpill[href="/games/${gameId}/android"][data-on]`).count()) === 1);
    await page.waitForTimeout(400);
    await shot(page, "game-android-exporting-desktop");
    await page.unrouteAll({ behavior: "ignoreErrors" });

    // Phones: the hub, the phone link, and 320 px
    const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await phoneCtx.newPage();
    p.on("pageerror", (e) => console.log("page error (android, phone):", e.message));
    await devSignIn(p, email);
    await p.goto(androidUrl, { waitUntil: "domcontentloaded" });
    await p.locator(".droid__build").waitFor({ timeout: 30_000 });
    await p.waitForTimeout(500);
    await shot(p, "android-hub-phone", true);
    const pRow = p.locator('.builds__row[data-status="done"][data-format="apk"]').first();
    await pRow.getByRole("button", { name: "Phone link" }).click();
    await pRow.locator(".qrpanel__steps").waitFor({ timeout: 15_000 });
    check("phone: the panel leads with the install steps and hides the code (nothing to scan with)", (await pRow.locator(".qr").isVisible()) === false && (await pRow.locator(".qrpanel__steps").isVisible()));
    await pRow.scrollIntoViewIfNeeded();
    await p.waitForTimeout(300);
    await shot(p, "android-phone-link-phone");
    await p.goto(gameUrl, { waitUntil: "domcontentloaded" });
    await p.locator(".ws__tabs").waitFor({ timeout: 30_000 });
    check("phone: the Android pill is in the bar (as an icon)", (await p.locator(`a.inkpill[href="/games/${gameId}/android"]`).isVisible()) === true);
    await p.setViewportSize({ width: 320, height: 640 });
    await p.goto(androidUrl, { waitUntil: "domcontentloaded" });
    await p.locator(".droid__build").waitFor({ timeout: 30_000 });
    await p.locator('.builds__row[data-status="failed"]').first().getByRole("button", { name: "Details" }).click();
    await p.waitForTimeout(400);
    check("the hub at 320 px: nothing wider than the screen", await p.evaluate(() => document.documentElement.scrollWidth <= 320));
    await shot(p, "android-hub-320", true);
    await phoneCtx.close();

    // Another icon, a light one: the card shows it at once, a later visit gets the new PNG from the API (not the old one), and the
    // tile keeps an edge on the white card.
    const LIGHT = squarePng(512, () => [250, 248, 255]);
    await page.goto(androidUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".droid__app").waitFor({ timeout: 30_000 });
    await page.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await page.setInputFiles('.droid__app input[type="file"]', { name: "light.png", mimeType: "image/png", buffer: LIGHT });
    await page.locator('.droid__app .ident__icon .ident__tile img[src^="blob:"]').waitFor({ timeout: 10_000 });
    await page.getByRole("button", { name: "Save" }).click();
    await page.locator('.droid__app .droid__who .ident__tile img[src^="blob:"]').waitFor({ timeout: 10_000 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.droid__app .droid__who .ident__tile img[src^="blob:"]').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(400);
    const lightBytes = await tile.locator("img").evaluate(async (img) => (await (await fetch(img.src)).blob()).size);
    check("another icon uploaded: a later visit shows the new PNG from the API, not the old one", lightBytes === LIGHT.length && lightBytes !== ICON.length, `${lightBytes} bytes, old ${ICON.length}`);
    const edge = await tile.evaluate((el) => ({ style: getComputedStyle(el).outlineStyle, width: getComputedStyle(el).outlineWidth, offset: getComputedStyle(el).outlineOffset }));
    check("a light icon keeps an edge on the white card: a hairline outline inside the tile", edge.style === "solid" && edge.width === "1px" && edge.offset === "-1px", JSON.stringify(edge));
    await shotOf(page.locator(".droid__app"), "android-this-app-light-1440");

    // "Use the game's picture": the tile goes back to the start screen, and a later visit asks the API for no icon at all.
    await page.locator(".droid__app").getByRole("button", { name: "Change" }).click();
    await page.getByRole("button", { name: "Use the game's picture" }).click();
    await page.locator('.droid__app .ident__tile img[src*="/builds/"]').waitFor({ timeout: 5_000 });
    await page.getByRole("button", { name: "Save" }).click();
    await page.locator('.droid__app .droid__who .ident__tile img[src*="/builds/"]').waitFor({ timeout: 10_000 });
    check("back to the game's picture: the tile shows the start screen, the card says so", /The game's start screen/.test(await page.locator(".droid__app").innerText()));
    iconRequests.length = 0;
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.droid__app .droid__who .ident__tile img[src*="/builds/"]').waitFor({ timeout: 15_000 });
    await page.waitForTimeout(500);
    check("a later visit with no uploaded icon makes no icon request (the start screen comes from the games origin)", iconRequests.length === 0, String(iconRequests.length));
  } finally {
    await ctx.close();
    await db.end();
  }
}

// Alone: a browser of its own, the same helpers as shot-app.mjs, and the test account closed at the end.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  const { spawnSync } = await import("node:child_process");
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
    spawnSync(process.execPath, [join(import.meta.dirname, "../../../node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], { cwd: serverDir, encoding: "utf8", env: { ...process.env, ADMIN_NAME: "shots" }, windowsHide: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const email = droidEmail(stamp);
  try {
    await androidPart({ browser, base, apiBase, email, check, shot, devSignIn, admin, stamp });
  } catch (e) {
    check(`the Android part ran through (${e.message})`, false);
  } finally {
    await browser.close();
    // Whatever happened, the test account goes (its game, builds, key and rows with it); 401 = never made.
    const closed = await fetch(`${apiBase}/me`, { method: "DELETE", headers: { Authorization: `Bearer dev:${email}`, "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) })
      .then((r) => r.status)
      .catch(() => 0);
    check("cleanup: the test account closed", closed === 200 || closed === 401, String(closed));
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed; screenshots in ${out}`);
  process.exit(failed.length ? 1 : 0);
}
