# TypePlay site (`apps/web/`, live on typeplay.app)

Next.js 16 (App Router, Turbopack), Tailwind 4, Motion, Phosphor icons. One project holds the
public pages (home, pricing, terms, privacy, refunds) and, from package 4 on, the app.

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_GAMES_ORIGIN, see below
npm run dev                  # http://localhost:3000
npm run check                # tsc + eslint (with typeplay/ui-only, the shared-pieces rule) + that rule's tests
npm run shots                # screenshots of every page into ../.impeccable/review (Playwright on the installed Edge)
```

The playable games come from the separate **games origin** (`../games`, live on typeplay.dev).
Run it alongside the site in dev: `cd ../games && npm run build-demo && npm run serve` (port 3001).
`npm run posters` captures the demo's poster images from it into `public/games/`.

## Where things live

- `src/content/`: everything that is a fact, not a layout: `site.ts` (name, domains, email,
  seller, plans, platforms, games origin), `games.ts` (the test games on the home page),
  `demo.ts` (the "say what to change" steps), `legal.ts` (terms, privacy, refunds).
- `src/components/ui/`: every UI piece, once (Luka, 10-24): `Button`, `ButtonLink`, `InkPill`, `TextButton`,
  `IconButton`, `Chip`, `Pressable`, `TextField` / `TextArea` / `Select`, `Checkbox`, `Toggle`, `Segmented`,
  `ChoiceRows`, `Popover`, `Menu`, `Dialog`, `Tabs` / `PillNav`, `Card`, `Panel`, `Ask`, `Strip`, `Callout`,
  `ErrorLine`, `PageWidget`, `AppIcon`, `GameCard`, `Avatar` and the rest. Pages and the parts below compose them;
  `eslint/ui-only.mjs` fails a raw `<button>`, `<input>`, `<dialog>`, a popover or a piece's class anywhere else
  (DESIGN.md "Components"). A missing piece, or a new look of one, is made there first.
- `src/components/`: the home-screen world's parts (`StatusBar`, `Dock`, `GameIcon`, `Notice`,
  `PromptForm`, `BuildingIcon`, `Launcher`, `GameFrame`, `Demo`, `LegalSheet`, `Wallpaper`,
  `Ground`, `Footer`). Client components only where there is state or motion.
- `src/app/globals.css`: all tokens and the public pieces' styles (the app's in `components/app/app.css`), each
  under the name of its component; no inline styles in TSX.
- `public/games/`: screenshots of the test games (JPEG comments carry their origin).
- `scripts/`: dev tooling only (screenshots, posters); not shipped. `shot-compare.mjs` shoots every page and popup at
  phone and desktop width on a base commit and on the working tree, with the same fixtures, and lists the pairs that
  differ (`node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-compare.mjs --base <ref>`, from the repo root;
  shots and the list in `.impeccable/review/compare/`).

Design authorities: `../../PRODUCT.md` (product record) and `../../DESIGN.md` (the design system).

## The app (package 4): sign-in, /create, /games, the game page

Built 2026-10-17 against the API contract in `packages/shared` (types only).

**The gate.** The app exists only when `NEXT_PUBLIC_APP=1`. `.env.development` (committed, no
secrets) sets it for `npm run dev`; `next build` never reads that file, so the live build is the
public site alone until the API has a server (package 5). It works through file names
(`next.config.ts`, `pageExtensions`): app routes end in `.app.tsx` / `.app.ts` (`create/page.app.tsx`,
`games/…`, `auth/callback/route.app.ts`, `src/proxy.app.ts`), the placeholder /create is
`create/page.site.tsx`, and the status bar's account place is aliased to `components/SignInPill.tsx`
or `components/app/AccountSlot.tsx` (which also carries all app styles, `components/app/app.css`).
`npm run build` = today's public site; `NEXT_PUBLIC_APP=1 npm run build` adds the app.

**A local site for Luka** (no deploy to look at changes): `node scripts/local-site.mjs start | update | stop | status`
runs a built copy of this checkout on http://localhost:3000 (Google sign-in, real builds, its own Postgres on :54329,
the showcase games in the gallery) in the background until `stop`; `update` after a batch. Details in the script's head.

**Run it locally** (one at a time, not the root `npm run dev`):

```bash
node scripts/local-db.mjs start                            # this PC's Postgres (typeplay_dev; docs/environments.md)
DEV_AUTH=1 AGENT_FAKE=1 node apps/server/dist/main.js     # API on :3002, fake builds (apps/server/README.md)
node apps/games/scripts/serve.mjs                          # games origin on :3001
NEXT_PUBLIC_DEV_AUTH=1 npm run dev -w web                  # site on http://localhost:3000
```

- **Google sign-in** (Supabase, PKCE): open the site as **http://localhost:3000** (that is the
  address Supabase allows back; 127.0.0.1 is not). `/auth/callback` swaps the code for the session
  cookie; `src/proxy.app.ts` refreshes it on /create and /games. The Supabase URL and publishable
  key are public by design and live in `src/content/app.ts` (`node scripts/supabase-config.mjs`
  copies them from the root `.env`, printing only lengths). Never the secret key.
- **Dev sign-in** (tests only): `NEXT_PUBLIC_DEV_AUTH=1` shows "Dev sign-in" on /create, which
  signs in as `dev:<email>` (the API must run with `DEV_AUTH=1`). A production build with it set
  refuses to start (`next.config.ts`), and the code ignores it outside `next dev`.
- `NEXT_PUBLIC_API_ORIGIN` (default `http://127.0.0.1:3002`).
- **Tests with screenshots** (through the CPU limiter, one browser):
  `node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-app.mjs` signs in (dev), builds,
  plays, changes, fails a change ("FAIL"), restores, checks credits and the Free plan's locks, then
  the phone layout, then the 10-18 additions below (60 checks, shots in `.impeccable/review/app/`). `scripts/shot-worst.mjs` renders
  worst-case data (long names, 0 and 1,287 credits, 60 messages, 21 versions, a failed first build)
  by answering the API's calls in the browser; it needs only the site.

