# Night 2026-11-04: update bar + build time (branch `update-bar`)

Started by HQ (Luka asleep). Worktree `.claude/worktrees/update-bar`, branch `update-bar` from `night-features`.
Named `-update-bar` (not `_2`) because two other night sessions (attach, signin-name) write their own logs on
sibling branches that HQ merges into `night-features`: distinct names never conflict.

## Task (from HQ)

1. A new version must not restart the game while the player plays it.
   - Played since load (tap, click, key, gamepad inside the game): keep running, small bar at the top of the game:
     "Version N is ready" with Restart (loads it) and Later (keeps playing; a small "New version" chip stays to load it
     any time). Not touched since load: load the new version by itself, as today.
   - Only for a version the AI just made. Restore, or the player's own Restart: load at once, as today.
   - Full screen and phones too. Polite announcement, never steals focus, keyboard reachable; shared pieces in
     `apps/web/src/components/ui`.
   - The games origin's loader sends one message on the player's first input since load (pointer, key, touch,
     gamepad), origin checked on both sides. Reply says what must be uploaded (deploy games / re-export) and that old
     builds keep today's behaviour if so.
2. Build time on each AI answer's meta line: "Best, high effort · 20 min · 61.4 credits · version 1". From the run's
   start to end, without queue time. 40 s, 1 min .. 59 min, 1 h 5 min. Every answer that ran, stopped too. At 320/390 px
   wraps only between items. One place in the code.

Tests: `npm run check`; e2e/walk-through via `scripts/test-run.mjs` (fake builds): change finishing after a key press in
the game (bar, Restart, Later, chip), finishing with no input (loads by itself), a restore (loads at once); time on a
finished, stopped and failed answer. Screenshots: bar at 390, 1440, full screen; answer lines at 320, 390, 1440.

Limits: ChatLog: only the answer's meta line (attach session works there). No deploy, no merge, no local-site update.
Commit + push branch `update-bar`. No hourly reminder, no shutdown (HQ).

## Steps

- [x] Read GameFrame, game page, ChatLog meta line, games loader (play.html), message API (timestamps)
- [x] Games origin: first-input message from the loader
- [x] Web: update bar + chip (shared ui pieces), GameFrame logic, full screen + phone
- [x] Build time on the meta line (server data if needed, one formatter)
- [x] npm run check (passed; again after the review fixes)
- [x] e2e / walk-through with fake builds: the three update cases + time on finished/stopped/failed
  (`apps/web/scripts/shot-update.mjs`: 40/40 first run; API e2e: finishedAt checks pass)
- [x] Screenshots looked at (bar 390/1440/full screen; lines 320/390/1440). Found: in the desktop iPhone preview the bar
  was squeezed into the drawn phone (4 lines, Later spilling out): moved the page's bar to the stage screen.
- [x] Skills review pass (impeccable critique+audit, emil on motion, mobile-native, break-ui): three review agents
  (design critique, detector, audit + phone + worst case). Detector: 0 findings. Fixed from them: see "Review fixes".
  Confirmation run of the walk-through after the fixes.
- [x] Commit + push `update-bar`
- [ ] Final report

## Decisions

- **Parent origin in play.html**: `location.ancestorOrigins[0]` (Chromium, Safari), else the referrer's origin (Firefox;
  the site sends strict-origin-when-cross-origin, Caddyfile). Allowed: `https://typeplay.app`, plus any
  `http://localhost|127.0.0.1:<port>` only when the loader itself runs on a local host (test runs pick ports at random).
  Posted with that exact targetOrigin; the site checks `e.origin === gamesOrigin` and `e.source`. Unknown parent: nothing
  sent, so the site loads a new version at once (today's behaviour). The existing ready/error/escape keep "*" (no data in
  them; changing them was not asked, and a missing referrer would then break "ready").
