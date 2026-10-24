# Beta 1: go-live and beta day

Beta 1 (PLAN.md package 6): Fri 10-23, 5-10 people, free, invite only, credits given by hand. The steps in order.
**[Luka]** = only Luka can do it (an account, money, a key, a yes). **[Claude]** = Claude Code runs it on Luka's word.
Commands run from the repo root on this PC. Steps 1-6 fit the day before (Thu 10-22); 7-9 are beta day.

**Never run on a real server yet:** `api-setup`, `api-assets` and `api` (the image build, Caddy for api.typeplay.app,
a real Anthropic key), the live app (`NEXT_PUBLIC_APP: "1"`), Google sign-in on typeplay.app, and `docker compose
stop|start` on the API box (Pause). Tested on this PC: the API's e2e (the closed beta and feedback included), the
runner in WSL, the R2 upload, the site's screenshot tests on a local stack (`apps/web/README.md`).

The admin CLI runs on this PC. On the live beta it is `npm run admin:live -w @typeplay/server -- …` (it reads the root
`.env`, the live values, and says "the LIVE database"), so everything below that says `admin` works on the live beta from
here; plain `npm run admin` works on this PC's development database (`docs/environments.md`).

## 1. Decisions and keys [Luka]

1. **Commit + push** (parked row 2): nothing since 10-16 is committed, so today there is no version to go back to
   (Rollback, step 12). One word: "commit".
