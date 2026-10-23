// "Your game is yours": a game's Godot project as a .zip, the way the player opens it in Godot.
// The folder is the game agent's to write, so this reads it like files.ts does: regular files only,
// whose real path is inside the folder (no symlinks), with caps on size and count.
import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readGameFile } from "./files.js";
import { zip, type ZipEntry } from "./zip.js";

/** Not part of the game: Godot's cache, the builds, git, and the game agent's own log. */
const SKIP = new Set([".git", ".godot", "export", ".agent-log.jsonl"]);
const MAX_FILES = 5000;
const MAX_BYTES = 256 << 20;

export class TooBig extends Error {}

/** Every file of the game, relative paths with forward slashes, sorted. */
function collect(dir: string): { rel: string; mtime: Date }[] {
  const found: { rel: string; mtime: Date }[] = [];
  let bytes = 0;
  const walk = (rel: string) => {
    for (const d of readdirSync(join(dir, rel), { withFileTypes: true })) {
      if (!rel && SKIP.has(d.name)) continue;
      const path = rel ? `${rel}/${d.name}` : d.name;
      if (d.isSymbolicLink()) continue;
      if (d.isDirectory()) {
        walk(path);
        continue;
      }
      if (!d.isFile()) continue; // sockets, FIFOs and devices are no game's files
      const st = lstatSync(join(dir, path));
      bytes += st.size;
      if (found.length >= MAX_FILES || bytes > MAX_BYTES) throw new TooBig();
      found.push({ rel: path, mtime: st.mtime });
    }
  };
  walk("");
  return found.sort((a, b) => a.rel.localeCompare(b.rel));
}

/** A name that is safe as a folder and a file name everywhere: "Cat Jump!" -> "cat-jump". */
export function fileSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "my-game";
}

function readme(name: string, version: number, hasCredits: boolean): string {
  const lines = [
    `${name}`,
    `Made with TypePlay (https://typeplay.app), version ${version} of your game.`,
    "",
    "This folder is the whole game: a Godot 4.7 project. It is yours: you can change it, publish it",
    "under your own name and keep what it earns (https://typeplay.app/terms).",
    "",
    "To open it:",
    "1. Get Godot 4.7 (free) from https://godotengine.org/download (the standard version, not .NET).",
    '2. Start Godot, press "Import", and pick the file project.godot in this folder.',
    "3. Press F5 (or the Play button at the top right) to play.",
    "",
    "The first time, Godot takes a moment to import the files. To make a build for a phone or a",
    'computer, use Project > Export in Godot (it asks you to download its "export templates" once).',
    "",
    "What is in here:",
    "- project.godot: the project's settings (name, screen size, which way the screen turns).",
    "- .tscn files are scenes, .gd files are the code (GDScript).",
    "- NOTES.md, if there is one: notes on how the game is built, which also help an AI that changes it.",
  ];
  if (hasCredits) {
    lines.push("- assets/CREDITS.md: where the 3D models and other free assets come from, and their licences.");
  }
  return lines.join("\r\n") + "\r\n";
}

/** The game folder as a zip: <slug>/<files> plus <slug>/README.txt. */
export function projectZip(dir: string, name: string, version: number): { file: string; data: Buffer } {
  const slug = fileSlug(name);
  const files = collect(dir);
  const entries: ZipEntry[] = files.map((f) => ({
    name: `${slug}/${f.rel}`,
    data: readGameFile(dir, f.rel, MAX_BYTES),
    modified: f.mtime,
  }));
  const hasCredits = files.some((f) => f.rel === "assets/CREDITS.md");
  const own = files.some((f) => f.rel.toLowerCase() === "readme.txt");
  entries.unshift({ name: `${slug}/${own ? "README-TypePlay.txt" : "README.txt"}`, data: Buffer.from(readme(name, version, hasCredits)) });
  return { file: `${slug}.zip`, data: zip(entries) };
}

