// One measured chat edit on a copy of a game, start to finish (2026-10-19, RESULTS.md "chat edits on big games").
//   node tests/fork.mjs <game> <copy>                                     (a copy with its git history; the original stays untouched)
//   node tests/edit-eval/edit-eval.mjs --copy edit-show-td --baseline     (the check on the untouched copy: tests, fps, pictures)
//   node tests/edit-eval/edit-eval.mjs --copy edit-show-td --id td1-fast --model haiku [--effort medium] [--budget 1] --prompt "..."
// Run one at a time (each takes the PC's heavy-work slot). Steps for an edit:
//   1. snapshot before (screenshots, the last check's test lines, git head, how many agent sessions the log holds)
//   2. node tools/cpu.mjs node run.mjs --game <copy> --edit --model .. --events --prompt ..   (output kept with timestamps)
//   3. a fresh check of the result, screenshots, brightness, git diff, a log analysis (analyze.mjs)
// Everything lands in output/_edit-eval/ (git-ignored): runs/<id>.json, runs/<id>.run.log, before/ and after/ pictures.
// Prompts must not contain double quotes, % or ^ (they pass through cmd.exe on Windows).
import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stats } from './bright.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = join(HERE, '..', '..');
const OUT = join(AGENT, 'output', '_edit-eval');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const copy = opt('copy');
const baseline = args.includes('--baseline');
const id = opt('id', baseline ? `${copy}-base` : undefined);
const model = opt('model', 'haiku');
const effort = opt('effort', 'medium');
const budget = opt('budget', model === 'haiku' ? '1' : '2'); // raised above the product caps ($0.15 / $0.75) so nothing stops a run early
const prompt = opt('prompt');
const timeoutMin = Number(opt('timeout', model === 'haiku' ? 45 : 60));
if (!copy || !id || (!baseline && !prompt)) { console.error('need --copy, --id, --prompt (or --baseline)'); process.exit(2); }
const dir = join(AGENT, 'output', copy);
if (!existsSync(join(dir, '.git'))) { console.error('no game ' + dir); process.exit(2); }
for (const d of ['runs', 'before', 'after', 'checks']) mkdirSync(join(OUT, d), { recursive: true });
const sh = (cmd, a, cwd = dir) => spawnSync(cmd, a, { cwd, encoding: 'utf8' });
const git = (...a) => sh('git', a).stdout.trim();
const killTree = (pid) => (process.platform === 'win32' ? spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' }) : spawnSync('pkill', ['-P', String(pid)]));

function runLogged(cmd, a, cwd, outFile, timeoutMs) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(cmd, a, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, timeoutMs);
    let buf = '';
    const stamp = () => `${((Date.now() - t0) / 1000).toFixed(0).padStart(5)}s `;
    const onData = (d) => {
      buf += d.toString();
      let i;
      while ((i = buf.indexOf('\n')) >= 0) { appendFileSync(outFile, `${stamp()}${buf.slice(0, i)}\n`); buf = buf.slice(i + 1); }
    };
    child.stdout.on('data', onData); child.stderr.on('data', onData);
    child.on('close', (code) => { clearTimeout(timer); if (buf) appendFileSync(outFile, `${stamp()}${buf}\n`); resolve({ code, timedOut, seconds: (Date.now() - t0) / 1000 }); });
  });
}

