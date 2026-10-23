// Local gallery of every built game, for Luka to compare and play:
//   node tools/gallery.mjs [port]   → http://127.0.0.1:8070/
// Groups games by prompt. Two comparison groups come first (2026-10-20, RESULTS.md): "Showcase: original vs
// polished" (each show-<name> beside its show-<name>-polished copy, changed by 1-3 chat edits, with every edit's
// message, cost, check, before/after pictures and verdict) and "Low vs medium effort" (lowtest-<game>-<effort>:
// the same prompt built on Haiku at both efforts). Their numbers and verdicts come from output/_edit-eval/runs/*.json
// (tests/edit-eval/edit-eval.mjs, note.mjs). Then the show-* games, built on Opus for the home page ("Showcase
// (Opus)"); the edit-show-* copies, changed by chat messages ("Chat edits on big games"); sorts by model then
// effort, and filters by model, effort and setup:
//   current  = agent/ runs with the isolated game agent (the setup we build on)
//   v1       = proof/ runs (the Godot check)
//   leaky    = agent/ runs from before the isolation fix (costs inflated by claude.ai connectors)
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync, readdirSync, openSync, readSync, closeSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..'); // packages/agent
const ROOT = join(HERE, '..', '..'); // the repo
const SOURCES = { proof: join(ROOT, 'proof'), agent: HERE };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.png': 'image/png' };

// Build and edit records per game folder, from each source's runs.jsonl.
function runInfo(source) {
  const file = join(SOURCES[source], 'runs.jsonl');
  const info = {};
  if (!existsSync(file)) return info;
  for (const line of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const r = JSON.parse(line);
    const key = source === 'proof' ? `${r.name}-${r.model.split('-')[1]}` : r.game;
    const a = r.attempts?.[0] ?? r;
    const g = info[key] || (info[key] = { edits: [], totalCost: 0 });
    if (r.kind === 'new') {
      Object.assign(g, { model: a.model.split('-')[1], effort: a.effort, prompt: r.prompt, buildCost: r.costUsd, buildMin: r.minutes, playtest: !!r.playtest, genre: r.genre,
        // what the low/medium comparison shows: steps, what the player would be charged, per-step numbers
        steps: r.steps, size: r.size, ok: r.ok, chargeUsd: r.chargeUsd ?? r.costUsd, messageCostUsd: r.messageCostUsd ?? 0,
        stepList: (r.attempts || []).map((x) => ({ step: x.step, minutes: x.minutes, turns: x.turns, costUsd: x.costUsd, ok: x.ok, thinking: x.tokens?.thinking })) });
    } else {
      const last = r.attempts?.at(-1) ?? r;
      // credits as the server charges them (docs/pricing.md): the kept attempts + the player message,
      // ÷ $0.06, rounded up to 0.1; a failed edit is not charged
      const usd = (r.chargeUsd ?? r.costUsd) + (r.messageCostUsd ?? 0);
      g.edits.push({ prompt: r.prompt, cost: r.costUsd, route: r.route, ok: r.ok ?? r.finalCheck === 'OK',
        editModel: last.model?.split('-')[1], editEffort: last.effort, minutes: r.minutes,
        credits: r.attempts ? (r.ok ? Math.max(0.1, Math.ceil((usd / 0.06) * 10 - 1e-9) / 10) : 0) : undefined });
    }
    g.totalCost = +(g.totalCost + r.costUsd).toFixed(3);
  }
  return info;
}

// Which way the game is played (the same rule as tools/check.mjs): portrait screenshots are shown whole.
function isPortrait(dir) {
  try {
    const display = (readFileSync(join(dir, 'project.godot'), 'utf8').split('[display]')[1] ?? '').split('\n[')[0];
    const value = (key) => display.split('\n').find((l) => l.startsWith(`window/${key}=`))?.split('=')[1]?.replaceAll('"', '').trim();
    const handheld = value('handheld/orientation');
    if (handheld !== undefined) return [1, 3, 5].includes(Number(handheld));
    return Number(value('size/viewport_height') ?? 648) > Number(value('size/viewport_width') ?? 1152);
  } catch { return false; }
}

