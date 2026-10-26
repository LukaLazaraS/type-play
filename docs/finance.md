# Money: what TypePlay costs and earns

Luka's quick reference (HQ, 2026-10-26). The prices, credits and fees come from `docs/pricing.md`, which decides
them; the servers from `deploy/README.md`; Anthropic's caps from platform.claude.com/docs/en/api/rate-limits. When one
of those changes, recompute the tables here.

## The numbers everything is built from

| Number | Value |
|---|---|
| 1 credit | **$0.06 of AI** (Anthropic API at list price) |
| Plans | Free 20 credits (5 a day, Fast only) · Medium $20 = 100 · High $50 = 275 · Ultra $100 = 600 · Ultra+ $200 = 1,300 · Pack $10 = 40 |
| Paddle's fee | 5% + $0.50 per sale, on the price including tax (average tax assumed 12%) |
| Paddle pays out | monthly, by the 15th, for the previous month's sales; from $100 |
| Our tax | 1% Small Business tax on what Paddle pays out (only up to 500,000 GEL a year) |
| VAT on the AI bill | **18%, real.** Today Anthropic adds it at checkout (seen 10-26: $100 of credits = $118, a buyer in Georgia with no Georgian VAT number). Once Luka is an IE, Georgian law makes him pay it on foreign services anyway (reverse charge, `docs/payments.md`). Only VAT registration might let him reclaim it: the accountant's call (parked #2). The tables include it |
| Free plan's safety cap | free builds stop for the day after $20 of AI (`FREE_DAILY_AI_USD`), ~280 credits a day, at most ~$600 a month |
| Max plan API credit | $200 a month of API on the org whose key TypePlay uses (runbook step 4), so the first $200 of each month is covered |

## Fixed costs every month: about $86

| What | Per month |
|---|---|
| Build server, Hetzner CPX32 (`typeplay-api`) | $42.60 |
| Website server, Hetzner CX23 (`typeplay-web`) | ~$8 (€7.10) |
| Supabase (sign-in, database), paid from launch | $25 |
| Backups of the build server (recommended, +20%) | $8.40 |
| Domains ($26 a year) | $2.20 |
| Cloudflare R2, email | $0 at this size |

Once Luka is an IE, the same 18% reverse-charge VAT applies to Hetzner, Supabase and Cloudflare too: about $15 more a
month (`docs/payments.md`).

## Free users

AI cost a month; with 18% VAT in brackets.

| Free users | Realistic (average 4.4 credits each) | Every one uses all 20 credits |
|---|---|---|
| 100 | $26 ($31) | $120 ($142) |
| 1,000 | $264 ($312) | $1,200 ($1,416), but the safety cap stops it at ~$600 ($708) |
| 10,000 | $2,640 ($3,115) | $12,000 ($14,160), capped at ~$600 |

When the cap binds, free users see "free builds paused for today". Raising it is a choice: each +$10 a day is up to
+$300 a month. The 4.4 average is an assumption (60% light users, 30% medium, 10% at the cap) until the beta measures it.

## Paid users

What one buyer leaves us after Paddle, the 1% tax and the AI (with VAT):

| Plan | Price | Paddle fee | 1% tax | AI + VAT, every credit used | **We keep, every credit used** | We keep, 60% used |
|---|---|---|---|---|---|---|
| Medium | $20 | $1.62 | $0.18 | $7.08 | **$11.12** | $13.95 |
| High | $50 | $3.30 | $0.47 | $19.47 | **$26.76** | $34.55 |
| Ultra | $100 | $6.10 | $0.94 | $42.48 | **$50.48** | $67.47 |
| Ultra+ | $200 | $11.70 | $1.88 | $92.04 | **$94.38** | $131.20 |
| Pack | $10 | $1.06 | $0.09 | $2.83 | **$6.02** | $7.15 |

A paid user can never cost more than they paid: every message is charged at its real AI cost.

