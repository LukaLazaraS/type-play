// The 3D model library: CC0 models (Kenney, Quaternius) that stay outside the repo, in a
// catalogue the game agent searches; it copies only the models a game uses into that game.
//   node assets.mjs index [libraryDir]     (Builder) scan the library, write assets/catalogue.json
//   node assets.mjs search <words…>        the 10 best matches, one short line each
//   node assets.mjs pack <pack>            every model name in one pack (to build a matching set)
//   node assets.mjs info <id>              one model: file, size, animations, preview image
//   node assets.mjs copy <id> [<id>…]      run in a game folder: copies the models and their
//                                          textures into assets/<pack>/, credits in assets/CREDITS.md
// The library: ASSET_LIBRARY, else the folder the catalogue was built from.
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync, appendFileSync } from 'node:fs';
import { join, dirname, basename, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CATALOGUE = join(HERE, '..', 'assets', 'catalogue.json');
const ME = fileURLToPath(import.meta.url).replaceAll('\\', '/');
const [cmd, ...rest] = process.argv.slice(2);

// Words that say nothing about what a model is: formats, export folders, dates.
const NOISE = new Set(('glb gltf fbx obj dae stl format formats export exports model models godot unreal unity ue '
  + 'standard patreon exclusive blends textures jan feb mar apr may jun jul aug sep sept oct nov dec january '
  + 'february march april june july august september october november december kit pack').split(' '));
const split = (s) => s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').toLowerCase();
// Search words drop numbers (BirchTree_3 → birch tree); ids keep them (birch-tree-3).
const words = (s) => split(s.replace(/\d+/g, ' ')).split(/[^a-z]+/).filter((w) => w.length > 1);
const slug = (s) => split(s).split(/[^a-z0-9]+/).filter(Boolean).join('-');
const stem = (w) => (w.length > 4 && w.endsWith('ies') ? w.slice(0, -3) + 'y'
  : w.length > 3 && /(sh|ch|x|ss)es$/.test(w) ? w.slice(0, -2)
  : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);
const FORMAT_RANK = { '.glb': 0, '.gltf': 1, '.fbx': 2 };

// ---------- index (Builder only) ----------
function readGltf(file) {
  const buf = readFileSync(file);
  if (extname(file).toLowerCase() === '.glb') return JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString('utf8'));
  return JSON.parse(buf.toString('utf8'));
}

