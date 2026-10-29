// The size check (run.mjs, Luka 10-29): before a change on Fast or Smart is built, one cheap Haiku call, no tools, judges
// whether the request fits the AI the player picked. Fast makes one change per message; Smart a few changes or one new
// feature; Best gets no check (no call, no cost, no wait). Too big: the run stops before the build, the game unchanged,
// and the call's message is the chat's answer: what is too big, one part to send now (from the player's own words), or
// the bigger AI when their plan has it. Why (10-27, live): "10 new levels and flying traps" on Fast hit its $0.15 cap
// once, then "finished" without changing the game, passed the check and was charged 2.4 credits.
// The model only sorts the request into jobs and writes the message; the rule below counts the jobs (10-29 tuning:
// Haiku judging the whole request itself stopped "make the robot red and a bit faster" on Fast and let "add a shop and a
// boss" through, and answered a Russian request in English until it named the language first).
// When unsure it lets the build go: a wrong stop annoys a player more than an occasional failed build costs.
// Like every AI call a player causes, its cost is part of that message's charge (run.mjs `sizeCheckCostUsd`); a stop is
// charged like any finished answer (docs/pricing.md: rounded up to 0.1 credit, at least 0.1).

/** The AIs as the player knows them, by run.mjs model key. */
export const NAMES = { haiku: 'Fast', sonnet: 'Smart', opus: 'Best' };
/** The AIs that are checked, by run.mjs model key: Best (opus) never is. */
export const SIZED = ['haiku', 'sonnet'];
/** The next AI up, offered by a stop when the player's plan has it (the server says which with --bigger). */
export const BIGGER = { haiku: 'sonnet', sonnet: 'opus' };

/** The kinds of job the model sorts a request into. */
const KINDS = {
  feature: 'a new feature or mechanic with its own parts (a double jump, a shop with its items, a boss with its attacks, a second player, music, achievements); a new kind of enemy, trap or obstacle is one too, also when it comes inside new levels',
  levels: 'a set of new levels or a level map',
  fix: 'something broken made to work',
  tweak: 'a small change to how it looks or feels (a colour, a size, a speed, a sound, a text)',
  rework: 'turning it into another kind of game, or redoing all its graphics, all its controls or all of it',
  vague: 'a short or vague wish with no clear job ("make it better", "more fun")',
};

/**
 * The rule, by the jobs: every tweak in a message together is one job. Fast: one job (Luka: small tweaks that belong
 * together count as one). Smart: a few changes or one new feature; too big only for a rework or three or more new
 * features or level sets.
 */
export function fits(jobs, key) {
  if (jobs.some((j) => j.kind === 'rework')) return false;
  if (key === 'haiku') return jobs.filter((j) => j.kind !== 'tweak').length + (jobs.some((j) => j.kind === 'tweak') ? 1 : 0) <= 1;
  return jobs.filter((j) => j.kind === 'feature' || j.kind === 'levels').length <= 2;
}

const SYSTEM = 'You sort a game change a player asked for into jobs, and write a short chat message. Follow the answer format exactly.';

/** The check's prompt: the request, the picked AI, and the bigger AI the message may offer (null: none). */
export function sizePrompt(request, key, bigger) {
  const name = NAMES[key];
  const offer = bigger ? `, or picking ${NAMES[bigger]} to do more at once` : '';
  return [
    `A player is changing their game by chat and sent this message to the ${name} AI:\n"${request}"`,
    `Sort the request into jobs. The kinds of job:\n${Object.entries(KINDS).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\nWhen unsure whether something is a job of its own, it is part of the one before it.`,
    'Answer in exactly this format, one job per line:',
    'JOB: <kind>: <the job in a few words>\nLANGUAGE: <the language the player wrote in>\nMESSAGE: <the message>',
    `The message is what the player reads if the request turns out too big for ${name}: 1-2 short friendly sentences, in the player's language. Say plainly what makes it too much for ${name} in one message, then suggest sending one part now, quoting a short example taken from their own words, and the rest in the next messages${offer}. Nothing about jobs, credits, tokens or checks.`,
    `Example, for "add a shop, a boss and a night mode":\nJOB: feature: a shop\nJOB: feature: a boss\nJOB: feature: a night mode\nLANGUAGE: English\nMESSAGE: A shop, a boss and a night mode are three big jobs, more than ${name} can finish in one message. Send one now, like "Add a shop", and the others next${bigger ? `, or pick ${NAMES[bigger]} to do more at once` : ''}.`,
  ].join('\n\n');
}

/** The answer's jobs and message; lines that don't follow the format are skipped. */
export function parseAnswer(answer) {
  const jobs = [];
  let message = '';
  for (const line of String(answer ?? '').split('\n')) {
    const job = /^[\s*_-]*job[\s*_]*:[\s*_]*([a-z]+)[\s*_]*:\s*(.+)$/i.exec(line);
    const said = /^[\s*_-]*message[\s*_]*:[\s*_]*(.+)$/i.exec(line);
    if (job && KINDS[job[1].toLowerCase()]) jobs.push({ kind: job[1].toLowerCase(), what: job[2].trim() });
    else if (said) message = said[1].trim();
  }
  return { jobs, message };
}

/** The verdict: only a request whose jobs break the rule and that has a message to show stops; anything else builds. */
export function verdict(answer, key) {
  const { jobs, message } = parseAnswer(answer);
  const stop = jobs.length > 0 && !fits(jobs, key) && !!message;
  return { fits: !stop, reply: stop ? message : '', jobs };
}

/**
 * Runs the check: { fits, reply, jobs, answer, costUsd }. Never throws: a failed call lets the build go. `query` and
 * `options` are run.mjs's (the SDK's query and the isolated Haiku options); `key` is the picked AI (haiku | sonnet).
 */
export async function sizeCheck({ request, key, bigger, query, options }) {
  let answer = '', costUsd = 0;
  try {
    for await (const m of query({ prompt: sizePrompt(request, key, bigger), options: { ...options, systemPrompt: SYSTEM } })) {
      if (m.type === 'result') {
        if (m.subtype === 'success') answer = m.result ?? '';
        costUsd = m.total_cost_usd ?? 0;
      }
    }
  } catch (e) {
    console.log(`[size check skipped] ${String(e?.message || e).split('\n')[0].slice(0, 120)}`);
  }
  return { ...verdict(answer, key), answer: answer.trim(), costUsd };
}
