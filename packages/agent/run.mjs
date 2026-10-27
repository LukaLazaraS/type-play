// The game agent runner: builds a new game or changes an existing one, and records the cost.
//   New game:  node run.mjs --game robot --prompt "Make an endless runner ..." [--model sonnet]
//   Change:    node run.mjs --game robot --edit --prompt "Add a double jump" [--model auto]
// Options: --model haiku|sonnet|opus|auto (auto, the default for edits: Haiku first, and Sonnet
//          only if Haiku's change fails)  --effort low|medium|high
//          --playtest (the agent writes and runs a bot play-test)  --slim (short custom system
//          prompt instead of Claude Code's)  --genre auto|none|<a folder in genres/> (new games;
//          auto: one cheap Haiku call picks it; edits reuse the game's GENRE file)
//          --tags <name>[,<name>…] (new games: the tags the player picked, a file each in tags/; not both 2d and 3d,
//          nor cozy and hard; edits reuse the game's TAGS file)
//          --platform auto|phone|computer|fill (new games: the screens it is made for, rules/SCREEN_*.md; auto,
//          the default: one shape the agent picks, portrait first; edits reuse the game's PLATFORM file)
//          --steps 1|2|3 (new games: 2 = core, then polish; 3 = core with one level, then the
//          content, then polish; each a short fresh session. Default on Haiku: 3 for a big
//          request, else 2, sized by the same cheap call that picks the genre; else 1)
//          --budget <usd> (tests only: overrides the safety cap below; the server never passes it)
//          --dir <path> (the game folder instead of output/<game>; --game is then optional)
//          --events (also print `@@event <json>` lines: started, progress in plain words (also
//          "Planning your change…" while the model thinks, tools/thinking.mjs), result;
//          read by the server, apps/server. The result carries costUsd = every attempt, and
//          chargeUsd = only the attempts in the game the player gets: what they are charged; and
//          the chat's 9 next-step ideas, tools/next-steps.mjs, whose cost the server adds to the charge)
// Each game folder is its own git repo: every successful run is a commit, a failed one is
// rolled back, so a change can never leave the game broken.
// Auth: no ANTHROPIC_API_KEY → the Claude Code login on this PC (Luka's Max). AGENT_AUTH=api
// allows a key.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { cpSync, existsSync, readFileSync, appendFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { thinkingLine } from './tools/thinking.mjs';
import { nextSteps } from './tools/next-steps.mjs';

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
const dirOpt = opt('dir');
const game = opt('game') || (dirOpt && basename(resolve(dirOpt)));
// --prompt-file: the live server's runner passes the prompt in a private file, not in argv (/proc/<pid>/cmdline is world-readable).
const prompt = opt('prompt') ?? (opt('prompt-file') ? readFileSync(opt('prompt-file'), 'utf8') : undefined);
const isEdit = flag('edit');
const playtest = flag('playtest');
const slim = flag('slim');
let modelKey = opt('model', isEdit ? 'auto' : 'sonnet');
if (!game || !prompt) { console.error('need --game (or --dir) and --prompt'); process.exit(2); }
// The screens a game is made for (Luka, 10-25). One shape, scaled to fit any screen with bars around it: auto
// (the agent picks upright or wide, portrait first), phone (upright) or computer (wide), the last two picked by
// the player; or fill: the layout adapts to every shape. Every game gets the controls for touch, mouse and keys.
const PLATFORMS = ['auto', 'phone', 'computer', 'fill'];
if (!isEdit && !PLATFORMS.includes(opt('platform', 'auto'))) { console.error(`--platform: ${PLATFORMS.join(' | ')}`); process.exit(2); }
// Tags (Luka, 10-27): what the player picked beside the genre on /create, several at once (2d or 3d, retro, …). Each is
// a short rule file, tags/<name>.md, that the agent gets after the genre skill.
const TAGS = readdirSync(join(HERE, 'tags')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
const pickedTags = isEdit ? [] : [...new Set(opt('tags', '').split(',').map((t) => t.trim()).filter(Boolean))];
// Pairs that contradict each other: one of each at most (first-person is always 3D).
const EITHER = [['2d', '3d'], ['cozy', 'hard'], ['2d', 'firstperson']];
if (pickedTags.some((t) => !TAGS.includes(t)) || EITHER.some((pair) => pair.every((t) => pickedTags.includes(t)))) {
  console.error(`--tags: any of ${TAGS.join(', ')}, comma-separated; not both of ${EITHER.map((p) => p.join(' and ')).join(', nor ')}`);
  process.exit(2);
}
// project.godot's window settings per platform, over the template's (portrait 720×1280, stretch aspect "keep").
// Fill: the short side is always 720 and the long side grows to the screen; it turns with the device.
const DISPLAY = {
  computer: { 'size/viewport_width': 1152, 'size/viewport_height': 648, 'handheld/orientation': 0 },
  fill: { 'size/viewport_width': 720, 'size/viewport_height': 720, 'stretch/aspect': '"expand"', 'handheld/orientation': 6 },
};
if (process.env.ANTHROPIC_API_KEY && process.env.AGENT_AUTH !== 'api') {
  console.error('ANTHROPIC_API_KEY is set: unset it to run on Max, or set AGENT_AUTH=api.');
  process.exit(2);
}

// --events: the server (apps/server) shows these to the player while the game is built, so the
// progress lines are plain words: no file names, no code talk.
const emit = (e) => { if (flag('events')) console.log('@@event ' + JSON.stringify(e)); };
let lastProgress = '', lastProgressAt = 0; // the line the player sees, and when it last changed
const progress = (text) => { if (text && text !== lastProgress) { lastProgressAt = Date.now(); emit({ type: 'progress', text: (lastProgress = text) }); } };
function toolProgress(name, input = {}) {
  const file = String(input.file_path || '');
  const what = basename(file).replace(/\.[^.]*$/, '').replace(/[_\-.]+/g, ' ').trim().toLowerCase();
  if (name === 'Write' || name === 'Edit') {
    if (/NOTES\.md$/i.test(file)) return 'Taking notes';
    if (/project\.godot$/.test(file)) return 'Setting up the game';
    if (/[\\/]test[\\/]|_test\.(gd|tscn)$/.test(file)) return 'Writing a test';
    if (!what || what === 'main') return name === 'Write' ? 'Building the game' : 'Changing the game';
    return `${name === 'Write' ? 'Writing' : 'Changing'} the ${{ hud: 'score display', ui: 'buttons' }[what] || what}`;
  }
  if (name === 'Read' && /\.png$/i.test(file)) return 'Looking at the game';
  if (name === 'Read' || name === 'Glob' || name === 'Grep') return 'Reading the game';
  if (name === 'TodoWrite') return 'Making a plan';
  if (name === 'Bash' && /check\.mjs/.test(input.command || '')) return 'Testing the game';
  if (name === 'Bash' && /assets\.mjs/.test(input.command || '')) return 'Picking 3D models';
  if (name === 'Bash' && /--headless|Godot_v\d/i.test(input.command || '')) return 'Running the game';
  return '';
}

const dir = dirOpt ? resolve(dirOpt) : join(HERE, 'output', game);
const git = (...a) => spawnSync('git', ['-c', 'user.name=game-agent', '-c', 'user.email=agent@local', ...a], { cwd: dir, encoding: 'utf8' });
if (isEdit) {
  if (!existsSync(join(dir, '.git'))) { console.error(`no game in ${dir}`); process.exit(2); }
} else {
  // An empty folder is fine: on the live server the runner makes it, owned by the run's own user.
  if (existsSync(dir) && readdirSync(dir).length) { console.error(`${dir} exists: pick another --game`); process.exit(2); }
  mkdirSync(dirname(dir), { recursive: true });
  cpSync(join(HERE, 'templates', 'blank'), dir, { recursive: true });
  appendFileSync(join(dir, '.gitignore'), '.godot/\nexport/\n.agent-log.jsonl\n');
  // The template is portrait and keeps its shape (stretch aspect "keep"); the folder keeps the platform in
  // PLATFORM, so every later edit (and the check's screenshots) follows the same screen rules.
  const display = DISPLAY[opt('platform', 'auto')];
  if (display) {
    let text = readFileSync(join(dir, 'project.godot'), 'utf8');
    for (const [key, value] of Object.entries(display)) text = text.replace(new RegExp(`^window/${key}=.*$`, 'm'), `window/${key}=${value}`);
    writeFileSync(join(dir, 'project.godot'), text);
  }
  writeFileSync(join(dir, 'PLATFORM'), opt('platform', 'auto') + '\n');
  // The tags the same way, in TAGS (one line, as picked); no tags, no file.
  if (pickedTags.length) writeFileSync(join(dir, 'TAGS'), pickedTags.join(' ') + '\n');
  if (opt('seed')) cpSync(resolve(opt('seed')), dir, { recursive: true }); // ports and tests: files the game starts with (Builder only)
  git('init', '-q'); git('add', '-A'); git('commit', '-qm', 'template');
}
// Games from before 10-25 have no PLATFORM file: their window stretches to any shape (rules/SCREEN_LEGACY.md).
const platformFile = join(dir, 'PLATFORM');
const savedPlatform = existsSync(platformFile) ? readFileSync(platformFile, 'utf8').trim() : '';
const platform = PLATFORMS.includes(savedPlatform) ? savedPlatform : 'legacy';
emit({ type: 'started', kind: isEdit ? 'edit' : 'new', model: modelKey, game });
progress(isEdit ? 'Reading your game' : 'Reading your idea');

// Genre skill: proven patterns for the game's genre (genres/<name>/GENRE.md). A new game gets
// its genre from one cheap Haiku call (or --genre); the game folder keeps it in GENRE, so
// every later edit gets the same skill. The same call says whether the request is big (levels
// with a menu, many features): big Haiku builds take 3 short steps instead of 2.
const GENRES = readdirSync(join(HERE, 'genres')).filter((g) => existsSync(join(HERE, 'genres', g, 'GENRE.md')));
// What each genre covers, from its skill's heading ("## Genre: puzzle (grid puzzles: …)").
const genreHint = (g) => readFileSync(join(HERE, 'genres', g, 'GENRE.md'), 'utf8').match(/^## Genre: (.*)$/m)?.[1] ?? g;
async function classify(request) {
  let answer = '';
  for await (const m of query({
    prompt: `A player asked for this game:\n"${request}"\n\nGenres:\n${GENRES.map((g) => `- ${g}: ${genreHint(g)}`).join('\n')}\n- none: anything else\n\n`
      + 'Size: "big" only if the request itself asks for several levels or a level map, or lists 4 or more separate features (such as several tower or piece types, upgrades, specials, saving progress, a shop, menus); otherwise "small", also for a short request in a complex genre.\n\n'
      + 'Answer with exactly two words: the genre, then the size. Example: "puzzle small".',
    options: { ...ISOLATED, model: MODELS.haiku, effort: 'low', tools: [], maxTurns: 1, systemPrompt: 'You classify game requests. Answer with two words.' },
  })) {
    if (m.type === 'result') answer = (m.result || '').trim().toLowerCase();
  }
  const flat = answer.replace(/defense/g, 'defence').replace(/[^a-z]/g, '');
  return { genre: GENRES.find((g) => flat.includes(g)) || 'none', size: /\bbig\b/.test(answer) ? 'big' : 'small', answer };
}
const genreFile = join(dir, 'GENRE');
let genre = opt('genre', 'auto');
// A new game's genre named here (the player's pick on /create) is the game's genre; the agent's own pick (auto) only
// helps, as the request wins over it.
const pickedGenre = !isEdit && !['auto', 'none'].includes(genre);
let size = 'small';
const route = modelKey === 'auto' ? 'haiku' : modelKey;
if (isEdit) genre = existsSync(genreFile) ? readFileSync(genreFile, 'utf8').trim() : 'none';
else {
  // Size matters only for Haiku's step count; skip the call when nothing needs it.
  if (genre === 'auto' || (route === 'haiku' && !opt('steps'))) {
    const c = await classify(prompt);
    if (genre === 'auto') genre = c.genre;
    size = c.size;
    console.log(`classified: "${c.answer}"`);
  }
  writeFileSync(genreFile, genre + '\n');
}
if (genre !== 'none') console.log(`genre skill: ${genre}`);
// A change follows the tags the game was made with (unknown words in the file are skipped).
const tagsFile = join(dir, 'TAGS');
const tags = isEdit ? (existsSync(tagsFile) ? readFileSync(tagsFile, 'utf8').split(/\s+/).filter((t) => TAGS.includes(t)) : []) : pickedTags;
if (tags.length) console.log(`tags: ${tags.join(', ')}`);

// Every game gets the current feature-test helper on every run (older games and forks may
// predate it or carry an older version; the agent is told not to change it).
const helpers = join(dir, 'test', 'helpers.gd');
mkdirSync(dirname(helpers), { recursive: true });
cpSync(join(HERE, 'templates', 'blank', 'test', 'helpers.gd'), helpers);

const checkPath = join(HERE, 'tools', 'check.mjs').replaceAll('\\', '/');
const assetsPath = join(HERE, 'tools', 'assets.mjs').replaceAll('\\', '/'); // the 3D model library
const read = (f) => readFileSync(join(HERE, 'rules', f), 'utf8');
// A change to a one-shape game may be the player asking for it to fit other screens too (the game page's
// "Made for phones" hint fills that request in): the edit then also gets the way to switch, and the fill rules.
const screen = read(`SCREEN_${platform.toUpperCase()}.md`).trimEnd()
  + (isEdit && ['auto', 'phone', 'computer'].includes(platform) ? `\n${read('SCREEN_SWITCH.md').trimEnd()}\n${read('SCREEN_FILL.md').trimEnd()}` : '');
const rules = [
  read('BASE.md').replace('{SCREEN}', () => screen).replace('{PLAYTEST}', playtest ? read('PLAYTEST.md') : ''),
  read('GOTCHAS.md'),
  genre !== 'none' && GENRES.includes(genre)
    ? (pickedGenre
      // Picked by the player on /create (10-27): the game is this genre, with their idea inside it.
      ? '\n**The player picked this genre for the game: make it one, with their idea inside it.** Their own words win over the genre defaults below (theme, characters, extra features), never over the genre itself.\n'
      : "\n**The player's request always wins over the genre defaults below.** If they ask for something different, or this genre doesn't fit what they asked for, do what they asked.\n")
      + readFileSync(join(HERE, 'genres', genre, 'GENRE.md'), 'utf8')
    : '',
  // The player chose these on purpose: they win over the genre's defaults, and the game is all of them at once.
  tags.length
    ? `\n**The player picked ${tags.length === 1 ? 'this tag' : 'these tags'} for the game: make it ${tags.length === 1 ? 'so' : 'all of them at once'}.** A tag wins over the genre defaults above; where the player's own words ask for something more specific, follow the words and keep the tag.\n`
      + tags.map((t) => readFileSync(join(HERE, 'tags', `${t}.md`), 'utf8').trimEnd()).join('\n\n') + '\n'
    : '',
  isEdit ? read('EDIT.md') : '',
].join('\n').replaceAll('{CHECK}', checkPath).replaceAll('{ASSETS}', assetsPath).replaceAll('{GODOT}', GODOT);

// The agent's last message, rewritten for a player who isn't a developer: rules alone don't
// stop "the automatic check passed" or "untested on a phone". One cheap Haiku call, no tools.
// A new game built in two steps passes both replies: the polish reply alone reads like an edit
// ("Your bird now squishes…") when the player has never seen the game.
async function playerMessage(request, reply, { isNew = false } = {}) {
  if (!reply.trim()) return { text: '', costUsd: 0 };
  let text = reply, costUsd = 0;
  const what = isNew
    ? 'This is a brand-new game the player has not seen yet: describe the game as a whole (not as changes) and how to play (controls)'
    : 'what was changed and how to play (controls)';
  try {
    for await (const m of query({
      prompt: `Player's request: "${request}"\n\nMessage from the game builder:\n${reply}\n\nRewrite the message for the player, who is not a developer: ${what}, in 2-4 short friendly sentences, in the language of the request (never mention the language). Leave out anything about tests, checks, bots, screenshots, files, code, notes, or what wasn't verified (on phones or anywhere). If something the player asked for couldn't be done, say so simply. Reply with the message only.`,
      options: { ...ISOLATED, model: MODELS.haiku, effort: 'low', tools: [], maxTurns: 1, systemPrompt: 'You rewrite messages for players of a game-making app. Reply with the rewritten message only.' },
    })) {
      if (m.type === 'result') {
        if (m.subtype === 'success' && m.result?.trim()) text = m.result.trim();
        costUsd = m.total_cost_usd ?? 0;
      }
    }
  } catch (e) {
    // The SDK can throw here too (a session limit on Max, 2026-10-18): the builder's own words
    // are better than losing the whole run's record after the game was built.
    console.log(`[player message not rewritten] ${String(e?.message || e).split('\n')[0].slice(0, 120)}`);
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
  progress(label ? label.replace(/^step (\d)\/(\d) (\w+)$/, (_, a, b, w) => `Step ${a} of ${b}: ${{ core: 'the playable game', content: 'levels and extras' }[w] || w}`)
    : isEdit ? 'Making your change' : 'Building your game');
  let result, failure = '', refused = false;
  // The model's silent thinking (10-13 min on a big Opus build, 40-80 s in a Haiku edit) is only a
  // stream of `thinking_tokens` events, so the progress line would sit on the last tool's words and the
  // chat would look stuck: tools/thinking.mjs words it ("Planning your game…", then "Still planning…").
  const thinking = { since: 0, planFrom: undefined };
  try {
  for await (const msg of query({
    prompt: request,
    options: {
      cwd: dir, model, effort,
      systemPrompt: slim ? sessionRules : { type: 'preset', preset: 'claude_code', append: sessionRules },
      ...ISOLATED,
      permissionMode: 'bypassPermissions',
      maxTurns: Number(opt('max-turns')) || (key === 'haiku' ? 50 : 60), // --max-turns: the Builder's ports only
      maxBudgetUsd: Number(opt('budget', BUDGET[isEdit ? 'edit' : 'new'][key])),
    },
  })) {
    appendFileSync(log, JSON.stringify(msg) + '\n');
    if (msg.type === 'system' && msg.subtype === 'thinking_tokens') {
      const line = thinkingLine(thinking, Date.now(), isEdit, { text: lastProgress, since: lastProgressAt });
      if (line) { console.log(`[${elapsed()}] ${line}`); progress(line); }
    } else if (msg.type === 'assistant' || msg.type === 'user') thinking.since = 0; // a tool line or text takes over
    if (msg.type === 'assistant') {
      for (const b of msg.message.content) {
        if (b.type === 'text' && b.text.trim()) console.log(`[${elapsed()}] ${b.text.trim().split('\n')[0].slice(0, 160)}`);
        else if (b.type === 'tool_use') {
          const i = b.input || {};
          console.log(`[${elapsed()}]   → ${b.name} ${String(i.file_path || i.command || i.pattern || '').replaceAll(dir.replaceAll('\\', '/'), '.').slice(0, 110)}`);
          progress(toolProgress(b.name, i));
        }
      }
    } else if (msg.type === 'result') result = msg;
    else if (msg.type === 'system' && msg.subtype === 'model_refusal_no_fallback') refused = true;
  }
  } catch (e) {
    // The SDK throws when a session hits its turn limit or crashes: treat it as a failed
    // attempt (the caller rolls back) instead of dying with the game half-changed.
    failure = String(e?.message || e).split('\n')[0].slice(0, 200);
    console.log(`\n[session ended early] ${failure}`);
  }
  progress('Testing the game');
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
    refused: refused || result?.stop_reason === 'refusal',
  };
}

// Before the folder goes back to the last good version, a failed attempt's files are kept as one
// commit on the branch `failed` (only the latest): a session cut off by a usage limit lost 19 min
// of a big port on 10-21. HEAD and its history never include it.
const rollback = () => {
  git('add', '-A');
  if (git('commit', '-qm', 'failed attempt (kept for recovery)').status === 0) {
    git('branch', '-f', 'failed', 'HEAD');
    git('reset', '-q', '--hard', 'HEAD~1');
  }
  git('reset', '-q', '--hard'); git('clean', '-qfd');
};
const commit = (msg) => { git('add', '-A'); git('commit', '-qm', msg.slice(0, 72)); };
// New games on Haiku are built in short sessions so no conversation grows past Haiku's
// 100K-token price step: core then polish, or for a big request core (one level), content,
// polish (2026-10-17: a big match-3 core used 47 of 50 turns, 18 of 21 calls in the 5× tier).
// Each step after the core that fails is rolled back to the last good version and the build
// goes on. --steps 1|2|3 overrides.
const steps = isEdit ? 1 : Number(opt('steps', route === 'haiku' ? (size === 'big' ? 3 : 2) : 1));
const PLAN = { 2: ['core', 'polish'], 3: ['core', 'content', 'polish'] }[steps];
const CORE_SCOPE = {
  2: ['', 'a short "Polish ideas" list for step 2'],
  3: ['\nThis is a big request, built in 3 sessions: make ONE level (or the first stretch) fully playable, with the first one or two of each kind of thing (tower types, enemies, specials, cars) working, and keep levels and types as plain data in one script so the rest slots in. Step 2 adds the rest of the content, step 3 the polish.\n',
    'a "Still to do" list (everything the player asked for that isn\'t built yet) and a short "Polish ideas" list'],
}[steps];
const stepRules = (name) => {
  if (name === 'core') return read('STEP_CORE.md').replace('{SCOPE}', CORE_SCOPE[0]).replace('{NEXT}', CORE_SCOPE[1]).replaceAll('{STEPS}', steps);
  return read(name === 'content' ? 'STEP_CONTENT.md' : 'STEP_POLISH.md').replaceAll('{STEPS}', steps);
};
const STEP_REQUEST = {
  content: `Add the rest of the content to the game the player asked for: "${prompt}"`,
  polish: `Polish the game the player asked for: "${prompt}"`,
};
const attempts = [];
let final;
if (PLAN) {
  for (const [i, name] of PLAN.entries()) {
    const a = await attempt(route, { request: STEP_REQUEST[name] || prompt, extra: stepRules(name), label: `step ${i + 1}/${steps} ${name}` });
    attempts.push(a);
    if (a.ok) { commit(`new (${name}): ${prompt}`); final = a; continue; }
    rollback(); // back to the last good version
    if (i === 0) { final = a; break; } // no playable core: the build failed
    console.log(`\nThe ${name} step did not pass; kept the last working version.`);
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
progress('Almost done');
// A new game built in steps: the core reply says what the game is, the later ones what was added.
const builderReply = PLAN && final.ok
  ? attempts.filter((a) => a.ok).map((a) => a.reply).join('\n\n')
  : final.reply;
// Beside it, the chat's 9 next-step ideas: only when the game changed; part of the answer's charge (below).
const [message, next] = await Promise.all([
  playerMessage(prompt, builderReply, { isNew: !isEdit }),
  final.ok
    ? nextSteps({ dir, reply: final.reply, query, options: { ...ISOLATED, model: MODELS.haiku, effort: 'low', tools: [], maxTurns: 1, systemPrompt: 'You suggest the next small change for a game a player is making by chat. Reply with a JSON array of strings only.' } })
    : { list: [], costUsd: 0 },
]);

// costUsd is the agent's work only (every attempt, for our own accounting); the player-message
// rewrite (messageCostUsd) and the next-step ideas (suggestionsCostUsd) are kept apart, and the
// server adds both to the charge (Luka, 10-24: every AI cost a player causes is theirs). chargeUsd is
// the agent's part of it: only the attempts that are in the game they receive (a step or a Haiku try
// that failed the check and was rolled back costs them nothing, as docs/pricing.md promises); 0 when
// the run failed.
const record = {
  date: new Date().toISOString(), game, kind: isEdit ? 'edit' : 'new', prompt, route: modelKey === 'auto' ? `auto→${route}` : route,
  genre, tags, size, steps, platform, playtest, slim, ok: final.ok, playerMessage: message.text, messageCostUsd: +message.costUsd.toFixed(4),
  suggestions: next.list, suggestionsCostUsd: +next.costUsd.toFixed(4),
  costUsd: +attempts.reduce((s, a) => s + a.costUsd, 0).toFixed(3),
  chargeUsd: final.ok ? +attempts.filter((a) => a.ok).reduce((s, a) => s + a.costUsd, 0).toFixed(3) : 0,
  minutes: +attempts.reduce((s, a) => s + a.minutes, 0).toFixed(1),
  attempts: attempts.map(({ reply, checkOutput, ...a }) => a),
};
// AGENT_LOG_DIR: on the live server this package is read-only; the runner collects the file.
appendFileSync(join(process.env.AGENT_LOG_DIR || HERE, 'runs.jsonl'), JSON.stringify(record) + '\n');
emit({ type: 'result', ...record, refused: !record.ok && attempts.some((a) => a.refused) });

console.log(`\n--- agent's own reply ---\n${final.reply || '(none)'}\n`);
console.log(`--- shown to the player ($${message.costUsd.toFixed(4)}) ---\n${message.text || '(none)'}\n`);
if (next.list.length) console.log(`--- next steps ($${next.costUsd.toFixed(4)}) ---\n${next.list.join(' | ')}\n`);
console.log(`--- ${record.ok ? 'OK' : 'FAILED (rolled back)'}: ${record.minutes} min, ~$${record.costUsd} at API prices (player pays $${record.chargeUsd}), route ${record.route}`);
for (const a of attempts) console.log(`    ${a.step ? a.step + ' ' : ''}${a.model} ${a.effort}: ${a.ok ? 'ok' : 'failed'}, ${a.minutes} min, ${a.turns} turns, $${a.costUsd}, ${JSON.stringify(a.tokens)}`);
if (!final.ok) console.log(final.checkOutput);
console.log(`play: node tools/serve.mjs ${dirOpt ? dir : `output/${game}`}`);
