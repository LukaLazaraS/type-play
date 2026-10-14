# Competitor pricing and credit systems: AI app and game builders

Read on 2026-10-14 from the live pricing pages and official docs listed at the end. Every number
below carries its source in brackets; "[3rd party]" marks a number that the vendor's own public
pages did not show and that comes from a third-party page instead. "not published" means the
vendor's pages name the thing but give no number. All prices are USD per month unless stated.

Products: Lovable, Bolt, v0, Replit, Base44, Rosebud AI (games), plus Emergent, Anything
(prompt-to-app), Astrocade and Ludo.ai (games).

TypePlay's plan for reference: Free (Haiku 5.5, 3-5 builds a month, no export, badge), Maker
$20 (Sonnet 5.5 default, Opus 5.5 costs more credits), Studio $50 (more credits). Measured API
cost per job: Smart (Sonnet) build $0.16-0.46, Fast (Haiku) edit $0.003-0.03, Best (Opus) build
$0.82-1.46; $20 should buy about $9 of API after Paddle fees and margin.

---

## 1. Lovable (lovable.dev)

The live pricing page's plan section did not render in a text fetch, so plan data comes from
the official docs, which carry the same prices.

**Plans** [docs: subscription-plans]

| Plan | Monthly | Annual (per month) | Monthly credits | For |
|---|---|---|---|---|
| Free | $0 | | 0 plan credits; 5 build credits a day capped at 30 a month, plus 20 Cloud, 4 AI, 1 connector credit a month | trying it, small projects |
| Pro 100 | $25 | $250/yr ($21) | 100 | individuals |
| Pro 200 | $50 | $500/yr ($42) | 200 | |
| Pro 400 | $100 | $1,000/yr ($84) | 400 | |
| Pro 800 | $200 | $2,000/yr ($167) | 800 | |
| Pro 1,200 | $294 | $2,940/yr | 1,200 | |
| Pro 2,000 | $480 | $4,800/yr | 2,000 | |
| Pro 3,000 to 10,000 | $705 to $2,250 | | 3,000 to 10,000 | |
| Business 100 | $50 | $500/yr | 100 | teams: SSO, roles, security |
| Business 200 to 10,000 | $100 to $4,300 | | 200 to 10,000 | |
| Enterprise | custom | | volume, by contract | |

Per-credit price on Pro: $0.25 up to the 800 tier, then a small discount ($0.245 at 1,200,
$0.225 at 10,000). Business charges $0.50 per credit for the same count, but Lovable says
hosting and AI usage cost fewer credits on Business [docs: credits-and-usage]. Annual billing
is roughly two months free (Pro 100: $250 a year vs $300). All plans allow unlimited
workspace members; plans are priced by credits, not seats [docs: credits-and-usage].

**Credit system** [docs: credits-and-usage]
- Unit: "credit". Build mode is usage-based by task complexity; Plan mode is 1 credit per
  message. Lovable's own examples: "Make the button gray" 0.50, "Remove the footer" 0.90,
  "Add authentication with sign up and login" 1.20, "Build me a landing page, use images"
  1.70-2.00 (the two docs pages give 1.70 and 2.00).
