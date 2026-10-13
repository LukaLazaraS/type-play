# Godot check: results (2026-10-12)

One short prompt, no human steering, Godot 4.7.2, web export, on Luka's Max (costs are the
SDK's API-price estimates, effort `high`). Raw data: `runs.jsonl`. Games: `output/` (git-ignored).

| Test | Model | Minutes | Turns | Output tokens | $ at API prices | Final check | Luka |
|---|---|---|---|---|---|---|---|
| 2D runner (new) | Sonnet 5.5 | 3.2 | 12 | 14K | **0.42** | OK | **9/10** ("very simple but") |
| 2D runner (new) | Opus 5.5 | 6.1 | 16 | 34K | 1.46 | OK | |
| 2D runner (new) | Haiku 5.5 | 12.0 | 43 | 120K | 0.42 | OK | |
| 3D car + coins in a town (new) | Sonnet 5.5 | 6.1 | 10 | 46K | 0.76 | OK | |
| Edit: coins + double jump | Sonnet 5.5 | 2.0 | 10 | 22K | 0.62 | OK | |

Prompts: "Make an endless runner where a little robot jumps over cactuses and it gets faster
over time." / "Make a 3D game where I drive a little car around a small town and collect
coins before the time runs out." / edit: "Add coins floating in the air to collect, and let
the robot double jump."

## What it proves

- **The core works.** Every model built a working, good-looking game from one sentence, 2D
  and 3D, with a title screen, score, difficulty ramp, game over and restart, and keyboard +
  touch controls. No asset files: everything drawn in code or built from primitive meshes.
- **3D is not much harder**: 1.8× the cost of 2D on Sonnet; the check passed first time.
- **The self-check loop works**: the agents fixed real errors it reported (e.g. Haiku used
  `Color.with_alpha()`, which doesn't exist) and fixed looks after reading the screenshots
  (Sonnet re-lit the 3D town because the colours were washed out).
- **Web export:** ~3 s from the command line; plain static server, no COOP/COEP headers;
  engine `index.wasm` 39.5 MB (same for every game, cache once), game `index.pck` small.
- **Sonnet is the default:** fastest, cheapest, and the 9/10 game. Opus: more polish for
  3.5× the cost. Haiku: good result, but wanders.

## What to fix in agent core

1. **Edits cost too much ($0.62, more than the build).** Resuming the build session re-reads
   the whole build history every turn (1M cache-read tokens), and the cache had expired
   between messages so it was re-written. → Start each edit as a fresh session with short
   project notes the agent keeps (`NOTES.md`: what the game is, files, key numbers), and keep
   the cache warm while the user is active. Target ~$0.15-0.25 per edit.
2. **Haiku needs a leash for the free tier**: 43 turns and 120K output, and its context went
   past 100K tokens (Haiku's 5× price tier). → Turn cap, smaller context, start from a genre
   template. Target ~$0.10 per build.
3. **Replies to the player are too technical** ("the automatic check passes", "I didn't play
   it through"). → Rules: the last message is for a non-developer; checks are never mentioned.
4. **The check never sees game over.** → Add a later screenshot with no input (the player
   crashes) so the agent sees the game-over screen.
5. **Haiku looked outside its folder** (`ls ../..`, read the check script). Harmless here; on
   the server each project runs in its own container.
