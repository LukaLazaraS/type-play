// The game agent runner: builds a new game or changes an existing one, and records the cost.
//   New game:  node run.mjs --game robot --prompt "Make an endless runner ..." [--model sonnet]
//   Change:    node run.mjs --game robot --edit --prompt "Add a double jump" [--model auto]
// Options: --model haiku|sonnet|opus|auto (auto, the default for edits: Haiku first, and Sonnet
//          only if Haiku's change fails)  --effort low|medium|high
//          --playtest (the agent writes and runs a bot play-test)  --slim (short custom system
//          prompt instead of Claude Code's)  --genre auto|none|runner|puzzle (new games;
//          auto: one cheap Haiku call picks it; edits reuse the game's GENRE file)
//          --steps 1|2 (new games: 2 = core then polish in two short sessions; default 2 on Haiku)
// Each game folder is its own git repo: every successful run is a commit, a failed one is
// rolled back, so a change can never leave the game broken.
// Auth: no ANTHROPIC_API_KEY → the Claude Code login on this PC (Luka's Max). AGENT_AUTH=api
// allows a key.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { cpSync, existsSync, readFileSync, appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODELS = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' };
const DEFAULT_EFFORT = { haiku: 'medium', sonnet: 'medium', opus: 'medium' };
const GODOT = process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe';
const TOOLS = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'];
// The game agent sees only its own 7 tools. Without this it inherits the login's claude.ai
// connectors (Luka's Google Drive, vidIQ/YouTube, Docs: 84 tools, +89K tokens per call),
// skills, MCP servers, and this repo's CLAUDE.md and settings.
const ISOLATED = {
  tools: TOOLS,
  settingSources: [],
  settings: { disableClaudeAiConnectors: true },
  strictMcpConfig: true,
  mcpServers: {},
  skills: [],
};
// Safety caps in API-price dollars (an estimate on Max, real money on the API).
const BUDGET = { new: { haiku: 0.5, sonnet: 2, opus: 4 }, edit: { haiku: 0.15, sonnet: 0.75, opus: 1.5 } };

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const flag = (name) => args.includes(`--${name}`);
const game = opt('game');
const prompt = opt('prompt');
const isEdit = flag('edit');
const playtest = flag('playtest');
const slim = flag('slim');
let modelKey = opt('model', isEdit ? 'auto' : 'sonnet');
if (!game || !prompt) { console.error('need --game and --prompt'); process.exit(2); }
if (process.env.ANTHROPIC_API_KEY && process.env.AGENT_AUTH !== 'api') {
  console.error('ANTHROPIC_API_KEY is set: unset it to run on Max, or set AGENT_AUTH=api.');
  process.exit(2);
}

const dir = join(HERE, 'output', game);
const git = (...a) => spawnSync('git', ['-c', 'user.name=game-agent', '-c', 'user.email=agent@local', ...a], { cwd: dir, encoding: 'utf8' });
if (isEdit) {
  if (!existsSync(join(dir, '.git'))) { console.error(`no game in ${dir}`); process.exit(2); }
} else {
  if (existsSync(dir)) { console.error(`${dir} exists: pick another --game`); process.exit(2); }
  mkdirSync(dirname(dir), { recursive: true });
  cpSync(join(HERE, 'templates', 'blank'), dir, { recursive: true });
  appendFileSync(join(dir, '.gitignore'), '.godot/\nexport/\n.agent-log.jsonl\n');
  git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'template');
}

// Genre skill: proven patterns for the game's genre (genres/<name>/GENRE.md). A new game gets
// its genre from one cheap Haiku call (or --genre); the game folder keeps it in GENRE, so
// every later edit gets the same skill.
const GENRES = readdirSync(join(HERE, 'genres')).filter((g) => existsSync(join(HERE, 'genres', g, 'GENRE.md')));
async function detectGenre(request) {
  let answer = '';
  for await (const m of query({
    prompt: `A player asked for this game:\n"${request}"\nWhich genre is it? Answer with exactly one word from: ${GENRES.join(', ')}, none.`,
    options: { ...ISOLATED, model: MODELS.haiku, effort: 'low', tools: [], maxTurns: 1, systemPrompt: 'You classify game requests. Answer with one word.' },
  })) {
    if (m.type === 'result') answer = (m.result || '').trim().toLowerCase();
  }
  return GENRES.find((g) => answer.includes(g)) || 'none';
}
const genreFile = join(dir, 'GENRE');
let genre = opt('genre', 'auto');
if (isEdit) genre = existsSync(genreFile) ? readFileSync(genreFile, 'utf8').trim() : 'none';
else {
  if (genre === 'auto') genre = await detectGenre(prompt);
  writeFileSync(genreFile, genre + '\n');
}
if (genre !== 'none') console.log(`genre skill: ${genre}`);