// The model's size in metres (its scene's bounding box), from accessor bounds and node transforms.
function gltfSize(json) {
  const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
  const local = (n) => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const visit = (i, parent, depth) => {
    const n = json.nodes?.[i];
    if (!n || depth > 64) return;
    const m = mul(parent, local(n));
    for (const p of json.meshes?.[n.mesh]?.primitives || []) {
      const acc = json.accessors?.[p.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (let c = 0; c < 8; c++) {
        const v = [c & 1 ? acc.max[0] : acc.min[0], c & 2 ? acc.max[1] : acc.min[1], c & 4 ? acc.max[2] : acc.min[2]];
        for (let a = 0; a < 3; a++) {
          const t = m[a] * v[0] + m[4 + a] * v[1] + m[8 + a] * v[2] + m[12 + a];
          lo[a] = Math.min(lo[a], t); hi[a] = Math.max(hi[a], t);
        }
      }
    }
    for (const c of n.children || []) visit(c, m, depth + 1);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of scene?.nodes || []) visit(r, identity, 0);
  if (!Number.isFinite(lo[0])) return undefined;
  return hi.map((h, a) => +(h - lo[a]).toFixed(2));
}

function index(root) {
  root = resolve(root).replaceAll('\\', '/');
  const packs = {}, groups = new Map(), skipped = [], packFiles = new Map();
  const rel = (p) => relative(root, p).replaceAll('\\', '/');
  // Pack folders: Kenney/<pack>/ and All in One - Quaternius/<category>/<pack>/.
  const packDirs = [];
  for (const top of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const topDir = join(root, top.name);
    if (/kenney/i.test(top.name)) {
      for (const d of readdirSync(topDir, { withFileTypes: true })) if (d.isDirectory()) packDirs.push({ dir: join(topDir, d.name), author: 'Kenney', name: d.name, category: '' });
    } else if (/quaternius/i.test(top.name)) {
      for (const cat of readdirSync(topDir, { withFileTypes: true })) {
        // Animation libraries hold animations, not models; "Old" holds superseded packs.
        if (!cat.isDirectory() || /^animation$/i.test(cat.name)) continue;
        for (const d of readdirSync(join(topDir, cat.name), { withFileTypes: true })) {
          if (d.isDirectory() && d.name !== 'Old') packDirs.push({ dir: join(topDir, cat.name, d.name), author: 'Quaternius', name: d.name, category: cat.name, rootLicense: join(topDir, 'License.txt') });
        }
      }
    }
  }
  for (const p of packDirs) {
    const licenseFile = [join(p.dir, 'License.txt'), p.rootLicense].find((f) => f && existsSync(f));
    const licenseText = licenseFile ? readFileSync(licenseFile, 'utf8') : '';
    if (!/CC0|Creative Commons Zero|publicdomain\/zero/i.test(licenseText)) { skipped.push(`${rel(p.dir)} (no CC0 license file)`); continue; }
    // "Ultimate Monsters - Oct 2022", "Modular SciFi MegaKit [Standard] - Sept 2024", "fantasy-town-kit_2.0"
    const cleanName = p.name.replace(/\s*-\s*[A-Za-z]+\.?\s+\d{4}\s*$/, '').replace(/\[[^\]]*\]/g, '').replace(/_\d+(\.\d+)?$/, '').trim();
    let id = slug(cleanName);
    if (packs[id]) id += '-' + p.author.toLowerCase();
    const titleLine = p.author === 'Kenney' ? licenseText.split(/\r?\n/).map((l) => l.trim()).find((l) => /\(\d/.test(l)) : '';
    const title = titleLine ? titleLine.replace(/\s*\(.*$/, '') : cleanName.replace(/\s*-\s*/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const preview = ['Preview.png', 'Preview.jpg', 'Preview.gif'].map((f) => join(p.dir, f)).find(existsSync);
    packs[id] = { title, author: p.author, site: p.author === 'Kenney' ? 'www.kenney.nl' : 'quaternius.com', license: 'CC0 1.0', dir: rel(p.dir), licenseFile: rel(licenseFile), preview: preview && rel(preview), words: [...new Set([...words(cleanName), ...words(p.category)])].join(' ') };
    const files = new Map(); // texture and buffer files by name: a model whose texture sits elsewhere in its pack
    packFiles.set(id, files);
    const walk = (d) => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const f = join(d, e.name);
        if (e.isDirectory()) { if (!/^(old|blends?|unity package|source)$/i.test(e.name)) walk(f); continue; }
        const ext = extname(e.name).toLowerCase();
        if (/^\.(png|jpe?g|bin)$/.test(ext)) {
          const k = e.name.toLowerCase();
          if (!files.has(k) || f.length < files.get(k).length) files.set(k, f);
        }
        // Kenney packs always have GLB/glTF; their FBX-only packs need separate skins. Quaternius
        // older packs are FBX only (vertex-coloured), which Godot 4.7 imports natively.
        if (!(ext in FORMAT_RANK) || (ext === '.fbx' && p.author === 'Kenney')) continue;
        // Folders that only name a format or an export ("glTF", "GLB format", "Godot - UE") don't
        // tell models apart: the same model in FBX and glTF is one entry.
        const sub = relative(p.dir, d).split(/[\\/]/).filter((s) => s && s.toLowerCase().split(/[^a-z]+/).some((w) => w && !NOISE.has(w)));
        const key = `${id}|${sub.join('/').toLowerCase()}|${basename(e.name, extname(e.name)).toLowerCase()}`;
        const best = groups.get(key);
        if (!best || FORMAT_RANK[ext] < FORMAT_RANK[extname(best.file).toLowerCase()]) groups.set(key, { pack: id, file: f, sub });
      }
    };
    walk(p.dir);
  }

  const models = [], taken = new Map();
  // An FBX is only for models that exist in no other format in the pack.
  const gltfNames = new Set([...groups.values()].filter((g) => !/\.fbx$/i.test(g.file)).map((g) => `${g.pack}|${basename(g.file, extname(g.file)).toLowerCase()}`));
  for (const [k, g] of groups) if (/\.fbx$/i.test(g.file) && gltfNames.has(`${g.pack}|${basename(g.file, extname(g.file)).toLowerCase()}`)) groups.delete(k);
  for (const g of groups.values()) {
    const name = basename(g.file, extname(g.file));
    const ext = extname(g.file).toLowerCase();
    let deps = [], moved = {}, anim = [], size, bad = '';
    if (ext !== '.fbx') {
      try {
        const json = readGltf(g.file);
        const uris = [...(json.images || []).map((i) => i.uri), ...(json.buffers || []).map((b) => b.uri)].filter((u) => u && !u.startsWith('data:'));
        for (const u of new Set(uris)) {
          const d = decodeURIComponent(u).replaceAll('\\', '/');
          if (d.includes('..')) { bad = `texture outside its folder: ${d}`; continue; }
          if (!existsSync(join(dirname(g.file), d))) {
            const elsewhere = packFiles.get(g.pack).get(basename(d).toLowerCase());
            if (elsewhere) moved[d] = rel(elsewhere);
            else bad = `missing ${d}`;
          }
          deps.push(d);
        }
        anim = (json.animations || []).map((a) => a.name).filter(Boolean);
        size = gltfSize(json);
      } catch (e) { bad = 'unreadable: ' + e.message; }
    } else {
      // Binary FBX stores an animation as "<Armature|Name>\0\1AnimStack".
      const s = readFileSync(g.file).toString('latin1'), found = new Set();
      for (let i = s.indexOf('\x00\x01AnimStack'); i > 0; i = s.indexOf('\x00\x01AnimStack', i + 1)) {
        let j = i;
        while (j > 0 && i - j < 80 && /[\w|\- .]/.test(s[j - 1])) j--;
        if (j < i) found.add(s.slice(j, i).split('|').pop());
      }
      anim = [...found];
    }
    if (bad) { skipped.push(`${rel(g.file)} (${bad})`); continue; }
    let kb = statSync(g.file).size;
    for (const d of deps) kb += statSync(moved[d] ? join(root, moved[d]) : join(dirname(g.file), d)).size;
    const pk = packs[g.pack];
    const previewFile = pk.author === 'Kenney'
      ? [`Previews/${name}.png`, `Isometric/${name}_NE.png`, `Side/${name}.png`].map((f) => join(root, pk.dir, f)).find(existsSync)
      : undefined;
    let mid = `${g.pack}/${slug(name)}`, dest = '';
    if (taken.has(mid)) { dest = slug(g.sub.join(' ')); mid = `${g.pack}/${dest ? dest + '-' : ''}${slug(name)}`; }
    for (let n = 2; taken.has(mid); n++) mid = `${g.pack}/${slug(name)}-${n}`;
    taken.set(mid, true);
    const tags = [...new Set([...g.sub.flatMap(words), ...words(name)].filter((w) => !NOISE.has(w)))];
    models.push({ id: mid, path: rel(g.file), tags: tags.join(' '), kb: Math.max(1, Math.round(kb / 1024)),
      ...(size && { size }), ...(anim.length && { anim: anim.slice(0, 24) }), ...(deps.length && { deps }),
      ...(Object.keys(moved).length && { moved }),
      ...(dest && { dest }), ...(previewFile && { preview: rel(previewFile) }) });
  }
  models.sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(dirname(CATALOGUE), { recursive: true });
  // One model per line: small diffs, and grep-able.
  const head = JSON.stringify({ root, built: new Date().toISOString().slice(0, 10), count: models.length, packs }, null, 1).replace(/\n\}$/, '');
  writeFileSync(CATALOGUE, `${head},\n "models": [\n${models.map((m) => JSON.stringify(m)).join(',\n')}\n ]\n}\n`);
  console.log(`${models.length} models in ${Object.keys(packs).length} packs → ${relative(process.cwd(), CATALOGUE)} (${Math.round(statSync(CATALOGUE).size / 1024)} KB)`);
  if (skipped.length) console.log(`skipped ${skipped.length}:\n  ` + skipped.slice(0, 20).join('\n  ') + (skipped.length > 20 ? '\n  …' : ''));
}

