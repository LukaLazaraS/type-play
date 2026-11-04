// Plain names for the Assets tab (2026-11-04): what a player reads instead of a key in the code or a file's name.
// "tb_saw_2" -> "Tb saw 2", "building-type-a.glb" -> "Building type a", "Cosmic_Weightless_Loop.mp3" -> "Cosmic weightless
// loop". A look the AI named (lib/looks.gd's last argument) keeps that name; one without gets its drawing function's
// words too ("tower_base" drew "tb_saw_2": "Tower base saw 2"), found in the game's scripts (looksIn).

const MAX = 60;

/** A name cleaned for showing: no control characters, one space between words, at most 60 letters. */
export function cleanLabel(raw: string): string {
  // eslint-disable-next-line no-control-regex
  const s = raw.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, " ").replace(/\s+/g, " ").trim();
  return s.length > MAX ? `${s.slice(0, MAX - 1).trimEnd()}…` : s;
}

/** Words from a key or a file name, the first letter capital: "e_toaster" -> "E toaster", "map0" -> "Map 0", "hud" -> "HUD". */
export function plainName(raw: string): string {
  const words = raw
    .replace(/\.[a-z0-9]{1,6}$/i, "")
    .split(/[\s_\-.]+/)
    .filter(Boolean)
    .flatMap((w) =>
      ACRONYMS[w.toLowerCase()]
        ? [ACRONYMS[w.toLowerCase()]]
        : w
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
            .replace(/([A-Za-z])(\d)/g, "$1 $2")
            .replace(/(\d)([A-Za-z])/g, "$1 $2")
            .toLowerCase()
            .split(" ")
            .map((x) => ACRONYMS[x] ?? x),
    );
  if (!words.length) return "Untitled";
  const shown = words.join(" ");
  return cleanLabel(shown.charAt(0).toUpperCase() + shown.slice(1));
}

/** Short words games use that read as letters: "hud.gd" -> "HUD", "bg" -> "BG", "3d" -> "3D". */
const ACRONYMS: Record<string, string> = { hud: "HUD", ui: "UI", fx: "FX", sfx: "SFX", vfx: "VFX", npc: "NPC", hp: "HP", xp: "XP", bg: "BG", ai: "AI", fps: "FPS", "2d": "2D", "3d": "3D" };

/** A part of the game, from a script's or scene's path: "enemies/boss_robot.tscn" -> "Boss robot", "main.gd" -> "Main". */
export function partName(rel: string): string {
  return plainName(rel.split("/").pop() ?? rel);
}

/** A drawing function's words: "draw_ant" -> "ant", "_paint_sky" -> "sky", "Enemy.draw_robot" -> "robot", "tower_base" -> "tower base". */
export function painterWords(fn: string): string {
  const last = fn.split(".").pop() ?? fn;
  return last
    .replace(/^_+/, "")
    .replace(/^(draw|paint|make|render|bake|build)_+/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_+/g, " ")
    .trim()
    .toLowerCase();
}

/** One Looks.add / add_frames / bake_one call found in a script: which keys it makes and what draws them. */
export interface LookCall {
  /** Matches the keys the call makes ("tb_%s_%d" -> /^tb_(.+?)_(-?\d+)$/). */
  pattern: RegExp;
  /** The key's fixed start, as the scripts write it ("tb_"), for finding where it is used; "" when it starts with a variable. */
  prefix: string;
  /** The drawing function's words ("tower base"), or "" when the drawing is written inline. */
  painter: string;
  /** The script it is in. */
  file: string;
}

/** A call's arguments, from the text just after its "(" up to its closing ")" (commas at depth 0 split them). */
function callArgs(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length && i < 6000; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = "";
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") {
      if (depth === 0) {
        args.push(text.slice(start, i).trim());
        return args;
      }
      depth--;
    } else if (c === "," && depth === 0) {
      args.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  return args; // the call never closed within reach: what was read
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A key expression as a pattern: "tb_%s_%d" % [k, lv], "ti_" + k, "heart". Null when it is not built from a string. */
function keyPattern(expr: string): { pattern: RegExp; prefix: string } | null {
  const e = expr.trim();
  // "tb_%s_%d" % [k, lv]  or  "map%d" % li
  let m = /^"([^"\\]*)"\s*%/.exec(e);
  if (m) {
    const parts = m[1].split(/(%[sd])/);
    const re = parts.map((p) => (p === "%s" ? "(.+?)" : p === "%d" ? "(-?\\d+)" : escape(p))).join("");
    return { pattern: new RegExp(`^${re}$`), prefix: parts[0] ?? "" };
  }
  // "ti_" + k  (a fixed start, then a variable)
  m = /^"([^"\\]*)"\s*\+/.exec(e);
  if (m) return { pattern: new RegExp(`^${escape(m[1])}(.+)$`), prefix: m[1] };
  // "heart"
  m = /^"([^"\\]*)"$/.exec(e);
  if (m) return { pattern: new RegExp(`^${escape(m[1])}$`), prefix: m[1] };
  return null;
}

/** Every Looks call in a script (`file` is its path, for "where it is used"). */
export function looksIn(file: string, text: string): LookCall[] {
  const calls: LookCall[] = [];
  const re = /\bLooks\.(add|add_frames|bake_one)\s*\(/g;
  // Where the key and the drawing are: add(key, size, painter), add_frames(key, size, count, painter),
  // bake_one(host, key, size, origin, painter).
  const at = { add: [0, 2], add_frames: [0, 3], bake_one: [1, 4] } as const;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const kind = m[1] as keyof typeof at;
    const args = callArgs(text.slice(m.index + m[0].length));
    const key = args[at[kind][0]] !== undefined ? keyPattern(args[at[kind][0]]) : null;
    if (!key) continue;
    // The drawing: a lambda calling one function ("func(c: CanvasItem) -> void: tower_base(c, k, lv)"), or a function
    // passed by name ("_paint_sky"). Inline drawing (draw_* calls on the canvas) has no name to use.
    const drawing = args[at[kind][1]] ?? "";
    const lambda = /^func\s*\([^)]*\)\s*(?:->\s*\w+\s*)?:\s*([A-Za-z_][\w.]*)\s*\(/.exec(drawing);
    const byName = /^([A-Za-z_][\w.]*)$/.exec(drawing);
    const fn = lambda?.[1] ?? byName?.[1] ?? "";
    const inline = /^(c|canvas|self)\.|^draw_(rect|circle|line|polyline|polygon|colored|arc|string|texture|set|primitive|mesh|style)/.test(fn);
    calls.push({ ...key, painter: fn && !inline ? painterWords(fn) : "", file });
  }
  return calls;
}

/**
 * A look's name without one from the AI: its drawing function's words and the parts of its key that vary ("tower_base"
 * drew "tb_saw_2": "Tower base saw 2"); for a key with nothing varying, the key's words the function's name lacks
 * ("star" drew "star_on" and "star_off": "Star on", "Star off").
 */
export function lookName(key: string, calls: LookCall[]): string {
  for (const c of calls) {
    const m = c.pattern.exec(key);
    if (!m || !c.painter) continue;
    const painter = c.painter.split(" ");
    const extra = m.length > 1
      ? m.slice(1).map((v) => plainName(v).toLowerCase())
      : plainName(key).toLowerCase().split(" ").filter((w) => !painter.includes(w));
    return plainName(`${c.painter} ${extra.join(" ")}`.trim());
  }
  return plainName(key);
}
