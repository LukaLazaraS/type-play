# Environments

Where each kind of run keeps its data and who signs it in (decided 2026-10-24, Luka's UX batch 3.3). Luka is the only
developer; the rule that holds them apart: **real users' data never comes to this PC**: no dumps, no copies of the live
database, no restores of it here. Test data is made by the tests and the seed scripts.

| Environment | What runs there | Database | Sign-in | Payments |
|---|---|---|---|---|
| **Development** | `npm run dev`, the local site (`scripts/local-site.mjs`), `npm run admin` | `typeplay_dev` on this PC's Postgres 17: kept, test data only (the local site seeds Luka's account and the showcase games) | the live Supabase project's Google sign-in (Luka 10-24: solo developer, low risk; only the sign-in record is there) | off |
| **Test** | the test scripts (`test:e2e`, `test:billing`, `test:android:e2e`) and the APIs they start | `typeplay_test` on the same Postgres: emptied at the start of every run | dev sign-in (`DEV_AUTH=1`) | Paddle stub |
| **Staging** (later) | the paid beta's rehearsal, before ~11-06: the Paddle sandbox purchase runs here | its own Supabase project (database and sign-in) | that project | Paddle sandbox |
| **Production** | typeplay.app, api.typeplay.app, typeplay.dev | the live Supabase project | the live Supabase project | Paddle live |

**This PC's Postgres** (`scripts/local-db.mjs start | stop | status | reset-test`): one Postgres 17 for every checkout,
portable binaries and data in `%LOCALAPPDATA%\TypePlay\postgres-17`, listening on 127.0.0.1:54329 only (user `postgres`,
no password), below normal priority on 12 of 16 cores. `npm run dev` starts it (the API's `predev`), and so do the test
scripts and the local site; it keeps running until `stop` or a restart of the PC.

**Which file sets what** (`apps/server/src/env-files.ts`): the root `.env` (git-ignored) holds the live values and is
what `deploy/deploy.mjs` reads. On this PC, development first reads the committed, secret-free `.env.development`
(`typeplay_dev`) and tests `.env.test` (`typeplay_test`), then `.env` for the secrets; a git-ignored `.env.local` (or
`.env.test.local`) overrides either. The first file to set a key wins, the shell wins over all files. In development and
tests the API, the admin CLI and the Prisma CLI refuse a `DATABASE_URL` that isn't on this PC.

**The live database from this PC**: only `npm run admin:live -w @typeplay/server -- <command>` (the beta runbook's
invites, grants and feedback), which reads the root `.env` alone and says so. The live server reads none of these files
(`NODE_ENV=production`, its container's environment).