2. **The Anthropic question** (parked #4, `docs/anthropic-question.md`) is still open: decide whether beta 1 waits for it.
3. **The server:** yes to the CPX32 ($41.99 + $0.60 IPv4 a month, `docs/server-proposal.md`); a CX33 ($9.99) only if
   Hetzner has one in stock (10-23: sold out in fsn1, nbg1 and hel1; the CPX32 is in stock in fsn1).
4. **The Anthropic API key:** platform.claude.com, API keys, create one (an API key: `sk-ant-api…` or the newer
   `sk-ant-usr…`; never a `claude setup-token` one, `sk-ant-oat…`) and paste it into the root `.env` as
   `ANTHROPIC_API_KEY=…`. Buy $50-100 of credits ($40 or more moves the account to tier 2). The Console's usage and
   cost pages are the real bill (step 10). (10-24: an `sk-ant-usr` key in Luka's Individual Org, which has his Max
   plan's $200 monthly API credit; nothing bought.)
5. **Android: on since 10-25** (`ANDROID_EXPORT: "1"` in `deploy/api/compose.yaml`; paid plans only, so beta 1's
   testers on Free don't see it). The master key: `node deploy/deploy.mjs android-key` [Claude] puts it in the root
   `.env`; Luka copies that line into his password manager, from Notepad, not an editor with a chat open (10-25: a
   selection in VS Code went into a chat, so the key was rotated with `android-key --rotate` before it reached the
   server). Off again: `"0"` there, then `deploy.mjs api`.
6. Optional, recommended: try real Google sign-in on this PC first (parked row 7): `npm run dev`, http://localhost:3000.

## 2. The API server [Claude, after Luka's yes]

```bash
node deploy/deploy.mjs api-setup            # prints what it would buy; nothing happens
node deploy/deploy.mjs api-setup --yes      # the CPX32, its firewall, DNS api.typeplay.app (~5 min); a CX33: --type cx33 --yes
```

Then **[Luka]**: Hetzner console, server `typeplay-api`, Backups, enable (+20%): its `data/` holds every game's git repo,
the only state on that box.

## 3. The 3D model library [Claude]

```bash
node deploy/deploy.mjs api-assets --dry     # what it would send (14,163 files, 1.65 GB from E:\3D models)
node deploy/deploy.mjs api-assets           # one stream to the server (~10 min at 20 Mbit/s)
```

## 4. The API [Claude]

```bash
node deploy/deploy.mjs api                  # pack, upload, build on the server, switch, check /health
```

The first build takes 10-15 minutes (Godot, its templates, the Android toolchain, ~2.2 GB). It stops before uploading
if `ANTHROPIC_API_KEY` is missing or is a Claude login (or, once Android is on, without `ANDROID_KEY_MASTER`), and at
the end unless `/health` says `agent: "api"`.

## 5. Read the health check [Claude reads it, Luka sees it]

```bash
node deploy/deploy.mjs status               # the site's pages, then https://api.typeplay.app/health
```

| Field | Must say | If not |
|---|---|---|
| `ok`, `runner` | `true` | `node deploy/deploy.mjs api-ssh "cd /opt/typeplay-api && docker compose ps && docker compose logs --tail 50 api runner signer"` |
| `agent` | `"api"` (our key, through the key proxy) | never `"max"` or `"fake"`: `deploy/api/compose.yaml` (AGENT_AUTH, no AGENT_FAKE) |
| `inviteOnly` | `true` (the closed beta) | `BETA_INVITE_ONLY: "1"` in `deploy/api/compose.yaml`, then `api` |
| `billing.mode` | `"off"` (beta 1 is free) | `PADDLE_ENV: ""` in the same file |
| `android` | `enabled: true` since 10-25 (step 1.5), `running`: builds going | off on purpose: `enabled: false`; else the API's log says why at its start |
| `runs` | a number of builds going (0 now) | |

## 6. The site with the app [Claude, on Luka's "deploy"]

In `deploy/server/compose.yaml` set `NEXT_PUBLIC_APP: "1"` (leave `NEXT_PUBLIC_CLOSED_BETA: "1"`, so the signed-out
/create says it's a closed beta before anyone signs in, and `NEXT_PUBLIC_PADDLE_ENV` empty: the billing pages say "opens
here soon"), then:

```bash
node deploy/deploy.mjs site                 # ~1 min; the old version serves until the new one is built
node deploy/deploy.mjs games                # the game loader on typeplay.dev (still the 10-16 one on 10-23)
```

`games` brings the loader of 10-20 (the Free plan's badge, which testers' games carry, and the "couldn't load" message
the game page shows); it also uploads the 12 showcase candidates and one test build (`apps/games/builds`), linked from
nowhere. The first `site` deploy (this one, or an earlier one with `"0"` for Paddle's review) also publishes every
public-page change since 10-16 and Next.js 16.4.3 (the new plans, "Your game is yours", the support
phone, the privacy lines of 10-18 and 10-19 in `docs/parked.md` "For Luka's website review"). The closed beta is the
API's (step 5 said `inviteOnly: true`); the site needs nothing for it: a signed-in person who isn't invited sees the
closed-beta page on /create, /games and the rest of the app, and the public pages stay as they are.

## 7. Smoke test [Luka, 20 min]

Keep the API's log open: `node deploy/deploy.mjs api-ssh "cd /opt/typeplay-api && docker compose logs -f --tail 50 api"`.

1. https://typeplay.app/create, **Sign in with Google** with lazarashvili02@gmail.com (in `ADMIN_EMAILS`: always gets in,
   no invite needed). If Google says `redirect_uri_mismatch`: `docs/auth.md`.
2. **Build one game on Fast** (a new account is on Free: Fast, about 2 credits; 5-12 minutes on Haiku). The chat shows
   the steps; when it's done, press Play.
3. **On your phone:** sign in at typeplay.app, open the game from Your games, play it.
4. **Share it:** Share, on; open the link in a private window (signed out): it plays.
5. **Send feedback** from More on the game page, then here: `npm run admin:live -w @typeplay/server -- feedback list`, `feedback
   show <id>` (the build link plays the version you saw), `feedback done <id>`.
6. **The closed beta:** sign in with another Google account that isn't invited (a private window): the closed-beta page,
   no credits, and `npm run admin:live -w @typeplay/server -- list` doesn't show that account.
7. `npm run admin:live -w @typeplay/server -- list` (your account and credits) and `-- audit` (says `ok`).

## 8. Invite the testers [Luka, or Claude with Luka's list]

**With a beta code** (Luka, 10-24): one code for a group; each tester signs in with any Google account and types the six
digits on the closed-beta page. A right code lets the account in with the Free plan's 20 credits plus the code's.

```bash
npm run admin:live -w @typeplay/server -- code add --uses 20 --credits 50 "Beta 1"   # prints the code (random six digits)
npm run admin:live -w @typeplay/server -- code list                                 # used of uses, the accounts it let in
npm run admin:live -w @typeplay/server -- code remove <code>                        # it stops working; the accounts stay
```

A code is not a secret like a key, but treat it as a ticket: whoever has it gets in while uses are left. Wrong codes: 5
an hour per account and 50 an hour in all (then the code box waits for the hour; `invite add` still works).

**By address** (as before), for each tester the Google address they will sign in with (for Gmail, dots, capitals and a
+tag don't matter):

```bash
npm run admin:live -w @typeplay/server -- invite add friend@gmail.com "Satisfying Sims viewer"
npm run admin:live -w @typeplay/server -- invite list      # every invite, its first sign-in, the account's plan and credits
```

Then send `docs/beta/invite.md` (and the 3-line post, if you want more testers). After a tester's first sign-in
(`invite list` says "first sign-in"), give credits by hand:

```bash
npm run admin:live -w @typeplay/server -- grant friend@gmail.com 50 "Beta 1"
npm run admin:live -w @typeplay/server -- plan friend@gmail.com medium    # only if they should have Smart and Best
```

**[Luka] decides how much.** 1 credit is at most $0.06 of AI. On Free (Fast only, at most 5 a day): a new game about
1.7 credits, a change about 0.3. `plan … medium` is the plan without a payment: Smart and Best, no daily cap, one build
at a time; a Smart game is about 6.7 credits ($0.40), a Best one about 17 ($1.02). 10 testers with 100 credits each is
at most $60 of AI. `grant` before the first sign-in fails ("no user with email …": the account appears then).
`invite remove <email>` takes someone out: their account stays (games, credits), the app shows the closed-beta page.

## 9. Beta day [Luka]

Send the invitations in the morning, keep the API log open for the first builds, and answer hello@typeplay.app
(it forwards to your Gmail).

## 10. During the beta: what to watch [Luka, once a day]

- **The API log:** `node deploy/deploy.mjs api-ssh "cd /opt/typeplay-api && docker compose logs --since 24h api | grep -E 'ERROR|WARN|feedback|report'"`.
- **/health:** `node deploy/deploy.mjs status` (`runner: true`, builds going, `inviteOnly: true`).
- **Feedback:** `npm run admin:live -w @typeplay/server -- feedback list --open`, then `feedback show <id>` and `feedback done <id>`.
- **Who:** `admin list` (plans, credits, games), `admin invite list` (who hasn't signed in yet), `admin gallery reports`
  (only if testers put games in the gallery).
- **The Free kill switch:** once Free builds have cost $20 of AI in a UTC day, every Free build answers "Free builds are
  paused until 00:00 UTC…" (402 `free_paused`); testers you moved to Medium aren't stopped by it. Today's number, in
  Supabase's SQL editor: `SELECT day, usd FROM "FreeSpend" ORDER BY day DESC LIMIT 7;`
- **The daily AI cost:** the Anthropic Console's usage and cost pages (the real bill). Our own count, in Supabase's SQL
  editor (what the runs reported, and what the key proxy metered from the model's answers):

  ```sql
  SELECT date_trunc('day', "createdAt") AS day, plan, count(*) AS runs,
         round(sum("costUsd"), 2) AS reported_usd, round(sum("meteredUsd"), 2) AS metered_usd
  FROM "Message" WHERE role = 'agent' AND "createdAt" > now() - interval '14 days'
  GROUP BY 1, 2 ORDER BY 1 DESC, 2;
  ```

  (A deleted game's messages leave this count; FreeSpend keeps the Free part.)
- **The API account's credits:** when they run out, builds fail and nobody is charged: top up in the Console.

## 11. Pause the beta

1. **The app off** [Claude, on Luka's word]: `NEXT_PUBLIC_APP: "0"` in `deploy/server/compose.yaml`, then
   `node deploy/deploy.mjs site` (~1 min): the app's pages are gone, the public pages stay.
2. **Builds off too** (an open tab or a saved token could still call the API):
   `node deploy/deploy.mjs api-ssh "cd /opt/typeplay-api && docker compose stop"`. Running builds stop, nobody is
   charged, and at the next start each is marked "interrupted" and its game folder reset. The data stays
   (`/opt/typeplay-api/data`, Supabase). Back on: `node deploy/deploy.mjs api-ssh "cd /opt/typeplay-api && docker compose start"`,
   then the site with `"1"` again. Never run on the real box yet.
3. **One person:** `npm run admin:live -w @typeplay/server -- invite remove <email>`. There is no switch for "everyone out,
   API up": stop the API as in 2.

Opening the app to everyone later is the opposite pair of switches: `BETA_INVITE_ONLY: "0"` in `deploy/api/compose.yaml`
(then `api`) and `NEXT_PUBLIC_CLOSED_BETA: "0"` in `deploy/server/compose.yaml` (then `site`).

## 12. Rollback

- A `site` or `api` whose build fails changes nothing: the running version stays up. `api` also refuses while builds
  run (`--force` stops them; nobody is charged).
- Back to the public site only: Pause, step 1.
- An older version of the code: `deploy.mjs` deploys what is on disk, so it needs a commit to go back to (step 1.1).
  Then `git worktree add ../type-play-rollback <commit>`, copy the root `.env` into it, `npm install` there, and run
  `node deploy/deploy.mjs site` (or `api`) from that folder. The database only moves forward: an older API leaves the
  newer tables (`Invite`, `Feedback`) alone, and nothing removes them. Never tried.

## 13. Go paid [Claude, on Luka's "go paid"]

**Only when both are true** (HQ, 10-25): the Paddle sandbox purchases passed on this PC (`apps/web/README.md` "Plan and
billing"), and Luka has registered the Individual Entrepreneur with Small Business Status (a sale before that is taxed
20%, not 1%). Then billing goes on and stays on, during beta 1 too: there is no paid beta, beta 1 is followed by the
open launch (Luka, 10-25).

**Ready beforehand** (nothing here changes what users see):

- The live API key and the live destination's webhook secret in the root `.env` as `PADDLE_LIVE_API_KEY` and
  `PADDLE_LIVE_WEBHOOK_SECRET`. Never under the plain names there: the tests read that file (`deploy.mjs api` maps them
  for the server, `deploy/README.md` "Paddle").
- The live notification destination: `https://api.typeplay.app/webhooks/paddle`, API version 1, usage "Platform", the 11
  events of `docs/launch/paddle-signup.md`.
- The live catalog (`npm run paddle:catalog -w @typeplay/server -- --env live`) and its five ids as the `PADDLE_PRICE_*`
  lines of `deploy/api/compose.yaml`.
- The live client token (`live_…`, public by design) written down for the switch below.
- Cloudflare: a WAF skip rule for the webhook path (Security > WAF > Custom rules, "Paddle webhooks":
  `(http.host eq "api.typeplay.app" and http.request.uri.path eq "/webhooks/paddle")` → Skip: the remaining custom rules,
  Browser Integrity Check and Security Level). Browser Integrity Check is on for typeplay.app, and Paddle asks for bot
  checks to be skipped on that path. Luka's click, or a token with WAF edit rights.

**The switch:** five lines in three files, then two deploys (about 15 minutes).

1. `deploy/api/compose.yaml`: `PADDLE_ENV: "live"` (from `""`).
2. `deploy/server/compose.yaml`: `NEXT_PUBLIC_PADDLE_ENV: "live"` and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_…"` (both
   together: the site's build refuses a token without its environment).
3. `apps/web/src/content/site.ts`: `seller.form: "Individual Entrepreneur"` and `updated` to that day (the terms and the
   privacy policy name the seller with it).

```bash
node deploy/deploy.mjs api      # refuses a missing key or secret, or a key that isn't live; the API checks the 5 prices at start
node deploy/deploy.mjs site     # the billing pages with live Paddle.js
```

**Checks after:**

- `node deploy/deploy.mjs status`: `/health` says `billing: { mode: "live", ready: true, problem: null }`.
- https://typeplay.app/billing for Luka: the plan picker, not "opens here soon".
- One real purchase: Luka buys Medium with his own card. The checkout completes, 100 credits arrive, and Paddle's receipt
  comes by email. Paddle > Events > Notifications shows the deliveries answered 200; on the server, `docker compose exec
  -T api node dist/admin.js events` shows them processed. Then he cancels the plan on /billing, and the refund goes
  through Paddle (`admin refund <email> last`, run in the api container). Paddle keeps its fee (about $1.50).

**Back off:** the five lines back as they were, then `api` and `site` again. Subscriptions keep running at Paddle; the
webhooks that come while billing is off get 503, and Paddle retries them for 3 days.
