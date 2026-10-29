// The contract between the site (apps/web) and the API (apps/server): request bodies, responses
// and the live run events. Types only, so both sides import it with `import type` and nothing
// from here ships at runtime. Change it here first, then both sides.
//
// Auth: every call sends `Authorization: Bearer <Supabase access token>` (Google sign-in through
// Supabase; the server verifies the token against Supabase's JWKS and creates the user on first use).
// The one exception: /public/* (share pages and the gallery) needs no sign-in.
// Errors: non-2xx with ApiError as the body.

/** What the user picks per message (docs/pricing.md): Fast = Haiku, Smart = Sonnet, Best = Opus. */
export type ModelChoice = "fast" | "smart" | "best";
export type Effort = "low" | "medium" | "high";
export type PlanId = "free" | "medium" | "high" | "ultra" | "ultraplus";
export type Orientation = "portrait" | "landscape";
/** The screens a game is made for (the new-game screen's choice, 2026-10-25): phone (upright) or computer (wide), one
 * shape scaled to fit any screen with bars; fill: the layout adapts to every shape. null: made before the choice. */
export type Platform = "phone" | "computer" | "fill";
/** What the player can add to a new game beside its genre (/create's Tags, 2026-10-27), several at once: 2d or 3d (not
 * both), retro (big pixels, few colours, chip sounds), cute, cozy (no rush, no losing) or hard (not both). Added later on
 * 10-27: firstperson (always 3d, so never with 2d), scifi, fantasy, roguelike, turnbased, 2players (two on one screen, never
 * online). Each is a rule the game agent gets (packages/agent/tags/). */
export type GameTag = "2d" | "3d" | "firstperson" | "retro" | "cute" | "scifi" | "fantasy" | "cozy" | "hard" | "roguelike" | "turnbased" | "2players";

/** Credits are numbers with one decimal (a message costs at least 0.1). */
export interface CreditBalance {
  /** Everything the user can spend right now. */
  available: number;
  /** Free plan only: credits still allowed today (max 5 a day); null on paid plans. */
  todayLeft: number | null;
  /** The credits that end soonest ("12 credits end on 3 Nov"); null when nothing is dated. Added 2026-10-20 (payments part 1). */
  expiring?: { amount: number; at: string } | null;
}

/** Where credits came from: the Free month, a plan period, an upgrade, a pack, or given by hand. */
export type CreditSource = "free" | "plan" | "upgrade" | "pack" | "admin";

/** One part of what the user can spend, as the billing page lists them (GET /billing `credits.parts`, payments part 3). */
export interface CreditPart {
  source: CreditSource;
  left: number;
  /** When these end; null for credits given by hand. */
  expiresAt: string | null;
}

export interface Me {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  plan: PlanId;
  /** Models this plan may use (Free: only "fast"). */
  models: ModelChoice[];
  credits: CreditBalance;
  /** One plain sentence about the credits, when there is something to say (e.g. no signup credits
   * because this email closed an account less than 90 days ago). Added 2026-10-18. */
  notice?: string;
  /** The subscription in one glance (payments part 2, 2026-10-20). GET /billing (part 3) has the rest. */
  billing?: MeBilling;
  /** What this server can do (Android export, 2026-10-18): the site hides the Android pill when the toolchain is off. */
  features?: { android: boolean };
}

/** Me.billing: enough for the strips on the game and account pages. */
export interface MeBilling {
  /** off: no payment keys, or sandbox billing is not for this user: the billing page says "opens here soon". */
  mode: "off" | "sandbox" | "live";
  /** free: no subscription; canceling: a cancel is scheduled for `cancelsAt`. */
  status: "free" | "active" | "past_due" | "canceling";
  /** A downgrade waiting for the renewal. */
  pendingPlan: PlanId | null;
  /** When the paid period ends (the renewal date; after a cancel, the last day). */
  periodEndsAt: string | null;
  cancelsAt: string | null;
  /** "chargeback": buying and building are paused until an admin clears it (403 billing_hold). */
  hold: string | null;
  /** Free plan: when the next 20 free credits arrive ("20 more on 1 Nov"); null on paid plans. Added with part 3. */
  freeRefillAt?: string | null;
}

/** GET /billing (payments part 3): the plan and billing page in one answer. 503 billing_off when payments are off for this user. */
export interface BillingInfo {
  mode: "sandbox" | "live";
  plan: PlanId;
  /** Null until a plan was bought; stays after a cancel or a lapse (then `status` says so and `plan` is free). */
  subscription: BillingSubscription | null;
  /** The credits to spend, by where they came from, in spend order (free → plan and upgrade → packs → by hand). */
  credits: { parts: CreditPart[] };
  /** Paid plans only, and not while a payment is disputed. */
  canBuyPack: boolean;
  /** Newest first. */
  payments: BillingPayment[];
  /** The tick box at the last purchase: "On 17 Oct you asked us to start right away (wording v1)". */
  consent: { version: string; at: string } | null;
  /** As Me.billing.hold. */
  hold: string | null;
}

