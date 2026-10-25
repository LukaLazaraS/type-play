# Pricing, credits, refunds and fees: decided

Decided by Luka on 2026-10-16 (parked #9 closed). The analysis behind it: the private page
"What a Game Costs" (https://claude.ai/code/artifact/7354ec85-75d1-484c-b8c6-d47df0647693), the
market research in `docs/research/competitor-pricing.md` (10-14) and
`docs/research/pricing-2026-10-16.md` (10-16: website and app builders re-checked, refunds, Paddle
fees), and the full game-builder analysis in `docs/research/competitors.md`. The site reads every
number from `apps/web/src/content/site.ts` (`plans`, `credits`); legal text in `legal.ts`.

## The plans

Names are game graphics settings (Luka). **Every paid plan has the same AI** (Fast, Smart and
Best on every message); a bigger plan only buys more credits per dollar. The pricing page says
so in its lead and in "Does Ultra make better games?".

| Plan | Price a month | Credits a month | $ per credit | Per dollar vs Medium | Extras |
|---|---|---|---|---|---|
| Free | $0 | 20, at most 5 a day | | | Fast only; play + share link; badge; no export; no packs |
| **Medium** | $20 | 100 | $0.20 | | Fast/Smart/Best, exports as they arrive, no badge, version history, carry-over, packs |
| High | $50 | 275 | $0.182 | +10% | everything in Medium, two builds at once |
| Ultra | $100 | 600 | $0.167 | +20% | everything in High, new genres first |
| Ultra+ | $200 | 1,300 | $0.154 | +30% | everything in Ultra, priority help by email |
| Credit pack | $10 once | 40 | $0.25 | | paid plans only; lasts 12 months |

- **US dollars in every country**, tax added at checkout by Paddle (`tax_mode: "external"`).
  Local currencies later, with rounded prices per country through Paddle's price overrides
  (Claude has charged rupees in India since 2026-07; ChatGPT uses £/€/₹); not before launch.
- **Monthly only until launch.** Yearly plans later, at "2 months free".
- **Unused plan credits carry over one month**, capped at one month's amount, while subscribed.
  Free credits never carry over. Pack credits last 12 months.
- **Spend order:** free daily credits, then the oldest plan credits, then packs.
- **Upgrades** apply at once (Paddle `prorated_immediately`, the extra credits added); downgrades
  at the next renewal.
- **Exports** cost no credits on paid plans (our CPU). iOS, when it comes, is charged in credits
  for the cloud-Mac minutes.

## The credit

**1 credit = $0.06 of AI work** (Anthropic API at list price). It sells for $0.20 on Medium, so
the price of AI to the user is 3.3× its cost. "100 credits for $20" is the market's standard
number (Rork, a0.dev, Base44, Emergent all sell exactly that).

- A message is charged for the work it actually did (tokens × model price ÷ $0.06), rounded up
  to 0.1 credit, minimum 0.1. A bigger game or a longer prompt costs more credits; one credit is
  always the same amount of AI, so no single message can lose money.
- The estimate shows next to the send button before it runs. A message whose estimate passes
  **25 credits** on a paid plan (3 on Free) stops and asks first.
- A build the model refuses costs nothing; a build that fails our check is retried free, and if
  it still fails its credits come back automatically.

Typical cost of one message (measured, `packages/agent/RESULTS.md`; Smart edit is an estimate):

| Message | AI it runs on | Credits, usually (range) | User price on Medium |
|---|---|---|---|
| Fast edit | Haiku 5.5 | 0.3 (0.1-0.5) | $0.06 |
| Fast new game | Haiku 5.5, 2 steps | 1.7 (1.2-2.1) | $0.33 |
| Smart edit | Sonnet 5.5 (estimate) | 1.3 (0.8-2.1) | $0.27 |
| Smart new game | Sonnet 5.5 medium + genre skill | 6.7 (5-8.2) | $1.33 |
| Best edit | Opus 5.5 medium | 3.3 (2.5-4.2) | $0.67 |
| Best new game | Opus 5.5 medium | 17 (13-24) | $3.33 |

**Measured 2026-10-18 with the "look finished" rules and the tower-defence / racer skills**
(`packages/agent/RESULTS.md` "10-17 night", one run each): new games cost 2-3× the table's
rows because they do more. Fast: a small racer 6.3 credits ($0.38), a big tower defence 8.2
($0.49; 4.4 at effort low, same layout), a 10-level match-3 13 ($0.78). Smart: racer 13 ($0.78), big tower defence 18 ($1.08).
Best on the same big prompts: 51-69 ($3.04-4.15). The table's "usually" numbers stay until the
beta measures real prompts; the estimate next to the send button must use the real model and
prompt size, not these averages.

**Measured 2026-10-19: chat edits on big games** (`packages/agent/RESULTS.md` "chat edits on big games": five
Opus-built showcase games of 2,000-2,600 lines, 19 Fast and 4 Smart edits typed like a player, each checked, tested and
measured; 31 runs with the re-runs; every one passed on the first attempt, none rolled back). **Fast edit: median 0.3 credits, range
0.2-1.4** (a number, a look or a small fix 0.2-0.4; a new mechanic, map, level, track or button 0.6-1.4): the table's 0.3
holds, its range 0.1-0.5 does not (8 of 19 cost more). **Smart edit: median 1.75, range 1.0-3.6** (table: 1.3, 0.8-2.1); on the
same four prompts Smart cost 5-6× Fast's credits (7-10× the dollars) for the same result. Edits do not get dearer with the
size of the game; a new mechanic does (the model's thinking, and crossing Haiku's 100K step adds about a third). So "350 Fast
edits" per 100 credits is ~200-230 at the mean (0.44-0.51 credits) and ~250-330 at the median (0.3-0.4), and the Fast range the app shows next to the
send button understates a new mechanic by up to 3×. Nothing above is changed in the table or on the site: the numbers
are Luka's call (parked, "For Luka's website review").

What a plan buys: Medium ≈ 15 Smart new games, 6 Best, or 350 Fast edits (≈ 8 games with 20 edits
each); High ≈ 41 Smart; Ultra ≈ 90; Ultra+ ≈ 195. Free ≈ 12 Fast new games or 70 Fast edits.

**Against the market:** per credit we sit on the market line ($0.20). Per game we are still
below the paid game builders (vendor figures: Jabali $0.67-1, SEELE $1.30-15, Rork $4-8, Tesana
$8-12; real finished-game costs in `competitors.md` are higher still). Per edit we are the
cheapest. Luka chose the $0.06 credit over $0.09 so the price sits mid-market instead of lowest.

## What each plan keeps

Fee and tax model: Paddle 5% + $0.50 on the price **plus** tax (average tax assumed 12%), our 1%
Small Business tax on what Paddle pays out, 18% Georgian reverse-charge VAT on the Anthropic bill
(unless the accountant finds it reclaimable, parked #2). The buyer's own VAT/sales tax is added
on top and paid by Paddle; it is not ours.

| Plan | Paddle fee | Tax | AI + VAT, every credit used | We keep, every credit used | We keep at 60% use |
|---|---|---|---|---|---|
| Medium $20 | $1.62 | $0.18 | $7.08 | **$11.12 (56%)** | $13.95 (70%) |
| High $50 | $3.30 | $0.47 | $19.47 | **$26.76 (54%)** | |
| Ultra $100 | $6.10 | $0.94 | $42.48 | **$50.48 (50%)** | |
| Ultra+ $200 | $11.70 | $1.88 | $92.04 | **$94.38 (47%)** | |
| Pack $10 | $1.06 | $0.09 | $2.83 | **$6.02 (60%)** | |

Not in these numbers: servers (€7-50/month), Supabase ($25/month from launch), payouts (~$15 SWIFT
each to a Georgian bank; Payoneer may be cheaper), refunds (Paddle keeps its fee), chargebacks
($20 each, never returned). Paid users can't push us below zero because every message is charged
at its real cost; only free users and fixed costs can.

## The free plan

20 credits a month, at most 5 a day, Fast only. One account can cost at most **$1.42** a month.
Break-even: a Medium user at 60% use leaves $13.95, so at 3% of free users paying, the average
free account may cost $0.42 (5.9 credits); with 60% light users (1.5 credits), 30% medium (5) and
10% at the cap, the average is 4.4. These shares are assumptions until the beta measures them.
**Kill switch:** free builds stop for the day once free use passes $20 of AI (~280 credits).
Google sign-in only.

## Refunds

**Within 14 days of any payment, for any reason, we refund the credits not yet used** (price ×
unused share of that payment's credits). After 14 days: billing mistakes and legal duties only.
Cancel any time; the plan runs to the end of the paid period. A refund of a plan payment also cancels
the subscription, so nothing renews (Luka, 2026-10-25/26: now for the month's payment, at the period's
end for an upgrade's, never for a pack's); a chargeback, on any payment, cancels it the same way. Text:
`legal.ts` `refunds`.

Why not "no refunds" like Lovable, Bolt, Base44 and Rosebud: they sell through Stripe as the
seller. Paddle, our merchant of record, may refund any buyer within 14 days at its own discretion
and charge it to us (seller terms §10), and EU/UK law gives 14 days anyway. Since the CJEU's
Sky Österreich ruling (C‑234/25, 9 July 2026) a service like ours is a *digital service*, so an
EU buyer can withdraw after using it and pays for what was used. A "no refunds" page would leave
refunds to Paddle's case-by-case calls, risk the review, and push people to chargebacks ($20 each;
Paddle suspends above 0.65%). The unused-share rule is the same as "no refunds" for anyone who
used their credits, and costs us nothing (used credits are paid for).

## Paddle fees (2026)

5% + $0.50 per sale, on the total including tax; no monthly fee; cards, PayPal and subscriptions
the same. Under $10: bespoke pricing (so the pack is $10). Refunds: Paddle keeps its fee.
Chargebacks and pre-chargeback alerts: $20 each. Currency conversion into the payout currency:
mid-market + 2%. Payouts monthly by the 15th, from $100. We receive $18.50 from a $20 US sale,
$18.31 from a German one ($23.80 with VAT), $47.00 from $50, $9.00 from a $10 pack.

## For the payment code (package 7)

- Our own ledger: Paddle sells prepaid credits as one-time products and plans, but keeps no usage
  balance. Every credit grant records its Paddle transaction id, so a refund can be computed per
  payment; the refund is a partial adjustment and its credits are removed.
- Checkout: our own tick box before Paddle opens (EU wording): "Start now: I ask TypePlay to begin
  right away. If I withdraw within 14 days, I pay for the credits I've used. Once all credits from
  this purchase are used, I can no longer withdraw." Store the time and wording version; repeat it
  in the confirmation email.
- Account → Billing links to Paddle's customer portal (cancel; EU "withdraw from contract here").
- A yearly reminder email to every subscriber (California automatic-renewal law); the UK
  subscription rules start in January 2027 (6-monthly reminders).
- Keep a usage log per message, so a Paddle refund review can see what was used.
- Credits wording everywhere: a prepaid allowance for the AI build service; never coins, wallet,
  balance or gifts (Paddle bans selling stored value).

## Still open

- **Support phone number:** Paddle's seller handbook lists "email and phone" under what sellers
  must show; the domain check names only the policies. Luka decides (parked #19).
- The free-plan numbers and the credit value get re-checked with beta data (real conversion,
  real Smart-edit cost). Giving more credits later is easy; taking them away is not.