Where it lives: `src/lib/` (`session.ts` sign-in state, `api.ts` the API and the live events read
with `fetch()`, `supabase.ts`, `format.ts`), `src/components/app/` (account menu, model picker,
chat, composer, game stage, versions), `src/app/create/CreateApp.tsx`, `src/app/games/`.

### Account, game management, share pages (added 2026-10-18)

- **/account**: the Google profile, plan and credits, the **credit history** (every credit in and out:
  when, what, which game, the prompt; 25 at a time, Show more), **Download my data** (a .json file),
  **Delete my account** (asks first: type DELETE; then signs out and says goodbye). "Plan and billing"
  goes to **/billing** ("Plan and billing" below, since 10-20).
- **Games**: **Manage** on /games turns the icons into rows with Rename, Download (.zip) and Delete
  (asks first). On the game page the bar has **Share** and **More** (Rename, Download the project,
  Play in a new tab on phones, Delete game); both are the shared `Popover` (`components/ui/Popover.tsx`).
  Game icons and the frame before Play show the build's start screen (`poster.png`) when it has one.
- **Effort** (Low / Medium / High) under the model switch in the chat and on /create, with one honest
  line each (`content/app.ts` `efforts`); the estimate follows it. Default Medium; the Free plan gets
  all three (pricing limits its model, not its effort).