export interface BillingSubscription {
  /** canceled and paused: the plan is Free again; past_due with plan free: the plan lapsed. */
  status: "active" | "past_due" | "canceled" | "paused";
  /** The next payment (null once a cancel is scheduled, or after past due). */
  renewsAt: string | null;
  /** When the paid period ends. */
  endsAt: string | null;
  cancelsAt: string | null;
  /** A smaller plan waiting for the renewal. */
  pendingPlan: PlanId | null;
  /** The last payment that didn't go through (Paddle retries; the plan lapses a day after `endsAt`). */
  paymentFailedAt: string | null;
  /** "Visa ending 4242". */
  paymentMethod: string | null;
  /** The plan this subscription last paid for ("Your High plan ended…" after a lapse). */
  lastPlan: PlanId | null;
}

/** One payment at Paddle (the receipt is in Paddle's portal). */
export interface BillingPayment {
  /** Paddle's transaction id (txn_…): quote it when asking for a refund. */
  id: string;
  at: string;
  /** "Medium plan", "Renewal: Medium", "Upgrade to High", "Credit pack". */
  what: string;
  /** Before tax, USD. */
  amountUsd: number;
  taxUsd: number;
  invoiceNumber: string | null;
  /** 14 days after the payment (docs/pricing.md "Refunds"). */
  refundableUntil: string;
  refundedUsd: number;
  status: "paid" | "partly_refunded" | "refunded" | "disputed";
  /** A refund of this payment is with Paddle for approval; its credits are on hold meanwhile. */
  refundPendingUsd: number | null;
}

/** GET /billing/plan-change?plan= and POST /billing/plan-change: up = the card is charged now, pro rata; down = at the renewal. */
export interface PlanChangePreview {
  direction: "up" | "down";
  /** What the card is charged now, tax included (0 for a downgrade). */
  chargeNowUsd: number;
  /**
   * The tax part of `chargeNowUsd` (added 2026-10-22, optional while part 3's controller passes it on): "$15.00
   * plus $1.50 tax" is `chargeNowUsd − taxNowUsd` and `taxNowUsd`; without it, say "tax included".
   */
  taxNowUsd?: number;
  /** The credits that arrive with that charge (0 for a downgrade). */
  creditsNow: number;
  /** The new plan's monthly price. */
  nextRenewalUsd: number;
  /** Now for an upgrade; the renewal date for a downgrade. */
  effectiveAt: string;
}

export interface CheckoutStatus {
  status: "open" | "completed" | "abandoned";
}

/** POST /billing/portal: Paddle's customer portal, fresh links per click (they expire; never stored). */
export interface PortalLinks {
  overview: string;
  cancel: string | null;
  updatePaymentMethod: string | null;
}

/** exporting: an Android build is running on this game (chat, restore and delete answer 409 busy meanwhile). queued: its
 * build waits for a free builder (`queue` says where it is; added 2026-10-26); chat and restore answer 409 busy then too. */
export type RunStatus = "idle" | "queued" | "running" | "exporting";

/**
 * A build waiting for its turn (added 2026-10-26): when every builder is busy (the server builds MAX_RUNS games at once),
 * a new build waits in line instead of being refused. Paid plans' builds start first, first come first served; a free
 * build lines up as if it had come 10 minutes later, so it always gets its turn. Nothing is charged while it waits, and
 * Stop (POST /projects/:id/cancel) takes it out of the line.
 */
export interface QueuePlace {
  /** Builds ahead of this one in the line (0: it is next). */
  ahead: number;
  /** A rough wait until it starts, in whole minutes (at least 1): from the builds going and how long builds like them take. */
  waitMin: number;
  /** Which line it is in: free builds let paid ones that arrive within 10 minutes go first. */
  lane: "paid" | "free";
  /** When it leaves the line if it hasn't started (the wait limit: 30 minutes after its turn). A rough wait that runs past
   * it means the line is too long for it today: the site says so. */
  leavesAt: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  orientation: Orientation;
  /** Added 2026-10-25. The player's pick, then what the game says after each build (a change can make it fill). */
  platform: Platform | null;
  /** Added 2026-10-27. The genre the player picked on /create; null: none, so the AI picked one from the idea (or none). */
  pickedGenre: Genre | null;
  /** Added 2026-10-27. The tags the player picked on /create, which every build of the game follows; none: []. */
  tags: GameTag[];
  /** Games origin build id of the current version, e.g. "k3x9p2m7qd-v4"; null until the first build passes. */
  buildId: string | null;
  status: RunStatus;
  /** While status is "queued": its place in the line and the rough wait. */
  queue?: QueuePlace;
  createdAt: string; // ISO
  updatedAt: string;
  /** Anyone with the link can play it at typeplay.app/play/<id> (PATCH /projects/:id { shared }). Private by default. */
  shared: boolean;
  /** The current build has a picture of its start screen at <games origin>/builds/<buildId>/poster.png. */
  poster: boolean;
  /** Also in the public gallery, typeplay.app/explore (PATCH /projects/:id { listed }): a second step after sharing, off by
   * default, only while shared (unsharing takes it out too). Added 2026-10-18 (the gallery). */
  listed: boolean;
  /** An admin took it out of the gallery after a report; its share link still works. */
  galleryHidden: boolean;
  /** Times its share page started the game, all time. Counted per game and day only: nothing about who played. */
  plays: number;
}

