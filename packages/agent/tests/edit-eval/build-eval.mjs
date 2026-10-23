// One logged new-game build, then the baseline check of the result (2026-10-20, RESULTS.md "the low-effort test"):
//   node tests/edit-eval/build-eval.mjs --game lowtest-match3-low --model haiku --effort low [--budget 1] --prompt "..."
// Like edit-eval.mjs but for `run.mjs` without --edit: the product's own path (`run.mjs ... --events`, through the CPU
// limiter, one build at a time), every output line stamped with the second it arrived (output/_edit-eval/runs/<game>.build.log),
// the result record kept (runs/<game>.build.json), and then `edit-eval.mjs --baseline` on the finished game for the check's
// frame rate, test counts and screenshots (runs/<game>-base.json). Prompts must not contain double quotes, % or ^.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = join(HERE, '..', '..');
const OUT = join(AGENT, 'output', '_edit-eval', 'runs');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const game = opt('game'), model = opt('model', 'haiku'), effort = opt('effort', 'medium'), budget = opt('budget'), prompt = opt('prompt');
const timeoutMin = Number(opt('timeout', 60));
if (!game || !prompt) { console.error('need --game and --prompt'); process.exit(2); }
if (existsSync(join(AGENT, 'output', game))) { console.error(`${game} exists`); process.exit(2); }
mkdirSync(OUT, { recursive: true });
const killTree = (pid) => (process.platform === 'win32' ? spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }) : spawnSync('pkill', ['-P', String(pid)]));

const logFile = join(OUT, `${game}.build.log`);
writeFileSync(logFile, '');
const runArgs = [join(AGENT, 'tools', 'cpu.mjs'), 'node', 'run.mjs', '--game', game, '--model', model, '--effort', effort, ...(budget ? ['--budget', budget] : []), '--events', '--prompt', prompt];
const t0 = Date.now();
const run = await new Promise((resolve) => {
  const child = spawn(process.execPath, runArgs, { cwd: AGENT, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  let timedOut = false, buf = '';
  const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, timeoutMin * 60_000);
  const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s `;
  const onData = (d) => { buf += d.toString(); let i; while ((i = buf.indexOf('\n')) >= 0) { appendFileSync(logFile, `${stamp()}${buf.slice(0, i)}\n`); buf = buf.slice(i + 1); } };
  child.stdout.on('data', onData); child.stderr.on('data', onData);
  child.on('close', (code) => { clearTimeout(timer); if (buf) appendFileSync(logFile, `${stamp()}${buf}\n`); resolve({ code, timedOut, seconds: (Date.now() - t0) / 1000 }); });
});
const text = readFileSync(logFile, 'utf8').split('\n').map((l) => l.replace(/^\s*\d+s /, '')).join('\n');
const resultLine = text.split('\n').find((l) => l.startsWith('@@event {"type":"result"'));
const rec = resultLine ? JSON.parse(resultLine.slice(8)) : null;
const classified = text.match(/^classified: "(.*)"$/m)?.[1];
// seconds at which the first game file was written (the silent planning before it is what the player waits through)
const firstWrite = readFileSync(logFile, 'utf8').split('\n').map((l) => l.match(/^\s*(\d+)s .*→ (Write|Edit) .*\.gd/)).find(Boolean)?.[1];
const summary = {
  game, model, effort, budget: budget ?? 'product default', prompt, run, classified, firstWriteSeconds: firstWrite ? Number(firstWrite) : null,
  record: rec && { ok: rec.ok, route: rec.route, genre: rec.genre, size: rec.size, steps: rec.steps, minutes: rec.minutes, costUsd: rec.costUsd, chargeUsd: rec.chargeUsd, messageCostUsd: rec.messageCostUsd, playerMessage: rec.playerMessage, refused: rec.refused,
    attempts: rec.attempts?.map((a) => ({ step: a.step, effort: a.effort, ok: a.ok, minutes: a.minutes, turns: a.turns, costUsd: a.costUsd, agentStatus: a.agentStatus, tokens: a.tokens })) },
};
const creditsFor = (usd) => Math.max(0.1, Math.ceil((usd / 0.06) * 10 - 1e-9) / 10);
if (rec) summary.credits = creditsFor((rec.chargeUsd ?? rec.costUsd) + (rec.messageCostUsd ?? 0));
writeFileSync(join(OUT, `${game}.build.json`), JSON.stringify(summary, null, 1));
const r = summary.record;
console.log(`[${game}] ${r?.ok ? 'OK' : 'FAILED'} ${model} ${effort} | classified ${classified} steps ${r?.steps} | ${r?.minutes} min | $${r?.costUsd} (charge $${r?.chargeUsd}, +msg $${r?.messageCostUsd}) = ${summary.credits} credits | first file at ${summary.firstWriteSeconds}s | `
  + (r?.attempts || []).map((a) => `${a.step || 'single'}: ${a.minutes}m $${a.costUsd} ${a.turns}t ${a.ok ? 'ok' : a.agentStatus}`).join(' ; '));
if (existsSync(join(AGENT, 'output', game, 'project.godot'))) {
  const b = spawnSync(process.execPath, [join(HERE, 'edit-eval.mjs'), '--copy', game, '--baseline'], { cwd: AGENT, encoding: 'utf8' });
  console.log((b.stdout || b.stderr || '').trim().split('\n').slice(-2).join('\n'));
}
