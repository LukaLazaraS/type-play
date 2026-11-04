# Night 2026-11-04, session signin-name: Google sign-in shows the Supabase address

Started by HQ for Luka (asleep), 2026-11-04 08:35 local. No questions, no hourly reminder, no shutdown. Branch
`signin-name` from `night-features` (497ef08), worktree `.claude/worktrees/signin-name`. Commit and push the branch;
HQ merges. No deploy, no merge, no account touched, nothing bought. Tonight's decisions stay in this log, not in
`CLAUDE.md` / `PLAN.md` as rules. Stay out of `.claude/worktrees/attach`, `update-bar`, `ux-fixes`, `night-perf`.

## The task (HQ's words, short)

Players see `bensbaqrtdcamxvcugek.supabase.co` instead of TypePlay when they sign in with Google (Luka's screenshot
`_HQ/data/relay/type-play-ux/screens/2026-11-04-google-email-supabase-name.png`: Google's security email "You're
receiving this email because you used Sign in with Google to sign in to bensbaqrtdcamxvcugek.supabase.co").

1. Every place a player sees the Supabase address in Google sign-in (account chooser, consent screen, security email,
   connected-apps list, address bar during the redirect), from current official docs, with sources.
2. Per option: what it changes in each place, cost, Google review time, what needs Luka's Google Cloud / Supabase
   account. Known: consent-screen branding + brand verification; Google's own button / One Tap on typeplay.app with
   Supabase `signInWithIdToken`; Supabase custom domain (paid add-on). Check these, look for others.
3. Pick the standard fix; build what needs no money and no account change, on the branch, behind a switch that is off
   until Luka has done his part (off = exactly today's sign-in). Security: nonce, origin checks, token verified by
   Supabase as today, nothing secret in the frontend. Tests for both switch positions.
4. Luka's steps field by field in docs (docs/launch or the runbook) and in the reply, shortest path first.

## Checklist

- [x] Worktree `signin-name` from `night-features` (+ `npm ci` in it, 30 s)
- [x] Read the sign-in code (web session, callback, API token check) and docs
- [x] Research with sources: where the address shows, each option (official docs)
- [x] Pick the fix, design the switch
- [x] Build it (web only; the API needs no change), switch off = today's sign-in
- [x] Tests: `apps/web/scripts/shot-signin.mjs`, all three values, 35/35 (run 3); `npm run check` 5/5 packages
- [x] UI review pass: impeccable detector (nothing), critique/audit by hand (3 fixes: inert while busy, 280px label,
      colour comment), emil-design-eng (reduced motion keeps the opacity fade), phones 390 and 280 in the walk-through
- [x] Docs: `docs/launch/google-sign-in-name.md` (places, options, build, Luka's steps, sources), `docs/auth.md`,
      `apps/web/README.md`, `docs/parked.md` row 28 + a privacy row in the website review, the 120px logo
- [ ] Independent security read of the new code (agent), fixes if any
- [ ] Commit + push `signin-name`
- [ ] Final reply

## Decisions made on the way

- Night log named `2026-11-04_signin-name.md` (not `_2`): three sessions run tonight, a shared `_2` would collide when
  HQ merges.
- CPU: HQ's `hq-typeplay-features.running` exists, so this night keeps the normal free threads (cpu.mjs, 12 of 16).
- Checked first-hand without logging in (curl, no cookies): Google's page for today's flow says "Sign in to continue to
  bensbaqrtdcamxvcugek.supabase.co"; the same client asked from the typeplay.app origin (how Google's own button asks)
  says "Sign in to continue to typeplay.app", no Supabase mention.
- **The fix built: Google's own button (Google Identity Services) + Supabase `signInWithIdToken`**, behind
  `NEXT_PUBLIC_GOOGLE_BUTTON=1` (build time, like `NEXT_PUBLIC_CLOSED_BETA`; default off = today's redirect). Why: it is
  free, needs no account change to switch on (the client already has `https://typeplay.app` as a JavaScript origin, and
  Supabase's Google provider already lists the web client ID, which is what its id_token grant checks), removes every
  Supabase redirect from the sign-in, and Google's own button follows Google's branding rules (ours, a one-colour G on
  orange, does not; the branding guidelines say verification needs them followed). Brand verification (free, Luka's
  account) then turns "typeplay.app" into "TypePlay" with the logo. The Supabase custom domain ($25 Pro + $10/month) is
  the paid alternative that keeps our own button.
- FedCM on for the button (`use_fedcm_for_button`): Chrome shows its own dialog naming typeplay.app; other browsers get
  Google's popup. No One Tap (an automatic prompt is a new feature; one-line suggestion instead).
- If Google's script can't load (a blocker, offline), the switch-on page falls back to today's button and redirect, so
  nobody is locked out; those visitors see the Supabase page as today. Needs the Supabase redirect URI kept.
- "Use another account" on the closed-beta screen: Google's button at medium size (never personalised with the current
  account, per Google's docs), text "Continue with Google".
- Tests: Google and Supabase can't run here. The walk-through stubs Google's script and Supabase's token endpoint in
  the test browser (the stub checks the nonce the way Supabase's server does: SHA-256 hex of the raw nonce), and the
  stubbed session carries a `dev:` token so the test API (DEV_AUTH=1) answers /me: dev sign-in stands in for Google's
  token, as HQ asked. Nothing in the tests reaches Google or the live Supabase (both blocked in the test browser).

- A third switch value `only` (Google's button, no Supabase redirect where Google's script can't load): for after
  brand verification, if Google refuses the Supabase domain and Luka removes Supabase's callback from Google Cloud;
  without it those visitors would land on Google's redirect_uri_mismatch error page.
- Google refused `http://localhost:3000` tonight ("The given origin is not allowed for the given client ID"): the
  client lists only that, and Google's docs ask for `http://localhost` too. Not to be added to the live client (security
  read: every listed origin may ask for TypePlay tokens); a dev-only client with the test environment instead.
- Independent security read (a second agent, given the code, not my conclusions): no high or medium flaw; 4 low. Fixed:
  the token goes to the pressed button (Google's click_listener), the Supabase provider check is a required step, the
  localhost step moved to a dev-only client, the nonce wording (Supabase keeps no list of used nonces). Left as
  suggestions: the live client's existing localhost:3000 (decided 10-24), the config script's publishable-key check
  (allow-list `sb_publishable_` only; it predates tonight).
- Google's real button was drawn once in the test browser on a page served under `https://typeplay.app` by the test
  browser itself (the real site was never contacted; no account, no click), to measure it: dark 194x40, light 191x32.
  Port 3000 was busy (another process); nothing on it was touched.
- `npm ci` in this worktree (it had no node_modules) and `next typegen` (route types for `tsc`), both local.
- parked.md row number 28 (next free); other sessions tonight may also add a 28: HQ renumbers on merge.

## For Luka

- Say "turn the Google button on" (switch `"1"` + `deploy.mjs site`), then the phone test (docs/launch/google-sign-in-name.md step 1).
- Branding → upload `docs/launch/typeplay-google-logo-120.png` → Verify branding → Publish (step 2).
- Privacy sentence for Google's button (website review table in parked.md).
- Phone test includes the iPhone home-screen app if installed: other projects report Google sign-in failing there (Apple
  opens Google in a separate Safari sheet with its own cookies), likely with today's redirect too; its own task if so.
