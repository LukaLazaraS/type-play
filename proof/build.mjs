// Runs the game agent on one prompt and records what it cost.
//   New game:  node build.mjs --model sonnet --name runner --prompt "Make an endless runner ..."
//   Edit:      node build.mjs --model sonnet --name runner --edit --prompt "Add double jump"
// A new game copies template/ into output/<name>-<model>/. An edit resumes that folder's agent
// session, like a follow-up message in the product's chat. Each run appends a line to runs.jsonl.
// Auth: no ANTHROPIC_API_KEY set → the SDK uses the Claude Code login on this PC (Luka's Max).
import { query } from '@anthropic-ai/claude-agent-sdk';
import { cpSync, existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MODELS = { opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' };

const args = process.argv.slice(2);
const opt = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
const modelKey = opt('model', 'sonnet');
const model = MODELS[modelKey] || modelKey;
const effort = opt('effort', 'high');
const name = opt('name', 'game');
const prompt = opt('prompt');
const isEdit = args.includes('--edit');
if (!prompt) { console.error('missing --prompt'); process.exit(2); }

if (process.env.ANTHROPIC_API_KEY && process.env.AGENT_AUTH !== 'api') {
  console.error('ANTHROPIC_API_KEY is set: unset it to run on Max, or set AGENT_AUTH=api to bill the API.');
  process.exit(2);
}

const dir = join(HERE, 'output', `${name}-${modelKey}`);
const sessionFile = join(dir, '.agent-session.json');
let resume;
if (isEdit) {
  if (!existsSync(sessionFile)) { console.error(`no game to edit in ${dir}`); process.exit(2); }
  resume = JSON.parse(readFileSync(sessionFile, 'utf8')).sessionId;
} else {
  if (existsSync(dir)) { console.error(`${dir} exists: pick another --name`); process.exit(2); }
  mkdirSync(dirname(dir), { recursive: true });
  cpSync(join(HERE, 'template'), dir, { recursive: true });
}

const checkPath = join(HERE, 'tools', 'check.mjs').replaceAll('\\', '/');
const rules = readFileSync(join(HERE, 'agent', 'GODOT_RULES.md'), 'utf8').replaceAll('{CHECK}', checkPath);
const log = join(dir, '.agent-log.jsonl');
const t0 = Date.now();
const elapsed = () => `${((Date.now() - t0) / 60000).toFixed(1)}m`;
console.log(`${isEdit ? 'EDIT' : 'NEW'} ${name} on ${model} (effort ${effort})\n> ${prompt}\n`);

let result;
for await (const msg of query({
  prompt,
  options: {
    cwd: dir,
    model,
    effort,
    resume,
    systemPrompt: { type: 'preset', preset: 'claude_code', append: rules },
    settingSources: [], // never load this repo's CLAUDE.md or Luka's user settings
    permissionMode: 'bypassPermissions',
    allowedTools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'TodoWrite'],
    disallowedTools: ['WebSearch', 'WebFetch', 'Task', 'NotebookEdit'],
    maxTurns: 80,
    maxBudgetUsd: 8,
  },
})) {
  appendFileSync(log, JSON.stringify(msg) + '\n');
  if (msg.type === 'system' && msg.subtype === 'init') {
    writeFileSync(sessionFile, JSON.stringify({ sessionId: msg.session_id }));
  } else if (msg.type === 'assistant') {
    for (const block of msg.message.content) {
      if (block.type === 'text' && block.text.trim()) {
        console.log(`[${elapsed()}] ${block.text.trim().split('\n')[0].slice(0, 160)}`);
      } else if (block.type === 'tool_use') {
        const i = block.input || {};
        const what = i.file_path || i.command || i.pattern || '';
        console.log(`[${elapsed()}]   → ${block.name} ${String(what).replaceAll(dir.replaceAll('\\', '/'), '.').slice(0, 120)}`);
      }
    }
  } else if (msg.type === 'result') {
    result = msg;
  }
}

// Confirm the final state ourselves, independent of what the agent said.
const check = spawnSync('node', [checkPath], { cwd: dir, encoding: 'utf8' });
const checkOk = check.status === 0;

const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
for (const u of Object.values(result?.modelUsage || {})) {
  tokens.input += u.inputTokens; tokens.output += u.outputTokens;
  tokens.cacheRead += u.cacheReadInputTokens; tokens.cacheWrite += u.cacheCreationInputTokens;
}
const record = {
  date: new Date().toISOString(), name, kind: isEdit ? 'edit' : 'new', model, effort, prompt,
  minutes: +((Date.now() - t0) / 60000).toFixed(1), turns: result?.num_turns,
  costUsd: +(result?.total_cost_usd ?? 0).toFixed(3), tokens,
  agentStatus: result?.subtype, finalCheck: checkOk ? 'OK' : 'FAIL',
};
appendFileSync(join(HERE, 'runs.jsonl'), JSON.stringify(record) + '\n');

console.log(`\n--- agent's reply ---\n${result?.result ?? '(none)'}\n`);
console.log(`--- ${record.minutes} min, ${record.turns} turns, ~$${record.costUsd} at API prices, final check ${record.finalCheck}`);
console.log(`tokens: ${JSON.stringify(tokens)}`);
if (!checkOk) console.log(check.stdout);
console.log(`play: node tools/serve.mjs output/${name}-${modelKey}`);
