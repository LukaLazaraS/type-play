# Plan: first users in ~2 weeks, launch in ~5 weeks

## Start here (handoff, 2026-10-20 evening)

- **Until the beta code is live, only the beta 1 go-live session deploys** (HQ's job `e7b8f573`, Luka 10-24): no other session runs `deploy.mjs` (site, games, api); hand changes to HQ.
- **10-24, beta 1 is live** (closed beta, invite only): typeplay.app with the app on, `api.typeplay.app` on the CPX32
  (`/health` as `docs/beta/runbook.md` step 5), the 10-20 game loader on typeplay.dev; commit `3c7bdcc` (the app switch
  and tonight's doc fixes are not committed yet). Sign-in's redirect fixed the same night (it went to Next's own
  address, https://0.0.0.0:3000: `publicOrigin` in `apps/web/src/lib/safe-next.ts`). **Paddle's live account was
  approved 10-24** (checkout on for typeplay.app; HQ set the dashboard: default payment link https://typeplay.app/billing,
  statement descriptor TYPEPLAY, discount codes and saved cards off, sales tax exclusive, balance USD). Payout details:
  Luka adds his personal USD account, which he says the IE will use too. **Next before any live sale: the IE + Small
  Business Status** (parked rows 2 and 3). Next, in Luka's order: his smoke test (runbook step 7), then the **beta
  code** (a 6-digit code on the closed-beta page instead of inviting each tester by address, Luka 10-24). **Since 10-25
  development and tests on this PC have their own databases** (`typeplay_dev`, `typeplay_test` on this PC's Postgres:
  `docs/environments.md`), so they run any time; the admin CLI reaches the live beta only as `npm run admin:live`. Sign-in
  stays on the live Supabase project; a **staging** environment with its own Supabase project comes before the paid beta
  (~11-06), and the Paddle sandbox purchase runs there (parked row 21).

- **10-20 batch (no Luka input), done and green** (root check 5/5, public build has no app routes; the
  folder moved to `master-project/startups/type-play`: `npm install` relinked the workspaces):
  **security review of beta 1's public surface** (the invite gate holds on all 35 signed-in routes; 5 fixes:
  the Free daily cap counts metered cost on stopped runs, reports capped per game, 413 for big bodies,
  an open redirect in `safe-next.ts`, a test leaving $20 on the cap; `apps/server/README.md` "Security review
  10-20"); **the Free-plan badge** (`apps/games/play.html`, a right-edge tab that never takes taps; `game.json`
  `badge`); `.godot/` cleared after every reset/restore; **showcase polish by chat** (`show-*-polished`, gallery
  "Showcase: original vs polished") and **the low-effort test** (Fast low saves only ~12%: the first step's
  thinking dominates); `apps/web` `prebuild` clears `.next/dev` (stale dev route types broke the public build).

- **Checkpoints 4 + 5 (night of 10-18 → 10-19), done and green** (root `npm run check` 5/5, the public build
  has no app routes, nothing left running; the PC was shut down afterwards at Luka's request):
  **beta kit** (invite-only access: uninvited Google sign-ins get the closed-beta page and no account; `admin
  invite add|list|remove`; "Send feedback" + `admin feedback …`; `docs/beta/invite.md` and
  `docs/beta/runbook.md`); **Android off for beta 1** (`ANDROID_EXPORT: "0"`; `deploy.mjs api` needs no
  Android key while off); **six Opus showcase games** (`packages/agent/RESULTS.md` "2026-10-19: showcase",
  gallery group "Showcase (Opus)", ready in `apps/games/builds/show-*`; Luka picks; top 3: Island Rush,
  Sky Stack, Gingerbread Guard); **chat edits on big games** (27/27 Fast edits passed, median 0.3 credits as
  priced, range 0.2-1.4; Smart ~6× the credits for the same result; EDIT.md rules tightened; the chat no
  longer looks stuck while the model plans: `RESULTS.md` "2026-10-19: chat edits"); **launch docs**
  (`docs/launch/demo-video.md`, `docs/launch/page-copy-proposals.md`). The runner isolation test is dropped
  (a safety check stopped it twice): parked row 15, an outside review before the paid beta.
- **"deploy" (Luka's word, before the Paddle application):** deploy the frozen 10-17 copy of the site
  (the decided pricing, "Your game is yours", the support phone): `node <scratchpad>/site-snapshot/deploy/deploy.mjs site`
  from the session's scratchpad (`C:\Users\lazar\AppData\Local\Temp\claude\c--Users-lazar-Desktop-projects-type-play\4a471dec-4201-431d-b709-7a3aff50a367\scratchpad\site-snapshot`;
  it holds a copy of `.env`: delete the folder after the deploy). The newer privacy sentences in the repo
  (scrambled email, share page address, Android key, gallery, feedback) wait for Luka's website review. If the
  copy is gone (Windows cleans temp folders), deploy the repo after Luka OKs those sentences.
  **10-23 preflight: don't deploy the copy.** It is on Next.js 16.4.0 (two critical advisories published 10-22;
  the repo is on 16.4.3) and its `node_modules` link points at the pre-move `Desktop\projects\type-play`, so it
  can't build as it is. Proposed instead: the repo, `NEXT_PUBLIC_APP: "0"` first, `"1"` once the API is healthy
  (`docs/beta/runbook.md` step 6), pending Luka's word.

- **10-19, the beta-1 kit (package 6):** invite only (`BETA_INVITE_ONLY`, `admin invite add | list | remove`), the closed-beta page, Send feedback (`admin feedback list | show | done`); the invitation `docs/beta/invite.md` and the go-live and beta-day steps `docs/beta/runbook.md` (`apps/server/README.md` "The closed beta and feedback").
- **Checkpoint 3 (10-18 night), done:** the Android follow-ups (phone links always short, 79 characters,
  so the QR works on R2 too; the app icon on later visits; a Stop/claim race fixed), the **public gallery**
  (`/explore`, opt-in listing, anonymous play counts, reports + `admin gallery …`; UI pass by the skills),
  and five runner hardening fixes found by reading the code (`apps/server/README.md` "Left for later").
  **The automated runner isolation test is dropped:** stopped by a safety check twice (10-18, and 10-19 on
  Luka's request). The 10-17 hand check in WSL and the 10-18 fixes stand for beta 1; an outside security
  review of the runner before the paid launch replaces the test (docs/parked.md "Waiting for Luka"). **Checkpoint 4 candidates:** showcase games for the home page made with the new
  genre skills (parked #14: Claude builds candidates, Luka picks), the demo video script (launch);
  real sound effects (parked #10) need Luka's OK to download a CC0 sound library (Kenney's audio packs).

- **Checkpoint 1 (10-18 evening):** Luka works in checkpoints and checks his Max usage at each one
  (the weekly limit was hit once on 10-18 and reset). Done at this checkpoint: **payments complete**
  (parts 1-3 + a 13-finding review fixed: ledger, Paddle webhooks, billing + checkout pages; nothing
  has touched the real Paddle, keys come Monday), **Android export server side** (image, runner job,
  signer, keys, API; proven in WSL: APK 8 s, AAB 44 s), **a UI/UX pass by the skills over every app
  screen** (`DESIGN.md` "App screens", before/after in `.impeccable/review/ux-before|ux-after`).
  Test suites at the gate: root `npm run check`, `test:ledger`, `test:proxy`, `test:android`,
  `test:billing`, `test:e2e`, `test:android:e2e` (apps/server), `shot-app.mjs` + `shot-worst.mjs` (web).
  **Checkpoint 2 (10-18 night), done:** the Android screens (the pill, setup, the hub with APK / AAB /
  phone link with a QR / key download / checks, the Google Play checklist) with their UI pass:
  `apps/web/README.md` "Export to Android", `shot-android.mjs` (43 checks, in `shot-app.mjs` 161).
  **Checkpoint 3 candidates (no Luka input):** the two Android server follow-ups from the screens
  report (a short `/android/dl/<token>` redirect link in R2 mode so the QR stays scannable; a
  `GET …/android/icon` route so an uploaded icon shows on later visits), the runner isolation test in
  WSL (`apps/server/README.md` "Left for later"), the public gallery with play counts (PLAN item 9).
  **Needs Luka:** the Paddle sandbox session (Mon), the server + API key (Wed), the privacy
  wording approvals, the Android defaults (package scheme, no debug builds, encrypted key copy,
  SDK licence), `deploy.mjs android-key` + the master key into his password manager.

- **Checkpoint 2 (10-18 night): the Android screens are built and reviewed** (`apps/web/README.md` "Export to
  Android": the pill, `/games/<id>/android` with setup, the hub, APK/AAB, the phone link's QR, the key, the Play
  checklist; the UI pass by the skills done; tests: `scripts/shot-android.mjs` inside `shot-app.mjs`, `shot-worst.mjs`).
  **Needs Luka:** the legal line in `legal.ts`, `site.ts` Android → "now" at go-live, the measured build times.
- **10-18 night, the public gallery with play counts is built** (item 9 below): the Share menu's "Show it in the gallery", `/explore` (noindex), plays counted with nothing about the visitor, Report this game + `admin gallery …`; `apps/web/README.md` and `apps/server/README.md` "The public gallery"; its provisional calls wait in `docs/parked.md` "For Luka's website review".
- **Live:** https://typeplay.app (public pages, Hetzner CX23 + Caddy behind Cloudflare) and
  https://typeplay.dev (games, R2), since 10-15. **The live site is still the 10-16 version**: the
  new plans (Free/Medium/High/Ultra/Ultra+), "Your game is yours", the support phone and lighter
  icons are ready and checked but wait for Luka's "deploy" (the deploy is blocked without his
  explicit yes). `node deploy/deploy.mjs site`; the app stays off live (`NEXT_PUBLIC_APP: "0"` in
  `deploy/server/compose.yaml`). Note: package 5 prep changed `deploy/server/Dockerfile` and
  `compose.yaml` (API origin args); a failed site build changes nothing live.
- **Nothing from 10-16 to 10-18 is committed yet:** commit + push only when Luka says so.
- **Done:** step 1 (Godot check), step 3 (agent core: portrait-first games, the 3D model
  catalogue, the check fails a game whose page stops answering), **step 4 on this PC** (backend
  `apps/server` + app screens in `apps/web`, contract `packages/shared`), **step 5's code**
  (`deploy/README.md` "The API": R2 publish, image, key proxy, a throwaway Linux user per run,
  `api-setup` / `api-assets` / `api`; nothing bought or created). How the agent works and costs:
  `packages/agent/RESULTS.md` (10-17: big games take 5-16 min, no 60-min problem). Gallery:
  `cd packages/agent && npm run gallery` → http://127.0.0.1:8070/.
  **10-18:** /account (credit history, download my data, delete account), rename / download as .zip /
  delete a game, effort per message, share pages `/play/<id>` with link previews (noindex for now):
  `apps/web/README.md` "Account, game management, share pages". **10-18, the code review's fixes:**
  credit holds and builds-at-once per plan, the charge from `chargeUsd`, a Stop after the agent
  finished charges nothing, closed-account tombstones (privacy text changed, Luka to approve), the
  key proxy meters tokens, runner hardening, the check's browser over a pipe (no port):
  `apps/server/README.md` ("How a message runs", "Live mode"); migration applied to the dev database.
  **10-18, payments part 1 of 3** (`docs/payments-design.md` §3-4, §11): the credit ledger with expiry
  buckets (Free's 20 a month, plan credits carrying over one month, packs for 12), the kill switch,
  `admin user|audit|flag`, migration `20261020000000_billing` applied: `apps/server/README.md`
  "Credits: the ledger". **10-18, part 2 of 3** (§5-7, §10-12): the Paddle client, the catalog script, the
  env guards, `POST /webhooks/paddle` with its inbox and the handlers (plan, renewal with the cap, upgrade,
  pack, cancel, past due, refund, chargeback → hold, account close), the billing services part 3's endpoints
  will call, `admin events|event|retry|refund|sync|downgrade`, `test/billing.mjs` (153 checks against a Paddle
  stub): `apps/server/README.md` "Billing: Paddle". Nothing talked to the real Paddle yet (no keys until
  Monday). **10-18, part 3 of 3, INTERRUPTED, see the top of this list** (§7-9): the `/billing` endpoints (`billing.controller.ts`, `BillingInfo` in the
  contract), the `/billing` page (strips, plan card, picker with Paddle's preview, payments), `/billing/checkout`
  with the tick box and the Paddle.js overlay, the game page's credit panels, `/create?plan=`; tests in
  `test/billing.mjs` and `apps/web/scripts/shot-app.mjs` (against the stub). **Monday's sandbox checklist**
  (keys, test cards, what only real Paddle can confirm): `apps/web/README.md` "Plan and billing".
- **Run everything locally:** `npm run dev` at the root (site :3000, games :3001, API :3002 with
  real builds on Luka's Max), open **http://localhost:3000**. Beta credits by hand:
  `npm run admin -w @typeplay/server -- grant|plan|list`.
- **Luka's PC must never lag:** heavy work through `packages/agent/tools/cpu.mjs` (CLAUDE.md, Known traps).
- **Next, in order:**
  1. Luka says "deploy" → site live before the Paddle application (Mon 10-19).
  2. Luka tests real Google sign-in locally and builds one game (only he can).
  3. **Package 5 go-live:** Luka picks the server (`docs/server-proposal.md`: CPX32 ~$42/month,
     or CX33 if in stock) and creates the Anthropic API key (`ANTHROPIC_API_KEY` in the root
     `.env`); then `api-setup --yes`, `api-assets`, `api` (`deploy/README.md`). Turn on Hetzner
     backups for the games data. The Anthropic question (`docs/anthropic-question.md`) is still open.
  4. **Beta 1 (Fri 10-23):** `NEXT_PUBLIC_APP: "1"`, deploy the site, grant testers credits.
  5. **Done 10-18 night** (`RESULTS.md` "10-17 night"): Haiku builds of big prompts in 3 steps,
     the GOTCHAS line, the tower-defence and racer genre skills, "look finished" rules, `chargeUsd`
     (the player pays only for kept attempts). Luka plays the new games in the gallery
     (`td2-haiku`, `td2-sonnet`, `m3big3-haiku`, `racer-haiku`, `racer-sonnet`) next to the Opus
     ones, and `td2-haiku` / `racer-sonnet` on a phone (frame rate).
  6. Package 7: finish payments part 3 (above), the Paddle sandbox session with Luka's keys, then
     Android export (`docs/android-export-design.md`): **server side built 10-18** (image, runner job, signer,
     queue, keys, contract, tests; WSL-proven: APK 5 s, AAB 36 s offline; `apps/server/README.md` "Android export"),
     the web screens (§11 of the design) are next; the genre skills are done.
- **Parked items with dates:** `docs/parked.md`.
- **Done 2026-10-13, step 2 (public pages), reviewed and documented:** `PRODUCT.md` (product
  record) and `DESIGN.md` + `.impeccable/design.json` (the "home screen" design system) are
  the design authorities for all UI work in `apps/web/`; load the Impeccable skill for changes.
- **2026-10-14, monorepo (Claude decided, Luka delegated):** `apps/web`, `apps/games`, `packages/agent`,
  npm workspaces + Turborepo; `npm install` once at the root, `npm run dev` starts the site and the
  games origin, `npm run check` runs every package. Reasoning in `docs/decisions.md`. The next
  packages land as `apps/server`, later `apps/desktop`, `apps/mobile`, `packages/shared`.
- **2026-10-14, after Luka's review:** every game on the site is playable (one shared Godot
  web engine + a 12-40 KB `.pck` per game) from the new **`apps/games/` package**, the games origin
  (typeplay.dev live, port 3001 in dev): loader `play.html`, `engine/<version>/`,
  `builds/<id>/{index.pck,game.json}`, see `apps/games/README.md`. The "say what to change" section is a live
  simulation playing four real versions from the runner's git history, and the ship section
  mentions one-click Google Play publishing as next. Competitor pricing research (Lovable,
  Bolt, v0, Replit, Base44, Rosebud, Emergent, Anything, Astrocade, Ludo) is in
  `docs/research/competitor-pricing.md`; it feeds parked #9 (credits design).
- **2026-10-16, full competitor analysis** (~40 AI game builders, the giants' launches, traffic,
  funding, revenue estimates, price per game, store exports, what to copy): `docs/research/competitors.md`,
  detailed reports with sources in `docs/research/competitors/`. Luka approved the resulting
  improvements on 2026-10-17: section **"Better than the competitors"** below.
- **Build notes (2026-10-13):** `apps/web/` is scaffolded (Next.js
  16.4, Tailwind 4, Motion, Phosphor icons); real game data in `apps/web/src/content/games.ts`,
  site facts and plans in `apps/web/src/content/site.ts`, legal drafts in `apps/web/src/content/legal.ts`
  (seller name, refund rules and plan names are drafts for Luka to confirm). `PRODUCT.md` holds
  the product record for the design skills. The home-page direction round is open: four
  first-viewport sketches in `.impeccable/mocks/decision/` (Home Screen = the roll, Title
  Screen, Cut-Paper Pun, category standard); payload `.impeccable/decision-home.json`, seed key
  `350cbde1`. **Luka chose Home Screen (2026-10-13).** Built: home, pricing, terms, privacy,
  refunds, `/create` placeholder, 404; direction contract in the surface brief
  (`.impeccable/surfaces/web-src-app-page-tsx.md`); the other sketches are kept in
  `docs/design/directions/`. Dev server: `npm run dev (root: site + games origin)`; screenshots:
  `node scripts/shot.mjs` (Playwright on the installed Edge; Turbopack's file watcher misses
  CSS edits on this PC, so restart the dev server after editing `globals.css`).

Updated 2026-10-12. Luka works 8+ h/day, 6 days a week. Claude Code (Max 20x) does the typing;
Luka directs, tests, plays the test games and decides. Hours are working hours in sessions;
dates are targets at that pace.

## Who pays for the AI, when

- **Builder** (Claude Code building this repo): Luka's Max, always.
- **Game agent on Luka's PC (dev):** Luka's Max login, now and for every later update. Each
  run reports tokens and API-equivalent $, so cost per build is still measured.
- **Game agent on the live server (beta + launch):** our API key, for everyone including
  Luka. The Max token never goes on that server. The setting is `AGENT_AUTH=max|api`.
- **Ask Anthropic before beta 1 (Luka emails sales this week):** their Claude Code legal page,
  section "Can customers offer Claude Code in their products?", says a platform running Claude
  Code in hosted sandboxes may not pay for its users' Claude usage. The Agent SDK runs the
  Claude Code binary, while the Agent SDK page says products for your own customers are fine
  under the Commercial Terms. Ask which applies to us. If the answer is no, the live agent
  runs on our own loop over the plain API (~2 days of work). Tools, templates and Godot rules
  carry over, so the code that calls the model stays a thin, separate layer.

## Work packages

| # | Target | Work | Done means | Hours |
|---|---|---|---|---|
| 1 ✅ | Mon 10-12 | **Godot check**: done, passed (`proof/RESULTS.md`) | Godot 4.7.2 + export templates on this PC; command-line web export works; the agent builds one small game from one prompt and edits it with a second; Opus / Sonnet / Haiku compared on tokens, $, minutes, and whether the game works | 8 |
| 2 | Tue 10-13 | **Landing page** | Live HTTPS site on our domain: what it does, pricing, terms, privacy, refund policy (14-90 days, Paddle named as merchant of record) → Paddle application sent | 4 |
| 3 (done 10-17; `packages/agent/RESULTS.md`) | Fri 10-16 | **Agent core, 2 genres**. Done: isolated agent, rules + learned mistakes list, NOTES.md + git per edit with rollback, check with game-over shot and feature tests, Haiku-first edits, plain player messages, runner + puzzle genre skills, short-step Haiku builds ($0.07-0.12), gallery, portrait-first games (10-17), 3D model library: 8,449 CC0 models from `E:\3D models` searchable by the agent, which copies only what a game uses (`tools/assets.mjs`, 10-17). Batch test dropped: defaults are decided, users can switch | Runner + puzzle templates; Godot 4 rules for the agent; Kenney CC0 catalogue the agent can search; the agent runs the game and screenshots it before replying; test prompts built and auto-checked in batches, Luka plays the ones that pass | 25 |
| 4 | Wed 10-21 | **Web app (on this PC)** | Login, projects, chat with streaming, preview frame, version history (git per project: undo any edit), credit tracking | 30 |
| 5 | Thu 10-22 | **Server + API** | CPU server; one container per project; web export on every edit; previews on a separate domain; API account with credits; key added by a proxy, never inside containers | 8 |
| 6 | Fri 10-23 | **Closed beta 1** | 5-10 people, free, invite only, credits given by hand | 10 |
| 7 | ~10-30 | **Genres 3-4, Android, payments** | Racer + tower defence (skills done 10-18: `packages/agent/genres/racer`, `genres/towerdefence`, plus "look finished" rules; test builds in `RESULTS.md` "10-17 night": Haiku TD $0.49, Sonnet TD $1.08, racer $0.38 / $0.78, all close to Opus' layout); APK + AAB on demand (signing key handed to the user; one build per project at a time); Paddle checkout, plans, top-ups, webhooks → credits, free-tier limits | 37 |
| 8 | ~11-06 | **Beta 2 (paid)** | Paying beta users; cost per user measured; fixes | 10 |
| 9 | week of 11-09 | **Launch** | Final landing + pricing, demo video (the YouTube channels are the funnel), go live | 10 |
| | after | iOS export (cloud Mac), Steam/desktop, Blender tool, text-to-3D, more genres | | |

**Total: about 140 hours, ≈ 3 weeks of work.** The calendar runs to ~5 weeks only because
of the waits below.

## Better than the competitors (Luka approved 2026-10-17)

From `docs/research/competitors.md`: rivals keep games on their own site, charge $8-100 per game,
burn credits on their own errors, and some claim the user's game (Rosebud) or deleted it (Gambo).
Our lane: a real Godot project that goes to the stores, ~$1.33 a game, and the game is the user's.

| # | When | What | Copied from / why | Notes |
|---|---|---|---|---|
| 0 | first big game before beta 1; the full set **before going live** | **Godot test on big and small games** (Luka, 2026-10-17): several games per launch genre, small and big (e.g. a tower defence with waves, 4-5 tower types, upgrades, menu, 3 levels), on Haiku and Sonnet; measure minutes, $, turns and errors, and play each one. The good ones become the site's showcase games (parked #14), so one run does both | Tesana left Godot over ~60-min builds; our biggest test so far is the Haiku match-3 (12 min, 40 turns, `packages/agent/RESULTS.md`) | If big builds pass ~15 min: build in steps and show the playable core early (already done for Haiku). **10-17 first run** (`packages/agent/RESULTS.md` "big games"): TD on Sonnet 5.4 min / $0.61 (froze in the test runs, ran in a re-test: Luka plays it), TD on Haiku 12.8 min / $0.21 (good), 10-level match-3 on Haiku 16 min / $0.43 (core step at 47/50 turns): no 60-min problem; big Haiku prompts need 3 steps; the check now fails a game whose page stops answering |
| 1 | package 4 | **"Your game is yours"** on the home and pricing pages: you own it, no revenue share, download the whole project any time | Rosebud's terms claim the output; Gambo deleted users' games on shutdown | The terms already say it (`legal.ts` "Your games are yours"); the pages don't yet |
| 2 | package 4 | **Cost of every message shown** in the chat, plus a usage list per project; failed builds visibly free | #1 complaint about Tesana, SEELE, Rosebud, Rork | Rule already decided (`docs/pricing.md`: failed builds retried free, credits back) |
| 3 | package 4 | **Genre starters on the first screen** of `/create` (runner, puzzle; racer + tower defence with package 7) | Jabali, Google Playground, Vibecode | |
| 4 | package 4 | **Share page per game** with link preview | Every rival; Playabl pivoted because users treat games as content to show | = parked #18b; the main SEO lever |
| 5 | package 7 | **Google Play publish wizard**: step by step; explains the 12 testers / 14 days rule; checks the game against store rules before upload; makes store screenshots and icon | Rork | Signing key handed to the user (package 7) |
| 6 | package 7 | **Sliders for numbers** (speed, gravity, spawn rate): the agent keeps tunable values in one file, the app shows sliders, changes cost no AI and no credits | Astrocade | |
| 7 | package 7 | **The agent plays its own game before handing it over** (play-test bot) | Summer Engine, Rork, Tesana's Loop | Works (+$0.07, +4 min on Sonnet, `RESULTS.md`); test it on the big game (#0), then decide default on/off |
| 8 | package 8 | **When credits run out, small Haiku edits still work** with a daily cap | Makko's "unlimited fallback model" | Changes `docs/pricing.md`: decide the cap with beta 1 numbers |
| 9 | package 9 | **Public gallery** of games with play counts | Astrocade, Tesana, all feeds | With #4 |
| 10 | after launch | **App Store wizard** (Apple ID or API key → cloud Mac build → TestFlight) and Steam export | Rork, Vibecode | = the "after" row above; `parked.md` #15 |
| 11 | after launch | Creator stories (games with players or income), weekly game jams; "TypePlay vs X" SEO pages + `llms.txt`; AI-disclosure text written for the user at Steam/itch export | Rosebud, Astrocade, Summer Engine; Steam requires AI disclosure | |

## Waits (start them early)

- **Name + domain:** TypePlay (decided 2026-10-13): typeplay.app (site) + typeplay.dev (games), bought at Cloudflare. Details in `docs/names.md`.
- **Individual Entrepreneur registration + Small Business Status:** next (Paddle approved 10-24), before
  any live sale and the paid beta (package 8) (Luka, 2026-10-23); about a day. Paddle's signup asks no
  IE papers, so the application went in first ("Payments: how to apply" below).
- **Paddle review:** approved 2026-10-24, the day the application went in.
- **Anthropic's answer** on the question above: email this week.
- **Beta testers** take days to try things and reply: line up 5-10 people by ~10-20.
- **Google Play:** new personal accounts need a 14-day closed test before production. Luka's
  account is past this; users publish on their own accounts anyway.

## Stack (decided 2026-10-12)

- **Frontend: Next.js 16 (React).** Claude writes all the code, so this is picked on speed
  and quality, not familiarity: most training data (fewer fix loops); ready-made AI chat UI
  (assistant-ui, AI Elements on shadcn/ui: messages, streaming markdown, tool steps, prompt
  box), saving ~2-3 days; best SEO tooling (metadata per page, sitemaps, static landing and
  pricing, per-game share pages with link previews). Next.js only renders pages and calls
  Nest; self-hosted with `next start`.
- **Backend: NestJS.** Agent sessions last minutes, exports run in containers, results
  stream to the browser, Paddle sends webhooks: that needs a long-running server. Luka knows
  Nest (dumb-money, PetCare, task-manager-backend).
- **Database: Postgres via Prisma**, hosted on Supabase (login and backups included; free
  until launch, then $25/month). Credits and payments need transactions, so relational, not
  MongoDB. Game files aren't in the database: each project is a folder with its own git history.
- **Server: CPU, not GPU.** The game runs on the player's device and the AI runs at
  Anthropic. The server only exports (CPU, seconds) and takes test screenshots (software
  rendering is fine for small games). Picked at package 5; until then everything runs here.
- **Previews and share links:** static files on Cloudflare R2, on a separate domain.
- **Payments:** Paddle → if rejected, Dodo Payments → Whop. Details below.

## Payments: how to apply

Order (Luka, 2026-10-23): the Paddle application first, the Individual Entrepreneur right after
Paddle approves and before the first paid sale (the paid beta). Paddle's signup asks no IE papers
(`docs/payments.md`, "What signup asks of an individual"); only a live sale waits for IE + Small
Business Status. The seller is "Luka Lazarashvili" on the Paddle account and in our terms;
`site.ts` gets `seller.form` once the IE exists.

1. **Claude: landing page** with product description, public pricing page, terms (seller
   name, Paddle as merchant of record), privacy policy, refund policy (14-90 days, refunds
   through Paddle), contact email, HTTPS, no login wall.
2. **Luka: sign up at paddle.com (Paddle Billing)** as an individual: seller details, submit the
   domain for review, identity check (business documents are skipped for individuals). Field by
   field: `docs/launch/paddle-signup.md`. **Approved 2026-10-24** (checkout on for typeplay.app).
3. **Luka: also open a Paddle sandbox account** (free, instant, no review). Claude builds the
   checkout, plans, credit packs and webhooks against it while the review runs; going live
   is a key swap.
4. **Luka, next (Paddle approved 10-24): register as an Individual Entrepreneur with Small Business
   Status** (online, about a day; 1% of turnover up to 500,000 GEL/year instead of the 20% default).
   Payouts: Luka puts his personal USD account into Paddle's payout settings himself; he says the IE
   uses the same account (check with the bank that it is marked for the IE before the first payout:
   TBC's personal-account terms forbid business use without the matching status, `docs/payments.md`).
   Ask a Georgian accountant to confirm this income qualifies. No LLC needed. All before any live
   sale: Small Business Status counts only from the day it is applied for.
5. If Paddle rejects or stalls past ~2 weeks: Dodo Payments (merchant of record built for
   countries Stripe doesn't serve; confirm Georgian ID is accepted at signup), then Whop.

## Money to first users and to launch

| Item | When | Cost |
|---|---|---|
| Claude Code Max 20x | already paid | — |
| Agent and test builds before beta | on Max | $0 |
| Domains | day 2 | $16.40 (typeplay.app + typeplay.dev, $8.20 each; ~$26/yr after) |
| API credits, beta 1 + 2 | from 10-22 | ~$150-300 (buy $50-100 at a time; $40+ → tier 2) |
| Site server (Hetzner CX23) | from 10-15 | ~€7/month |
| Backend server (package 5; may share the CX23) | from 10-22 | ~€0-50/month |
| Supabase | at launch | $25/month (free before) |
| Cloudflare R2, email | | $0 at this size |
| Paddle | per sale | no upfront fee; 5% + $0.50 per sale |
| Apple + Google developer accounts | Luka has both | $0 |
| **To first users** | | **~$100-300** |
| **To launch** | | **~$250-550** |

After launch, per month: ~$50-100 fixed; each free user at most $1.42 of Haiku (20 credits;
keep the free tier tight); each paid user at most ~$6 of API on the $20 plan (`docs/pricing.md`).

## Day 1 (start here)

1. Install Godot 4.7.2 (standard build + export templates); check a command-line web export.
2. `proof/`: the agent (Agent SDK on Max) + a minimal template + one prompt → a game playable
   in the browser; a second prompt edits it.
3. Record per model: tokens, $, minutes per build and per edit, and whether the game works
   (Luka plays it). These numbers set the credit prices.