// The game's own title (config/name in project.godot), shown on the showcase cards.
function gameTitle(dir) {
  try {
    return readFileSync(join(dir, 'project.godot'), 'utf8').split('\n').find((l) => l.startsWith('config/name='))?.split('=')[1]?.replaceAll('"', '').trim() || '';
  } catch { return ''; }
}

// The measured chat edits (and baseline checks) of the 10-20 comparisons: tests/edit-eval/edit-eval.mjs writes one JSON per
// run, note.mjs adds the reviewer's verdict. Only the fields the cards show.
const EVAL = join(HERE, 'output', '_edit-eval');
function evalRuns() {
  const dir = join(EVAL, 'runs');
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    let r;
    try { r = JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    if (!/-polished$|^lowtest-/.test(r.copy || '')) continue;
    out.push({ id: r.id, copy: r.copy, baseline: !!r.baseline, model: r.model, effort: r.effort, prompt: r.prompt, startedAt: r.startedAt,
      record: r.record && { ok: r.record.ok, minutes: r.record.minutes, costUsd: r.record.costUsd, chargeUsd: r.record.chargeUsd, messageCostUsd: r.record.messageCostUsd, playerMessage: r.record.playerMessage, route: r.record.route },
      credits: r.credits, check: r.check && { verdict: r.check.verdict, fps: r.check.fps, tests: r.check.tests, errors: (r.check.errors || []).slice(0, 2) },
      beforeCheck: r.beforeCheck && { verdict: r.beforeCheck.verdict, fps: r.beforeCheck.fps, tests: r.beforeCheck.tests },
      diffTotals: r.diffTotals, analysis: r.analysis && { ctxMaxK: r.analysis.ctxMaxK, over100k: r.analysis.over100k, thinkingTokens: r.analysis.thinkingTokens },
      verdict: r.verdict, note: r.note, rolledBack: !!r.rolledBack, shots: r.shots });
  }
  return out.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));
}

// The showcase games, in the order they were asked for.
const SHOWCASE = ['show-td', 'show-racer', 'show-runner', 'show-match3', 'show-3d', 'show-arcade'];
const showRank = (g) => { const i = SHOWCASE.indexOf(g.name); return i < 0 ? 99 : i; };

// A game built before the isolation fix had more than the agent's 7 tools in its session.
function leaky(dir) {
  const log = join(dir, '.agent-log.jsonl');
  if (!existsSync(log)) return false;
  const fd = openSync(log, 'r');
  const buf = Buffer.alloc(200_000);
  const n = readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  const init = buf.toString('utf8', 0, n).split('\n').find((l) => l.includes('"subtype":"init"'));
  try { return JSON.parse(init).tools.length > 7; } catch { return false; }
}

async function games() {
  const list = [];
  for (const source of Object.keys(SOURCES)) {
    const out = join(SOURCES[source], 'output');
    if (!existsSync(out)) continue;
    const info = runInfo(source);
    for (const name of await readdir(out)) {
      const dir = join(out, name);
      if (!existsSync(join(dir, 'export', 'web', 'index.pck'))) continue;
      const copyOf = name.endsWith('-original') ? name.replace(/-original$/, '') : null;
      const i = info[copyOf || name] || {};
      const setup = source === 'proof' ? 'v1' : leaky(dir) ? 'leaky' : 'current';
      list.push({
        source, name, setup, copyOf, portrait: isPortrait(dir), title: gameTitle(dir),
        hero: existsSync(join(dir, 'export', 'screenshot-hero.png')), // a picture taken by hand, of the game played for a while
        model: i.model || '?', effort: i.effort || '?', prompt: i.prompt || '', playtest: !!i.playtest, genre: i.genre,
        buildCost: i.buildCost, buildMin: i.buildMin,
        steps: i.steps, ok: i.ok, chargeUsd: i.chargeUsd, messageCostUsd: i.messageCostUsd, stepList: i.stepList,
        edits: copyOf ? [] : i.edits || [], totalCost: copyOf ? i.buildCost : i.totalCost,
        t: (await stat(join(dir, 'export', 'web', 'index.pck'))).mtimeMs,
      });
    }
  }
  return list.sort((a, b) => showRank(a) - showRank(b)); // stable: everything else keeps its order
}

