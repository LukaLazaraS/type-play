// `npm run dev`: compiles on every change (tsc --watch) and restarts the API when the output
// changes (node --watch). Generates the Prisma client first if it is missing.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);

if (!existsSync(join(here, "src/generated/prisma/client.ts"))) {
  spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "generate"], { cwd: here, stdio: "inherit" });
}

const tsc = spawn(process.execPath, [require.resolve("typescript/bin/tsc"), "--watch", "--preserveWatchOutput", "-p", "tsconfig.json"], {
  cwd: here,
  stdio: ["ignore", "pipe", "inherit"],
});
let server = null;
tsc.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  if (!server && /Found 0 errors/.test(String(chunk))) {
    server = spawn(process.execPath, ["--watch", "dist/main.js"], { cwd: here, stdio: "inherit" });
    server.on("exit", (code) => process.exit(code ?? 0));
  }
});
const stop = () => {
  tsc.kill();
  server?.kill();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
