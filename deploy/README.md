# Deploy: typeplay.app (site), typeplay.dev (games), api.typeplay.app (API)

Site and games live since 2026-10-15; the API is ready to go live (section "The API" below).
One script, run from Luka's PC at the repo root:

```bash
node deploy/deploy.mjs site     # put the current apps/web live (~1 min); the old version serves until the new one is built; then pings IndexNow (Bing etc.)
node deploy/deploy.mjs games    # upload apps/games to R2 (only changed files)
node deploy/deploy.mjs status   # servers + every public page, live (and the API's /health once it exists)
node deploy/deploy.mjs ssh      # a shell on the server; `ssh "docker compose -f /opt/typeplay/compose.yaml logs -f"` etc.
node deploy/deploy.mjs setup    # build everything from nothing (also safe to re-run: refreshes firewall, DNS, settings)
node deploy/deploy.mjs api      # put the current API live (apps/server + packages/agent), see "The API"
```

The site and the API deploy what is on disk, committed or not (`turbo prune`).

## What runs where

```
visitor ── Cloudflare (DNS, HTTPS, cache, DDoS) ─┬─ typeplay.app ─► Hetzner CX23 "typeplay-web" (Falkenstein)
                                                 │                    Docker: caddy (HTTPS) → web (Next.js)
                                                 └─ typeplay.dev ─► R2 bucket "typeplay-games" (engine + builds)
```

| Piece | Where | Cost |
|---|---|---|
| Server `typeplay-web` | Hetzner Cloud project "typeplay": CX23 (2 vCPU, 4 GB, 40 GB), Ubuntu 24.04, fsn1, 188.245.229.201 / 2a01:4f8:c016:50af::1 | €6.49 + IPv4 ~€0.60 a month |
| Firewall `typeplay-web` | SSH from anywhere (key only, no passwords); 80/443 only from Cloudflare's ranges (refreshed by `setup`) | free |
| Site | `/opt/typeplay` on the server: `compose.yaml`, `caddy/Caddyfile`, `src/` (pruned source, built into the `typeplay-web` image) | |
| HTTPS | Visitor ↔ Cloudflare: Cloudflare's certificate. Cloudflare ↔ server: Let's Encrypt via Caddy, checked by Cloudflare ("Full (strict)"). Caddy renews by itself through the HTTP challenge on port 80 | free |
| Games | R2 bucket `typeplay-games` (Western Europe) on the custom domain typeplay.dev; `apps/games/scripts/publish.mjs` | free at our size |

Files here: `deploy.mjs` (the script), `server/cloud-init.yaml` (first boot: updates, 2 GB swap,
key-only SSH, Docker with rotating logs), `server/compose.yaml`, `server/Dockerfile` (Next.js
`standalone` build on `node:22`), `server/caddy/Caddyfile` (HTTPS, security headers, www → apex).

## Keys

- Root `.env`: `HETZNER_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY` (`docs/cloudflare.md`). None of them is on the site's server; the API server gets only the R2 keys (section "The API").
- SSH: `~/.ssh/typeplay` (made by `setup`, registered at Hetzner as "typeplay-deploy"); the server's
  host key is pinned in `~/.ssh/typeplay_known_hosts`.

## When something goes wrong

- **Site down:** `status`, then `ssh "cd /opt/typeplay && docker compose ps && docker compose logs --tail 50"`.
  `ssh "cd /opt/typeplay && docker compose restart"` restarts both containers.
- **A deploy fails to build:** nothing changes, the running version stays up. Fix and run `site` again.
- **Lost the SSH key or the server is broken:** the server holds nothing that isn't in this repo.
  Delete it in the Hetzner console, then `setup` + `site` (~5 min) builds a new one and points DNS at it.
- **Cloudflare 526 error:** Caddy has no valid certificate; check `docker compose logs caddy`.
- **Never** turn on Cloudflare's "Always Use HTTPS" for typeplay.app or block port 80 at the firewall:
  Caddy needs plain http on port 80 to renew its certificate (it redirects visitors to HTTPS itself).

## The API (api.typeplay.app): ready, not live yet

Written and tested 2026-10-17 (package 5); nothing is bought or created yet. Going live:

```bash
node deploy/deploy.mjs api-setup         # prints what it would buy; with --yes: server + firewall + DNS api.typeplay.app (~5 min)
node deploy/deploy.mjs api-assets        # once: the 3D model library the catalogue uses (14,163 files, 1.65 GB) → the server
node deploy/deploy.mjs api               # pack, upload, build on the server, switch, check /health (first time: a few minutes)
node deploy/deploy.mjs api-ssh "cd /opt/typeplay-api && docker compose ps && docker compose logs --tail 50 api runner signer"
node deploy/deploy.mjs android-key        # once, before the first `api`: ANDROID_KEY_MASTER into the root .env (never printed)
```

