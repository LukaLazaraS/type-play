# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Decided by Luka 2026-10-12 (`docs/decisions.md`), before `apps/web/` exists: Next.js 16 (React) for
every page, public and logged-in, in one project on one domain; shadcn/ui with assistant-ui or
AI Elements for the chat; NestJS backend; Postgres via Prisma on Supabase. Self-hosted with
`next start`.

## Users

**Mainly people with a game idea who have never written code** (Luka, 2026-10-13): teens and
adults who want to play their idea now, show it to friends, and maybe put it on their phone.
Many arrive from Luka's YouTube channels (Satisfying 2D/3D Sims, ~29K subscribers combined,
plus newer channels); the launch demo video is the funnel.

The site is for anyone, so it must not shut out the others: hobby and indie developers who
want a fast prototype or a real store release under their own name, and creators who make
games for their audience.

Their job: describe a game in a sentence, play it within minutes, change it by talking, and
take it to the platforms they care about.

## Product Purpose

TypePlay turns a typed description into a real, playable game. An AI agent builds it in the
Godot engine, the user plays it in the browser straight away, improves it through chat, and
exports it to the web, Android, iOS and desktop (Steam). "Lovable, but for games."

Success: a non-coder's first sentence becomes a game they enjoy playing, they keep editing it,
and some pay for more credits and a store build.

## Positioning

- **Headline: "Type it, play it."** It is the name and the first thing people do on the site.
- **The difference: real games that ship everywhere.** Every game is a real Godot project, so
  the same game exports to the web, Android, iOS and Steam, not just a browser page. Rosebud
  and other browser-only tools can't make that claim; HiberWorld is closed; Roblox games
  stay inside Roblox (`docs/decisions.md`, 2026-10-11).
- Supporting truths: every game's 2D art is drawn by the agent in code, so no two games
  look like the same template pack. The user picks the AI per message and sees what it
  costs.

## Operating Context

- **Flow:** type a prompt → the game agent builds (Sonnet ~2-3 min; Haiku 8-12 min, playable
  core at ~5-7) → the game appears in a preview frame → the user plays, then asks for changes
  in chat → every edit is a version they can undo → export when ready. A "Try another
  version" button re-rolls a first build, because results are partly luck.
- **Waiting is a real part of using it:** builds take minutes, not seconds, and stream
  progress to the chat.
- **Model picker on every message:** Fast (Haiku), Smart (Sonnet), Best (Opus), effort
  changeable, with honest tips and the credit cost. Defaults: new games on Smart, edits on
  Fast.
- **Where games run:** previews and shared games run from typeplay.dev, a separate domain
  from the site (typeplay.app), so a game's code can't touch the user's login.
- **Devices:** the browser preview is strong on desktop and weaker on phones; the native
  build is the real phone experience, and the UI says so.
- **Store publishing happens on the user's own account** (Google $25 once, Apple $99/yr):
  TypePlay makes the build, the user uploads it.
- **Money:** Paddle is the merchant of record. Login with Google only.
- **Public pages:** home, pricing, terms, privacy and refund policy. Paddle reviews them
  before approving the account, so they go live first. Each game gets a share page with a
  link preview.

## Capabilities and Constraints

- **Genres:** closed beta 1 has endless runner and 2D puzzle; launch adds racer and tower
  defence. Open-world 3D comes later, as the models get better.
- **Exports by phase:** web preview now; Android (APK + AAB) planned before launch; iOS, Steam
  and desktop after launch. Copy can promise every platform, but it must not say a platform
  is available before it is, and it names no dates: the site says "now" for the web and
  "coming" for the rest (Luka, 2026-10-14).
- **Tiers sell credits, never unlimited use.** Free: Fast only, a few builds a month, no
  export, a TypePlay badge on the game. Paid (~$20/month, ~$50/month): more credits, Smart by
  default, Best costs more. One build per project at a time.
- **The AI can refuse a prompt** (Anthropic safety classifiers): show a clear message, not an
  error.
- **Age: 13+ for an account; paid plans need 18+ or a parent's consent** (Luka, 2026-10-13).
  Anthropic allows products built on its API to serve minors only with extra safeguards
  (age checks, moderation of prompts and games), so check its current policy before beta.
  The EU sets the digital consent age per country (13-16), so some EU teens need a parent's
  consent.
- **Terms in the UI:** game, build, edit, version, credits, Fast / Smart / Best, export.
  "Builder" and "game agent" are internal names, never shown to users.
- **Undecided:** the exact credit amounts and prices per tier (`docs/parked.md` #9), how
  parent consent works at checkout, and languages. Everything is written in English so far;
  other languages are not decided.

## Brand Commitments

- **Name: TypePlay** (decided 2026-10-13). Site on typeplay.app, games on typeplay.dev. Not
  "GameForge": that name belongs to Gameforge AG, a game publisher.
- **Main phrase: "Type it, play it."** (Luka, 2026-10-13).
- **Voice (inferred from the repo, not yet confirmed):** plain and honest. Real numbers, no
  hype; say what each model costs and that results vary. Messages to players don't use
  developer words like "automatic check" or "untested on a phone"; the game agent's replies
  are rewritten for players (`packages/agent/RESULTS.md`, Findings).
- No logo, colours or type have been chosen yet.

## Evidence on Hand

- **About 40 test games** built from one-sentence prompts, in `packages/agent/output/` (runners, match-3,
  box-push puzzle, 3D car), across Haiku, Sonnet and Opus. Browse them with
  `cd packages/agent && npm run gallery` (http://127.0.0.1:8070/).
- **Luka's play scores:** Sonnet's 2D game scored 9/10; the code-drawn 2D games scored
  9-10/10; Opus builds had the better character art (`docs/decisions.md`, 2026-10-13).
- **Measured cost and time per build and per edit:** `proof/RESULTS.md`, `packages/agent/RESULTS.md`.
- **Luka's track record:** he shipped *Black Hole Galaxy* (Unity) to the Play Store and the
  App Store.
- **Absent, and not to be made up:** users, testimonials, user counts, published TypePlay
  games, press, a logo, the demo video, final credit numbers.

## Product Principles

1. **Play first.** Nothing should come between the first sentence and the playing game.
   Accounts, options and upsells wait until the user has played.
2. **Real games, honest reach.** Every game is a real project that can ship. Be exact about
   which exports exist today and how the phone preview compares with the native build.
3. **Honest about luck and cost.** Show the model choice and its credit price before a
   message runs. Make re-rolling and undoing easy instead of pretending every build lands.
4. **Talk like a player, not a developer.** No engine or AI jargon in anything a user reads.
5. **The game is the user's.** They can change everything in it, the art isn't a stock
   template, and they publish under their own name.

## Accessibility & Inclusion

- Users can be 13: copy and flows must be readable for young teens and safe for them
  (moderation as above).
- Plain English also serves the many non-native English speakers in a global YouTube
  audience (inferred; Luka works in English as a second language).