/** queued: the build waits for a free builder (added 2026-10-26); running from its start. */
export type MessageStatus = "queued" | "running" | "done" | "failed" | "refused";

export interface Message {
  id: string;
  role: "user" | "agent";
  /** User: what they typed. Agent: the player-facing reply (plain words, no tech talk). */
  text: string;
  /** Agent messages: what ran it and what it cost. */
  model?: ModelChoice;
  effort?: Effort;
  status?: MessageStatus;
  /** Credits charged for this message (0 when it failed or was refused: failures are free). */
  credits?: number;
  /** The version this message produced, when it produced one. */
  versionN?: number;
  /** Agent messages: when the build started (later than createdAt when it waited in line). Added 2026-10-26. */
  startedAt?: string;
  /** Up to 9 next changes the player might ask for (short lines in the player's language), best first, made with the
   * answer as part of its charge; the chat shows three under its newest answer and "More ideas" adds the other six.
   * Missing when there are none. */
  suggestions?: string[];
  /** Added 2026-10-29 (the size check). A change too big for the AI it was sent on stopped before the build: the answer
   * says why (status done, charged like any answer, no version), and this is the bigger AI it offers; the chat's one tap
   * puts the same message back in the box with it picked, never sends. Missing on other answers, and on a stop for a
   * plan without a bigger AI (Free: one part at a time is the only way). */
  biggerModel?: ModelChoice;
  createdAt: string;
}

export interface Version {
  /** 1, 2, 3 … in order; restoring an old version creates a new, higher one. */
  n: number;
  /** What made it: the prompt, or "Restored version 2". */
  label: string;
  buildId: string;
  createdAt: string;
}

export interface Project extends ProjectSummary {
  messages: Message[];
  versions: Version[];
  /** n of the version playing now (the newest), null before the first build. */
  currentVersion: number | null;
}

/** What a message will probably cost, shown next to the send button before it runs. */
export interface Estimate {
  kind: "new" | "edit";
  model: ModelChoice;
  typical: number;
  low: number;
  high: number;
  /** True when `high` passes the ask-first limit (25 credits on paid plans, 3 on Free): send with confirm: true. */
  needsConfirm: boolean;
  /** The effort the numbers are for (GET /estimate takes it; medium when not given). */
  effort?: Effort;
}

/** One line of the credit history (GET /me/usage): every grant, charge and refund. */
export interface UsageEntry {
  id: string;
  at: string; // ISO
  /** Credits added (+) or spent (-), one decimal. */
  amount: number;
  /** expire: credits that ended ("Free credits ended"); reversal: removed after a refund or chargeback. Both added 2026-10-20. */
  kind: "grant" | "charge" | "refund" | "expire" | "reversal";
  /** Plain words: "New game on Smart", "Change on Fast", "Free plan credits", "Free credits ended", or the note of a grant. */
  what: string;
  /** For a charge: what the player asked for (cut to 200 letters); null otherwise. */
  prompt: string | null;
  /** The game it was spent on; null for grants, and for games deleted since (then `gameDeleted` is true). */
  game: { id: string; name: string } | null;
  gameDeleted?: boolean;
}

export interface UsagePage {
  entries: UsageEntry[];
  /** Pass as ?cursor= for the next (older) page; null on the last page. */
  next: string | null;
}

/** A shared game, as anyone can see it (no sign-in): the share page typeplay.app/play/<id>. */
export interface PublicGame {
  id: string;
  name: string;
  orientation: Orientation;
  /** A game that fills every screen never asks to turn the phone. Added 2026-10-25. */
  platform: Platform | null;
  buildId: string;
  /** <games origin>/builds/<buildId>/poster.png exists. */
  poster: boolean;
  updatedAt: string;
  /** All-time plays, as ProjectSummary.plays. Added 2026-10-18 (the gallery). */
  plays: number;
}

/** GET /me/export: everything we keep about the account, as a JSON file (the privacy policy's "export"). */
export interface AccountExport {
  exportedAt: string;
  account: { id: string; email: string; name: string | null; avatarUrl: string | null; plan: PlanId; createdAt: string };
  credits: { available: number; entries: UsageEntry[] };
  games: (ProjectSummary & {
    currentVersion: number | null;
    messages: Message[];
    versions: Version[];
    /** Android export (2026-10-18): the package name, the upload key's fingerprint and the builds; never the key itself. */
    android?: { packageName: string; certSha256: string; builds: AndroidBuild[] };
  })[];
  /**
   * Our record of each payment, newest first (added 2026-10-22): what the billing page lists, plus the
   * tick box ticked at that checkout (its wording version and time). Invoices and receipts are at Paddle.
   */
  payments: (BillingPayment & { consentVersion: string | null; consentAt: string | null })[];
  /** The subscription as our rows have it; null when there has never been one. */
  billing: { subscriptionStatus: BillingSubscription["status"] | null; periodEndsAt: string | null; cancelsAt: string | null; paymentMethod: string | null } | null;
  /** What the account sent with "Send feedback", newest first (added 2026-10-23, beta 1). */
  feedback?: { id: string; at: string; page: string; text: string; expected: string | null; gameId: string | null; messageId: string | null; browser: string | null; done: boolean }[];
  /** Plain words on what is not in this file and where it is. */
  notes: string[];
}

