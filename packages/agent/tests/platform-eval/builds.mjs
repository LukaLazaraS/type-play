// The platform measurement (Luka 10-25): six prompts (prompts.json), each built three ways on Smart (Sonnet,
// medium effort: the app's default for a new game), three builds at a time: the three ways of one prompt start
// together, so they share the PC (and the one hidden browser) alike.
//   a  today's agent: a frozen copy of packages/agent from before the platform rules (`git archive 0e80a22
//      packages/agent` into data/measure/agent-today): the window stretches to any shape, no touch rules
//   b  the base rules: this package, --platform auto (one shape with bars; touch, mouse and keys; a real touch
//      layout for complex games)
//   c  fills every screen: this package, --platform fill
//   node tests/platform-eval/builds.mjs --classify     once: each prompt's genre (the runner's own Haiku call), so all
//                                                      three ways of a prompt get the same genre skill (genres.json)
//   node tests/platform-eval/builds.mjs [--only runner,flappy] [--ways a,b,c] [--today <frozen run.mjs>]
// Games: output/plat-<prompt>-<way>. Records: output/_platform-eval/<prompt>-<way>.json (+ .log, timestamped).
// Runs on this PC's Claude login (Max), like the local site: every CLAUDE* variable of a parent session is
// dropped (the server's agent.ts does the same) and no API key is passed.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limitThisProcess } from '../../tools/cpu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = join(HERE, '..', '..');
const REPO = join(AGENT, '..', '..');
const OUT = join(AGENT, 'output', '_platform-eval');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const PROMPTS = JSON.parse(readFileSync(join(HERE, 'prompts.json'), 'utf8'));
const GENRES_FILE = join(HERE, 'genres.json');
const TODAY = resolve(opt('today', join(REPO, 'data', 'measure', 'agent-today', 'packages', 'agent', 'run.mjs')));
const TIMEOUT_MIN = 45;
mkdirSync(OUT, { recursive: true });
limitThisProcess(); // the builds, Godot and the hidden browser inherit it: 12 of 16 cores, below normal

// Out of this process's environment, so the classify call and every build start clean.
for (const k of Object.keys(process.env)) if (/^CLAUDE/.test(k) && k !== 'CLAUDE_CODE_OAUTH_TOKEN' && k !== 'CLAUDE_CONFIG_DIR') delete process.env[k];
for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'AGENT_AUTH']) delete process.env[k];

if (args.includes('--classify')) {
  // The same question run.mjs asks (classify()), once per prompt.
  const { query } = await import('@anthropic-ai/claude-agent-sdk');
  const GENRES = ['puzzle', 'racer', 'runner', 'towerdefence'];
  const hint = (g) => readFileSync(join(AGENT, 'genres', g, 'GENRE.md'), 'utf8').match(/^## Genre: (.*)$/m)?.[1] ?? g;
  const out = {};
  for (const p of PROMPTS) {
    let answer = '';
    for await (const m of query({
      prompt: `A player asked for this game:\n"${p.prompt}"\n\nGenres:\n${GENRES.map((g) => `- ${g}: ${hint(g)}`).join('\n')}\n- none: anything else\n\n`
        + 'Size: "big" only if the request itself asks for several levels or a level map, or lists 4 or more separate features (such as several tower or piece types, upgrades, specials, saving progress, a shop, menus); otherwise "small", also for a short request in a complex genre.\n\n'
        + 'Answer with exactly two words: the genre, then the size. Example: "puzzle small".',
      options: { tools: [], settingSources: [], settings: { disableClaudeAiConnectors: true }, strictMcpConfig: true, mcpServers: {}, skills: [],
        model: 'claude-haiku-5-5', effort: 'low', maxTurns: 1, systemPrompt: 'You classify game requests. Answer with two words.' },
    })) if (m.type === 'result') answer = (m.result || '').trim().toLowerCase();
    const flat = answer.replace(/defense/g, 'defence').replace(/[^a-z]/g, '');
    out[p.id] = GENRES.find((g) => flat.includes(g)) || 'none';
    console.log(`${p.id}: "${answer}" → ${out[p.id]}`);
  }
  writeFileSync(GENRES_FILE, JSON.stringify(out, null, 2) + '\n');
  process.exit(0);
}

if (!existsSync(GENRES_FILE)) { console.error('run --classify first'); process.exit(2); }
if (!existsSync(TODAY)) { console.error(`no frozen agent at ${TODAY}`); process.exit(2); }
const genres = JSON.parse(readFileSync(GENRES_FILE, 'utf8'));
const only = opt('only')?.split(',');
const ways = (opt('ways', 'a,b,c')).split(',');
const killTree = (pid) => spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });

function build(p, way) {
  const id = `${p.id}-${way}`;
  const dir = join(AGENT, 'output', `plat-${id}`);
  const runMjs = way === 'a' ? TODAY : join(AGENT, 'run.mjs');
  const a = [runMjs, '--dir', dir, '--prompt', p.prompt, '--model', 'sonnet', '--effort', 'medium', '--genre', genres[p.id], '--events'];
  if (way === 'b') a.push('--platform', 'auto');
  if (way === 'c') a.push('--platform', 'fill');
  const log = join(OUT, `${id}.log`);
  writeFileSync(log, `$ node ${a.join(' ')}\n`);
  return new Promise((done) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, a, { cwd: dirname(runMjs), stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, TIMEOUT_MIN * 60_000);
    let buf = '', record = null;
    const onData = (d) => {
      buf += d.toString();
      for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) {
        const line = buf.slice(0, i);
        appendFileSync(log, `${String(Math.round((Date.now() - t0) / 1000)).padStart(5)}s ${line}\n`);
        if (line.startsWith('@@event ')) try { const e = JSON.parse(line.slice(8)); if (e.type === 'result') record = e; } catch {}
      }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('close', (code) => {
      clearTimeout(timer);
      const result = { id, prompt: p.id, kind: p.kind, way, genre: genres[p.id], code, timedOut, wallMinutes: +((Date.now() - t0) / 60000).toFixed(1), record };
      writeFileSync(join(OUT, `${id}.json`), JSON.stringify(result, null, 2) + '\n');
      console.log(`${new Date().toISOString().slice(11, 19)} ${id}: ${record ? (record.ok ? 'OK' : 'FAILED') : `no record (exit ${code}${timedOut ? ', timed out' : ''})`}${record ? `, ${record.minutes} min, $${record.costUsd}` : ''}`);
      done(result);
    });
  });
}

for (const p of PROMPTS) {
  if (only && !only.includes(p.id)) continue;
  const todo = ways.filter((w) => !existsSync(join(OUT, `${p.id}-${w}.json`)) && !existsSync(join(AGENT, 'output', `plat-${p.id}-${w}`)));
  if (!todo.length) continue;
  console.log(`${new Date().toISOString().slice(11, 19)} ${p.id}: building ${todo.join(', ')}`);
  await Promise.all(todo.map((w) => build(p, w)));
}
console.log('all done');