- **What counts as input**: trusted pointerdown/touchstart/keydown (not Escape: it is the site's way out of full screen),
  and a gamepad button (or a standard-layout stick past 0.5), polled per frame once a pad shows itself. Only after the game
  is ready ("since it loaded" = since its first frame); once per load.
- **AI-made vs restore**: a version is AI-made when an agent message has `versionN === currentVersion`; a restore makes a
  version with no message (and reuses an old buildId), so it loads at once.
- **One frame for every version** (Stage passes key="game" instead of key={buildId}; GameFrame resets its load state when
  the slug changes): Restart and a by-itself load no longer drop the player out of full screen (on phones every play is full
  screen, so Restart would otherwise kick them out each time).
- **Where the bar sits**: a Toast (ui) over the top of the game. On the page the stage places it over the drawn game
  (`.stage__update` in `.stage__fit`, so a scaled device preview doesn't shrink it); in full screen the frame shows its own copy
  (`bar` prop, `.gameframe__bar`, below the close circle on narrow screens like the ready notice) and the page's hides. After
  Later, a small InkPill "New version" chip in the same place. Restart = hot small Button; Later = Ink Recess small pill.
- **One announcer**: an sr-only "Version N is ready. Your game keeps running until you restart it." in the stage's existing
  live line; the bar copies are not live regions. Focus never moves when it shows; after Later the keyboard goes back to the
  game (where the player was); after Restart the frame's ready handler gives the game the keyboard (desktop), as today.
- **Versions strip**: while a version waits, its card says "Ready to play" instead of "Playing now" (the frame plays an
  older one; otherwise the page contradicts itself).
- **Build time**: `Message.finishedAt` added to the API view (the column existed since 10-26). Shown only when both
  startedAt and finishedAt exist: answers from before 10-26 and builds that never started show none. Rounded: under 60 s
  "N s", then whole minutes to "59 min", then "1 h 5 min". The line is built by `figuresLine` (non-breaking spaces inside
  each item, the dot kept with the item before it), so it wraps only between items.
- **Bar on the page sits against the stage screen**, not the device box (first try did; an upright phone preview is
  ~230 px wide and squeezed it). In Fill mode that's the same place.
- Night log named `2026-11-04-update-bar.md` (two sibling night sessions write their own logs; distinct names never conflict).

## Review fixes (critique + audit, applied in one batch)

- Restart and the chip ignore a press in their first 700 ms (a tap meant for a tap-anywhere game could land on Restart as
  it appears and throw the run away). Test: an immediate press does nothing, one a moment later restarts.
- The chip gets the toast's 2px sky-3 edge (new `InkPill float` look, in ui): Ink Recess alone vanished on dark games.
- Versions strip: the card of the version in the frame says "Playing now" (no Restore), the waiting one "Ready to play".
- Full screen: the bar drops under the close circle only where a wide game is letterboxed on an upright phone (elsewhere
  the close tab is on the left edge, and 64 px down pushed the bar into the playfield).
- While a version waits, the frame keeps the running build's shape (orientation, platform, device default); a version made
  for another screen no longer reshapes the old game or shows the rotate hint over it. Test with a FILL change.
- Full screen on a phone re-locks the orientation when a new version with another way up loads in the same frame.
- A restore of the build already running no longer resets `touched` (it loads nothing, and the loader sends input once).
- play.html: `navigator.getGamepads()` guarded (a permissions policy may throw; it would have killed the game through the
  loader's catch); Tab, F-keys, modifiers alone and media keys don't count as playing.
- Keyboard: the game keeps every key (Godot prevents Tab), so Escape in the game focuses the bar's Restart; after Restart the
  keyboard stays in the frame. Restart's name "Restart with version N", Later's "Later: keep playing".
- A version that loads by itself no longer takes the keyboard from the chat's box (the frame focuses the game on "ready"
  only when focus is on the page body or the frame). Existed before, but this flow is exactly when it happens.
- The first Play no longer reloads the game right after its first frame: `mark=quiet` in the frame's address is fixed when
  the frame loads a game (it flipped with `played`). Existed before; it could also eat the player's first input.
- Under 360 px Restart shows its word without the arrow.
- API: an interrupted run (the server went down) keeps `finishedAt` empty, so its answer shows no build time rather than
  one that counts the downtime.

Not done (noted for Luka): auto-folding the bar into the chip after a few seconds (the brief has Later; toasts here never
go by themselves); a keyboard shortcut for Restart; the full-screen "ready" notice is paper while this bar is an ink toast
(the existing notice was not part of the task); the chat's Play under the newest answer on a phone opens the Play tab
(where the bar is), it doesn't restart.

## Results

- `npm run check`: passes. API e2e (`npm run test:e2e -w @typeplay/server`): all passed (597 checks, with the new
  finishedAt ones: a finished, a failed and a stopped run have both times; one that never left the line has neither).
- Walk-through `apps/web/scripts/shot-update.mjs` (own stack, fake builds): 49/49 after the review fixes. Shots in
  `.impeccable/review/update/`: bar-1440, bar-1440-laptop, chip-1440, bar-fullscreen-1440, bar-390, bar-320, chip-390,
  bar-fullscreen-390, lines-1440, lines-390, lines-320.

## For Luka

- **Deploy note:** the first-input message lives in `apps/games/play.html`, the one loader every build uses, so one
  `node deploy/deploy.mjs games` gives it to every game, old builds too; no builds re-export. play.html is served
  no-cache, so it takes effect on the next load. Until it is uploaded (or for a page that still has the old loader), the
  site never hears "input" and loads each new version at once, exactly as today. The site and API parts go out with the
  next site and API deploy after HQ merges.
- **Check on a real phone** (can't be done here): the bar in full screen on Android Chrome and iPhone Safari (the iPhone
  uses the fixed layer, not real full screen), and Restart staying in full screen. A gamepad game in Firefox is untested.
- **Try it:** play a game on its page, send a change, keep playing: when it's done, "Version N is ready." with Restart and
  Later sits over the top of the game; Later leaves a small "New version" pill. Not touching the game: it loads by itself.
- Suggestions from the review, not built (each is one line here): fold the bar into the chip by itself after a few
  seconds of play (the brief has Later, and toasts here never go by themselves); a keyboard shortcut for Restart; the
  full-screen "Your game is ready" notice is a paper pill while this bar is an ink toast; on phones the versions strip
  re-snaps to the card it showed, so a new first card can sit off-screen to the left (existed before).
- The build time is a trial: `ChatLog.tsx` has one `ran` line and its place in the figures line; drop both to take it out.
