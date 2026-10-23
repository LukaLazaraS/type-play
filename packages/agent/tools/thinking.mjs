// The progress line for the model's silent thinking (run.mjs, `--events`).
//
// A model can think for minutes before its next tool call (10-13 min on a big Opus build, 40-80 s in
// a Haiku edit on a big game). The SDK reports that only as a stream of `thinking_tokens` events: no
// text, no tool call, so the player's progress line would stay on the last tool's words ("Reading the
// game") and the chat would look stuck. Each event calls thinkingLine(); it answers with the line to
// show, or '' when there is nothing new to say. What matters is how long the player's line has stayed
// the same (`shown`: the text on screen and when it last changed), because a thought is often cut into
// pieces by short tool calls that change no line:
//   - nothing until the line has been the same for 8 s and the model has been thinking for 3 s
//     (most thoughts are short and the next tool line takes over);
//   - then "Planning your game…" / "Planning your change…";
//   - then, while the line is still a planning line, a new one every 45 s that says how long it has
//     been ("Still planning: big games take a few minutes (2 min so far)").
// state = { since, planFrom } is run.mjs's to keep: `since` is zeroed when a tool line or text arrives.
export const FIRST_AFTER_MS = 8_000;
export const THINK_FOR_MS = 3_000;
export const EVERY_MS = 45_000;

export function thinkingLine(state, now, isEdit, shown) {
  if (!state.since) state.since = now;
  const planning = /^(Planning|Still planning)/.test(shown?.text ?? '');
  // Without `shown` (an older run.mjs) the line counts from the first thought.
  const lineSince = shown?.since ?? state.since;
  if (!planning) {
    if (now - lineSince < FIRST_AFTER_MS || now - state.since < THINK_FOR_MS) return '';
    state.planFrom = lineSince;
    return isEdit ? 'Planning your change…' : 'Planning your game…';
  }
  if (now - lineSince < EVERY_MS) return '';
  const min = Math.floor((now - (state.planFrom ?? lineSince)) / 60_000);
  return `Still planning: ${isEdit ? 'bigger changes' : 'big games'} take a few minutes${min ? ` (${min} min so far)` : ''}`;
}