// ---------- the agent's commands ----------
function load() {
  if (!existsSync(CATALOGUE)) { console.log('No model catalogue yet: build the game from primitive meshes.'); process.exit(1); }
  const cat = JSON.parse(readFileSync(CATALOGUE, 'utf8'));
  cat.root = process.env.ASSET_LIBRARY || cat.root;
  return cat;
}
// From the file's bounds: right for props, rough for animated characters (bind pose).
const fmtSize = (s) => (s ? `~${s.map((v) => (v >= 10 ? Math.round(v) : v)).join('×')} m` : 'size ?');
const line = (m, cat) => {
  const p = cat.packs[m.id.split('/')[0]];
  const anim = m.anim ? ` · animated: ${m.anim.slice(0, 4).join(', ')}${m.anim.length > 4 ? ` +${m.anim.length - 4}` : ''}` : '';
  return `${m.id}  (${p.title}, ${p.author}) · ${fmtSize(m.size)} · ${m.kb} KB${anim}`;
};
const findModel = (cat, id) => cat.models.find((m) => m.id === id.toLowerCase());

function search(query) {
  const cat = load();
  const terms = [...new Set(words(query).filter((w) => !NOISE.has(w)).map(stem))];
  if (!terms.length) { console.log('Say what you need, e.g.: search "police car"'); return; }
  const scored = [];
  for (const m of cat.models) {
    const [packId, own] = m.id.split('/');
    const name = new Set(words(own).map(stem)), tags = new Set(m.tags.split(' ').map(stem));
    const pack = new Set([...words(packId), ...cat.packs[packId].words.split(' ')].map(stem));
    let hit = 0, score = 0;
    for (const t of terms) {
      const s = name.has(t) ? 4 : tags.has(t) ? 2.5 : pack.has(t) ? 1.5
        : t.length >= 3 && [...name].some((w) => w.startsWith(t)) ? 1.2 : t.length >= 3 && [...tags].some((w) => w.startsWith(t)) ? 0.8 : 0;
      if (s) { hit++; score += s; }
    }
    // Ties go to short names, glTF/GLB over FBX, and small files (the web build stays light).
    if (hit) scored.push({ m, hit, score: score - name.size * 0.05 - (m.path.endsWith('.fbx') ? 0.3 : 0) - (m.kb > 2048 ? 0.5 : 0) });
  }
  scored.sort((a, b) => b.hit - a.hit || b.score - a.score);
  const limitIdx = rest.indexOf('--limit');
  const limit = Math.min(25, limitIdx >= 0 ? Number(rest[limitIdx + 1]) || 10 : 10);
  const full = scored.filter((s) => s.hit === terms.length);
  const shown = (full.length ? full : scored).slice(0, limit);
  if (!shown.length) { console.log(`Nothing for "${query}". Try one simpler word (e.g. "tree", "car", "house"), or build it from primitive meshes.`); return; }
  console.log(`${full.length ? `${full.length} matches` : `No model has all the words; ${scored.length} have some`} for "${query}"${(full.length || scored.length) > shown.length ? `, best ${shown.length}` : ''}:`);
  for (const s of shown) console.log('  ' + line(s.m, cat));
  console.log(`Copy into the game: node "${ME}" copy <id> [<id>…]   (one pack per game keeps one style; "pack <pack>" lists a pack)`);
}

