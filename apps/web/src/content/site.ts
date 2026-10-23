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
  updated: "19 October 2026",
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

// Credits, decided 2026-10-16 (docs/pricing.md). One credit stands for $0.06 of AI work and sells
// for $0.20 on Medium, so every paid plan keeps 47-56% of its price even when every credit is used
// (after Paddle's fee, the 1% tax and 18% VAT on the AI bill). A message is charged for the work it
// actually did; `typical` is what our measured runs cost (packages/agent/RESULTS.md).
export const credits = {
  aiCostPerCredit: 0.06,
  freePerMonth: 20,
  freePerDay: 5,
  pack: { price: 10, credits: 40, months: 12 },
  typical: { fastEdit: 0.3, fastGame: 2, smartGame: 7, bestGame: 17 },
} as const;

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
// +20%, Ultra+ +30% against Medium. Game counts: a Smart new game ~6.7 credits, a Fast edit ~0.3.
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
      "20 credits a month, up to 5 a day",
      "Fast builds and edits",
      "Unlimited play, and a link to share",
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
      "100 credits a month: about 15 Smart new games or 350 Fast edits",
      "Fast, Smart and Best on every message",
      "Export to Android, iOS and Steam as each one arrives",
      "No badge, and version history to undo any edit",
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
    features: [
      "275 credits a month: about 40 Smart new games",
      "Everything in Medium",
      "Two builds at once",
    ],
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
    features: [
      "600 credits a month: about 90 Smart new games",
      "Everything in High",
      "New genres first",
    ],
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
    features: [
      "1,300 credits a month: about 195 Smart new games",
      "Everything in Ultra",
      "Priority help by email",
    ],
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
