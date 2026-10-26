// Keeps heavy work (hidden browsers, Godot, Lighthouse, builds) off 4 of the PC's cores, at
// below-normal priority, so Luka's PC never freezes (2026-10-17: parallel hidden browsers took
// ~90% CPU and froze everything; Luka: use up to 12 of the 16, keep the rest free). On Windows
// and Linux (WSL: taskset), child processes inherit both the CPU affinity and the priority, so
// limiting this process limits everything it starts.
//   The live server (TYPEPLAY_SERVER=1: the runner container and its jobs, deploy/api/compose.yaml) keeps no cores
// free here: the container's CPU cap (3 of the 4 vCPUs) leaves the API, Caddy and the system theirs, as servers do.
// Keeping 4 free there pinned every check to one vCPU: a 3D check at ~1 frame a second, two checks at once failing
// (docs/research/build-capacity-2026-10-26.md). Which machine this is comes from that variable, never from the core
// count: a 4-core laptop is still a developer PC.
//   In a script:  import { limitThisProcess } from './cpu.mjs'; limitThisProcess();
//   Any command:  node packages/agent/tools/cpu.mjs <command> [args...]   (e.g. npx lighthouse ...)
import { spawnSync } from 'node:child_process';
import { availableParallelism, setPriority, constants } from 'node:os';
import { fileURLToPath } from 'node:url';

/** On the live server's runner (set in deploy/api/compose.yaml; the runner hands it to every job). */
export const ON_SERVER = process.env.TYPEPLAY_SERVER === '1';

/** Logical cores heavy work may use: on a PC all but 4 (12 of 16 on Luka's PC), at least 1; on the server all it sees. */
export const HEAVY_CORES = ON_SERVER ? availableParallelism() : Math.max(1, availableParallelism() - 4);

let done = false;
export function limitThisProcess() {
  if (done) return;
  done = true;
  // Below normal on the server too: Godot and the browser yield to the runner and the agents in the container.
  try { setPriority(0, constants.priority.PRIORITY_BELOW_NORMAL); } catch {}
  if (ON_SERVER) return;
  const n = availableParallelism();
  if (process.platform === 'linux') {
    // WSL and the Linux toolchain tests: pin to the top cores with taskset (children inherit the
    // affinity like the priority).
    if (n > HEAVY_CORES) spawnSync('taskset', ['-pc', `${n - HEAVY_CORES}-${n - 1}`, String(process.pid)], { stdio: 'ignore', timeout: 5_000 });
    return;
  }
  if (process.platform !== 'win32') return;
  // The top cores (core 0 and the first ones are where Windows puts most UI work).
  const mask = (2 ** HEAVY_CORES - 1) * 2 ** (n - HEAVY_CORES);
  spawnSync('powershell', ['-NoProfile', '-Command', `(Get-Process -Id ${process.pid}).ProcessorAffinity = ${mask}`], {
    stdio: 'ignore', timeout: 15_000,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd) { console.error('usage: node cpu.mjs <command> [args...]'); process.exit(2); }
  limitThisProcess();
  // With shell: true the arguments are joined into one command line, so quote the ones with
  // spaces: unquoted, --prompt "Make a match-3 game" reached run.mjs as "Make" (2026-10-17).
  const win = process.platform === 'win32';
  const quote = (a) => (/[\s"&|<>^()]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a);
  const r = spawnSync(cmd, win ? rest.map(quote) : rest, { stdio: 'inherit', shell: win });
  process.exit(r.status ?? 1);
}
