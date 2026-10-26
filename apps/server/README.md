# TypePlay API (`apps/server`)

The backend: users, projects, game agent runs, versions and credits. NestJS 12 + Prisma 7 on
Supabase Postgres, port 3002. It implements the contract in `packages/shared/src/index.ts`
exactly; the site (`apps/web`) talks only to it. Runs on Luka's PC for now; ready for its own
server at https://api.typeplay.app ("Live mode" below, going live: `deploy/README.md` "The API").

## Run it

```
npm install                                   # once, at the root
npm run dev -w @typeplay/server               # watch mode: tsc --watch + node --watch
npm run build -w @typeplay/server && npm run start -w @typeplay/server
npm run check -w @typeplay/server             # type-check + lint (root `npm run check` runs it too)
```

Root `npm run dev` starts it with the site (:3000) and the games origin (:3001). Builds need the
games origin running to be played: http://127.0.0.1:3001/play.html?g=<buildId>.

On this PC it works on `typeplay_dev`, this PC's Postgres (`docs/environments.md`; `npm run dev` starts the server
first, `predev`), never the live database: the API, `npm run admin` and the Prisma CLI read the committed
`.env.development` before the root `.env`, and refuse a database that isn't on this PC. The live beta's database is
reached only with `npm run admin:live -w @typeplay/server -- <command>`.

On this PC (not in production) the server limits itself at start to 12 of the 16 cores at
below-normal priority (`packages/agent/tools/cpu.mjs`); the agent, Godot and the hidden browser
it starts inherit that.

## Env keys (root `.env`, git-ignored; names only)

