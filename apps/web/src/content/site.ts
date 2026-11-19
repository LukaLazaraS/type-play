// Facts shared by the public pages. Change them here, not in the pages.

export const site = {
  name: "TypePlay",
  tagline: "Type it. Play it.",
  domain: "typeplay.app",
  gamesDomain: "typeplay.dev",
  // Where playable games are served from: a separate origin, so a game's code can't touch the site.
  // Dev: `node scripts/games-server.mjs` on 3001. Live: https://typeplay.dev.
  gamesOrigin: process.env.NEXT_PUBLIC_GAMES_ORIGIN ?? "http://127.0.0.1:3001",
  email: "hello@typeplay.app",
  // Support phone (Luka's second number, not his personal one). Paddle's seller handbook requires
  // "buyer support details (email and phone number)"; shown in the footer, terms, privacy and
  // refund policy wherever the email is. Written as it should appear, e.g. "+995 5XX XX XX XX".
  phone: "+995 598 398 198" as string | null,
  // Who runs TypePlay. Named once, at the end of the terms and the privacy policy (Paddle wants
  // the sole proprietor's legal name in the terms; privacy law wants the data controller named);
  // everywhere else the site says "TypePlay", and no city or address (Luka, 2026-10-14). Must
  // match the Paddle account and the Individual Entrepreneur registration exactly; set `form`
  // once that registration exists. `country` is only the governing law of the terms.
  seller: {
    name: "Luka Lazarashvili",
    form: null as string | null, // "Individual Entrepreneur" once registered (right after Paddle's approval, Luka 10-23)
    country: "Georgia",
  },
  minAge: 13,
  paidAge: 18,
  refundDays: 14,
  updated: "19 November 2026",
} as const;

// Only the web build exists today. The others say "coming" until they do (Luka, 2026-10-14):
// no dates we can't be sure of.
export type Platform = { name: string; status: "now" | "coming" };

export const platforms: Platform[] = [
  { name: "Web", status: "now" },
  { name: "Android", status: "coming" },
  { name: "iOS", status: "coming" },
  { name: "Steam", status: "coming" },
];

/** One message's cost in credits: what it usually costs, then the low and the high end of the range. */
export type Cost = readonly [usually: number, low: number, high: number];

/**
 * What one message costs, in credits, at the usual (medium) effort, per AI: a change to a game, and a new game. The low
 * end is a small change or a simple game, the high end a big one (a new mechanic; levels, menus, upgrades). This is the
 * app's own estimate, the price shown next to Send (apps/server/src/credits/credits.ts `TABLE`, from beta 1's charges:
 * docs/pricing.md "Measured 2026-11-19 in beta 1"), so the pricing page and the app never disagree: `npm run check`
 * fails when the two differ (apps/web/scripts/numbers-check.mjs, which also checks the plans against the API).
 */
export const estimates: Record<"edit" | "new", Record<"fast" | "smart" | "best", Cost>> = {
  edit: { fast: [0.4, 0.2, 0.7], smart: [4.5, 2.5, 9], best: [10, 3, 14] },
  new: { fast: [4.5, 3, 8], smart: [15, 10, 22], best: [45, 25, 60] },
};

// Credits, decided 2026-10-16 (docs/pricing.md). One credit stands for $0.06 of AI work and sells
// for $0.20 on Medium, so every paid plan keeps 47-56% of its price even when every credit is used
// (after Paddle's fee, the 1% tax and 18% VAT on the AI bill). A message is charged for the work it
// actually did; `typical` is what a message usually costs (the estimate's "usually", above).
export const credits = {
  aiCostPerCredit: 0.06,
  freePerMonth: 20,
  freePerDay: 5,
  pack: { price: 10, credits: 40, months: 12 },
  typical: {
    fastEdit: estimates.edit.fast[0],
    fastGame: estimates.new.fast[0],
    smartGame: estimates.new.smart[0],
    bestGame: estimates.new.best[0],
  },
} as const;

/**
 * About how many messages `budget` credits buy at `each` credits apiece, said so it never promises more than they buy:
 * rounded down, and from 50 up down to a multiple of 5 (1,300 credits at 15 a Smart game: "about 85", not 86.7).
 * In tenths, so 100 credits at 0.4 is exactly 250.
 */
