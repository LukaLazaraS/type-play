# Plan: first users in ~2 weeks, launch in ~5 weeks

## Start here (handoff, 2026-10-14)

- **Done:** step 1 (Godot check) and step 3 (agent core) except the asset catalogue. How the
  game agent works and what each part costs: `packages/agent/RESULTS.md`; rules in `packages/agent/rules/`,
  genre skills in `packages/agent/genres/`, runner `packages/agent/run.mjs`, check `packages/agent/tools/check.mjs`.
  Gallery of every test game: `cd packages/agent && npm run gallery` → http://127.0.0.1:8070/.
- **Next session, in order:**
  0. **Deploy the public pages (hosting decided 2026-10-14, see `docs/decisions.md`):** Hetzner Cloud
     CX22 in Falkenstein for the site (Docker, Caddy with automatic HTTPS, `next start`), the games
     origin `apps/games` on a Cloudflare R2 bucket with the custom domain typeplay.dev, DNS on
     Cloudflare, one deploy script in `deploy/`. Domains are bought (both active on Cloudflare).
     Needs from Luka, in the git-ignored root `.env`: `HETZNER_TOKEN` (Hetzner Cloud project
     "typeplay", Read & Write), `CLOUDFLARE_API_TOKEN` (Edit zone DNS for typeplay.app and
     typeplay.dev), `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (R2 object
     read & write). Also hello@typeplay.app via Cloudflare Email Routing (parked #1). Done means:
     https://typeplay.app serves the site, https://typeplay.dev/play.html?g=robot-runner plays, and
     Paddle can review the pricing, terms, privacy and refund pages.
  1. **Step 4, the web app** in `apps/web/` (the public pages are built, see below): sign-in with
     Google, projects, chat with streaming, preview frame, version history, credits. The
     home page's prompt box already hands the sentence to `/create?prompt=`, which is the
     app's front door to replace. Needs Luka's free Supabase account (`docs/parked.md` #11).
     Before that: put the public pages live on typeplay.app (domain, parked #1) so Paddle can
     review them, and Luka confirms the seller name, plan names/prices and refund rule in
     `apps/web/src/content/site.ts` and `legal.ts`.
  2. **Asset catalogue** for the game agent from `E:\3D models` (Kenney + Quaternius, CC0,
     ~4,400 `.glb`): a searchable index plus the rule "use real models when they fit; copy
     only what the game uses". 2D is always drawn in code (no 2D packs); real sound
     effects later, after the web app (`parked.md` #10).
- **Parked items with dates:** `docs/parked.md` (name + domain due Wed 10-14).
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
| 3 (in progress; `packages/agent/RESULTS.md`) | Fri 10-16 | **Agent core, 2 genres**. Done: isolated agent, rules + learned mistakes list, NOTES.md + git per edit with rollback, check with game-over shot and feature tests, Haiku-first edits, plain player messages, runner + puzzle genre skills, short-step Haiku builds ($0.07-0.12), gallery. Left: Kenney assets (waiting for Luka's OK). Batch test dropped: defaults are decided, users can switch | Runner + puzzle templates; Godot 4 rules for the agent; Kenney CC0 catalogue the agent can search; the agent runs the game and screenshots it before replying; test prompts built and auto-checked in batches, Luka plays the ones that pass | 25 |
| 4 | Wed 10-21 | **Web app (on this PC)** | Login, projects, chat with streaming, preview frame, version history (git per project: undo any edit), credit tracking | 30 |
| 5 | Thu 10-22 | **Server + API** | CPU server; one container per project; web export on every edit; previews on a separate domain; API account with credits; key added by a proxy, never inside containers | 8 |
| 6 | Fri 10-23 | **Closed beta 1** | 5-10 people, free, invite only, credits given by hand | 10 |
| 7 | ~10-30 | **Genres 3-4, Android, payments** | Racer + tower defence; APK + AAB on demand (signing key handed to the user; one build per project at a time); Paddle checkout, plans, top-ups, webhooks → credits, free-tier limits | 37 |
| 8 | ~11-06 | **Beta 2 (paid)** | Paying beta users; cost per user measured; fixes | 10 |
| 9 | week of 11-09 | **Launch** | Final landing + pricing, demo video (the YouTube channels are the funnel), go live | 10 |
| | after | iOS export (cloud Mac), Steam/desktop, Blender tool, text-to-3D, more genres | | |

**Total: about 140 hours, ≈ 3 weeks of work.** The calendar runs to ~5 weeks only because
of the waits below.

## Waits (start them early)

- **Name + domain:** TypePlay (decided 2026-10-13): typeplay.app (site) + typeplay.dev (games), bought at Cloudflare. Details in `docs/names.md`.
- **Individual Entrepreneur registration:** before the Paddle application (about a day).
- **Paddle review:** ~3-7 business days, can be longer; if rejected → Whop. Apply on day 2.
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

1. **Luka: register as an Individual Entrepreneur with Small Business Status** (Public Service
   Hall, about a day; 1% of turnover up to 500,000 GEL/year instead of the 20% default). Ask a
   Georgian accountant to confirm this income qualifies. No LLC needed. Do it before Paddle:
   the seller name on the Paddle account must match our terms exactly.
2. **Claude: landing page** with product description, public pricing page, terms (seller
   name, Paddle as merchant of record), privacy policy, refund policy (14-90 days, refunds
   through Paddle), contact email, HTTPS, no login wall.
3. **Luka: sign up at paddle.com (Paddle Billing)**: seller details, submit the domain for
   review, identity check (business documents are skipped for individuals), payout account
   (Georgian bank USD account by SWIFT, or Payoneer).
4. **Luka: also open a Paddle sandbox account** (free, instant, no review). Claude builds the
   checkout, plans, credit packs and webhooks against it while the review runs; going live
   is a key swap.
5. If Paddle rejects or stalls past ~2 weeks: Dodo Payments (merchant of record built for
   countries Stripe doesn't serve; confirm Georgian ID is accepted at signup), then Whop.

## Money to first users and to launch

| Item | When | Cost |
|---|---|---|
| Claude Code Max 20x | already paid | — |
| Agent and test builds before beta | on Max | $0 |
| Domains | day 2 | $16.40 (typeplay.app + typeplay.dev, $8.20 each; ~$26/yr after) |
| API credits, beta 1 + 2 | from 10-22 | ~$150-300 (buy $50-100 at a time; $40+ → tier 2) |
| CPU server | from 10-22 | ~€20-50/month |
| Supabase | at launch | $25/month (free before) |
| Cloudflare R2, email | | $0 at this size |
| Paddle | per sale | no upfront fee; 5% + $0.50 per sale |
| Apple + Google developer accounts | Luka has both | $0 |
| **To first users** | | **~$100-300** |
| **To launch** | | **~$250-550** |

After launch, per month: ~$50-100 fixed; each free user ~$0.30-1 of Haiku (keep the free
tier tight); each paid user ~$9 of API on a $20 plan.

## Day 1 (start here)

1. Install Godot 4.7.2 (standard build + export templates); check a command-line web export.
2. `proof/`: the agent (Agent SDK on Max) + a minimal template + one prompt → a game playable
   in the browser; a second prompt edits it.
3. Record per model: tokens, $, minutes per build and per edit, and whether the game works
   (Luka plays it). These numbers set the credit prices.
