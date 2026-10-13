// Local gallery of every built game, for Luka to compare and play:
//   node tools/gallery.mjs [port]   → http://127.0.0.1:8070/
// Groups games by prompt, sorts by model then effort, and filters by model, effort and setup:
//   current  = agent/ runs with the isolated game agent (the setup we build on)
//   v1       = proof/ runs (the Godot check)
//   leaky    = agent/ runs from before the isolation fix (costs inflated by claude.ai connectors)
import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync, readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { join, dirname, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCES = { proof: join(ROOT, 'proof'), agent: join(ROOT, 'agent') };
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
      Object.assign(g, { model: a.model.split('-')[1], effort: a.effort, prompt: r.prompt, buildCost: r.costUsd, buildMin: r.minutes, playtest: !!r.playtest, genre: r.genre });
    } else {
      const last = r.attempts?.at(-1) ?? r;
      g.edits.push({ prompt: r.prompt, cost: r.costUsd, route: r.route, ok: r.ok ?? r.finalCheck === 'OK',
        editModel: last.model?.split('-')[1], editEffort: last.effort });
    }
    g.totalCost = +(g.totalCost + r.costUsd).toFixed(3);
  }
  return info;
}

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
        source, name, setup, copyOf,
        model: i.model || '?', effort: i.effort || '?', prompt: i.prompt || '', playtest: !!i.playtest, genre: i.genre,
        buildCost: i.buildCost, buildMin: i.buildMin,
        edits: copyOf ? [] : i.edits || [], totalCost: copyOf ? i.buildCost : i.totalCost,
        t: (await stat(join(dir, 'export', 'web', 'index.pck'))).mtimeMs,
      });
    }
  }
  return list;
}

const PAGE = (data) => `<!doctype html><meta charset="utf-8"><title>Game gallery</title>
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
const DATA = ${JSON.stringify(data)};
const ORDER = { haiku: 0, sonnet: 1, opus: 2, low: 0, medium: 1, high: 2 };
const SETUPS = [['current', 'Current setup (isolated game agent)'], ['v1', 'Godot check (v1, first proof)'], ['leaky', 'Before the isolation fix (costs inflated)']];
const on = { model: new Set(['haiku', 'sonnet', 'opus']), effort: new Set(['low', 'medium', 'high']), setup: new Set(['current', 'v1']) };
let sort = 'model';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const promptName = (p) => /3D/i.test(p) ? '3D car town' : /runner/i.test(p) ? '2D endless runner' : /match-3/i.test(p) ? 'Match-3 puzzle' : /box/i.test(p) ? 'Box-pushing puzzle' : 'Other';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function card(g) {
  const url = '/g/' + g.source + '/' + g.name + '/web/index.html';
  const pills = [g.effort + ' effort'];
  if (g.genre && g.genre !== 'none') pills.push(g.genre + ' skill');
  if (g.playtest) pills.push('play-test');
  if (g.copyOf) pills.push('before the edits');
  if (g.edits.length) pills.push(g.edits.length + ' edits');
  const edits = g.edits.length ? '<ol class="edits">' + g.edits.map((e) => '<li>' + esc(e.prompt) + ' <span>$' + e.cost + ' · ' + esc(String(e.route).replace('auto→', '')) + (e.ok ? '' : ' ✗') + '</span></li>').join('') + '</ol>' : '';
  return '<div class="card ' + g.model + '"><a href="' + url + '" target="_blank"><img loading="lazy" src="/g/' + g.source + '/' + g.name + '/screenshot-play.png"></a><div class="body">'
    + '<div class="head"><span class="model">' + cap(g.model) + '</span>' + pills.map((p) => '<span class="pill' + (p === 'before the edits' ? ' warn' : '') + '">' + esc(p) + '</span>').join('') + '</div>'
    + '<div class="nums">$' + (g.buildCost ?? '?') + ' <span>build ·</span> ' + (g.buildMin ?? '?') + ' <span>min</span>' + (g.edits.length ? ' <span>· total with edits</span> $' + g.totalCost : '') + '</div>'
    + edits + '<div class="folder">' + esc(g.name) + '</div><a class="play" href="' + url + '" target="_blank">Play</a></div></div>';
}
function render() {
  const list = DATA.filter((g) => on.model.has(g.model) && on.effort.has(g.effort) && on.setup.has(g.setup));
  const by = { model: (a, b) => ORDER[a.model] - ORDER[b.model] || ORDER[a.effort] - ORDER[b.effort] || a.playtest - b.playtest || a.edits.length - b.edits.length,
               cost: (a, b) => (a.buildCost ?? 99) - (b.buildCost ?? 99), new: (a, b) => b.t - a.t }[sort];
  let html = '';
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
  for (const p of [...new Set(DATA.map((g) => promptName(g.prompt)))].sort()) {
    const inP = list.filter((g) => promptName(g.prompt) === p && !/^ab3?-/.test(g.name));
    if (!inP.length) continue;
    html += '<h2>' + esc(p) + '</h2>';
    for (const [s, label] of SETUPS) {
      const games = inP.filter((g) => g.setup === s).sort(by);
      if (games.length) html += '<h3>' + label + ' · ' + games.length + '</h3><div class="grid">' + games.map(card).join('') + '</div>';
    }
  }
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
  if (url === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE(await games())); }
  const m = url.match(/^\/g\/(proof|agent)\/([^/]+)\/(.+)$/);
  if (!m) return res.writeHead(404).end();
  const file = join(SOURCES[m[1]], 'output', m[2], 'export', normalize(m[3]).replace(/^(\.\.[\\/])+/, ''));
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404).end(); }
}).listen(Number(process.argv[2]) || 8070, '127.0.0.1', () => console.log(`Gallery: http://127.0.0.1:${Number(process.argv[2]) || 8070}/`));
