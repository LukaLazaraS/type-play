## Genre: adventure (explore a small world, talk to characters, take quests, find items and keys; light RPG stats like health, level and gold; seen from above or from the side)

Use these as defaults, then make the game the player's own: theme, hero, places, one twist.

- **What makes it**: a small world of 3-5 connected areas (a village, a forest, a cave, …), a
  few characters who talk and give a quest ("find my lost cat", "bring 3 crystals"), items that
  open the way on (a key, a lantern, a bridge plank), a few enemies or obstacles, and an ending.
  Light stats: health (hearts), gold, and a level that rises with experience (more health and
  damage). It is about discovery, not grinding: 10-20 minutes to finish.
- **View**: top-down by default (landscape, the hero in the middle, a `Camera2D` with limits at
  each area's edges); side-on only if the idea asks.
- **Scripts**: `main.gd` (states TITLE / PLAY / DIALOGUE / MENU / WON / OVER, area loading,
  saving to `user://`), `world.gd` (areas as Arrays of strings, one letter per 64 px tile, with
  exits to the next area), `player.gd` (`CharacterBody2D`), `npc.gd`, `enemy.gd`, `items.gd`
  (inventory, pickups, what each item opens), `quests.gd` (each quest: steps, state, reward),
  `dialogue.gd` (lines as data, a box along the bottom, one tap or key per line), `hud.gd`,
  `sfx.gd`.
- **Controls**: arrows / WASD to walk, Space or E to talk, pick up and open (one action: what is
  near), J or a click to attack, I or Tab for the bag, Escape to pause. Touch: the virtual
  joystick on the left, a context button bottom-right (its icon says talk, open or pick up) and
  an attack button beside it, a bag button in the top corner (the rules above).
- **Show the way**: the current quest's goal in one line at the top ("Find the key in the
  cave"), a "!" over a character with something to say, items that glint.
- **Juice**: a soft bounce on pickups with "+1 Crystal", a hit flash and knockback in fights,
  a level-up fanfare with the new stats, a short fade between areas.
- **Pitfalls**: never a dead end: the needed key or item can't be lost or sold. Dialogue must
  pause the game and take the confirming tap only once (no skipping two lines). Area exits put
  the hero just inside the new area, not on the exit again. Save the progress (area, items,
  quests, stats) so a reload continues.
- **Test**: `test/core_test.tscn`: start, walk to the first character, talking shows the quest,
  picking up the quest item and bringing it back finishes the quest and gives the reward, a
  locked way opens with its item, an exit loads the next area, losing all health shows game over.
