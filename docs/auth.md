# Database and sign-in: Supabase + Google (set up 2026-10-15)

What exists, why, and what to do when something breaks. Keys are only in the root `.env`
(git-ignored); none of them was ever shown on screen or committed.

## 1. Supabase (database + login)

- **Organization "TypePlay"** (Free plan), separate from Luka's older "LukaLazaras" org (its
  paused `petcare` project is untouched). The Pro plan ($25/month, at launch) applies per org.
- **Project `typeplay`**, ref `bensbaqrtdcamxvcugek`, **Central EU (Frankfurt)**, next to the
  Hetzner server in Falkenstein. Postgres 17.
- **Data API off.** Our backend talks to Postgres directly (Prisma); no table is reachable through
  Supabase's public REST API (`/rest/v1` answers 401). **Automatic RLS on** for new tables, as a
  second net if the Data API is ever turned on. Turning it on: Settings → Data API.
- **Sign-in: Google only.** The Email provider is off (Google-only is the plan in `docs/pricing.md`;
  an unused sign-up door invites throwaway accounts). Authentication → Sign In / Providers.
- **URL configuration:** Site URL `https://typeplay.app`; redirect allow-list
  `https://typeplay.app/**`, `http://localhost:3000/**` (dev).
- Free plan note: a project with no activity for 7 days is paused (one click to resume).

| `.env` key | What | Where in the dashboard |
|---|---|---|
| `SUPABASE_URL` | `https://bensbaqrtdcamxvcugek.supabase.co` | Settings → API Keys |
| `SUPABASE_PUBLISHABLE_KEY` | public by design, goes in the browser | Settings → API Keys → publishable |
| `SUPABASE_SECRET_KEY` | full access, **server only** | Settings → API Keys → secret "default" |
| `SUPABASE_DB_PASSWORD` | Postgres password (generated, 32 chars) | Database → Settings → reset password |
| `DATABASE_URL` | transaction pooler `aws-1-eu-central-1.pooler.supabase.com:6543`, `?pgbouncer=true` (app runtime, Prisma) | Connect → Direct → Transaction pooler |
| `DIRECT_URL` | session pooler, same host, port 5432 (migrations; works over IPv4) | Connect → Direct → Session pooler |

The direct host `db.<ref>.supabase.co` is IPv6-only on the free plan; the poolers work everywhere.

## 2. Google sign-in

- **Google account:** lazarashvili02@gmail.com (the same account as Cloudflare). Google Cloud's
  Terms of Service and the Google API Services User Data Policy were accepted by Luka.
- **Cloud project "TypePlay"**, id `typeplay-app`. No billing account (sign-in is free; the
  "$300 free trial" banner is unrelated, ignore it).
- **Google Auth Platform:**
  - Branding: app name "TypePlay"; user support email **typeplay-support@googlegroups.com**;
    home `https://typeplay.app`, privacy `/privacy`, terms `/terms`; authorized domains
    `typeplay.app` and `bensbaqrtdcamxvcugek.supabase.co`; developer contact Luka's Gmail. No logo:
    a logo requires Google's brand verification (a few business days); add one before launch if
    we want it on the sign-in screen.
  - Audience: External, **In production** (anyone with a Google account; no review needed while we
    ask only for name, email and profile picture).
  - Client "TypePlay web (Supabase)", type Web: JavaScript origins `https://typeplay.app`,
    `http://localhost:3000`; redirect URI `https://bensbaqrtdcamxvcugek.supabase.co/auth/v1/callback`.
- `.env`: `GOOGLE_CLIENT_ID` (not secret, visible in every sign-in), `GOOGLE_CLIENT_SECRET`
  (also pasted into Supabase → Sign In / Providers → Google).
- **Secret rotated at creation (2026-10-15):** the first secret was partly printed into the build
  session's log by mistake, so a second one was issued and the first disabled and deleted. Google no
  longer shows a secret after creation; a lost secret means: Clients → client → Add secret, update
  `.env` and Supabase, then disable and delete the old one.
- Checked end to end: Supabase's `/auth/v1/authorize?provider=google` sends the browser to Google
  with our client id and the Supabase callback; both database URLs connect.

## 3. Support address: typeplay-support@googlegroups.com

A Google Group owned by lazarashvili02@gmail.com: private (nobody can find it, join it or read its
mail), anyone can write to it, mail arrives in Luka's Gmail. It hides the personal Gmail on Google's
sign-in screen. When there is a team or real support volume, Google Workspace (~$7-8/user/month)
gives support@typeplay.app instead; not needed before that (replying as hello@typeplay.app works
free through Gmail "Send mail as" with a free sending service).

## If something goes wrong

- **Sign-in fails with "redirect_uri_mismatch":** the Google client's redirect URI must be exactly the
  Supabase callback above.
- **Sign-in returns to the wrong site:** Supabase → URL Configuration allow-list.
- **A key leaked:** Supabase secret key: Settings → API Keys → create a new secret key, update `.env`,
  delete the old. DB password: Database → Settings → Reset, update the three `.env` lines. Google
  secret: see the rotation note above.
