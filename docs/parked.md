# Parked: steps Luka chose to do later

Parked 2026-10-12 so the Godot check comes first: if the core can't be proven, these are
wasted time. Claude reminds Luka at the start of each session (rule in `CLAUDE.md`). Dates are
the latest days that keep the plan on track; move an item to "Done" when finished.

| # | Step | Why it can't slip forever | Do by | Who | Luka's time |
|---|---|---|---|---|---|
| 1 | ~~Pick the name~~ **TypePlay, decided 10-13.** Domains **bought 10-14** (both active on Cloudflare). Left to do: set up **hello@typeplay.app** (Cloudflare Email Routing → Gmail, free) | Landing page, Paddle and the beta all need it; Paddle wants a contact email on the site | Wed 10-14 | Luka | 30 min |
| 2 | **Register as Individual Entrepreneur + Small Business Status**; 1 h with a Georgian accountant. IE can be done online (NAPR video session, ~15 min, 75 GEL same day); SBS on rs.ge counts from the day you apply. Activity code: computer programming (62.01), not consultancy. **Ask the accountant: (a) is a SaaS subscription a "royalty" (20%) or a service (1%)? (b) 18% reverse-charge VAT on the Anthropic API and servers (Tax Code Art. 161, ~8% of revenue): can voluntary VAT registration reclaim it when our sales go abroad through Paddle?** (`docs/payments.md`). A **USD business account** in the TBC / BOG app for Paddle payouts, or Payoneer | Paddle seller name must match our terms; 1% tax instead of 20%; Paddle asks for the payout account at signup | Fri 10-16 | Luka | ~3 h |
| 3 | **Paddle: live account application + sandbox account** (after the landing page is up) | Review takes 3-7 business days and must finish before the payment code (~10-27) | Mon 10-19 | Luka (Claude builds the landing page first) | ~1 h |
| 4 | **Anthropic question**: may the live game agent run on the Agent SDK in our containers, paid by our key? Discuss again, then Luka emails Anthropic sales (Claude drafts) | Decides Agent SDK vs our own loop for the live server | discuss Mon 10-19, answer by Thu 10-22 | Luka + Claude | 20 min |
| 5 | **Line up 5-10 beta testers** (YouTube audience, friends) | Beta 1 starts Fri 10-23 | Tue 10-20 | Luka | 1 h |
| 6 | **Anthropic API account + $50-100 credits**, key into `.env` on the server | Beta runs on the API, not Max | Wed 10-21 | Luka | 15 min |
| 7 | **Pick the server** (CPU, ~€20-50/month; Claude proposes) | Package 5 | Wed 10-21 | Claude proposes, Luka decides | 15 min |
| 8 | Dodo Payments, then Whop: only if Paddle rejects or stalls past ~2 weeks | Fallback | if needed | Luka | 30 min |
| 10 | **Real sound effects** (Luka, 2026-10-13: not urgent, add late, after the web app). Today games generate simple sounds in code; later add a CC0 sound library (e.g. Kenney Interface / Impact Sounds) or generated audio, catalogued for the agent like the 3D models | Better-sounding games | after the web app, before launch (~11-02) | Luka + Claude | 1-2 h |
| 11 | **Supabase account** (free) for the web app's database and login; Claude walks through it | Step 4 (web app) | when step 4 starts | Luka | 5 min |
| 9 | **Credits + quality levels design**: Fast / Smart / Best picker on every tier; credits = real API cost × markup, checked against a per-message cap before running; free allowance (~50 credits), Best locked on free, daily limit, Google login only, global daily kill switch for free (e.g. $20/day). Numbers from the 2×2 edit test and the beta. **Decision brief ready: `docs/pricing.md`** (market research 2026-10-14 in `docs/research/competitor-pricing.md`); Luka discusses it in its own session | Payment code needs it (~10-27) | Mon 10-26 | Luka + Claude | 30 min |
| 14 | **Landing-page games**: the test games on the home page (and the runner in the "say what to change" demo) are proofs, not showcase games; their gameplay is weak. Replace or improve them with polished games made for the landing page (Luka, 2026-10-14). Pipeline is ready: `apps/web/README.md` (games.mjs, posters) | The home page sells on the games | before launch (~11-02), after the web app | Luka + Claude | 1-2 days |
| 15 | **iOS builds without a Mac**: Luka built an iOS game before through a cloud build service with an API (free tier ~20 builds/month; name to recover). Options when iOS export starts: use that service, ask users to connect their own account, or run our own. Also **one-click publishing** via the Google Play Developer API (upload the AAB to a track after the user creates the app once) and App Store Connect API later | iOS export + "publish in one click" (after launch) | when iOS export starts | Luka + Claude | discuss 30 min |
| 12 | **Accounts for the web app** (besides Supabase, #11): Cloudflare (DNS, R2 for previews), Google Cloud OAuth client for "Sign in with Google". Claude walks through each; keys go into `.env`. Google reviews our name/logo for its sign-in screen if we want them shown (a few business days) | Web app (package 4) needs login and a database by ~10-21 | Mon 10-19 | Luka (Claude guides) | 30 min |
| 13 | **More domains once TypePlay has users**, if still free: typeplay.ai (~$160 per 2 years), typeplay.games ($26/yr, for public game addresses like cosmic-runner.typeplay.games), typeplay.com ($10,595 resale). Redirect them to typeplay.app | Protects the name once it is public | ~3 months after launch (Feb 2027), or sooner with revenue | Luka | 15 min |

## Done

(nothing yet)
