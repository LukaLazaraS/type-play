// Screenshots of the public pages for design review: node scripts/shot.mjs [outDir] [baseUrl]
// Uses the installed Edge through Playwright (no browser download).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "../../.impeccable/review";
const base = process.argv[3] ?? "http://127.0.0.1:3000";
mkdirSync(out, { recursive: true });

const shots = [
  { name: "home-fold", path: "/", width: 1440, height: 900, full: false },
  { name: "desktop", path: "/", width: 1440, height: 900, full: true },
  { name: "mobile", path: "/", width: 390, height: 844, full: true },
  { name: "pricing", path: "/pricing", width: 1440, height: 900, full: true },
  { name: "pricing-mobile", path: "/pricing", width: 390, height: 844, full: true },
  { name: "terms", path: "/terms", width: 1440, height: 900, full: false },
  { name: "create", path: "/create?prompt=Make%20a%20tower%20defence%20game%20with%20cats", width: 1440, height: 900, full: false },
];

const browser = await chromium.launch({ channel: "msedge", headless: true });
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.width, height: s.height }, deviceScaleFactor: 1 });
  await page.goto(base + s.path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500); // fonts, the notification's entrance
  if (s.full) {
    // Walk the page so lazy images load, then return to the top.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += s.height) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(150);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: join(out, `${s.name}.png`), fullPage: s.full });
  await page.close();
  console.log("wrote", s.name);
}
await browser.close();
