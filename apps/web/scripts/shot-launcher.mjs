// Opens Robot Runner from its icon, presses Play, waits for the engine, screenshots.
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:3000/", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.click('button[aria-label="Open Robot Runner"]');
await p.waitForTimeout(800);
await p.screenshot({ path: "../../.impeccable/review/launcher-open.png" });
await p.click(".gameframe__play");
await p.waitForSelector(".gameframe[data-ready]", { timeout: 90000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: "../../.impeccable/review/launcher-playing.png" });
await b.close();
console.log("launcher captures written");
