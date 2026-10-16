# Decision log

## 2026-10-11: project started

Came out of the Satisfying 2D Sims "digital product" discussion (ebook → website → scripts;
see `../../YouTube/satisfying-2d-sims/docs/digital-product.md`). The sim-video website was
dropped on research (the whole niche earns ~$2-10K/month combined and is shrinking); the game
idea is the bigger one and has no incumbent doing prompt → playable 3D game → app stores for
non-developers.

Luka's own points, accepted:
- Browser-only engines (three.js, Phaser) can't ship to the stores properly → Godot.
- HiberWorld is closed; Roblox needs Roblox and your own models; Rosebud is 2D/web only.
- Open-world 3D RPG is hard today, not impossible; models improve; design for model swaps.
- "I will train them myself" = prompts, templates, skills on top of Anthropic's models, not
  model training.

Claude's points, accepted:
- Run the agent on the API (Agent SDK) with our key; sell credits; free tier on Haiku 5.5.
- A $20 plan covers ~5-8 Opus 5.5 builds or 15+ Sonnet 5.5 builds; $50 is comfortable.
- Store publishing happens on the user's own Google/Apple account.
- Start with a one-week proof on this PC before any server, login or payment.

## 2026-10-12: plan re-cut (first Claude Code session in this repo)

Luka's points, accepted:
- Use Max during development: the agent and all test builds run on Luka's Max login while
  he is the only user; the API key comes in with the first beta tester. (Anthropic's Claude
  Code legal page: Max limits "assume ordinary, individual usage of Claude Code and the Agent
  SDK"; what's banned is routing *other people's* requests through it.) Pre-beta API spend: $0.
- The proof shrinks to a one-day Godot check: Luka already made games with Opus + Unity +
  Blender, so only Godot, one-prompt and no-steering are unproven.
- No developer accounts to buy: users publish on their own; Luka has Google + Apple for
  testing our exports.
- The server decision waits until the beta (≈ day 10); it is a CPU server, not GPU.
- 8+ h/day → first beta users ~10-23, launch ~week of 11-09.

Claude's points, accepted:
- Godot 4.3+ web export is single-threaded by default: no COOP/COEP headers needed.
- Paddle reviews the live website (pricing, terms, privacy, refund policy) before approving:
  the landing page goes up on day 2, not at launch; payment code comes after beta 1.
- "GameForge" is Gameforge AG's name (German game publisher, game software trademarks): pick
  a product name now. Candidates in `names.md`.
- Closed beta 1 with 2 genres, free, before payments and Android export.
- Blender tool and text-to-3D after launch; the CC0 catalogue moves into agent core.
- Test Haiku 5.5 in the Godot check (the free tier depends on it); measure minutes per build.
- Credits: $20 must buy ~$9 of API, not ~$18; Sonnet 5.5 is the default paid model.
  (Corrects the 2026-10-11 line "$20 covers ~5-8 Opus builds": that left no margin and no edits.)

Open: Luka asks Anthropic whether running the Agent SDK in per-project containers, paid by
our key, is allowed for a credits product (their "Can customers offer Claude Code in their
products?" section). Fallback: our own loop on the plain API.

## 2026-10-12 (later): names for the two Claudes, stack, payments

- **Builder** = Claude Code building this repo (always Max). **Game agent** = the agent in
  the product's chat. Game agent on Luka's PC: Max, now and for later updates. Game agent on
  the live server: API key for everyone, Luka included; the Max token never goes there
  (Luka's rule plus Claude's guard, so one bug can't put the Max account at risk).
- ~~Angular 22~~ → replaced the same day, see below.

## 2026-10-12 (evening): frontend is Next.js, not Angular

Luka: "Claude writes all the code, so ignore what I prefer or know; pick what's best for
this project." With familiarity removed, the review came out for **Next.js 16 (React)**:
- AI writes React most fluently (decade of dominant training data). Angular's modern style
  (signals, zoneless default since v21) is newer than most Angular code models saw; Angular's
  official MCP server and best-practices file exist to patch exactly that gap.
- Ready-made AI chat UI exists for React (assistant-ui; AI Elements on shadcn/ui), not for
  Angular: ~2-3 days saved on the chat screen.
- SEO and share links: Next.js has per-page metadata, sitemaps, static generation and
  per-page rendering built in; Angular SSR + Meta service works but is more manual.
- Every AI app builder (Lovable, v0; Bolt by default) generates React: same reason.
Angular's real strengths (one way to do things, all-in-one, strong signals runtime) matter
more for large human teams than for us. Backend stays NestJS; Postgres stays.
- **Payments: Paddle first, as a Georgian Individual Entrepreneur** (Small Business Status,
  1% turnover tax). Fallback Dodo Payments, then Whop. Bank of Georgia / TBC gateways rejected
  for launch: we'd be the seller of record (EU/UK VAT from the first sale) and would have to
  build renewals, retries and cancellations ourselves; maybe later for GEL buyers.

## 2026-10-12 (night): Godot check passed

One sentence → working, good-looking Godot game on Sonnet, Opus and Haiku, 2D and 3D, with no
steering; Luka scored the Sonnet 2D game 9/10. Sonnet: $0.42 / 3 min (2D), $0.76 / 6 min (3D).
The project goes ahead to agent core. Details and the fix list: `proof/RESULTS.md`.

## 2026-10-13: the user picks the model; edits default to Haiku

Every build is partly luck (Luka: "it's dice"), so the product doesn't hide the choice:
- The chat has a model/quality picker on every message (Fast = Haiku, Smart = Sonnet,
  Best = Opus; effort changeable), with honest tips from our measurements (e.g. "Fast: ~1
  credit per edit; best for small tweaks, describe exactly what you want"). Credits are what
  protect the budget, not model locks (`parked.md` item 9).
- Defaults: new games on Sonnet medium (Opus as "Best": better character art); edits on Haiku,
  falling back to Sonnet only if Haiku's change fails the check. The 2×2 edit test showed no
  consistent quality winner between Haiku and Sonnet edits at 1/10 of the price.
- Bugs the user finds ("double jump works only once") are fixed by telling the agent, or by
  the play-test; every version is a git commit, so "undo" is free.
- Claude's addition, accepted in principle: a "Try another version" button for the first
  build (re-roll the dice).

## 2026-10-13 (evening): one website; 2D drawn in code; Luka's 3D library

- **One website on one domain**: public pages and the app in one Next.js project, public
  pages first (Paddle reviews them). Game previews stay on a separate domain.
- **2D art is always drawn and animated in code by the agent; no downloaded 2D packs**
  (Luka: packs make every game look the same; code-drawn art is unique per game, easy to
  animate, and the user can change all of it; the code-drawn 2D games scored 9-10/10).
  Revisit only if it becomes a problem.
- **Real sound effects later**, after the web app (`parked.md` #10); games generate simple
  sounds in code until then.
- **3D library: `E:\3D models`** (Kenney 50 packs + Quaternius all-in-one, 7.4 GB, ~4,400
  `.glb`), CC0 verified from each `License.txt`. Next: a searchable catalogue for the agent.
- Haiku new games are built in two short sessions (core, then polish): $0.07-0.12 per build.

## 2026-10-14: monorepo layout, games origin as its own package

Luka delegated the architecture decision ("best practice, long-term"). Claude decided:
- **Layout:** `apps/` for deployables (`web` = typeplay.app, `games` = typeplay.dev, later
  `server`, `desktop`, `mobile`) and `packages/` for libraries (`agent` now; `shared`, `ui`
  when they have content). `proof/` and `docs/` stay at the root. Every package runs alone;
  apps deploy separately; code shared between apps goes through `packages/`, never by reaching
  into another app's folder.
- **Tooling:** npm workspaces (one install, one lockfile at the root) + Turborepo (`turbo.json`:
  ordered, cached `check` / `build` / `lint`, `dev` runs every app). Not Nx: more machinery than a
  one-person team with Claude writing the code will use.
- **Games origin:** `apps/games` mirrors the live bucket one to one: `play.html` loader,
  `engine/<godot-version>/` kept forever, immutable `builds/<id>/` with a `game.json` manifest
  naming the engine version. Reason: a game runs code, so it never shares the site's origin;
  one engine per version so upgrades can't break old games.
- **Platform labels** on the site: "now" for the web, "coming" for Android, iOS and Steam; no dates
  we can't be sure of (Luka).

## 2026-10-13: name is TypePlay

- **TypePlay.** It says what it does and has one spelling when said aloud. Type2Play was dropped:
  people who hear it type typetoplay.com, which someone else owns.
- **typeplay.app for the site ($8.20 first year), typeplay.dev for users' games ($8.20).** Not .ai:
  the 2-year minimum makes it ~$160, and Lovable (lovable.dev, started on gptengineer.app),
  v0 (v0.app) and Bolt (bolt.new) don't use .ai either. Add typeplay.ai or typeplay.com once
  there's revenue.
- Games run on a separate domain because they run code: on the site's domain, a game could
  act as the logged-in player. GitHub (github.io), Lovable and Replit split their domains the same way.
- Not typeplay.game ($309/yr). typeplay.games ($26/yr) waits until published games get their own
  public addresses; nothing public points at the games domain before then, so moving it later is one setting.
  Extra domains (.ai, .games, .com) a few months after launch if there are users (`parked.md` #13).

## 2026-10-15: folder renamed to `type-play`

`projects/game-forge` → `projects/type-play`, so the folder matches the product. "GameForge" was
only a working name (see "name is TypePlay" above).

- Claude Code files saved sessions by folder path, under `~/.claude/projects/`. The project's folder
  `c--Users-lazar-Desktop-projects-game-forge` became `c--Users-lazar-Desktop-projects-type-play`,
  as did the ~50 game-agent test-run folders that share the prefix. Memory was empty: knowledge
  lives in the repo.
- `node_modules` links the workspaces by absolute path, so after any folder rename run
  `npm install`: it re-links them and also syncs the stale `gameforge-agent` entry in
  `package-lock.json` to `@typeplay/agent`. The archived `proof/` package is now `typeplay-proof`.
- Windows won't rename a folder while a program has it open: close VS Code and its Claude session first.
- Old sessions, commits and notes still say "GameForge" or `game-forge`; it is the same project.

## 2026-10-14/15: hosting (decided 10-14, live 10-15)

- **Site (typeplay.app): our own Hetzner Cloud server**, Docker with Caddy (HTTPS) in front of Next.js,
  Cloudflare proxying in front of both. **Games (typeplay.dev): Cloudflare R2** with the custom domain.
  How to deploy and what runs where: `deploy/README.md`.
- **Why not Vercel / Render:** the backend (package 5) needs a long-running machine anyway (agent
  sessions of minutes, Godot headless exports, a git folder per project), which serverless hosts
  don't do cheaply; the site rides on that machine for free. Vercel's free plan forbids commercial
  use (Pro $20/month per member); Render is $7 for 512 MB or $25 for 2 GB, against 4 GB for €7 here.
  Cloudflare gives the same global cache and DDoS protection. The site is a standard Next.js app:
  moving it to Vercel later is hours, and the backend would stay put.
- **CX23, not CX22:** Hetzner retired the CX22; the CX23 (2 vCPU, 4 GB) is €6.49 + ~€0.60 IPv4 a
  month, the cheapest 4 GB machine (ARM CAX11 is €6.99). This box is the site's; the package 5
  backend may run on it or on a bigger one (`parked.md` #7).
- **Build on the server** from `turbo prune web --docker` (no Docker on Luka's PC); Next.js
  `output: "standalone"`. A failed build leaves the running version up.
- **Certificates:** Let's Encrypt via Caddy's HTTP challenge through the Cloudflare proxy (SSL "Full
  (strict)"); no Cloudflare origin certificate, so the deploy token needs no SSL permission. Port
  80/443 accept only Cloudflare's addresses, so the server's IP serves nothing directly.
- **Pipeline:** the deploy script for now; GitHub Actions (check + deploy on push to `main`) arrives
  with the backend and database migrations in package 5, when an unchecked push could hurt user data.

## 2026-10-15: accounts, sign-in, phone play

- **Supabase locked down from the start:** Data API off (the backend uses Postgres directly through
  Prisma; no table can leak through the public REST API), automatic RLS on, **Google-only sign-in**
  (Email provider off). Frankfurt, next to the server. Details: `docs/auth.md`.
- **Support address on Google's sign-in screen: a private Google Group**
  (typeplay-support@googlegroups.com), not Luka's Gmail. Google Workspace (support@typeplay.app,
  ~$7-8/user/month) waits for a team or real support volume; it is not needed to reply as
  hello@typeplay.app (Gmail "Send mail as" + a free sending service).
- **Code on GitHub:** private `LukaLazaraS/type-play`, default branch renamed `master` → `main`.
  The deploy doesn't use it (it ships from Luka's PC); it is the offsite backup now and the
  CI/CD trigger from package 5.
- **Phone play (Poki / CrazyGames pattern):** the game sheet stays (poster, prompt, "Make my
  own"); Play on a touch device opens the game full screen and locks it to the game's
  orientation (Android), or covers the page with a "Turn your phone sideways" card where full
  screen isn't allowed (iPhone), with "Play upright" as the way out. A small ✕ at the left edge
  returns to the sheet with the game still running. Desktop: inline as before plus a Full screen
  button. Each `game.json` names its orientation, so portrait games lock to portrait.

## 2026-10-16: games are portrait-first

- **Luka:** most games should play upright on a phone; landscape only where the game needs width.
  It's a game decision, not a site one: **the game agent picks the orientation per game when it
  builds**, from the genre and the prompt. The site already follows whatever `game.json` says
  (full screen locks to it). Work item: `parked.md` #17.
