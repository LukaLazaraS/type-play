## This is a change to an existing game

The game already works and the player likes it. Read `NOTES.md` first, then the scripts the
change touches and the scripts it has to work with.

- **Fit the change into the game as if it had been planned from the start.** New things work
  with what is already there: place new objects relative to the existing ones (pickups over
  or between obstacles, never inside them; everything reachable with the player's moves),
  hook into the existing systems (the obstacle spawner, scoring, game over, restart,
  difficulty ramp) rather than adding a separate system beside them, and match the game's
  palette, style and animation quality.
- **Keep everything else as it is**: look, feel, controls, numbers and other features. Edit
  the lines that need it rather than rewriting files.
- **A request about a number ("faster", "harder", "too slow", "bigger") is one clear step, about
  +25-40%**, so the player can ask again. Change it only for the thing they named: grep for who
  else uses that number (rivals, enemies, other levels, a test) and give those their own value.
  Say how much in your last message ("about 30% faster").
- **An asset named with a handle in brackets** (the game page's list of assets writes `Change the sound “Jump” (jump)
  louder`, `Change the picture “Tower base saw 2” (tb_saw_2) so it glows`): the handle is the look's key in `Looks.add`, the sound's
  name in the code, or the file's path in the game. Change that one thing in place, as asked.
- **Pick the simplest design that does what was asked** and build it; don't weigh alternatives
  at length. The player can ask for more.
- Everything NOTES.md lists as "must not break" keeps working, unless the player asks to
  change exactly that: the player decides; then update NOTES.md.
- **Keep it fast** ("Fast games"): a new look goes into `Looks` and the warm-up, a new thing that
  multiplies (enemies, bullets, towers, pickups) into the stress test's busy moment at its cap. A
  game without `test/stress_test.tscn` gets one when the change adds such things, and whenever the
  player says it is slow, laggy, stutters or freezes: then find what grows with play (things redrawn
  every frame, searches per frame, nodes never freed, a world that only grows) and fix it by the rules.
- **Test what you changed.** If the change adds or changes how something behaves (a move, a
  pickup, a rule, an enemy, a power-up), add a feature test (see "Feature tests"): start the
  game, drive it like a player (or call the game's functions), and check the behaviour at
  least 3 times in a row (for a double jump: jump, double jump, land, and again). Under ~60
  lines. The check runs every test in `test/` after every change, so what earlier changes
  added keeps working; if an older test fails, your change broke it: fix the game, not the
  test. Purely visual changes (colours, text, sizes) need no test.

Then run the check, look at the screenshots, and update NOTES.md.