- `DATABASE_URL` (transaction pooler, the app), `DIRECT_URL` (session pooler, migrations): the live values in `.env`;
  on this PC `.env.development` / `.env.autotest` set them to `typeplay_dev` / `typeplay_autotest` first (`src/env-files.ts`)
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (sign-in check; `docs/auth.md`)
- Optional: `PORT` (3002), `HOST` (127.0.0.1), `DATA_DIR` (`<repo>/data`), `GAMES_BUILDS_DIR`
  (`apps/games/builds`), `GODOT_VERSION` (4.7.2), `GODOT_EXE`, `MAX_RUNS` (3), `RUN_TIMEOUT_MIN` (40),
  `QUEUE_WAIT_MIN` (30) and `QUEUE_FREE_DELAY_MIN` (10) ("The build queue"),
  `R2_GAMES_BUCKET` (typeplay-games), `BROWSER_EXE` (the check's hidden browser), `ASSET_LIBRARY`
  (the 3D model library's root; `/assets` in the runner)
- Who pays for the agent: `AGENT_AUTH` = `max` (default: the Claude Code login on this PC, Luka's Max)
  or `api` (needs `ANTHROPIC_API_KEY`; the key proxy adds it, see "Live mode"). `KEY_PROXY_HOST` /
  `KEY_PROXY_PORT` (127.0.0.1:8787) / `KEY_PROXY_URL` (what the agent is given); `ANTHROPIC_UPSTREAM` (tests)
- Where builds go: `GAMES_PUBLISH` = `folder` (default, `GAMES_BUILDS_DIR`) or `r2` (the typeplay-games
  bucket behind typeplay.dev; needs `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`)
- Live server only: `RUNNER_SOCKET` (runs go to the runner container, "Live mode"). The runner's own:
  `RUNNER_MAX_PROJECT_MB` (512: a game folder bigger than this after an agent job fails the job),
  `RUNNER_MAX_PROCS` (512: processes per job, `prlimit --nproc`), `TYPEPLAY_SERVER` (`1` in `compose.yaml`, handed to
  every job: the check's Godot and browser use the container's whole CPU cap instead of keeping a developer PC's 4 cores
  free, `packages/agent/tools/cpu.mjs`)
- The closed beta: `BETA_INVITE_ONLY` (on in production unless `0`, off on this PC unless `1`): section "The closed
  beta and feedback" below
- Dev only: `DEV_AUTH=1` (sign in as `Bearer dev:<email>`, user id `dev-<slug>`; the server refuses
  to start with it when `NODE_ENV=production`), `AGENT_FAKE=1` (fake runs, below), `TRUST_PROXY=1` (read the
  visitor's address from `CF-Connecting-IP` for the gallery's in-memory limits; always on in production), `FAKE_METER=1`
  (tests, with `AGENT_FAKE=1` and `AGENT_AUTH=api`: fake runs make their model call through the key proxy, below)
- Paddle: `PADDLE_ENV`, `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET` (+ `_PREVIOUS`), the five `PADDLE_PRICE_*`,
  `ADMIN_EMAILS`, `BILLING_JOBS`, `PADDLE_API_URL` (tests): section "Billing: Paddle" below
- Android export: `ANDROID_EXPORT`, `ANDROID_KEY_MASTER` (+ `_PREV`), `SIGNER_SOCKET`, `EXPORTS_DIR`, `MAX_ANDROID_BUILDS`,
  `ANDROID_BUILD_TIMEOUT_MIN`, `ANDROID_STORE`, `R2_EXPORTS_BUCKET`, `ANDROID_TOOLCHAIN`, `API_PUBLIC_URL`, and on this PC
  `JAVA_HOME`, `ANDROID_HOME`, `BUNDLETOOL_JAR`, `ANDROID_BUILD_TOOLS`, `GRADLE_SEED`, `ANDROID_ICONS`; `ANDROID_FAKE=1`
  (dev/tests; with it `ANDROID_LINK_SECONDS` shortens the phone link's life, and `ANDROID_STORE=r2` keeps the "bucket" in a
  folder): section "Android export" below

The game agent gets none of the `.env` keys (it runs shell commands) and never our API key: on this
PC it runs on the Claude Code login (Luka's Max); with `AGENT_AUTH=api` it gets the key proxy's
address and a token for that run only.

`GET /health` (no sign-in): `{ ok, runner, runs, agent, billing, android, inviteOnly }`, 503 when the runner doesn't answer.
`npm run r2:check -w @typeplay/server` puts a throwaway build on R2, reads it back from
https://typeplay.dev and deletes it (passed 2026-10-17).

## Fake runs (`AGENT_FAKE=1`)

For the site's development and tests, so nobody burns the agent: progress lines over ~5 s, then a
version that plays the robot-runner demo pack with a drawn poster, reported like a two-step build
whose second step was rolled back: $0.14 of work in all (`costUsd`, kept for our accounting), $0.10
in the game the player gets (`chargeUsd`: 1.7 credits charged). A prompt containing `FAIL` fails
(charged 0) and, on an edit, leaves the folder as a failed run would (a commit of a half-done change
and an untracked `junk.txt`, which the reset must take away); `SLOW` publishes slowly (3 s), so a test
can land a Stop after the agent has finished; `LONG` takes ~45 s instead of ~5 (the screens shown while a first
build runs); `NOPOSTER` writes a picture that isn't a PNG, so the
build publishes without a poster; `FILL` on a change makes the game fill every screen (its `PLATFORM` word and window, as
the agent does when asked to make a game fit other screens too); a first build sets them for the request's platform; a build that works brings nine fixed next-step ideas; with `FAKE_METER=1`, `METER:<n>` makes one Haiku call through the key proxy at the
start, whose (mock) answer reports `<n>` output tokens. Real git commits, real builds, real ledger entries.

The database tests run on `typeplay_autotest` (`.env.autotest`; `test/test-db.mjs` starts this PC's Postgres if needed,
brings the database up to date and empties it first), so they can run any time, beside the live beta and `npm run dev`;
nothing else may use that database (a run empties it).

```
npm run test:e2e -w @typeplay/server          # 434 checks (2026-10-26); starts its own API on :3023 with DEV_AUTH=1 AGENT_FAKE=1 (API_URL to use yours);
                                              # makes and deletes its own test users; the Supabase sign-in record check runs only where
                                              # the database is a Supabase project's (the online test environment, later); starts
                                              # a second API on :3013 of its own for the run timeout and the interrupted-run recovery,
                                              # one on :3016 with MAX_RUNS=1 for the build queue (and a restart of it),
                                              # one on :3019 with TRUST_PROXY=1 for the gallery (several visitors, fresh limits),
                                              # one on :3021 with BETA_INVITE_ONLY=1 for the closed beta, and one on :3033 (its key
                                              # proxy on :8797) with AGENT_AUTH=api FAKE_METER=1 and a mock Anthropic ("Security review 10-20")
npm run test:ledger -w @typeplay/server       # the ledger's arithmetic (53 checks, no database; after a build)
npm run test:queue -w @typeplay/server        # the build queue's order and rough waits (21 checks, no database; after a build)
npm run test:proxy -w @typeplay/server        # the key proxy's metering against a mock Anthropic (11 checks, no key, no network)
npm run test:billing -w @typeplay/server      # Paddle webhooks, inbox, handlers, admin and services against a stub (233 checks; starts its own API on :3014, :3025-3028)
npm run test:android -w @typeplay/server      # Android export's pure parts: preset, names, crypto, manifest check, zip/ELF, the phone link, a Stop against the queue (133 checks, no database)
npm run test:android:e2e -w @typeplay/server  # Android export end to end with a fake job + signer, the icon route (a 1 MB icon included), a fake R2 bucket (96 checks; starts its own API on :3015)
```

## Account, game management, share pages (added 2026-10-18)

Routes (all in the contract's endpoint list, `packages/shared/src/index.ts`):

- `PATCH /projects/:id` `{ name?, shared? }`: rename (1-60 letters, one line) and share or unshare. A
  rename sticks: later builds keep it instead of the game agent's name (`Project.renamed`). Sharing
  needs a build. Neither moves the game up the list (`updatedAt` stays).
- `DELETE /projects/:id`: stops a running build first, then deletes the rows (messages, versions),
  the game folder, its published builds (`builds/<id>-v*`, only that game's own, so their links stop
  working) and its run logs. The credit ledger keeps its charges (the balance depends on them); the
  history then says "A game you deleted".
- `GET /projects/:id/download`: the Godot project at its current version as `<name>.zip` (no
  `.git/`, `.godot/`, `export/`, agent log; symlinks and special files skipped; ≤ 5,000 files and
  256 MB), plus `README.txt` (open it in Godot 4.7; mentions `assets/CREDITS.md` when there is one).
  409 while building. `src/games/download.ts`, `src/games/zip.ts` (no dependency).
- `GET /me/usage?cursor=&limit=`: the credit history, newest first, 25 a page (what, which game, the
  prompt that ran). `GET /me/export`: everything about the account as a JSON file.
- `DELETE /me` `{ confirm: "DELETE" }`: closes the account: every game as above, then the user row
  (its ledger goes with it, cascade), then the Supabase sign-in record (`DELETE FROM auth.users`, same
  database, so the API needs no Supabase secret key; tested on a throwaway Supabase user). What stays
  is a **tombstone** (`ClosedAccount`, `src/auth/tombstone.ts`): the old user id, so the account's
  still-valid sign-in tokens are refused for 2 hours across API restarts and a second tab can't bring
  it back as a new account; and the email scrambled (SHA-256 with a fixed salt, not reversible), so a
  sign-up with the same email within 90 days gets no Free credits again (the account works, with 0
  credits, and `GET /me` carries a `notice` saying why; the privacy policy says we keep it). Rows older
  than 90 days are removed at the next closing. No payment records are in our database yet (Paddle
  keeps invoices).
- `GET /public/games/:id` (no sign-in, `@Public()`): a shared, built game's name, build and poster;
  404 for private, unshared or missing (no difference). The share page `/play/<id>` reads it.
- `GET /estimate` takes `&effort=low|medium|high`: about 0.8× and 1.8× the medium numbers
  (measured, `credits.ts`); the credit checks before a run use the same effort.
- **Posters:** `publishBuild()` also publishes the check's `export/screenshot-start.png` as
  `builds/<id>/poster.png` (only a real PNG, ≤ 8 MB, never after a rolled-back step);
  `Version.poster` says whether it did. Fake runs draw one (`fake-agent.ts`).
- **The Free plan's mark** (2026-10-20): `publishBuild()` writes `badge` into `game.json`: `true` when the game's owner
  is on Free as the build is published (`runs.service.ts` reads the owner's plan right before), `false` on a paid plan;
  `apps/games/play.html` shows "Made with TypePlay" for `true` only (`apps/games/README.md`). Builds are immutable, so a
  plan change rewrites no build: the next version follows the plan then, and **a restore reuses the old build, so it keeps
  that build's badge** (after an upgrade, restoring a version made on Free brings the mark back until the next change).
  Android builds never carry it. Tests: `test/e2e.mjs` "the Free plan's mark" (12 checks: a Free owner's build `true`,
  `admin plan medium` then the next build `false` and version 1 unchanged, restore 1 keeps `true` and restore 2 `false`,
  and Godot's import cache: a planted `.godot/` gone after a restore and after a failed run's reset, the folder clean).

Migration `20261018000000_share_rename_poster` (applied to the dev database 10-18). Dev only:
`CORS_ORIGINS=http://localhost:3010` lets a second test site call the API.

## The public gallery, play counts, reports (added 2026-10-18)

PLAN.md "Better than the competitors" #9 with #4's share pages. `src/gallery/` (`gallery.service.ts`, `limits.ts`,
`admin-gallery.ts`), the routes in `src/public.controller.ts`; the site's side: `apps/web/README.md` "The public gallery".

- `PATCH /projects/:id` `{ listed }`: shows a shared game in the public gallery (typeplay.app/explore) or not. 400 unless
  it is shared (or shared in the same request); `shared: false` sets `listed: false` too, and sharing again leaves it out.
  `listedAt` is the first time it went in and stays: going back in later doesn't move it up in New. Neither a listing nor
  an admin's hide moves the game up its maker's list (`updatedAt` stays).
- `GET /public/gallery?sort=popular|new|all&genre=&q=&cursor=&limit=` (no sign-in, `no-store`): listed, shared, not hidden
  games with a build; 24 a page (`limit` 1-48). Popular orders by plays in the last 7 UTC days (today included), then
  `listedAt`, then id; New by `listedAt`, id; All (2026-10-27) by the name in lower case, A to Z, then id. `genre` keeps one
  genre's games; `q` keeps names holding every one of its words (the first 5), anywhere and in any case (`ILIKE`, with `%`,
  `_` and `\` as plain letters; 60 letters at most, else 400). "Any case" is the database's: Latin letters always; other
  scripts (Ракета, ракета) only where its locale folds them, not on this PC's C-locale Postgres (the live one: not checked).
  Keyset cursors (base64url JSON of the last row's keys), so paging never repeats a game while the order holds; pass the
  same genre and q with them. Popular can move as people play (the site drops a game it already shows). A first page (no cursor) also says `total` (the games matching genre and q)
  and `genres` (the whole gallery's games per genre, a genre with none left out), two counts beside the page's query. A
  `GalleryGame` is id, name, orientation, platform, buildId, poster, plays (all time), playsWeek, genre and listedAt,
  nothing about the maker.
- **The genre** is the column `Project.genre` (enum `Genre`, 2026-10-27; migration `20261027000000_gallery_library`), copied
  from the game folder's `GENRE` file (run.mjs writes it; read as untrusted data: a plain file of at most 64 bytes, never a
  link or a pipe, a word that names a genre skill or nothing) after every build that makes a version and whenever the game
  goes into the gallery. Games listed before the column existed get theirs when the API starts (`backfillGenres`, logged
  "genres: N gallery game(s) filled in"). Search at scale: the name filter is a scan of the listed games, fine for
  thousands; past that, a `pg_trgm` index on `name` is the step.
- `POST /public/games/:id/play` (no sign-in, no body): the share page's frame said the game started. 204 for anything that
  looks like a game id (404 otherwise, before any work), counted or not; one upsert of `PlayCount` (game, UTC day, count)
  for a shared, built game. **Nothing about the visitor is stored.** The limits live in memory only (`limits.ts`, gone on
  a restart): one address counts at most 3 times an hour per game and 60 times an hour in all, and a game takes at most 120
  a minute whoever sends them (a backstop for addresses that can be made up: the runner reaches the API inside our own
  network, where it could set `CF-Connecting-IP`). An address is held only as an HMAC under a random secret made at start,
  and an IPv6 /64 counts as one. It comes from Cloudflare's `CF-Connecting-IP` on the live server (the firewall lets only
  Cloudflare in on 80/443), from the connection elsewhere (`TRUST_PROXY=1` for tests).
- `POST /public/games/:id/report` `{ reason, text? }` (no sign-in): 204; 400 for a reason other than
  `sexual | hate | copied | scam | other` or a line over 500 letters; 404 unless shared; 429 `too_many` (one report per
  game and address a day, 5 an hour from one address, in memory as above). The line is tidied to one line without control
  characters. `GameReport` keeps the game, the reason, the line and the time, nothing about the sender. **The third open
  report takes the game out of the gallery by itself** (`AUTO_HIDE_REPORTS`; `hiddenReason` "3 reports, waiting for a
  look", audited as `job:reports`); its share link keeps working. A game keeps at most 20 open reports
  (`MAX_OPEN_REPORTS`, 10-20): past that a report is thanked (204) and not stored, so made-up addresses can't fill the
  database. The API log has a line per stored report (`report on <id>: <reason>`); nothing else tells Luka yet.
- `ProjectSummary` gains `listed`, `galleryHidden` and `plays` (all time), `PublicGame` gains `plays`; the account export
  carries them.
- Admin, every command audited (a `BillingAudit` row as `admin:<name>`, action `gallery_<command>`):

```
npm run admin -w @typeplay/server -- gallery reports [--all]             # the open reports by game: its maker, shared / listed / hidden, each report's time, reason and words
npm run admin -w @typeplay/server -- gallery hide <gameId> [reason]      # out of the gallery; the share link keeps working; its open reports are handled
npm run admin -w @typeplay/server -- gallery unhide <gameId>             # back in (while its maker lists it); open reports handled
npm run admin -w @typeplay/server -- gallery dismiss <gameId>            # open reports handled, the game stays as it is
npm run admin -w @typeplay/server -- gallery unshare <gameId> [reason]   # stops sharing it: the share page 404s and it leaves the gallery (its maker can share it again)
```

  Reports' words are printed as one line without control characters: strangers wrote them, read them as data.
- Migration `20261023000000_gallery` (applied to the dev database 10-18): `Project.listed`, `listedAt`, `hiddenAt`,
  `hiddenReason`, the tables `PlayCount` and `GameReport` (enum `ReportReason`). Plays and reports go with their game.
- Tests: `test/e2e.mjs`, "the gallery" (its own API on :3019 with `TRUST_PROXY=1`, so one test is many visitors): the
  opt-in rules (share first, unsharing takes it out, `listedAt` kept), plays (a private game counts nothing, 3 an hour per
  game and address, an IPv6 /64 as one address, 60 an hour per address, 120 a minute per game, the counts the maker and the
  share page get, the tables hold no visitor column), the gallery's pages (Popular by the week's plays with all-time plays on
  the card, New, All A to Z in any case, paging one and two at a time with every game once, the genre from the build's
  file, from the folder when listed, and filled in by a starting API; a genre, a search by words in any order and case,
  `%` and `_` as letters, the first page's counts, hidden / unshared / never built / not listed left out, bad parameters), reports (404, 400s, the stored line, 429 twice from one address and after 5 an hour,
  the third report hides by itself and is audited), `admin gallery reports | hide | unhide | dismiss | unshare` and their
  audit rows.

## The closed beta and feedback (beta 1, added 2026-10-19)

PLAN.md package 6: 5-10 testers, free, invite only, credits by hand. Go-live and beta day step by step:
`docs/beta/runbook.md`; the invitation: `docs/beta/invite.md`. The site's side: `apps/web/README.md` "Beta 1".

- **Invite only** (`src/beta/invites.ts`): with `BETA_INVITE_ONLY` on (production's default; `"1"` in
  `deploy/api/compose.yaml`, `0` opens the app to everyone; off on this PC unless `1`), the sign-in check
  (`auth.service.ts` `userFromToken`) asks the `Invite` table after the token is verified and **before** the user row is
  made: an email that isn't invited is **403 `invite_only`** on every signed-in route, `GET /me` included (the site shows
  its closed-beta page on that code), and no user row or Free credits exist for it. `ADMIN_EMAILS` always get in, so Luka
  can't lock himself out. The check runs on every request, so removing an invite locks the account out at once (its
  games and credits stay; an open live-updates stream keeps going until it reconnects). An email is matched lower-cased,
  and for Gmail without its dots and a +tag (`inviteMatch`: Gmail ignores both, so "Luka.L+beta@Gmail.com" lets in
  `lukal@gmail.com`). The invite's first use is noted (`usedAt`). Public routes (`/public/*`, the Paddle webhook, the
  phone links, `/health`) don't sign in, so they are unaffected. `/health` says `inviteOnly`.
- **Beta codes** (Luka, 2026-10-24; `src/beta/codes.ts`, `codes.controller.ts`): six digits a tester types on the
  closed-beta page instead of being invited by address. `POST /beta/code { code }` is the one route an email that isn't
  invited may call: the guard verifies the token and passes only the identity (`@IdentityOnly()` in `auth.guard.ts`, no
  user row; the e2e pins that it is on this route alone). Spaces and dashes are ignored; not six digits is 400. A right
  code, in one transaction that raises `used` only while `used < uses`, records the use (`BetaCodeUse`, one per code and
  email) and writes an `Invite` with the code; then the account is made as at any first sign-in (the Free plan's 20) and
  the code's credits are added as an `admin` bucket (spent last, never expires; "Beta code" in the credit history; a
  `beta_code` audit row). A request that fails between the two is finished by the account's next code check. Answers:
  200 `{ credits }` (0 when the account was already in: admins, invited emails, the beta off); **403 `code_wrong`** for
  a wrong or removed code ("N tries left this hour"), a used-up one, or a code this account used already (after
  `invite remove`, a code doesn't let the same account back in); **429 `too_many`** after **5 wrong codes an hour per
  email** (`BETA_CODE_TRIES_PER_HOUR`) and **50 an hour in all** (`BETA_CODE_TRIES_PER_HOUR_ALL`, so six digits can't be
  guessed from many accounts either; then the code box waits for the hour, for everyone; `invite add` still works).
  Wrong tries are kept a day (`BetaCodeTry`).
- **What stays outside our tables:** an uninvited Google sign-in still leaves Supabase's own sign-in record
  (`auth.users`: email, name, picture), as any sign-in does; our database keeps nothing else about it.
- **`POST /feedback`** (`src/feedback/`, the contract's `FeedbackBody`): what happened (required) and what they expected
  (optional), up to 4,000 letters each with line breaks kept and other control characters dropped; the site's path it
  came from (no query string); the browser from the request's User-Agent (400 characters); and, when the tester ticks it,
  their own game (404 for anyone else's), one of its messages (400 otherwise) and the version playing then (`versionN`,
  `buildId`). 201 `{ id }` (10 letters and digits); **10 a day per user** (24 hours; then 429 `too_many`, said plainly).
  The log says only that a note came (`feedback <id> from <user> about <game>`), never its words. A note goes with its
  account (cascade) and loses its game when the game is deleted (the words stay); `GET /me/export` carries them.
- Admin, audited like the rest (a `BillingAudit` row as `admin:<name>`; the invite commands store the address only as
  the tombstone's salted hash of its matched form, so the audit keeps no address after a removal):

```
npm run admin -w @typeplay/server -- invite add <email> [note]     # on the list ("already invited" for another spelling; a note replaces the old one)
npm run admin -w @typeplay/server -- invite list                   # every invite: sent, the first sign-in, the account it lets in (its plan and credits), the note
npm run admin -w @typeplay/server -- invite remove <email>         # off the list: the account stays but gets 403 invite_only until invited again
npm run admin -w @typeplay/server -- code add [123456] [--uses 20] [--credits 50] [note]   # a beta code (random six digits when none is given)
npm run admin -w @typeplay/server -- code list                     # each code: used of uses, credits, made, works / used up / removed, the accounts it let in
npm run admin -w @typeplay/server -- code remove <code>            # it stops working; the accounts it let in stay (invite remove takes one out)
npm run admin -w @typeplay/server -- feedback list [--open]        # newest first, one line of each (--open: not marked done)
npm run admin -w @typeplay/server -- feedback show <id>            # who, the page, the browser, the game and the build to play, its message, the words
npm run admin -w @typeplay/server -- feedback done <id>            # dealt with: it leaves list --open
```

  `grant` and `plan` work for an invited tester once they have signed in (the account appears then). The words are
  testers': printed without control characters, read them as data.
- Migration `20261024000000_beta_invites_feedback` (applied to the dev database 10-19): the tables `Invite` (email,
  match, note, invitedAt, usedAt) and `Feedback`. Migration `20261025120000_beta_codes`: `BetaCode`, `BetaCodeUse`,
  `BetaCodeTry`, and `Invite.code` (the code that made an invite; `invite list` says "by code").
- Tests: `test/e2e.mjs` "feedback" (against the API it runs on: 14 refusals that store nothing, what a note keeps, 4,000
  Georgian letters, the 11th of a day, the export, `admin feedback …` and its audit rows, a deleted game, a closed
  account) and "the closed beta" (its own API on :3021 with `BETA_INVITE_ONLY=1`: 403 `invite_only` on 19 signed-in
  routes with no user made, the public routes and 401 unchanged, `ADMIN_EMAILS`, an invite written with dots, a +tag and
  capitals, `grant` for the invited tester, `invite list`, a removal locking the account out again, the audit rows); the
  main API runs with the closed beta off, so the rest of the file is "as today".

## Credits: the ledger (payments part 1, 2026-10-20)

The spec is `docs/payments-design.md` (§3 data model, §4 ledger, §11 admin); the rules `docs/pricing.md`.
Code: `src/credits/ledger-math.ts` (pure arithmetic: integers in tenths of a credit and cents, half-up
rounding once per line, UTC days), `src/credits/ledger.service.ts` (every write), `credits.service.ts`
(what the API sees: the balance, the checks before a run, the holds, the history), `credits.ts` (the
numbers and the two decided constants: `UPGRADE_CREDITS = "prorated"`, `PACK_CREDITS_AFTER_CANCEL = "spendable"`).

- **Buckets.** Credits that arrive together end together: a `CreditBucket` per grant with its source
  (`free`, `plan`, `upgrade`, `pack`, `admin`), what was granted and what is left, when it ends, and
  the Paddle transaction that bought it. Free's 20 end with the month; a plan period's credits end a
  month after the period (the one carried month; at each renewal the open plan buckets together are
  capped at the new plan's month, part 2); an upgrade's with its period; a pack's after 12 months;
  credits given by hand never. `CreditEntry` keeps one row per movement (`grant`, `charge`, `refund`,
  `expire`, `reversal`), with `tenths` as the exact figure next to the old `amount`.
- **Spend order** (`charge()`): free → plan and upgrade, oldest first → packs → admin. One `charge`
  row per message (note `<new|edit> on <model>`, which the history turns into "New game on Fast");
  its split over buckets is in `CreditAllocation`. A run whose charge passes what is left (the check
  before it used the low estimate) goes into **debt** (`User.debtTenths`, a null-bucket allocation):
  the balance shows the minus, nothing starts, and the next grant settles it first.
  `available` = the open, unfrozen buckets' remaining − debt; a bucket is frozen while a refund of it
  is pending at Paddle (part 2).
- **One lock per user.** Every ledger write is one Prisma interactive transaction that first runs
  `SELECT id FROM "User" WHERE id = $1 FOR UPDATE` (`LedgerService.lock`); `runs.service` takes that
  lock inside its own transaction, so the version, the message, the project and the charge commit
  together. Lock order everywhere: the user first.
- **`settle(user)`** runs at the top of every balance read, charge, grant, history, export and admin
  command when `User.nextSettleAt` has passed (a read with nothing due takes no lock, so `GET /me`
  polling stays read-only), and a 10-minute sweep (`BILLING_JOBS=0` turns it off) catches users who
  never come back. It ends due buckets (one `expire` row each: "Free credits ended", "Credits from
  October ended", "Pack credits ended"), gives Free users the month's 20 once their cycle
  (`freeCycleEndsAt`) has passed, at most one free grant a month per user (so cancel-and-return can't
  farm it; an account without the signup credits still gets its first 20 a month on), drops a
  `past_due` plan to Free a day after `periodEndsAt` (plan credits end, packs stay, `BillingAudit`
  "plan_lapsed"), and recomputes `nextSettleAt`.
- **Kill switch** (`credits.service` `assertCanRun`): each agent message stores the plan the run
  started on (`Message.plan`); once Free runs have cost `FREE_DAILY_AI_USD` ($20 of AI at list price,
  before VAT, failed runs included) since 00:00 UTC, every Free run answers 402 `free_paused` until
  midnight. Paid plans are not affected. A run counts what the agent reported, or what the key proxy metered when that
  is more (`aiSpentUsd`, 10-20: a Stop, a timeout or a crash reports $0, the meter doesn't). The day's number lives in
  `FreeSpend` (one row per UTC day,
  added to by `runs.service` when a Free run ends, never lowered; migration `20261022000000_free_spend`,
  2026-10-22): `Message` rows go with their game when it is deleted, so a sum over them would forget
  what a deleted game cost. The tests take their own Free builds out of it again when they clean up.
- **Holds** are unchanged: a run holds its estimate's high in memory until its charge or failure is
  written; `assertCanRun` subtracts a user's holds for its own check only.
- **`GET /me`** adds `credits.expiring` ("12 credits end on 3 Nov": the spendable buckets ending on
  the earliest day); `LedgerService.parts()` gives part 3's `credits.parts` for the billing page.
- **Invariants** (`admin audit`, run by the e2e after every ledger step): per user Σ `CreditEntry.tenths`
  = Σ open buckets' remaining − debt, and the debt = Σ null-bucket allocations; per charge Σ allocations
  = −charge; per bucket remaining = granted − allocations − expiries − reversals ≥ 0, and its grant
  rows = granted; one reversal per Paddle adjustment; `refundedCents ≤ paidCents`; stored events carry their own id.
- The migration `20261020000000_billing` (applied to the dev database 10-20) adds the enums and the
  tables, then backfills in plpgsql: every existing grant became a bucket ("Free plan" → `free`
  ending a month after it came; by hand → `admin`), every charge was allocated in spend order, Free
  users got `freeCycleEndsAt = createdAt + 1 month`. Nothing was renamed; `CreditEntry.amount` stays.
- **Tables ready for parts 2 and 3**, empty today: `Payment` (one per `txn_`, kept with `userId = null`
  after an account closes), `CheckoutSession` (the tick box's version and time), `Adjustment`,
  `Refund`, `PaddleEvent` (stored before processing; the payload never changes), `BillingAudit` (every
  admin command, the settle job's lapses; later webhooks and users), and on `User` the Paddle ids,
  subscription status and dates, `pendingPlan`, `billingFlag`, `paymentMethod`. `LedgerService` already
  has `reverseIn` (one reversal per `adj_`, unique) and `capCarryOverIn` for the webhooks.
- **Part 2 (below, "Billing") fills them**: the webhooks grant with `grantIn` (`source: "plan" | "upgrade" |
  "pack"`, `paymentId`), renewals `capCarryOverIn` first, refunds and chargebacks `reverseIn`. Part 3: `GET /billing`
  and the checkout, plan-change, cancel and portal endpoints (§9) and the `/billing` screens (§8); their
  services are in `src/billing/billing.service.ts` already.

## Billing: Paddle (payments part 2, 2026-10-20)

The spec is `docs/payments-design.md` §5-7 and §10-12; the facts `docs/research/paddle-2026.md`. Code in
`src/billing/`: `paddle.client.ts` (fetch with `Bearer` + `Paddle-Version: 1`, 10 s per call, a GET tried three
times, a POST or PATCH once: Paddle has no idempotency keys, so the caller lists or gets first; no SDK),
`paddle.signature.ts` (the webhook check), `paddle.service.ts` (the mode, the catalog cross-check),
`webhooks.controller.ts` + `inbox.service.ts` (store, answer, then apply), `handlers.ts` (what each event does),
`billing.service.ts` (what the endpoints, the admin and the account close need from Paddle).

**Env keys** (root `.env` on this PC; `api.env` + `deploy/api/compose.yaml` live; names only): `PADDLE_ENV`
(`sandbox` | `live`; unset = billing off), `PADDLE_API_KEY` (`pdl_sdbx_apikey_…` / `pdl_live_apikey_…`, must match
the env), `PADDLE_WEBHOOK_SECRET` (the notification destination's `pdl_ntfset_…`), `PADDLE_WEBHOOK_SECRET_PREVIOUS`
(the old destination's secret while a rotation is going: a rotation = a second destination, two secrets),
`PADDLE_PRICE_MEDIUM|HIGH|ULTRA|ULTRAPLUS|PACK` (from the catalog script), `ADMIN_EMAILS` (sandbox billing on the
live site is only for them; on this PC everyone), `PADDLE_API_URL` (tests only: the stub), `BILLING_JOBS=0` (no
timers: the settle sweep, the inbox's 30-second loop, the 5-minute refund lookup). The web's `NEXT_PUBLIC_PADDLE_ENV`
and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` are build args in `deploy/server/compose.yaml` (part 3 uses them).
`ENV_FILE_KEYS` keeps every one of them out of the game agent.

**Guards** (`env.ts` `assertPaddleConfig`, part of `assertSafeConfig`): a key without `PADDLE_ENV`, or whose prefix
doesn't match it, refuses to start; with a key all five price ids are required; production refuses `PADDLE_API_URL`
and a live key without a webhook secret. No key → mode `off`: `Me.billing.mode = "off"`, `/billing/*` (part 3) and
the webhook answer 503 `billing_off`. **At start** the API fetches the five prices (`GET /prices/{id}`) and compares
each with `credits.ts` (amount, USD, monthly or one-time, `custom_data.credits` and `plan`/`pack`, `tax_mode`
external): a mismatch refuses to start and says which; Paddle not answering leaves billing "not ready" (`/health`
`billing.ready`, every billing call 503 `billing_off`; `GET /billing` and `GET /me` still answer from our rows) until a
retry every 5 minutes, or the next billing call (at most one try per 10 s), gets through. A key Paddle refuses (401,
or 403 for a key that expired, was revoked or lacks a permission; 2026-10-22) is the same "not ready", never a crash:
the API starts, logs an ERROR, and `/health` carries `billing.problem` ("the key was refused (403 forbidden): check
PADDLE_API_KEY, its permissions and its expiry") until a key that works is in `.env` and the API restarted.

**Catalog**: `npm run paddle:catalog -w @typeplay/server -- --env sandbox|live [--tax-category saas|standard]`
(`scripts/paddle-catalog.ts`): the five products (Medium, High, Ultra, Ultra+, Credit pack; `custom_data.typeplay`
names them) and their USD prices ($20/$50/$100/$200 monthly, $10 once, quantity 1-1 and 1-10, `tax_mode: external`,
each price `custom_data { plan, credits }` / `{ pack: true, credits: 40 }`). Idempotent: lists first, creates only
what is missing, archives nothing (an old price that no longer matches is reported), then prints the five
`PADDLE_PRICE_*` lines. Written against the stub; it runs for real on Monday with Luka's sandbox key.

**Webhooks**: `POST /webhooks/paddle` (`@Public()`; the signature is the check). `main.ts` creates the app with
`rawBody: true` and a 1.5 MB JSON parser (1 MB until 10-20) that also parses the webhook path whatever its `Content-Type` says (Paddle
doesn't document it). The header `Paddle-Signature: ts=<unix>;h1=<hex>[;h1=…]` is checked with HMAC-SHA256 over
`<ts>:<raw body>`, every `h1` against the secret and the previous one in constant time; `|now − ts| > 300 s` is
refused (retries carry a fresh `ts`; the event id dedupe defeats replays) and a skew over 5 s is logged. 401 bad
signature, 400 bad JSON or envelope, 503 billing off, 500 database down (Paddle retries: 60 times over 3 days live,
3 in 15 min sandbox). The event is stored (`PaddleEvent`, `INSERT … ON CONFLICT (id) DO UPDATE SET deliveries + 1`,
a `failed` row back to `received` with its attempts reset: a replay keeps its `event_id`) and `{ ok: true }` goes
out at once; the 11 subscribed types are `received`, anything else `ignored` with its envelope only (no `data`: a
`customer.*` or `address.*` payload carries an email and a postal address, which must not sit here for good). On the
live account a simulated event (`ntfsimevt_…`, Paddle's simulator) is `ignored` the same way, with a warning: the live
destination's usage type is "Platform" only (sandbox: "Platform and simulation"), so an edited simulation can never
grant real credits. `GET /health` adds `billing: { mode, ready, problem, received, processed, ignored, parked, failed, lastEventAt }`.

**Inbox** (`inbox.service.ts`): one in-process loop (after each store, every 30 s, at start) claims
`received` rows that are due, oldest `occurred_at` first, with `FOR UPDATE SKIP LOCKED LIMIT 50`, runs each handler
under the user's lock and writes the outcome: `processed`, `ignored`, `parked` (unknown user, price or currency: a
person looks, `admin events --status parked`), or a retry (`attempts++`, `nextTryAt = now + min(60 s × 2^attempts,
1 h)`, `failed` after 20). The handler's note is kept on the row (`error`) for every outcome.

**Handlers** (`handlers.ts`; pure functions of the payload and `occurred_at`, so the verify pull, `admin sync` and
`admin retry` reuse them with synthetic ids `txn:<id>` / `adj:<id>`; every write is idempotent by its natural key):

| Event | What happens |
|---|---|
| `transaction.completed` | USD only (else parked); credits from the line items (`creditsForLines`, proration rates, negative lines subtract; an unknown price or a net ≤ 0 → parked). **A checkout (origin `web`/`api`) counts only when it is one we opened**: the user is the `CheckoutSession` for that `txn_` (none → parked "a checkout we did not open", nothing granted: anyone can open a Paddle checkout from a browser console with another user's email or id in it, the client token being public; `custom_data.userId` naming someone else → parked too). Paddle's own transactions (`subscription_*` origins) resolve the user by `custom_data.userId`, then the Paddle customer, then the subscription (a closed account's id → ignored; nobody → parked). One `Payment` per `txn_` (seen before → done). **Money on a subscription that is not the user's is never applied**: a `subscription_*` transaction on another subscription, or a new checkout's subscription while the user's own is active, past due or paused, is parked (`two_subscriptions` flag and audit when the user's own is live; a person decides, nothing is auto-cancelled). Then by origin: `web`/`api` + plan price → `plan` bucket, the plan set, `subscriptionStatus active`, the subscription id; `subscription_recurring` → `capCarryOverIn` at the new plan's month, the previous period's buckets end a month after that period, then the `plan` bucket ("Renewal: Medium"), the plan from the price paid (a pending downgrade lands here), `pendingPlan` cleared, `active` again after a past-due; `subscription_update` → `upgrade` bucket ending with the period's plan bucket ("Upgrade to High"), the plan from the positive line; `web` + pack price or `subscription_charge` → `pack` bucket for 12 months ("Credit pack"); `subscription_payment_method_change` → nothing. Consent copied from the `CheckoutSession` (else from `custom_data`), `paymentMethod` from `payments[].method_details`, a pack on Free (the plan lapsed between checkout and payment) granted with an anomaly note |
| `transaction.payment_failed` | `User.lastPaymentFailedAt = max(occurred_at)` (the banner); Paddle retries, the plan lapses a day after the paid period (`settle`) |
| `subscription.created/updated/activated/past_due/paused/resumed/canceled` | one `applySubscription`: skipped when `occurred_at ≤ subscriptionUpdatedAt`, or when it is not the user's subscription (a second active one → flag `two_subscriptions`; the user's own is never replaced); a subscription the user has none against yet is attached only when it comes from a checkout we opened (`subscription.created` names its first transaction, which has our `CheckoutSession`) or a payment recorded on it, else ignored (a stranger's subscription with this user's email in it changes nothing; the money's events attach the real one); sets the ids, status, `nextBilledAt`, `periodEndsAt` (on `past_due` the paid period's end is kept, so the lapse comes a day after it: to confirm in the sandbox whether `current_billing_period` advances), `cancelsAt` from `scheduled_change`; corrects the current period's plan buckets to end a month after the period (the first transaction carries no `billing_period`); `canceled`/`paused` → plan Free, plan and upgrade buckets end (`canceled`), packs stay spendable (§14(f)), the Free cycle starts. Never sets the plan from `items` |
| `adjustment.created/updated` | upsert by the newest `occurred_at`, the effect once per status: `refund` `approved` → `reverseIn` (ours: all of the frozen bucket; Paddle's own: the refunded share, the bucket stays open if something is left; nothing left → no "Refunded 0" row, the bucket just closes), `Payment.refundedCents` and status, our `Refund` resolved, or flag `refund_review` when Paddle refunded more than the unused share (measured against what was left *before* the reversal: a refund of exactly the unused share, a full refund of an untouched payment included, is the normal case and gets no flag). **A plan or renewal payment refunded in full ends the plan now** (2026-10-22; docs/pricing.md: the plan runs to the end of the paid period, and that period is paid for no longer): when the fully refunded payment is the user's newest plan/renewal one, plan → Free, the remaining plan and upgrade buckets end (`canceled`), packs stay, the Free cycle starts, `BillingAudit` `plan_ended` why `refunded`. **An approved refund of a payment on the user's subscription cancels it at Paddle** (Luka, 2026-10-25: a refund means they don't want it any more; ours or Paddle's alike): right away for the current period's plan or renewal payment (whole or partial), at the period's end for an upgrade's (the month paid for stays); a pack's refund takes its credits only. The handler marks `Adjustment.cancelSubscription` under the lock (handlers never call Paddle); `BillingService.adjustmentCancels` posts `/subscriptions/{id}/cancel` after it: right after our own refund's answer, after `admin sync`, and every 5 minutes until Paddle takes it (already cancelled counts as done). `rejected` → the bucket unfrozen; `pending_approval` → linked; `chargeback`/`chargeback_warning` → the payment's remaining credits removed ("Removed after a chargeback"; none left → no row), `charged_back`, flag `chargeback` (403 `billing_hold` on builds and checkouts until `admin flag <email> clear`), and the subscription cancelled at Paddle the same way, whatever the payment (Luka, 2026-10-26: no second charge, no second dispute); `chargeback_reverse` → logged, restored by hand |

**Services for part 3** (`billing.service.ts`, each tested through the stub): `modeFor(user)` and `meBilling(user)`
(`Me.billing`); `createCheckout` (the customer on the first checkout, `POST /customers` or on 409 `GET
/customers?email=`; `POST /transactions` with `custom_data { userId, item, consentVersion, consentAt }`; a
`CheckoutSession`; 403 `plan_required` for a pack on Free, 409 `billing_busy` for a plan while subscribed);
`checkoutStatus` and `verifyCheckout` (the pull: `GET /transactions/{id}` applied through the handler);
`previewPlanChange` / `applyPlanChange` / `undoPlanChange` (up: `prorated_immediately` preview and PATCH with
`prevent_change`, `chargeNowUsd` tax included and `taxNowUsd` its tax part so a page can say "$15.00 plus $1.50 tax"
(the shared contract has it optional until part 3's controller passes it on); the credits arrive with the
`subscription_update` transaction; down: `do_not_bill`, refused unless
the preview bills nothing now and the next renewal is exactly the new price, then `pendingPlan`; guards: active only,
not within 30 minutes of the renewal, no pending change, a declined card → 409 `billing_busy`); `cancel` / `keep`
(`POST …/cancel next_billing_period`, `PATCH { scheduled_change: null }`, Paddle's answer applied at once);
`portal` (a session per click, links never stored); `requestRefund` and `refundLookups` (admin, below); `sync`;
`cancelForClose`. Paddle not answering → 503 `billing_off`; a refusal → 409 `billing_busy` with Paddle's reason.

**Account close**: `DELETE /me` first cancels a live subscription at Paddle `immediately`; inside Paddle's
30-minute lock before a renewal → 409 `billing_busy`, Paddle not answering → 503 `billing_off`, both "Try again in an
hour", and the account stays. Only Paddle's own "nothing to cancel" (404, or the code `subscription_already_canceled`)
lets the close go on without a cancel; any other refusal keeps the account (a subscription must never keep billing
with nobody behind it). `Payment`, `Adjustment` and `PaddleEvent` rows stay with `userId = null`; a later event
naming that user is `ignored` (its tombstone). `GET /me/export` (`account.service.ts`) lists every payment with the
tick box ticked for it (`payments[].consentVersion`, `consentAt`: the retained acknowledgment of docs/payments-design.md
§14(e)) and the subscription as our rows have it (`billing`); invoices stay at Paddle.

**Admin** (Paddle commands need `PADDLE_ENV` + `PADDLE_API_KEY`; the catalog check runs first):
`events [--status failed|parked|…] [--limit n]`, `event <id>` (the row and its payload), `retry <id>` (the handler
now), `refund <email> <txn|last> [reason]` (under the lock: within 14 days, not refunded, no refund pending, the
bucket open, no build going (409), the quote = the unused share before tax, at most what is left of the money (a
refund Paddle made earlier took its credits out already, so it is not subtracted twice; $0 refused) → the bucket
frozen and a `Refund` row → `POST /adjustments`: `type: full` (no items, no amount) when nothing was used and nothing
refunded before, else `partial` with `tax_mode: external` and the line item's amount; Paddle's answer applied through
the adjustment handler (sandbox approves every 10 minutes, live auto-approves ≤ $400; a full plan refund ends the
plan on approval, see the handlers table); a timeout → `lookup`: the
5-minute job asks `GET /adjustments?transaction_id=` and only posts again when Paddle has nothing), `sync <email>`
(Paddle's subscription, completed transactions and adjustments applied as if webhooks), `downgrade <email> cancel`.
Every command writes `BillingAudit`.

**Tests**: `npm run test:billing -w @typeplay/server` (after a build): `test/billing.mjs` starts `test/paddle-stub.mjs`
(every endpoint of §5's table, Paddle's shapes, recorded calls, switches for a 409 customer, timeouts, a down
Paddle, a declined card, the renewal lock, a cancel refused with another code, a refused key, a wrong price) and an
API of its own on :3014 pointed at it (more on :3025-3028 for the start-up cases; a port something else answers on
fails loudly); 233 checks (191 for parts 1-2, 42 for part 3's endpoints, "Billing endpoints" below):
the signature cases (good, bad, stale, two `h1`, the previous secret, tampered body, no header, bad JSON, bad
envelope), duplicates and replays, the simulator's sequence in order and shuffled (plan + 100 credits exactly once),
the verify pull, renewals with the cap, an upgrade's prorated credits, a declined card, a pending downgrade (undo,
then the renewal at the new price), cancel/keep/canceled with a pack surviving, past due → the lapse after 24 h →
a recovered renewal, `admin refund` (quote, freeze, approved, rejected, $0, during a build, timeout → lookup both
ways), a Paddle-initiated refund (partial, then beyond the unused share), chargeback → hold → cleared, a renewal
during a build, parked/failed/replayed events and `admin events|event|retry`, `admin sync`, portal links, `DELETE /me`
(the lock, a refusal with another "cancel" code, Paddle down, then the cancel and the anonymised rows; "already
canceled" lets it go), the review's cases of 2026-10-22 (a forged checkout naming a subscriber is parked and grants
nothing; a second subscription never replaces the first and its renewal is parked while the user's own renewal still
applies; a stranger's subscription naming a Free user attaches nothing; a forged pack on Free is parked; Paddle's full
refund of an untouched $20 removes the credits, ends the plan, gets no flag and cancels the subscription now; `admin
refund` of an untouched month posts `type: full`, ends the plan on approval and cancels the subscription; the refund
rule of 2026-10-25: 90 of 100 plan credits used gives $2.00 back and cancels now, a pack with 30 of 40 used gives
$2.50 and leaves the plan, a payment past 14 days is refused, an upgrade's refund cancels at the period's end, an upgrade
with every credit used gets $0 (refused); a chargeback cancels the subscription (the month's payment now, a pack's at the
period's end, a second chargeback event nothing more); a chargeback on an empty bucket writes no "Removed 0" row; an ignored event stores no payload; the export lists payments with consent),
and the start-up guards (a catalog mismatch, a refused key with the API up and `/health` saying why, a simulated
event ignored on live, Paddle down, a key in the wrong env, `PADDLE_API_URL` in production). `admin audit` runs after
every step. `test:e2e` and `test:ledger` stay green.

**Monday, with Luka's sandbox keys** (docs/payments-design.md §14, §12 "Manual"): the catalog script for real;
a destination on a tunnel to this PC; the simulator's scenarios against it; a real checkout once part 3's page
exists; what the code marks "to confirm": the downgrade preview's numbers with `do_not_bill`, whether
`current_billing_period` advances on `past_due`, whether simulated webhooks are signed with the destination's secret,
`retained_fee` on a refund, whether the overlay collects the address for a server-created transaction.

## Billing endpoints (payments part 3, 2026-10-20)

`src/billing/billing.controller.ts` maps the contract's `/billing` routes (`packages/shared/src/index.ts`, "payments
part 3") 1:1 onto `billing.service.ts`, checking bodies and query strings with plain 400s:

- `GET /billing` → `BillingInfo` (`info()`; settled first like `GET /me`): the plan; the subscription (status,
  `renewsAt` = the next payment unless a cancel waits, `endsAt`, `cancelsAt`, `pendingPlan`, `paymentFailedAt`, the
  card as "Visa ending 4242", and `lastPlan`, the plan the last payment was for, for "Your High plan ended…" after
  a lapse); `credits.parts` from `LedgerService.parts()` in spend order; `canBuyPack` (a paid plan, no dispute
  hold); the payments newest first, each with what it was ("Medium plan", "Renewal: Medium", "Upgrade to High",
  "Credit pack"), the amount before tax and the tax, the invoice number, `refundableUntil` (14 days), what was
  refunded, its status (paid, partly_refunded, refunded, disputed) and `refundPendingUsd` while a refund is with
  Paddle; the consent record (the newest payment's wording version and time); `hold`.
- `POST /billing/checkout` (`parseCheckout`): `item` is `plan:<paid plan>` or `pack`, `consentVersion` must be the
  current wording (`CONSENT_VERSION` = v1, else 400 "reload the page": a page left open across a wording change
  can't record the old one), `acceptedTerms: true`; 201 `{ transactionId }`. `GET /billing/checkout/:id` and
  `POST /billing/checkout/:id/verify` → `{ status }`. `GET /billing/plan-change?plan=` and `POST /billing/plan-change`
  (`parsePlan`: a paid plan, else 400) → the preview without the subscription id; `DELETE /billing/plan-change`,
  `POST /billing/cancel` → `{ cancelsAt }`, `DELETE /billing/cancel`, `POST /billing/portal` → the links.
- `Me.billing.freeRefillAt` (added here): on Free, when the next 20 credits arrive ("20 more on 1 Nov").
- Billing off, or sandbox billing on the live site for someone not in `ADMIN_EMAILS`: every route is 503
  `billing_off`, and the site shows "opens here soon" from `Me.billing.mode` without calling them.

Tests: `test/billing.mjs` "the billing endpoints" (after the webhook cases, same stub): the info shape on Free and on
a plan, the 400s (a stale wording version, no acceptance, plan:free, no item), checkout → status → verify (the pull
completes it; another user's checkout is 404), a second plan 409, the upgrade preview and apply (then the
`subscription_update` transaction → `lastPlan` high, parts free | plan | upgrade), the downgrade preview, apply, the
409 while it waits, the undo, cancel / cancel again (nothing new at Paddle) / keep, a pack through the endpoint, the
portal, Paddle not answering (`GET /billing` still answers, the portal is 503), and an API without keys (503
`billing_off` on `/billing` and the checkout, `GET /me` still fine). The site's end-to-end run is
`apps/web/scripts/shot-app.mjs` (`apps/web/README.md` "Plan and billing").

## Admin CLI (beta: credits are given by hand)

```
npm run admin -w @typeplay/server -- grant <email> <amount> [note]     # negative takes away (consumed in spend order)
npm run admin -w @typeplay/server -- plan <email> free|medium|high|ultra|ultraplus   # entitlement only, no credits move
npm run admin -w @typeplay/server -- list                              # users, plans, balances, subscription status, flags
npm run admin -w @typeplay/server -- user <email>                      # buckets, debt, Paddle ids and dates, payments, refunds
npm run admin -w @typeplay/server -- audit [email]                     # the ledger's invariants (exit 1 when one fails)
npm run admin -w @typeplay/server -- flag <email> clear                # clears billingFlag (chargeback, two_subscriptions, refund_review)
npm run admin -w @typeplay/server -- events [--status parked|failed|received|processed|ignored] [--limit 50]
npm run admin -w @typeplay/server -- event <evt_id>                    # the stored row and its payload
npm run admin -w @typeplay/server -- retry <evt_id>                    # the handler again, now
npm run admin -w @typeplay/server -- refund <email> <txn_id|last> [reason]   # the unused share, within 14 days ("Billing" above)
npm run admin -w @typeplay/server -- sync <email>                      # Paddle's subscription, payments and adjustments applied as if webhooks
npm run admin -w @typeplay/server -- downgrade <email> cancel          # undo a downgrade waiting for the renewal
```

The public gallery's moderation: `gallery reports | hide | unhide | dismiss | unshare` ("The public gallery" above).
The closed beta and the testers' notes: `invite add | list | remove`, `feedback list | show | done` ("The closed beta and
feedback" above).

A user exists after their first sign-in (the API creates them with the Free plan's 20 credits; in the closed beta only
once they are invited).
A positive grant opens an `admin` bucket (spent last, never ends); every command writes a `BillingAudit`
row as `admin:<ADMIN_NAME or the OS user>`. The last three commands talk to Paddle (`PADDLE_ENV` + `PADDLE_API_KEY`).

## How a message runs

1. Checks (in order): one run per project, going or waiting (409 `busy`), the plan's builds at once per user,
   waiting ones included (Free and Medium one, High and up two, `credits.ts` `runsAtOnce`: 409 `busy`), model in the
   plan (403), credits ≥ the estimate's low after what the user's other runs
   hold (402 `no_credits`), Free: credits left today ≥ the low, the same rule the site shows (402
   `daily_limit`), estimate's high over 25 / 3 on Free without `confirm` (409 `needs_confirm`). The
   run then **holds** its estimate's high (in memory, `CreditsService.heldBy`) until its charge or its
   failure is written, so two messages sent at once can't both spend the same credits. Past `MAX_RUNS` at once
   the build waits in line instead of starting ("The build queue" below; until 2026-10-26: 409 `busy`).
2. `node packages/agent/run.mjs --dir data/projects/<id> --model haiku|sonnet|opus --effort … --events
   [--edit | --platform phone|computer|fill]` (a first build: the screens the player picked on /create, `POST /projects`
   `platform`; left out, the agent picks one shape, portrait first); its `@@event` lines become the SSE `progress` events (each line cut at 64 KB, at most
   50 MB a run, `src/runs/lines.ts`). Full output: `data/logs/`.
3. Success: the web export is published as `builds/<id>-v<n>/` (`src/games/publish.ts`, `publishBuild()`:
   `apps/games/builds` on this PC, R2 → typeplay.dev live; its `game.json` says `badge: true` when the owner is
   on Free at that moment, "The Free plan's mark" above), then one transaction writes the version, the
   final message and the charge: run.mjs's `chargeUsd` (only the attempts in the game the player gets;
   its `costUsd`, every attempt, is stored on the message for our accounting) plus the player-message
   rewrite, or the key proxy's metered cost when that is more (live server, `Message.meteredUsd`), ÷
   $0.06, rounded up to 0.1, at least 0.1. A Stop that lands after the agent finished still means no
   version and no charge (checked inside that transaction; the build already published is taken back).
   Afterwards the Godot engine files in `export/web/` go (`trimExport`: ~36 MB, the same bytes in every
   game; `index.pck` and the check's pictures stay; the next check or export writes them again). Failed,
   refused, cancelled or timed-out runs charge 0 and the folder goes back to the last version's commit.
   A re-export after a rolled-back last step is tracked on the run, so Stop and a shutdown kill it
   (Godot gets 3 + 4 minutes).
4. Restore = a new commit with the old version's files and a new version reusing its build (so it keeps
   that build's Free mark, or its absence).
5. The game's platform (2026-10-25): `Project.platform` is the player's pick at once (the preview opens on it), then
   after every build and restore what the folder's `PLATFORM` word says (run.mjs writes it; read as untrusted data like
   `GENRE`): `phone`, `computer` or `fill` as written, the agent's own pick (`auto`) as the shape it chose, null for a
   game from before (no file). A change can make a game fill every screen ("make it fit here too"); a restore can take
   it back. Views carry it (`ProjectSummary`, `PublicGame`, `GalleryGame`): the site opens the preview on it, says
   "Made for phones." elsewhere, and never asks to turn the phone for a game that fills every screen.

A server that stops mid-run marks that run failed at the next start and resets the folder. When a
folder can't be reset (the runner restarting, a file still held), the reset is tried again after 2, 10
and 30 s, then the project is marked `dirty`: the next run or download resets it first and stops with a
plain message if that still fails. Nothing builds on, or is downloaded from, a dirty folder.

Every reset (a failed, cancelled, timed-out or interrupted run, a dirty folder put right) and every restore
also clears the game folder's `.godot/` (2026-10-20, `src/games/git.ts` `dropImportCache`): Godot's import
cache is git-ignored, so `git reset` and `git clean` leave it, and imports of files that were rolled back
broke the next check after a reset (10-19). The next check or export imports afresh. It runs as
`git clean -qfdx -- .godot`, through the same `git()` as the reset (in the runner on the live server); a
cache that can't be removed is logged and left, never a failed reset.

## The build queue (2026-10-26)

When every builder is busy (`MAX_RUNS` agent runs going; an Android build counts as two), a new build no longer gets
409 `busy`: it waits in line and starts by itself (`src/runs/queue.service.ts`; the arithmetic, pure, in
`src/runs/queue-math.ts`).

- **The line is in Postgres** (`QueuedRun`: one row per waiting build, one per game; its agent message has status
  `queued`), so a restart keeps it: at the start the rows are mirrored in `RunRegistry` again and their credits held
  again, and the line moves once what a stopped server left running has been reset. A build the queue had taken out of
  the line but not yet started when the server stopped (its message `queued`, no row) is marked failed (interrupted,
  0 credits). The mirror keeps every check in the registry synchronous, as before: two requests can't both pass the
  per-game or the per-user claim.
- **The order: paid first, first come first served, and a free build ages.** Each row has a turn, `turnAt`: when it was
  queued for a paid plan's build, `QUEUE_FREE_DELAY_MIN` (10) later for a Free one; the line is sorted by turn, then by
  when queued. A paid build that arrives within those 10 minutes goes ahead of a free one; nothing that arrives later
  ever does, so a free build always reaches the front however many paid builds keep coming, and a paid build's place
  never moves back. Aging rather than a reserved share (one start in N kept for Free): a share starves nobody either, but
  a place in line then jumps with the share's counter, so no wait shown could be honest; with aging a build's place
  changes only when one ahead of it starts or leaves or, for a free build in its first 10 minutes, a paid one arrives.
- **The plan's builds at once still apply, waiting ones included** (`credits.ts` `runsAtOnce`: one on Free and Medium,
  two from High): past it, 409 `busy` as before. One build per game, waiting or going: a message, a restore or an
  Android build of a game whose build waits answers 409 `busy`; a download works (the files are as they were).
- **Credits.** The checks run when the build is sent, as before (402 `no_credits` / `daily_limit` / `free_paused`, 403,
  409 `needs_confirm`: nobody waits in line for nothing), and its estimate's high is held from then on (in memory; held
  again after a restart), so the user's other messages can't spend the same credits. **Nothing is charged while it
  waits.** At its turn the checks run again on the user's row as it is then (`CreditsService.assertCanStart`; asking
  first is not repeated): a plan that lapsed meanwhile, a billing hold, the credits after the user's other holds, and for
  a Free build **the kill switch** (`FREE_DAILY_AI_USD`). A build that no longer passes leaves the line without starting,
  its reason in its message ("Free builds were paused while this waited: …", 0 credits). The message's `plan` is the plan
  it started on. A build that started is charged at its end, as every run.
- **Stop** (`POST /projects/:id/cancel`) takes a waiting build out of the line ("Stopped. Your game is unchanged, and
  nothing was charged."); deleting the game or the account does too. A Stop and the build's turn can come at once:
  whoever deletes the row has the build (one conditional delete, as the Android queue's claim); when the turn won, the
  build starts and the Stop then stops the run.
- **The wait limit:** a build still waiting `QUEUE_WAIT_MIN` (30) after its turn leaves the line, 0 credits ("This waited
  too long for its turn, so it left the queue…"): a paid build 30 minutes after it was sent, a free one 40. Counted from the
  turn so that, under a load paid builds alone fill, a free build fares as a paid one sent 10 minutes later would, rather
  than always being the one dropped.
- **What the site sees:** `ProjectSummary.status` `queued` with `queue: { ahead, waitMin, lane, leavesAt }` (`leavesAt`:
  when the wait limit would take it out of the line; the site says so when the rough wait runs past it); the agent message
  `queued`, then `running` with `startedAt` (and `finishedAt` in the database: how long builds wait and take on the
  server is one query). An agent message without `startedAt` left the line without starting (the migration
  `20261026010000_started_backfill` gave the older ones their `createdAt`, as every build started when sent then). Events: `{ type: "queued", messageId, queue }` when a build joins the line and whenever its place
  or rough wait changes (looked at every 30 s while builds wait), `started` when it starts (with `startedAt`), `failed`
  when it leaves without starting.
- **The rough wait** (`queue-math.ts` `waits`): each builder comes free when its build should end (a run its typical
  length after it started and at least a minute from now; an Android build in about 3 minutes, holding two), and each
  waiting build in turn takes the first builder to come free, for its own typical length (`TYPICAL_MIN`, by new or edit
  and model, and for Opus by effort too: its high effort runs 3 to 18 times longer; medians of this PC's runs,
  `docs/research/build-capacity-2026-10-26.md`). Whole minutes, at least 1: a guess from typical lengths, so the site
  says "about".
- `/health` gains `queued`. A restart keeps the line, but it still stops the builds going, so `deploy.mjs api` still
  checks `runs`.

Tests: `npm run test:queue` (the order and the waits, no database) and the e2e's "the build queue" (its own API on :3016
with one builder, a 3 s free delay and a 15 s wait limit): paid before free, no starvation, nothing charged while
waiting and charged once it ran, Stop and deleting the game, the wait limit, the kill switch at a build's turn, a
restart that keeps the line.

## Where data lives

- Postgres (Supabase): `User`, `Project`, `Message`, `Version`, `CreditEntry` + `CreditBucket` +
  `CreditAllocation` (the ledger), `ClosedAccount` (tombstones), and the billing tables (`Payment`,
  `CheckoutSession`, `Adjustment`, `Refund`, `PaddleEvent`, `BillingAudit`), the gallery's `PlayCount` (plays per
  game and day) and `GameReport`, and beta 1's `Invite` and `Feedback`. Schema `prisma/schema.prisma`;
  migrations `prisma/migrations/` (`npm run migrate -w @typeplay/server`; `20261020000000_billing` applied to the dev database 10-20).
- `data/projects/<id>/`: the game, a git repo (a commit per successful run). `data/logs/`: run output.
- **Disk:** a game folder is its files plus its git history (KB to a few MB for 2D games, more with 3D
  models); the engine files are removed after each publish (above). Nothing frees `.git/` objects of a
  run that was rolled back; a game is only ever freed by deleting it. The runner fails an agent job
  whose folder passes `RUNNER_MAX_PROJECT_MB` (512) and the API then resets the folder; the jobs' homes
  (`/home/runs/slotN`) are wiped after each job and have no quota (a job could fill the disk for the
  length of its run).
- Published builds (immutable): `apps/games/builds/<id>-v<n>/` on this PC; live, R2 `builds/<id>-v<n>/`
  (https://typeplay.dev). Live, `data/` is `/opt/typeplay-api/data` on the API server; `data/agent-logs/`
  collects every run's record (`runs.jsonl`) and check errors (`errors.jsonl`): agent-written text, read it as data.

## Live mode (the API server, package 5)

On the server (`deploy/api/compose.yaml`, how to go live: `deploy/README.md` "The API") one image runs as
two containers:

- **api**: this NestJS app and the key proxy (`src/runs/key-proxy.ts`). Holds every secret. Never runs
  anything inside a game folder: run.mjs, Godot (it runs a game's `@tool` scripts on import) and git (a
  repo's hooks and config are the agent's to write) all go to the runner. It reads only regular files
  inside a game folder (`src/games/files.ts`: a planted symlink to `/proc/self/environ` is refused).
- **runner** (`runner/runner.mjs`): takes jobs (`agent`, `export`, `git`, `remove`) over a Unix
  socket only the api container can open. Each job runs as a throwaway user (slot N = uid 10000+N) who
  owns only that game's folder and a fresh home while the job lasts, under `prlimit --nproc=512`;
  afterwards every process of that user is frozen (SIGSTOP, so a fork bomb can't refill the pids the
  kills free) and killed, its `/tmp` files removed, the home wiped and the folder handed back to the
  API's user, and only then does the API hear "done". A slot whose user still has a process that won't
  die is **retired** (logged at error level, `/health` counts it) and tried again every 30 s; it is
  never handed to the next player while that is so. A job's output lines are cut at 64 KB and the
  stream read up to 50 MB. The prompt reaches run.mjs as `--prompt-file <home>/prompt.txt` (mode
  0600), never in argv: `/proc/<pid>/cmdline` is readable by the other jobs' users. It holds no
  secrets (it refuses to start if one is in its environment), runs with only the Linux capabilities
  that switching users needs, and its network is internal: no internet; it reaches the api container
  alone, i.e. the key proxy and the REST API, whose routes need a sign-in token (the share pages'
  `GET /public/*` aside).

The production guards (`src/env.ts`, `assertSafeConfig`): the API refuses to start with
`NODE_ENV=production` unless `AGENT_AUTH=api`, `RUNNER_SOCKET` and `GAMES_PUBLISH=r2` are set, or if
it finds a Claude login (`CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`,
`ANTHROPIC_AUTH_TOKEN`, a `.claude/.credentials.json`, or an `sk-ant-oat…` token as the API key), or
`DEV_AUTH` or `AGENT_FAKE` (a fake-run server would charge credits for demo builds). Tried one by
one on 2026-10-17 (it even found the login file on Luka's PC); `deploy.mjs api` also stops unless the
live `/health` says `agent: "api"`.

**How a run reaches the model without the key.** Each run gets a token (`tp-run-…`) as
`ANTHROPIC_API_KEY` and the proxy as `ANTHROPIC_BASE_URL` (the Agent SDK's hosting guide: "set
`ANTHROPIC_BASE_URL` to route model calls through a proxy that injects the key outside the container").
The proxy swaps in our key. A token works only while its run lasts (≤ 45 min), only for
`POST /v1/messages` (+ `count_tokens`), only for the run's model family plus Haiku, at most 4 calls at
once and 1,000 in all. Tested with the real Claude Code binary against a mock Anthropic: it needs only
`POST /v1/messages`, and only our key reached upstream.

**Metering.** The proxy reads the `usage` of every answer it relays (a JSON answer's `usage`; a
stream's `message_start` and `message_delta` events, cache fields included; it asks upstream for
uncompressed answers so it can) and prices it per family with `src/credits/prices.ts` (CLAUDE.md's
table; Haiku ×5 above 100K input tokens in one call). The charge is the larger of what run.mjs reports
and this count, so model calls the agent's shell makes on its own are paid for too; the count is
stored as `Message.meteredUsd`. This exists only where the proxy runs, i.e. the live server: on Luka's
PC the agent runs on the Max login and never goes through the proxy, so `meteredUsd` is null there.
`npm run test:proxy` proves it against a mock.

**What this protects against:**
- The agent (a player's prompt, or a prompt injection) reading our secrets: the database URL, R2 keys,
  Supabase key and Anthropic key are not in the runner container at all, in no variable, file or process.
- Stealing the API key: the agent only ever has its run token, which dies with the run.
- Reading or changing other players' games: a job's user owns only its own folder; the projects folder
  can't be listed; every other folder belongs to the API's user, mode 700. The check's hidden browser
  takes its DevTools commands over a pipe (`--remote-debugging-pipe`, fds 3 and 4), not a localhost
  port, and its file server answers only under a random path (`packages/agent/tools/web.mjs`): all
  jobs share the container's loopback, and a port or a plain path would have let one run drive
  another run's browser or fetch its game.
- Sending data out: the runner has no route to the internet.
- Leftovers between jobs (background processes, temp files, a browser): removed after every job. On
  Linux the browser is started under a watchdog that kills its whole process group the moment its
  check.mjs dies, SIGKILL included; the cross-process browser lock is off in the runner
  (`TYPEPLAY_BROWSER_LOCK=0`: the container caps CPU, and a lock a dead job left in a shared folder
  would be one no other job's user could remove).
- Builds starving the API: the runner is capped at 3 of 4 vCPUs and 5.5 of 8 GB; one job at 512
  processes, one game folder at 512 MB. Inside that cap the checks pin no cores (`TYPEPLAY_SERVER=1`; until 2026-10-27
  they kept a PC's 4 cores "free" and every check shared one vCPU).
- Spending through the proxy on the side: metered and charged (above).
- The Max login reaching the server: the guards above, and `deploy.mjs api` copies only named keys.

**What it does not protect against yet** (next step: a container or a gVisor/Firecracker sandbox per run):
- A Linux kernel bug: all jobs share the server's kernel. An exploit from the agent's shell could become
  root in the runner and then read every game folder (still no secrets: those are in the other container).
- Runs crowding each other: they share the runner's 5.5 GB (the kernel kills game work first), so one
  runaway run can fail another run, but not the API; and a job can fill the disk for as long as it
  runs (no quota on its home).
- A game running code in players' browsers: by design, on its own origin (typeplay.dev).

Locally nothing changes: runs are child processes as before. With `AGENT_AUTH=api` and a key in the
root `.env` the proxy also runs on this PC (127.0.0.1:8787), so the live auth path can be tried here.
`runner.mjs` runs only as root on Linux: in the container, or in WSL for tests (`wsl -u root`).

## Android export (package 7, 2026-10-18)

The spec is `docs/android-export-design.md` (the facts `docs/research/android-export-2026.md`); the contract's
"Android export" block in `packages/shared/src/index.ts` lists the routes. Built here: the server side. The web screens
(§11 of the design) are in `apps/web` (its README, "Export to Android"); the legal line waits for Luka's yes.

**What happens** (`src/android/`): paid plans only (Free: 403 `plan_no_export`), no credits charged.

1. **Setup** `POST /projects/:id/android`: the package name (default `app.typeplay.<slug>_<projectId>`, or the user's own;
   rules in `runner/android-prepare.mjs` `packageNameProblem`: reverse-DNS, lowercase, 3-80 chars, no `com.example.` /
   `com.android.` / `android.` / `com.google.`, unique across TypePlay → 409 `name_taken`), the app name (≤ 30), and the
   **upload key**: the signer runs `keytool -genkeypair` (RSA 2048, 10,000 days, alias `upload`, a 32-letter password
   made here), the keystore comes back as bytes + the certificate's SHA-256 and is stored **sealed** (`crypto.ts`:
   AES-256-GCM under `ANDROID_KEY_MASTER`, the project id as associated data, a key-id byte for rotation) in
   `AndroidKey.blob`. `PATCH` changes the app name, the icon (a square PNG ≥ 512, ≤ 1 MB, base64) and the package name,
   which locks after the first AAB (`packageLockedAt`; then `confirmPackageChange: true`, since a new name is a new app
   on Play).
2. **A build** `POST …/android/builds { format: apk | aab, version? }` (202): the build number is `AndroidApp.versionCode + 1`
   in the same transaction as the row (never reused), the id `<projectId>-a<versionCode>`, the version name
   `<versionN>.<versionCode>`. Guards: one build per game at a time (409 `busy`), not while the game is being changed
   (409), one a minute per game, 10 per game and 30 per user a day (429 `too_many`). The queue is the `queued` rows
   (oldest first; a game with a run going is skipped and tried again every 5 s, dropped as `queue_full` after 30 min);
   a row is claimed (`queued` → `running`) and a Stop on a queued row (`queued` → `cancelled`) are each one conditional
   update on `status = queued`, so a Stop that lands as the queue picks the build up either stops the row or goes to its
   job, never both (before 2026-10-18 the Stop could be overwritten and the build ended `done`);
   `MAX_ANDROID_BUILDS` (1) run at once; a running build **reserves the project** (`RunRegistry` purpose `export`:
   chat, restore, download and delete answer 409 busy with the Android wording; `ProjectSummary.status` is
   `"exporting"`) and counts as two run slots against `MAX_RUNS`.
3. **The job** (`job.ts` → the runner's `android` kind, `runner/runner.mjs`; on this PC the same steps as child
   processes; `ANDROID_FAKE=1` a stub): as the job's throwaway user, `git archive <commit> | tar -x` into a scratch copy
   (committed files only, no hooks), `runner/android-prepare.mjs` (deletes a planted `android/`, strips every Android
   preset the agent may have written and appends the server's own, turns on ETC2/ASTC import, sets the orientation if
   missing, writes `export/.gdignore`, makes the launcher icons with `runner/android-icons.gd` from the picture the API
   passed (the user's PNG, else the game folder's `export/screenshot-start.png`, else the published poster; the
   placeholder set from `deploy/api/android/icons` when none or when Godot can't read it), for AAB copies the Gradle seed
   into the job's home), `godot --import`, `godot [--install-android-build-template] --export-release Android`
   (**unsigned**: `package/signed=false`; AAB through Gradle offline from the copied seed), then the file is copied to the
   game's gdignored `export/android/unsigned-<id>.<ext>`, which the API reads (`files.ts`, ≤ 300 MB) and removes. The job's
   env adds `JAVA_HOME`, `ANDROID_HOME`, `GRADLE_USER_HOME=$HOME/.gradle`, `GRADLE_SEED`, `ANDROID_ICONS`; the runner runs
   one Android job at a time (`MAX_ANDROID_JOBS`), 15 min each (the API kills at `ANDROID_BUILD_TIMEOUT_MIN` = 14), and
   refuses to start with `ANDROID_KEY_*`, `GODOT_ANDROID_KEYSTORE_*` or `SIGNER_*` in its environment: **no key, password
   or socket ever reaches the runner**, and the job body carries only the icon (≤ 1 MB).
4. **Signing** (`signer-client.ts` → `signer/signer.mjs` over `SIGNER_SOCKET` live, `tools.ts` in-process here): the API
   puts the unsigned file in `EXPORTS_DIR/<id>/`, opens the sealed key and sends the bytes + password in the request;
   the signer first **inspects the unsigned file** (`aapt2 dump badging`, `zipalign -c -P 16 4`, the zip's `lib/<abi>/`;
   or `bundletool dump manifest` + `dump config` + every `.so`'s ELF LOAD alignment) and **refuses to sign** one that is
   not what the API asked for (`inspect.ts` `mismatches`: package, version code and name, debuggable, target SDK < 36,
   ABIs other than arm64-v8a, any permission, no 16 KB alignment → the build fails as `mismatch`, logged as a possible
   tamper); then `apksigner sign --ks-pass stdin` (APK) or `jarsigner -storepass:env` (AAB), verifies the signature and
   that its certificate is the game's key (`apksigner verify --print-certs`; `jarsigner -verify` + `keytool -printcert`
   on the signer's block), and writes `signed.<ext>` + `inspect.json`. The keystore is on disk (0600, the signer's tmpfs)
   only while a tool runs.
5. **Stored** (`store.ts`): `ANDROID_STORE=folder` → `data/android/<projectId>/<id>.<ext>` (served by the API);
   `r2` → the private `typeplay-exports` bucket (`android/<projectId>/<id>.<ext>`; read back through a presigned link, see
   Downloads; with `ANDROID_FAKE=1` the bucket is a folder, `data/android/_r2/`, so the e2e runs these paths without R2). The row gets
   `path`, `bytes`, `sha256`, `checks` (inspect.json), `expiresAt` = +30 days; the hourly sweep deletes expired files and
   marks the rows `expired`. Every transition is written, then emitted on the project's event stream as
   `{ type: "android", build }` (no new SSE plumbing; the Android page refetches `GET /projects/:id/android`).
6. **Downloads**: `GET …/builds/:bid/download` (the signed file, `Content-Disposition` `<slug>-v<versionCode>.<ext>`, APK as
   `application/vnd.android.package-archive`; 410 when expired); `POST …/builds/:bid/link` → a 10-minute no-sign-in URL,
   **always the short `${API_PUBLIC_URL}/android/dl/<token>`** (~80 characters, a 32-byte token; the site draws it as a QR
   code, whose encoder stops at 213 bytes, and a presigned URL is ~450). What opening it does depends on where that build's
   file is (its row's path): in the folder store the API streams it (`Cache-Control: no-store`); in R2 it answers a **302 to a
   presigned GET made at that moment** (`Cache-Control: no-store`, `Referrer-Policy: no-referrer`; the URL lives 5 minutes at
   most and never past the link's own 10: `links.ts` `presignSeconds`; the filename rides in
   `response-content-disposition`), so every visit gets a fresh one. Checked on every opening (`downloadByToken`): the token
   has not run out, it is for that one build, and the build's row is still `done` with the same path (the 30-day sweep or a
   deleted game can take the file within the link's ten minutes: 404). Links live in memory (see "Left for later");
   `ANDROID_LINK_SECONDS` (only with `ANDROID_FAKE=1`) shortens the life for the e2e's expired-token case.
   `GET …/android/icon` → the app's icon picture as `image/png`, owner only (404 for another user or before setup): the
   PNG the user uploaded, else the start-screen picture a build would use as the launcher icon's source (the game folder's
   `export/screenshot-start.png`, then the published poster; uncropped, Godot crops it at build time), 404 when neither;
   `Cache-Control: private, max-age=300`, `Vary: Authorization`, `nosniff`. The site fetches it with the sign-in header and
   shows it from an object URL (the "This app" card, so an uploaded icon shows on later visits too).
   `GET …/android/key` → a zip with `<slug>-upload-key.jks` (PKCS12) + `README.txt` (alias, password, fingerprint, the
   design's plain-English text incl. the Play upload-key reset path), 5 downloads a day, counted on the row.
   `GET /me/export` lists the package, the fingerprint and the builds, never the key; deleting a game cancels its builds
   and removes `data/android/<projectId>/` (or the R2 objects) with the rows (cascade).

**Failure codes** → one sentence each (`FAIL_TEXT` in `android.service.ts`): `toolchain` (ours; logged at error level),
`game` (Godot's script/export errors; the first error line is in the message and appended to
`data/agent-logs/errors.jsonl` as `kind: "android-export"`), `gradle` (anything else from the job), `timeout`,
`mismatch`, `sign`, `store`, `interrupted` (rows left `running`/`signing` by a restart), `queue_full`; `logTail` holds the
last 4 KB of the job's output (full log `data/logs/android-<id>.log`). `/health` gains `android: { enabled, running }`;
`GET /me` gains `features: { android }` (false when the server has no toolchain: the site hides the pill).

**Env keys**: `ANDROID_EXPORT=1` turns it on and then needs a 64-hex `ANDROID_KEY_MASTER` (`node deploy/deploy.mjs android-key`
writes one into the root `.env`; `ANDROID_KEY_MASTER_PREV` for a rotation: the old master, which upload keys open with
until the API's next start seals them again under the new one); live, `SIGNER_SOCKET`
(`/run/typeplay-signer/signer.sock`), `EXPORTS_DIR` (`/exports`, a volume shared with the signer), `MAX_ANDROID_BUILDS`
(1), `ANDROID_BUILD_TIMEOUT_MIN` (14), `ANDROID_STORE` (`folder` | `r2`), `R2_EXPORTS_BUCKET` (`typeplay-exports`),
`API_PUBLIC_URL` (`https://api.typeplay.app`, for the phone links), `ANDROID_TOOLCHAIN` (the fingerprint every build row
records; unset, the api reads the image's `/opt/android/TOOLCHAIN`, e.g. `godot4.7.2+agp8.6.1+gradle8.11.1+bt36.1.0+sdk36+jdk17.0.20.1+bundletool1.18.3`,
**to confirm on the first deploy**; on this PC the rows say `godot4.7.2+local`). On this PC without a signer
socket the same tools run in-process and need `JAVA_HOME`, `ANDROID_HOME` (with `build-tools/`), `BUNDLETOOL_JAR` (and
optionally `ANDROID_BUILD_TOOLS`, `GRADLE_SEED`, `ANDROID_ICONS`); without them `features.android` is false. `ANDROID_FAKE=1`
(refused in production) stubs the job and the signer for the site's development and the e2e. Production refuses
`ANDROID_EXPORT=1` without the master key, the signer socket and the runner socket (`env.ts` `assertAndroidConfig`).

**Disk**: a job's scratch (the game copy, ~1.2 GB seed copy, the Gradle build: ~1.5-2 GB) lives in the job's home and is
wiped with it; the unsigned and signed copies pass through `EXPORTS_DIR/<id>/` (deleted after the build); kept files are
~25 MB each (`data/android/`, 30 days). The image grows by ~2.2 GB (`deploy/README.md`).

**Tests**: `test/android.mjs` (133 checks, pure: the preset writer strips planted Android presets and keeps the others,
the project.godot patch is idempotent and keeps an orientation, the package-name rules and defaults, seal/open with a
flipped byte / wrong project / wrong key / unknown key id, the PNG parser and icon rules, each manifest mismatch kind and
the checks list, the zip reader and ELF alignment, the runner's and compose's secret boundaries, the failure classifier,
and the phone link: its shape (79 characters against a presigned URL's 429 and more), `presignSeconds`, and the service
with a stubbed database and a clock moved by hand: the redirect for an R2 path, a URL cut to what is left of the link's
life, a token refused past its 10 minutes, for another game's row, with the build swept or the game deleted, an unknown
token; and a Stop against the queue: stopped with one conditional update, sent to the job when the queue claimed the row
first, and a row stopped after it was picked up is not started); `test/android-e2e.mjs` (its own API on :3015, `AGENT_FAKE` + `ANDROID_FAKE`: Free 403, setup and its 409s, queued →
running → signing → done on the stream with matching rows and green checks, download, the phone link without sign-in,
the key zip and its counter, the AAB locking the package, a tampered manifest → `mismatch`, a game error → `game`, the
one-a-minute 429, chat during a build → 409, cancel, `/me/export`, an interrupted build failed at the next start, delete
removing rows and files; the icon route: the start-screen picture before an upload, the uploaded PNG byte for byte, 404
for another user, before setup and for an unknown game, 401 signed out, the cache headers; then the API restarted with
`ANDROID_STORE=r2 ANDROID_LINK_SECONDS=4` and a fake bucket and fake R2 keys: a build lands in the fake bucket under an R2
key, its link is the short API link, opening it is a 302 with `no-store` to the right object whose SigV4 signature is
checked against an independent computation, a second opening a second later gets a different, fresh URL, a build stored
in the folder before the switch still streams, after 4 seconds the token is refused (404, no redirect), a build swept
meanwhile is refused, delete clears the fake bucket); and the **WSL toolchain test** `scripts/android-check.sh` (`setup` ~1.3 GB of downloads into
`~/tp-android`, `warm` the Gradle seed with internet, `export` the runner's exact steps on a real game, offline in a
network namespace with only loopback, then `scripts/android-sign-check.mjs` signs and inspects with `dist/android/tools.js`).
**Run 2026-10-18 on td2-haiku**: APK 5 s / AAB 36 s (plus 3 s import, 5 s seed copy), 25.4 MB each, peak RSS 716 / 923 MB,
keygen 0.7 s, sign + inspect 0.9 / 5.8 s, all 8 checks green for both formats, the tamper refusal proven. Found on the
way: Gradle's single-use daemon needs a loopback interface (a namespace with no `lo` fails: the containers have it);
`aapt2` prints `minSdkVersion:` for this template; no "Unable to strip" warning appeared without the NDK.

**Differences from the spec, and what is left**: Temurin JDK 17 tarball instead of Debian's package (self-contained,
copies between stages, the same bits as the WSL test); the migration is `20261021000000_android` (after the billing
one); `AndroidBuild.id` uses the build number as its sequence; the queue skips a busy game instead of blocking behind it;
the checks list comes from `inspect.json` through `checksOf` at read time. Not built: the legal line of §11, the
`admin android rekey` command (the key-id byte is in place), `test/signer.mjs` with a JDK (the WSL sign check covers it),
the e2e cases inside `test/e2e.mjs` (they live in `test/android-e2e.mjs`), the image's self-test on a real Docker (written
in `deploy/api/android/steps.sh`, **to confirm on the first `deploy.mjs api`**), `bundletool dump config` showing
`PAGE_ALIGNMENT_16K` was **confirmed** in WSL (the AAB passed `pageAlign16k`), the R2 store against the real bucket
(`api-setup --yes` creates it): the redirect, the presigned URL's shape and its SigV4 signature are tested here against a
fake bucket; **to confirm on the first deploy**: that R2 accepts the presigned GET, and an upload and a delete. Admin:
`npm run admin -- android builds <projectId>` and `android toolchain`.

## Security review 10-20 (what beta 1 shows the internet)

Read through the code, then tried on an API of its own on this PC: the invite gate on every signed-in route, the routes
without sign-in, ownership on every game route, secrets, the site's redirects and headers.

**Holds, unchanged:**
- **The gate.** The sign-in check is global (`APP_GUARD`) and asks the invite list before the user row is made, so every
  signed-in route (the live-updates stream, downloads, Android, billing, `DELETE /me`) is 403 `invite_only` for an email
  that isn't invited, and no row or credits appear. There are no admin routes over HTTP (the admin is the CLI);
  `ADMIN_EMAILS` is compared lower-cased. Matching: Gmail without dots and +tag (Google can't have two accounts that
  differ only there); a look-alike letter doesn't match. Supabase's own settings (read 10-20 from its public
  `/auth/v1/settings`): Google is the only provider, no anonymous sign-in, email confirmation on (`mailer_autoconfirm`
  false), so nobody can switch their address to an invitee's without that inbox, and Supabase refuses a Google address
  Google hasn't verified. Removing an invite locks the account out at its next request; a live-updates stream already
  open keeps its own game's events until it reconnects (read-only).
- **Ownership**: every game, Android and checkout route goes through the owner check; another user's id is a 404.
- **The address behind the limits** is Cloudflare's `CF-Connecting-IP`, and the firewall takes 80/443 only from
  Cloudflare's ranges (`deploy.mjs` `firewall`). The runner, inside our network, can set the header: hence the per-game caps.
- **Secrets**: none in `/health`, in error answers (an unknown error is one generic sentence; its stack goes to the log),
  in the key proxy's log lines, or in the web bundle (the 10-19 build searched for key prefixes and connection strings:
  none; the Supabase URL and publishable key are public by design).

**Fixed** (each with a test):
1. **The Free kill switch ignored the key proxy's meter** (`runs.service.ts` `aiSpentUsd`). On the live server a Stop, a
   timeout or a crash leaves the agent without its record, so it reports $0 although the model was paid: the $20 a day
   of Free AI (every beta tester is on Free) counted nothing for those, and Stops could spend without limit. Now a run
   counts the larger of what it reported and what the proxy metered. e2e "security review 10-20" (its API on :3033 with
   `AGENT_AUTH=api FAKE_METER=1`, a mock Anthropic): a Stop after one $3.00 call is charged 0 credits, stores $3.00
   metered and adds $3.00 to `FreeSpend`; a build with $0.30 metered is charged 5 credits and adds $0.30, not the
   reported $0.14; only our key reaches the model API.
2. **Reports could fill the database**: one per address and game a day, but addresses are cheap (an IPv6 /48 is 65,536
   /64s; the runner can set the header) and nothing capped a game: up to ~100,000 rows a day, against Supabase Free's
   500 MB. Now 20 open reports per game (`MAX_OPEN_REPORTS`); more are thanked and dropped. e2e "the gallery": 25
   reports from 25 addresses, all 204, 20 kept.
3. **A body over the limit was a 500** ("Something went wrong on our side") **and an error with its stack in the log**, for
   anyone, signed in or not (`common/api-error.ts`): now 413 "That request is too big." The limit was also smaller than
   a 1 MB Android icon as base64 (1.4 MB), so icons over ~750 KB failed: now 1.5 MB (`main.ts`). e2e (1.6 MB signed out:
   413 and no stack in the log; 1.2 MB is read) and `test:android:e2e` (a 1,000,000-byte icon uploads byte for byte;
   1.1 MB gets the icon rule's 400).
4. **An open redirect on the site** (`apps/web/src/lib/safe-next.ts`): `safeNext` let `/<tab>/evil.example` through,
   which a browser reads as `//evil.example`, so `/billing/checkout?back=/%09/evil.example` drew its Back links to another
   site, and sign-in's `?next=` used the same check. Now a control or format character, a space or a backslash is refused
   and the result must resolve on this site. `npm run test:links -w web` (22 cases; the old check fails the tab case).
5. **The tests use the live beta's database** (one Supabase project, root `.env`): the e2e's kill-switch check planted $20
   in today's `FreeSpend` and took it out only if nothing in between failed, so a test that died there would pause Free
   builds for real testers until midnight UTC. Now in `finally`; the cleanup also takes out what the meter added.
6. **The gate's test covers the whole contract now**: every signed-in route in its route list (35: the stream, downloads,
   Android, billing), and a new `@Public()` or a second route of main.ts's own fails it (e2e "the closed beta").

**Not changed** (low while the beta is invite-only; the decisions are in docs/parked.md "For Luka's website review"):
- (Ended 10-25: `npm run dev` and the tests have their own databases on this PC, `docs/environments.md`; an API started
  here no longer marks the live testers' builds interrupted, and test games never reach the live gallery.)
- A Stop or a timeout costs the player nothing ("failures are free") though the AI was paid: Free is capped by the kill
  switch (now counting it), a tester moved to Medium isn't.
- The share page's game frame has no `sandbox`: a game's code (Godot's JavaScriptBridge) can send the share page itself
  to another site after a tap.
- Floods without sign-in reach the 1-vCPU API and the site box: a token whose header says HS256 makes us ask Supabase's
  `/auth/v1/user` (no time limit on that call), and `/play/<id>/preview.png?v=<anything>` draws a picture each time. One
  Cloudflare rate-limiting rule (free plan) would cover them.
- The key proxy doesn't meter a streamed call cut by a Stop (Anthropic bills its input): cents per Stop.
- No cap on live-update streams per user (invited users only). `/health` shows the run count and, with billing on, the
  webhook inbox's counts (no secrets). Unsharing a game stops its share page, but its builds stay at
  `typeplay.dev/builds/<id>-v<n>/` for whoever kept the address.

## Left for later

- A container or VM per run (above). Until then: pin the api container's addresses per network
  (compose `ipam`) and bind the REST API to the web network's address only, so the runner reaches
  nothing but the key proxy.
- **A test for the runner** (nothing checks it before a deploy; it was tried by hand in WSL on
  10-17): `apps/server/test/runner.mjs`, run as root in WSL with a temporary `DATA_DIR`,
  `RUNNER_SOCKET` and `RUNNER_HOMES` and a probe `AGENT_SCRIPT` that prints its environment and tries
  things: only `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY` and `AGENT_AUTH` arrive from the job's env;
  reading `../<another project>` and `/data/agent-logs` fails with EACCES; after the job the folder is
  uid 1000, mode 0700, with no process or `/tmp` file of the slot's uid left; `git push` and an agent
  job with `--dir` are refused (400); a runner started with `DATABASE_URL` set exits 1; a slot whose
  process survives is retired, not reused. **10-18:** a helper started it and was stopped by a safety
  check while writing the probe script. **10-19:** tried once more on Luka's request and stopped again:
  dropped for good here. Instead: an outside security review of the runner's isolation before the paid
  launch (docs/parked.md), with the 10-17 hand check in WSL and the fixes below meanwhile.
  What it found by reading the code was fixed the same day: the runner now refuses `PADDLE_*` in its
  environment (as `deploy/README.md` says); a job whose stdout or stderr passes 50 MB is stopped, not
  left running to its time limit; a runner restart closes every game folder to 0700 again; the prompt
  is moved into its file before the flag checks (a prompt that is exactly `--dir` no longer gets the
  job refused) and an incoming `--prompt-file` is refused; the check's file server
  (`packages/agent/tools/web.mjs`) refuses an encoded `../` outside the build folder.
- Several API processes: move the in-memory run registry (with its mirror of the build queue), the credit holds and
  the event bus to Postgres or Redis (the ledger itself is already safe across processes: the user-row lock; the queue's
  rows are in Postgres already, and its claims are conditional deletes); the Android
  queue's in-memory parts too (the running set, the phone-link tokens, the key-download counter).
- Backups of the API server's `data/` (Hetzner backups, or a nightly copy to R2).
- Paddle: a daily reconciliation job (the verify pull and `admin sync` meanwhile); packs by
  `POST /subscriptions/{id}/charge`. (The billing endpoints and screens are built: payments part 3, 10-18.)
- The privacy policy keeps server logs up to 90 days: nothing prunes `data/logs/` or the live
  `data/agent-logs/*.jsonl` yet (a deleted game's own run logs do go at once).
- The gallery (built 10-18, "The public gallery" above): something that tells Luka of a report (an email, a daily digest)
  instead of `admin gallery reports`; a block that keeps an admin-unshared game from being shared again; the in-memory play
  and report limits move to Redis with several API processes.
- A download zips in memory on the request: fine for today's games (KB to a few MB); stream it if
  games grow toward the 256 MB cap.