**What Luka does:** (1) say yes to the server (`docs/server-proposal.md`: CPX32, $41.99 + $0.60 a month; a
CX33 for $9.99 if Hetzner has one: `api-setup --type cx33 --yes`); (2) create the API key in the Anthropic
Console (parked #6) and paste it into the root `.env` as `ANTHROPIC_API_KEY=…` (`sk-ant-api…` or the newer `sk-ant-usr…`). Then the three
commands above. `api` stops before uploading anything if the key is missing or is a Claude login token.
**Beta 1 day:** in `server/compose.yaml` set `NEXT_PUBLIC_APP: "1"`, then `site` (the app screens go live
and talk to `https://api.typeplay.app`, already set there as `NEXT_PUBLIC_API_ORIGIN`).

```
browser ── Cloudflare ── api.typeplay.app ─► Hetzner CPX32 "typeplay-api" (Falkenstein), /opt/typeplay-api
                                               caddy (HTTPS) → api: NestJS + key proxy. Holds the secrets (api.env).
                                                                 │ Unix socket: jobs
                                                               runner: game agent runs, Godot, Chromium, git
                                                                 in game folders, each job as a throwaway user.
                                                                 No secrets; its network reaches only the key proxy.
api → Supabase Postgres (data), R2 typeplay-games (builds, served at typeplay.dev), Anthropic (via the key proxy)
```

| Piece | Where |
|---|---|
| Server `typeplay-api` + firewall `typeplay-api` | Hetzner project "typeplay", fsn1; same firewall rules as the site (SSH by key; 80/443 only from Cloudflare) |
| DNS | `api.typeplay.app` A + AAAA, proxied (zone settings Full strict / TLS 1.2 are the site's) |
| Files | `/opt/typeplay-api`: `compose.yaml`, `caddy/`, `src/` (pruned source), `api.env` (mode 600), **`data/`** (every game's git repo, run logs: the only state on this box; turn on Hetzner backups, +20%), `assets/` (3D library, read-only to runs) |
| Image | `api/Dockerfile`: Node 22, git, Chromium, Godot 4.7.2 Linux + web and Android release templates from the official release (SHA-512 checked), Prisma; `prisma migrate deploy` on every start. **Android toolchain** (package 7, stages `android-sdk` → `gradle-seed` → `self-test`, kept across deploys): Temurin JDK 17 (318 MB), the SDK pieces the Godot template names (command-line tools 175, build-tools 36.1.0 150, platforms android-36 146, platform-tools 22 MB), bundletool 1.18.3 (32 MB), the two Android templates (305 MB), and the warmed Gradle seed (1.18 GB), every download pinned by hash: **about +2.2 GB on the image, +10-15 min on the first build** (measured sizes from the WSL run; the seed warm-up took 1 min 54 s on this PC). The `self-test` stage exports the blank template to APK and AAB with `--network=none` and checks target SDK 36, 16 KB pages, not debuggable, no permissions: a broken toolchain fails the deploy, never a user's export. `deploy.mjs api` copies `api/android/` (the seed's `gradle.properties`, the offline init script, the placeholder icons, `steps.sh`) next to the Dockerfile |
| CPU / memory / disk | runner ≤ 3 vCPU / 5.5 GB, api ≤ 1 vCPU / 1 GB: builds can't starve the API. At most 4 runs (`MAX_RUNS`), 6 runner slots; each run's hidden browser runs under that CPU cap (no cross-run lock there). A game folder is capped at 512 MB per agent job; the engine files are removed after each publish; a game is only freed by deleting it (`apps/server/README.md`, "Where data lives") |
| Secrets | `api.env`, written by `api` from the root `.env`: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `ANTHROPIC_API_KEY`, `ANDROID_KEY_MASTER` (the key every game's Android upload keystore is encrypted under; `android-key` makes it; `api` requires it only while `ANDROID_EXPORT: "1"` is set in `api/compose.yaml`, which is `"0"` (off) for beta 1), and when present `ANDROID_KEY_MASTER_PREV`; and with billing on, the Paddle keys `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_WEBHOOK_SECRET_PREVIOUS`, taken from the root `.env`'s `PADDLE_LIVE_*` (or `PADDLE_SANDBOX_*`) names (row below). Never the Hetzner or Cloudflare tokens, the Supabase secret key, the DB password or the Google secret. Only the api container gets them: the runner refuses to start with any of them, the signer too |
| Paddle | `api/compose.yaml` names the environment and the catalog: `PADDLE_ENV` (empty = billing off; `sandbox` while testing, usable on the live site only by `ADMIN_EMAILS`; `live` after Paddle's approval), the five `PADDLE_PRICE_*` ids (from `npm run paddle:catalog`), `ADMIN_EMAILS`. The keys go to the server only with billing on: `PADDLE_ENV: "live"` takes `PADDLE_LIVE_API_KEY`, `PADDLE_LIVE_WEBHOOK_SECRET` (and `PADDLE_LIVE_WEBHOOK_SECRET_PREVIOUS`) from the root `.env` and writes them into `api.env` under the plain names; `"sandbox"` takes `PADDLE_SANDBOX_*` the same way; `""` (off) sends none (2026-10-25: names no code on this PC reads, so development, whose own sandbox keys are the plain names in `.env.local`, and the tests never get a real key). `api` refuses a missing key or webhook secret and a key whose prefix (`pdl_sdbx_` / `pdl_live_`) disagrees with `PADDLE_ENV`; the API checks the same at start and compares the prices with `credits.ts`. The site's build args `NEXT_PUBLIC_PADDLE_ENV` and `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` are in `server/compose.yaml` (part 3). **At go-live, a Cloudflare WAF skip rule**: Security > WAF > Custom rules, "Paddle webhooks": `(http.host eq "api.typeplay.app" and http.request.uri.path eq "/webhooks/paddle")` → Skip all remaining custom rules, Bot Fight Mode and the managed challenge (Paddle asks for bot checks to be bypassed on the webhook path). No IP allowlist: the origin only sees Cloudflare's addresses, the signature is the check. Set the destination's URL to `https://api.typeplay.app/webhooks/paddle`, API version 1, the 11 events of `docs/payments-design.md` §6 |

How the agent is kept away from secrets, and what that doesn't cover: `apps/server/README.md`, "Live mode".

- **Android export (package 7):** a fourth container, `signer` (same image; `apps/server/signer/signer.mjs`): no
  network at all, a read-only root with a tmpfs `/tmp`, no secrets, no `/data`; it shares only the `exports`
  volume with the api and signs each build with the game's upload key for the seconds the tool runs. The runner
  does the Godot export unsigned (one Android job at a time, `MAX_ANDROID_JOBS`), with its own `JAVA_HOME`,
  `ANDROID_HOME`, `GRADLE_SEED` and `ANDROID_ICONS` (`api/compose.yaml`); it never mounts `exports` and refuses
  to start with `ANDROID_KEY_*` or `SIGNER_*` in its environment. The api gets `ANDROID_EXPORT` (`"0"` for beta 1, `"1"` once `android-key` has run),
  `SIGNER_SOCKET`, `EXPORTS_DIR`, `MAX_ANDROID_BUILDS=1`, `ANDROID_BUILD_TIMEOUT_MIN=14`, `ANDROID_STORE=folder`
  (signed files in `data/android/`, served by the api; `r2` = the private bucket below), `API_PUBLIC_URL` (phone
  links). `api` also refuses while `/health` says `android.running > 0` (`--force` overrides). Flow and endpoints:
  `apps/server/README.md` "Android export". **The private bucket** `typeplay-exports` (read back through presigned links of a few minutes, behind the 10-minute phone link's redirect,
  objects deleted after 30 days by a lifecycle rule) is created by `api-setup --yes` (also safe to re-run on an
  existing server: it only adds the bucket); then set `ANDROID_STORE: r2` in `api/compose.yaml` and run `api`.
  Written, not run yet (nothing is created until Luka's `--yes`).

- **A deploy restarts the runner**, which stops running builds (players are not charged; they see
  "interrupted"). `api` refuses while builds run; `--force` overrides.
- **Launch (~11-02):** rescale to CPX42 in the Hetzner console ("CPU and RAM only"), then raise the
  runner's `cpus`/`mem_limit` and `MAX_RUNS` in `api/compose.yaml` and run `api`.
- **The browser:** Debian's Chromium is the one part not yet run in this exact image (its SwiftShader,
  for WebGL without a GPU, is in `chromium-common`). The image build stops if it can't do WebGL 2, so a
  bad browser fails the deploy, not every game check. Fallback: Chrome for Testing's headless shell,
  which passed the same check in WSL (10-17), as `BROWSER_EXE` in the runner's environment.
- **Tested 10-17 without a server:** the R2 upload (a throwaway build put, served by typeplay.dev, deleted);
  Claude Code → key proxy → mock Anthropic (only our key reaches upstream); the runner as root in WSL
  (Ubuntu) with throwaway users: isolation, clean-up, cancel, Godot export, git hooks, and a full run of
  `run.mjs` with the real Godot and a headless Chrome; the production start-up guards; the API's e2e test.
  Not run here (no Docker on this PC): the image build itself, Caddy for api.typeplay.app, a real key.
