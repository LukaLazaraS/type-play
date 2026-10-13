# Parked: steps Luka chose to do later

Parked 2026-10-12 so the Godot check comes first: if the core can't be proven, these are
wasted time. Claude reminds Luka at the start of each session (rule in `CLAUDE.md`). Dates are
the latest days that keep the plan on track; move an item to "Done" when finished.

| # | Step | Why it can't slip forever | Do by | Who | Luka's time |
|---|---|---|---|---|---|
| 1 | ~~Pick the name~~ **TypePlay, decided 10-13.** Left to do: **buy typeplay.app (site) + typeplay.dev (games) at Cloudflare**, $8.20 each, and set up **hello@typeplay.app** (Cloudflare Email Routing → Gmail, free) | Landing page, Paddle and the beta all need it; Paddle wants a contact email on the site | Wed 10-14 | Luka | 30 min |
| 2 | **Register as Individual Entrepreneur + Small Business Status**; 1 h with a Georgian accountant. Same trip: a **USD bank account** for Paddle payouts (SWIFT), or Payoneer | Paddle seller name must match our terms; 1% tax instead of 20%; Paddle asks for the payout account at signup | Fri 10-16 | Luka | ~3 h |
| 3 | **Paddle: live account application + sandbox account** (after the landing page is up) | Review takes 3-7 business days and must finish before the payment code (~10-27) | Mon 10-19 | Luka (Claude builds the landing page first) | ~1 h |
| 4 | **Anthropic question**: may the live game agent run on the Agent SDK in our containers, paid by our key? Discuss again, then Luka emails Anthropic sales (Claude drafts) | Decides Agent SDK vs our own loop for the live server | discuss Mon 10-19, answer by Thu 10-22 | Luka + Claude | 20 min |
| 5 | **Line up 5-10 beta testers** (YouTube audience, friends) | Beta 1 starts Fri 10-23 | Tue 10-20 | Luka | 1 h |
| 6 | **Anthropic API account + $50-100 credits**, key into `.env` on the server | Beta runs on the API, not Max | Wed 10-21 | Luka | 15 min |
| 7 | **Pick the server** (CPU, ~€20-50/month; Claude proposes) | Package 5 | Wed 10-21 | Claude proposes, Luka decides | 15 min |
| 8 | Dodo Payments, then Whop: only if Paddle rejects or stalls past ~2 weeks | Fallback | if needed | Luka | 30 min |
| 10 | **Real sound effects** (Luka, 2026-10-13: not urgent, add late, after the web app). Today games generate simple sounds in code; later add a CC0 sound library (e.g. Kenney Interface / Impact Sounds) or generated audio, catalogued for the agent like the 3D models | Better-sounding games | after the web app, before launch (~11-02) | Luka + Claude | 1-2 h |
| 11 | **Supabase account** (free) for the web app's database and login; Claude walks through it | Step 4 (web app) | when step 4 starts | Luka | 5 min |
| 9 | **Credits + quality levels design**: Fast / Smart / Best picker on every tier; credits = real API cost × markup, checked against a per-message cap before running; free allowance (~50 credits), Best locked on free, daily limit, Google login only, global daily kill switch for free (e.g. $20/day). Numbers from the 2×2 edit test and the beta | Payment code needs it (~10-27) | Mon 10-26 | Luka + Claude | 30 min |
| 12 | **Accounts for the web app** (besides Supabase, #11): Cloudflare (DNS, R2 for previews), Google Cloud OAuth client for "Sign in with Google". Claude walks through each; keys go into `.env`. Google reviews our name/logo for its sign-in screen if we want them shown (a few business days) | Web app (package 4) needs login and a database by ~10-21 | Mon 10-19 | Luka (Claude guides) | 30 min |
| 13 | **More domains once TypePlay has users**, if still free: typeplay.ai (~$160 per 2 years), typeplay.games ($26/yr, for public game addresses like cosmic-runner.typeplay.games), typeplay.com ($10,595 resale). Redirect them to typeplay.app | Protects the name once it is public | ~3 months after launch (Feb 2027), or sooner with revenue | Luka | 15 min |

## Done

(nothing yet)