// ---- Android export (2026-10-18; docs/android-export-design.md) -----------------------------------
// Paid plans only (Free: 403 plan_no_export); exports cost no credits. The whole feature answers
// 503 android_off when the server has no toolchain (Me.features.android is false then).

export type AndroidFormat = "apk" | "aab";
/** queued → running (Godot exports) → signing (the upload key) → done | failed | cancelled; done → expired after 30 days. */
export type AndroidBuildStatus = "queued" | "running" | "signing" | "done" | "failed" | "expired" | "cancelled";
/** Why a build failed; `failMessage` says it in one plain sentence. */
export type AndroidFailCode = "toolchain" | "game" | "gradle" | "timeout" | "mismatch" | "sign" | "store" | "interrupted" | "queue_full";

/** The game's Android identity (set up once per game). */
export interface AndroidApp {
  /** Reverse-DNS, e.g. app.typeplay.cat_jump_k3x9p2m7qd; permanent on Google Play after the first upload. */
  packageName: string;
  /** The name on the phone and in the store, 30 letters max. */
  appName: string;
  /** The last build number given out (each build gets the next one). */
  versionCode: number;
  /** True after the first AAB: changing the package name then needs confirmPackageChange (it makes a new app on Play). */
  packageLocked: boolean;
  /** The user uploaded an icon (else the game's poster is used, or a placeholder). GET …/android/icon returns it. */
  hasIcon: boolean;
  createdAt: string;
}

/** The game's upload key, as far as the site shows it (the file itself comes from GET …/android/key). */
export interface AndroidKeyInfo {
  /** The certificate's SHA-256 fingerprint, lowercase hex without colons. */
  certSha256: string;
  createdAt: string;
  downloadedAt: string | null;
  downloads: number;
}

/** One line of the checks list on a finished build: green, or one sentence on what is wrong. */
export interface AndroidCheck {
  id: "format" | "signed" | "target" | "arm64" | "pages16k" | "version" | "debuggable" | "permissions";
  ok: boolean;
  text: string;
}

export interface AndroidBuild {
  /** "<projectId>-a<versionCode>". */
  id: string;
  /** The game version it was built from. */
  versionN: number;
  format: AndroidFormat;
  versionCode: number;
  /** "<versionN>.<versionCode>", what the phone shows. */
  versionName: string;
  status: AndroidBuildStatus;
  failCode?: AndroidFailCode;
  /** One plain sentence (shown as is). */
  failMessage?: string;
  /** The last 4 KB of the build's output, behind "Details". */
  logTail?: string;
  /** The signed file's size, once done. */
  bytes?: number;
  sha256?: string;
  /** Where the launcher icon came from. */
  icon: "poster" | "own" | "placeholder";
  /** Empty until the build is done. */
  checks: AndroidCheck[];
  godotVersion: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  /** When the file is deleted (30 days after done); "Build again" afterwards. */
  expiresAt?: string;
  /** While queued: how many builds are ahead of it. */
  queue?: { position: number };
}

/** GET /projects/:id/android: everything the Android page shows. */
export interface AndroidState {
  /** False when this server cannot build (no toolchain): the page says so and offers nothing else. */
  enabled: boolean;
  /** Null until setup. */
  app: AndroidApp | null;
  key: AndroidKeyInfo | null;
  /** Newest first, at most 20. */
  builds: AndroidBuild[];
  /** Builds still allowed today (abuse guards: 10 per game, 30 per user a day). */
  limits: { perGameToday: number; perUserToday: number };
}

/** POST /projects/:id/android: set up the game's identity and make its upload key. */
export interface SetupAndroidBody {
  /** Default: app.typeplay.<slug>_<projectId>. */
  packageName?: string;
  /** Default: the game's name, cut to 30. */
  appName?: string;
}

/** PATCH /projects/:id/android. */
export interface UpdateAndroidBody {
  appName?: string;
  /** Free until the first AAB; then only with confirmPackageChange: true (a new name is a new app on Play). */
  packageName?: string;
  confirmPackageChange?: boolean;
  /** A square PNG, 512×512 or more, under 1 MB, as base64; null removes it (back to the poster). */
  iconPng?: string | null;
}

/** POST /projects/:id/android/builds: queue a build. */
export interface StartAndroidBuildBody {
  format: AndroidFormat;
  /** The game version to build; the current one when not given. */
  version?: number;
}