- **Share page `/play/<id>`** (public, no sign-in; `app/play/[id]/`): the game in its frame, its name,
  "Made with TypePlay" and **Make your own** (/create). Per-page title, description and canonical
  address; the link preview is `/play/<id>/preview.png` (`card.tsx`: the start screen in an ink frame
  on the dusk desert, the site's fonts from `assets/fonts/`, SIL OFL). A route handler, not the
  `opengraph-image` file: under the app gate's `.app.tsx` names Next 16.4 links that file and then
  answers 404. **The share pages say `noindex` (kept out of search) until Luka says otherwise**: then
  drop `robots` in `app/play/[id]/page.app.tsx` and list shared games in `sitemap.ts`. Private by
  default; unsharing makes the page (and its preview) 404 at once, since nothing is cached. The real
  404 status comes from `src/proxy.app.ts`: it asks the API first and sends an unshared game to the
  prerendered `/play/not-shared` (the page itself streams after its shell, as Cache Components pages do,
  too late to change the status; checked on a production build). App builds only, like the rest: the
  live site has no API yet.
- **Tests:** `scripts/shot-app.mjs` now also checks effort, share (signed out, the preview, unshare →
  404), rename, the .zip, Manage and delete, the account page, the data file, the delete-account ask
  and a real account deletion (60 checks). `scripts/shot-worst.mjs` adds the new screens with worst-case
  data; pass real shared game ids as a 5th argument to include share pages.
- **`scripts/shot-app.mjs`** builds through the real ask-first flow (High effort on /create → the API's
  409 → "Build it") and, whatever happens, closes both its test accounts at the end (`DELETE /me`), so
  a run that stops halfway leaves no game folder, builds or rows behind. Share pages the API can't
  answer for (down, a deploy) say "We can't load this game right now" instead of Next's error page
  (`lib/public.ts` `UNAVAILABLE`; the preview answers 503). A game the loader can't load shows
  "This game couldn't load" with Try again in the frame (`GameFrame`, play.html's `error` message).
- **Live updates that end for good** (signed out, the game deleted from another device, a stream the
  API keeps refusing): `watchProject` reports `stopped`, and the game page says so in place of the
  "Reconnecting…" line: a 401 signs out, a 404 says the game was deleted with a link to /games, anything
  else offers Retry. On the first drop after being live it fetches the project once, so a build that
  finished meanwhile shows even if reconnecting keeps failing. `Me.notice` (one sentence: no free
  credits because this email closed an account lately) shows on /create and /account.
- **A second dev server** for tests beside the one on :3000 (each `next dev` locks its folder):
  `NEXT_DIST_DIR=.next/test npx next dev -p 3010` with `NEXT_PUBLIC_DEV_AUTH=1`,
  `NEXT_PUBLIC_API_ORIGIN` / `NEXT_PUBLIC_GAMES_ORIGIN` pointing at test servers (the API then needs
  `CORS_ORIGINS=http://localhost:3010`). It adds `.next/test/…` lines to `tsconfig.json`: don't commit those.

### Plan and billing (payments part 3, 2026-10-20)

The spec is `docs/payments-design.md` §7-9; the facts and words in `src/content/billing.ts` (the tick box
and its wording version, the plan facts from `site.ts`, where a purchase starts). Everything is app
builds only and talks to the API's `/billing` routes (`apps/server/README.md` "Billing endpoints").

- **`/billing`** (`app/billing/BillingClient.tsx`). With billing on (the API's `Me.billing.mode` is sandbox
  or live **and** the build carries a Paddle client token) the page is: the **strips** that need a decision,
  one sentence and one button each (past due with Update card; a scheduled cancel with Keep my plan; a
  downgrade waiting with Keep High; a refund with Paddle for approval; a plan that lapsed with Get a plan;
  a disputed payment); the **plan card** (Free: "20 credits a month, up to 5 a day, on Fast." and "14 left,
  3 more today. 20 more on 1 Nov."; paid: the price, "Next payment 17 Nov: $50 plus tax, Visa ending 4242."
  and the credits to spend by part, "160 credits to spend: 20 free (until 1 Nov), 100 from Medium (carry
  over to 17 Dec, up to 100) and 40 from a pack (until 18 Oct 2027)"), with Buy a credit pack / Change plan /
  Cancel plan (asks first; the last step is the ink button); the **plan picker** (Free, cancelled or lapsed:
  Get Medium → the checkout; subscribed: Upgrade → Paddle's own preview, "You pay $16.50 now (tax
  included), charged to Visa ending 4242, and get about 87.5 credits now; then $50 a month from 17 Nov" →
  Upgrade to High; Switch at renewal → "Nothing now. From 17 Nov you pay $20 a month…" → the downgrade
  strip); and the **payment card** (Update card and Invoices and receipts open a fresh portal link in a
  new tab, one `POST /billing/portal` per click; "Withdraw from contract here"; the consent record "On 17 Oct
  you asked us to start right away (wording v1)"; the help email and phone; the payments with their tax,
  invoice number and what became of them: paid and refundable until, refunded, disputed, refund pending).
  Billing off, or no token in the build: the beta text ("opens here soon"). `?change=1` opens the picker at
  once (the game page's panels link there).
- **`/billing/checkout?item=plan:<id>|pack&back=<path>`** (`app/billing/checkout/CheckoutClient.tsx`): the
  sum ("$50 a month, plus tax where it applies. Renews every month until you cancel. 275 credits a month;
  unused ones carry over once, up to 275." / "Add 40 credits. $10 plus tax. Good for 12 months; used after
  your plan credits."), the required tick box (wording v1; the version goes with `POST /billing/checkout`
  and the API stores it with the time), "By continuing you accept the Terms of service and the Refund
  policy.", then **Continue to payment** → `Paddle.Checkout.open({ transactionId, settings: { displayMode:
  "overlay", theme: "light", locale: "en", allowLogout: false } })`. `components/app/Paddle.tsx` loads
  `https://cdn.paddle.com/paddle/v2/paddle.js` once, on these pages only, `Paddle.Environment.set("sandbox")`
  under `NEXT_PUBLIC_PADDLE_ENV=sandbox`, `Paddle.Initialize` once with the token. On `checkout.completed`
  the page says "Paid. Adding your credits…", asks `GET /billing/checkout/:id` every 2 s and `POST …/verify`
  at 20 s (and every 20 s after: the API pulls the transaction from Paddle itself when no webhook landed),
  and after 90 s adds "Paddle confirmed your payment and is emailing the receipt; your credits should
  appear within a few minutes, else write to hello@typeplay.app". `checkout.closed` before paying: "Nothing
  was charged." Done: "You're on Medium. 100 credits added." with Back to your game (`back=/games/<id>`) or
  Make a game. A pack on Free ("Credit packs are for paid plans. Get Medium first") and a plan while
  subscribed ("Change it on the billing page") are turned away before Paddle opens.
- **Game page**: the API's 402 `no_credits`, 402 `daily_limit`, 402 `free_paused` and 403 `billing_hold`
  become an ask-style panel in the composer (`Composer.tsx`): "You've used this month's free credits. 20
  more arrive on 1 Nov. Or get Medium…" [Get Medium, $20 a month]; on a paid plan "You're out of credits
  until 17 Nov. Add 40 for $10 now, or move up to High (275 a month)." [Add 40 credits, $10] [Upgrade];
  "Today's 5 free credits are used. More at 00:00 UTC…"; the kill switch's sentence; the hold's sentence;
  every button deep-links to the checkout and back to the game. A past-due plan shows its strip above the
  composer with Update card. **/account**: "Renews on 17 Nov." / "Ends on 17 Nov." / "Moves to Medium on…",
  and closing an account with a plan says "Your High plan is still active: it is cancelled when the account
  closes." **`/create?plan=<id>`** (the pricing CTAs; `site.ts` says `ultra-plus`, the API `ultraplus`) sends
  a signed-in user straight to the checkout; signed out, the sign-in comes back to it. `src/proxy.app.ts`
  refreshes the session on `/billing/*` too.