function pack(id) {
  const cat = load();
  const p = cat.packs[id];
  if (!p) { console.log(`No pack "${id}". Packs: ${Object.keys(cat.packs).join(', ')}`); return; }
  const names = cat.models.filter((m) => m.id.startsWith(id + '/')).map((m) => m.id.slice(id.length + 1));
  const cap = 200;
  console.log(`${id}: ${p.title} by ${p.author}, ${p.license}, ${names.length} models${p.preview ? `, overview image: ${join(cat.root, p.preview).replaceAll('\\', '/')}` : ''}`);
  console.log(names.slice(0, cap).join(', ') + (names.length > cap ? ` … +${names.length - cap} more (search to narrow)` : ''));
}

function info(id) {
  const cat = load();
  const m = findModel(cat, id);
  if (!m) { console.log(`No model "${id}": search first.`); return; }
  const p = cat.packs[m.id.split('/')[0]];
  console.log(line(m, cat));
  console.log(`  file: ${m.path.split('/').pop()}${m.deps ? ` + ${m.deps.join(', ')}` : ''}`);
  if (m.anim) console.log(`  animations: ${m.anim.join(', ')}`);
  const preview = m.preview || p.preview;
  if (preview) console.log(`  ${m.preview ? 'preview' : 'pack overview'} image: ${join(cat.root, preview).replaceAll('\\', '/')}`);
  console.log(`  license: ${p.license} (${p.title} by ${p.author}, ${p.site})`);
}

