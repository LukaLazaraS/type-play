// Runs a SceneTree probe (probes/*.gd) against a game, through the CPU limiter, and prints its PROBE lines.
//   node tests/edit-eval/probe.mjs <game copy> <probe.gd> [--at <commit>] [-- <args for the probe>]
// With --at the copy is first exported at that commit into output/_edit-eval/work/ (git archive + a Godot
// import), so the same probe can be run on the version before and after an edit. The probe is a script
// that `extends SceneTree`, loads res://main.tscn and measures something (see probes/td_slow.gd).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const AGENT = join(HERE, '..', '..');
const GODOT = process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe';
const argv = process.argv.slice(2);
const dashes = argv.indexOf('--');
const own = dashes >= 0 ? argv.slice(0, dashes) : argv;
const probeArgs = dashes >= 0 ? argv.slice(dashes) : [];
const [copy, probe] = own;
const at = own.includes('--at') ? own[own.indexOf('--at') + 1] : null;
if (!copy || !probe) { console.error('usage: probe.mjs <game copy> <probe.gd> [--at <commit>] [-- args]'); process.exit(2); }
let game = join(AGENT, 'output', copy);
const cpu = (cmd, a, extra = {}) => spawnSync(process.execPath, [join(AGENT, 'tools', 'cpu.mjs'), cmd, ...a], { encoding: 'utf8', ...extra });
if (at) {
  const out = join(AGENT, 'output', '_edit-eval', 'work', `${copy}@${at}`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const archive = spawnSync('git', ['-C', game, 'archive', '--format=tar', at], { maxBuffer: 1 << 30 });
  if (archive.status !== 0) { console.error(String(archive.stderr)); process.exit(1); }
  const untar = spawnSync('tar', ['-x'], { cwd: out, input: archive.stdout, maxBuffer: 1 << 30 }); // cwd, not -C: GNU tar reads "C:\…" as a host
  if (untar.status !== 0) { console.error(String(untar.stderr)); process.exit(1); }
  cpu(GODOT, ['--headless', '--path', out, '--import'], { stdio: 'ignore' });
  game = out;
}
const script = join(HERE, 'probes', probe);
if (!existsSync(script)) { console.error('no probe ' + script); process.exit(2); }
const r = cpu(GODOT, ['--headless', '--path', game, '--fixed-fps', '60', '--script', script, ...probeArgs], { maxBuffer: 64 << 20 });
const lines = ((r.stdout || '') + '\n' + (r.stderr || '')).split(/\r?\n/).filter((l) => /PROBE|SCRIPT ERROR|Parse Error|^ERROR/.test(l));
console.log(lines.slice(0, 40).join('\n') || '(the probe printed nothing)');