/** POST /projects/:id/android/builds/:bid/link: a no-sign-in download link for the phone, good for 10 minutes. */
export interface AndroidLink {
  /** Always the short `<API>/android/dl/<token>` (~80 characters, fits a QR code), whatever the server stores builds in. */
  url: string;
  expiresAt: string;
}

// ---- The public gallery (2026-10-18; PLAN.md "Better than the competitors" #9) -------------------
// typeplay.app/explore: the games their makers chose to show (shared, then "Show it in the gallery"),
// not hidden by an admin, with a build. Nothing here needs a sign-in.

/** The genre skill the game was built with (its folder's GENRE file); null when none fitted. */
export type Genre = "runner" | "platformer" | "puzzle" | "racer" | "shooter" | "towerdefence" | "arcade" | "adventure";
/** popular: most played in the last 7 days first; new: the latest to join the gallery first; all: every game A to Z (2026-10-27). */
export type GallerySort = "popular" | "new" | "all";

/** One game in the gallery. */
export interface GalleryGame {
  id: string;
  name: string;
  orientation: Orientation;
  /** As PublicGame.platform. Added 2026-10-25. */
  platform: Platform | null;
  buildId: string;
  /** <games origin>/builds/<buildId>/poster.png exists. */
  poster: boolean;
  /** All-time plays (the card says "1.2K plays"). */
  plays: number;
  /** Plays in the last 7 days, today included (UTC days): what Popular sorts by. */
  playsWeek: number;
  genre: Genre | null;
  /** When it first went into the gallery: what New sorts by (taking it out and back keeps this date). */
  listedAt: string;
}

/** GET /public/gallery?sort=popular|new|all&genre=&q=&cursor=&limit=: most played this week, newest, or A to Z first. */
export interface GalleryPage {
  games: GalleryGame[];
  /** Pass as ?cursor= with the same sort, genre and q for the next page; null on the last page. */
  next: string | null;
  /** First pages only (no cursor; 2026-10-27): how many games match the genre and the search, all pages together. */
  total?: number;
  /** First pages only (2026-10-27): the games in the whole gallery per genre (no search, no genre filter), a genre with
   * none left out. What the genre filter offers. */
  genres?: Partial<Record<Genre, number>>;
}

/** Why someone reports a game: the terms' "What you may not do", in player words. */
export type ReportReason = "sexual" | "hate" | "copied" | "scam" | "other";

/** POST /public/games/:id/report. */
export interface ReportBody {
  reason: ReportReason;
  /** Anything else to say, up to 500 letters. */
  text?: string;
}

// ---- Requests ------------------------------------------------------------------------------

/** POST /projects: make a new game from a sentence and start building it at once. */
export interface CreateProjectBody {
  prompt: string;
  model: ModelChoice;
  effort?: Effort;
  confirm?: boolean;
  /** The screens to make it for. Left out: the agent picks one shape (portrait first). Added 2026-10-25. */
  platform?: Platform;
  /** The genre to build it as (one at most). Left out: the AI picks one from the idea, or none. Added 2026-10-27. */
  genre?: Genre;
  /** Tags to build it with, several at once (not both 2d and 3d, nor cozy and hard, nor 2d and firstperson). Left out or []: none. Added 2026-10-27. */
  tags?: GameTag[];
}

/** POST /projects/:id/messages: ask for a change. 409 while a run is active or waiting in line on this project. */
export interface SendMessageBody {
  text: string;
  model: ModelChoice;
  effort?: Effort;
  confirm?: boolean;
}

/** POST /projects/:id/restore: make an old version the current one (as a new version). */
export interface RestoreBody {
  n: number;
}

/** PATCH /projects/:id: rename (1-60 letters; later builds keep it), share or unshare, and show it in the gallery or not
 * (`listed`, only while shared). */
export interface UpdateProjectBody {
  name?: string;
  shared?: boolean;
  listed?: boolean;
}

/** DELETE /me: closes the account. `confirm` must be exactly "DELETE" (the user typed it). */
export interface DeleteAccountBody {
  confirm: "DELETE";
}

/** What a checkout buys: a plan (one at a time: a second plan is a change on the billing page) or the credit pack. */
export type CheckoutItem = "plan:medium" | "plan:high" | "plan:ultra" | "plan:ultraplus" | "pack";

/**
 * POST /billing/checkout: opens a Paddle transaction for the overlay. `consentVersion` is the wording
 * version of the tick box the user ticked (the site's current one; another version is refused, so a
 * stale page can't record old wording) and `acceptedTerms` says the acceptance line was shown.
 */
export interface CheckoutBody {
  item: CheckoutItem;
  consentVersion: string;
  acceptedTerms: true;
}

/** POST /billing/plan-change: the paid plan to move to (up now, down at the renewal). */
export interface PlanChangeBody {
  plan: Exclude<PlanId, "free">;
}

/**
 * POST /beta/code (beta 1, 2026-10-25): a beta code typed on the closed-beta page by someone signed in but not invited.
 * Six digits (spaces and dashes are ignored). A right code invites that email and adds the code's credits once.
 */
export interface BetaCodeBody {
  code: string;
}