- Daily grant on every plan: 5 build credits a day, reset 00:00 UTC, never roll over. Free is
  capped at 30 a month (so 6 days' worth), Pro and Business are uncapped (about 150 a month).
- Chat mode is "typically a fraction of a credit" with its own daily allowance.
- Rollover: unused monthly plan credits roll over while the subscription is active; monthly
  plan credits expire 2 months after issue (annual: 1 month after the annual period ends).
- Model choice: none exposed to the user; cost scales with the task.
- A long-running message checks in with the user at 20 credits by default.

**Free tier** [docs: subscription-plans, faq]: 5 build credits a day (30 a month), publish to a
lovable.app URL is free on all plans, "Edit with Lovable" badge cannot be removed, no custom
domain, no code editing or download, no top-ups. No stated project limit.

**$25 vs $50 vs higher**: $50 buys exactly 2x the credits of $25 (Pro 200) or the Business
feature set with 100 credits. Non-credit perks are tied to Pro vs Business, not to credit
count: Pro adds custom domains, code edit and download, badge removal, design systems,
roles, email support, rollover, top-ups. Business adds SSO, role-based access, internal
publishing, API, preview-link passwords, security center, priority support.

**Top-ups** [docs: credits-and-usage]: Pro $15 per 50 credits ($0.30 each, 20% above the plan
rate of $0.25); Business $30 per 50 ($0.60 each). Packs from 50 to 10,000; auto top-up with
a default monthly cap of 400 credits. Top-up credits expire 12 months after purchase. Not
available on Free.

**How far it goes**: no official "apps per month" figure. Using Lovable's own examples, the
$25 plan's roughly 250 credits a month (100 plan + 150 daily) covers about 125 landing-page
builds at 2.0 or about 280 small edits at 0.9. [inference from their examples]

---

## 2. Bolt (bolt.new)

**Plans** [bolt.new/pricing; support: billing, tokens]

| Plan | Monthly | Annual (per month) | Tokens a month | For |
|---|---|---|---|---|
| Free | $0 | | 1M a month, 300K a day cap | trying it |
| Pro | $25 | $216/yr ($18) | 10M | individuals |
| Pro 50 | $50 | $540/yr ($45) | 26M | |
| Pro 100 | $100 | $90 [3rd party] | 55M [3rd party] | |
| Pro 200 | named in docs, price and tokens not published | | | |
| Teams | $30 per member | $27 [3rd party] | 10M per member, not pooled [3rd party] | teams |
| Enterprise | custom | | | |

Bolt's own pages disagree on the annual discount: the pricing page says "Save up to 28%",
the billing article says "Annual plans save 10%". The numbers fit both: Pro 10M annual is
$18 (28% off $25), Pro 50 annual is $45 (10% off). Per million tokens: $2.50 on Pro, $1.92 on
Pro 50, $1.82 on Pro 100 [3rd party for Pro 100].

**Token system** [support: tokens]
- Unit: "token". Both input (prompt, files) and output (code) count. Bolt says most usage is
  "syncing your project's file system to the AI: the larger the project, the more tokens used
  per message". No typical tokens-per-message figure is published.
- Free: 300K a day, 1M a month, resets on the 1st, no rollover.
- Paid: no daily cap. Unused tokens roll over and stay valid for two months from the start of
  the billing cycle they were issued in. Cancelling forfeits all rollover tokens.
- Model choice: none exposed on the pricing page.

**Free tier** [support: billing; bolt.new/pricing]: 1M tokens, "Made in Bolt" badge on
published sites, no custom domain, 10 GB bandwidth and 333,333 web requests a month on
bolt.host hosting, 10 MB uploads, public and private projects. Paid removes the badge, adds
custom domains, 100 MB uploads, 1M requests.

**$25 vs $50 vs higher**: 10M → 26M → 55M tokens, so $50 buys 2.6x the tokens of $25 and
$100 buys 5.5x. Nothing but tokens changes between Pro tiers. Teams adds org sharing.

**Top-ups** [support: tokens]: "Reload tokens" only for subscribers on the highest individual
monthly Pro plan or any annual Pro plan. Reloaded tokens do not expire while subscribed.
Price "varies by plan" and is shown in-app only: not published.

---

## 3. v0 (v0.app, Vercel)

**Plans** [v0.app/pricing; v0.app/docs/pricing]

| Plan | Monthly | Credits a month | For |
|---|---|---|---|
| Free | $0 | $5 one-time for new users (older Free accounts keep $5 a month); 7 messages a day | trying it |
| Premium | $20 | $20 | being sunset, closed to new users |
| Plus | $30 per user (page shows $90 struck through) | $30 per user plus $2 a day on login | individuals and small teams |
| Business | $100 per user | $30 per user plus $2 a day on login; training opt-out | teams |
| Enterprise | custom | custom | SSO, RBAC, priority access, SLAs |

The $90 next to Plus is a list-price anchor added in September 2026; the charged price stayed
$30 [3rd party: GitHub issue #193 on whichcodingtools, Vercel community]. No annual price is
shown.

**Credit system** [docs/pricing; pricing page model table]
- Unit: "credits", denominated in dollars. Credits are a prepaid balance; when they hit zero
  "generation pauses".
- Model prices per 1M tokens (input / output): v0 Mini $0.20 / $1.20; v0 Pro $2 / $10; v0 Max
  $5 / $25; v0 Max Fast $10 / $50. Cache read is a tenth of input. The user picks the model;
  the most expensive is 50x the cheapest on input.
- Rollover: unused monthly credits roll over and expire after 65 days. Purchased credits
  expire one year after purchase and need an active paid plan to use.
- The $2 daily login credit on Plus and Business adds up to about $60 a month for a daily
  user, double the plan's base credits. [arithmetic]

**Free tier**: 7 messages a day, $5 one-time, deploy to Vercel, Design Mode, GitHub sync. No
badge is mentioned.

**$30 vs $100**: Business has the same $30 of credits as Plus. The extra $70 buys only
training opt-out by default. Higher usage is bought as extra credits, not a higher tier.

**Top-ups**: Plus and Business can buy extra credits "at any time"; the price is not
published. Since credits are in dollars, par pricing is implied but not stated. [inference]

---

## 4. Replit (replit.com)

Replit changed its model in 2026: Core dropped from $25 to $20 (Feb 2026), Teams was replaced
by Pro at $100 (Feb 2026), and "Free Mode" arrived in Aug 2026: everyday Agent work on
OpenAI's GPT-5.6 Luna that does not spend credits, within a time-boxed allowance
[blog: pro-plan; blog: replit-introduces-free-mode].

**Plans** [replit.com/pricing; docs: help/pricing-and-plans; docs: plans/starter-plan]

| Plan | Monthly | Annual (per month) | Credits a month | For |
|---|---|---|---|---|
| Starter | $0 | | daily Agent allowance up to a monthly cap (amounts not published), limited cloud credits | trying it |
| Core | $20 | $18 (pricing page) or $204/yr = $17 (docs) | $20 "towards more powerful models" | individuals, up to 5 collaborators |
| Pro | $100 | $90 | $100 "towards most powerful models"; tiers $100 to $4,000 | teams, up to 15 builders, 50 viewers |
| Enterprise | custom | | | SSO, single tenant |

Credits are denominated in dollars, 1 credit = $1, and the plan price equals the credits
included (the $20 you pay is the $20 you get to spend). The pricing page shows no Free card;
Starter exists in the docs.

**Credit system** [docs: billing/ai-billing; blog: pro-plan]
- "Effort-based pricing": each completed request is one checkpoint; simple fixes cost less
  than full features, which are bundled into one more expensive checkpoint. Replit publishes
  no rate per checkpoint. (Before June 2025 it was a flat $0.25 per checkpoint [3rd party:
  The Register].) An interactive estimator lives at agent-pricing.replit.app.
- Modes: Free Mode (Luna, no credits, allowance resets every 5 hours with a weekly limit);
  Power and Max modes use credits; Turbo (Pro only) "Requests cost up to 6x more". Third-party
  AI features (Claude, ChatGPT, Gemini) are "billed at the provider's public API rate" from
  your credits.
- Plan Mode is billed too, even when it changes no code.
- Rollover: Core credits do not roll over. Pro credits roll over: the blog says one month, the
  docs say two months.
- Users can set usage alerts and hard budget caps.

**Free tier (Starter)** [docs: plans/starter-plan]: daily Agent allowance, Lite build only
(no Full build, no Plan Mode), one published app that "will automatically go down after 30
days", "Made with Replit" badge, no connectors, no collaborators, Free Mode with daily limits.

**$20 vs $100**: Core gets $20 credits, Free Mode (up to 30 hours of chat and 60 projects a
month), 1 parallel agent, 5 collaborators, unlimited published apps, badge removal, 7-day
database restore. Pro gets $100 credits with rollover, more Free Mode, 10 parallel agents,
Turbo mode, 15 builders, 50 viewers, 28-day database rollback, premium support. There is no
$50 tier.

**Top-ups** [docs: help/pricing-and-plans]: credit packs on Core and Pro: $100 for $100, $290
for $300, $480 for $500, $950 for $1,000 (0 to 5% discount). Not on Starter.

**How far it goes**: no official figure. Replit's own claim: Free Mode lets Core users
"create 30X more than before". Third-party estimates put a full app at $5-20 of credits,
so 1-4 apps on Core's $20 [3rd party, unverified].

---

## 5. Base44 (base44.com, Wix)

**Plans** [base44.com/pricing shows annual prices only; monthly prices from three third-party
pages that agree; credits from docs: Billing-and-plans]

| Plan | Monthly [3rd party] | Annual (per month) | Message credits a month | Integration credits a month | For |
|---|---|---|---|---|---|
| Free | $0 | | 25 (5 a day cap) | 100 | trying it, up to 5 apps |
| Starter | $20 | $16 | 100 | 2,000 | "first apps, personal and early stage" |
| Builder | $50 | $40 | 250 | 10,000 | "more credits, more room to build" |
| Pro | $100 | $80 | 500 | 20,000 | "complex apps" |
| Elite | $200 | $160 | 1,200 (selectable levels per docs) | 50,000 | "builders going all in" |
| Business | not shown | | 2,400 to 5,400 (6 sizes) | 96,000 to 216,000 | teams |
| Enterprise | custom | | custom | custom | SSO, architect |

Per message credit: $0.20 on Starter, Builder and Pro (flat; higher tiers buy more, not
cheaper), $0.167 on Elite. Annual is 20% off.

**Credit system** [docs: Credits]
- Two units: "message credits" (building with the AI) and "integration credits" (your app
  calling built-in services: email, image, LLM, agents).
- Message credit examples: simple visual or text change ~0.5; small feature ~1; complex
  module ~2; large or app-wide change ~3-4; Discuss mode ~0.3; manual visual edits free;
  automatic fixes free on paid plans, charged on Free.
- Model choice: "AI model select" is a Builder-and-up feature; Starter and Free use Automatic
  routing. Base44 says choosing a model manually "is less predictable and can use more
  credits". For in-app agents, relative to Automatic: GPT-6 Luna about the same; Gemini 3.8
  Flash, GLM 5.2, Claude Sonnet 5 several times more; Claude Opus 5.5 and GPT-6.1 Sol many
  times more; GPT-6 Astra and Claude Fable 5.1 the most.
- Rollover: none. Credits reset monthly on the subscription day. Exception: upgrading monthly
  to a higher monthly plan carries unused credits one more cycle. "Bonus credits and top-up
  credits never carry over."
- Free daily cap: 5 message credits a day, resets at the owner's local midnight.

**Free tier**: 25 message credits (5 a day), 100 integration credits, 5 apps, Base44 badge
(removal is listed from Starter up), no custom domain.

**$20 vs $50 vs higher**: Starter → Builder is 2.5x credits for 2.5x price plus model
selection, GitHub integration, backend functions. Pro doubles again and adds beta early
access. Elite adds premium support and a slightly lower credit price. Yearly plans from
Starter up include a free domain for one year.

**Top-ups**: the docs mention "credit top-ups" (they never carry over, and cannot be bought
during a chargeback dispute), but neither the pricing page nor the docs give a price, and a
public feature request on Base44's board asks for a la carte credits as if they did not
exist. Status unclear.

---

## 6. Rosebud AI (rosebud.ai, games)

**Plans** [rosebud.ai/pricing]

| Plan | Monthly | Credits a month | Daily refresh | For |
|---|---|---|---|---|
| Newbie (Free) | $0 | 8,000 a week (in eligible regions) | | remix and play, "quick fun" |
| Indie Dev | $15 | 100,000 | 10,000 a day (a "Back to School bonus") | "aspiring game developers" |
| 10x Dev | $30 | 300,000 | 10,000 a day | "complete commercial control" |
| Pro ("Best value") | $50 | 1,000,000 | 10,000 a day | "serious development workflows" |
| Scale | $100 | 2,000,000 | 10,000 a day | heavy AI use, auto-scaling hosting |

Per 1,000 credits: $0.15 on Indie, $0.10 on 10x, $0.05 on Pro and Scale. Pro gets 10x the
credits of Indie for 3.3x the price. No annual price is shown.

**Credit system** [rosebud.ai/pricing]
- Unit: "credit". Rough costs: edit with Rosie (default AI) ~2,000; edit with a premium model
  ~20,000 (10x); image or sprite animation 200-2,000; sound ~1,000; 360 skybox ~2,000; 3D model
  ~1,000. The editor shows what each turn used.
- Daily refresh credits are used first, reset at midnight PT, capped per billing period, and
  do not stack.
- Rollover: unused monthly credits "roll over once to the next month and then expire" while
  subscribed. Weekly Free credits do not stack.

**Free tier**: 8,000 credits a week (about 4 Rosie edits), hosted on Rosebud, basic asset
generation, remixing on, Rosebud branding, no code download, no Windows export, no commercial
rights.

**$15 vs $30 vs $50 vs $100**: the perks are gated by tier, not by credits: Indie adds private
projects and a code tab; 10x Dev adds commercial rights and removes Rosebud branding (the
page says this allows games that "could go to Steam or the App Store"); Pro adds code download
and Windows export for Steam; Scale adds auto-scaling hosting and top-tier asset generation.

**Top-ups**: "buy a credit top-up from My Plan"; price not published.

**How far it goes**: Indie's 100,000 monthly credits are about 50 Rosie edits or 5 premium
edits; the daily refresh adds 5 Rosie edits a day. Pro's 1,000,000 is about 500 Rosie edits
or 50 premium edits. [arithmetic from their examples]

---

## 7. Emergent (emergent.sh)

**Plans** [emergent.sh/pricing]

| Plan | Monthly | Annual (per month) | Credits a month | For |
|---|---|---|---|---|
| Free | $0 | | 10 | trying it |
| Standard | $20 | $17 | 100 | individuals |
| Pro | $200 | $167 | 750 | 1M context, "Ultra thinking", custom agents, priority support |
| Business | custom | | | RBAC, SSO, shared workspaces |
| Enterprise | custom | | | audit logs, VPC |

Per credit: $0.20 on Standard, $0.267 on Pro. Pro sells capability, not cheaper credits.
There is no $50 or $100 tier.

**Credit system** [docs: how-credits-work-basics]: a small visual tweak costs "a handful of
credits", a full feature with tests and publishing "hundreds". "Maxx mode" uses
"significantly more credits". Plan credits reset each cycle and do not roll over; one-time
credits never expire and are spent last. Publishing is "a flat monthly fee tied to your tier"
(official docs); Emergent's own tutorial and third parties put it at 50 credits a month per
deployed app [3rd party]. Top-up packs: $1 for 5 credits up to $1,000 for 6,000 [3rd party;
not on the official pages read].

**Free tier**: 10 credits a month, which by Emergent's own description does not cover one full
feature.

---

## 8. Anything (createanything.com / anything.com)

**Plans** [docs: account/subscriptions; createanything.com/pricing]

| Plan | Monthly | Annual (per month) | Credits a month | For |
|---|---|---|---|---|
| Free | $0 | | "A paid plan is required to build" | viewing only; third-party reviews from 2026 still describe a 3K-credit free tier [3rd party] |
| Pro 20k | $24 | $19 ($228/yr) | 20,000 | individuals; private projects, App Store publish, custom domains, Stripe and RevenueCat, no branding |
| Max 200k | $239 | $199 | 220,000 | "smartest AI models", browser QA agent, parallel agents, 1M context, priority support |
| Max 300k to 900k | $359 to $1,079 | $299 to $899 | 330,000 to 990,000 | |

Max tiers include a 10% credit bonus. Per 1,000 credits: $1.20 on Pro monthly, $0.95 on Pro
annual, $1.09 on Max 200k monthly. No $50 or $100 web tier (the iOS app lists a "Pro 50k"
at $49 [3rd party: App Store listing]).

**Credit system** [docs: account/credits]: credits per prompt vary with task complexity; no
typical figure. Modes: Fast low, Thinking medium (recommended), Max high. A model switcher
covers Anthropic, OpenAI, Google, Moonshot and open-source models; "Some models are more
capable but cost more credits." Unused monthly credits expire at cycle end (no rollover).
Failed generations can be refunded with a monthly cap.

**Top-ups** ("top-off"): $12 per 10K, $60 per 50K, $120 per 100K, $240 per 200K; never
expire. $1.20 per 1,000, the same as Pro monthly, 26% above Pro annual.

---

## 9. Astrocade (astrocade.com, games)

The site's pricing URL returns 404 and the home page says only "Play Free Online Games or
Create Your Own with AI". Several 2026 roundups verified that creating and playing are free
with no paid consumer tier, no code export, games hosted on Astrocade, and creator payouts
($100 when a game is selected for the main feed) [3rd party]. One older review lists a $9.99
Creator and $19.99 Pro tier; nothing on the site confirms it. Treat Astrocade as "free, ad
and platform funded", not a credit seller.

---

## 10. Ludo.ai (ludo.ai, game concepts and assets, not full games)

**Plans** [ludo.ai/pricing shows annual; monthly from the page's own meta description and
futurepedia]

| Plan | Monthly | Annual (per month) | Credits | For |
|---|---|---|---|---|
| Free trial | $0 | | 30 credits once | |
| Indie | $20 | $15 ($180/yr) | 3,000 a year upfront ($0.06 each) | 1 seat, 5 projects |
| Pro | $50 | $35 ($420/yr) | 12,000 a year ($0.035) | unlimited image and concept generation, API, MCP |
| Studio | $350 [3rd party] | $300 ($3,600/yr) | 120,000 a year ($0.03) | 10 seats, collaboration |

Credit costs: image 0.5 (unlimited on Pro and Studio), sprite animation 1.5-20, game idea 1.
Unused credits roll over while subscribed. Top-ups from 250 credits at $15 ($0.06) down to
$0.03 per credit at 10,000, on all paid plans, with auto top-up. Ludo gives Pro users
"unlimited" low-compute features and meters only heavy ones (3D, video, prototypes).

---

## Comparison table

Unit price = plan price divided by included monthly units (daily grants excluded unless
noted). Free-tier limits are the main ones.

| Product | Plan | Price a month | Units a month | Unit price | Free tier | Top-up |
|---|---|---|---|---|---|---|
| Lovable | Free | $0 | 5 build credits a day, 30 a month | | badge, no custom domain, no code download, no top-ups | none |
| Lovable | Pro 100 | $25 | 100 credits + 5 a day | $0.25 | | $0.30 per credit |
| Lovable | Pro 200 | $50 | 200 + 5 a day | $0.25 | | $0.30 |
| Lovable | Pro 400 / 800 | $100 / $200 | 400 / 800 | $0.25 | | $0.30 |
| Lovable | Business 100 | $50 | 100 | $0.50 | | $0.60 |
| Bolt | Free | $0 | 1M tokens (300K a day) | | badge, 10 GB, 333K requests, no custom domain | none |
| Bolt | Pro | $25 | 10M tokens | $2.50 per M | | in-app price, eligibility limited |
| Bolt | Pro 50 | $50 | 26M | $1.92 per M | | same |
| Bolt | Pro 100 | $100 | 55M [3rd party] | $1.82 per M | | same |
| Bolt | Teams | $30 per member | 10M per member [3rd party] | | | |
| v0 | Free | $0 | $5 one-time, 7 messages a day | | | none |
| v0 | Plus | $30 per user | $30 + $2 a day on login | $1 = $1 | | price not published |
| v0 | Business | $100 per user | $30 + $2 a day | | | same |
| Replit | Starter | $0 | daily Agent allowance (not published) | | Lite build, 1 app for 30 days, badge | none |
| Replit | Core | $20 | $20 credits + Free Mode | $1 = $1 | | $100 for $100 |
| Replit | Pro | $100 | $100 credits (tiers to $4,000) + more Free Mode | $1 = $1 | | $290 for $300, $950 for $1,000 |
| Base44 | Free | $0 | 25 message credits (5 a day), 100 integration | | 5 apps, badge | unclear |
| Base44 | Starter | $20 ($16 annual) | 100 message, 2,000 integration | $0.20 | | unclear |
| Base44 | Builder | $50 ($40) | 250, 10,000 | $0.20 | | unclear |
| Base44 | Pro | $100 ($80) | 500, 20,000 | $0.20 | | unclear |
| Base44 | Elite | $200 ($160) | 1,200, 50,000 | $0.167 | | unclear |
| Rosebud | Newbie | $0 | 8,000 credits a week | | branding, no export, no commercial rights | none |
| Rosebud | Indie Dev | $15 | 100K + 10K a day | $0.15 per 1K | | in-app, price not published |
| Rosebud | 10x Dev | $30 | 300K + 10K a day | $0.10 per 1K | | same |
| Rosebud | Pro | $50 | 1M + 10K a day | $0.05 per 1K | | same |
| Rosebud | Scale | $100 | 2M + 10K a day | $0.05 per 1K | | same |
| Emergent | Free | $0 | 10 credits | | | none |
| Emergent | Standard | $20 ($17) | 100 | $0.20 | | $0.20 per credit [3rd party] |
| Emergent | Pro | $200 ($167) | 750 | $0.267 | | same |
| Anything | Free | $0 | cannot build | | branding on web apps | none |
| Anything | Pro 20k | $24 ($19) | 20K | $1.20 per 1K | | $1.20 per 1K, never expire |
| Anything | Max 200k | $239 ($199) | 220K | $1.09 per 1K | | same |
| Ludo | Indie | $20 ($15) | 250 (3,000 a year) | $0.06 to $0.08 | 30 credits once | $0.06 per credit |
| Ludo | Pro | $50 ($35) | 1,000 (12,000 a year) | $0.035 to $0.05 | | down to $0.03 |
| Astrocade | | $0 | no paid tier found | | | |

---

## Patterns across products

1. **Entry paid price is $15-30, median $20.** Replit $20, Base44 $20, Emergent $20, Ludo
   $20, Anything $24, Lovable $25, Bolt $25, v0 $30, Rosebud $15. Three vendors (Replit,
   Base44, Emergent) picked exactly $20; two of them (Replit, Base44) cut from $25 to $20
   during 2026.

2. **The next step is $50 for some, $100 for others.** Lovable, Bolt, Base44, Rosebud and
   Ludo sell a $50 tier. Replit, v0, Emergent and Anything jump from $20-30 straight to $100
   or $200. Every product except v0 and Ludo has a $100 tier; Lovable, Base44, Emergent and
   Anything also have a $200 one, and Lovable, Replit and Anything keep going to $1,000+.
   Several (Lovable, Replit Pro, Anything Max, Base44 Elite, Bolt Pro) are credit ladders
   under one plan name, not separate named plans.

3. **The unit is called "credit" everywhere except Bolt ("tokens").** Two vendors (v0,
   Replit) denominate credits in dollars so 1 credit = $1 of model cost at list price. The
   rest use an abstract unit where a small edit costs under 1 credit (Lovable 0.5-0.9,
   Base44 0.5-1) and a bigger change 1-4 credits; Rosebud and Anything use thousands of
   credits per action instead. Base44 splits "message credits" (building) from
   "integration credits" (the app's own runtime AI).

4. **Daily grants are the standard free-tier shape.** Lovable 5 build credits a day capped at
   30 a month, Base44 5 message credits a day capped at 25, Bolt 300K tokens a day, v0 7
   messages a day, Replit a daily Agent allowance, Rosebud 8,000 a week. Nobody gives a
   flat monthly pool on Free. Three vendors also keep a daily grant on paid plans (Lovable 5
   a day uncapped, v0 $2 a day on login, Rosebud 10,000 a day).

5. **Free tiers always carry a badge and block the money features.** Badge or branding on
   Lovable, Bolt, Replit, Base44, Rosebud (until $30), Anything. No custom domain anywhere on
   Free. Code download or export is paid-only on Lovable (Pro), Rosebud (Pro $50), and
   Anything (cannot build at all on Free). Replit limits Free to one published app that goes
   down after 30 days. Top-ups are never sold to Free users.

6. **Model choice is priced through the credit, and the spread is large.** v0 lists token
   prices with a 50x spread between Mini and Max Fast. Rosebud charges 10x for a premium
   model edit (20,000 vs 2,000). Replit's Turbo is "up to 6x more" and third-party models are
   billed at provider API rates. Base44 ranks models from "about the same" to "the most"
   (Claude Opus 5.5 "many times more", Claude Fable 5.1 "the most") and recommends
   Automatic. Anything exposes Fast / Thinking / Max modes plus a model switcher. Base44 is
   the only one that gates model selection to a tier ($50 Builder and up); the others offer
   it on every paid plan. Lovable and Bolt expose no model choice at all.

7. **Higher tiers scale credits linearly or with a small discount, rarely a big one.**
   Linear: Lovable Pro ($0.25 up to 800 credits), Base44 ($0.20 flat to $100), v0 and Replit
   ($1 = $1 at every tier). Mild discount: Bolt ($2.50 → $1.82 per M), Lovable above 800
   (to $0.225), Anything (10% bonus on Max), Replit packs (5% at $1,000), Ludo ($0.06 →
   $0.03). Big discount: Rosebud only (Pro is 10x credits for 3.3x price). Reverse: Emergent
   Pro costs more per credit than Standard and sells capability instead.

8. **Non-credit perks that higher tiers use**, in rough order of how many products use them:
   remove badge (6), custom domain (6), code download or export (Lovable, Rosebud, Anything),
   private projects (Rosebud, Anything, Bolt), collaborators and seats (Replit 5 → 15, Lovable
   unlimited members on all plans, Ludo 1 → 10), parallel agents (Replit 1 → 10, Anything
   Max), faster or stronger agent modes (Replit Turbo, Emergent Ultra thinking and 1M
   context, Anything 1M context), priority or premium support (Replit, Base44 Elite,
   Rosebud, Emergent, Anything Max), early or beta features (Base44 Pro, Lovable Business),
   longer database rollback (Replit 7 → 28 days), commercial rights (Rosebud 10x Dev),
   training opt-out (v0 Business), SSO and audit (all Business and Enterprise tiers).

9. **Rollover is split.** Roll over 1-2 months: Lovable (2), Bolt (2), v0 (65 days), Replit
   Pro (1 or 2), Rosebud (once), Ludo (while subscribed). No rollover: Replit Core, Base44,
   Emergent, Anything. Daily grants never roll over anywhere. Purchased top-ups last 12
   months (Lovable, v0) or never expire (Bolt, Emergent, Anything).

10. **Top-ups cost the plan rate or up to 20% more**, and only paid users can buy them.
    Lovable +20% ($0.30 vs $0.25), Anything at par with monthly Pro, Emergent at par [3rd
    party], Ludo at par, Replit at par to 5% off. Bolt restricts reloads to its top monthly or
    any annual Pro plan. Several vendors offer auto top-up with a monthly cap (Lovable
    default cap 400 credits; Ludo threshold-based).

11. **Nobody publishes "N apps a month".** The closest are Lovable's per-task credit examples,
    Base44's 0.5 to 4 credits per message, Rosebud's ~2,000 credits per edit, Emergent's
    "handful" vs "hundreds", and Replit's marketing "30x more". Credits-go-further claims
    are left to third-party blogs.

12. **Anchoring and strike-through pricing has started.** v0 shows Plus as $30 against a
    struck $90; Replit shows $20 struck to $18 (annual); Anything shows "Save $60".

---

## TypePlay's planned shape against the market

Facts are from the sections above; each suggestion is labeled as inference.

**Matches**
- $20 as the first paid price sits on the market median (fact: Replit, Base44, Emergent at
  $20; Lovable and Bolt at $25). No change needed.
- $50 as the second tier matches Lovable Pro 200, Bolt Pro 50, Base44 Builder, Rosebud Pro and
  Ludo Pro (fact). Rosebud, the closest game-building comparison, labels its $50 tier "Best
  value" and recommends starting there (fact).
- Free with a badge and no export matches every product read (fact: pattern 5). Rosebud
  specifically gates code download and Windows export to $50 and commercial rights to $30
  (fact), so "no export on Free" is market-normal.
- Per-message model choice with better models costing more credits matches v0, Rosebud,
  Replit, Base44 and Anything (fact: pattern 6). Offering it on every paid plan rather than
  gating it matches four of the five (fact); only Base44 gates it to $50.
- Calling the unit "credits" matches eight of nine (fact).

**Misses and suggestions**

1. **Free tier: a monthly pool of 3-5 builds is not the market shape.** Every competitor gives
   a daily grant that resets (fact: pattern 4). Inference: give Free a daily allowance of
   Fast (Haiku) edits plus a monthly cap on builds, for example 1 Fast build a day capped at
   5 a month and 5 Fast edits a day. Cost at measured rates: 5 Haiku builds at $0.07-0.12 plus
   150 Haiku edits at $0.003-0.03 is about $1 to $5 a month per fully active free user, and
   most free users will not use the cap. A daily reset brings people back and is the habit
   competitors have trained.

2. **Credit denomination: make $20 buy a round number.** Lovable, Base44 and Emergent all
   sell 100 credits for $20-25 (fact), and a small edit costs 0.5-1 credit on both Lovable and
   Base44 (fact). Inference: 100 credits for $20, so $0.20 per credit, with $9 of API behind
   the 100 credits, which is $0.09 of API per credit. At measured costs a Smart build would
   then be about 2-5 credits, a Fast edit 0.05-0.3 credit (round to a minimum charge of
   0.1-0.2), a Best build 9-16 credits. Those numbers fall in the same range as Lovable's
   per-task examples, which makes comparison shopping easy and avoids Rosebud-style
   thousands.

3. **$50 should buy more than 2.5x the credits of $20, not just scale.** Facts: Lovable gives
   exactly 2x for 2x; Bolt 2.6x for 2x; Base44 2.5x for 2.5x; Rosebud 10x for 3.3x and calls
   it Best value. Inference: 300 credits for $50 (3x credits for 2.5x price, $0.167 per
   credit) puts Studio between Bolt's and Rosebud's generosity and gives a clear reason to
   upgrade. Margin check [arithmetic]: if a credit keeps the same job prices as Maker ($0.09
   of API behind each), a fully used Studio spends 300 x $0.09 = $27 of API against about $22
   budgeted, so the 3x grant only works if average use stays under about 80% of the pool
   (Lovable, Bolt and Rosebud take this bet); the safe version is 275 credits for $50. Add
   two or three non-credit perks that cost TypePlay little (pattern 8): more
   parallel builds or a priority build queue, longer project history, a Studio-only export
   target (desktop/Steam build, since Rosebud sells Windows export at exactly this tier), and
   early access to new genres. Keep badge removal, custom share page domain and Android export
   on Maker, as every competitor removes the badge at the first paid tier (fact).

4. **Add a $100 tier, or a credit ladder, before launch.** Every product except v0 and Ludo
   has a $100 step and most have a $200 one (fact: pattern 2). Heavy users who finish Studio's
   credits have nowhere to go except top-ups. Inference: a Lovable-style ladder under the
   Studio name (300 credits $50, 650 credits $100, 1,400 credits $200) costs nothing to build
   in Paddle and captures those users; per-credit discounts of 5-10% per step match Bolt and
   Anything.

5. **Top-ups: price at 20-25% above the plan rate, paid plans only, 12-month expiry.** Facts:
   Lovable +20%, Anything and Emergent at par, Replit par to 5% off, top-ups never offered on
   Free, expiry 12 months (Lovable, v0) or never (Bolt, Anything). Inference: $5 for 20 credits
   on Maker ($0.25 each), $10 for 50 on Studio ($0.20 each), auto top-up with a user-set
   monthly cap (Lovable's default cap of 400 credits is a good model). Pricing top-ups slightly
   above the plan rate protects the plan ladder; pricing them at par (Anything) makes the $50
   tier pointless for people who only want credits.

6. **Rollover: one month for paid plans.** Facts: six of nine roll over 1-2 months; those that
   do not (Base44, Emergent, Anything) are criticized for it in third-party reviews. Inference:
   roll unused Maker and Studio credits over once (expire after the following month), daily
   or bonus credits never roll over. This costs little because API spend only happens when
   credits are used, and it removes the main complaint against monthly resets.

7. **Make the cost of a message visible before and after.** Facts: Lovable shows "Credits
   used" per message and checks in at 20 credits; Rosebud's editor shows what each turn used;
   Replit shows checkpoint cost on hover and lets users set hard budget caps. Inference:
   TypePlay's plan already has per-message model choice with "honest tips"; add a running
   credit readout per message and a check-in when a single build passes a threshold (say 10
   credits), because the three vendors that do this are the ones with the fewest "surprise
   bill" complaints in the search results.

8. **Daily grant on paid plans is optional.** Facts: Lovable (5 a day), v0 ($2 a day on
   login) and Rosebud (10,000 a day) do it; Bolt, Replit, Base44, Emergent, Anything do not.
   Inference: skip it at launch; a single monthly pool with rollover is simpler to explain,
   and it can be added later as a retention lever once usage data exists.

---

## Cost reality: what $20 and $50 buy

TypePlay's measured API costs: Smart build $0.16-0.46, Fast edit $0.003-0.03, Best build
$0.82-1.46, and "one Opus project with 20 edits is about $9.50" (CLAUDE.md). $20 buys about
$9 of API after Paddle (about $1.50) and margin. For $50, if the same share goes to API, that
is about $22 of API [inference: Paddle fees scale, margin ratio assumed constant].

**TypePlay Maker, $9 of API**
- Smart builds only: 19 (at $0.46) to 56 (at $0.16).
- Fast edits only: 300 (at $0.03) to 3,000 (at $0.003).
- Best builds only: 6 (at $1.46) to 10 (at $0.82).
- A typical game as one Smart build plus 20 Fast edits at mid costs ($0.31 + $0.33 = $0.64):
  about 14 games a month.
- One Opus project with 20 edits (about $9.50) uses the whole month. A user who picks Best
  for everything gets one project from Maker, which is why the per-message choice and the
  "Smart by default" rule matter.

**TypePlay Studio, about $22 of API** [inference]
- Smart builds only: 48 to 137. Fast edits only: 730 to 7,300. Best builds only: 15 to 27.
- Mixed games at $0.64: about 34 a month. Two full Opus projects with edits.

**What competitors' $20-25 buys in their own units** (their examples, not ours; a Lovable
"landing page" is a far smaller job than a complete playable game, so this is a unit
comparison, not a value comparison)
- Lovable $25: 100 credits plus about 150 daily, so about 250. By Lovable's examples that is
  about 125 "build me a landing page" messages or about 280 small edits, or a mix such as 25
  larger builds (50 credits) and 220 small edits (200 credits). Roughly the same order as
  TypePlay's 14 games with 20 edits each (14 builds, 280 edits).
- Base44 $20: 100 message credits, so 25 app-wide changes (at 4) or 200 simple ones (at 0.5)
  or about 100 small-feature changes (at 1). Fewer messages than TypePlay's $20.
- Replit $20: $20 of effort-based credits, no public rate; third-party estimates of $5-20
  per complete app give 1-4 apps [3rd party]. Plus unlimited-feeling Free Mode on a cheaper
  model (30 hours of chat, 60 projects). TypePlay's Fast tier is the equivalent lever.
- Rosebud $15: 100,000 credits plus 10,000 a day, so about 50 Rosie edits from the pool plus
  5 a day, or 5 premium-model edits. Rosebud charges 10x for the premium model; TypePlay's
  Best is about 3-5x Smart on a build ($0.82-1.46 vs $0.16-0.46), a smaller penalty.
- v0 $30: $30 of credits plus up to about $60 of daily login credits, spent at list token
  prices ($2 / $10 per M on v0 Pro). At those rates $30 is about 3M output tokens.
- Bolt $25: 10M tokens, no per-message figure published.
- Emergent $20: 100 credits; by Emergent's own words a full feature with tests and publishing
  costs "hundreds", so Standard covers less than one such feature plus hosting.
- Anything $24: 20,000 credits, no per-message figure published.

**What competitors' $50 buys**
- Lovable Pro 200: 200 credits plus daily, 2x Pro 100. Lovable Business 100: 100 credits plus
  team features.
- Bolt Pro 50: 26M tokens, 2.6x.
- Base44 Builder: 250 message credits (2.5x) plus model selection, GitHub, backend functions.
- Rosebud Pro: 1,000,000 credits, about 500 Rosie edits or 50 premium edits, plus code download
  and Windows export. 10x Indie's credits.
- Ludo Pro: 1,000 credits a month plus unlimited low-compute generation.
- Replit, v0, Emergent, Anything: no $50 product; the next step is $100-200.

TypePlay Studio at about 34 mixed games a month (or 15-27 Opus builds) is in the same band
as Rosebud Pro's 50 premium-model edits and well above Base44 Builder's 250 messages. The
difference TypePlay can point to is that each "build" is a complete, exportable game rather
than one edit turn. [inference]

---

## Sources (all read 2026-10-14)

Lovable
- https://lovable.dev/pricing (plan section did not render in text fetch)
- https://docs.lovable.dev/introduction/subscription-plans
- https://docs.lovable.dev/user-guides/messaging-limits (Credits and usage)
- https://docs.lovable.dev/introduction/plans-and-credits
- https://docs.lovable.dev/introduction/faq

Bolt
- https://bolt.new/pricing
- https://support.bolt.new/account-and-subscription/tokens
- https://support.bolt.new/account-and-subscription/billing
- 3rd party: https://toolist.ai/tools/bolt/pricing (prices checked 2026-10-09; Pro 100 tokens, Teams tokens, annual Pro 100 and Teams)

v0
- https://v0.app/pricing
- https://v0.app/docs/pricing
- 3rd party: https://github.com/benjamincanac/whichcodingtools/issues/193 (the $90 anchor), https://community.vercel.com/t/updated-v0-pricing/10612

Replit
- https://replit.com/pricing
- https://replit.com/blog/pro-plan (published 2026-02-24, updated 2026-09-30)
- https://replit.com/blog/replit-introduces-free-mode (2026-08-18)
- https://docs.replit.com/help/pricing-and-plans
- https://docs.replit.com/billing/ai-billing
- https://docs.replit.com/billing/plans/starter-plan
- https://docs.replit.com/billing/plans/replit-core
- https://docs.replit.com/billing/about-usage-based-billing
- 3rd party: https://www.theregister.com/2025/09/18/replit_agent3_pricing/ (old $0.25 checkpoint); https://justinmckelvey.com/blog/replit-pricing (app cost estimates)

Base44
- https://base44.com/pricing (annual prices only)
- https://docs.base44.com/Account-and-billing/Credits
- https://docs.base44.com/Account-and-billing/Billing-and-plans
- https://feedback.base44.com/p/purchase-additional-credits-a-la-carte-for-existing-subscribers
- 3rd party for monthly prices: https://axonbuild.com/blog/base44-pricing/, https://www.banani.co/blog/base44-pricing-and-credits, https://agentsite.ai/blog/base44-pricing

Rosebud AI
- https://rosebud.ai/pricing

Emergent
- https://emergent.sh/pricing
- https://emergent.sh/docs/how-credits-work-basics
- https://emergent.sh/tutorials/how-to-deploy-your-app-on-emergent (50 credits a month per deployed app, via search snippet)
- 3rd party for top-up prices: https://growwithba.com/blog/emergent-sh-pricing-credits-explained-2026, https://www.nocode.mba/articles/emergent-ai-pricing

Anything
- https://www.createanything.com/pricing
- https://www.createanything.com/docs/account/subscriptions
- https://www.createanything.com/docs/account/credits
- 3rd party for the free-tier question: https://vibecoding.app/blog/anything-com-review, https://filipkonecny.com/2026/03/22/anything-cost/

Astrocade
- https://www.astrocade.com/ (pricing page returns 404)
- 3rd party: https://www.taskade.com/blog/ai-game-generators, https://max2dgame.com/compare/best-ai-game-makers.html, https://aichief.com/ai-development-tools/astrocade/

Ludo.ai
- https://ludo.ai/pricing (annual prices; monthly from the page's meta description)
- 3rd party for monthly prices: https://www.futurepedia.io/tool/ludo
