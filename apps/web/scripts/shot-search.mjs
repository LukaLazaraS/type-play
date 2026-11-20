// What a search engine reads (2026-11-20: a share page is in search only while its game is in the gallery), from the
// HTML as served, no JavaScript and no browser: a gallery game's page says index and carries its title, description,
// canonical address, link preview and structured data (VideoGame, nothing about its maker); a game shared by link only
// and one an admin took out say noindex (the link-only one keeps its link preview); /explore is in search with one
// canonical for every view; sitemap.xml lists /explore and the gallery game and none of the others; an unshared game's
// page stays a 404; with the API down the share page and /explore answer 503 with Retry-After (a search engine keeps
// them and comes back) and the sitemap keeps the list it last read. Read as two kinds of crawler:
// one that runs no JavaScript (Bingbot: Next puts the metadata in <head> before it answers) and Googlebot (which runs
// it: Next may stream the metadata after the page's shell, still in the HTML as served).
// On a stack of its own (dev-env.mjs useOwnStack + startStack: a database of the run's own, ports picked free). Build
// the API first (npm run build -w @typeplay/server), then, through the CPU limiter:
//   node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-search.mjs
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { startStack, useOwnStack } from "./dev-env.mjs";

const root = join(import.meta.dirname, "../../..");
const serverDir = join(root, "apps/server");
const SITE = "https://typeplay.app";
const BOTS = {
  bingbot: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
};
const admin = (...args) =>
  spawnSync(process.execPath, [join(root, "node_modules/tsx/dist/cli.mjs"), "src/admin.ts", ...args], {
    cwd: serverDir,
    encoding: "utf8",
    env: { ...process.env, ADMIN_NAME: "shots" },
    windowsHide: true,
  });

// ---- Reading HTML the way a crawler does: the text as served -------------------------------------------------------
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const headOf = (html) => html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
/** A <meta name|property=key>'s content, or null. */
function meta(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const k = tag.match(/\b(?:name|property)="([^"]*)"/i)?.[1];
    if (k === key) return decode(tag.match(/\bcontent="([^"]*)"/i)?.[1] ?? "");
  }
  return null;
}
const canonical = (html) => decode(html.match(/<link\b[^>]*rel="canonical"[^>]*>/i)?.[0]?.match(/\bhref="([^"]*)"/i)?.[1] ?? "") || null;
const title = (html) => decode(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null;
const jsonLd = (html) =>
  [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  });
/** The page as a crawler gets it: status and text, no redirects followed, no script run. */
async function crawl(base, path, bot = "bingbot") {
  const res = await fetch(`${base}${path}`, { headers: { "User-Agent": BOTS[bot], Accept: "text/html,application/xml" }, redirect: "manual", signal: AbortSignal.timeout(120_000) });
  return { status: res.status, type: res.headers.get("content-type") ?? "", retry: res.headers.get("retry-after"), html: await res.text() };
}

const [SITE_PORT, API_PORT, GAMES_PORT] = await useOwnStack("search", 3);
const stamp = Date.now().toString(36);
const maker = `search-${stamp}@dev.test`;
let stack = null;
let apiBase = "";
let closed = false;
// Once more on a dropped connection: the admin CLI (spawnSync) holds this process past the API's keep-alive time, and the
// next request on the old connection finds it closed (ECONNRESET), as the server e2e's fetchAgain says.
const fetchAgain = (url, init) =>
  fetch(url, init).catch((e) => (["ECONNRESET", "UND_ERR_SOCKET"].includes(e?.cause?.code) ? fetch(url, init) : Promise.reject(e)));
