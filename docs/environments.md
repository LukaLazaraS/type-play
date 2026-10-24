# Environments

Three environments: **dev**, **test** and **production** (Luka 10-25, UX batch 4.4; there is no "staging"). Where each
keeps its data and who signs it in (decided 2026-10-24, batch 3.3). Luka is the only developer and tester; the rule
that holds them apart: **real users' data never comes to this PC**: no dumps, no copies of the live
database, no restores of it here. Test data is made by the tests and the seed scripts.

| Environment | What runs there | Database | Sign-in | Payments |
|---|---|---|---|---|
| **dev** (this PC) | `npm run dev`, the local site (`scripts/local-site.mjs`), `npm run admin` | `typeplay_dev` on this PC's Postgres 17: kept, test data only (the local site seeds Luka's account and the showcase games) | the live Supabase project's Google sign-in (Luka 10-24: solo developer, low risk; only the sign-in record is there) | off; the Paddle sandbox purchase runs here until **test** exists (below) |
| dev: the automated tests (this PC) | the test scripts (`test:e2e`, `test:billing`, `test:android:e2e`) and the APIs they start | `typeplay_autotest` on the same Postgres: emptied at the start of every run, so nothing else may use it | dev sign-in (`DEV_AUTH=1`) | Paddle stub |
| **test** (later, not now) | online, for inner testers, on a private domain | its own Supabase project (database and sign-in) | that project | Paddle sandbox |
| **production** | typeplay.app, api.typeplay.app, typeplay.dev | the live Supabase project | the live Supabase project | Paddle live |

**This PC's Postgres** (`scripts/local-db.mjs start | stop | status | reset-autotest`): one Postgres 17 for every checkout,
portable binaries and data in `%LOCALAPPDATA%\TypePlay\postgres-17`, listening on 127.0.0.1:54329 only (user `postgres`,
no password), below normal priority on 12 of 16 cores. `npm run dev` starts it (the API's `predev`), and so do the test
scripts and the local site; it keeps running until `stop` or a restart of the PC.

**Which file sets what** (`apps/server/src/env-files.ts`): the root `.env` (git-ignored) holds the live values and is
what `deploy/deploy.mjs` reads. On this PC, dev first reads the committed, secret-free `.env.development` (`typeplay_dev`;
the file keeps the standard name that Next.js and dotenv read) and the automated tests `.env.autotest`
(`typeplay_autotest`, mode `TYPEPLAY_ENV=autotest`), then `.env` for the secrets; a git-ignored `.env.local` (or
`.env.autotest.local`) overrides either. The first file to set a key wins, the shell wins over all files. In dev and
the automated tests the API, the admin CLI and the Prisma CLI refuse a `DATABASE_URL` that isn't on this PC. A
process of yours that runs beside the tests (a second API you start by hand) takes `typeplay_dev` or a database of
its own, never `typeplay_autotest`: a test run empties it.

**The live database from this PC**: only `npm run admin:live -w @typeplay/server -- <command>` (the beta runbook's
invites, grants and feedback), which reads the root `.env` alone and says so. The live server reads none of these files
(`NODE_ENV=production`, its container's environment).

**The Paddle sandbox purchase from this PC** (until **test** exists): dev with the sandbox keys, and a tunnel that gives
Paddle's webhooks a public https address on this PC's API (`cloudflared tunnel --url http://127.0.0.1:3002`, a
Cloudflare quick tunnel: a new address each start; not installed yet: `winget install Cloudflare.cloudflared`; `<address>/webhooks/paddle` as a sandbox notification destination
with its own secret). Without the tunnel the checkout page's 20 s verify still adds the credits. The steps:
`apps/web/README.md`, "Monday, with Luka's sandbox keys".

**test, later**: an online copy for inner testers on a private domain, with its own Supabase project, run like
production (`NODE_ENV=production`, its container's environment, not these files). Not now: Luka is the only developer
and tester (parked row 21).