const SHOTS = ['start', 'play', 'later'];
const snapShots = (to) => { mkdirSync(to, { recursive: true }); for (const s of SHOTS) { const f = join(dir, 'export', `screenshot-${s}.png`); if (existsSync(f)) cpSync(f, join(to, `${s}.png`)); } };
const brightness = (from) => Object.fromEntries(SHOTS.map((s) => { try { return [s, stats(join(from, `${s}.png`)).mean]; } catch { return [s, null]; } }));
const unstamp = (text) => text.split('\n').map((l) => l.replace(/^\s*\d+s /, '')).join('\n');
const parseCheck = (text) => ({
  verdict: /CHECK: OK/.test(text) ? 'OK' : /CHECK: FAIL/.test(text) ? 'FAIL' : '?',
  errors: [...text.matchAll(/^ {2}(\[.*)$/gm)].map((m) => m[1]).slice(0, 8),
  fps: text.match(/frames a second[^:]*: (.*)/)?.[1] ?? null,
  tests: Object.fromEntries((text.match(/^tests: (.*)$/m)?.[1] ?? '').split('; ').filter(Boolean).map((t) => { const m = t.match(/^(.*?): (\d+) passed, (\d+) failed/); return m ? [m[1], `${m[2]}/${Number(m[2]) + Number(m[3])}`] : [t, '?']; })),
});

async function check(label) {
  const out = join(OUT, 'runs', `${id}.${label}.check.txt`);
  writeFileSync(out, '');
  const r = await runLogged(process.execPath, [join(AGENT, 'tools', 'cpu.mjs'), 'node', join(AGENT, 'tools', 'check.mjs')], dir, out, 8 * 60_000);
  const text = unstamp(readFileSync(out, 'utf8'));
  writeFileSync(join(OUT, 'checks', `${copy}.last.txt`), text);
  return { ...parseCheck(text), seconds: Math.round(r.seconds), timedOut: r.timedOut };
}

const summary = { id, copy, baseline, model, effort, budget, prompt, startedAt: new Date().toISOString() };

if (baseline) {
  const c = await check('base');
  snapShots(join(OUT, 'after', id));
  Object.assign(summary, { check: c, bright: brightness(join(OUT, 'after', id)) });
  writeFileSync(join(OUT, 'runs', `${id}.json`), JSON.stringify(summary, null, 1));
  console.log(`[${id}] baseline check ${c.verdict} ${c.seconds}s | fps ${c.fps} | tests ${JSON.stringify(c.tests)} | bright ${JSON.stringify(summary.bright)}`);
  process.exit(0);
}

// ---- before
const beforeHead = git('rev-parse', 'HEAD');
const logFile = join(dir, '.agent-log.jsonl');
const sessionsBefore = existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n').filter((l) => l.includes('"subtype":"init"')).length : 0;
if (git('status', '--porcelain')) { console.error('game folder is not clean:\n' + git('status', '--short')); process.exit(3); }
const beforeDir = join(OUT, 'before', id);
snapShots(beforeDir);
const lastCheck = join(OUT, 'checks', `${copy}.last.txt`);
summary.beforeHead = beforeHead;
summary.beforeCheck = existsSync(lastCheck) ? parseCheck(readFileSync(lastCheck, 'utf8')) : null;
summary.beforeBright = brightness(beforeDir);
summary.codeBefore = git('ls-files', '*.gd').split('\n').filter((f) => f && !f.startsWith('test/')).reduce((n, f) => n + readFileSync(join(dir, f), 'utf8').split('\n').length, 0);

// ---- the edit itself, through the CPU limiter, like the product runs it
const runOut = join(OUT, 'runs', `${id}.run.log`);
writeFileSync(runOut, '');
const runArgs = [join(AGENT, 'tools', 'cpu.mjs'), 'node', 'run.mjs', '--game', copy, '--edit', '--model', model, '--effort', effort, '--budget', budget, '--events', '--prompt', prompt];
summary.run = await runLogged(process.execPath, runArgs, AGENT, runOut, timeoutMin * 60_000);
const runText = unstamp(readFileSync(runOut, 'utf8'));
const resultLine = runText.split('\n').find((l) => l.startsWith('@@event {"type":"result"'));
const rec = resultLine ? JSON.parse(resultLine.slice(8)) : null;
summary.record = rec && { ok: rec.ok, route: rec.route, minutes: rec.minutes, costUsd: rec.costUsd, chargeUsd: rec.chargeUsd, messageCostUsd: rec.messageCostUsd, playerMessage: rec.playerMessage, refused: rec.refused,
  attempts: rec.attempts?.map((a) => ({ model: a.model, effort: a.effort, ok: a.ok, minutes: a.minutes, turns: a.turns, costUsd: a.costUsd, agentStatus: a.agentStatus, tokens: a.tokens })) };
// the progress lines with the second they arrived: what the player would have seen
summary.progress = readFileSync(runOut, 'utf8').split('\n').filter((l) => l.includes('@@event {"type":"progress"')).map((l) => { const m = l.match(/^\s*(\d+)s @@event (.*)$/); return [Number(m[1]), JSON.parse(m[2]).text]; });
const creditsFor = (usd) => Math.max(0.1, Math.ceil((usd / 0.06) * 10 - 1e-9) / 10); // docs/pricing.md: ÷ $0.06, up to 0.1, at least 0.1
if (rec) summary.credits = { charged: rec.ok ? creditsFor((rec.chargeUsd ?? rec.costUsd) + (rec.messageCostUsd ?? 0)) : 0, ifSucceeded: creditsFor(rec.costUsd + (rec.messageCostUsd ?? 0)) };

// ---- after
summary.afterHead = git('rev-parse', 'HEAD');
summary.committed = summary.afterHead !== beforeHead;
summary.status = git('status', '--porcelain');
if (summary.committed) {
  summary.diff = git('diff', '--numstat', beforeHead, 'HEAD').split('\n').filter(Boolean).map((l) => { const [a, d, f] = l.split('\t'); return { f, add: Number(a) || 0, del: Number(d) || 0 }; });
  summary.diffTotals = { files: summary.diff.length, add: summary.diff.reduce((s, x) => s + x.add, 0), del: summary.diff.reduce((s, x) => s + x.del, 0) };
}
summary.check = await check('after');
snapShots(join(OUT, 'after', id));
summary.bright = brightness(join(OUT, 'after', id));
const an = sh(process.execPath, [join(HERE, 'analyze.mjs'), dir, String(sessionsBefore + 1), beforeHead]);
try { summary.analysis = JSON.parse(an.stdout); } catch { summary.analysis = { error: (an.stderr || an.stdout).slice(0, 300) }; }
summary.finishedAt = new Date().toISOString();
writeFileSync(join(OUT, 'runs', `${id}.json`), JSON.stringify(summary, null, 1));

const a = summary.analysis, r0 = summary.record, post = summary.check;
console.log(`[${id}] ${r0?.ok ? 'OK' : 'FAILED'} ${model} | ${r0?.minutes}min | $${r0?.costUsd} (+msg $${r0?.messageCostUsd}) = ${summary.credits?.ifSucceeded} credits | turns ${r0?.attempts?.[0]?.turns} calls ${a.apiCalls} ctxMax ${a.ctxMaxK}K >100K:${a.over100k} | `
  + `diff ${summary.diffTotals ? `${summary.diffTotals.files}f +${summary.diffTotals.add}/-${summary.diffTotals.del}` : 'none'} | check ${post.verdict} fps ${post.fps} | tests ${JSON.stringify(summary.beforeCheck?.tests)} -> ${JSON.stringify(post.tests)} | bright ${JSON.stringify(summary.beforeBright)} -> ${JSON.stringify(summary.bright)}`);
if (!r0?.ok) console.log(`   agentStatus: ${r0?.attempts?.map((x) => x.agentStatus).join(' | ')}; check errors: ${(post.errors || []).slice(0, 3).join(' | ')}`);
