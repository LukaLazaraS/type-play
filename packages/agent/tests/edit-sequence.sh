#!/usr/bin/env bash
# Sends each line of an edits file as a follow-up change to one game, in order.
#   bash tests/edit-sequence.sh <game> tests/edits-runner.txt [--model auto]
cd "$(dirname "$0")/.." || exit 1
game="$1"; file="$2"; shift 2
while IFS= read -r edit; do
  [ -z "$edit" ] && continue
  node run.mjs --game "$game" --edit --prompt "$edit" "$@" | grep -E "^(EDIT|--- |    claude|Haiku's)" 
done < "$file"