function copy(ids) {
  const cat = load();
  const game = process.cwd();
  if (!existsSync(join(game, 'project.godot'))) { console.log('Run copy from the game folder (no project.godot here).'); process.exit(1); }
  const credits = join(game, 'assets', 'CREDITS.md');
  let failed = 0;
  for (const id of ids) {
    const m = findModel(cat, id);
    if (!m) { console.log(`No model "${id}": search first.`); failed++; continue; }
    const packId = m.id.split('/')[0], p = cat.packs[packId];
    const from = join(cat.root, m.path);
    if (!existsSync(from)) { console.log(`${m.id}: the library is not reachable here (${cat.root}).`); failed++; continue; }
    const destDir = join(game, 'assets', packId, m.dest || '');
    const files = [basename(from), ...(m.deps || [])];
    for (const f of files) {
      const to = join(destDir, f);
      mkdirSync(dirname(to), { recursive: true });
      if (!existsSync(to)) copyFileSync(m.moved?.[f] ? join(cat.root, m.moved[f]) : join(dirname(from), f), to);
    }
    const res = `res://${relative(game, join(destDir, basename(from))).replaceAll('\\', '/')}`;
    console.log(`copied ${m.id} → ${res}${m.deps ? ` (+${m.deps.length} texture/data file${m.deps.length > 1 ? 's' : ''})` : ''} · ${fmtSize(m.size)}`);
    if (m.anim) console.log(`  animations (its AnimationPlayer): ${m.anim.join(', ')}`);
    const note = `- ${basename(from)}: ${p.title} by ${p.author} (${p.site}), ${p.license}`;
    if (!existsSync(credits)) writeFileSync(credits, '# 3D models\n\nFree to use (CC0 1.0, public domain). Thanks to their makers:\n\n');
    if (!readFileSync(credits, 'utf8').includes(note)) appendFileSync(credits, note + '\n');
  }
  if (ids.length > failed) {
    console.log('Use: var m: Node3D = load("res://assets/<pack>/<file>").instantiate(); add_child(m), then scale it to the size you need.');
    console.log('Models have no collision: give the body a simple CollisionShape3D (box, capsule). Credits: assets/CREDITS.md');
  }
  if (failed) process.exit(1);
}

if (cmd === 'index') index(rest[0] || process.env.ASSET_LIBRARY || 'E:/3D models');
else if (cmd === 'search') search(rest.filter((a, i) => a !== '--limit' && rest[i - 1] !== '--limit').join(' '));
else if (cmd === 'pack') pack(rest[0] || '');
else if (cmd === 'info') info(rest[0] || '');
else if (cmd === 'copy' && rest.length) copy(rest);
else console.log(`Usage: node "${ME}" search <words> | pack <pack> | info <id> | copy <id> [<id>…]`);
