// Search and sharing: the site's description and the structured data search engines read.
// Prices and names come from site.ts, so a pricing change updates these too.
import type { GalleryGame, Genre, PublicGame } from "@typeplay/shared";
import { genreName } from "./gallery";
import { plans, site } from "./site";

export const siteUrl = `https://${site.domain}`;

// page-copy-proposals.md A4, its first version (with the app): the useful words inside the ~155 characters search results
// show, and no platform said as if it were live before it is. Its second version goes in with Android (C1).
export const description =
  "Describe a game in one sentence. TypePlay builds it in minutes. Play it in your browser, change it by chatting, share a link. Android, iOS and Steam are coming.";

/** Schema.org graph for the home page: who runs the site, the site, and the app with its plans. */
export const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: site.name,
      url: siteUrl,
      logo: `${siteUrl}/icons/icon-512.png`,
      email: site.email,
      telephone: site.phone ?? undefined,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: site.name,
      url: siteUrl,
      inLanguage: "en",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
    {
      "@type": "WebApplication",
      "@id": `${siteUrl}/#app`,
      name: site.name,
      url: siteUrl,
      description,
      applicationCategory: "GameApplication",
      operatingSystem: "Any (runs in a web browser)",
      publisher: { "@id": `${siteUrl}/#organization` },
      offers: plans.map((p) => ({
        "@type": "Offer",
        name: p.name,
        description: p.summary,
        price: p.price,
        priceCurrency: "USD",
        url: `${siteUrl}/pricing`,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: p.price,
          priceCurrency: "USD",
          unitCode: "MON",
        },
      })),
    },
  ],
};

