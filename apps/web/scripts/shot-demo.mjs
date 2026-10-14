// Captures the demo section mid-run and at the end: node scripts/shot-demo.mjs
import { chromium } from "playwright";
const b = await chromium.launch({ channel: "msedge", headless: true });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto("http://127.0.0.1:3000/#how", { waitUntil: "domcontentloaded" });
await p.waitForTimeout(1500);
await p.evaluate(() => document.getElementById("how").scrollIntoView({ block: "start" }));
await p.waitForTimeout(9000);
await p.screenshot({ path: "../../.impeccable/review/demo-mid.png" });
await p.waitForTimeout(26000);
await p.screenshot({ path: "../../.impeccable/review/demo-end.png" });
const m = await b.newPage({ viewport: { width: 390, height: 844 } });
await m.goto("http://127.0.0.1:3000/#how", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(1500);
await m.evaluate(() => document.getElementById("how").scrollIntoView({ block: "start" }));
await m.waitForTimeout(12000);
await m.screenshot({ path: "../../.impeccable/review/demo-mobile.png" });
await b.close();
console.log("demo captures written");
