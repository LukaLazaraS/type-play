// Checks the genres and tags a player can pick on /create against what the game agent has (2026-10-27): every tag is a
// rule file here (tags/<name>.md) with its heading, and the same names are in the contract (packages/shared GameTag) and
// in the API's list (apps/server/src/games/picks.ts TAGS); every genre in the contract (Genre) is a skill folder here.
// Then run.mjs refuses a bad --tags before anything else runs (no model call): node tests/tags.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AGENT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(AGENT, '..', '..');
const words = (union) => [...union.matchAll(/"([a-z0-9]+)"/g)].map((m) => m[1]).sort();
const shared = readFileSync(join(REPO, 'packages', 'shared', 'src', 'index.ts'), 'utf8');

const files = readdirSync(join(AGENT, 'tags')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)).sort();
for (const t of files) assert.match(readFileSync(join(AGENT, 'tags', `${t}.md`), 'utf8'), /^## Tag: \S/, `tags/${t}.md starts with "## Tag: <name>"`);
assert.deepEqual(words(/export type GameTag = ([^;]+);/.exec(shared)[1]), files, 'packages/shared GameTag lists the tag files');
const server = readFileSync(join(REPO, 'apps', 'server', 'src', 'games', 'picks.ts'), 'utf8');
assert.deepEqual(words(/export const TAGS: GameTag\[\] = \[([^\]]+)\]/.exec(server)[1]), files, "the API's TAGS lists the tag files");
const genres = words(/export type Genre = ([^;]+);/.exec(shared)[1]);
for (const g of genres) assert.match(readFileSync(join(AGENT, 'genres', g, 'GENRE.md'), 'utf8'), /^## Genre: \S/, `genre ${g} has a skill`);
assert.deepEqual(readdirSync(join(AGENT, 'genres')).filter((g) => existsSync(join(AGENT, 'genres', g, 'GENRE.md'))).sort(), genres, 'every genre skill is in the contract');

const refused = (tags) => spawnSync(process.execPath, [join(AGENT, 'run.mjs'), '--game', 'tags-test', '--prompt', 'A test game', '--tags', tags], { encoding: 'utf8', cwd: AGENT });
for (const bad of ['2d,3d', '2d,25d', '25d,3d', 'cozy,hard', '2d,firstperson', '25d,firstperson', '2d,thirdperson', '25d,thirdperson', 'firstperson,thirdperson', 'sparkly']) {
  const r = refused(bad);
  assert.equal(r.status, 2, `--tags ${bad} is refused`);
  assert.match(r.stderr, /--tags:/);
}
// Good ones pass the check: run.mjs then stops at its next guard (an API key without AGENT_AUTH=api), before any model call.
for (const good of ['3d,firstperson,scifi,roguelike,turnbased,2players', '3d,thirdperson,fantasy', '25d,retro,cute', 'fantasy,cozy', '2d,retro,cute,hard']) {
  const r = spawnSync(process.execPath, [join(AGENT, 'run.mjs'), '--game', 'tags-test', '--prompt', 'A test game', '--genre', 'adventure', '--tags', good],
    { encoding: 'utf8', cwd: AGENT, env: { ...process.env, ANTHROPIC_API_KEY: 'not-a-key', AGENT_AUTH: '' } });
  assert.equal(r.status, 2);
  assert.doesNotMatch(r.stderr, /--tags:/, `--tags ${good} is taken`);
  assert.match(r.stderr, /ANTHROPIC_API_KEY is set/);
}
assert.ok(!existsSync(join(AGENT, 'output', 'tags-test')), 'nothing was made');
console.log(`tags: ${files.join(', ')} (rule files, contract and API agree); genres ${genres.join(', ')} have skills; bad --tags refused, good ones taken`);