// Every game gets the current feature-test helper on every run (older games and forks may
// predate it or carry an older version; the agent is told not to change it).
const helpers = join(dir, 'test', 'helpers.gd');
mkdirSync(dirname(helpers), { recursive: true });
cpSync(join(HERE, 'templates', 'blank', 'test', 'helpers.gd'), helpers);

const checkPath = join(HERE, 'tools', 'check.mjs').replaceAll('\\', '/');
const read = (f) => readFileSync(join(HERE, 'rules', f), 'utf8');
const rules = [
  read('BASE.md').replace('{PLAYTEST}', playtest ? read('PLAYTEST.md') : ''),
  read('GOTCHAS.md'),
  genre !== 'none' && GENRES.includes(genre)
    ? "\n**The player's request always wins over the genre defaults below.** If they ask for something different, or this genre doesn't fit what they asked for, do what they asked.\n"
      + readFileSync(join(HERE, 'genres', genre, 'GENRE.md'), 'utf8')
    : '',
  isEdit ? read('EDIT.md') : '',
].join('\n').replaceAll('{CHECK}', checkPath).replaceAll('{GODOT}', GODOT);

// The agent's last message, rewritten for a player who isn't a developer: rules alone don't
// stop "the automatic check passed" or "untested on a phone". One cheap Haiku call, no tools.
async function playerMessage(request, reply) {
  if (!reply.trim()) return { text: '', costUsd: 0 };
  let text = reply, costUsd = 0;
  for await (const m of query({
    prompt: `Player's request: "${request}"\n\nMessage from the game builder:\n${reply}\n\nRewrite the message for the player, who is not a developer: what was made or changed and how to play (controls), in 2-4 short friendly sentences, in the language of the request. Leave out anything about tests, checks, bots, screenshots, files, code, notes, phones or what wasn't verified. If something the player asked for couldn't be done, say so simply. Reply with the message only.`,
    options: { ...ISOLATED, model: MODELS.haiku, effort: 'low', tools: [], maxTurns: 1, systemPrompt: 'You rewrite messages for players of a game-making app. Reply with the rewritten message only.' },
  })) {
    if (m.type === 'result') {
      if (m.subtype === 'success' && m.result?.trim()) text = m.result.trim();
      costUsd = m.total_cost_usd ?? 0;
    }
  }
  return { text, costUsd };
}

const log = join(dir, '.agent-log.jsonl');
// One agent session. `extra` adds rules for this session only (the build steps).
async function attempt(key, { request = prompt, extra = '', label = '' } = {}) {
  const model = MODELS[key];
  const effort = opt('effort', DEFAULT_EFFORT[key]);
  const t0 = Date.now();
  const elapsed = () => `${((Date.now() - t0) / 60000).toFixed(1)}m`;
  const sessionRules = rules + (extra ? '\n' + extra : '');
  console.log(`\n${isEdit ? 'EDIT' : 'NEW'}${label ? ` ${label}` : ''} ${game} on ${model} (effort ${effort}${playtest ? ', play-test' : ''}${slim ? ', slim' : ''})\n> ${request}\n`);
  let result, failure = '';
  try {
  for await (const msg of query({
    prompt: request,
    options: {
      cwd: dir, model, effort,
      systemPrompt: slim ? sessionRules : { type: 'preset', preset: 'claude_code', append: sessionRules },
      ...ISOLATED,
      permissionMode: 'bypassPermissions',
      maxTurns: key === 'haiku' ? 50 : 60,
      maxBudgetUsd: BUDGET[isEdit ? 'edit' : 'new'][key],
    },
  })) {
    appendFileSync(log, JSON.stringify(msg) + '\n');
    if (msg.type === 'assistant') {
      for (const b of msg.message.content) {
        if (b.type === 'text' && b.text.trim()) console.log(`[${elapsed()}] ${b.text.trim().split('\n')[0].slice(0, 160)}`);
        else if (b.type === 'tool_use') {
          const i = b.input || {};
          console.log(`[${elapsed()}]   → ${b.name} ${String(i.file_path || i.command || i.pattern || '').replaceAll(dir.replaceAll('\\', '/'), '.').slice(0, 110)}`);
        }
      }
    } else if (msg.type === 'result') result = msg;
  }
  } catch (e) {
    // The SDK throws when a session hits its turn limit or crashes: treat it as a failed
    // attempt (the caller rolls back) instead of dying with the game half-changed.
    failure = String(e?.message || e).split('\n')[0].slice(0, 200);
    console.log(`\n[session ended early] ${failure}`);
  }
  const check = spawnSync('node', [checkPath], { cwd: dir, encoding: 'utf8' });
  const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, thinking: 0 };
  for (const u of Object.values(result?.modelUsage || {})) {
    tokens.input += u.inputTokens; tokens.output += u.outputTokens; tokens.thinking += u.thinkingTokens || 0;
    tokens.cacheRead += u.cacheReadInputTokens; tokens.cacheWrite += u.cacheCreationInputTokens;
  }
  return {
    step: label || undefined, model, effort, minutes: +((Date.now() - t0) / 60000).toFixed(1), turns: result?.num_turns,
    costUsd: +(result?.total_cost_usd ?? 0).toFixed(3), tokens, agentStatus: result?.subtype ?? `error: ${failure}`,
    ok: check.status === 0 && result?.subtype === 'success', reply: result?.result ?? '', checkOutput: check.stdout,
  };
}

