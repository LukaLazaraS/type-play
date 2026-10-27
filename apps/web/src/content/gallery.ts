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
