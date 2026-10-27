## Tag: Roguelike (a new run every time, upgrades along the way)

- **Runs**: each run is built fresh from a seed (`RandomNumberGenerator`): the rooms, levels,
  enemy placement and loot change every time, from hand-made pieces joined at random so every
  run stays fair and finishable.
- **Permadeath**: losing ends the run; a summary shows how far the player got, what they found
  and the best run so far; one tap starts a new run.
- **Choices along the way**: after a room, a wave or a level, pick 1 of 3 random upgrades (more
  damage, a new ability, more health, a twist); the upgrades stack, so each run plays
  differently.
- **Light meta progress** if it fits: a currency kept between runs (saved in `user://`) that
  unlocks a new hero or a small permanent boost, never so strong that the first runs feel
  pointless.
- **Test**: two seeds build two different runs; a run can be lost and restarted; an upgrade
  picked changes the game.