const route = modelKey === 'auto' ? 'haiku' : modelKey;
const rollback = () => { git('reset', '-q', '--hard'); git('clean', '-qfd'); };
const commit = (msg) => { git('add', '-A'); git('commit', '-qm', msg.slice(0, 72)); };
// New games on Haiku are built in two short sessions (core, then polish) so no conversation
// grows past Haiku's 100K-token price step; --steps 1|2 overrides.
const steps = isEdit ? 1 : Number(opt('steps', route === 'haiku' ? 2 : 1));
const attempts = [];
let final;
if (steps === 2) {
  const core = await attempt(route, { extra: read('STEP_CORE.md'), label: 'step 1/2 core' });
  attempts.push(core);
  final = core;
  if (!core.ok) rollback();
  else {
    commit(`new (core): ${prompt}`);
    const polish = await attempt(route, {
      request: `Polish the game the player asked for: "${prompt}"`, extra: read('STEP_POLISH.md'), label: 'step 2/2 polish',
    });
    attempts.push(polish);
    if (polish.ok) { commit(`new (polish): ${prompt}`); final = polish; }
    else { rollback(); console.log('\nThe polish did not pass; kept the working core game.'); } // back to the core version
  }
} else {
  attempts.push(await attempt(route));
  if (!attempts[0].ok) {
    rollback(); // back to the last good version
    if (modelKey === 'auto' && route === 'haiku') {
      console.log('\nHaiku\'s change did not pass; rolled back, retrying on Sonnet.');
      attempts.push(await attempt('sonnet'));
      if (!attempts[1].ok) rollback();
    }
  }
  final = attempts.at(-1);
  if (final.ok) commit(`${isEdit ? 'edit' : 'new'}: ${prompt}`);
}
const message = await playerMessage(prompt, final.reply);

// costUsd is the agent's work only; the player-message rewrite is kept apart (messageCostUsd).
const record = {
  date: new Date().toISOString(), game, kind: isEdit ? 'edit' : 'new', prompt, route: modelKey === 'auto' ? `auto→${route}` : route,
  genre, steps, playtest, slim, ok: final.ok, playerMessage: message.text, messageCostUsd: +message.costUsd.toFixed(4),
  costUsd: +attempts.reduce((s, a) => s + a.costUsd, 0).toFixed(3),
  minutes: +attempts.reduce((s, a) => s + a.minutes, 0).toFixed(1),
  attempts: attempts.map(({ reply, checkOutput, ...a }) => a),
};
appendFileSync(join(HERE, 'runs.jsonl'), JSON.stringify(record) + '\n');

console.log(`\n--- agent's own reply ---\n${final.reply || '(none)'}\n`);
console.log(`--- shown to the player ($${message.costUsd.toFixed(4)}) ---\n${message.text || '(none)'}\n`);
console.log(`--- ${record.ok ? 'OK' : 'FAILED (rolled back)'}: ${record.minutes} min, ~$${record.costUsd} at API prices, route ${record.route}`);
for (const a of attempts) console.log(`    ${a.step ? a.step + ' ' : ''}${a.model} ${a.effort}: ${a.ok ? 'ok' : 'failed'}, ${a.minutes} min, ${a.turns} turns, $${a.costUsd}, ${JSON.stringify(a.tokens)}`);
if (!final.ok) console.log(final.checkOutput);
console.log(`play: node tools/serve.mjs output/${game}`);
