// The public gallery's words (/explore; PLAN.md "Better than the competitors" #9): the three orders, the genre
// names, the report reasons (the terms' "What you may not do" in player words) and the maker's gallery switch.
import type { GallerySort, Genre, ReportReason } from "@typeplay/shared";

/** The genre skills' names, as the starters on /create say them. */
export const genreName: Record<Genre, string> = {
  runner: "Runner",
  platformer: "Platformer",
  puzzle: "Puzzle",
  racer: "Racer",
  shooter: "Shooter",
  towerdefence: "Tower defence",
  arcade: "Arcade",
  adventure: "Adventure",
};

/**
 * A genre's name where large text on a narrow card or line may have to break it (the gallery's cards and top game, the
 * share page's line under the name): soft hyphens at its syllables, so every browser breaks "Plat-former", never
 * "Platforme / r" (one without a hyphenation dictionary broke anywhere), and a genre with its dot after it never leaves the
 * dot alone on the next line. The hyphens show only where a line breaks; titles, search data and menus keep `genreName`.
 */
export const genreBreakable: Record<Genre, string> = {
  runner: "Run\u00ADner",
  platformer: "Plat\u00ADform\u00ADer",
  puzzle: "Puz\u00ADzle",
  racer: "Rac\u00ADer",
  shooter: "Shoot\u00ADer",
  towerdefence: "Tow\u00ADer de\u00ADfence",
  arcade: "Ar\u00ADcade",
  adventure: "Ad\u00ADven\u00ADture",
};

/** A genre's games in a heading: "More racing games" under a shared racer (app/play/[id]/MoreGames.tsx). */
export const genreMore: Record<Genre, string> = {
  runner: "runner games",
  platformer: "platformers",
  puzzle: "puzzle games",
  racer: "racing games",
  shooter: "shooters",
  towerdefence: "tower defence games",
  arcade: "arcade games",
  adventure: "adventure games",
};

/** The library's orders (Luka, 10-27: Popular / New / All): the week's most played, the newest, every game A to Z. */
export const sorts: { id: GallerySort; name: string }[] = [
  { id: "popular", name: "Popular" },
  { id: "new", name: "New" },
  { id: "all", name: "All" },
];

export const reportReasons: { id: ReportReason; name: string }[] = [
  { id: "sexual", name: "Sexual content" },
  { id: "hate", name: "Hate, violence or bullying" },
  { id: "copied", name: "Copies someone else's characters, art or music" },
  { id: "scam", name: "Tricks players, or asks for passwords or personal details" },
  { id: "other", name: "Something else" },
];

/** The longest line a report may carry (the API refuses more). */
export const REPORT_TEXT_MAX = 500;
