# TypePlay games origin (`apps/games/`, live on typeplay.dev)

The static origin that runs users' games and the site's demo games. It is separate from the
site (typeplay.app) because a game runs code: on its own origin it cannot read the site's
cookies or storage. This folder mirrors the live bucket one to one.

```
apps/games/
  play.html            the loader page: /play.html?g=<id>  (the only code on this origin)
  engine/<version>/    one Godot web engine per Godot version (index.js, index.wasm, worklets)
  builds/<id>/         one game: index.pck (12-40 KB) + game.json (name, engine version, source)
  scripts/serve.mjs    dev server on http://127.0.0.1:3001
  scripts/build-demo.mjs   assembles the site's demo games from packages/agent/output (dev + marketing)
```

Rules:
- **One engine per Godot version**, never overwritten: `engine/4.7.2/` stays even after 4.8
  ships, because every `game.json` names the engine it was exported with.
- **Builds are immutable.** A new version of a user's game is a new `<id>` (the server will use
  `<project>-<version>`); caches can then be `immutable` for everything but `play.html`.
- **Single-threaded exports only** (`variant/thread_support=false`): no COOP/COEP headers, works
  on iPhone Safari. Turning threads on brings the headers back (CLAUDE.md, Known traps).
- **No cookies, no site code, no analytics** on this origin.

Live hosting (package 5): Cloudflare R2 bucket with the custom domain typeplay.dev; the server's
export worker uploads `builds/<id>/` after each build; `scripts/publish.mjs` will push this folder.
Dev: `node scripts/build-demo.mjs` then `node scripts/serve.mjs`; the site points at it through
`NEXT_PUBLIC_GAMES_ORIGIN` (default `http://127.0.0.1:3001`).

`engine/*/` and `builds/` are git-ignored (binaries); `play.html`, the scripts and this file are not.
