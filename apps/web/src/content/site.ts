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
  // Who runs TypePlay. Named once, at the end of the terms and the privacy policy (Paddle wants
  // the sole proprietor's legal name in the terms; privacy law wants the data controller named);
  // everywhere else the site says "TypePlay" (Luka, 2026-10-14). Must match the Paddle account and
  // the Individual Entrepreneur registration exactly; set `form` once that registration exists.
  seller: {
    name: "Luka Lazarashvili",
    form: null as string | null, // "Individual Entrepreneur" once registered (~10-16)
    city: "Tbilisi",
    country: "Georgia",
  },
  minAge: 13,
  paidAge: 18,
  refundDays: 14,
  updated: "13 October 2026",
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

export type Plan = {
  id: "free" | "maker" | "studio";
  name: string;
  price: number;
  period: "month";
  summary: string;
  model: string;
  features: string[];
  cta: string;
};

// Prices from the plan (CLAUDE.md). Credit amounts are not decided yet (docs/parked.md #9), so the
// plans describe what the credits buy, as estimates shown as estimates. Derivation: $20 buys
// about $9 of AI work (CLAUDE.md); a Smart build measured $0.16 to $0.46 (agent/RESULTS.md), so
// roughly 20 to 50 new games; a Fast edit measured $0.003 to $0.03, so hundreds of edits.
// Studio: $50 buys about 2.5x the AI work of Maker.
export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "month",
    summary: "Try it. A few games a month on Fast, played in the browser.",
    model: "Fast",
    features: [
      "A few new games a month",
      "Unlimited play in the browser",
      "Edits by chat on Fast",
      "A small TypePlay badge in your game",
    ],
    cta: "Start free",
  },
  {
    id: "maker",
    name: "Maker",
    price: 20,
    period: "month",
    summary: "For making and finishing games. Smart by default, Best when you want it.",
    model: "Smart",
    features: [
      "Credits for about 20 new games or hundreds of edits (estimate)",
      "Smart builds by default, Best costs more credits",
      "Export to Android, iOS and Steam as each one arrives",
      "No badge",
      "Version history: undo any edit",
    ],
    cta: "Get Maker",
  },
  {
    id: "studio",
    name: "Studio",
    price: 50,
    period: "month",
    summary: "More credits for people who make a lot of games.",
    model: "Smart",
    features: [
      "About 2.5 times the credits of Maker (estimate)",
      "Everything in Maker",
      "Buy extra credits any time",
    ],
    cta: "Get Studio",
  },
];