export interface BetaCodeResult {
  /** Credits the code added to the account (0 when the account was already in). */
  credits: number;
}

/**
 * POST /feedback (beta 1, 2026-10-23): "Send feedback" from the account menu or a game's More menu. `text` (what happened)
 * and `expected` take up to 4,000 letters each, line breaks kept. `gameId` and `messageId` attach the user's own game and
 * one of its messages (the tick box); the API notes the version playing then. The browser comes from the request's
 * User-Agent header. At most 10 a day per user.
 */
export interface FeedbackBody {
  text: string;
  expected?: string;
  /** The site's path it was sent from, e.g. "/games/k3x9p2m7qd" (no query string). */
  page: string;
  gameId?: string;
  messageId?: string;
}

// ---- Responses -----------------------------------------------------------------------------
// GET  /me                       -> Me
// GET  /projects                 -> ProjectSummary[]   (newest first)
// POST /projects                 -> Project            (status "running", or "queued" when every builder is busy; its first two messages are the prompt and the agent message)
// GET  /projects/:id             -> Project
// POST /projects/:id/messages    -> Project            (with the new user + running agent message)
// POST /projects/:id/restore     -> Project
// POST /projects/:id/cancel      -> Project            (stops the active run, or takes a waiting one out of the line; nothing is charged; the game stays at its last version)
// GET  /estimate?kind=new|edit&model=fast|smart|best[&effort=low|medium|high]   -> Estimate
// GET  /projects/:id/events      -> text/event-stream of RunEvent (see below)
//
// Added 2026-10-18 (account, game management, share pages):
// PATCH  /projects/:id           -> Project            (UpdateProjectBody: rename, share / unshare)
// DELETE /projects/:id           -> { ok: true }       (stops a running build first; removes the game, its versions,
//                                                       messages, files, published builds and share page)
// GET    /projects/:id/download  -> application/zip    (the Godot project at its current version, without .godot/ and
//                                                       export/, plus README.txt; 409 busy while building, 404 before a build)
// GET    /me/usage?cursor=&limit= -> UsagePage         (credit history, newest first; limit 1-100, default 25)
// GET    /me/export              -> AccountExport      (as a download: Content-Disposition: attachment)
// DELETE /me                     -> { ok: true }       (DeleteAccountBody; stops builds, deletes every game, the ledger,
//                                                       the user and the sign-in record; the next call is 401)
// GET    /public/games/:id       -> PublicGame         (no sign-in; 404 unless shared and built)
//
// Added 2026-10-18 (the public gallery and play counts; PLAN.md "Better than the competitors" #9):
// PATCH  /projects/:id           { listed }: show it in the gallery or not (400 unless shared; unsharing takes it out too)
// GET    /projects, /projects/:id  ProjectSummary gains listed, galleryHidden and plays (all time)
// GET    /public/gallery?sort=popular|new&cursor=&limit= -> GalleryPage   (no sign-in; limit 1-48, default 24; listed, shared,
//                                                       not hidden, built; popular = plays in the last 7 days)
// GET    /public/games/:id       PublicGame gains plays
// POST   /public/games/:id/play  -> 204                (no sign-in, no body: the share page's game started, one more play for the
//                                                       game today. Nothing about the visitor is kept; an address past its limit
//                                                       (held in memory only) or a game that isn't shared gets 204 all the same)
// POST   /public/games/:id/report -> 204               (ReportBody; no sign-in; 400 bad_request, 404 not shared, 429 too_many)
//
// Added 2026-10-20 (payments part 1, the credit ledger; docs/payments-design.md):
// GET  /me                       credits.expiring: the credits ending soonest (Free: this month's; plans: the carried month)
// GET  /me/usage, GET /me/export UsageEntry.kind gains "expire" and "reversal"; "what" says e.g. "Free credits ended"
// POST /projects, POST /projects/:id/messages   402 free_paused when Free builds have cost $20 of AI today across TypePlay
// Free credits: 20 at sign-up and 20 more a month (unused ones end with the month); plan credits carry over one month.
//
// Added 2026-10-20 (payments part 2, Paddle; docs/payments-design.md §5-7, §9):
// GET  /me                       billing: MeBilling (mode, status, pendingPlan, periodEndsAt, cancelsAt, hold)
// POST /webhooks/paddle          Paddle only (no sign-in: the Paddle-Signature header is the check) -> { ok: true }
// POST /projects, POST /projects/:id/messages   403 billing_hold while a payment is disputed (chargeback)
// DELETE /me                     cancels the subscription at Paddle first; 409 billing_busy within the hour before a
//                                renewal, 503 billing_off when Paddle doesn't answer ("Try again in an hour")
//
// Added 2026-10-22 (the payments review): GET /me/export gains `payments` (each with the tick box's version and time)
// and `billing`; PlanChangePreview gains `taxNowUsd` (optional); a plan or renewal payment refunded in full ends the
// plan at once (Me.plan free, the subscription left as it is at Paddle).
//
// Added 2026-10-20 (payments part 3, the billing endpoints; docs/payments-design.md §7-9):
// GET    /billing                       -> BillingInfo          (the plan, the subscription, credits by part, payments, consent)
// POST   /billing/checkout              -> { transactionId }    (CheckoutBody; the browser opens Paddle's overlay with it)
// GET    /billing/checkout/:id          -> CheckoutStatus       (completed once the payment is on the account)
// POST   /billing/checkout/:id/verify   -> CheckoutStatus       (no webhook in 20 s: the API asks Paddle and applies the payment itself)
// GET    /billing/plan-change?plan=     -> PlanChangePreview    (what an upgrade costs now, or that a downgrade waits for the renewal)
// POST   /billing/plan-change           -> PlanChangePreview    (PlanChangeBody; up: the card is charged and the credits follow in a
//                                                                moment; down: pendingPlan until the renewal)
// DELETE /billing/plan-change           -> { ok: true }         (undo a waiting downgrade)
// POST   /billing/cancel                -> { cancelsAt }        (at the end of the paid period; the plan and its credits stay until then)
// DELETE /billing/cancel                -> { ok: true }         ("Keep my plan")
// POST   /billing/portal                -> PortalLinks          (Paddle's portal: invoices, the card, withdrawal)
// Their errors: 503 billing_off (no keys, sandbox billing not for this user, or Paddle not answering), 403 plan_required
// (a pack on Free), 403 billing_hold, 409 billing_busy (a plan while subscribed, a pending change, a renewal within the
// hour, a declined card), 400 bad_request (an unknown item or plan, the tick box's wording version not current,
// acceptedTerms missing, "the plan you're on"), 404 not_found (another user's checkout).
//
// Added 2026-10-18 (Android export, package 7; docs/android-export-design.md §9; owner only):
// GET    /me                                     features: { android } (false = the server has no Android toolchain: hide the pill)
// GET    /projects/:id/android                   -> AndroidState        (no side effects; 404)
// POST   /projects/:id/android                   -> AndroidState        (SetupAndroidBody; makes the upload key; 403 plan_no_export,
//                                                                        409 busy (already set up) / name_taken, 400, 503 android_off)
// PATCH  /projects/:id/android                   -> AndroidState        (UpdateAndroidBody; 400, 409 name_taken / busy (package locked
//                                                                        without confirmPackageChange))
// POST   /projects/:id/android/builds            -> AndroidBuild        (StartAndroidBuildBody; 202, the queued row; 403, 404 (no setup, no
//                                                                        such version), 409 busy (a build of this game is queued or running,
//                                                                        or the game is being built), 429 too_many)
// POST   /projects/:id/android/builds/:bid/cancel -> AndroidBuild       (queued -> cancelled; running -> the job is killed; 404)
// GET    /projects/:id/android/builds/:bid/download -> the signed file  (Content-Disposition: attachment; filename="<slug>-v<versionCode>.<ext>";
//                                                                        APK as application/vnd.android.package-archive; 404, 410 expired)
// POST   /projects/:id/android/builds/:bid/link  -> AndroidLink         (a 10-minute no-sign-in link for the phone; 404)
// GET    /android/dl/:token                      -> the signed file     (no sign-in; the link above; Cache-Control: no-store; 404 after 10 min,
//                                                                        or when the build is gone). Where builds live in R2 the answer is a 302
//                                                                        to a presigned URL made at that moment (good for a few minutes, never
//                                                                        past the link's 10), also no-store: browsers and phones just follow it.
// GET    /projects/:id/android/icon              -> image/png          (the app's icon picture: the uploaded PNG, else the start-screen picture
//                                                                        a build would use; owner only; 404 without Android setup or a picture;
//                                                                        Cache-Control: private, max-age=300; the site fetches it with the sign-in header)
// GET    /projects/:id/android/key               -> application/zip    (<slug>-upload-key.jks + README.txt with the password; owner only,
//                                                                        5 downloads a day: 429 too_many)
// Progress: no new stream. GET /projects/:id/events emits { type: "android", build } on every status change of a
// build of that game; the Android page refetches GET /projects/:id/android on it. ProjectSummary.status is
// "exporting" while a build runs; chat, restore, download and delete answer 409 busy then.
//
// Added 2026-10-23 (beta 1: the closed beta and feedback; PLAN.md package 6):
// every signed-in route           403 invite_only while the closed beta is on (BETA_INVITE_ONLY) and the signed-in email
//                                 isn't invited: GET /me included (the site shows its closed-beta screen); no user is made
// POST /feedback                  -> { id }             (FeedbackBody; 201; 400 bad_request, 404 not_found (not your game),
//                                                       429 too_many (10 a day))
// GET  /me/export                 gains `feedback`
//
// Added 2026-10-25 (beta codes, Luka 10-24):
// POST /beta/code                 -> BetaCodeResult     (BetaCodeBody; signed in, the one route an uninvited email may call: it
//                                                       is the way in; 400 bad_request (not six digits), 403 code_wrong (wrong,
//                                                       used up, or used by this account already), 429 too_many (5 wrong an
//                                                       hour per email, 50 an hour in all))
//
// Added 2026-10-26 (the build queue, apps/server/README.md "The build queue"):
// POST /projects, POST /projects/:id/messages   no more 409 busy when every builder is busy: the build waits in line
//                                 (status "queued", `queue`; its agent message is "queued"), then starts by itself ("started").
//                                 Credits are checked as before when it is sent and again when it starts (and for a Free build the
//                                 kill switch, free_paused), so a build can leave the line with a "failed" message and 0 credits.
//                                 A queued build counts as one of the plan's builds at once (409 busy past it, as before).
// POST /projects/:id/cancel       also takes a waiting build out of the line (its message: failed, 0 credits).
// POST /projects/:id/restore, POST /projects/:id/android/builds   409 busy while the game's build waits in line too.
// GET  /projects/:id/events       { type: "queued", messageId, queue } when a build joins the line and when its place or wait
//                                 changes; a build that waited past the limit (30 minutes after its turn) leaves with "failed".
// Message.startedAt: when the build started.
//
// Added 2026-10-27 (the gallery as a library, /explore):
// GET  /public/gallery            gains sort=all (A to Z by name), genre=<Genre> (only games built with that genre skill) and
//                                 q=<words> (names containing them, any case; up to 60 letters); a first page (no cursor) also
//                                 says `total` (games matching genre and q) and `genres` (games per genre in the whole gallery).
//                                 The cursor belongs to its sort, genre and q (400 bad_request for another genre or a bad one).
//
// Added 2026-10-27 (more genres and tags): Genre gains platformer, shooter, arcade and adventure; GameTag gains firstperson,
// scifi, fantasy, roguelike, turnbased and 2players. POST /projects refuses firstperson with 2d (400), as it refuses the pairs.

