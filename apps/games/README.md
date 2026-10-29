# TypePlay games origin (`apps/games/`, live on typeplay.dev)

The static origin that runs users' games and the site's demo games. It is separate from the
site (typeplay.app) because a game runs code: on its own origin it cannot read the site's
cookies or storage. This folder mirrors the live bucket one to one.

```
apps/games/
  play.html            the loader page: /play.html?g=<id>  (the only code on this origin)
  engine/<version>/    one Godot web engine per Godot version (index.js, index.wasm, worklets)
  builds/<id>/         one game: index.pck (12-40 KB) + game.json (name, engine version, orientation, badge, source)
                       + poster.png (the start screen, when the check made one)
  scripts/serve.mjs    dev server on http://127.0.0.1:3001
  scripts/build-demo.mjs   assembles the site's demo games from packages/agent/output (dev + marketing)
                       --showcase: only the six Opus-built showcase candidates (builds/show-*: pack, game.json, poster pictures,
                       card.jpg + icon.jpg for the home page) and a games.ts entry for each; the home page lists the six -polished ones (10-27)
  scripts/publish.mjs  uploads this folder to the live bucket (changed files only; .html .js .wasm .pck .json, and .png since 10-29)
```

Rules:
- **One engine per Godot version**, never overwritten: `engine/4.7.2/` stays even after 4.8
  ships, because every `game.json` names the engine it was exported with.
- **Builds are immutable.** A new version of a user's game is a new `<id>`: the API publishes
  `<project>-v<n>` (`apps/server/src/games/publish.ts`), immutable like the packs; caches are
  `immutable` for everything but `play.html` and `game.json` (a day at the edge, a year in browsers).
- **Single-threaded exports only** (`variant/thread_support=false`): no COOP/COEP headers, works
  on iPhone Safari. Turning threads on brings the headers back (CLAUDE.md, Known traps).
- **No cookies, no site code, no analytics** on this origin.

**The Free plan's mark** (2026-10-20; the terms: "Games built on the free plan carry a small TypePlay badge. Paid plans
remove it."). `game.json` `"badge": true` turns it on: the API writes it when the game's owner is on Free as the build is
published, `false` on a paid plan (`apps/server/src/games/publish.ts`); builds from before have no field and no mark, and
anything but `true` counts as no mark. A build never changes: after an upgrade the next version has no mark, and restoring
an older Free version brings its mark back. Android builds never carry it (paid plans only, and they don't use play.html).
- **While the game loads:** "Made with **TypePlay**" as an Ink Recess pill under the progress bar, the one link
  (https://typeplay.app, new tab, `rel="noopener"`). It waits 700 ms, so a cached engine that starts at once skips it; it
  goes when loading fails.
- **Over the game:** a tab on the right edge, halfway down, reading "Made with TypePlay" top to bottom; 400 ms after the
  game's first frame it slides out of the edge, and after 4 s or the player's first tap or key it folds to "TypePlay". It
  never takes a tap, a click or a key (`pointer-events: none`, not focusable, `aria-hidden`): games use the whole screen
  (steering halves, "tap anywhere"), so any hit area would sooner or later eat a game's tap.
- **Why there:** games keep the HUD along the top and their buttons along the bottom (portrait) or in the bottom corners
  (landscape), and title panels leave a margin at the sides; a bottom-centre mark read as the caption of a racer's NITRO
  button. The middle of the left edge is the site's own close tab in full screen.
- **Small frames:** under 360 px tall a smaller tab with the name only; under 150 px (or a frame narrower than 150-190 px)
  neither. On notched phones the tab runs under the notch and its words stay in the safe area.
- `?mark=quiet` starts it small without the slide and the "Made with" (the site passes it for a new version of a game the
  player is already playing); it never hides the mark.
- Nothing is fetched for it: the wordmark is Gabarito Black cut to the letters of "TypePlay" (about 1.7 KB, SIL OFL 1.1),
  inline in play.html. Its design: `DESIGN.md`, "Game frame".

Live hosting (since 2026-10-15): Cloudflare R2 bucket `typeplay-games` with the custom domain typeplay.dev;
`node scripts/publish.mjs` (or `node deploy/deploy.mjs games` at the root) uploads changed files. The API uploads
`builds/<id>/` after each build the same way (`apps/server/src/games/publish.ts`, `GAMES_PUBLISH=r2` on its server).
Dev: `node scripts/build-demo.mjs` then `node scripts/serve.mjs`; the site points at it through
`NEXT_PUBLIC_GAMES_ORIGIN` (default `http://127.0.0.1:3001`).

`engine/*/` and `builds/` are git-ignored (binaries); `play.html`, the scripts and this file are not.
