# Payments: options checked 2026-10-14

Luka asked for the fastest way to take payments with the least paperwork, including
"blockchain" rails (buyer pays by card, we receive stablecoins, like a crypto card in
reverse). Three research passes plus spot checks of the key claims on official pages.

## Verdict

- **Paddle stays first.** No company needed (no business check for sole traders), most
  domains are auto-approved, manual review 5-7 business days. Its AI page tells AI companies
  to sell prepaid credit packs as one-time products. Fee 5% + 50¢ ($1.50 on $20).
- **There is no one-day "blockchain card checkout" for a $20 consumer subscription.** Every
  card → stablecoin route makes the *buyer* verify their ID (selfie) with an onramp such as
  MoonPay or Guardarian, card issuers often decline crypto purchases or charge them as a cash
  advance, and the seller still owes EU/UK VAT from the first sale.
- **In Georgia it is also illegal for us.** NBG FAQ: a Georgian legal entity or
  **individual entrepreneur "is not authorised to receive payment with a virtual asset(s)
  for the provision of services and/or goods"** (Organic Law on the NBG, Art. 39¹(2), since
  2023). So no crypto into our own wallet and no USDC payouts. Crypto from buyers is only
  possible through a merchant of record that takes the crypto and pays us in USD.
  https://nbg.gov.ge/en/faq/125

## Georgia facts

- **IE registration is online since 9 June 2026**: NAPR "Smart Contract" video session,
  ~15 min, Georgian ID; 75 GEL same day (26 GEL next day). Tax registration is automatic.
  https://www.napr.gov.ge/en/news/147
- **Small Business Status** (1% up to 500,000 GEL/yr) is applied for on rs.ge after the IE
  exists and, since March 2026, applies from the application date (not retroactive). Monthly
  return by the 15th, also for zero months. IT/software isn't on the excluded list.
- **Royalty risk:** the Tax Code counts "income for the right to use … software" as a
  royalty, and royalties are taxed at 20%, outside the 1% regime. Write the terms as a
  game-building *service* paid in credits, not a software licence; ask the accountant
  (unverified how the Revenue Service treats SaaS; an advance ruling is possible).
- **Selling before the IE exists** isn't compliant (registration is mandatory for repeated
  business), and that income is taxed at 20%.
- **Receiving money:** TBC / Bank of Georgia business accounts for an IE open in their apps,
  free. Payoneer works in Georgia. PayPal Georgia can send, receive and withdraw.
- **Selling directly** (PayPal, BOG/TBC acquiring, crypto gateways): we are the seller, so
  EU VAT from the first sale (non-Union OSS) and UK VAT registration from the first sale.
  TBC also holds 10% of foreign-card payments for 6 months.

## Platforms