export type ApiErrorCode =
  | "unauthorized" // no or bad token
  | "not_found"
  | "busy" // a run is already active or waiting in line on this project, or the plan's builds at once are used (409)
  | "no_credits" // not enough credits (402)
  | "daily_limit" // Free plan: 5 credits a day used (402)
  | "free_paused" // Free builds are paused until 00:00 UTC: the day's free allowance is used up across TypePlay (402)
  | "model_not_in_plan" // e.g. Smart on Free (403)
  | "needs_confirm" // estimate passes the ask-first limit and confirm wasn't sent (409)
  | "plan_required" // a credit pack needs a paid plan (403)
  | "billing_hold" // a payment was disputed with the bank: buying and building are paused until an admin clears it (403)
  | "billing_busy" // something must happen first: undo a pending change, wait for the renewal within the hour, update a declined card (409)
  | "billing_off" // payments aren't available: no keys, or Paddle isn't answering (503)
  | "plan_no_export" // Android export needs a paid plan (403)
  | "android_off" // this server has no Android toolchain (503)
  | "too_many" // too many builds, key downloads, reports or feedback notes for now (429)
  | "name_taken" // another game on TypePlay already uses this package name (409)
  | "invite_only" // the closed beta: this signed-in email isn't on the invite list (403, every signed-in route)
  | "code_wrong" // a beta code that isn't right, is used up, or this account used already (403, POST /beta/code)
  | "bad_request"
  | "server_error";

