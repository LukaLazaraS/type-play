# Environments

Three environments: **dev**, **test** and **production** (Luka 10-25, UX batch 4.4; there is no "staging"). Where each
keeps its data and who signs it in (decided 2026-10-24, batch 3.3). Luka is the only developer and tester; the rule
that holds them apart: **real users' data never comes to this PC**: no dumps, no copies of the live
database, no restores of it here. Test data is made by the tests and the seed scripts.

| Environment | What runs there | Database | Sign-in | Payments |
|---|---|---|---|---|
| **dev** (this PC) | `npm run dev`, the local site (`scripts/local-site.mjs`), `npm run admin` | `typeplay_dev` on this PC's Postgres 17: kept, test data only (the local site seeds Luka's account and the showcase games) | the live Supabase project's Google sign-in (Luka 10-24: solo developer, low risk; only the sign-in record is there) | off; the Paddle sandbox purchase runs here until **test** exists (below) |
| dev: the automated tests (this PC) | the test scripts (`test:e2e`, `test:billing`, `test:android:e2e`), the walk-throughs that start a stack of their own (`apps/web/scripts/shot-beta`, `-compare`, `-platform`, `-queue`), and the APIs they start | one per run on the same Postgres, `typeplay_autotest_<script>_<id>`: made fresh at the run's start, dropped at its end (below) | dev sign-in (`DEV_AUTH=1`) | Paddle stub |
| **test** (later, not now) | online, for inner testers, on a private domain | its own Supabase project (database and sign-in) | that project | Paddle sandbox |
| **production** | typeplay.app, api.typeplay.app, typeplay.dev | the live Supabase project | the live Supabase project | Paddle live |

**This PC's Postgres** (`scripts/local-db.mjs start | stop | status`): one Postgres 17 for every checkout,
portable binaries and data in `%LOCALAPPDATA%\TypePlay\postgres-17`, listening on 127.0.0.1:54329 only (user `postgres`,
no password), below normal priority on 12 of 16 cores. `npm run dev` starts it (the API's `predev`), and so do the test
scripts and the local site; it keeps running until `stop` or a restart of the PC. It allows 300 connections (set
10-27 for many test runs at once; two e2e runs together peak at 36), from its next start after that.

**The automated tests** (10-27): every run is kept apart from every other, so any number of them, from any checkout,
run at the same time beside the local site and none waits for or breaks another (`scripts/test-run.mjs`).
- **A database of its own**: `typeplay_autotest_<script>_<id>` (e.g. `typeplay_autotest_e2e_1a2b3c4d`), made and
  brought up to date with the checkout's own migrations at the run's start (~4 s), dropped when the run's process
  exits. A run killed hard leaves its database; the next run's start drops it. The test script sets `DATABASE_URL` and
  `DIRECT_URL` to it before it starts anything, so every API and admin CLI it starts uses it. Nothing else uses a run's
  database, and a run never touches `typeplay_dev`.
- **Ports picked free**: every API, key proxy, games origin and `next dev` a run starts gets a port that nothing listens
  on, between 20000 and 40000 (below Windows' dynamic range, where outgoing connections take theirs), kept for the run
  until it exits, so no other run is given it. Nothing in a test or walk-through has a fixed port any more.
- How a dead run is told from a live one: the run's process keeps one connection to Postgres, which holds an advisory
  lock per database and port it has; a process that dies loses the connection, and Postgres frees its locks at once.
- **Shared on purpose**: within one checkout, two walk-throughs that run `next dev` take turns (they share
  `apps/web/tsconfig.json`, which `next dev` writes its type folders into); the second waits and says which one holds the
  checkout. And the Paddle sandbox stack (`apps/web/scripts/paddle-sandbox.mjs stack`) is one per PC: its fixed ports
  are what the webhook tunnel and its other commands use. Both are `lock()` in `scripts/test-run.mjs`: a lock shared by
  every checkout that waits, names its holder, and is free again the moment its holder dies.
- `node scripts/test-run.mjs clean` drops what runs killed hard left, and the shared databases used before 10-27
  (`typeplay_autotest`, `typeplay_shots`) once nothing is connected to them.

**Which file sets what** (`apps/server/src/env-files.ts`): the root `.env` (git-ignored) holds the live values and is
what `deploy/deploy.mjs` reads. On this PC, dev first reads the committed, secret-free `.env.development` (`typeplay_dev`;
the file keeps the standard name that Next.js and dotenv read) and the automated tests `.env.autotest` (mode
`TYPEPLAY_ENV=autotest`; its `DATABASE_URL` only keeps the mode on this PC's Postgres: each run sets its own database
over it), then `.env` for the secrets; a git-ignored `.env.local` (or `.env.autotest.local`) overrides either. The
first file to set a key wins, the shell wins over all files. In dev and the automated tests the API, the admin CLI and
the Prisma CLI refuse a `DATABASE_URL` that isn't on this PC. A process of yours that runs beside the tests (a second
API you start by hand) takes `typeplay_dev` or a database of its own, never a test run's.

**The live database from this PC**: only `npm run admin:live -w @typeplay/server -- <command>` (the beta runbook's
invites, grants and feedback), which reads the root `.env` alone and says so. The live server reads none of these files
(`NODE_ENV=production`, its container's environment).

**The Paddle sandbox purchase from this PC** (until **test** exists; run 10-25): dev with the sandbox keys (the root
`.env.local` and `apps/web/.env.local`) on a database of its own, **`typeplay_sandbox`** on the same Postgres
(`apps/web/scripts/paddle-sandbox.mjs`: the API on :3062, the site on :3060), and a quick tunnel that gives Paddle's
webhooks a public https address and forwards only `POST /webhooks/paddle` (`node apps/server/scripts/webhook-tunnel.mjs
3062`). Without the tunnel the checkout page's 20 s verify still adds the credits. The steps: `apps/web/README.md`, "The
Paddle sandbox on this PC".

**test, later**: an online copy for inner testers on a private domain, with its own Supabase project, run like
production (`NODE_ENV=production`, its container's environment, not these files). Not now: Luka is the only developer
and tester (parked row 21).
