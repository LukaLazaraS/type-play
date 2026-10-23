// The public gallery's words (/explore; PLAN.md "Better than the competitors" #9): the two sorts, the genre
// names, the report reasons (the terms' "What you may not do" in player words) and the maker's gallery switch.
import type { GallerySort, Genre, ReportReason } from "@typeplay/shared";

/** The genre skills' names, as the starters on /create say them. */
export const genreName: Record<Genre, string> = {
  runner: "Runner",
  puzzle: "Puzzle",
  racer: "Racer",
  towerdefence: "Tower defence",
};

export const sorts: { id: GallerySort; name: string; href: string }[] = [
  { id: "popular", name: "Popular", href: "/explore" },
  { id: "new", name: "New", href: "/explore?sort=new" },
];

/** Why the game at the top of New is there (on Popular, its plays this week say it). */
export const NEWEST = "Newest in the gallery";

export const reportReasons: { id: ReportReason; name: string }[] = [
  { id: "sexual", name: "Sexual content" },
  { id: "hate", name: "Hate, violence or bullying" },
  { id: "copied", name: "Copies someone else's characters, art or music" },
  { id: "scam", name: "Tricks players, or asks for passwords or personal details" },
  { id: "other", name: "Something else" },
];

/** The longest line a report may carry (the API refuses more). */
export const REPORT_TEXT_MAX = 500;