- **Env** (`.env.development` has them commented out with where they come from; put the real ones in
  `.env.local`): `NEXT_PUBLIC_PADDLE_ENV` (sandbox | live) and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` (`test_…` /
  `live_…`, public by design: it goes to every browser). Both are read at build; `next.config.ts` refuses a
  token whose prefix doesn't match the env, and a live token outside a production build. Without a token
  the billing pages say "opens here soon" and nothing else changes. Live: build args in
  `deploy/server/compose.yaml` (`deploy/server/Dockerfile` passes them to `next build`).
- **Copy rules** (docs/pricing.md): credits "to spend", "added", "ended", "refunded"; never balance, wallet,
  coins or gifts. Prices in US dollars; "plus tax" where Paddle adds it; an upgrade's charge is shown tax
  included because that is the number Paddle's preview gives and the card is charged.
- **Tests.** `scripts/shot-app.mjs` first checks `/billing` and the checkout with billing off against the
  API it was given, then starts a sandbox API of its own on :3017 pointed at the Paddle stub
  (`apps/server/test/paddle-stub.mjs`), sends the browser's API calls there and replaces `window.Paddle`
  with a stand-in that completes the transaction at the stub (the real paddle.js can't pay against a
  stub): the Free card and picker, pricing → `/create?plan=medium` → the checkout, the tick box, the
  overlay's settings, the paid state, the done state through the 20 s verify (no webhook from the stub),
  a closed overlay ("Nothing was charged"), the pack confirmed by a signed webhook within seconds, the paid
  card with the credits by part and the payments, the upgrade preview and its confirm (then Paddle's
  `subscription_update` transaction by webhook → High), Switch at renewal → the strip → Keep High, Cancel
  plan → ask → the strip → Keep my plan, the portal in a new tab, the account page's renews line and
  close warning, the composer panels with a paid user and a Free user at 0 credits (planted with the admin
  CLI; the daily limit, kill switch and hold played back), the past-due strip, the phone layouts and 320 px.
  **The site under test must be started with `NEXT_PUBLIC_PADDLE_ENV=sandbox
  NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_shots`** (any `test_` token; nothing real is called); the check that
  says so fails otherwise and the rest of that part is skipped. `scripts/shot-worst.mjs` renders the billing
  page with every strip at once, 1,287.4 credits in five parts, 30 payments of every kind and status, a long
  card name, a Free user with 0 credits whose plan lapsed, the upgrade preview with a $12,345.67 charge, and
  the checkout page's turn-aways, at desktop, phone and 320 px.

**The Paddle sandbox on this PC** (what the stub can't prove; docs/payments-design.md §12 "Manual", §14):

1. Keys, development's: the root `.env.local` holds `PADDLE_ENV=sandbox`, `PADDLE_API_KEY=pdl_sdbx_apikey_…`,
   the five `PADDLE_PRICE_*` (`npm run paddle:catalog -w @typeplay/server -- --env sandbox`) and
   `PADDLE_WEBHOOK_SECRET` (step 2); `apps/web/.env.local` holds `NEXT_PUBLIC_PADDLE_ENV=sandbox` and
   `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=test_…`. Paddle > Checkout settings needs the default payment link
   (`https://typeplay.app/billing`) before any overlay opens.
2. Webhooks to this PC: `node apps/server/scripts/webhook-tunnel.mjs 3062` (a quick tunnel that forwards only
   `POST /webhooks/paddle`), then `npm run paddle:destination -w @typeplay/server -- --env sandbox --url
   <its address>` (makes the destination and writes its secret, or moves it to the new address); `--off`
   at the end, when the tunnel's address dies.
3. `npm run build -w @typeplay/server`, then `scripts/paddle-sandbox.mjs` through the CPU limiter: `stack`
   (the API on :3062 and the site on :3060, on this PC's `typeplay_sandbox` database), `buy` (a real overlay
   checkout with a test card), `call`, `state`, `page`, `portal` (its header). In Git Bash, set
   `MSYS_NO_PATHCONV=1` for commands with a `/path` argument.

