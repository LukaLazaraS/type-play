// The genre and tags measurement (Luka 10-27, /create's Genre and Tags): one idea that names no genre and no look, built
// on Smart (Sonnet, medium effort: the app's default for a new game) as each genre with no tags, then with each tag, so
// the picks alone decide what is built and a tag's cost shows against the same genre without it. Three builds at a
// time (they share the PC and the one hidden browser), each genre's ways in turn.
//   node tests/tags-eval/builds.mjs [--only puzzle,racer] [--ways none,3d,retro,cute,cozy,hard]
// Games: output/tag-<genre>-<way>. Records: output/_tags-eval/<genre>-<way>.json (+ .log, timestamped). The table:
// node tests/tags-eval/table.mjs. Runs on this PC's Claude login (Max), like the local site: every CLAUDE* variable of
// a parent session is dropped (the server's agent.ts does the same) and no API key is passed.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limitThisProcess } from '../../tools/cpu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = join(HERE, '..', '..');
const OUT = join(AGENT, 'output', '_tags-eval');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
export const PROMPT = 'A game about a fox who collects berries in a forest.';
export const GENRES = ['puzzle', 'racer', 'runner', 'towerdefence'];
/** Each way's tags; the runner's Retro comes with 2D (the brief's "Runner + Retro + 2D"; 2D is a runner's default). */
export const WAYS = { none: [], '3d': ['3d'], retro: ['retro'], cute: ['cute'], cozy: ['cozy'], hard: ['hard'] };
const tagsOf = (genre, way) => (genre === 'runner' && way === 'retro' ? ['2d', 'retro'] : WAYS[way]);
const TIMEOUT_MIN = 45;
mkdirSync(OUT, { recursive: true });
limitThisProcess(); // the builds, Godot and the hidden browser inherit it: 12 of 16 cores, below normal

for (const k of Object.keys(process.env)) if (/^CLAUDE/.test(k) && k !== 'CLAUDE_CODE_OAUTH_TOKEN' && k !== 'CLAUDE_CONFIG_DIR') delete process.env[k];
for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL', 'AGENT_AUTH']) delete process.env[k];

const only = opt('only')?.split(',') ?? GENRES.slice(0, 3);
const ways = opt('ways', 'none,3d,retro').split(',');
const killTree = (pid) => spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });

function build(genre, way) {
  const id = `${genre}-${way}`;
  const dir = join(AGENT, 'output', `tag-${id}`);
  const tags = tagsOf(genre, way);
  const a = [join(AGENT, 'run.mjs'), '--dir', dir, '--prompt', PROMPT, '--model', 'sonnet', '--effort', 'medium', '--genre', genre, '--events'];
  if (tags.length) a.push('--tags', tags.join(','));
  const log = join(OUT, `${id}.log`);
  writeFileSync(log, `$ node ${a.join(' ')}\n`);
  return new Promise((done) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, a, { cwd: AGENT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
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
      const result = { id, genre, way, tags, prompt: PROMPT, code, timedOut, wallMinutes: +((Date.now() - t0) / 60000).toFixed(1), record };
      writeFileSync(join(OUT, `${id}.json`), JSON.stringify(result, null, 2) + '\n');
      console.log(`${new Date().toISOString().slice(11, 19)} ${id}: ${record ? (record.ok ? 'OK' : 'FAILED') : `no record (exit ${code}${timedOut ? ', timed out' : ''})`}${record ? `, ${record.minutes} min, $${record.costUsd}` : ''}`);
      done(result);
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Three at a time, in order: each genre's ways, then the next genre's (a build that is done or under way is skipped).
  const todo = only.flatMap((genre) => ways.map((way) => [genre, way]))
    .filter(([g, w]) => !existsSync(join(OUT, `${g}-${w}.json`)) && !existsSync(join(AGENT, 'output', `tag-${g}-${w}`)));
  console.log(`${new Date().toISOString().slice(11, 19)} building ${todo.map(([g, w]) => `${g}-${w}`).join(', ')}`);
  const next = async () => { for (let job; (job = todo.shift()); ) await build(...job); };
  await Promise.all([next(), next(), next()]);
  console.log('all done');
}
