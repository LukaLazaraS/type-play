// Copies an existing game as a new game folder, so several experiments start from the exact
// same version:  node tests/fork.mjs <base game> <new game>
// The copy keeps its git history and NOTES.md; runs.jsonl gets a "new" record that points to
// the base, so the gallery shows the base's model, effort and build cost.
import { cpSync, existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..');
const [base, name] = process.argv.slice(2);
const from = join(HERE, 'output', base);
const to = join(HERE, 'output', name);
if (!existsSync(join(from, '.git'))) { console.error(`no game ${base}`); process.exit(2); }
if (existsSync(to)) { console.error(`${name} exists`); process.exit(2); }

const realBase = base.replace(/-original$/, '');
const record = readFileSync(join(HERE, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean)
  .map((l) => JSON.parse(l)).find((r) => r.game === realBase && r.kind === 'new');
cpSync(from, to, { recursive: true });
appendFileSync(join(HERE, 'runs.jsonl'), JSON.stringify({ ...record, date: new Date().toISOString(), game: name, forkOf: base }) + '\n');
console.log(`${name} ← ${base} (${record.attempts[0].model} ${record.attempts[0].effort})`);
