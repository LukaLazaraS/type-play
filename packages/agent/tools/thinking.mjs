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
//   - then, once the planning line has stayed 45 s, "Still planning: big games take a few minutes", and nothing more
//     until a tool line takes over. No minutes in it (10-29): they counted from the last tool line, not from the start,
//     so it said "1 min so far" under the chat's 4:43 timer, which shows the time.
// state = { since } is run.mjs's to keep: `since` is zeroed when a tool line or text arrives.
export const FIRST_AFTER_MS = 8_000;
export const THINK_FOR_MS = 3_000;
export const EVERY_MS = 45_000;

export function thinkingLine(state, now, isEdit, shown) {
  if (!state.since) state.since = now;
  const text = shown?.text ?? '';
  // Without `shown` (an older run.mjs) the line counts from the first thought.
  const lineSince = shown?.since ?? state.since;
  if (!/^(Planning|Still planning)/.test(text)) {
    if (now - lineSince < FIRST_AFTER_MS || now - state.since < THINK_FOR_MS) return '';
    return isEdit ? 'Planning your change…' : 'Planning your game…';
  }
  if (text.startsWith('Still planning') || now - lineSince < EVERY_MS) return '';
  return `Still planning: ${isEdit ? 'bigger changes' : 'big games'} take a few minutes`;
}