| Platform | Georgia + individual | Time to live | Fee on $20 | Problem for TypePlay |
|---|---|---|---|---|
| **Paddle** | Yes; wire or Payoneer | Most domains auto-approved, else 5-7 business days (one AI SaaS: 3 rejections, ~3 weeks) | $1.50 | Its rules ban "virtual currency or stored value": credits = prepaid use of the service, non-transferable, no cash value |
| **Dodo** | Yes; bank, SWIFT, Payoneer | 1-3 business days | $1.60 | None: its games ban (#17) is for selling games and in-game items; TypePlay sells an AI service ("SaaS & AI products" is on Dodo's welcome list). Describe it that way in the application |
| **Freemius** | Yes; PayPal, Payoneer, wire, Wise | <24 h claimed, ~5 days with extra review | 3.8% + 50¢ **plus gateway fees** (~$2+) | Costs more; AI products welcome |
| **Whop** | Yes; bank, PayPal | Sell same day, payouts after the ID check | ~$1.70 with tax on | Not a full MoR: collects tax only in the EU, UK and 18 US states, and only if turned on (+2%) |
| **Creem** | Yes; local bank or USDC | 1-2 days | $1.18 | **Generative AI is restricted**: needs a previous processor history (we have none). USDC payouts illegal for us |
| Lemon Squeezy | Georgia not on bank list | — | — | Winding down toward Stripe (no Georgia) |
| Polar | No (Stripe Connect payouts) | — | — | Out |
| Gumroad | PayPal only (unverified) | Same day | $2.50 | 10% + 50¢; no credits support |
| PayPal direct, BOG/TBC | Yes | Days | ~$1.10-1.40 | We owe EU/UK VAT ourselves |
| Card → stablecoin (MoonPay Commerce, NOWPayments, Coinflow, PayRam) | Mixed | 1-2 days | 1.5-5% | Buyer ID check, card declines, VAT stays ours, illegal for a Georgian IE |

Sources: Paddle https://www.paddle.com/help/start/account-verification/what-is-domain-verification,
https://www.paddle.com/help/start/account-verification/what-is-business-verification,
https://developer.paddle.com/get-started/how-paddle-works/ai-companies/,
https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle ·
Dodo https://docs.dodopayments.com/miscellaneous/merchant-acceptance ·
Creem https://docs.creem.io/merchant-of-record/account-reviews/account-reviews ·
Freemius https://freemius.com/pricing/ · Whop https://docs.whop.com/fees ·
Polar https://polar.sh/docs/merchant-of-record/supported-countries ·
Lemon Squeezy https://www.lemonsqueezy.com/blog/2026-update ·
EU OSS https://vat-one-stop-shop.ec.europa.eu/one-stop-shop_en ·
UK https://www.gov.uk/government/publications/vat-notice-7001-should-i-be-registered-for-vat/vat-notice-7001-should-i-be-registered-for-vat

## What signup asks of an individual (checked 2026-10-14)

Neither asks for IE or Small Business Status papers, so the application can go in before the
IE exists. Only a live sale has to wait for IE + SBS (SBS isn't retroactive).

- **Paddle:** business verification "not required for individuals or sole traders". Identity:
  ID + maybe proof of address and a short video (Sumsub), "typically instant", else 1-3
  business days. Domain: live HTTPS site with description, pricing, features, and Terms /
  Refund / Privacy "clearly accessible via navigation"; sole proprietor's legal name in the
  Terms. Most domains auto-approved, else 5-7 business days.
- **Dodo:** "Individual" if "you don't have a company registration or business tax ID". Product
  form (site, description, socials) → ID + selfie (Persona, minutes) → bank account in the
  same name as the ID → review 1-3 business days. Site needs pricing, Terms, Privacy, Refund
  and a monitored support email, and must match the form. Payouts twice a month, $100
  minimum, $5 fee below $1,000, SWIFT fee extra; may hold a reserve.

## Which Georgian structure (checked 2026-10-14)

**Fastest and best for now: IE + Small Business Status.** Tax per year (LLC rows: 50% profit, all paid out):

| Structure | Setup | Tax at 20k / 100k / 300k GEL revenue | Liability | Notes |
|---|---|---|---|---|
| Micro business | same day, rs.ge | 0 (cap 30k GEL) | unlimited | Saves at most 300 GEL vs SBS; sources disagree whether an IE is needed. Skip |
| **IE + SBS** | 1 day, online (NAPR video), 26 GEL (75 same day) | **200 / 1,000 / 3,000** | unlimited (all personal assets) | Monthly return by the 15th, also for zero months. 3% from the month turnover passes 500k; status lost after two years in a row above 500k. No co-founders or shares |
| LLC | 1 day, 200 GEL | 1,925 / 9,625 / 28,875 | limited | 15% on paid-out profit + 5% dividends; annual statements to SARAS |
| LLC + Virtual Zone | +10 working days | 500 / 2,500 / 7,500 | limited | 0% profit tax on IT services sold abroad + 5% dividends; still granted in 2026; one-person LLC OK |

Switch to LLC + Virtual Zone (International Company after 2 years) when: revenue heads past
500k GEL two years running, a co-founder or investor needs shares, a team is hired, or
liability grows. There's no one-step IE → LLC conversion: new LLC, assign code/domain by
contract, ask Paddle to change the legal entity.

- **Activity code:** computer programming (62.01), not consultancy: consulting is excluded
  from SBS.
- **Royalty risk:** a binding Revenue Service ruling costs 5,000 GEL (10,000 from 2027) and
  takes 90 days: get an accountant's written opinion instead, and keep "service / credits"
  wording in terms and invoices.

**Running it unregistered isn't legal and costs more.** Law on Entrepreneurs Art. 8(1):
"Registration of an entrepreneur is mandatory" for repeated, organised activity for profit;
no threshold. Unregistered: GEL 500 fine (Tax Code Art. 273), 20% tax on profit instead of 1%
of turnover (~10,000 vs 1,000 GEL on 100k revenue), and TBC's personal-account terms forbid
business use without the matching status. Undeclared: 5-10% late fines, 0.05%/day interest,
10-50% understatement fines, criminal above GEL 100,000 evaded (Criminal Code Art. 218).
SBS is never retroactive: income before the application date stays at 20%.

**Reverse-charge VAT: a cost bigger than the 1% tax.** Tax Code Art. 161(2)(a): any person
established in Georgia except "a non-entrepreneur natural person" must assess 18% VAT on
services bought from foreign companies, even when not VAT-registered. For us that means the
Anthropic API, servers, Supabase, Cloudflare. With API spend at ~45% of revenue, that's
**~8% of revenue**, more than Paddle's fee. Voluntary VAT registration (allowed with SBS) may
let us reclaim it; whether it can with sales going abroad through Paddle is for the
accountant. Feeds the credit pricing (`docs/pricing.md`).
https://matsne.gov.ge/en/document/view/1043717

## Company abroad? No (checked 2026-10-14)

Luka asked whether a company in Dubai / the US / elsewhere would be faster and make crypto legal.

- **A company run from Tbilisi is a Georgian company for tax.** Tax Code Art. 22(1): a Georgian
  enterprise is one whose "place of business and/or management is based in Georgia"; Art.
  28(3): if a person manages it, the place of management is "the place of residence of the
  managing natural person", also when managed in practice without a formal appointment. Then:
  15% on distributed profit + 5% on dividends, and no 1% regime (Small Business Status is for
  individual entrepreneurs only, Art. 88). On $100k revenue / $50k paid out: **~$9,600 tax vs
  ~$1,000 as IE**. Georgia has no CFC rules; the Revenue Service mostly goes by registration in
  practice, but the law is clear. https://matsne.gov.ge/en/document/view/1043717
- **Not faster.** Days to the first live payment: IE + Paddle ~3-10 business days; US LLC via
  Stripe Atlas ~3-7 days (fastest abroad); UK Ltd 1-3 weeks; Estonia OÜ 8-12 weeks (e-Residency
  card picked up at the Estonian embassy in Tbilisi); Dubai free zone 6-12 weeks plus a trip
  (bank needs Emirates ID).
- **Still needs a merchant of record.** A non-EU company owes EU VAT from the first sale, a
  non-UK one UK VAT from the first sale. Stripe's own MoR (Managed Payments, GA 29 Apr 2026;
  US, UK, EU, not UAE or Georgia) costs ~$2.02 on a $20 EU sale vs Paddle's $1.50.
- **Yearly cost:** US LLC: $100 agent + $300 Delaware tax + Form 5472 / pro forma 1120 ($25k
  penalty if missed). Dubai free zone: AED 5,750-29,000 a year; 9% corporate tax (consumer
  sales don't get the 0% free-zone rate). UK: 19-25% corporation tax.
- **Crypto:** Dubai allows only licensed AED stablecoins for payments (CBUAE PTSR), not USDC.
  A US LLC may take crypto under US law, but run from Tbilisi it is Georgian under Art. 28.
- **When a foreign company makes sense:** raising US venture money (Delaware C-corp), or after
  moving abroad. Not for launch.

## Crypto for buyers (later)

Only through the merchant of record: the buyer pays in crypto, the MoR pays us USD. Never a
crypto gateway paying into our own wallet while we sell as a Georgian IE. Dodo has a
stablecoin checkout for one-time orders (credit packs, not subscriptions) and pays out USD:
https://docs.dodopayments.com/features/payment-methods/stablecoins
