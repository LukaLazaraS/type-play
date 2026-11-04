# Google sign-in: TypePlay's name, not the Supabase address

Written 2026-11-04 (night session `signin-name`, HQ for Luka). Today a player who signs in with Google is told by Google
that they signed in to **bensbaqrtdcamxvcugek.supabase.co** (Luka's screenshot: Google's security email of 27 October).
This page says where that happens, the ways to fix it, what was built, and Luka's steps, shortest first. Nothing was
bought and no account was touched; Claude may not log in or change account settings.

## Where players see the Supabase address today

| Where | Today | With the switch on (built) | After brand verification |
|---|---|---|---|
| Google's sign-in page and account chooser | "Sign in to continue to bensbaqrtdcamxvcugek.supabase.co" (checked 11-04: Google's page fetched without an account) | "Sign in to continue to typeplay.app" (checked the same way for the typeplay.app origin; no Supabase mention) | "TypePlay" |
| Chrome's own sign-in dialog (new with the switch) | (none) | "Sign in to typeplay.app with google.com" | still typeplay.app (Chrome always names the site's domain) |
| Consent at the first sign-in ("Google will share your name, email…") | the Supabase address | typeplay.app | "TypePlay" with the logo |
| Google's security email ("You used Sign in with Google to sign in to …") | the Supabase address (Luka's screenshot) | typeplay.app (expected: the same name rule; Luka checks after the first sign-in) | "TypePlay" (expected) |
| Google Account → Security → Your connections to third-party apps & services | listed as the Supabase address | typeplay.app (expected) | "TypePlay" with the logo (Google: the logo shows "on account settings") |
| The address bar | passes through bensbaqrtdcamxvcugek.supabase.co twice (`/auth/v1/authorize`, then `/auth/v1/callback`), and Google's own address carries `redirect_uri=…supabase.co…` | no Supabase page at all: Chrome's dialog or Google's popup, the page stays on typeplay.app | same |

Why: Google shows an app's name only once Google has verified its brand; until then it shows the domain of the address
the sign-in returns to. Today that is Supabase's callback, because the sign-in is a redirect through Supabase. With
Google's own button the sign-in returns to typeplay.app itself. Not checked tonight, because they need a real sign-in:
the email and the connections list. Google's rule predicts both.

## The options

