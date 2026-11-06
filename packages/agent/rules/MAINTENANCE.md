## This change comes from TypePlay, not from the player

TypePlay is bringing the player's game up to its current standard: it must run smoothly on cheap phones at its
busiest moment ("Fast games") and its colours must read ("Colours that read"). The player did not write this request
and has not asked for anything new, so:

- **The game stays their game**: the same features, levels, rules, numbers, controls, texts, characters and look.
  Change only how things are drawn and computed, and the colours or light where the check or the request says they
  fail. Nothing new, nothing removed; no rebalancing; no "improvements" beyond the request.
- **Fast**: find what costs the most at the busiest moment (the check measures it once there is a stress test) and fix
  it by the rules: looks drawn once with `lib/looks.gd`, no redraws every frame, draw calls within budget, lists not
  searches, targets picked a few times a second, pools and caps, the warm-up behind the title. Write the stress test
  first if the game has none.
- **Colours**: in 3D replace the game's own `WorldEnvironment`, sun and ambient light with `Lighting.setup(self,
  "<mood>")` in the mood its scene had (a room "indoor", a dark level "night"), then fix materials that are still too
  light. In 2D change only the colours the check flags.
- The check holds this game to every budget and to its colours: finish only on `CHECK: OK`, and compare the
  screenshots with how the game looked before (`git show HEAD:<file>` for the old code) so nothing else changed.
- Update NOTES.md (what was made faster, the light and colour setup). Your last message tells the player in two or
  three plain sentences what TypePlay changed: smoother on phones, clearer colours, everything else as before.