const api = (method, path, body) =>
  fetchAgain(`${apiBase}${path}`, { method, headers: { Authorization: `Bearer dev:${maker}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined }).then(async (r) => ({
    status: r.status,
    body: await r.json().catch(() => null),
  }));
try {
  // The site reads the sitemap's list every time (SITEMAP_CACHE_SECONDS 0): each check sees the API as it is now.
  stack = await startStack("search", [SITE_PORT, API_PORT, GAMES_PORT], { site: { SITEMAP_CACHE_SECONDS: "0" } });
  apiBase = stack.apiBase;
  const { base } = stack;

  // ---- Four built games: in the gallery, shared by link only, taken out by an admin, never shared -------------------
  await api("GET", "/me");
  check("a maker on High (two builds at a time, no daily limit)", admin("plan", maker, "high").status === 0);
  // GENRE: the fake agent writes the word into the game's GENRE file, as run.mjs does with the genre skill it picked.
  const build = async (prompt) => (await api("POST", "/projects", { prompt, model: "fast" })).body?.id ?? null;
  const idle = async (id) => {
    for (let i = 0; i < 600 && id; i++) { // up to 5 minutes: two fake builds at once, held to below-normal priority
      const p = (await api("GET", `/projects/${id}`)).body;
      if (p?.status === "idle") return p;
      await new Promise((r) => setTimeout(r, 500));
    }
    return null;
  };
  const listed = await build("A stacking game with falling blocks GENRE:arcade");
  const linkOnly = await build("A little runner on the rooftops GENRE:runner");
  await idle(listed);
  await idle(linkOnly);
  const hidden = await build("A puzzle with sliding tiles GENRE:puzzle");
  const unshared = await build("A racing game with tiny cars GENRE:racer");
  const built = [await idle(listed), await idle(linkOnly), await idle(hidden), await idle(unshared)];
  check("four games built", built.every((p) => p?.buildId), built.map((p) => p?.buildId ?? "none").join(", "));
  await api("PATCH", `/projects/${listed}`, { name: "Pebble Drop", shared: true, listed: true });
  await api("PATCH", `/projects/${linkOnly}`, { name: "Roof Dash", shared: true });
  await api("PATCH", `/projects/${hidden}`, { name: "Tile Slide", shared: true, listed: true });
  await api("PATCH", `/projects/${unshared}`, { name: "Tiny Laps" });
  check("an admin takes Tile Slide out of the gallery", admin("gallery", "hide", hidden, "shots").status === 0);
  const pub = (await (await fetchAgain(`${apiBase}/public/games/${listed}`)).json().catch(() => null)) ?? {};
  check("the API: Pebble Drop is listed, an arcade game", pub.listed === true && pub.genre === "arcade", JSON.stringify({ listed: pub.listed, genre: pub.genre }));

  // ---- A gallery game's page -----------------------------------------------------------------------------------------
  const g = await crawl(base, `/play/${listed}`);
  const head = headOf(g.html);
  const want = {
    title: "Pebble Drop: play a free arcade game online | TypePlay",
    canonical: `${SITE}/play/${listed}`,
  };
  check("a gallery game's page: 200", g.status === 200, g.status === 200 ? "200" : `${g.status}
the site's last output:
${stack.siteLog().slice(-2500)}`);
  check("…says index (no noindex anywhere)", meta(head, "robots") === "index, follow" && !/noindex/i.test(g.html), meta(head, "robots") ?? "no robots tag");
  check("…its title: the name first, then the genre", title(head) === want.title, title(head) ?? "none");
  const desc = meta(head, "description") ?? "";
  check(
    "…its description: the name first, what you do in an arcade game, free, in the browser, no download, Made with TypePlay, at most 155 letters",
    desc.startsWith("Pebble Drop: chase a high score") && /free arcade game/.test(desc) && /browser/.test(desc) && /no download/.test(desc) && /Made with TypePlay/.test(desc) && [...desc].length <= 155,
    `${[...desc].length}: ${desc}`,
  );
  // The figures under the name, in the page as served: its genre, then Made with TypePlay.
  check("…its genre on the page, server-rendered (\"Arcade · Made with TypePlay\")", /<p class="figures play__by">Arcade(?:<!-- -->)? · (?:<!-- -->)?Made with TypePlay/.test(g.html), g.html.match(/<p class="figures play__by">[\s\S]{0,120}/)?.[0] ?? "no figures line");
  check("…its canonical address", canonical(head) === want.canonical, canonical(head) ?? "none");
  const ogImage = meta(head, "og:image") ?? "";
  check(
    "…the link preview: the same title and words, the game's picture",
    meta(head, "og:title") === "Pebble Drop: play a free arcade game online" && meta(head, "og:description") === desc && ogImage.startsWith(`${SITE}/play/${listed}/preview.png?v=`) && meta(head, "twitter:card") === "summary_large_image" && meta(head, "twitter:image") === ogImage,
    ogImage,
  );
  const preview = await fetch(`${base}${new URL(ogImage).pathname}${new URL(ogImage).search}`).catch(() => null);
  check("…its picture answers as a PNG", preview?.status === 200 && preview.headers.get("content-type") === "image/png", `${preview?.status} ${preview?.headers.get("content-type")}`);
  const ld = jsonLd(g.html).filter(Boolean);
  const graph = ld.flatMap((d) => d["@graph"] ?? [d]);
  const types = (d) => [d?.["@type"]].flat();
  const game = graph.find((d) => types(d).includes("VideoGame")) ?? {};
  const crumbs = graph.find((d) => d["@type"] === "BreadcrumbList")?.itemListElement ?? [];
  check(
    "…structured data: a VideoGame and WebApplication with its name, address, picture, genre, the web browser, free (0 USD), TypePlay as publisher",
    ld.length === 1 && types(game).join() === "VideoGame,WebApplication" && game.name === "Pebble Drop" && game.url === want.canonical && game.image === ogImage && game.genre === "Arcade" && game.gamePlatform === "Web browser" && game.isAccessibleForFree === true && game.offers?.price === 0 && game.offers?.priceCurrency === "USD" && game.publisher?.["@id"] === `${SITE}/#organization`,
    JSON.stringify(game).slice(0, 300),
  );
  check(
    "…its dates: published when it went into the gallery, modified not before that",
    Date.parse(game.datePublished) === Date.parse(pub.listedAt) && Date.parse(game.dateModified) >= Date.parse(game.datePublished),
    `${game.datePublished} / ${game.dateModified}`,
  );
  check(
    "…and the way to it: TypePlay, the gallery, the game",
    crumbs.map((c) => c.item).join(" ") === `${SITE}/ ${SITE}/explore ${want.canonical}` && crumbs[2]?.name === "Pebble Drop",
    crumbs.map((c) => c.name).join(" > "),
  );
  const ldText = JSON.stringify(ld);
  check(
    "…and nothing about its maker or the idea it was made from",
    !ldText.includes(maker) && !ldText.includes(maker.split("@")[0]) && !/stacking game|falling blocks|GENRE:/.test(ldText) && !/"(author|creator|email|maker|prompt|owner)"/i.test(ldText),
  );
  const gg = await crawl(base, `/play/${listed}`, "googlebot");
  check(
    "…as Googlebot reads it (JavaScript-capable: the metadata may come after the shell): the same index, title, canonical and structured data in the HTML as served",
    gg.status === 200 && !/noindex/i.test(gg.html) && meta(gg.html, "robots") === "index, follow" && title(gg.html) === want.title && canonical(gg.html) === want.canonical && jsonLd(gg.html).some((d) => (d?.["@graph"] ?? []).some((n) => [n["@type"]].flat().includes("VideoGame"))),
    `in <head>: ${!!meta(headOf(gg.html), "robots")}`,
  );

  // ---- Shared by link only, and taken out by an admin: noindex ---------------------------------------------------------
  const descriptions = {};
  const pages = {};
  for (const [what, id, name] of [["shared by link only", linkOnly, "Roof Dash"], ["taken out of the gallery by an admin", hidden, "Tile Slide"]]) {
    for (const bot of ["bingbot", "googlebot"]) {
      const p = await crawl(base, `/play/${id}`, bot);
      const robots = meta(p.html, "robots") ?? "";
      check(`${what} (${bot}): 200, noindex, no structured data`, p.status === 200 && /noindex/.test(robots) && jsonLd(p.html).length === 0, robots);
    }
    const p = await crawl(base, `/play/${id}`);
    check(`${what}: friends still get a good link preview (its title, words and picture)`, title(p.html)?.startsWith(`${name}: play a free `) && (meta(p.html, "og:image") ?? "").includes(`/play/${id}/preview.png`) && !!meta(p.html, "og:description"), title(p.html) ?? "");
    descriptions[name] = meta(p.html, "description") ?? "";
    pages[name] = p.html;
  }
  // No two genres' descriptions alike: with the name and the genre's own words taken out, each still says its own thing.
  descriptions["Pebble Drop"] = desc;
  const bare = Object.entries(descriptions).map(([name, d]) => d.replace(name, "<name>").replace(/a free (arcade|runner|puzzle) game/, "a free <genre>"));
  check("the descriptions differ by genre, not only by name and genre word (arcade, runner, puzzle)", new Set(bare).size === 3, bare.join(" | "));
  // More games: on every share page, link-only too, in the HTML as served, only the gallery's games and never itself.
  const row = (html) => {
    const at = html.indexOf('aria-labelledby="play-others"');
    if (at < 0) return null;
    const part = html.slice(at, html.indexOf("</section>", at));
    return { title: decode(part.match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1] ?? "").replace(/<!-- -->/g, ""), links: [...part.matchAll(/href="\/play\/([a-z0-9]+)"/g)].map((m) => m[1]), part };
  };
  const linkRow = row(pages["Roof Dash"]);
  check(
    "a link-only page shows More games, server-rendered: the gallery game as a link with its name and picture, not itself or the hidden or unshared game",
    linkRow?.title === "More games to play" && linkRow.links.join() === listed && linkRow.part.includes("Pebble Drop") && linkRow.part.includes("gamecard__pic"),
    linkRow ? `${linkRow.title}: ${linkRow.links.join(", ")}` : "no row",
  );
  check("the gallery game's own page: no row while no other game is in the gallery (it never lists itself)", row(g.html) === null, row(g.html)?.links.join(", ") ?? "no row");

  // ---- Never shared: a 404, as before -----------------------------------------------------------------------------------
  const nope = await crawl(base, `/play/${unshared}`);
  check("a game that isn't shared: its page is a real 404", nope.status === 404, String(nope.status));
  check("…and isn't to be indexed either", /noindex/.test(meta(nope.html, "robots") ?? ""), meta(nope.html, "robots") ?? "no robots tag");

  // ---- /explore ---------------------------------------------------------------------------------------------------------
  const ex = await crawl(base, "/explore");
  check("/explore: 200, in search (no noindex)", ex.status === 200 && !/noindex/i.test(ex.html), meta(ex.html, "robots") ?? "no robots tag");
  check("/explore: its title and description", title(ex.html) === "Explore free browser games | TypePlay" && [...(meta(ex.html, "description") ?? "")].length <= 155 && /no download/.test(meta(ex.html, "description") ?? ""), `${title(ex.html)} / ${meta(ex.html, "description")}`);
  const view = await crawl(base, "/explore?sort=new&genre=puzzle&q=tile");
  check("/explore: one canonical address for every view (order, genre, search)", canonical(ex.html) === `${SITE}/explore` && canonical(view.html) === `${SITE}/explore`, `${canonical(ex.html)} / ${canonical(view.html)}`);
  check("/explore shows the gallery game, not the link-only or the hidden one", ex.html.includes("Pebble Drop") && !ex.html.includes("Roof Dash") && !ex.html.includes("Tile Slide"));
  const hub = jsonLd(ex.html).find((d) => d?.["@type"] === "CollectionPage") ?? {};
  const items = hub.mainEntity?.itemListElement ?? [];
  check(
    "/explore's structured data: a CollectionPage listing the gallery game by address and name, nothing else",
    hub.url === `${SITE}/explore` && hub.mainEntity?.["@type"] === "ItemList" && hub.mainEntity.numberOfItems === 1 && items.length === 1 && items[0].url === `${SITE}/play/${listed}` && items[0].name === "Pebble Drop" && !JSON.stringify(hub).includes(maker),
    JSON.stringify(items),
  );

  // ---- sitemap.xml -------------------------------------------------------------------------------------------------------
  const sm = await crawl(base, "/sitemap.xml");
  const locs = [...sm.html.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  const lastmod = sm.html.match(new RegExp(`<loc>${SITE}/play/${listed}</loc>\\s*<lastmod>([^<]*)</lastmod>`))?.[1] ?? "";
  check("sitemap.xml: 200, XML", sm.status === 200 && /xml/.test(sm.type), `${sm.status} ${sm.type}`);
  check("…the site's own pages as before", ["/", "/pricing", "/terms", "/privacy", "/refunds"].every((p) => locs.includes(`${SITE}${p}`)));
  check(
    "…/explore and the gallery game, with the date its page last changed (the same as its dateModified)",
    locs.includes(`${SITE}/explore`) && locs.includes(`${SITE}/play/${listed}`) && Number.isFinite(Date.parse(lastmod)) && Date.parse(lastmod) === Date.parse(game.dateModified),
    `${lastmod} / ${game.dateModified}`,
  );
  check("…not the link-only, the hidden or the unshared game", ![linkOnly, hidden, unshared].some((id) => locs.some((l) => l.endsWith(`/play/${id}`))));
  check("…nothing else new: 5 pages, /explore and the one gallery game", locs.length === 7, locs.join(" "));

  // ---- The API down: pages stay in search (503, come back later), the sitemap keeps its list -------------------------
  stack.stopApi();
  await new Promise((r) => setTimeout(r, 500));
  const down = await crawl(base, "/sitemap.xml");
  const downLocs = [...down.html.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  check("the API down: sitemap.xml still 200, with the list it last read (an outage doesn't empty it)", down.status === 200 && downLocs.length === 7 && downLocs.includes(`${SITE}/play/${listed}`), `${down.status}: ${downLocs.length} addresses`);
  const apostrophe = "(?:'|&#x27;|&#39;|&apos;|\u2019)";
  for (const [what, path, words] of [
    ["a share page", `/play/${listed}`, new RegExp(`We can${apostrophe}t load this game right now`)],
    ["/explore", "/explore", new RegExp(`We can${apostrophe}t load the games right now`)],
  ]) {
    for (const bot of ["bingbot", "googlebot"]) {
      const r = await crawl(base, path, bot);
      check(`the API down (${bot}): ${what} answers 503 with Retry-After (kept in search, read again later), its words as before`, r.status === 503 && Number(r.retry) > 0 && words.test(r.html) && /<\/html>/.test(r.html), `${r.status}, Retry-After ${r.retry}`);
    }
  }
  // Back: the pages answer 200 again; the maker's account goes (its games, folders and builds with it).
  await stack.startApi();
  check("the API back: the share page and /explore 200 again", (await crawl(base, `/play/${listed}`)).status === 200 && (await crawl(base, "/explore")).status === 200);
  check("the maker's account closed (its games and builds with it)", (await api("DELETE", "/me", { confirm: "DELETE" })).status === 200);
  closed = true;
  const after = await crawl(base, "/sitemap.xml");
  const afterLocs = [...after.html.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
  check("…then sitemap.xml lists the site's pages and /explore, no games", after.status === 200 && afterLocs.length === 6 && afterLocs.includes(`${SITE}/explore`) && !afterLocs.some((l) => l.includes("/play/")), `${afterLocs.length} addresses`);
} catch (e) {
  const gone = stack?.apiExit() ?? null;
  const apiEnd = stack ? `\nthe API ${gone !== null ? `had ended (${gone})` : "still runs"}; its last output:\n${stack.apiLog().slice(-2500)}` : "";
  check("the walk-through ran to the end", false, `${e?.stack ?? String(e)}${apiEnd}`);
} finally {
  // Whatever happened, the test account goes (its games, folders and builds with it); the database goes with the run.
  if (!closed && apiBase) await api("DELETE", "/me", { confirm: "DELETE" }).catch(() => {});
  stack?.stop();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? `; failed: ${failed.map((f) => f.name).join(" | ")}` : ""}`);
process.exit(failed.length ? 1 : 0);
