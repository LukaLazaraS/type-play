// Brand images, drawn from the site's own parts: the favicon and app icons (the home screen's
// "Your game" mark: dusk sky, dunes, sun, robot) and the link-preview card (the home hero).
// Usage: node scripts/brand.mjs   (from apps/web; installed Edge through Playwright, Google Fonts online)
// Writes src/app/{favicon.ico, icon.svg, apple-icon.png, opengraph-image.png, twitter-image.png}
// and public/icons/{icon-192, icon-512, icon-maskable-512}.png. Re-run after a design change.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const app = "src/app/";
const icons = "public/icons/";
mkdirSync(icons, { recursive: true });

// The mark, on the BuildingIcon's 112 grid. `crop` zooms in for 16-48 px, where detail is lost.
const layers = `
  <rect width="112" height="112" fill="#2a1858"/>
  <rect y="44" width="112" height="68" fill="#572877"/>
  <path d="M0 86 C30 74 62 92 112 78 V112 H0Z" fill="#a63e68"/>
  <path d="M0 98 C40 92 80 100 112 94 V112 H0Z" fill="#f3a35c"/>
  <circle cx="80" cy="60" r="15" fill="#ffb347"/>
  <rect x="26" y="66" width="18" height="16" rx="3" fill="#8fd3ff"/>
  <rect x="30" y="70" width="4" height="4" fill="#170d33"/>
  <rect x="37" y="70" width="4" height="4" fill="#170d33"/>
  <rect x="28" y="84" width="5" height="8" fill="#170d33"/>
  <rect x="37" y="84" width="5" height="8" fill="#170d33"/>
  <rect x="34" y="58" width="2" height="8" fill="#170d33"/>
  <circle cx="35" cy="57" r="2.5" fill="#ff5a36"/>`;
const mark = ({ rounded = true, crop = false } = {}) => {
  const [x, y, s] = crop ? [14, 30, 82] : [0, 0, 112];
  const r = Math.round(s * 0.25);
  const body = rounded
    ? `<clipPath id="c"><rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${r}"/></clipPath><g clip-path="url(#c)">${layers}</g>`
    : layers;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${s} ${s}">${body}</svg>`;
};

// ICO with PNG images inside (every current browser and Google read it).
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const dir = images.map(({ size, png }) => {
    const e = Buffer.alloc(16);
    e[0] = e[1] = size >= 256 ? 0 : size;
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });
  return Buffer.concat([head, ...dir, ...images.map((i) => i.png)]);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function png(svg, size, { background = "transparent" } = {}) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:${background}">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  return page.screenshot({ omitBackground: background === "transparent" });
}

// Favicons: rounded and zoomed for the tab, full scene for icons people see large.
writeFileSync(app + "icon.svg", mark());
writeFileSync(app + "favicon.ico", ico([
  { size: 16, png: await png(mark({ crop: true }), 16) },
  { size: 32, png: await png(mark({ crop: true }), 32) },
  { size: 48, png: await png(mark({ crop: true }), 48) },
]));
// Apple and maskable icons are full-bleed squares: the system rounds or masks them itself.
writeFileSync(app + "apple-icon.png", await png(mark({ rounded: false }), 180));
writeFileSync(icons + "icon-192.png", await png(mark(), 192));
writeFileSync(icons + "icon-512.png", await png(mark(), 512));
writeFileSync(icons + "icon-maskable-512.png", await png(mark({ rounded: false }), 512));
console.log("wrote favicon.ico, icon.svg, apple-icon.png, public/icons/*");

