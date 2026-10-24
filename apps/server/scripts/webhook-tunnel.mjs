// Paddle sandbox webhooks to this PC (apps/web/README.md "Plan and billing"): a public address that reaches only the
// webhook route of the local API, for a second, sandbox-only notification destination. Everything else the tunnel is
// asked answers 404, so the dev API (and its dev sign-in) stays private. Needs cloudflared: on the PATH, or the official
// release binary in %LOCALAPPDATA%\TypePlay\cloudflared\cloudflared.exe (2026.10.3, its published SHA-256 checked when it
// was put there 10-25); its quick tunnel needs no account and gives a new random address each time.
//   node apps/server/scripts/webhook-tunnel.mjs [apiPort=3002]
// Prints the destination URL (https://<random>.trycloudflare.com/webhooks/paddle); Ctrl+C stops both.
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer, request } from "node:http";
import { join } from "node:path";

const API_PORT = Number(process.argv[2] ?? 3002);
const PATH = "/webhooks/paddle";
const LOCAL = join(process.env.LOCALAPPDATA ?? "", "TypePlay", "cloudflared", "cloudflared.exe");
const CLOUDFLARED = spawnSync("cloudflared", ["--version"], { stdio: "ignore" }).status === 0 ? "cloudflared" : LOCAL;
if (CLOUDFLARED === LOCAL && !existsSync(LOCAL)) {
  console.error(`cloudflared not found: put it on the PATH or at ${LOCAL}`);
  process.exit(1);
}

const forwarder = createServer((req, res) => {
  if (req.method !== "POST" || req.url !== PATH) {
    res.writeHead(404).end();
    return;
  }
  // The body goes through untouched: the signature covers its exact bytes.
  const upstream = request({ host: "127.0.0.1", port: API_PORT, method: "POST", path: PATH, headers: req.headers }, (answer) => {
    res.writeHead(answer.statusCode ?? 502, answer.headers);
    answer.pipe(res);
    console.log(`${new Date().toISOString()} webhook → ${answer.statusCode}`);
  });
  upstream.on("error", (e) => {
    console.log(`${new Date().toISOString()} webhook: the API on :${API_PORT} didn't answer (${e.message})`);
    if (!res.headersSent) res.writeHead(502).end();
  });
  req.pipe(upstream);
});

forwarder.listen(0, "127.0.0.1", () => {
  const port = forwarder.address().port;
  const tunnel = spawn(CLOUDFLARED, ["tunnel", "--no-autoupdate", "--url", `http://127.0.0.1:${port}`], { windowsHide: true });
  let shown = false;
  const watch = (chunk) => {
    const url = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(chunk))?.[0];
    if (url && !shown) {
      shown = true;
      console.log(`\nSandbox destination URL (Paddle > Events > Notifications, usage "Platform and simulation"):\n  ${url}${PATH}\n`);
      console.log(`Only POST ${PATH} reaches the API on :${API_PORT}; anything else is 404. Ctrl+C stops the tunnel.`);
    }
  };
  tunnel.stdout.on("data", watch);
  tunnel.stderr.on("data", watch);
  tunnel.on("exit", (code) => {
    console.log(`cloudflared stopped (${code})`);
    forwarder.close();
    process.exit(code ?? 0);
  });
  const stop = () => tunnel.kill();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
});