/** A page's date for the sitemap, from a date written like "13 October 2026"; none if unreadable. */
export function sitemapDate(written: string): Date | undefined {
  const d = new Date(`${written} UTC`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ---- A shared game's page (/play/<id>) ------------------------------------------------------------------------------
// In search only while the game is in the gallery (PublicGame.listed); link-only pages get the same words for their link
// previews. The name comes first: it is what someone searching for the game types.

/** The genre as the words of "a free … game" in a title and a description. */
const genreWords: Record<Genre, string> = {
  runner: "runner game",
  platformer: "platformer",
  puzzle: "puzzle game",
  racer: "racing game",
  shooter: "shooter",
  towerdefence: "tower defence game",
  arcade: "arcade game",
  adventure: "adventure game",
};

/** What you do in each genre, in a player's words: the first thing a game's description says after its name, so no two
 * genres read alike. A game without a genre has its own. */
const genreHook: Record<Genre | "none", string> = {
  runner: "run, jump and dodge as far as you can",
  platformer: "jump your way to the end of each level",
  puzzle: "solve each level one move at a time",
  racer: "race to the line and beat your best time",
  shooter: "aim, fire and survive each wave",
  towerdefence: "build towers and hold back every wave",
  arcade: "chase a high score in quick rounds",
  adventure: "explore and find your way to the end",
  none: "a little game made from one typed idea",
};

/** What search results show of a title and a description before they cut it off. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
/** The layout's title template adds this to every page's title. */
const TITLE_END = ` | ${site.name}`;

/** "Sky Stack: play a free arcade game online" (the layout adds " | TypePlay"): the name, then the words people search a
 * game by (play, free, online, the genre). Shorter while that passes 60 letters, the genre kept ("Scrap Siege: free tower
 * defence game"), then the name alone (a 60-letter name runs over; the name matters more than the rest). */
export function gameTitle(name: string, genre: Genre | null): string {
  const fits = (t: string) => [...t].length + TITLE_END.length <= TITLE_MAX;
  const long = `${name}: play a free ${genre ? genreWords[genre] : "game"} online`;
  const short = `${name}: free ${genre ? genreWords[genre] : "online game"}`;
  for (const t of [long, short]) if (fits(t)) return t;
  return name;
}

/** The search result's line: the name, what you do in its genre (genreHook), that it is free in the browser with nothing
 * to download or sign up for, how many have played it (from 10 plays: fewer reads thin), and how it was made. Shorter
 * when a long name would take it past 155 letters: without the plays, then with fewer words about the browser. */
export function gameDescription(name: string, genre: Genre | null, plays = 0): string {
  const what = genre ? genreWords[genre] : "game";
  const lead = `${name}: ${genreHook[genre ?? "none"]}.`;
  const free = `A free ${what} in your browser, no download or sign-up.`;
  const played = plays >= 10 ? ` ${new Intl.NumberFormat("en-US").format(plays)} plays.` : "";
  for (const line of [`${lead} ${free}${played} Made with TypePlay.`, `${lead} ${free} Made with TypePlay.`, `${lead} Free in your browser, no download. Made with TypePlay.`]) {
    if ([...line].length <= DESCRIPTION_MAX) return line;
  }
  return `${name}: a free ${what} in your browser. Made with TypePlay.`;
}

/** The link preview's picture: the start screen on the dusk desert (app/play/[id]/preview.png). The build id in the
 * address: a new version is a new picture (link previews cache by address). */
export const gamePreview = (game: Pick<PublicGame, "id" | "buildId">) => `/play/${game.id}/preview.png?v=${encodeURIComponent(game.buildId)}`;

/** TypePlay as the publisher, by the home page's Organization id, with its name and address so it reads alone. */
const publisher = { "@type": "Organization", "@id": `${siteUrl}/#organization`, name: site.name, url: siteUrl };
/** The gallery's name in search and in a game's breadcrumb. */
export const galleryName = "Explore free browser games";

/**
 * Schema.org for a gallery game's page: a VideoGame that plays in a web browser, free (an offer at 0 USD), published on
 * TypePlay, with its plays, when it went into the gallery and when it last changed, and the way to it (TypePlay, the
 * gallery, the game). The game and its page only: no maker, no prompt, nothing from the account. It claims no rich
 * result it can't back: there are no ratings or reviews, so none are made up.
 */
export function gameStructuredData(game: PublicGame) {
  const url = `${siteUrl}/play/${game.id}`;
  const built = game.builtAt ? Date.parse(game.builtAt) : NaN;
  const listed = game.listedAt ? Date.parse(game.listedAt) : NaN;
  // Changed last: the newer of the two (a game built before it went into the gallery changed when it went in).
  const dates = [built, listed].filter(Number.isFinite);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        // A game that is also a web app: it runs in the browser (Google reads WebApplication; VideoGame alone shows
        // nothing more). No rating or review: there are none to give.
        "@type": ["VideoGame", "WebApplication"],
        "@id": `${url}#game`,
        name: game.name,
        url,
        description: gameDescription(game.name, game.genre, game.plays),
        image: `${siteUrl}${gamePreview(game)}`,
        ...(game.genre ? { genre: genreName[game.genre] } : {}),
        gamePlatform: "Web browser",
        applicationCategory: "GameApplication",
        operatingSystem: "Any (runs in a web browser)",
        browserRequirements: "Requires JavaScript, WebAssembly and WebGL 2",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: 0, priceCurrency: "USD", url },
        ...(Number.isFinite(listed) ? { datePublished: new Date(listed).toISOString() } : {}),
        ...(dates.length ? { dateModified: new Date(Math.max(...dates)).toISOString() } : {}),
        publisher,
        ...(game.plays > 0
          ? { interactionStatistic: { "@type": "InteractionCounter", interactionType: "https://schema.org/PlayAction", userInteractionCount: game.plays } }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: site.name, item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: galleryName, item: `${siteUrl}/explore` },
          { "@type": "ListItem", position: 3, name: game.name, item: url },
        ],
      },
    ],
  };
}

/** Schema.org for /explore: a CollectionPage whose list is the gallery's first page in its usual order (the week's most
 * played), each game by its address and name, and how many there are in all. Names only: nothing about makers. */
export function galleryStructuredData(games: Pick<GalleryGame, "id" | "name">[], total: number, description: string) {
  const url = `${siteUrl}/explore`;
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    name: galleryName,
    url,
    description,
    isPartOf: { "@id": `${siteUrl}/#website` },
    publisher,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: games.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${siteUrl}/play/${g.id}`, name: g.name })),
    },
  };
}
