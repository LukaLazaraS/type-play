# Cloudflare: what is set up and why (2026-10-14)

Cloudflare holds both domains: **typeplay.app** (the site, with logins) and **typeplay.dev**
(users' games). They are separate so a game's code can never read the site's login cookies.
Everything below was set up on 2026-10-14 in Luka's account (Lazarashvili02@gmail.com's Account).

## 1. Email: hello@typeplay.app → Luka's Gmail (free)

- **Why:** Paddle wants a contact email on the site; the terms, privacy and refund pages show
  it; beta testers write to it.
- **DNS records added on typeplay.app** (by Email Routing; never delete them):
  - 3 × MX `route1/2/3.mx.cloudflare.net`: mail for typeplay.app goes to Cloudflare.
  - TXT SPF `v=spf1 include:_spf.mx.cloudflare.net ~all`: only Cloudflare may send as typeplay.app (`~all`: others are marked suspicious).
  - TXT DKIM `cf2024-1._domainkey`: signature so forwarded mail isn't marked as spam.
- **Rule:** hello@typeplay.app → Gmail. Catch-all is off: mail to any other address is dropped.
- **Limit:** receive only. Replies go out from the Gmail address. When the app sends its own
  email (logins, receipts) or we reply as hello@, the sending service must be added to the SPF
  record, or those emails land in spam.
- **Check:** Email → Email Routing → Activity log.

## 2. R2 file storage (subscription turned on)

- **What:** Cloudflare's file storage (like Amazon S3), with no fee when players download.
- **Why:** typeplay.dev serves games from R2: the Godot engine files and every game build,
  later every user's preview and share link.
- **Cost:** free up to 10 GB stored, 1M writes and 10M reads a month. Above that:
  $0.015/GB-month, $4.50 per million writes, $0.36 per million reads, charged to the card on file.
- **Will we hit it?** Practically no: the engine is 38 MB (once per Godot version), a game build
  20-36 KB (2D drawn in code). 10 GB ≈ 250,000 games; 1M writes ≈ 300,000 builds a month (≈$20K
  of API first); 10M reads ≈ 2.5M uncached game loads. Past it, cents (100 GB ≈ $1.35/month).
- **Budget alert** "TypePlay usage over $5" (added 2026-10-15): emails Luka's Gmail if R2 usage
  passes $5 in a month. Catches a bug uploading in a loop or abuse, not normal growth.
- **Cancel / watch:** R2 page (usage, budget alert); Manage account → Billing → Subscriptions.
- Bucket `typeplay-games` (made 2026-10-15 by the deploy), served at typeplay.dev (section 6).

## 3. Main API token "typeplay-deploy" → `CLOUDFLARE_API_TOKEN`

A password for our deploy script (not for people). It works only on this account and the two domains:

| Permission | Why |
|---|---|
| Account · Workers R2 Storage · Edit | create the games bucket, connect typeplay.dev to it |
| Zone · DNS · Edit | point typeplay.app at the Hetzner server |
| Zone · Zone Settings · Edit | HTTPS mode "Full (strict)", always-HTTPS |
| Zone · Zone · Read | look up the two domains' IDs |

It can't touch billing, your login, email rules or other tokens. In the R2 token list it shows
as "Admin Read & Write": that's this same token (R2 Edit = full R2 control).
Manage: profile icon → My Profile → API Tokens.

## 4. R2 keys "typeplay-r2-objects" → `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`

- **What:** S3-format keys that upload tools use. Object Read & Write on all buckets: can read,
  write and delete files; can't create or delete buckets or change any setting.
- **Why separate:** the live server only needs to upload game builds, so it gets only these
  weaker keys. If the server were ever broken into, the domains (DNS) stay safe.
- It's an account token (belongs to the account, not your login), which Cloudflare recommends for servers.
- Manage: R2 → Manage API Tokens.

## 5. `CLOUDFLARE_ACCOUNT_ID`

Not a secret: the account's ID, used in API addresses and the R2 address
`https://<account id>.r2.cloudflarestorage.com`.

## Tested

A throwaway bucket `typeplay-keycheck` was created with the main token, one file was written,
read and deleted with the R2 keys, and the bucket was deleted. Nothing is left.

## If something goes wrong

- **A key leaked** (e.g. `.env` shared by mistake): My Profile → API Tokens → typeplay-deploy →
  Roll or Delete; R2 → Manage API Tokens → delete typeplay-r2-objects and make a new one. Put the
  new values in `.env`.
- **Unexpected bill:** R2 page → usage; Billing → Subscriptions.
- **Email stopped arriving:** Email Routing → Settings: all records should be "Locked"; Activity log
  shows what happened to each mail.
- Keys live only in the root `.env` (git-ignored, never committed); later also on the server.

## 6. Live since 2026-10-15 (made by `node deploy/deploy.mjs setup`)

- **typeplay.app DNS:** `A` → 188.245.229.201 and `AAAA` → 2a01:4f8:c016:50af::1 (the Hetzner
  server), `CNAME www` → typeplay.app; all proxied (orange cloud), so visitors see Cloudflare's
  addresses, never the server's. The email records above are untouched.
- **typeplay.dev:** the R2 bucket `typeplay-games` is connected as a custom domain (Cloudflare made
  its DNS record itself, type "R2"). Games load at https://typeplay.dev/play.html?g=robot-runner.
- **SSL/TLS on both domains:** "Full (strict)", minimum TLS 1.2. "Always Use HTTPS" is on for
  typeplay.dev and **must stay off for typeplay.app**: the server renews its certificate over plain
  http (Caddy redirects visitors to HTTPS itself). Both .app and .dev are HTTPS-only in browsers anyway.
- Deploy, server and emergencies: `deploy/README.md`.