| Option | What it fixes | Cost | Google's review | Needs Luka's account |
|---|---|---|---|---|
| **A. Google's own button on typeplay.app**, its token handed to Supabase (`signInWithIdToken`). **Built tonight, behind a switch** | Every row above: typeplay.app instead of the Supabase address; no Supabase page in the address bar. Our orange "Sign in with Google" becomes Google's black one (Google's look, as its branding rules ask) | $0 | none | nothing: the Google client already lists `https://typeplay.app` as a JavaScript origin, and Supabase's Google provider already lists the web client ID, which is what Supabase checks the token against. Turning it on is one line and a site deploy |
| **B. Brand verification** (Google Auth Platform → Branding → Verify branding) | With A or with today's redirect: "TypePlay" and the logo instead of a domain, in the account chooser, consent, email and connections list | $0 | automated, usually minutes; a manual review takes 2-3 business days | Luka's Google Cloud: upload the logo, Verify, Publish. Google asks that every authorized domain be proven yours in Search Console: typeplay.app is (domain property, 10-16), the Supabase domain can't be. Reports differ on whether that blocks verification; if it does, step 3 below |
| C. Supabase custom domain (`auth.typeplay.app`) | With today's redirect and our own orange button: Google sees typeplay.app; the address bar shows auth.typeplay.app | Pro plan $25/month + custom domain add-on $10/month = **$35/month** ($10/month on top if Pro is bought at launch anyway, as `docs/auth.md` plans) | none (DNS and a certificate, up to ~30 min) | Luka's Supabase billing, a CNAME and a TXT record in Cloudflare, the new callback added in Google Cloud. Code: the site's Supabase URL changes; the API keeps checking tokens against the project address (Supabase keeps the token's issuer on …supabase.co) |
| D. Supabase vanity subdomain (`typeplay.supabase.co`) | Google would show typeplay.supabase.co: it still says Supabase | included in Pro ($25/month) | none | Luka's Supabase billing. **Not a fix** |
| E. Our own Google redirect on typeplay.app (our server swaps Google's code for the token, then Supabase) | The same as A, keeping our orange button and full-page redirects | $0 | none | a new redirect URI in Google Cloud, and Google's client secret on the site's server. More security-critical code of our own than A for the same result. Not built |
| F. Passing Supabase's sign-in through typeplay.app (a proxy) | Doesn't work: Supabase tells Google its own callback address, and Google's code exchange must use that same address; only C changes it | | | |

**The pick: A, then B.** A is free, needs no account change, removes the Supabase address from every place at once, and
is the way Google and Supabase both document for "Sign in with Google" on a website. B then turns "typeplay.app" into
"TypePlay" with the logo. Google's own button also follows Google's branding rules, which verification checks. Ours,
a one-colour G on orange, does not (Google: the G must be the standard colours, on a light, dark or neutral button). C is
the alternative if Luka wants to keep our own orange button. It is $35 a month; one manual reviewer in 2022 approved an app
only after its button matched the guidelines.

## What was built (branch `signin-name`)

**The switch**: `NEXT_PUBLIC_GOOGLE_BUTTON` in `deploy/server/compose.yaml`, read when the site is built (like
`NEXT_PUBLIC_CLOSED_BETA`). It is `"0"` in the branch: the sign-in exactly as today.

| Value | Sign-in | Where Google's script can't load (an ad blocker, offline) |
|---|---|---|
| `"0"` | the redirect through Supabase, as today | (not loaded) |
| `"1"` | Google's own button on typeplay.app | our orange button and the redirect, as today (needs Supabase's callback kept in Google Cloud) |
| `"only"` | Google's own button on typeplay.app | a line: "Google's sign-in didn't load here. If you use an ad blocker, allow accounts.google.com on this site, then reload the page." (for after step 3, when Google Cloud no longer has Supabase's callback) |

**How it works** (`apps/web/src/lib/google-button.ts`, `components/ui/GoogleButton.tsx`, `components/app/SignIn.tsx`,
the closed-beta screen's "Use another account"):

- The pages with a sign-in load Google's script (`accounts.google.com/gsi/client`) and Google draws its button. Chrome
  (desktop 125+, Android 128+) shows its own sign-in dialog. Other browsers show Google's popup. Nobody is signed in
  without a tap.
- **Nonce:** every attempt makes 32 random bytes, kept in the page's memory only. Google gets their SHA-256 and writes it
  into the ID token; Supabase gets the raw value and checks the hash (its own server code). A Google token not asked
  for by this page, just now, can't sign anyone in, and a token for an older attempt is never sent.
- **Origins:** Google gives tokens only to the client's authorized JavaScript origins (seen tonight: any other origin
  gets "The given origin is not allowed for the given client ID"), and the code starts the button only on
  https://typeplay.app (localhost in development).
- **Supabase checks the token as today:** Google's signature, our client ID as the audience, the nonce. It makes the
  session in the browser's cookies as the redirect does; then the page the player was going to opens signed in.
  The API's token check is unchanged.
- Nothing secret in the site: the Google client ID (`content/app.ts`, written from the root `.env` by
  `apps/web/scripts/supabase-config.mjs`) is in every sign-in's address anyway.
- Google's script runs with the page's rights, as on every site with Google's button. So it loads only where someone
  signs in: the signed-out app pages and the closed-beta screen, never on a page of a signed-in tester, and never on
  the public pages.
- On the closed-beta screen, "Use another account" becomes Google's light button "Continue with Google". It is Google's
  medium size, which Google never fills with the signed-in account's name.

