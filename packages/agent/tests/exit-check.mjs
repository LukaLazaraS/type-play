// The close-the-game check (tools/exit-check.mjs): node tests/exit-check.mjs
// 1. The code half, no Godot: each bad sample is reported at its line, each good one is not, the blank template passes.
// 2. With Godot (GODOT_EXE or the PC's 4.7.2; skipped without it): a game that keeps a lambda in another script's static var
//    crashes when it closes and fails; the same game with a method passes; the template's Looks helper with a look added
//    and never baked closes cleanly; the command the Android export runs exits 1 and 0 for them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanExit, lambdaProblems } from '../tools/exit-check.mjs';
import { limitThisProcess } from '../tools/cpu.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, '..', 'templates', 'blank');
const root = mkdtempSync(join(tmpdir(), 'tp-exit-check-'));
let n = 0;
const PROJECT = 'config_version=5\n\n[application]\n\nconfig/name="exit-check"\nrun/main_scene="res://main.tscn"\nconfig/features=PackedStringArray("4.7")\n';
const SCENE = '[gd_scene load_steps=2 format=3]\n\n[ext_resource type="Script" path="res://main.gd" id="1"]\n\n[node name="Main" type="Node2D"]\nscript = ExtResource("1")\n';
/** A small game: project.godot (+ extra lines), main.tscn, and the given files (GDScript indented with tabs). */
function game(files, projectExtra = '') {
  const dir = join(root, `g${++n}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'project.godot'), PROJECT + projectExtra);
  writeFileSync(join(dir, 'main.tscn'), SCENE);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text.replace(/^\n/, ''));
  }
  return dir;
}
const HOLDER = `
class_name Holder
extends RefCounted

static var cb: Callable
static var list: Array = []
static var by_name: Dictionary = {}
static var obj: RefCounted = null
`;
const LISTENER = `
class_name OnInitializationCompleteListener
extends RefCounted

var on_initialization_complete: Callable
static var _kept: Array = []

static func keep(l) -> void:
	_kept.append(func() -> void: l.on_initialization_complete.call())
`;
/** The lines reported for a game, as "file:line". */
const where = (dir) => lambdaProblems(dir).map((p) => p.match(/^\[close\] res:\/\/(\S+:\d+):/)?.[1]);

try {
  // --- the code half: bad samples, each at its line --------------------------------------------------------------
  const bad = game({
    'holder.gd': HOLDER,
    'addons/admob/listener.gd': LISTENER,
    'store.gd': 'extends RefCounted\n\nstatic var handlers: Array = []\n',
    'events.gd': 'extends Node\n\nstatic var listeners: Array = []\n',
    'main.gd': `
extends Node2D

const Store = preload("res://store.gd")

static var on_done := func() -> void: pass

func _ready() -> void:
	Holder.cb = func() -> void: print("x")
	Store.handlers.append(func(x: int) -> void: print(x))
	Holder.by_name["a"] = func() -> void: pass
	Holder.obj.callback = func() -> void: pass
	Holder.list.append(
		func() -> void:
			print("two lines")
	)
	Input.joy_connection_changed.connect(func(_d: int, _c: bool) -> void: pass)
	Engine.set_meta("cb", func() -> void: pass)
	var billing = Engine.get_singleton("GodotGooglePlayBilling")
	billing.connect("connected", func() -> void: pass)
	var l := OnInitializationCompleteListener.new()
	l.on_initialization_complete = func(_status) -> void: print("ready")
	Events.listeners.push_back(func() -> void: pass)
`,
  }, '\n[autoload]\n\nEvents="*res://events.gd"\n');
  assert.deepEqual(where(bad), [
    'main.gd:5', // static var made with a lambda
    'main.gd:8', // another script's static var (class_name)
    'main.gd:9', // through a preload const, appended
    'main.gd:10', // into a Dictionary a static var holds
    'main.gd:11', // into an object a static var holds
    'main.gd:12', // appended over several lines
    'main.gd:16', // an engine singleton's signal
    'main.gd:17', // an engine singleton's meta
    'main.gd:19', // a native plugin (Engine.get_singleton)
    'main.gd:21', // a plugin's listener: Black Hole Galaxy 1.3's crash
    'main.gd:22', // an autoload's static var
  ], 'every bad line is reported, and only those (not the plugin\'s own code under addons/)');
  const msg = lambdaProblems(bad).find((p) => p.includes('main.gd:21:'));
  assert.match(msg, /OnInitializationCompleteListener/, 'the message names the plugin class');
  assert.match(msg, /crashes when it closes/, 'and says what happens');
  assert.match(msg, /_on_done/, 'and how to fix it');
  assert.match(lambdaProblems(bad).find((p) => p.includes('main.gd:16:')), /connected to Input/);

  // --- good samples: nothing reported ------------------------------------------------------------------------------
  const good = game({
    'holder.gd': HOLDER,
    'addons/admob/listener.gd': LISTENER,
    'lib/looks.gd': '',
    'main.gd': `
extends Node2D

const Looks = preload("res://lib/looks.gd")

static var cb: Callable
var _later := func() -> void: pass

func _ready() -> void:
	Holder.cb = _on_done
	cb = _on_done
	var l := OnInitializationCompleteListener.new()
	l.on_initialization_complete = _on_init
	var local := func() -> void: pass
	local.call()
	_later = func() -> void: print("member")
	get_tree().process_frame.connect(func() -> void: pass)
	$Button.pressed.connect(func() -> void: print("pressed"))
	var odd := Holder.list.filter(func(x: int) -> bool: return x % 2 == 1)
	Holder.list.sort_custom(func(a: int, b: int) -> bool: return a < b)
	Looks.add("ant", Vector2i(8, 8), func(c: CanvasItem) -> void: c.draw_circle(Vector2.ZERO, 3.0, Color.RED), "Ant")
	print("Holder.cb = func(): pass")
	# Holder.cb = func(): pass
	var jump := func() -> bool: return Input.is_action_pressed("jump")
	await Input.joy_connection_changed

func _shadow() -> void:
	var cb := func() -> void: pass
	cb.call()

func _on_done() -> void:
	pass

func _on_init(_status) -> void:
	pass
`,
    'test/some_test.gd': 'extends Node\n\nfunc _ready() -> void:\n\tHolder.cb = func() -> void: pass\n',
  });
  assert.deepEqual(lambdaProblems(good), [], 'methods, local and member lambdas, node and tree signals, filter/sort, Looks, strings, comments, shadowing and tests pass');
  // The template every game starts from (lib/looks.gd, warmup.gd, lighting.gd, test/helpers.gd) passes.
  assert.deepEqual(lambdaProblems(TEMPLATE), [], 'the blank template passes');
  console.log('exit check, code: OK');

  // --- the run: needs Godot -----------------------------------------------------------------------------------------
  const GODOT = process.env.GODOT_EXE || 'C:/Users/lazar/Godot/4.7.2/Godot_v4.7.2-stable_win64.exe';
  if (!existsSync(GODOT)) {
    console.log(`exit check, run: skipped (no Godot at ${GODOT}; set GODOT_EXE)`);
  } else {
    limitThisProcess();
    const keeper = 'extends RefCounted\n\nstatic var cb: Callable\n';
    const runGame = (line) => game({
      'keeper.gd': keeper,
      'main.gd': `extends Node2D\n\nconst Keeper = preload("res://keeper.gd")\n\nfunc _ready() -> void:\n\t${line}\n\nfunc _on_done() -> void:\n\tpass\n`,
    });
    const crashing = runGame('Keeper.cb = func() -> void: print("x")');
    const r1 = cleanExit(GODOT, crashing, { frames: 10 });
    assert.ok(r1.status !== 0 || r1.signal, `a lambda in another script's static var crashes at close (got exit ${r1.status})`);
    assert.equal(r1.problems.length, 1);
    assert.match(r1.problems[0], /^\[close\] the game crashes when it closes \((exit code|signal)/);
    const fine = runGame('Keeper.cb = _on_done');
    const r2 = cleanExit(GODOT, fine, { frames: 10 });
    assert.deepEqual(r2.problems, [], `a method there closes cleanly (exit ${r2.status})`);
    assert.equal(r2.status, 0);
    // The template's Looks with a look added and never baked: the helper lets it go as the game closes (it crashed before).
    const looks = game({
      'main.gd': 'extends Node2D\n\nconst Looks = preload("res://lib/looks.gd")\n\nfunc _ready() -> void:\n\tLooks.add("dot", Vector2i(8, 8), func(c: CanvasItem) -> void: c.draw_circle(Vector2.ZERO, 3.0, Color.RED))\n',
    });
    cpSync(join(TEMPLATE, 'lib'), join(looks, 'lib'), { recursive: true });
    const r3 = cleanExit(GODOT, looks, { frames: 10 });
    assert.deepEqual(r3.problems, [], `a look added and never baked closes cleanly (exit ${r3.status})`);
    // The command the Android export runs (apps/server/runner): exit 1 with ERROR: lines, or 0.
    const cli = (dir) => spawnSync(process.execPath, [join(HERE, '..', 'tools', 'exit-check.mjs'), '--godot', GODOT, '--frames', '10', dir], { encoding: 'utf8', timeout: 120_000 });
    const c1 = cli(crashing);
    assert.equal(c1.status, 1, c1.stdout);
    assert.match(c1.stdout, /^EXIT-CHECK: FAIL/m);
    assert.match(c1.stdout, /^ERROR: \[close\] the game crashes when it closes/m);
    const c2 = cli(fine);
    assert.equal(c2.status, 0, c2.stdout);
    assert.match(c2.stdout, /^EXIT-CHECK: OK/m);
    console.log('exit check, run: OK');
  }
} finally {
  rmSync(root, { recursive: true, force: true });
}
