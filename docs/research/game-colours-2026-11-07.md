# Why some games are washed out, and what the builder does about it (2026-11-07)

HQ asked, for Luka: Buzz Bite (a tester's 3D game in the gallery) shows an almost white room, walls and floor washed
out (Luka's screenshot: 79% of it pure white). Other games fail on colours too. Find why, across the public games, with
numbers; fix it in the builder; add a cheap automatic check if one can catch it.

## The answer

**3D games are lit about twice as bright as their numbers say, and the agent lit them by the numbers.**
- Every TypePlay game runs on Godot's **Compatibility renderer** (WebGL 2 on the web; the Android export too). It draws
  a light that **casts shadows** in extra passes added on top of the first one, and adds them in sRGB space. With an
  ambient light on as well, the result is far brighter than the sum: measured on grey tiles, a sun of 0.65 plus an
  ambient light of 0.3 lit a mid grey (#808080) to #b6b3af instead of #7d7d7d, and a light grey (#c0c0c0) to pure white.
  The same two lights with the sun's shadows off: #817e7a (correct). Each light alone: correct.
- This is Godot's known behaviour, issue [#90259](https://github.com/godotengine/godot/issues/90259) ("Compatibility
  renderer: lights seem brighter when their shadows are enabled", open; the maintainers call it intended: shadowed
  lights are multi-pass and blend in sRGB). The workarounds named there: about a quarter of the light energy, or little
  ambient light.
- Our rules told the agent to use "a DirectionalLight3D with shadows, a WorldEnvironment", nothing about amounts. So it
  wrote what looks right in Godot's other renderers: a sun of 1.0-1.3 with shadows and an ambient light of 0.5-0.8.
  Buzz Bite: sun 1.05 with shadows, ambient colour 0.6, Filmic. Light walls, tiles, ceiling and furniture then go past
  white, and green grass clips to mint (the green channel saturates first, the others keep rising).
- **Tonemapping doesn't save it.** Filmic at Godot's default white of 1.0 clips at 1.0 like Linear; AgX and Filmic
  with a higher white only soften it: the Buzz Bite kitchen rebuilt in a test scene was 71% pure white as is, 53% with
  AgX or Filmic white 6 at the same light, and 0% with the light below.
- **Buzz Bite's outside start looks fine** (1% white 3 s into play): the white room appears once you fly in. The
  check's screenshots only saw the first 13 seconds.

**2D games** have no lights, so nothing doubles there. Two of our old home-page games are pale and flat by palette
(Robot Runner, Desert Dash: lightness 184-195 of 255, only 70 between their darkest and lightest parts, white text on a
light sky). Dark games (night runners, a dark puzzle board) read fine: 20-56% near black is a style, not a fault.

## The public games, measured (2026-11-07)

The check's hidden browser (software WebGL, the same shader maths as a GPU), each game from typeplay.dev: 3 s after a
tap + Space ("play") and 5 s later. Lightness and contrast in 0-255 (contrast: the 95th minus the 5th percentile of
lightness); pure white = every channel ≥ 250, near white ≥ 235, pale = every channel ≥ 200.

| Game | Shot | Light | Pure white % | Near white % | Pale % | Near black % | Contrast | Verdict |
|---|---|---|---|---|---|---|---|---|
| Buzz Bite (Luka's screenshot, in the house) | - | 219 | 79.2 | 79.5 | 80.5 | 0.0 | 219 | washed out |
| Buzz Bite (3D) | play | 143 | 0.9 | 1.0 | 1.9 | 0.0 | 208 | ok (outside; the rooms are the problem) |
| Mosquito Night (3D) | play | 116 | 11.5 | 14.8 | 17.4 | 2.9 | 224 | washed out |
| Little Car (3D) | later | 177 | 4.5 | 10.5 | 10.7 | 0.0 | 204 | ok by the limits; mint grass by eye |
| Sky Hopper (3D) | play | 189 | 1.4 | 1.5 | 10.0 | 0.0 | 186 | ok by the limits; a player asked for "richer, greener" grass |
| Town Driver 3D | play | 138 | 1.7 | 1.8 | 9.9 | 0.0 | 206 | ok |
| Robot Runner (2D) | play | 195 | 0.0 | 0.0 | 0.1 | 0.0 | 71 | washed out (bright and flat) |
| Desert Dash (2D) | play | 184 | 0.3 | 1.1 | 1.1 | 0.0 | 70 | washed out (bright and flat) |
| Petal Pop | play | 150 | 0.7 | 1.4 | 13.5 | 0.2 | 208 | ok |
| Fruit Match | play | 184 | 0.2 | 0.2 | 10.5 | 0.0 | 203 | ok |
| Island Rush | play | 140 | 1.1 | 2.7 | 6.2 | 0.0 | 167 | ok |
| Gingerbread Guard | play | 171 | 0.2 | 0.4 | 2.4 | 0.0 | 187 | ok |
| Sparkle Cleaners | play | 146 | 0.1 | 2.4 | 4.8 | 0.0 | 159 | ok |
| Sky Stack | play | 103 | 0.0 | 0.1 | 3.2 | 0.3 | 193 | ok |
| Dead Haul | play | 80 | 0.1 | 0.3 | 0.9 | 6.4 | 114 | ok |
| Scrap Siege | play | 58 | 0.0 | 0.0 | 0.5 | 9.1 | 82 | ok |
| Tank City | play | 49 | 0.2 | 0.5 | 1.1 | 19.8 | 131 | ok |
| Rooftop Ninja | play | 45 | 0.0 | 0.1 | 0.5 | 21.8 | 85 | ok |
| Fruit Match Night | play | 52 | 0.4 | 0.4 | 0.6 | 0.0 | 95 | ok |
| Night Runner | play | 66 | 0.0 | 0.0 | 1.6 | 35.3 | 159 | ok |
| Shape Escape | later | 37 | 0.1 | 0.1 | 1.2 | 17.3 | 48 | ok (a night level, readable) |
| Box Push | play | 42 | 0.0 | 0.0 | 0.4 | 55.6 | 110 | ok (a dark board, readable) |

## What changed in the builder

- **`lib/lighting.gd`** (template, copied into every game on every run like the other helpers): `Lighting.setup(self,
  "day" | "sunset" | "night" | "indoor" | "space")` makes the sky, a plain ambient colour, Linear tonemapping and a sun
  with shadows, at amounts measured in the browser to show material colours as picked under the renderer's doubling: the
  sun 0.32-0.55, ambient 0.12-0.2. A sky-coloured ambient light tinted green grass mint, so the ambient is a near-neutral
  colour; AgX dulled the sky (#6fa2e0 picked blue came out #7aa1c2 grey-blue) and Filmic at white 1.0 clipped light
  floors, so the helper uses Linear and keeps white below clipping by the amounts. Test scenes (a kitchen like Buzz
  Bite's, a Kenney grass meadow, a snowy island): the kitchen 46% pure white with Buzz Bite's light → 0.1% with "day", 0%
  with "indoor"; the meadow's grass #c3f5dc (mint) → #58bb83 (green); the snow 12.7% pure white → 1.7%.
- **Rules** (`rules/BASE.md` "Colours that read", the 3D lines, `tags/3d.md`, `25d.md`, `scifi.md`, `rules/FAST.md`):
  3D light only from `Lighting.setup()`, never more light to brighten (stronger material colours instead), big
  surfaces mid colours, near white only for small highlights; 2D backgrounds mid or deep with a themed layer, pieces
  brighter with dark outlines, HUD text outlined or on a bar.
- **The check** (`tools/colours.mjs`, `tools/check.mjs`): measures the play and computer screenshots and a new one at
  the busiest moment (the stress test's browser run, now photographed when `measure()` starts: `test/helpers.gd`
  prints `MEASURING`). A few milliseconds a picture, no AI. Limits: more than 8% pure white, 20% near white or 40% pale,
  or lightness over 180 with contrast under 80 = washed out; more than 70% near black, or lightness under 30 with
  contrast under 60 = too dark. Set from the table above: the games that read well stay under them with room (at most
  1.8% pure white, 2.7% near white, 13.5% pale), the washed-out ones are over. A new game (`TEMPLATE` 3, written by
  run.mjs since today) fails like a failed test; older games get a note, so a tester's next change doesn't suddenly fail.
- **TypePlay's own changes** (`admin run`, `apps/server/README.md`): bring a player's game up to the current template
  (speed budgets and colours) as its next version, free, by the TypePlay account in the game's chat; `rules/MAINTENANCE.md`.

## Limits

- The check judges whole screenshots. A game whose washed-out part is never on screen at 3 s or at its stress test's
  moment still passes; the rules are the first line, the check the safety net.
- Little Car's mint grass and Sky Hopper's pale grass stay under the limits (they clip one channel, not all three).
  The 3D fixes below still take their light from the helper, because the cause is the same.
- A snowfield or a white-paper theme that fills the screen fails by design: the rules say to make snow pale blue-grey
  with shading. Light-coloured games can still be made; they need one deeper layer.
- Not checked: real phones (bright sunlight, OLED), and the other two renderers (we only use Compatibility).

## What was fixed on the website (2026-11-07)

Every game on the website (the gallery's 13 and the home page's 14; the six showcase games are in both) got TypePlay's
maintenance change (`run.mjs --maintenance`, Sonnet high): its own project, the same features and look apart from the colour
fix, held to every speed budget and the colour check. The testers' seven on the live server (`admin run`, our key; each the
game's next version with the chat kept and the version before restorable); ours on this PC from their projects, published as
new builds (the home page's slugs in `apps/web/src/content/games.ts`, the gallery's through `admin gallery showcase`). The
same first-visit measurement on both builds (a fresh browser, 4× slower CPU; draw calls a frame on the title and in the first
8 s of play, shaders compiled after the first tap), and the colour verdict 8 s into play:

| Game | Build before → after | Draw calls title / play, freezes before | After | Colours |
|---|---|---|---|---|
| Dead Haul | l4fo6bytz6-v3 → v4 | 583 / 570, 1 | 241 / 115, 0 | ok → ok |
| Scrap Siege | rwrcgqhnik-v5 → v6 | 1528 / 1301, 0 | 74 / 127, 0 | ok → ok |
| Sparkle Cleaners | i9ffyvejxg-v2 → v3 | 1287 / 1080, 0 | 118 / 83, 0 | ok → ok |
| Shape Escape | pm0krhm73s-v7 → v8 | 667 / 586, 1 | 189 / 108, 0 | ok → ok |
| Tank City | pyudgc4gzc-v1 → v2 | 322 / 274, 1 | 320 / 276, 0 | ok → ok |
| Buzz Bite | kktodcn7nf-v1 → v2 | 473 / 573, 2 | 261 / 290, 0 | in the house 79% pure white → 0% (its busiest moment, inside) |
| Mosquito Night | ukxn2q2blx-v1 → v2 | 1547 / 1437, 0 | 263 / 246, 0 | 11% pure white → 0% |
| Island Rush | show-racer-polished → -v3 | 196 / 168, 0 | 137 / 102, 0 | ok → ok |
| Sky Stack | show-arcade-polished → -v3 | 401 / 374, 0 | 59 / 32, 0 | ok → ok |
| Gingerbread Guard | show-td-polished → -v3 | 417 / 211, 0 | 185 / 211, 0 | ok → ok |
| Petal Pop | show-match3-polished → -v3 | 1322 / 1741, 0 | 208 / 117, 0 | ok → ok |
| Rooftop Ninja | show-runner-polished → -v3 | 559 / 492, 1 | 269 / 116, 0 | ok → ok |
| Sky Hopper | show-3d-polished → -v3 | 795 / 744, 1 | 300 / 251, 0 | pale grass → green |
| Robot Runner | robot-runner → -v2 | 14 / 12, 1 | 27 / 26, 0 | washed out → ok |
| Fruit Match | fruit-match → -v2 | 941 / 876, 0 | 18 / 11, 0 | ok → ok |
| Town Driver 3D | town-driver → -v2 | 438 / 426, 0 | 163 / 153, 0 | ok → ok |
| Night Runner | night-runner → -v2 | 16 / 36, 1 | 110 / 112, 0 | ok → ok |
| Fruit Match Night | fruit-match-night → -v2 | 1114 / 1111, 0 | 22 / 20, 0 | ok → ok |
| Desert Dash | desert-dash → -v2 | 35 / 34, 0 | 21 / 19, 0 | washed out → ok |
| Box Push | box-push → -v2 | 70 / 61, 0 | 19 / 10, 0 | ok → ok |
| Little Car | little-car → -v2 | 407 / 251, 0 | 224 / 219, 0 | mint grass → green |

The gallery's showcase "before" is its first build (show-*-polished); the home page already played the 11-04 night's `-v2`
of four of them. Tank City's title measured 320 in this run (the server's check passed it under 300: its title has a moving
demo). Not touched: the four private games on the server, and the home page's "say what to change" demo (four versions of the
robot runner, parked #14).

**Capacity found on the way:** three builds at once can pass the runner's 5.5 GB on the API server with today's check (the
hidden browser took 4.7 GB on Mosquito Night's 1,300 draw calls); the kernel killed four of the first agent runs (they failed
cleanly: nothing charged or published, one failed answer each in the testers' chats). The rest ran two at a time, the heavy 3D
ones alone.