**Tests:** `node packages/agent/tools/cpu.mjs node apps/web/scripts/shot-signin.mjs` (its own database and free ports;
nothing reaches Google or the live Supabase; Google's script and Supabase's token endpoint are answered by the test the
way they answer, and dev sign-in stands in for Google's token). It covers all three values: off is today's redirect,
PKCE and the callback; on covers the button, nonce, wrong nonce, replay, cookies, /me, sign-out, the checkout handoff,
the closed beta, the blocked-script fallback and phone width; `only` covers the blocked line. Screenshots go to
`.impeccable/review/signin/`. Google's real button was also drawn once in a test browser (no account, no click) to
size its placeholder: dark "Sign in with Google" 194x40, light "Continue with Google" 191x32.

## Luka's steps (shortest path first)

### 1. Switch Google's button on (5 minutes, $0, no account change)

1. Optional look, nothing to change: Supabase dashboard → project **typeplay** → **Authentication** → **Sign In /
   Providers** → **Google**: **Client IDs** starts with `1093794003252-t3b2…apps.googleusercontent.com`, and **Skip nonce
   check** is off. (Both are what today's redirect uses.)
2. Say "turn the Google button on". After HQ merges `signin-name`, Claude sets `NEXT_PUBLIC_GOOGLE_BUTTON: "1"` in
   `deploy/server/compose.yaml` and runs `node deploy/deploy.mjs site` (~1 minute).
3. Check on typeplay.app, on the computer and on the phone: tap **Sign in with Google** (now black). Google's window or
   Chrome's dialog should say **typeplay.app**, and you're back on the page signed in. Then Google's email in Gmail
   should name typeplay.app. On the iPhone also try it from the home-screen app, if you added TypePlay to the home
   screen (the site can be installed). That is the one place where Google's popup may not hand the sign-in back, and
   no test here can reach it. If it fails there, say so: the fix is Google's redirect mode for that case.
4. To go back: `"0"` and deploy again.

### 2. "TypePlay" and the logo instead of "typeplay.app" (15 minutes; Google: minutes, or 2-3 business days)

Google Cloud Console (console.cloud.google.com), project **TypePlay** (`typeplay-app`) → **Google Auth Platform** →
**Branding**:

| Field | Put | Today |
|---|---|---|
| App name | `TypePlay` | already |
| User support email | `typeplay-support@googlegroups.com` | already |
| App logo | upload [typeplay-google-logo-120.png](typeplay-google-logo-120.png) (120x120 PNG, 4 KB: the site's app icon) | none |
| App domain: Application home page | `https://typeplay.app` | already |
| App domain: Application privacy policy link | `https://typeplay.app/privacy` | already |
| App domain: Application terms of service link | `https://typeplay.app/terms` | already |
| Authorized domains | `typeplay.app` (proven yours in Search Console since 10-16); keep `bensbaqrtdcamxvcugek.supabase.co` while the switch is `"1"` (the fallback redirect needs it) | already |
| Developer contact information | your Gmail | already |

**Save**, then **Verify branding**. When it says **Ready to publish**, click **Publish branding** within 7 days (after
that it asks to verify again). Nothing on the page can be changed while Google reviews. If it says **Need to fix
issues** about bensbaqrtdcamxvcugek.supabase.co (a domain you can't prove you own), do step 3.

### 3. Only if verification refuses the Supabase domain (10 minutes)

1. Say "switch the Google button to only" (Claude: `NEXT_PUBLIC_GOOGLE_BUTTON: "only"`, deploy the site).
2. Google Auth Platform → **Clients** → **TypePlay web (Supabase)** → **Authorized redirect URIs**: delete
   `https://bensbaqrtdcamxvcugek.supabase.co/auth/v1/callback` (empty the field first, then the bin), **Save**. Keep the
   **Authorized JavaScript origins**.
3. **Branding** → **Authorized domains**: delete `bensbaqrtdcamxvcugek.supabase.co`, **Save**, **Verify branding** again.

After this the redirect through Supabase no longer works: the switch can't go back to `"0"` until the redirect URI is
added again.

### Optional: Google's button in `npm run dev` on this PC

Google Auth Platform → **Clients** → **TypePlay web (Supabase)** → **Authorized JavaScript origins**: add
`http://localhost` (next to `http://localhost:3000`; Google's docs ask for both, and tonight Google refused
http://localhost:3000 alone). $0, no review. Then `NEXT_PUBLIC_GOOGLE_BUTTON=1` in `apps/web/.env.local` and open
http://localhost:3000.

### The paid way instead (only to keep our own orange button)

Supabase → organization **TypePlay** → **Billing**: Pro ($25/month), then project **typeplay** → **Settings** →
**General** → **Custom Domains** ($10/month): `auth.typeplay.app`, a CNAME to `bensbaqrtdcamxvcugek.supabase.co` and the
TXT record Supabase shows, in Cloudflare (DNS only, not proxied), then **Activate**. Google Cloud → Clients → add
`https://auth.typeplay.app/auth/v1/callback` next to the Supabase one. Claude then points the site's Supabase URL at
auth.typeplay.app. The switch stays `"0"`.

## For Luka's website review

- Privacy page, "Who else sees it", the Google line, with the switch on: proposed "Google: provides sign-in with your
  Google account; its sign-in button loads from Google on the pages where you sign in." (today: "Google: provides
  sign-in with your Google account."). Not changed: legal text is Luka's call.
- One Tap (Google's "sign in as Luka?" box that opens by itself on a page) is possible with the same code later; not
  built: it is a new prompt on the pages, not part of this fix.

## Sources

- Google: [Manage OAuth App Branding](https://support.google.com/cloud/answer/15549049) ("Without verification, only
  your application domain will be visible to users"; logo 120x120, under 1 MB; Verify branding, Publish branding, 7 days).
- Google: [Submit for brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification)
  (every authorized domain proven in Search Console; automated review minutes, manual 2-3 business days).
- Google: [Get your Google API client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
  (Chrome's dialog shows the top-level authorized domain; the logo on the consent screen and account settings; add both
  `http://localhost` and `http://localhost:<port>`; Referrer-Policy `strict-origin-when-cross-origin`).
- Google: [Sign in with Google JavaScript API](https://developers.google.com/identity/gsi/web/reference/js-reference)
  (`nonce`, `use_fedcm_for_button`, button themes and sizes), [FedCM migration](https://developers.google.com/identity/gsi/web/guides/fedcm-migration),
  [Personalized button](https://developers.google.com/identity/gsi/web/guides/personalized-button) (medium size is never
  personalised), [Branding guidelines](https://developers.google.com/identity/branding-guidelines) (standard-colour G on
  light, dark or neutral; needed to complete verification).
- Supabase: [Login with Google](https://supabase.com/docs/guides/auth/social-login/auth-google) ("users will see
  `<project-id>.supabase.co` which does not inspire trust"; the button and `signInWithIdToken` with a hashed nonce to
  Google and the raw one to Supabase), [Custom domains](https://supabase.com/docs/guides/platform/custom-domains),
  [Custom domain usage](https://supabase.com/docs/guides/platform/manage-your-usage/custom-domains) ($10/month),
  [Pricing](https://supabase.com/pricing) (Pro from $25/month; custom domains not on Free; vanity URLs included in Pro).
- Supabase's server code: [token_oidc.go](https://github.com/supabase/auth/blob/master/internal/api/token_oidc.go) (the
  ID token's audience must be one of the Google provider's client IDs; the SHA-256 hex of the raw nonce must equal the
  token's nonce).
- Community: [supabase discussion #2925](https://github.com/orgs/supabase/discussions/2925) (verification with the Supabase
  domain listed: refused in 2021 until removed, passed automatically in 2026), [#44373](https://github.com/orgs/supabase/discussions/44373)
  (with a custom domain the token's issuer stays on …supabase.co).
