// The signed-in app (package 4): its switches, where the API is, and the words its screens use.
import type { Effort, GameTag, Genre, ModelChoice, Platform } from "@typeplay/shared";

export const app = {
  /**
   * The app exists only when NEXT_PUBLIC_APP=1 (apps/web/.env.development sets it for `next dev`).
   * The live build leaves it off until the API has a server (package 5): /create shows the
   * placeholder and the app's routes don't exist (next.config.ts, pageExtensions).
   */
  enabled: process.env.NEXT_PUBLIC_APP === "1",
  /** "Dev sign-in" (`Bearer dev:<email>`) for tests. Never in a production build (next.config.ts refuses it). */
  devAuth: process.env.NEXT_PUBLIC_DEV_AUTH === "1" && process.env.NODE_ENV !== "production",
  /**
   * Google's own sign-in button (2026-11-04, docs/launch/google-sign-in-name.md): on, the sign-in uses Google's button on
   * this site and hands Google's ID token to Supabase (signInWithIdToken), so Google's screens and emails name
   * typeplay.app (TypePlay once Google has verified the brand), never the Supabase project's address. Set at build time
   * (deploy/server/compose.yaml): "1" = on, and where Google's script can't load (a blocker), the redirect through
   * Supabase as before; "only" = on, and there a line that says what to do instead (once Google Cloud no longer lists
   * Supabase's callback); anything else = off, the redirect through Supabase as before.
   */
  googleButton: process.env.NEXT_PUBLIC_GOOGLE_BUTTON === "1" || process.env.NEXT_PUBLIC_GOOGLE_BUTTON === "only",
  /** Where Google's button can't load: the redirect through Supabase (`"1"`), or only a line saying why (`"only"`). */
  googleRedirectFallback: process.env.NEXT_PUBLIC_GOOGLE_BUTTON !== "only",
  apiOrigin: (process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://127.0.0.1:3002").replace(/\/+$/, ""),
  /**
   * Notifications (Web Push, 2026-10-29): the public half of the API's VAPID pair, which this browser subscribes with.
   * Public by design. Empty: the site offers no notifications (the in-site notice and the tab's title still work).
   */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
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

// Google sign-in's OAuth client (Google Cloud project typeplay-app, the "TypePlay web (Supabase)" client), for Google's
// own button (app.googleButton). Public by design: it is in every sign-in's address (docs/auth.md). Written from the
// root .env's GOOGLE_CLIENT_ID by the same script; never the client secret.
export const googleConfig = {
  clientId: "1093794003252-t3b2ldeq77m98to4lpah2fcbm17e3k7d.apps.googleusercontent.com", // google:clientId
} as const;

/** Google's button didn't load and there is no redirect to offer instead (NEXT_PUBLIC_GOOGLE_BUTTON=only). */
export const GOOGLE_BLOCKED =
  "Google's sign-in didn't load here. If you use an ad blocker, allow accounts.google.com on this site, then reload the page.";

/** Where the browser keeps the sentence while the visitor signs in (the home page's prompt box too). */
export const DRAFT_KEY = "typeplay.draft";
/** …and the genre and tags picked on /create with it (cleared when the build starts). */
export const PICKS_KEY = "typeplay.picks";

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

/** /create's pick of screens: Best fit (`auto`: nothing is sent, the agent picks one shape under its base rules, and
 * the game records the shape it chose), or a shape the player names. */
export type PlatformChoice = "auto" | Platform;

/** The screens a new game is made for (Luka, 10-25), one tap. Best fit is the first choice and the default (Luka,
 * 10-26): the agent's own pick was the one setup measured to work on iPhone, iPad and laptop in 6 of 6 games. Its line
 * names the trade-off as Phone's and Computer's do and claims no saving: Phone and Computer were not measured on their
 * own, and its 7% under Any screen is within one build's noise. Any screen's extra is measured too: on 6 games it cost 7% more credits and about a minute more than
 * one shape, and side-view games came out small on an upright phone (packages/agent/RESULTS.md, "2026-10-25:
 * platforms"). Not "Every screen": the home page says that of every game (it plays on the web, Android and more). */
export const platforms: { id: PlatformChoice; name: string; line: string }[] = [
  {
    id: "auto",
    name: "Best fit",
    line: "The AI picks: upright for most games, wide for side-view ones. Other screens show it with bars, or turned sideways.",
  },
  { id: "phone", name: "Phone", line: "Upright, the way most phone games are. Computers show it with bars at the sides." },
  { id: "computer", name: "Computer", line: "Wide, like a computer screen. Phones play it turned sideways." },
  {
    id: "fill",
    name: "Any screen",
    line: "Fills phones, tablets and computers, upright or sideways; side-view games come out small on an upright phone. About 7% more credits and a minute longer to build.",
  },
];

/**
 * A build waiting for its turn (the build queue, 2026-10-26: when TypePlay is building as many games as it can, a build
 * waits in line instead of being turned away). Paid plans' builds go first; a free one lines up as if it had come 10
 * minutes later, so it always gets its turn. Nothing is charged while it waits, and Stop takes it out of the line.
 */
export const inLine = {
  /** The state, in the chat's answer, the stage and the build pill (the Android page's own words for its line). */
  state: "Waiting for its turn",
  /** Under the first build's waiting tile. */
  note: "Yours starts by itself, and nothing is charged while it waits. You can leave this page.",
  /** When the rough wait runs past the moment it would leave the line (`time`: that moment, e.g. "14:32"). */
  long: (time: string) => `The queue is long right now: if yours hasn't started by ${time}, it leaves the queue and nothing is charged.`,
  /** Free builds only: why their place can move back. */
  paidFirst: "Builds on paid plans go first.",
  /** The stage's line over a game whose change waits (n: the version it will make). */
  version: (n: number) => `Version ${n} is waiting for its turn`,
  /** Away from the game (the build pill) and over a game played while the first build waits: who is waiting. */
  pill: "Your game is in the queue",
  /** Read out when a build that waited starts (the page's announcer). */
  started: "It's your turn: building now.",
  /** The stage when a first build left the line without starting (stopped, waited too long, not allowed at its turn). */
  firstNotStarted: "The first build didn't start, so nothing was charged. The chat says why. Try again when you like.",
  composer: "Waiting for its turn. Type your next change meanwhile, or Stop to take this one out of the queue.",
  /** The game's icon on /games and its row in Manage. */
  tile: "in the queue",
};

/**
 * The update bar (2026-11-04): a version the AI made while the player was playing waits for them over the top of the game,
 * instead of restarting the game in play; Later folds it into the New version chip.
 */
export const update = {
  ready: (n: number) => `Version ${n} is ready.`,
  restart: "Restart",
  /** Restart's name for screen readers (its visible word first). */
  restartLabel: (n: number) => `Restart with version ${n}`,
  later: "Later",
  /** Later's name for screen readers. */
  laterLabel: "Later: keep playing",
  chip: "New version",
  /** The chip's name for screen readers: what pressing it does. */
  chipLabel: (n: number) => `New version: restart with version ${n}`,
  /** Read out once when it waits (the stage's live line): the game keeps running meanwhile. */
  said: (n: number) => `Version ${n} is ready. Your game keeps running until you restart it.`,
};

/**
 * Notifications (2026-10-29): the site's own question at the first build an account starts on a device (never on page
 * load; never again there once answered), what it says after the answer, and the account page's switch.
 */
export const notify = {
  ask: "Tell me when it's ready?",
  yes: "Yes, tell me",
  /** On the ink stage the quiet answer; in the chat's composer, "Not now" as its other questions say. */
  no: "No thanks",
  notNow: "Not now",
  /** After the yes: what the browser said. */
  on: "Done: this device tells you when it's ready, even with TypePlay closed.",
  blocked: "Your browser blocks notifications from TypePlay. Allow them in its settings for this site, then turn them on in",
  dismissed: "Nothing changed: your browser got no answer. You can turn notifications on any time in",
  failed: "This browser couldn't turn notifications on. Try again in",
  /** The account page's card. */
  card: "Notifications",
  stateOn: "On for this device.",
  stateOff: "Off on this device.",
  stateBlocked: "Blocked by your browser.",
  what: "When a build is done, too big for its AI, or didn't work, this device tells you, even with TypePlay closed. Each phone and computer has its own switch.",
  blockedHow: "Your browser blocks notifications from TypePlay. Allow them in its settings for this site, then turn the switch on.",
  homescreen: "On iPhone and iPad, add TypePlay to your Home Screen first: tap Share, then Add to Home Screen. Open it from there and turn this on.",
  unsupported: "This browser can't show notifications. Chrome, Edge, Firefox and Safari can.",
  failedOn: "This browser couldn't turn notifications on. Try again in a minute.",
};

/** The game page's hint on a screen the game isn't made for: what it's made for, the button, and the request its one
 * tap puts in the chat's box (named screens, not "here": the preview may be a drawn phone on a computer). */
export const fitHint: Record<"phone" | "computer", { made: string; button: string; ask: string }> = {
  phone: { made: "Made for phones.", button: "Ask to make it fit computers", ask: "Make it fit computer screens too." },
  computer: { made: "Made for computers.", button: "Ask to make it fit phones", ask: "Make it fit phone screens too." },
};

/**
 * /create's Genre (Luka, 10-27; itch.io's way: one genre, then tags): the game agent's genre skills as pictures, one at
 * most, two rows of four. None picked: the AI goes by the idea (it picks a skill itself, or none). Each line says what
 * the genre covers, as its skill does (packages/agent/genres/), and how to let the AI pick again. The pictures are drawn
 * (public/genres/), except Puzzle's photo until Luka picks between it and public/genres/puzzle.svg.
 */
export const genres: { id: Genre; icon: string; line: string }[] = [
  { id: "runner", icon: "/genres/runner.svg", line: "Run, jump and dodge as it speeds up." },
  { id: "platformer", icon: "/genres/platformer.svg", line: "Jump between platforms and stomp enemies." },
  { id: "puzzle", icon: "/games/match3_sq.jpg", line: "Match, push or slide pieces on a board." },
  { id: "racer", icon: "/genres/racer.svg", line: "Race cars or the clock around a track." },
  { id: "shooter", icon: "/genres/shooter.svg", line: "Shoot waves of enemies and dodge their fire." },
  { id: "towerdefence", icon: "/genres/towerdefence.svg", line: "Build towers by a road to stop the waves." },
  { id: "arcade", icon: "/genres/arcade.svg", line: "Quick score chasers: flappy, snake, stacker." },
  { id: "adventure", icon: "/genres/adventure.svg", line: "Explore, talk, take quests and find items." },
];
/** None picked (two sentences, as long as a picked genre's line: the line under the row keeps the same room either way). */
export const genreNone = "None picked: the AI decides from your idea. Pick one to choose it yourself.";
export const genreAgain = "Pick it again to let the AI decide.";
/** For screen readers, on the group: what the line under the row says to the eyes. */
export const genreAbout = "Optional. With none picked, the AI decides from your idea; picking the picked one again clears it.";

/**
 * /create's Tags (Luka, 10-27), after the genre: several at once, each a rule the game agent follows
 * (packages/agent/tags/); one at most of 2D, 2.5D and 3D, First-person or Third-person, Cozy or Hard (picking one
 * unpicks the others: their rules contradict); First-person and Third-person are always 3D (picking one picks 3D, so 2D
 * and 2.5D go). In groups: the view, the look, the feel, the way it plays. A tag's line says what it does to the game.
 */
export const gameTags: { id: GameTag; name: string; line: string }[] = [
  { id: "2d", name: "2D", line: "Flat, seen from the side or from above." },
  { id: "25d", name: "2.5D", line: "A 3D-drawn world played on a flat plane: side-on, or from a fixed angle." },
  { id: "3d", name: "3D", line: "A 3D world with real models and a camera that follows." },
  { id: "firstperson", name: "First-person", line: "Seen through the hero's eyes, always in 3D." },
  { id: "thirdperson", name: "Third-person", line: "Your hero seen from behind, with a camera that follows, always in 3D." },
  { id: "retro", name: "Retro", line: "Big pixels, a few bold colours and chip sounds, like an old arcade game." },
  { id: "cute", name: "Cute", line: "Round, friendly characters with big eyes and bouncy moves." },
  { id: "scifi", name: "Sci-fi", line: "Space, robots, lasers and neon lights." },
  { id: "fantasy", name: "Fantasy", line: "Knights, magic, dragons and castles." },
  { id: "cozy", name: "Cozy", line: "Calm and kind: no timer, no losing, warm colours." },
  { id: "hard", name: "Hard", line: "A real challenge that gets tough fast, and one tap to try again." },
  { id: "roguelike", name: "Roguelike", line: "A new run every time, with upgrades to pick along the way." },
  { id: "turnbased", name: "Turn-based", line: "Take your time: you move, then the game answers." },
  { id: "2players", name: "2 players", line: "Two people on one screen: split keys, or half the phone each." },
];
export const tagsNone = "Pick any that fit, or none. One at most of 2D, 2.5D and 3D; of First-person and Third-person; of Cozy and Hard.";

/**
 * Pictures with a message (2026-11-04): what the player may attach (the API checks the same by each file's content:
 * apps/server/src/attachments/limits.ts) and the words the box, the chat and the viewer use. `name` is the file's name.
 */
export const pictures = {
  max: 10,
  maxBytes: 10 * 1024 * 1024,
  accept: "image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp",
  types: ["image/png", "image/jpeg", "image/webp"],
  add: "Add pictures",
  list: "Pictures to send",
  remove: (name: string) => `Remove ${name}`,
  uploading: (n: number) => (n === 1 ? "Adding your picture…" : `Adding ${n} pictures…`),
  added: (n: number) => (n === 1 ? "Picture added." : `${n} pictures added.`),
  removed: "Picture removed.",
  drop: "Drop them here to add them.",
  wrongType: (name: string) => `“${name}” isn't a PNG, JPG or WebP picture.`,
  tooBig: (name: string) => `“${name}” is over 10 MB. Make it smaller and attach it again.`,
  tooMany: (left: number) => `A message can carry up to 10 pictures${left ? `: ${left === 1 ? "1 was" : `${left} were`} left out` : ""}.`,
  failed: "A picture couldn't be added. Remove it and attach it again.",
  /** In the chat: what a tile opens, and the viewer's title. */
  yours: "Your picture",
  open: (n: number, of: number) => (of === 1 ? "Open your picture" : `Open your picture ${n} of ${of}`),
} as const;

/**
 * The Assets tab (2026-11-04, docs/design/assets.md): every picture, 3D model, sound and font the game's current version
 * uses, with Download and Change it. Change it's sentence names the asset and its handle in the code (the look's key, the
 * sound's name, the file's path) in brackets, so the AI changes that one thing (packages/agent/rules/EDIT.md).
 */
export const assets = {
  tab: "Assets",
  /** The switch in the game's bar on a computer (Play / Assets), read as one control. */
  stage: "What the stage shows",
  play: "Play",
  list: "The game's assets",
  kinds: { all: "All", picture: "Pictures", model: "3D models", sound: "Sounds", font: "Fonts" },
  filter: "Show",
  count: (n: number) => (n === 1 ? "1 asset" : `${n} assets`),
  search: "Search the assets",
  searchHint: "Search by name",
  noMatch: (q: string) => `Nothing here is called “${q}”.`,
  loading: "Listing the assets…",
  failed: "The assets couldn't be listed.",
  retry: "Try again",
  noGame: "The assets show here once your game is built.",
  empty: "This game draws everything as it runs, so there is nothing to list. Ask in the chat to change anything you see.",
  ask: "Ask in the chat",
  files: "Listed from the game's files: art the AI drew in code shows here after your next change.",
  none: "This version was made before the asset list. Versions made from now on list their assets.",
  /** How it was made, under its name in the viewer. */
  made: (a: { kind: string; made: string; credit?: string; frames?: number }) =>
    a.made === "code"
      ? a.kind === "sound"
        ? "A sound the AI made in code"
        : a.frames
          ? "An animation the AI drew in code"
          : "Drawn in code by the AI"
      : a.made === "library" && a.credit
        ? `From ${a.credit}: free to use`
        : ({ picture: "A picture file in your game", model: "A 3D model file in your game", sound: "A sound file in your game", font: "A font file in your game" } as Record<string, string>)[a.kind] ?? "A file in your game",
  used: (parts: string[]) => `Used in ${parts.join(", ")}`,
  frames: (n: number) => `${n} frames`,
  seconds: (s: number) => (s < 10 ? `${s.toFixed(2).replace(/0$/, "")} s` : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`),
  music: "Music",
  sound: "Sound",
  model: "3D model",
  font: "Font",
  fontSample: "The quick brown fox jumps over the lazy dog",
  fontLetters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789",
  change: "Change it",
  download: "Download",
  downloading: "Downloading…",
  playSound: (name: string) => `Play ${name}`,
  stopSound: (name: string) => `Stop ${name}`,
  playFrames: "Play the frames",
  stopFrames: "Stop the frames",
  turn: "Drag to turn it, pinch or scroll to zoom.",
  noTurn: "This model's file type can't be turned here: download it to open it in a 3D app.",
  close: "Close",
  previous: "Previous asset",
  next: "Next asset",
  of: (n: number, total: number) => `${n} of ${total}`,
  /** A tile's name for screen readers: "Gold coin, picture, 40 by 40". */
  tileLabel: (a: { name: string; kind: string; frames?: number; seconds?: number }) =>
    [a.name, a.frames ? `animation, ${a.frames} frames` : ({ picture: "picture", model: "3D model", sound: "sound", font: "font" } as Record<string, string>)[a.kind], a.seconds ? `${a.seconds.toFixed(1)} seconds` : ""].filter(Boolean).join(", "),
  /** Change it's sentence: the player finishes it after the colon. */
  starter: (a: { name: string; kind: string; key?: string; file?: string; frames?: number; seconds?: number }) => {
    const noun = a.kind === "picture" ? (a.frames ? "animation" : "picture") : a.kind === "model" ? "3D model" : a.kind === "font" ? "font" : (a.seconds ?? 0) >= 15 ? "music" : "sound";
    return `Change the ${noun} “${a.name}” (${a.key ?? a.file ?? a.name}): `;
  },
  changeFailed: "Its picture couldn't be fetched for the chat. Try again.",
  /** The update while the list is open: a new version is ready (said on the Play switch). */
  fresh: ", new version ready",
} as const;
