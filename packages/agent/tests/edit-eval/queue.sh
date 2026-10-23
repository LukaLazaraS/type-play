#!/usr/bin/env bash
# The 2026-10-19 edit test (RESULTS.md "chat edits on big games"): five Opus showcase games, edits typed like a
# player, Fast (Haiku medium) in a sequence per game, then four of them again on Smart (Sonnet) on fresh copies.
# One at a time, through tools/cpu.mjs (edit-eval.mjs does that). About 1.5 hours and ~$1 of API-priced work.
#   bash tests/edit-eval/queue.sh [fast|smart|stress]      (default: fast; run from packages/agent)
# Re-run after a change to rules/EDIT.md or the model, then compare with RESULTS.md. Copies are made with tests/fork.mjs.
cd "$(dirname "$0")/../.." || exit 1
ev() { node tests/edit-eval/edit-eval.mjs "$@" 2>&1 | tail -3; }
copy() { [ -d "output/edit-show-$1" ] || { node tests/fork.mjs "show-$1" "edit-show-$1" && ev --copy "edit-show-$1" --baseline; }; }
fast() { # <game> <id> <prompt>
  ev --copy "edit-show-$1" --id "$2" --model haiku --prompt "$3"
}
case "${1:-fast}" in
  fast)
    for g in td racer match3 3d runner; do copy "$g"; done
    fast td     td1-fast "Add a sixth tower that slows down all the bugs around it."
    fast td     td2-fast "The bugs are too easy. Make the game harder."
    fast td     td3-fast "Make it night time."
    fast racer  r1-fast  "The car turns too slowly."
    fast racer  r2-fast  "I can't read the hint text on the sand. Please make it easier to read."
    fast racer  r3-fast  "Add a shield power-up on the road that protects me from the next bump."
    fast match3 m1-fast  "Add two more levels."
    fast match3 m2-fast  "Add a new special piece, like a butterfly that clears the flowers around it."
    fast match3 m3-fast  "Make it night time."
    fast 3d     d1-fast  "Make it night time."
    fast 3d     d2-fast  "Let the character double jump."
    fast 3d     d3-fast  "The character is too slow. Make it run faster."
    fast runner n1-fast  "The crows and drones should be faster."
    fast runner n2-fast  "Add a power-up that slows down time for a few seconds."
    fast runner n3-fast  "Add a new obstacle, a laser that blinks on and off across the rooftop."
    ;;
  stress) # bigger asks, after the fast sequences
    fast td     s1-fast "Add a fourth map."
    fast racer  s2-fast "Add a second track that I can pick on the title screen."
    fast match3 s3-fast "Add a hammer button that breaks one flower, 3 uses per level."
    fast 3d     s4-fast "Add a fourth level in a desert."
    ;;
  smart) # the first edit of four games, on fresh copies of the untouched showcase games
    for g in td racer match3 3d; do node tests/fork.mjs "show-$g" "edit-show-$g-smart" && ev --copy "edit-show-$g-smart" --baseline; done
    ev --copy edit-show-td-smart     --id td1-smart --model sonnet --prompt "Add a sixth tower that slows down all the bugs around it."
    ev --copy edit-show-racer-smart  --id r1-smart  --model sonnet --prompt "The car turns too slowly."
    ev --copy edit-show-match3-smart --id m1-smart  --model sonnet --prompt "Add two more levels."
    ev --copy edit-show-3d-smart     --id d1-smart  --model sonnet --prompt "Make it night time."
    ;;
esac