const PAGE = (data, runs) => `<!doctype html><meta charset="utf-8"><title>Game gallery</title>
<style>
:root{--bg:#14141b;--card:#1f1f29;--line:#2e2e3b;--text:#ececf1;--dim:#9a9aab;--haiku:#3fbf7f;--sonnet:#4a9be8;--opus:#a87bff}
body{font:14px system-ui;background:var(--bg);color:var(--text);margin:20px 24px}
h1{margin:0 0 4px;font-size:22px}.sub{color:var(--dim);margin:0 0 14px}
.bar{display:flex;flex-wrap:wrap;gap:18px;align-items:center;padding:10px 12px;background:var(--card);border-radius:10px;margin-bottom:18px;position:sticky;top:0;z-index:2}
.bar b{color:var(--dim);font-weight:600;margin-right:6px}
.chip{border:1px solid var(--line);background:none;color:var(--text);border-radius:999px;padding:4px 11px;cursor:pointer;font:inherit}
.chip.on{background:var(--text);color:var(--bg);border-color:var(--text)}
.chip.haiku.on{background:var(--haiku);border-color:var(--haiku)}.chip.sonnet.on{background:var(--sonnet);border-color:var(--sonnet)}.chip.opus.on{background:var(--opus);border-color:var(--opus)}
h2{font-size:17px;margin:22px 0 4px}h3{font-size:14px;color:var(--dim);margin:14px 0 8px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;align-items:start}
.card{background:var(--card);border-radius:10px;overflow:hidden;border-top:4px solid var(--line);display:flex;flex-direction:column}
.card.haiku{border-top-color:var(--haiku)}.card.sonnet{border-top-color:var(--sonnet)}.card.opus{border-top-color:var(--opus)}
.card img{width:100%;aspect-ratio:2/1;object-fit:cover;display:block;background:#000}
.card img.tall{aspect-ratio:432/936}
.ask{color:var(--dim);font-size:12px;font-style:italic;margin:0}
.title{flex-basis:100%;font-size:17px}
.body{padding:9px 11px 11px;display:flex;flex-direction:column;gap:5px;flex:1}
.head{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.model{font-weight:700;font-size:15px}.haiku .model{color:var(--haiku)}.sonnet .model{color:var(--sonnet)}.opus .model{color:var(--opus)}
.pill{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 8px;color:var(--dim)}
.pill.warn{border-color:#a8663a;color:#f0a070}
.nums{color:var(--text)}.nums span{color:var(--dim)}
.edits{color:var(--dim);font-size:12px;margin:0;padding-left:16px}
.folder{color:#666;font-size:11px;margin-top:auto}
.play{align-self:flex-start;background:#f5c542;color:#111;padding:5px 14px;border-radius:6px;text-decoration:none;font-weight:700;margin-top:4px}
.empty{color:var(--dim)}
/* original vs polished, low vs medium (2026-10-20) */
.pair{background:var(--card);border-radius:12px;padding:12px 14px;margin:12px 0;display:grid;grid-template-columns:repeat(2,minmax(190px,290px)) minmax(320px,1fr);gap:16px;align-items:start}
.pair>.top{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline}
.pair .top b{font-size:17px}.pair .top .ask{flex-basis:100%}
.col h3{margin:0 0 6px;color:var(--text)}.col h3 span{color:var(--dim);font-weight:400}
.col a.imgs{display:flex;flex-direction:column;gap:6px}
.col img.pic{width:100%;display:block;border-radius:8px;background:#000}
.col img.pic.tall{aspect-ratio:432/936;object-fit:cover}.col img.pic.wide{aspect-ratio:1128/556;object-fit:cover}
.eds{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:12px}
.ed{border-left:3px solid var(--line);padding:1px 0 1px 10px}
.ed.better{border-left-color:#3fbf7f}.ed.same{border-left-color:#9a9aab}.ed.worse,.ed.rolled{border-left-color:#e0605a}.ed.mixed{border-left-color:#e0b040}
.ed .msg{font-style:italic}.ed .meta{color:var(--dim);font-size:12px;margin:2px 0}.ed .note{font-size:13px}
.v{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;border-radius:4px;padding:1px 6px;margin-right:6px;background:#3a3a48;color:#cfcfda}
.v.better{background:#1f5a3c;color:#9af0c3}.v.worse,.v.rolled{background:#6a2a28;color:#ffb0aa}.v.mixed{background:#5f4a1a;color:#ffd78a}
.ba{display:flex;gap:6px;align-items:center;margin-top:5px}.ba img{height:130px;border-radius:5px;background:#000;display:block}.ba span{color:var(--dim)}
.sumline{color:var(--dim);margin:0 0 8px}.sumline b{color:var(--text)}
.lowgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;grid-column:1/-1}
.shots{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.shots img{width:100%;display:block;border-radius:6px;background:#000}
.col .play{margin-top:8px}.steps{color:var(--dim);font-size:12px;margin:2px 0 0;padding-left:16px}
@media (max-width:900px){.pair{grid-template-columns:1fr 1fr}.pair>.eds-col{grid-column:1/-1}}
</style>
<h1>Game gallery</h1>
<p class="sub">Grouped by prompt, then by setup; sorted by model and effort. Colour = model. Click a picture or Play to open the game in a new tab.</p>
<div class="bar">
  <div><b>Model</b><button class="chip haiku on" data-f="model" data-v="haiku">Haiku</button> <button class="chip sonnet on" data-f="model" data-v="sonnet">Sonnet</button> <button class="chip opus on" data-f="model" data-v="opus">Opus</button></div>
  <div><b>Effort</b><button class="chip on" data-f="effort" data-v="low">low</button> <button class="chip on" data-f="effort" data-v="medium">medium</button> <button class="chip on" data-f="effort" data-v="high">high</button></div>
  <div><b>Setup</b><button class="chip on" data-f="setup" data-v="current">current (isolated)</button> <button class="chip on" data-f="setup" data-v="v1">Godot check (v1)</button> <button class="chip" data-f="setup" data-v="leaky">before fix (inflated)</button></div>
  <div><b>Sort</b><button class="chip on" data-s="model">model → effort</button> <button class="chip" data-s="cost">cheapest</button> <button class="chip" data-s="new">newest</button></div>
</div>
<div id="out"></div>
<script>
const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const RUNS = ${JSON.stringify(runs).replace(/</g, '\\u003c')};
const ORDER = { haiku: 0, sonnet: 1, opus: 2, low: 0, medium: 1, high: 2 };
const SETUPS = [['current', 'Current setup (isolated game agent)'], ['v1', 'Godot check (v1, first proof)'], ['leaky', 'Before the isolation fix (costs inflated)']];
const on = { model: new Set(['haiku', 'sonnet', 'opus']), effort: new Set(['low', 'medium', 'high']), setup: new Set(['current', 'v1']) };
let sort = 'model';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const promptName = (p) => /3D/i.test(p) ? '3D car town' : /racing|racer/i.test(p) ? 'Racer' : /runner/i.test(p) ? '2D endless runner' : /tower defen[cs]e/i.test(p) ? 'Tower defence (big)' : /match-3.*10 levels/i.test(p) ? 'Match-3, 10 levels (big)' : /match-3/i.test(p) ? 'Match-3 puzzle' : /box/i.test(p) ? 'Box-pushing puzzle' : 'Other';
const SHOW = 'Showcase (Opus)';
const EDITS = 'Chat edits on big games';
const POL = 'Showcase: original vs polished by chat edits (10-20)';
const LOW = 'Low vs medium effort on Haiku, new games (10-20)';
const groupOf = (g) => /^show-.*-polished$/.test(g.name) ? POL : /^show-/.test(g.name) ? SHOW : /^lowtest-/.test(g.name) ? LOW : /^edit-show-/.test(g.name) ? EDITS : promptName(g.prompt);
const SHOWN = ['show-td', 'show-racer', 'show-runner', 'show-match3', 'show-3d', 'show-arcade'];
const baseOf = (g) => g.name.replace(/^edit-/, '').replace(/-(smart|old[0-9]|new[0-9])$/, ''); // the showcase game an edit copy came from
// Which run of the edit test a copy is: -smart = the same edit on Sonnet; -oldN / -newN = a second sample of the
// costliest edits on the rules before / after the 10-19 EDIT.md change; no suffix = the main Fast (Haiku) sequence.
const variantOf = (g) => { const m = g.name.match(/-(smart|old[0-9]|new[0-9])$/)?.[1]; return !m ? 'Fast sequence' : m === 'smart' ? 'Smart (Sonnet)' : m.startsWith('old') ? 'old rules #' + m.slice(3) : 'new rules #' + m.slice(3); };
const variantRank = (g) => { const m = g.name.match(/-(smart|old[0-9]|new[0-9])$/)?.[1] || ''; return m === '' ? 0 : m === 'smart' ? 1 : m.startsWith('old') ? 2 : 3; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// A showcase game copied and changed by chat messages (tests/fork.mjs + run.mjs --edit): what each message cost.
function editCard(g) {
  const url = '/g/' + g.source + '/' + g.name + '/web/index.html';
  const first = g.edits[0] || {};
  const sum = (k) => g.edits.reduce((s, e) => s + (e[k] || 0), 0);
  const failed = g.edits.filter((e) => !e.ok).length;
  const list = g.edits.length ? '<ol class="edits">' + g.edits.map((e) => '<li>' + esc(e.prompt) + ' <span>$' + e.cost + (e.credits !== undefined ? ' · ' + e.credits + ' cr' : '') + (e.minutes !== undefined ? ' · ' + e.minutes + ' min' : '') + ' · ' + esc(e.editModel || '?') + (e.ok ? '' : ' ✗ rolled back') + '</span></li>').join('') + '</ol>' : '<p class="ask">no edits yet</p>';
  return '<div class="card ' + (first.editModel || g.model) + '"><a href="' + url + '" target="_blank"><img class="' + (g.portrait ? 'tall' : '') + '" loading="lazy" src="/g/' + g.source + '/' + g.name + '/screenshot-play.png"></a><div class="body">'
    + '<div class="head"><b class="title">' + esc(g.title || baseOf(g)) + '</b><span class="model">' + cap(first.editModel || '?') + ' edits</span><span class="pill">' + esc(variantOf(g)) + '</span><span class="pill">' + g.edits.length + ' edits' + (failed ? ', ' + failed + ' failed' : '') + '</span></div>'
    + '<div class="nums"><span>Built:</span> ' + cap(g.model) + ' ' + g.effort + ' · <span>edits:</span> $' + sum('cost').toFixed(3) + ' · ' + sum('credits').toFixed(1) + ' <span>credits ·</span> ' + sum('minutes').toFixed(1) + ' <span>min</span></div>'
    + list + '<div class="folder">' + esc(g.name) + ' · <a href="/g/' + g.source + '/' + baseOf(g) + '/web/index.html" target="_blank" style="color:inherit">original, before the edits</a></div><a class="play" href="' + url + '" target="_blank">Play</a></div></div>';
}
function card(g) {
  const url = '/g/' + g.source + '/' + g.name + '/web/index.html';
  const pills = [g.effort + ' effort'];
  if (g.genre && g.genre !== 'none') pills.push(g.genre + ' skill');
  if (g.playtest) pills.push('play-test');
  if (g.copyOf) pills.push('before the edits');
  if (g.edits.length) pills.push(g.edits.length + ' edits');
  const edits = g.edits.length ? '<ol class="edits">' + g.edits.map((e) => '<li>' + esc(e.prompt) + ' <span>$' + e.cost + ' · ' + esc(String(e.route).replace('auto→', '')) + (e.ok ? '' : ' ✗') + '</span></li>').join('') + '</ol>' : '';
  return '<div class="card ' + g.model + '"><a href="' + url + '" target="_blank"><img class="' + (g.portrait ? 'tall' : '') + '" loading="lazy" src="/g/' + g.source + '/' + g.name + '/' + (g.hero ? 'screenshot-hero.png' : 'screenshot-play.png') + '"></a><div class="body">'
    + '<div class="head">' + (groupOf(g) === SHOW && g.title ? '<b class="title">' + esc(g.title) + '</b>' : '') + '<span class="model">' + cap(g.model) + '</span>' + pills.map((p) => '<span class="pill' + (p === 'before the edits' ? ' warn' : '') + '">' + esc(p) + '</span>').join('') + '</div>'
    + '<div class="nums">$' + (g.buildCost ?? '?') + ' <span>build ·</span> ' + (g.buildMin ?? '?') + ' <span>min</span>' + (g.edits.length ? ' <span>· total with edits</span> $' + g.totalCost : '') + '</div>'
    + (groupOf(g) === SHOW ? '<p class="ask">&ldquo;' + esc(g.prompt) + '&rdquo;</p>' : '') + edits + '<div class="folder">' + esc(g.name) + '</div><a class="play" href="' + url + '" target="_blank">Play</a></div></div>';
}
// ---- 10-20: original vs polished, and low vs medium effort (not touched by the model / effort filters)
const gUrl = (g) => '/g/' + g.source + '/' + g.name + '/web/index.html';
const gPic = (g, f) => '/g/' + g.source + '/' + g.name + '/' + f;
const eUrl = (kind, id, f) => '/e/' + kind + '/' + encodeURIComponent(id) + '/' + f;
const passed = (t) => Object.values(t || {}).reduce((s, v) => s + (parseInt(String(v), 10) || 0), 0);
const creditsOf = (usd) => Math.max(0.1, Math.ceil((usd / 0.06) * 10 - 1e-9) / 10);
const imgTag = (g, f) => '<img class="pic ' + (g.portrait ? 'tall' : 'wide') + '" loading="lazy" src="' + gPic(g, f) + '">';
function gameCol(g, label, sub) {
  return '<div class="col"><h3>' + esc(label) + ' <span>' + sub + '</span></h3><a class="imgs" href="' + gUrl(g) + '" target="_blank">'
    + (g.hero ? imgTag(g, 'screenshot-hero.png') : '') + imgTag(g, 'screenshot-play.png') + '</a><a class="play" href="' + gUrl(g) + '" target="_blank">Play</a></div>';
}
function editItem(r) {
  const rec = r.record || {};
  const cls = r.rolledBack ? 'rolled' : r.verdict || '';
  const t0 = passed(r.beforeCheck && r.beforeCheck.tests), t1 = passed(r.check && r.check.tests);
  const meta = [cap(r.model) + ' ' + r.effort, (rec.minutes ?? '?') + ' min', '$' + (rec.costUsd ?? '?'), (r.credits ? r.credits.ifSucceeded : '?') + ' credits',
    'check ' + (r.check ? r.check.verdict : '?'), 'tests ' + t0 + ' &rarr; ' + t1, 'fps ' + esc(r.check ? r.check.fps : '?')];
  return '<li class="ed ' + cls + '"><div class="msg">&ldquo;' + esc(r.prompt) + '&rdquo;</div><div class="meta">' + meta.join(' &middot; ') + '</div>'
    + '<div class="note">' + (r.rolledBack ? '<span class="v rolled">rolled back</span>' : r.verdict ? '<span class="v ' + r.verdict + '">' + esc(r.verdict) + '</span>' : '') + esc(r.note || '') + '</div>'
    + '<div class="ba"><img loading="lazy" src="' + eUrl('before', r.id, 'play.png') + '"><span>&rarr;</span><img loading="lazy" src="' + eUrl('after', r.id, 'play.png') + '"></div></li>';
}
function polishBlock(base) {
  const o = DATA.find((g) => g.name === base), p = DATA.find((g) => g.name === base + '-polished');
  if (!o || !p) return '';
  const runs = RUNS.filter((r) => r.copy === p.name && !r.baseline);
  const sum = (f) => runs.reduce((s, r) => s + (f(r) || 0), 0);
  const line = runs.length ? '<p class="sumline"><b>' + runs.length + ' edit' + (runs.length > 1 ? 's' : '') + '</b> &middot; $' + sum((r) => r.record && r.record.costUsd).toFixed(3) + ' &middot; '
    + sum((r) => r.credits && r.credits.ifSucceeded).toFixed(1) + ' credits &middot; ' + sum((r) => r.record && r.record.minutes).toFixed(1) + ' min &middot; messages as typed, on Fast (Haiku) unless it says Sonnet</p>' : '<p class="sumline">no edits yet</p>';
  return '<div class="pair"><div class="top"><b>' + esc(o.title || base) + '</b><span class="pill">' + esc(o.genre || '') + '</span><span class="pill">built on Opus high: $' + o.buildCost + ' &middot; ' + o.buildMin + ' min</span></div>'
    + gameCol(o, 'Original', 'as built') + gameCol(p, 'Polished', runs.length + ' chat edit' + (runs.length === 1 ? '' : 's'))
    + '<div class="col eds-col"><h3>What the edits did</h3>' + line + '<ol class="eds">' + runs.map(editItem).join('') + '</ol></div></div>';
}
function polishSection() {
  const blocks = SHOWN.map(polishBlock).join('');
  return blocks ? '<h2>' + POL + '</h2><p class="sub">Each game on the left is the Opus build, untouched. The one on the right is a copy changed by 1-3 chat messages typed the way a player would (Fast = Haiku medium, through the product&rsquo;s own edit path), each checked, tested and measured. Click Play on both to compare.</p>' + blocks : '';
}
function lowGame(g) {
  if (!g) return '';
  const base = RUNS.filter((r) => r.copy === g.name && r.baseline).pop() || {};
  const chk = base.check || {};
  const usd = (g.chargeUsd ?? g.buildCost ?? 0) + (g.messageCostUsd || 0);
  const steps = (g.stepList || []).map((s) => '<li>' + esc(s.step || 'single session') + ': ' + s.minutes + ' min, $' + s.costUsd + ', ' + s.turns + ' turns' + (s.ok ? '' : ' (failed)') + '</li>').join('');
  return '<div class="col"><h3>Haiku ' + esc(g.effort) + ' <span>' + (g.steps || '?') + ' steps' + (g.ok === false ? ' &middot; FAILED' : '') + '</span></h3>'
    + '<div class="nums"><b>' + (g.buildMin ?? '?') + ' min</b> &middot; <b>$' + (g.buildCost ?? '?') + '</b> &middot; <b>' + creditsOf(usd) + ' credits</b></div>'
    + '<ol class="steps">' + steps + '</ol>'
    + '<div class="nums"><span>check</span> ' + esc(chk.verdict || '?') + ' &middot; <span>tests passed</span> ' + (chk.tests ? passed(chk.tests) + ' in ' + Object.keys(chk.tests).length + ' files' : '?') + ' &middot; <span>fps</span> ' + esc(chk.fps || '?') + '</div>'
    + '<a class="imgs" href="' + gUrl(g) + '" target="_blank"><span class="shots"><img loading="lazy" src="' + gPic(g, 'screenshot-start.png') + '"><img loading="lazy" src="' + gPic(g, 'screenshot-play.png') + '"><img loading="lazy" src="' + gPic(g, 'screenshot-later.png') + '"></span></a>'
    + (base.note ? '<p class="ask" style="font-style:normal;margin-top:6px">' + (base.verdict ? '<span class="v ' + base.verdict + '">' + esc(base.verdict) + '</span>' : '') + esc(base.note) + '</p>' : '')
    + '<a class="play" href="' + gUrl(g) + '" target="_blank">Play</a><div class="folder">' + esc(g.name) + '</div></div>';
}
function lowSection() {
  let blocks = '';
  for (const [kind, title] of [['match3', 'Match-3 with levels'], ['racer', 'Top-down racer']]) {
    const lo = DATA.find((g) => g.name === 'lowtest-' + kind + '-low'), me = DATA.find((g) => g.name === 'lowtest-' + kind + '-medium');
    if (!lo && !me) continue;
    blocks += '<div class="pair" style="grid-template-columns:1fr"><div class="top"><b>' + title + '</b><p class="ask">&ldquo;' + esc((lo || me).prompt) + '&rdquo;</p></div><div class="lowgrid">' + lowGame(lo) + lowGame(me) + '</div></div>';
  }
  return blocks ? '<h2>' + LOW + '</h2><p class="sub">The same prompt built twice on Haiku, once at low and once at medium effort, one at a time, with the product&rsquo;s step rule. Credits are what the server would charge (agent + player message, divided by $0.06, rounded up to 0.1). Pictures: the check&rsquo;s three screenshots (start, 3 s after a tap, 10 s later).</p>' + blocks : '';
}
function render() {
  const list = DATA.filter((g) => on.model.has(g.model) && on.effort.has(g.effort) && on.setup.has(g.setup));
  const by = { model: (a, b) => ORDER[a.model] - ORDER[b.model] || ORDER[a.effort] - ORDER[b.effort] || a.playtest - b.playtest || a.edits.length - b.edits.length,
               cost: (a, b) => (a.buildCost ?? 99) - (b.buildCost ?? 99), new: (a, b) => b.t - a.t }[sort];
  let html = '';
  const group = (p) => {
    const inP = list.filter((g) => groupOf(g) === p && !/^ab3?-/.test(g.name));
    if (!inP.length) return '';
    let out = '<h2>' + esc(p) + '</h2>';
    for (const [s, label] of SETUPS) {
      const games = inP.filter((g) => g.setup === s).sort(by);
      if (games.length) out += '<h3>' + label + ' · ' + games.length + '</h3><div class="grid">' + games.map(card).join('') + '</div>';
    }
    return out;
  };
  html += polishSection() + lowSection(); // 10-20: the newest comparisons first
  html += group(SHOW); // the showcase candidates: Luka picks the home page's games from them
  // Chat edits on the big showcase games: copies of them changed by player-style messages, Fast (Haiku) vs Smart (Sonnet).
  const ed = DATA.filter((g) => groupOf(g) === EDITS)
    .sort((a, b) => SHOWN.indexOf(baseOf(a)) - SHOWN.indexOf(baseOf(b)) || variantRank(a) - variantRank(b) || a.name.localeCompare(b.name));
  if (ed.length) html += '<h2>' + EDITS + '</h2><p class="sub">Copies of the showcase games, changed by chat messages the way a player would write them, one at a time. The originals above stay untouched. Each line: the message, API $ · credits charged · minutes · model.</p><div class="grid">' + ed.map(editCard).join('') + '</div>';
  // The 2×2 edit tests: same base games, edits by Haiku medium vs Sonnet high.
  for (const [prefix, title] of [['ab3-', 'Edit test (2×2), new "fit-in" edit rule'], ['ab-', 'Edit test (2×2), first edit rule']]) {
  const ab = DATA.filter((g) => g.name.startsWith(prefix)).sort((a, b) => a.name.localeCompare(b.name));
  if (ab.length) {
    html += '<h2>' + title + ': who built it × who made the 3 edits</h2><div class="grid">' + ab.map((g) => {
      const e = g.edits[0];
      const label = '<div class="nums"><span>Built:</span> ' + cap(g.model) + ' ' + g.effort + ' · <span>Edited:</span> '
        + (e ? cap(e.editModel || '?') + ' ' + (e.editEffort || '') : 'not yet') + '</div>';
      return card(g).replace('<div class="nums">', label + '<div class="nums">');
    }).join('') + '</div>';
  }
  }
  for (const p of [...new Set(DATA.map(groupOf))].filter((p) => p !== SHOW && p !== EDITS && p !== POL && p !== LOW).sort()) html += group(p);
  document.getElementById('out').innerHTML = html || '<p class="empty">No games match the filters.</p>';
}
document.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => {
  const set = on[b.dataset.f]; set.has(b.dataset.v) ? set.delete(b.dataset.v) : set.add(b.dataset.v);
  b.classList.toggle('on'); render();
});
document.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => {
  sort = b.dataset.s; document.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b)); render();
});
render();
</script>`;

createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE(await games(), evalRuns())); }
  // the before / after pictures of a measured edit: /e/<before|after>/<run id>/<start|play|later>.png
  const e = url.match(/^\/e\/(before|after)\/([\w.-]+)\/(start|play|later)\.png$/);
  if (e) {
    try {
      const body = await readFile(join(EVAL, e[1], e[2], `${e[3]}.png`));
      res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
      return res.end(body);
    } catch { return res.writeHead(404).end(); }
  }
  const m = url.match(/^\/g\/(proof|agent)\/([^/]+)\/(.+)$/);
  if (!m) return res.writeHead(404).end();
  const file = join(SOURCES[m[1]], 'output', m[2], 'export', normalize(m[3]).replace(/^(\.\.[\\/])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(Number(process.argv[2]) || 8070, '127.0.0.1', () => console.log(`Gallery: http://127.0.0.1:${Number(process.argv[2]) || 8070}/`));