Proven 2026-10-25: a plan with `4242 4242 4242 4242` (the overlay asks email and country, then the card;
the credits by webhook within seconds), 3-D Secure `4000 0038 0000 0446` (the bank's page inside the
overlay, then done), declined `4000 0000 0000 0002` (Paddle's own message, nothing charged), the upgrade
(the preview's charge is what Paddle bills; 174.9 credits for Medium → High on day 1), switch at renewal
(nothing now, exactly the new price next) and its undo, cancel and keep back to back, two packs, the portal
links (overview, cancel, update card), Paddle's simulations (signed with the destination's secret; their
example ids are parked, nothing granted), refunds (`admin refund <email> last` → the strip "A refund of $…
is with Paddle for approval", the credits on hold → approved within 5 minutes: the pack's 40 credits gone; a
plan month refunded in full ends the plan; the payments list says refunded; Paddle keeps its fee, `retained_fee`
$1.09 on the pack and $1.68 on Medium, 5% + $0.50 of the total with tax).

Still open: the receipt and "Subscription Price Changed" emails (sandbox mail reaches only the account's
own domain: a purchase as `hello@typeplay.app` sends them to Luka), `4000 0027 6000 3184` (pays, then declines
the renewal a month later: past due, and whether `current_billing_period` advances), a California-address
checkout (Paddle's auto-renew box), and the overlay on a real phone (Safari). Found by the run and built the
same day: a refund of a plan's payment also cancels its subscription at Paddle (Luka: a refund means they don't
want it any more; before, the plan ended here but Paddle renewed it next month).

### Export to Android (package 7, 2026-10-18)

The screens of `docs/android-export-design.md` §11-12 against the contract's "Android export" block; the API side
is `apps/server/README.md` "Android export". App builds only; every sentence is in `src/content/android.ts`
(APK and AAB are explained once there; the failure sentences and the checks come from the API as they are).

- **The Android pill** in the game's bar, next to Share, when the game has a build and the API says
  `Me.features.android` (a server without the toolchain shows no pill). It links to **`/games/<id>/android`**
  (`app/games/[id]/android/`, parts in `components/app/android/`). While a build runs the pill is hot, the stage
  says "Building the Android version…" and the composer is off with "An Android build is running" (the API
  answers 409 to chat, restore, download and delete meanwhile; `ProjectSummary.status` is `exporting`, kept in
  step from the `{ type: "android" }` events).
- **Free plan**: "Android builds come with a plan" with See the plans → `/billing?change=1`. No build yet: "Build
  your game first".
- **Setup** (`Setup.tsx` + `IdentityForm.tsx`): the app name (prefilled from the game's, 30 max), the package name
  (the suggested `app.typeplay.<slug>_<id>` read-only; "Use my own" opens the field, checked with the API's own
  rules before sending: `packageNameProblem` in `content/android.ts`), the icon (the game's start screen, or an
  uploaded PNG checked in the browser: PNG magic, square, 512 or more, under 1 MB; sent as base64 with `PATCH`
  after setup). One hot button, "Set up Android", makes the key.
- **The hub** (`Hub.tsx`): **Build** (the version, "APK for your phone" hot and "AAB for Google Play" quiet with
  their usual times, the live state from the events: Waiting for its turn with the queue position → Building →
  Signing, a clock, Stop, "You can leave this page"; off while the game itself is building or today's builds are
  used); **Your builds** (`BuildList.tsx`: a row per build, newest first, Download, Phone link on APKs, Checks on
  finished rows (`Checks.tsx`: the API's list, a tick or the hot dot and one sentence), the failure sentence with
  Details (the last 4 KB of the log), Build again on failed, stopped and expired rows, or Open the chat after a
  game-code failure (building again would fail the same way), "Download it within N days"); **This app** (name,
  package, the icon, Change → the same form; after the first AAB the package is fixed and a change asks first, then
  sends `confirmPackageChange`. The icon tile shows the uploaded PNG on every visit: this visit's upload from memory,
  later visits from `GET …/android/icon` (`useAppIcon.ts`: fetched with the sign-in header, shown from an object URL,
  revoked on leave; the request is made only when the game has an uploaded icon, and with `cache: "no-store"` like every
  API call, so a replaced icon shows at once whatever the route's `max-age`). No upload: the game's start screen from the
  games origin; the neutral icon when there is neither, or when the PNG can't be fetched. The tile fades its picture in
  and holds the neutral icon back for 450 ms while the PNG is on its way (no flash of one picture before the other), and
  has a 1px hairline inside its edge so a light icon doesn't melt into the white card); **Your signing key** (`KeyCard.tsx`:
  one paragraph saying nothing has to be done with it, Download signing key → the .zip, the count; the Play
  recovery path and the fingerprint in pairs behind "If you lose it"); **Putting it on Google Play**
  (`PlayChecklist.tsx`: the static checklist of §12 with the game's real testers link and the 12-testers rule
  behind a "when was your account made" switch; open on the first visit, then Show / Hide the steps, both
  remembered in localStorage). After setup, one line says "Android is set up…" and the keyboard lands on Build.
- **The phone link**: `POST …/link` on the row (opened by the Download itself on an APK) → a QR code drawn in the
  page (`lib/qr.ts`, byte mode, level M, versions 1-10, no library; checked against jsQR) beside the link, a
  countdown of its 10 minutes, Copy link, New link when it expired, and the install steps (allow your browser once,
  Play Protect's "Install anyway", uninstall before the Play version). On a phone (under 640px) the steps come first
  and the code is hidden. The API's phone link is always the short `/android/dl/<token>` (~80 characters), also where
  builds live in R2: there the API answers the link with a redirect to a freshly presigned URL (`apps/server/README.md`
  "Android export"), so the code always fits. A link longer than a code can hold (the encoder stops at 213) would show as
  text alone.
- **Run it**: the API with the Android fake, `DEV_AUTH=1 AGENT_FAKE=1 ANDROID_EXPORT=1 ANDROID_FAKE=1
  ANDROID_KEY_MASTER=<64 hex> node apps/server/dist/main.js` (`node deploy/deploy.mjs android-key` makes a key
  into the root `.env`; any 64 hex chars do for tests). Without `ANDROID_EXPORT` the pill is simply absent.
- **Tests**: `scripts/shot-android.mjs` is the Android part of `shot-app.mjs` (called from it; the API under test
  must run with the fake, else that part says so and is skipped) and runs alone with the same arguments: a test
  user of its own builds a game, sees the pill and the Free panel, is put on Medium by the admin CLI, sets up
  (the names, a refused `com.example` name, a 512 and a refused 300 px icon), builds an APK (the live state, the
  row, the 8 green checks, the download named `<slug>-v1.apk`), opens the phone link (the QR's text is the link;
  fetched without sign-in it serves the file), downloads the key zip, builds an AAB (the package locks; a change
  asks and goes through), fails a build (the fake fails an app named FAIL: the sentence, Details), stops a running
  one, sees the game page in the exporting state (played back), then phones and 320 px; and the icon: the tile shows the
  uploaded PNG from memory right after setup with no request, after a reload the card asks the API for it with the sign-in
  header (200, `image/png`) and shows the very PNG that was uploaded, Change shows it in the form's tile, an icon that can't
  be fetched leaves the neutral icon and a working card, the card at 390 and 320 px with a real (drawn) icon, another icon
  uploaded (a light one: a later visit shows the new bytes, not the old, and the tile keeps a hairline edge), and "Use the
  game's picture" (the start screen again, and a later visit makes no icon request) (55 checks, screenshots `android-*`,
  `android-this-app-*` and `game-android-exporting-desktop` in `.impeccable/review/app/`; the helpers `squarePng` /
  `iconPixel` draw the icons in the script, no picture files). Between builds it ages the
  game's rows by two minutes in the dev database (the one-a-minute guard), as the API's own e2e does. The account
  is closed at the end whatever happened. `scripts/shot-worst.mjs` adds the page with a 60-letter app name, an
  80-character package name, 30 builds of every status (a failed one quoting a long error line and a 4 KB log,
  0 bytes, 213.7 MB, expiring today, failing checks with three permissions), today's builds used, a 199-character
  phone link, the edit form with a refused name, setup on a phone, the plan panel at 320 px, the page on a server
  without the toolchain, and the game page while exporting; `SHOT_FILTER=<regex>` renders only the matching screens.
- **For Luka's yes** (not built): the one legal line (`legal.ts`: "we keep an encrypted copy of your Android
  upload key…"), `site.ts` `platforms` Android → "now" at go-live, and the real build times in place of "usually
  under a minute / 2 to 4 minutes" once measured on the server.

### The public gallery (added 2026-10-18)

PLAN.md "Better than the competitors" #9 with #4's share pages; the API's side: `apps/server/README.md` "The public gallery".

- **Two steps, both the maker's.** Sharing makes `/play/<id>` public to anyone with the link. While a game is shared, the
  Share menu shows a second switch, **Show it in the gallery** (off by default), that puts it on `/explore` too. Turning
  sharing off takes it out of the gallery as well, and sharing again leaves it out until the switch goes on again. When an
  admin took it out after a report, the switch's line says so and names the support address; its link keeps working.
- **`/explore`** (`app/explore/`; app builds only, like the share pages; **noindex** until Luka says otherwise,
  `docs/parked.md` row 13): "Explore." with one line and the order as an ink pill bar (**Popular**: most plays in the last 7
  days; **New**: the newest in the gallery); the **top game in its frame** on the share page's ink stage (Play loads the
  real game in place, full screen on a phone; the name links to its page; Full screen, Share, Report this game) with the
  "Make your own game." invitation beside an upright one on wide screens; then **listings** (the start screen at 3:4,
  letterboxed when the game is wide; the name; this week's plays on Popular or all plays on New, over the genre, no plays
  said as nothing; a Play mark; a flag to report it; the card opens `/play/<id>`), **Show more games** (24 a page, fetched
  by the browser), and the invitation again at the end. The first
  page is rendered on the server at request time (`lib/public.ts` `galleryFirst`), so a game taken out leaves at once.
  States: empty (Make a game), one game (no listings), the API not answering. While the other order loads, its pill takes
  the current look at once (`useLinkStatus`).
- **Plays.** A share page's frame, and the gallery's top game, send `POST /public/games/:id/play` when the frame says the
  game started (`ready`), once per page view (`lib/gallery.ts` `countPlay`; Try again doesn't count twice). The maker sees
  the count beside the version in the game's bar, in the Share menu, under the icon on /games (instead of "2 h ago") and in
  Manage ("shared, in the gallery · 1.2K plays"); the share page shows it to everyone ("Made with TypePlay · 1.2K plays").
  Past 999 they read short (`lib/format.ts` `playsWord`: 1.2K, 10M), and a figures line only breaks between its parts.
- **Report this game** (`components/app/ReportDialog.tsx`, words in `content/gallery.ts`): under the share page's frame, on
  the gallery's top game, and as each listing's flag. A modal `<dialog>` in paper at the popovers' radius and entrance: five
  reasons (the terms' "What you may not do" in player words), one optional line (500 letters), Send; then "Thanks for
  telling us." A second report from the same visitor about the same game within a day is thanked and not stored (the API's
  429). Escape, Cancel or a tap beside it close it; the focus goes back to the button that opened it.
- **Links in:** the share page's "More games made with TypePlay" and /games' "Explore games". No status-bar link while the
  app is in beta (a provisional call in `docs/parked.md`).
- **Tests:** `scripts/shot-gallery.mjs`, inside `shot-app.mjs` or alone
  (`node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-gallery.mjs [outDir] [siteUrl] [apiUrl]`, shots in
  `.impeccable/review/gallery/` by default when alone): the empty gallery, the Share menu's switch, a play counted once per
  page view and the counts the maker sees, /explore signed out (Popular, New), a report from a listing and on a share page
  (and a second one from the same visitor), an admin hide (out of the gallery, the link still works, the maker's Share
  menu), phones, then worst cases planted in the database and removed afterwards (300 games, 60-letter, unbreakable, emoji,
  Georgian and Japanese names, 9,999,999 plays, missing and broken pictures, a wide game on top, Show more twice, 320 px).

### Beta 1: the closed beta and Send feedback (added 2026-10-19)

PLAN.md package 6; the API's side: `apps/server/README.md` "The closed beta and feedback"; go-live: `docs/beta/runbook.md`.

- **The closed-beta page** (`components/app/ClosedBeta.tsx`): when the API answers 403 `invite_only` (any call, `GET /me`
  included; `lib/api.ts` marks the session, `lib/session.ts` `uninvited`), the app's pages show "TypePlay is in a closed
  beta." instead of themselves: who it is for and that it opens to everyone soon, then **Have a beta code?**: a six-digit
  box (digits only, a pasted code replaces the one there, the number keyboard, `one-time-code`) and the one hot **Join
  the beta** (10-25, Luka's beta codes: `POST /beta/code`). A wrong code: the API's sentence (the tries left; a limit's
  sentence stays while typing), and the box keeps its focus and the code, selected, so the keyboard stays up. A right
  one: a fresh `GET /me` (`refreshMe({ fresh: true })`: the one sent on load was answered "not invited"), the page gives
  way to the app, and one focused line above it says "You're in the beta. We added 50 credits." (if `GET /me` still says
  not invited: "Your code worked. Reload the page to start."). Then "No code yet?" over a quiet **Play the games** (the
  home page's games), then a Field panel
  with the address this browser is signed in with and two quiet buttons, **Use another account** (Google's account
  chooser, `prompt=select_account`; the new sign-in replaces this one) and Sign out, and the idea saved in this browser
  quoted (cut at three lines) when there is one. It fades in where the page was. It works through a `layout.app.tsx` in `create/`,
  `games/`, `account/` and `billing/` (the `InviteGate`), so every page under them is covered and the public pages (home,
  pricing, the legal pages, `/explore`, `/play/<id>`) are as before. The answer is kept for the tab (`sessionStorage`), so
  a reload shows the page at once while `GET /me` asks again. The status bar's account place shows only the avatar letter,
  and its menu the address, one line on the closed beta and Sign out (no credits, no My games); on phones the page behind
  the account menu dims (any account). The live updates stop on a 403 instead of retrying.
- **Before sign-in** (`NEXT_PUBLIC_CLOSED_BETA=1` at build time, set in `deploy/server/compose.yaml` next to
  `NEXT_PUBLIC_APP`; `content/beta.ts`): the signed-out /create and /games say "A closed beta for now: sign in with
  Google, then type the beta code from your invitation." instead of the Free plan's line. Set it to `"0"` together with the API's
  `BETA_INVITE_ONLY` when the app opens to everyone.
- **Send feedback** (`components/app/Feedback.tsx`): one quiet entry in the account menu (under Plans and credits) and
  one in the game page's **More** menu. A modal `<dialog>` in the report dialog's box, put straight into `<body>`:
  "What happened?" and "What did you expect? Optional" (Field text boxes three and two lines tall that grow, 4,000
  letters each, a figures counter from 3,600: "214 letters left", "That's the most one note holds…" at the end), on a
  game's page the checkout's tick box **Attach this game, so we can play the version you see** with the game's name under
  it (ticked; from the account menu too while a game page is open: `setFeedbackGame`), one muted line on what is kept, a
  hot **Send feedback** that waits for words (Ctrl or Cmd + Enter sends), Cancel. Escape, Cancel or a tap beside it close
  it and the keyboard goes back to the avatar or the More button; the words wait in this browser (a reload, the other
  entry's dialog) until a note is sent. Sent: "Thanks for telling us." with what we have and the address we'd write to.
  The API's refusals show in the dialog with the words kept; after the day's 10 Send stays off. On phones the boxes stop
  at 160px and Send sticks to the dialog's foot. Limits in `content/beta.ts`; the privacy policy names the notes
  (`content/legal.ts`, "What we collect").
- **Tests:** `scripts/shot-beta.mjs` starts a stack of its own on spare ports (the API on :3041 with the closed beta on,
  the games origin on :3042, the site on :3040 as `next dev` with `NEXT_DIST_DIR=.next/beta`; tsconfig.json is put back
  afterwards), so it never touches the dev stack:
  `node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-beta.mjs [outDir]` (build the API first; shots in
  `.impeccable/review/beta/`). It signs in uninvited (the page on /create, /games, /account and /billing, one hot action,
  the account menu, no user row, the public pages as before, Sign out and the closed beta said before sign-in), then
  invites a tester, builds a game and sends feedback from More and from the account menu (the game attached, a three-line
  box from the first open, the keyboard back on the menu's button, the thanks, the row in the database, a draft kept
  across Escape), then worst cases: an unbreakable address and a 4,000-letter saved idea at 320 px (the buttons inside
  their panel), a 60-letter Georgian game name, 3,999 and 4,000-letter notes, the day's 10 used (Send off), phones at 390
  and 320 px. It closes its test accounts and removes the invite and its audit rows afterwards.

### Next-step ideas and the first-build wait (Luka's UX batch 1, 2026-10-24)

- **Ideas for your next change** (`components/app/ChatLog.tsx`): under the newest answer, while its version is the one
  playing, up to three Field pills on the player's side; a tap puts the idea in the box with the caret at its end
  (`Composer` `prefill`), so the cost shows and the player sends it or changes it first (filling, not sending: a tap
  never spends credits). Another tap adds its idea to the same message ("Add coins to collect, add flying traps": one
  build, one charge), never the same one twice (`withIdea`; HQ's call for Luka, 10-24). They come with the answer:
  `packages/agent/tools/next-steps.mjs` makes 9, best first, in one Haiku call beside the player-message rewrite, from
  the game's requests so far and its NOTES.md (~$0.001), and its cost is part of the answer's charge like every AI cost
  a player causes (batch 3.1, Luka 10-24); stored on the message (`Message.suggestions`, migration
  `20261025000000_suggestions`, the contract's `Message.suggestions`). **More ideas**: a fourth pill with a plus mark
  adds the other six under the first three (which stay), then goes until the next answer; no call of its own (batch 4.1).
- **The preview's device** (batches 2.2 and 3.2, `components/app/DeviceMenu.tsx`, `Stage.tsx`): one pill beside Share
  with the device's icon and name opens the list, each with its size: Phones iPhone (393 × 852), Android (412 × 915),
  Small phone (iPhone SE, 375 × 667); Tablet iPad (820 × 1180); Computer Laptop (1366 × 768), Desktop (1920 × 1080),
  Fill the window (the stage as before, the default). The game runs at that size in CSS pixels, drawn smaller by a scale
  when the stage is smaller, in a flat bezel; phones and tablets open the game's own way up, with Turn beside the pill.
  The same frame is resized, so the game keeps running. Hidden on phones and tablets and in windows under 700 px; a bar
  under 620 px wide drops its version line so the name keeps room. Not built yet: the "Made for phones" hint (a game
  doesn't record what it's made for until the platform choice exists).
- **While the first build runs** (`components/app/WhileYouWait.tsx`): under the build's progress on the stage, "Play one
  while you wait": three games as cards, the gallery's listings in small (the start screen at 3:4 with a Play chip, the
  name under it, no kind line: most games have no genre; batch 4.2), the gallery's most played this week, then the home
  page's games; one of the kind the first sentence sounds like first, then other kinds; and **More in the gallery**. A tapped game plays in the
  stage (full screen on a phone) with the build's line above it and Close; when the build is done that line becomes
  "<name> is ready." with a hot **Play it** (also over the game while it is full screen: `GameFrame` `notice`). Phones
  open the game page on Play during a first build. **The way back from the gallery** (`components/app/BuildPill.tsx`,
  mounted from the account slot, put into `<body>`): the gallery button remembers the game for this tab
  (`sessionStorage`), and every other page shows an ink pill that follows the build ("Building your game 1:23") and turns
  into "<name> is ready. Play it"; gone once the player is back on the game's page or closes it.

## Known trap

Turbopack's file watcher on this PC misses edits to `globals.css` (and `app.css`): restart
`npm run dev` after changing them. `next.config.ts` allows `127.0.0.1` as a dev origin so
screenshots work.

## SEO and sharing (set up 2026-10-16)

- **Every public page is static HTML** built at deploy (`○ Static` in `next build`): crawlers and
  link-preview bots get the full content without running JavaScript. The signed-in app will be
  `noindex`; SEO is for the public pages and, later, the public game pages.
- **Per page:** title (template `%s | TypePlay`), description, canonical URL (`alternates.canonical`).
  The pricing description is built from `plans` in `content/site.ts`.
- **Share card and icons:** files in `src/app/` (`opengraph-image.png` + `twitter-image.png`
  1200×630, `favicon.ico`, `icon.svg`, `apple-icon.png`) and `public/icons/` (manifest icons), all
  drawn by `node scripts/brand.mjs` from the site's own parts. Re-run it after a design change.
  `manifest.ts`: name, colours, icons. `viewport.themeColor` colours the phone's browser bars.
- **Structured data:** `content/seo.ts` (Organization, WebSite, WebApplication with the plans' prices
  from `site.ts`), rendered on the home page by `components/JsonLd.tsx`. Validates with 0 errors.
- **`robots.ts`** blocks only `/app` and `/api`; pages kept out of search say `noindex` themselves
  (a robots block would hide the noindex). **`sitemap.ts`** lists the public pages; dates only where
  real (the legal pages' `site.updated`).
- **Search engines:** Google Search Console, domain property `typeplay.app` on lazarashvili02@gmail.com
  (verified by a DNS TXT record on Cloudflare, keep it), sitemap submitted 10-16. Bing, Yandex and
  others get IndexNow pings after every `deploy.mjs site` (key file `public/55500354baed5d4122f52d78448b595d.txt`).
- **Measured 10-16** (Lighthouse, mobile, live): SEO 100, Accessibility 100, Best Practices 100,
  Performance 92-99 (simulated slow-phone LCP 2.2-3.3 s; real LCP 0.57 s). Inlining the CSS was tried
  and made it worse (the stylesheet is ~117 KB raw): keep it linked.
- **Measured 10-17** (local production build, Lighthouse mobile): the home HTML is ~14.0 KB gzipped,
  just under the ~14.6 KB that arrives in the first network round trip; going over cost +0.1-0.15 s
  FCP (a full next/image srcset on the 8 icons did it, so `GameIcon` trims it). Don't drop the
  Martian Mono preload: the browser fetches it at the first layout anyway, and without the preload
  FCP went from 0.78 s to 1.07 s. LCP (the headline) sits at 2.4 or 2.95 s depending on whether the
  lazy images start before the first paint; the rest of it is the ~200 KB of JS.
