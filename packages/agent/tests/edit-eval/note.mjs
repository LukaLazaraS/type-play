// Adds the reviewer's words to one measured run (output/_edit-eval/runs/<id>.json) so the gallery can show them:
//   node tests/edit-eval/note.mjs <id> --verdict better|same|worse|mixed --note "what changed, measured" [--rolled-back] [--set key=value ...]
// Fields: verdict, note (what the edit did and how it was measured), rolledBack. Run again to overwrite.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RUNS = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'output', '_edit-eval', 'runs');
const args = process.argv.slice(2);
const id = args[0];
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const file = join(RUNS, `${id}.json`);
if (!id || !existsSync(file)) { console.error(`no run ${id} in ${RUNS}`); process.exit(2); }
const run = JSON.parse(readFileSync(file, 'utf8'));
if (opt('verdict')) run.verdict = opt('verdict');
if (opt('note')) run.note = opt('note');
if (args.includes('--rolled-back')) run.rolledBack = true;
for (const [i, a] of args.entries()) if (a === '--set') { const [k, ...v] = args[i + 1].split('='); run[k] = v.join('='); }
writeFileSync(file, JSON.stringify(run, null, 1));
console.log(`${id}: ${run.verdict ?? '-'}${run.rolledBack ? ' (rolled back)' : ''} | ${run.note ?? ''}`);