### Example: 100 Ultra buyers

| | Amount |
|---|---|
| Customers pay | $10,000 (their sales tax on top is Paddle's) |
| Paddle's fee | −$610 |
| **Paddle pays us, by the 15th of next month** | **$9,390** |
| AI, every credit used (60,000 × $0.06) | −$3,600 |
| VAT on the AI bill | −$648 |
| 1% tax | −$94 |
| **We keep** | **$5,048** ($6,747 at 60% use) |

### Example: 100 Medium buyers

Customers pay $2,000; Paddle pays us $1,838; AI $600 + VAT $108; tax $18; **we keep $1,112** ($1,395 at 60% use).

### Example: a mixed month

50 Medium, 20 High, 10 Ultra, 2 Ultra+, 30 packs, 1,000 free users (realistic), fixed costs.

| | Every credit used | 60% used |
|---|---|---|
| Sales | $3,700 | $3,700 |
| Kept from paid users (table above) | $1,965 | $2,540 |
| Free users' AI + VAT | −$312 | −$312 |
| Fixed costs | −$86 | −$86 |
| **Month's profit** | **$1,567** | **$2,142** |
| Anthropic spend that month (no VAT; counts toward the cap) | $1,482 | ~$995 |

**Break-even:** 7 Medium users at 60% use pay the fixed costs; each one also pays for ~45 average free users.

## Cash: the AI is paid before the sales arrive

- The API is paid ahead from the Anthropic credit balance. When the balance hits zero, every build stops.
- Paddle pays November's sales by December 15: up to 6 weeks after a sale.
- **Rule:** keep at least one month of expected AI spend (paid plus free, plus VAT) in Anthropic credits, with
  auto-reload on. The mixed month above needs ~$1,750.
- Refunds come out of Paddle's balance, not our bank.

## Anthropic's monthly spend cap: the risk that stops everything

| Tier | Monthly cap |
|---|---|
| Start | $500 |
| Build | $1,000 |
| Scale | $200,000 |

New accounts may start lower (Evaluation tier). At the cap, **every build stops until the 1st of next month**, even with
money in the balance (HTTP 429 `enforced_spend_limit_reached`). The mixed month above ($1,482) already passes Build, so
TypePlay needs **Scale** before the open launch: platform.claude.com/usage/limits → Request tier increase (parked #24).
See it: the tier and limits at platform.claude.com/usage/limits, the cap, your own limit and the balance at
platform.claude.com/settings/billing, the month's spend at platform.claude.com/usage.

**TypePlay's org on 10-26: Start tier, $500 cap** (the Billing page refuses a limit above $500). The Billing page's
"Spend limits" shows the month's spend as a progress bar, the reset date (the 1st, UTC), and can email at amounts you
set (Add notification: set two, at $250 and $400).

## Costs that come per event

| Event | Cost |
|---|---|
| Refund | Paddle keeps its fee ($1.06-11.70); used credits are never refunded (14-day unused-share rule) |
| Chargeback | The bank takes the payment back, so we never get it, and we pay out of pocket: Paddle's **$20 dispute fee** (charged on every chargeback, win or lose), Paddle's sales fee, and the AI already used. An Ultra used up and then charged back: ~$69 out of pocket ($42.48 AI + VAT, $20, $6.10). **Window: up to 120 days after paying by card** (Visa and Mastercard rules; rare cases longer), 180 days by PayPal. Paid plans have no daily limit, so 600 credits can go in two days. Ours: the subscription is cancelled, the payment's unused credits removed, and the account can't buy again until an admin clears it. Paddle suspends sellers above 0.65% chargebacks |
| Payout to a Georgian bank | ~$15 per SWIFT transfer |
| More builds at once | today 4 builds at a time on one CPX32; another build server is ~$42 a month (billed by the hour) |
| iOS later | Codemagic's free 500 Mac minutes a month, then per minute; charged to users in credits |