export function about(budget: number, each: number): number {
  const n = Math.floor(Math.round(budget * 10) / Math.round(each * 10));
  return n >= 50 ? n - (n % 5) : n;
}
/** 1300 → "1,300". */
const num = (n: number) => n.toLocaleString("en-US");

export type Plan = {
  id: "free" | "medium" | "high" | "ultra" | "ultra-plus";
  name: string;
  price: number;
  period: "month";
  credits: number;
  /** Pricing page row: 1 = the three main cards, 2 = the big plans under them. */
  row: 1 | 2;
  summary: string;
  features: string[];
  cta: string;
};

// Names are game graphics settings (Luka, 2026-10-16). Every paid plan has the same AI (Fast, Smart
// and Best on every message); a bigger plan only buys more credits per dollar: High +10%, Ultra
// +20%, Ultra+ +30% against Medium. The game counts come from the estimate's "usually" (above), so they move with it:
// a Smart new game 15 credits, a Best one 45, a Fast one 4.5, a Fast change 0.4 (docs/pricing.md "What a plan buys").
const t = credits.typical;
/** "about 18 Smart new games or 6 Best": what a month of a paid plan's credits buys. */
const buys = (n: number) => `about ${about(n, t.smartGame)} Smart new games or ${about(n, t.bestGame)} Best`;

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "month",
    credits: 20,
    row: 1,
    summary: "Try it. Make games on Fast and play them in the browser.",
    features: [
      `${credits.freePerMonth} credits a month, up to ${credits.freePerDay} a day: about ${about(credits.freePerMonth, t.fastGame)} Fast new games`,
      "Fast for new games and changes",
      "Play in the browser, and a link to share",
      // On every plan: the app gives Restore to every plan, at no credits (page-copy-proposals.md A3, option A).
      "Every change is a version you can go back to",
      "A small TypePlay badge in your game",
    ],
    cta: "Start free",
  },
  {
    id: "medium",
    name: "Medium",
    price: 20,
    period: "month",
    credits: 100,
    row: 1,
    summary: "For making and finishing games. Smart by default, Best when you want it.",
    features: [
      `100 credits a month: about ${about(100, t.smartGame)} Smart new games, ${about(100, t.bestGame)} Best, or ${about(100, t.fastEdit)} Fast changes`,
      "Fast, Smart and Best on every message",
      "Export to Android, iOS and Steam as each one arrives",
      "No badge in your game",
      "Unused credits carry over one month",
    ],
    cta: "Get Medium",
  },
  {
    id: "high",
    name: "High",
    price: 50,
    period: "month",
    credits: 275,
    row: 1,
    summary: "For people who make a lot of games. 10% more credits per dollar.",
    features: [`275 credits a month: ${buys(275)}`, "Everything in Medium", "Two builds at once"],
    cta: "Get High",
  },
  {
    id: "ultra",
    name: "Ultra",
    price: 100,
    period: "month",
    credits: 600,
    row: 2,
    summary: "20% more credits per dollar than Medium.",
    features: [`600 credits a month: ${buys(600)}`, "Everything in High", "New genres first"],
    cta: "Get Ultra",
  },
  {
    id: "ultra-plus",
    name: "Ultra+",
    price: 200,
    period: "month",
    credits: 1300,
    row: 2,
    summary: "30% more credits per dollar than Medium.",
    features: [`${num(1300)} credits a month: ${buys(1300)}`, "Everything in Ultra", "Priority help by email"],
    cta: "Get Ultra+",
  },
];

// "Your game is yours", on the home and pricing pages (PLAN.md, "Better than the competitors" #1).
// Say only what the terms promise (legal.ts, "Your games are yours"). Not "download the whole
// project any time": the terms don't promise that yet.
export const ownership = {
  title: "Your game is yours.",
  points: [
    "You own the code, the art and the exported builds.",
    "We take no share of what your game earns.",
    "Publish it anywhere, under your own name.",
  ],
  note: "On every plan.",
} as const;
