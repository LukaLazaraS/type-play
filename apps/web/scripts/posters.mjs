// Poster images for the demo's four runner versions: screenshots of the running web builds.
// Usage: node scripts/posters.mjs   (games server must be running on 3001)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const slugs = ["demo-v0", "demo-v1-coins", "demo-v2-shield", "demo-v3-night"];
mkdirSync("public/games", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const slug of slugs) {
  const page = await browser.newPage({ viewport: { width: 1128, height: 564 } });
  await page.goto(`http://127.0.0.1:3001/play.html?g=${slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("status")?.hidden === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  // Start the run so the poster shows play, not the title: Space is "jump/start" in these games.
  await page.click("#canvas");
  await page.keyboard.press("Space");
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `public/games/${slug}.jpg`, type: "jpeg", quality: 82 });
  console.log("wrote", slug);
  await page.close();
}
await browser.close();
