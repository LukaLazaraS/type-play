# TypePlay site (`apps/web/`, live on typeplay.app)

Next.js 16 (App Router, Turbopack), Tailwind 4, Motion, Phosphor icons. One project holds the
public pages (home, pricing, terms, privacy, refunds) and, from package 4 on, the app.

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_GAMES_ORIGIN, see below
npm run dev                  # http://localhost:3000
npm run check                # tsc + eslint
npm run shots                # screenshots of every page into ../.impeccable/review (Playwright on the installed Edge)
```

The playable games come from the separate **games origin** (`../games`, live on typeplay.dev).
Run it alongside the site in dev: `cd ../games && npm run build-demo && npm run serve` (port 3001).
`npm run posters` captures the demo's poster images from it into `public/games/`.

## Where things live

- `src/content/`: everything that is a fact, not a layout: `site.ts` (name, domains, email,
  seller, plans, platforms, games origin), `games.ts` (the test games on the home page),
  `demo.ts` (the "say what to change" steps), `legal.ts` (terms, privacy, refunds).
- `src/components/`: the home-screen world's parts (`StatusBar`, `Dock`, `AppIcon`, `Notice`,
  `PromptForm`, `BuildingIcon`, `Launcher`, `GameFrame`, `Demo`, `LegalSheet`, `Wallpaper`,
  `Ground`, `Footer`). Client components only where there is state or motion.
- `src/app/globals.css`: all tokens and component styles; no inline styles in TSX.
- `public/games/`: screenshots of the test games (JPEG comments carry their origin).
- `scripts/`: dev tooling only (screenshots, posters); not shipped.

Design authorities: `../../PRODUCT.md` (product record) and `../../DESIGN.md` (the design system).

## Known trap

Turbopack's file watcher on this PC misses edits to `globals.css`: restart `npm run dev` after
changing it. `next.config.ts` allows `127.0.0.1` as a dev origin so screenshots work.
