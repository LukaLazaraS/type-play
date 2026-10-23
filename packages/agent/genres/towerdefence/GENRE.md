## Genre: tower defence (enemies walk a road, the player builds towers beside it)

Use these as defaults, then make the game the player's own: theme, towers, enemies, one twist.

- **Portrait**: top bar (heart + lives, coin + gold, "Wave 2/8" + level name), the map, a
  bottom panel: status line, 1x/2x speed and "Next wave" buttons, tower cards (drawn tower,
  name, price; dimmed when too expensive). The bars stick to the screen's top and bottom
  edges, the map is centred between them, extra height is filled with grass and trees.
- **Scripts**: `main.gd` (states TITLE / PLAY / WON / LOST, gold, lives, build / upgrade /
  sell; test hooks `start_level(i)`, `try_build(cell, kind)`, `try_upgrade(t)`, `try_sell(t)`,
  `send_next_wave()`), `levels.gd` (per level: road waypoints in cells, colours, start gold,
  wave count; `build_wave(level, w)` and hp / speed formulas), `waves.gd` (spawn queue,
  countdown), `map.gd` (grid, taps, layers), `tower.gd` (+ static `draw_shape(canvas, kind,
  level, aim)` also used by the cards and the title), `enemy.gd`, `projectile.gd`, `fx.gd`,
  `hud.gd`, `screens.gd`, `ui.gd`.
- **Map**: 9×11 cells of 80 px between the bars. The road is a list of waypoints from a spawn
  portal at one board edge to the base (castle, gate) at another, 4-6 turns so towers cover it
  twice. Checkered grass, road with a darker edge, seeded tufts / flowers / rocks, trees outside
  the grid. Draw the map once in `map._draw()`; the portal swirl, selection pulse and range
  circle go in a small overlay node that redraws every frame.
- **Build**: tap a grass tile (it pulses), then a card: the tower pops in. Or tap a card, then
  tiles. Tap a tower: range circle, and the cards swap for its stats + Upgrade (price) / Sell
  (70% back). Not on the road or another tower; "Not enough gold!" toast.
- **Towers** (4 if asked): fast archer (cheap), cannon (splash), frost (slows), long-range or
  chain lightning. Target the enemy furthest along the road, turn to face it, recoil on a shot.
  3 levels: damage ×1 / 1.75 / 2.9, range +12% / +25%; upgrade costs 0.8× then 1.4× the price;
  level pips under the tower.
- **Enemies**: grunt, fast scout (wave 2+), tough brute (wave 3+), boss on the last wave; hp
  bar, hit flash, blue tint when slowed; 5-15 gold each, boss 100, leak costs 1 life (boss 10).
- **Waves**: first wave after a 15 s countdown, 8 s between waves; "Next wave" sends one early;
  speed via `Engine.time_scale` (back to 1 on menus). Size 7 + 2w (+2 per level); hp ×(1 +
  0.2w + 0.015w²) × 1 / 1.4 / 1.9 per level; clear bonus 20 + 5w. Toasts: "Wave 3!", "FINAL
  WAVE!", "A BOSS appears!", "Wave cleared! +35". Space = Next wave while playing (the check's
  tap starts level 1 and its Space sends wave 1, so the screenshots show enemies walking).
- **Title** over the level-1 map with a demo (a few towers, enemies walking): name, tower
  icons, big PLAY, levels below (locked ones greyed; a win unlocks the next, saved with
  `ConfigFile`). Win: stars by lives left, "Next level"; lose: "Retry" / "Menu".
- **Juice**: tower pop-in + dust; upgrade squash + gold ring; kill burst in the enemy's colour
  + floating "+7"; leak: shake + red flash.
- **Tests** (the check's tap + Space never builds a tower, so only these prove the game):
  `test/core_test`: through the hooks, building on grass costs gold and on the road fails,
  upgrade and sell work, tapping a tile then a card builds; then a full wave: send it, enemies
  walk the road, towers kill some (gold up), a leak costs a life, 0 lives shows the lose screen.
  `test/balance_test`: a bot builds on the cells nearest the road and upgrades, plays all of
  level 1 at `Engine.time_scale = 8`, and must win.
