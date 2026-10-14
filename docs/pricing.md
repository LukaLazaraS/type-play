# Pricing: the decision brief (for its own session)

Written 2026-10-14. Luka decides pricing in a separate session; this file holds everything
gathered so far, so that session starts from facts. The full market research with sources is
`docs/research/competitor-pricing.md` (read 2026-10-14 from the live pricing pages).

## What is decided (CLAUDE.md, PLAN.md)

- Tiers sell **credits, never unlimited use** (Lovable's model).
- **Free:** Haiku 5.5 ("Fast") only, a few builds a month, no export, a TypePlay badge.
- **~$20/month:** Sonnet 5.5 ("Smart") by default, Opus 5.5 ("Best") costs more credits.
- **~$50/month:** more credits.
- **The user picks the model per message** (Fast / Smart / Best, effort changeable), with the
  credit cost shown before a build runs. Defaults: new games on Smart, edits on Fast.
- **$20 must buy about $9 of API** (Paddle takes ~$1.50 + ~5%; the rest is margin and the
  free tier). Paddle is the merchant of record; prices in USD, tax added at checkout.

## What is not decided (parked #9, due Mon 10-26, needed by the payment code ~10-27)

- The credit unit: what 1 credit is, how many per plan, what each model costs in credits.
- Free tier mechanics: monthly pool or daily grant, the daily limit, the global daily kill
  switch for free (e.g. $20/day), Google login only.
- Plan names (the site currently says **Maker** $20 and **Studio** $50; drafts).
- A higher tier ($100+), top-up packs and their price, rollover of unused credits.
- Per-message cap: a build is refused when its estimated cost passes the cap.

## Measured costs (packages/agent/RESULTS.md, proof/RESULTS.md; API prices 2026-10-06)

| Action | Model | API cost | Time |
|---|---|---|---|
| New game | Fast (Haiku 5.5) | $0.07-0.12 (two short steps) | 8-12 min |
| New game | Smart (Sonnet 5.5) | $0.16-0.46 | 1.6-9 min |
| New game | Best (Opus 5.5) | $0.82-1.46 (v1 setup) | ~8 min |
| Edit | Fast | $0.003-0.03 | 1-3 min |
| Edit | Smart | ~$0.1-0.6 (v1, resumed session; isolated edits cheaper) | 2-5 min |

A typical game = 1 Smart build + 20 Fast edits ≈ $0.64. One Opus project with 20 edits ≈ $9.50.

**So $9 of API buys:** 19-56 Smart builds, or 300-3,000 Fast edits, or 6-10 Best builds, or
about 14 typical games. Studio at ~$22 of API: about 34 typical games or 15-27 Best builds.

## What the site says today (drafts, change freely)

- Pricing page: Free $0 (a few new games a month on Fast, unlimited play, edits on Fast, badge),
  Maker $20 (credits for about 20 new games or hundreds of edits, marked "estimate"; Smart by
  default; export; no badge; version history), Studio $50 (about 2.5 times Maker's credits,
  "estimate"; buy extra credits any time). FAQ says the exact credit amounts are set before the
  paid beta. Source: `apps/web/src/content/site.ts`, `apps/web/src/app/pricing/page.tsx`.
- Refund policy draft: 14 days for subscriptions if under a quarter of the month's credits
  used; credit packs refundable if unused; EU 14-day withdrawal with the digital-content
  waiver. Source: `apps/web/src/content/legal.ts`.

## The five market findings (details and sources in the research file)

1. **$20 is the entry price** (Replit, Base44, Emergent at $20; Lovable, Bolt $25; v0 $30;
   Rosebud $15). $50 exists at Lovable, Bolt, Base44, Rosebud, Ludo; Replit, v0, Emergent and
   Anything jump from $20-30 to $100-200. Every product but v0 has a **$100 step**.
2. **Free is a daily grant that resets**, never a monthly pool: Lovable 5 build credits a day
   (max 30/month), Base44 5 a day (max 25), Bolt 300K tokens a day, v0 7 messages a day,
   Rosebud 8,000 credits a week. Free always has a badge, no custom domain, no top-ups; export
   or code download is paid everywhere.
3. **Credit norms:** the unit is "credits" (Bolt says tokens). 100 credits for $20-25 is common;
   a small edit 0.5-1 credit, a big change 2-4. Higher tiers scale linearly or with a small
   discount (only Rosebud gives 10x credits for 3.3x price at $50). Top-ups at the plan rate or
   up to 20% above, paid plans only. Six of nine products roll unused credits over 1-2 months.
4. **Model choice is priced through credits** everywhere it exists, with big spreads (v0 50x
   between cheapest and dearest; Rosebud 10x for a premium-model edit; Replit Turbo up to 6x).
   Our Fast/Smart/Best per message matches the market; our Best penalty (3-5x a Smart build) is
   milder than Rosebud's. Only Base44 locks model choice to a tier.
5. **What $20 buys elsewhere:** Lovable about 250 credits (their examples: ~125 landing-page
   builds or ~280 small edits), Base44 100 message credits (25 app-wide changes to 200 simple
   ones), Rosebud 100K + 10K a day (~50 edits or 5 premium edits), Emergent 100 credits where
   a full feature costs "hundreds". Replit's Aug 2026 "Free Mode" (near-unlimited everyday
   work on a cheap model for subscribers) is the closest analogue to our Fast tier.

## Claude's suggestion (an inference, not a decision)

- Keep **$20** as the entry; keep **$50**; plan a **$100** tier (market norm) or a credit ladder.
- **100 credits = $20.** Smart build 2-5 credits (by effort), Fast edit 0.1-0.3, Best build 9-16.
  That keeps $20 at about $9 of API if usage is average. **$50 = 275 credits** (300 is the
  tempting round number, but a fully used 300 spends ~$27 of API against ~$22 budgeted).
- **Free = a daily grant:** e.g. 5 Fast actions a day, capped at ~25 a month, badge, no export;
  cost $1-5 a month per fully active free user, bounded by the daily kill switch.
- **Top-ups** at $0.25 per credit (plan rate) with a cheaper pack at $0.20; paid plans only.
- **Rollover** of unused credits for one month (six of nine competitors do).
- Show the credit price next to the send button every time (already in the product principles).

## Open questions for the session

1. Is "credits" the right word for a 13+ audience, or "builds"?
2. Daily grant vs monthly pool for Free, and the kill switch number.
3. The Best tier: allow on Maker, or lock to Studio (only Base44 locks)?
4. Plan names: Maker / Studio, or something game-like?
5. Effort as a user choice (low/medium/high) or hidden behind the three tiers?
6. What happens at zero credits mid-build (we don't charge refused builds; partial builds?).
