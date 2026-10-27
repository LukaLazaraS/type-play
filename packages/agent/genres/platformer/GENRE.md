## Genre: platformer (the player runs and jumps between platforms through levels, stomping or avoiding enemies, to reach a goal; the player moves left and right themselves, the screen does not scroll on its own)

Use these as defaults, then make the game the player's own: theme, hero, enemies, one twist.

- **What makes it**: hand-made levels (3-5, each a little harder), platforms and gaps, enemies
  that patrol, coins or gems to collect, a goal at the end (flag, door, portal). Falling off or
  touching an enemy's side costs a life and restarts at the last checkpoint; landing on its head
  stomps it (a bounce).
- **Orientation**: landscape: switch the project to landscape first (see "The project"). The
  camera (`Camera2D`, smoothing on, limits at the level's edges) follows the hero, a little
  ahead in the direction of travel.
- **Scripts**: `main.gd` (states TITLE / PLAY / LEVEL_DONE / OVER, lives, score, level
  loading), `levels.gd` (each level as an Array of strings, one letter per 64 px tile: `#`
  ground, `=` platform, `o` coin, `e` enemy, `^` spikes, `P` start, `G` goal, `C` checkpoint),
  `player.gd` (`CharacterBody2D`, physics + drawing), `enemy.gd`, `world.gd` (sky, parallax,
  tiles drawn from the level), `hud.gd`, `sfx.gd`.
- **Feel that works**: run speed ~420 px/s with acceleration ~2400 and friction ~3000 (no ice
  unless asked); gravity ~2400 px/s²; jump velocity ~-900; variable jump (release early: half
  the upward speed); coyote time 0.1 s; jump buffer 0.1 s; fall speed capped at ~1100. One-way
  platforms (`one_way_collision`) for thin ledges.
- **Controls**: ←/→ or A/D to run, Space, ↑ or W to jump. Touch: ◀ ▶ buttons bottom-left and a
  big jump button bottom-right (all ≥ 120 px), pressing the same actions; never tap-anywhere to
  jump here (the thumbs are on the buttons).
- **Juice**: squash and stretch on jump and landing, dust puffs, a stomp pop with a score
  number, coins that spin and sparkle, a short camera shake and blink (1 s of safety) on a hit.
- **HUD**: lives, coins and the level ("1-2") along the top; "LEVEL CLEAR!" with the coins
  collected, then the next level.
- **Pitfalls**: every gap must be jumpable with the numbers above (max jump ~170 px high, ~330
  px far at full run): place platforms from those numbers, never by eye. The hero must not stick
  to walls (no friction against walls while in the air) or fall through thin platforms at speed.
  Enemies turn at ledges and walls instead of walking off. A level's first screen has no enemy.
- **Test**: `test/core_test.tscn`: start, run right, a jump clears the first gap, stomping an
  enemy removes it, touching its side costs a life, reaching the goal finishes the level. Plus
  one test that walks every level's gaps with the jump numbers (each reachable).
