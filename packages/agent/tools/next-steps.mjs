// Next-step ideas (run.mjs, after a run that worked): nine small changes the player could ask for
// next, best first. The chat shows three under the answer, and "More ideas" adds the other six under
// them (Luka, 10-24: "never suggest what the game already has; as the game grows, the suggestions grow
// with it"; 10-25: added, not replaced, so an earlier idea stays in sight). One cheap Haiku call, no
// tools, beside the player-message rewrite, made once per answer; like
// every AI cost a player causes, it is part of that answer's charge (run.mjs `suggestionsCostUsd`).
// What the game has comes from the game's own record: every request so far (the folder's git log)
// and NOTES.md, which the agent keeps current.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

/** Three shown at first, then the other six with "More ideas". */
export const MAX_SUGGESTIONS = 9;
/** A chip is a short line: longer answers are dropped, not cut. */
export const MAX_LENGTH = 48;

/** The player's requests so far, oldest first, from the game folder's commits ("edit: add coins"). */
export function requestsOf(dir) {
  const log = spawnSync('git', ['log', '--format=%s', '-n', '60'], { cwd: dir, encoding: 'utf8' });
  if (log.status !== 0) return [];
  const asks = [];
  for (const line of log.stdout.split('\n').reverse()) {
    const m = /^(?:new(?: \(\w+\))?|edit): (.+)$/.exec(line.trim());
    if (!m) continue;
    // A build in steps commits the same request once per step, each cut to 72 letters after its own prefix.
    const last = asks.at(-1) ?? '';
    if (last.startsWith(m[1])) continue;
    if (m[1].startsWith(last) && last) asks[asks.length - 1] = m[1];
    else asks.push(m[1]);
  }
  return asks.slice(-20);
}

/** The first 60 lines of NOTES.md (the rule's own limit), or ''. */
export function notesOf(dir) {
  const file = join(dir, 'NOTES.md');
  return existsSync(file) ? readFileSync(file, 'utf8').split('\n').slice(0, 60).join('\n').trim() : '';
}

export function suggestionsPrompt({ requests, notes, reply }) {
  return [
    'A player is making a game by chatting with an AI game builder. Suggest 9 changes they could ask for next, best first.',
    `What the player asked for so far, oldest first:\n${requests.map((r) => `- ${r}`).join('\n') || '- (nothing recorded)'}`,
    notes && `The game now (the builder's notes):\n${notes}`,
    reply && `What the builder just did:\n${reply.slice(0, 1500)}`,
    [
      'Rules:',
      '- Each one is a single small change the builder can make in one go, said the way a player would type it: 2 to 6 words, starting with a verb, such as "Add coins to collect".',
      '- Fit the stage the game is at. A new game (one or two requests so far) gets gameplay first: a new move, things to collect, new obstacles or enemies, a way to win or lose. Once that is there: more variety, harder stages or levels, power-ups, a goal to chase. Then feel: sounds, effects, juicier motion. Looks (skins, themes, colours) come last.',
      '- Best first: the first three are the ones most worth doing now; the player sees them first, then the other six.',
      '- Never suggest anything the game already has or the player already asked for.',
      '- Nine different changes, not versions of one; mix the kinds within each group of three.',
      '- Nothing the builder cannot make: no online play, accounts, shared leaderboards, ads, purchases, real music or voices, or anything outside the game.',
      "- Write them in the language of the player's requests.",
    ].join('\n'),
    'Reply with a JSON array of 9 strings only, for example: ["Add coins to collect", "Add flying traps", "Add a shield power-up", …]',
  ].filter(Boolean).join('\n\n');
}

/** The model's answer → up to 9 clean, distinct short lines, in its order ([] when it isn't a list of strings). */
export function parseSuggestions(answer) {
  const json = /\[[\s\S]*\]/.exec(answer ?? '')?.[0];
  if (!json) return [];
  let list;
  try { list = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (typeof item !== 'string') continue;
    const s = item.replace(/\s+/g, ' ').trim().replace(/[.!]+$/, '');
    if (!s || s.length > MAX_LENGTH || out.some((o) => o.toLowerCase() === s.toLowerCase())) continue;
    out.push(s);
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Asks the model (run.mjs passes the Agent SDK's query and its isolated Haiku options). Never throws:
 * a run that built the game must not fail over its chips.
 */
export async function nextSteps({ dir, reply, query, options }) {
  let list = [], costUsd = 0;
  try {
    const prompt = suggestionsPrompt({ requests: requestsOf(dir), notes: notesOf(dir), reply });
    for await (const m of query({ prompt, options })) {
      if (m.type === 'result') {
        if (m.subtype === 'success') list = parseSuggestions(m.result);
        costUsd = m.total_cost_usd ?? 0;
      }
    }
  } catch (e) {
    console.log(`[no next-step suggestions] ${String(e?.message || e).split('\n')[0].slice(0, 120)}`);
  }
  return { list, costUsd };
}
