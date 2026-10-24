# Paddle signup: what to enter

For Luka: the live application (Paddle's review) and the sandbox account (the payment code's tests). Checked
2026-10-23 against Paddle's help pages and its developer checklists (Sources). The signup form itself is drawn by
JavaScript and wasn't opened here: if it asks for something not on this sheet, stop and ask.

Order (Luka, 10-23): Paddle first, the Individual Entrepreneur right after Paddle approves, before the first paid
sale. Paddle asks no IE papers: you sign up as an individual under your own name, the name our Terms already use.

## 0. Before you start

- **The site goes live first.** typeplay.app still shows the 10-16 pages ("Pro" and "Studio" plans, no phone,
  Terms of 13 October), and Paddle's automatic review reads the live site the moment you submit the website. Say
  "deploy"; submit the website once Claude has confirmed the new pricing page and the phone in the footer.
- At hand: your passport or ID card, a recent paper with your name and home address (bank statement or utility
  bill, if Sumsub asks), your phone (for a short video, if asked), your password manager.
- **No key or secret ever goes into the chat or a terminal command** (section 2 says where they go).

## 1. Live account (the application)

Sign up at https://login.paddle.com/signup, confirm the email, then **Paddle > Get started > Verify your account**.

| Field | Enter |
|---|---|
| Email | `hello@typeplay.app` (the site's support address; it forwards to your Gmail). Your Gmail works too |
| Password | a new one, saved in your password manager; turn on two-step sign-in if Paddle offers it (parked #4) |
| Your name | Luka Lazarashvili, as on your passport |
| Date of birth, home address | yours (Paddle doesn't publish them; the site shows no address) |
| Business type | **Individual** (sole trader). Not a company: business verification is skipped for individuals |
| Legal name | **Luka Lazarashvili**, exactly as the Terms say: "TypePlay is run by Luka Lazarashvili." |
| Display or trading name, if asked | TypePlay |
| Business address | your home address |
| Country | Georgia |
| Tax ID, if asked | your personal number (11 digits on your ID card) |
| Website | https://typeplay.app |
| What you sell, if a category is asked | Software as a service (SaaS) |
| Description of what you offer | the text below |
| Expected sales, if asked | the truth: new product, no sales yet, launch in November 2026 |
| Payout details | leave for later (section 3) |

Description to paste:

> TypePlay (typeplay.app) is a web service where an AI agent builds a playable game from a written description.
> Users play it in the browser, change it by chatting, and download or export their own project. We sell monthly
> plans (Medium $20, High $50, Ultra $100, Ultra+ $200) that include credits, which are prepaid use of the AI build
> service, plus one-time credit packs ($10 for 40 credits) on paid plans. Credits have no cash value and can't be
> transferred. We don't sell games or in-game items: users own what they make.

In the application, never call credits virtual currency, coins, tokens, a wallet, stored value or gift cards
(Paddle's acceptable-use rules ban "virtual currency or stored value"; credits are prepaid use of a service).

**Website approval:** Paddle > My account > Settings > Website approval > add `typeplay.app` (only it: no
checkout runs on typeplay.dev). What the review looks for, all linked from every page's footer:

| Paddle looks for | Our page |
|---|---|
| What the product is and its features | https://typeplay.app |
| Pricing | https://typeplay.app/pricing |
| Terms naming the seller | https://typeplay.app/terms ("run by Luka Lazarashvili"; Paddle named as merchant of record) |
| Refund policy | https://typeplay.app/refunds |
| Privacy policy | https://typeplay.app/privacy |
| Contact | hello@typeplay.app and +995 598 398 198, in the footer |
| Live over HTTPS | yes |

- If Paddle asks for a test account (the app sits behind Google sign-in and the closed beta): send them a reply
  asking for the Google address they will use; Claude runs `invite add` for it (once the API is live).
- If Paddle asks for an unconditional 14-day refund policy: accept it (`docs/payments-design.md` §14.6).
- Answer every email from Paddle's verification team: a question left unanswered is one of the three reasons
  Paddle gives for a rejection.

**Identity check (Sumsub):** in the dashboard or through a link Paddle emails. Often it passes in the background
from your details; if not, a photo of your passport or ID, a proof of address, and maybe a short selfie video.

**How long:** most domains are approved automatically, otherwise 5-7 business days; identity is usually instant,
otherwise 1-3 business days; the account review takes about 10 minutes once a domain is approved. Done when
Paddle > Get started says the verification is **completed**.

## 2. Sandbox account (no review, no ID)

Sign up at https://sandbox-login.paddle.com/signup with the same details and `hello@typeplay.app` (sandbox emails
reach only addresses on the account's own domain, so the test receipts come to you). Confirm the email. Then:

1. **Paddle > My account > Settings > Authentication > API keys > New**: name `typeplay-api`; expiry 1 year (the
   default is 90 days); permissions **write** for products, prices, customers, transactions, subscriptions,
   adjustments and customer portal sessions (write includes read; the API needs nothing else). Shown once.
2. Same page, **Client-side tokens > New**: name `typeplay-web` (it starts `test_`; public by design).
3. **Paddle > Events > Notifications > New destination**: description `typeplay api sandbox`; type webhook; URL
   `https://api.typeplay.app/webhooks/paddle` for now (a placeholder: the test purchases run on this PC, and when they
   start Claude gives you the tunnel's address to put here instead; edit the URL, the secret stays the same); API
   version 1; usage type "Platform and simulation"; these 11 events:
   `transaction.completed`, `transaction.payment_failed`, `subscription.created`, `subscription.updated`,
   `subscription.activated`, `subscription.past_due`, `subscription.paused`, `subscription.resumed`,
   `subscription.canceled`, `adjustment.created`, `adjustment.updated`. Save; it shows the secret key (`pdl_ntfset_…`).
4. **Paddle > Checkout > Checkout configuration**: default payment link `https://typeplay.app/billing`; where
   offered, discount codes off and saved cards off.
5. **Paddle > My account > Settings > Sales tax**: exclusive of tax. **Settings > Currencies**: balance currency USD.

### Where the keys go, unseen

1. If Windows syncs your clipboard to other devices (Settings > System > Clipboard), turn that off first.
2. Create the root `.env.local` in Notepad (git-ignored; only development on this PC reads it, before everything else,
   so the sandbox keys never reach the tests or the live server):
   `notepad C:\Users\lazar\Desktop\master-project\startups\type-play\.env.local`. Put three lines in it, pasting each
   value with Paddle's Copy button and Ctrl+V, one at a time:
   ```
   PADDLE_ENV=sandbox
   PADDLE_API_KEY=        ← the API key (pdl_sdbx_apikey_…, 69 characters)
   PADDLE_WEBHOOK_SECRET= ← the destination's secret key (pdl_ntfset_…)
   ```
   Not the root `.env`: that file holds the live values, and the tests read it too.
3. Create `apps\web\.env.local` in Notepad (git-ignored) with:
   ```
   NEXT_PUBLIC_PADDLE_ENV=sandbox
   NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=   ← the test_… token
   ```
4. Save both, then clear the clipboard: Win+V > Clear all.
5. Say **"keys in"**. Claude checks them without showing them (it prints only the length and "format OK"):
   ```bash
   node -e "process.loadEnvFile('.env.local');const f={PADDLE_API_KEY:/^pdl_sdbx_apikey_[a-z\d]{26}_[a-zA-Z\d]{22}_[a-zA-Z\d]{3}$/,PADDLE_WEBHOOK_SECRET:/^pdl_ntfset_[a-zA-Z\d]{26}_[a-zA-Z\d]{32}$/};for(const k in f){const v=process.env[k]||'';console.log(k,v?v.length+' chars, '+(f[k].test(v)?'format OK':'FORMAT WRONG'):'missing')}"
   ```
   then runs `npm run paddle:catalog -w @typeplay/server -- --env sandbox` and adds its five `PADDLE_PRICE_*` lines
   to `.env.local` (price ids, not secret).

What follows from that:

- **The keys stay on this PC, in development only.** `.env.local` is read by `npm run dev` and nothing else: not by
  the tests (they use Paddle's stub) and not by `deploy.mjs` (the live server reads only the root `.env`, and runs with
  billing off until Luka says go paid).
- **Test purchases run on this PC** (HQ, 10-25): real sandbox checkouts with Paddle's test cards against this PC's own
  database (`typeplay_dev`, `docs/environments.md`); the webhooks come in through a tunnel that reaches only the
  webhook route (`node apps/server/scripts/webhook-tunnel.mjs`, a second sandbox destination).
- The API key is shown once and lasts a year (it ends a year after the day it is made; Paddle warns 7 days before).
  Lost before it reached `.env.local`: delete it in Paddle and make a new one.

## 3. Later: the payout account (after the IE)

10-24: Paddle approved the live account; Luka enters his personal USD account himself (he says the IE uses the same
account), so what follows is for reference.

Right after Paddle approves: the IE + Small Business Status (parked #2), then the IE's USD business account (TBC or
BOG app) or Payoneer, entered at **Paddle > Business account > Payouts > Payout settings**: the account name as the
bank writes it, SWIFT/BIC and account number or IBAN without spaces or symbols. Paddle pays once a month (the
payout is made on the 1st and sent by the 15th) when the balance is over your threshold ($100 at least). A USD
payout to a Georgian bank goes by SWIFT, $15 a payout, so a higher threshold means fewer fees. A change is
confirmed by Paddle's finance team and must be in a week before the month ends.

Also after approval (Claude, on your word): the live API key, client token and destination (usage type
"Platform" only), the live catalog, the default payment link, `PADDLE_ENV=live`, then `deploy.mjs api` and `site`
(`docs/payments-design.md` §14.7). No live sale before the IE and Small Business Status exist.

## Sources (read 2026-10-23)

- Account verification: https://www.paddle.com/help/start/account-verification/what-is-account-verification
- Domain review: https://www.paddle.com/help/start/account-verification/what-is-domain-verification
- Business verification: https://www.paddle.com/help/start/account-verification/what-is-business-verification
- Identity verification: https://www.paddle.com/help/start/account-verification/what-is-identity-verification
- Go-live checklist (dashboard paths, account setup fields): https://developer.paddle.com/build/go-live-checklist
- Setup checklist: https://developer.paddle.com/build/set-up-checklist/
- Sandbox: https://developer.paddle.com/sdks/sandbox/
- Key permissions ("write permission automatically includes read"): https://developer.paddle.com/api-reference/about/permissions
- Payouts: https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid ;
  https://www.paddle.com/help/manage/get-paid/how-do-i-set-up-my-payout-settings
- Earlier research: `docs/research/paddle-2026.md` (keys, webhooks, sandbox), `docs/payments.md` (what signup asks
  of an individual, Georgia).
