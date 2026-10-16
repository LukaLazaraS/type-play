# Deploy: typeplay.app (site) and typeplay.dev (games)

Live since 2026-10-15. One script, run from Luka's PC at the repo root:

```bash
node deploy/deploy.mjs site     # put the current apps/web live (~1 min); the old version serves until the new one is built
node deploy/deploy.mjs games    # upload apps/games to R2 (only changed files)
node deploy/deploy.mjs status   # server + every public page, live
node deploy/deploy.mjs ssh      # a shell on the server; `ssh "docker compose -f /opt/typeplay/compose.yaml logs -f"` etc.
node deploy/deploy.mjs setup    # build everything from nothing (also safe to re-run: refreshes firewall, DNS, settings)
```

The site deploys what is on disk, committed or not (`turbo prune web`).

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
  `R2_SECRET_ACCESS_KEY` (`docs/cloudflare.md`). None of them is on the server.
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