export interface ApiError {
  error: ApiErrorCode;
  /** One plain sentence the site can show as is. */
  message: string;
}

// ---- Live run events -----------------------------------------------------------------------
// GET /projects/:id/events streams Server-Sent Events, `data: <RunEvent JSON>` per event.
// The browser reads it with fetch() (so it can send the Authorization header), not EventSource.
// On connect the server first sends a "snapshot" so a page opened mid-run catches up; when no run
// is active it sends the snapshot and keeps the stream open for the next run (heartbeat comments
// every 20 s). Events are for one project.

export type RunEvent =
  | { type: "snapshot"; project: Project }
  /** A build waits for a free builder: sent when it joins the line and whenever its place or rough wait changes (2026-10-26). */
  | { type: "queued"; messageId: string; queue: QueuePlace }
  /** A run began (after POST /projects or POST /messages, or when a build waiting in line got its turn). `startedAt`: 2026-10-26. */
  | { type: "started"; messageId: string; model: ModelChoice; effort: Effort; startedAt?: string }
  /** Progress, for the "building…" line: short plain words, e.g. "Writing the player", "Testing the game", "Step 2 of 2: polish". */
  | { type: "progress"; messageId: string; text: string; at: string }
  /** The run finished: the agent message is final, and on success there is a new version to play. */
  | { type: "done"; message: Message; version: Version | null; project: ProjectSummary; credits: CreditBalance }
  /** The run failed or was cancelled, or a build left the line without starting (stopped, waited too long, or no longer
   * allowed at its turn: the message says which): nothing charged, the game is unchanged. */
  | { type: "failed"; message: Message; project: ProjectSummary; credits: CreditBalance }
  /** An Android build of this game changed status (2026-10-18). The game page ignores it; the Android page refetches its state. */
  | { type: "android"; build: AndroidBuild };
