// The signed-in app (package 4): its switches, where the API is, and the words its screens use.
import type { Effort, ModelChoice, Platform } from "@typeplay/shared";

export const app = {
  /**
   * The app exists only when NEXT_PUBLIC_APP=1 (apps/web/.env.development sets it for `next dev`).
   * The live build leaves it off until the API has a server (package 5): /create shows the
   * placeholder and the app's routes don't exist (next.config.ts, pageExtensions).
   */
  enabled: process.env.NEXT_PUBLIC_APP === "1",
  /** "Dev sign-in" (`Bearer dev:<email>`) for tests. Never in a production build (next.config.ts refuses it). */
  devAuth: process.env.NEXT_PUBLIC_DEV_AUTH === "1" && process.env.NODE_ENV !== "production",
  apiOrigin: (process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:3002").replace(/\/+$/, ""),
  /**
   * Paddle.js (payments part 3). The client token is public by design (it goes to every browser);
   * without it the billing pages say "opens here soon" and nothing else changes. `env` sandbox
   * points Paddle.js at the sandbox; a live_ token never builds outside production (next.config.ts).
   */
  paddle: {
    env: (process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "live") as "sandbox" | "live",
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? "",
  },
} as const;

// Supabase (Google sign-in). Both values are public by design: the URL and the publishable key go
// to every browser (docs/auth.md). Never put the secret key here. Written from the root .env by
// `node scripts/supabase-config.mjs`.
export const supabaseConfig = {
  url: "https://bensbaqrtdcamxvcugek.supabase.co", // supabase:url
  publishableKey: "sb_publishable_Pg8588vRvI1RND-JhJhrZg_Ld7ug3op", // supabase:publishableKey
} as const;

/** Where the browser keeps the sentence while the visitor signs in (the home page's prompt box too). */
export const DRAFT_KEY = "typeplay.draft";

/** The longest idea or change a message holds: the API refuses longer ones (apps/server, MAX_PROMPT). */
export const MAX_TEXT = 4000;

/** The model picker: one honest line each, for a new game and for a change (docs/pricing.md). */
export const models: { id: ModelChoice; name: string; newGame: string; edit: string }[] = [
  { id: "fast", name: "Fast", newGame: "Quick and cheap. Fine for simple games.", edit: "Quick and cheap. Good for simple changes." },
  { id: "smart", name: "Smart", newGame: "Best for a new game.", edit: "For bigger changes, or when Fast didn't get it." },
  { id: "best", name: "Best", newGame: "Slower and costs more. For hard things.", edit: "Slower and costs more. For hard things." },
];

/** How hard the AI thinks, per message: one honest line each. Medium is the default; low and high
 * move the cost by about 0.8× and 1.8× (measured, packages/agent/RESULTS.md; the API's estimate). */
export const efforts: { id: Effort; name: string; line: string }[] = [
  { id: "low", name: "Low", line: "Low effort: a bit quicker and cheaper, but it may skip small details." },
  { id: "medium", name: "Medium", line: "Medium effort: the usual. Right for most messages." },
  { id: "high", name: "High", line: "High effort: thinks longer about hard changes. Slower, and almost twice the credits." },
];

/** The screens a new game is made for (Luka, 10-25): one tap, preselected to the device it is made on. Any screen's
 * extra is measured: on 6 games it cost 7% more credits and about a minute more than one shape, and side-view games came
 * out small on an upright phone (packages/agent/RESULTS.md, "2026-10-25: platforms"). Not "Every screen": the home page
 * says that of every game (it plays on the web, Android and more). */
export const platforms: { id: Platform; name: string; line: string }[] = [
  { id: "phone", name: "Phone", line: "Upright, the way most phone games are. Computers show it with bars at the sides." },
  { id: "computer", name: "Computer", line: "Wide, like a computer screen. Phones play it turned sideways." },
  {
    id: "fill",
    name: "Any screen",
    line: "Fills phones, tablets and computers, upright or sideways; side-view games come out small on an upright phone. About 7% more credits and a minute longer to build.",
  },
];

/** The game page's hint on a screen the game isn't made for: what it's made for, the button, and the request its one
 * tap puts in the chat's box (named screens, not "here": the preview may be a drawn phone on a computer). */
export const fitHint: Record<"phone" | "computer", { made: string; button: string; ask: string }> = {
  phone: { made: "Made for phones.", button: "Ask to make it fit computers", ask: "Make it fit computer screens too." },
  computer: { made: "Made for computers.", button: "Ask to make it fit phones", ask: "Make it fit phone screens too." },
};

export type Starter = { genre: string; ready: boolean; icon?: string; examples: string[] };

/** Genre starters on /create: a tap puts an example sentence in the box (PLAN.md, "Better than the competitors" #3). */
export const starters: Starter[] = [
  {
    genre: "Runner",
    ready: true,
    icon: "/games/runner_sunset_sq.jpg",
    examples: [
      "Make an endless runner where a little robot jumps over cactuses and it gets faster over time.",
      "Make an endless runner where a fox dashes through a night forest, jumping over logs and collecting stars.",
    ],
  },
  {
    genre: "Puzzle",
    ready: true,
    icon: "/games/match3_sq.jpg",
    examples: [
      "Make a match-3 puzzle game with cute fruit.",
      "Make a puzzle game where you push boxes onto targets, with 5 levels that get harder.",
    ],
  },
  { genre: "Racer", ready: false, icon: "/games/car_city_sq.jpg", examples: [] },
  { genre: "Tower defence", ready: false, examples: [] },
];