// The link-preview card (1200x630): the home hero, condensed. Centered so square crops keep it.
const games = [...readFileSync("src/content/games.ts", "utf8").matchAll(
  /name: "([^"]+)"[\s\S]*?tier: "(\w+)",\s*minutes: ([\d.]+)[\s\S]*?icon: "([^"]+)"/g,
)].map(([, name, tier, minutes, icon]) => ({
  name, tier, minutes,
  src: `data:image/jpeg;base64,${readFileSync("public" + icon).toString("base64")}`,
}));
const byName = (n) => games.find((g) => g.name === n);
const tile = (g, x, y) => `<div class="tile" style="left:${x}px;top:${y}px"><img src="${g.src}"><b>${g.name}</b><i>${g.tier} · ${g.minutes} min</i></div>`;
const card = `<!doctype html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gabarito:wght@800;900&family=Onest:wght@400;600;700&family=Martian+Mono&display=block">
<style>
  * { box-sizing: border-box; margin: 0 }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; font-family: Onest, sans-serif;
    background: linear-gradient(#1c1240 0 175px, #2a1858 175px 280px, #3d206b 280px 365px, #572877 365px 450px, #6a2c7a 450px); }
  .stars i { position: absolute; width: 3px; height: 3px; border-radius: 50%; background: #fff; opacity: .7 }
  .word { position: absolute; left: 52px; top: 30px; font: 900 34px Gabarito; color: #fff; letter-spacing: -.02em }
  .word span { color: #ffb347 }
  .url { position: absolute; right: 52px; top: 42px; font: 400 15px "Martian Mono"; color: rgba(255,255,255,.78) }
  .card { position: absolute; left: 335px; top: 98px; width: 530px; padding: 36px 40px 34px; background: #fff; border-radius: 40px }
  h1 { font: 900 104px/0.9 Gabarito; letter-spacing: -.04em; color: #170d33 }
  h1 em { font-style: normal; color: #ff5a36; display: block }
  .ask { margin-top: 24px; font: 600 19px Onest; color: #170d33 }
  .prompt { margin-top: 12px; display: flex; align-items: center; gap: 14px; padding: 14px 14px 14px 20px; background: #f1ecfa; border-radius: 22px }
  .prompt p { flex: 1; font: 400 17px/1.35 Onest; color: #53476f }
  .prompt b { flex: none; padding: 12px 18px; border-radius: 16px; background: #ff5a36; color: #170d33; font: 700 17px Onest }
  .tile { position: absolute; width: 112px; text-align: center; color: #fff }
  .tile img { display: block; width: 112px; height: 112px; border-radius: 28px; object-fit: cover }
  .tile b { display: block; margin-top: 10px; font: 700 15px Onest; white-space: nowrap; margin-inline: -20px }
  .tile i { display: block; margin-top: 3px; font: 400 11px "Martian Mono"; font-style: normal; color: rgba(255,255,255,.78); white-space: nowrap; margin-inline: -20px }
  svg.ground { position: absolute; left: 0; bottom: 0 }
</style></head><body>
  <div class="stars">${[[120, 70], [300, 150], [880, 64], [1090, 120], [650, 60], [460, 40], [1010, 230], [70, 250]].map(([x, y]) => `<i style="left:${x}px;top:${y}px"></i>`).join("")}</div>
  <div class="word">Type<span>Play</span></div>
  <div class="url">typeplay.app</div>
  ${tile(byName("Robot Runner"), 52, 112)}${tile(byName("Fruit Match"), 186, 112)}
  ${tile(byName("Night Runner"), 52, 300)}${tile(byName("Fruit Match Night"), 186, 300)}
  ${tile(byName("Town Driver 3D"), 902, 112)}${tile(byName("Box Push"), 1036, 112)}
  ${tile(byName("Little Car"), 902, 300)}${tile(byName("Desert Dash"), 1036, 300)}
  <div class="card">
    <h1>Type it.<em>Play it.</em></h1>
    <div class="ask">What do you want to play?</div>
    <div class="prompt"><p>A tower defence game where cats guard a fish shop.</p><b>Make my game</b></div>
  </div>
  <svg class="ground" width="1200" height="150" viewBox="0 0 1200 150">
    <circle cx="960" cy="96" r="100" fill="#ffb347" opacity=".22"/>
    <circle cx="960" cy="96" r="78" fill="#ffb347"/>
    <path d="M0 70 C200 40 380 92 600 64 S980 30 1200 70 V150 H0Z" fill="#a63e68"/>
    <path d="M0 104 C240 82 470 118 720 98 S1050 84 1200 102 V150 H0Z" fill="#d9645a"/>
    <path d="M0 132 C300 118 640 140 900 126 S1120 122 1200 130 V150 H0Z" fill="#f3a35c"/>
  </svg>
</body></html>`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(card, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const og = await page.screenshot({ type: "png" });
writeFileSync(app + "opengraph-image.png", og);
writeFileSync(app + "twitter-image.png", og);
const alt = "TypePlay: type a game in one sentence, then play it in your browser.";
writeFileSync(app + "opengraph-image.alt.txt", alt);
writeFileSync(app + "twitter-image.alt.txt", alt);
console.log(`wrote opengraph-image.png + twitter-image.png (${Math.round(og.length / 1024)} KB)`);
await browser.close();
