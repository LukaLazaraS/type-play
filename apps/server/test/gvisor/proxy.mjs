// The gVisor trial's stand-in for the api container (compose.yaml): the API's own KeyProxy class from the
// image (apps/server/dist/runs/key-proxy.js), listening where the live one does (api:8787 on the internal
// "agents" network), so a trial build reaches the model exactly as a live build does: run token in, our key
// added here, every answer metered. bench.mjs issues and revokes the run tokens over a Unix socket in a
// folder only root on the host can open (/control), the way the API does in-process.
//   POST /issue {label, family, minutes} → {token}    POST /revoke {token} → {requests, usage, costUsd}
import { chmodSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";

// Nest's decorators need reflect-metadata first, found from the API's own node_modules (not this folder's).
createRequire("/app/apps/server/dist/main.js")("reflect-metadata");
const { KeyProxy } = await import("/app/apps/server/dist/runs/key-proxy.js");

const CONTROL = process.env.PROXY_CONTROL || "/control/proxy.sock";
const proxy = new KeyProxy();
await proxy.listen(8787, "0.0.0.0");

const json = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
const control = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    let input = {};
    try {
      input = body ? JSON.parse(body) : {};
    } catch {
      return json(res, 400, { err: "bad JSON" });
    }
    if (req.method === "POST" && req.url === "/issue") {
      if (!["haiku", "sonnet", "opus"].includes(input.family)) return json(res, 400, { err: "bad family" });
      return json(res, 200, { token: proxy.issue(String(input.label ?? "trial"), input.family, Number(input.minutes) || 45) });
    }
    if (req.method === "POST" && req.url === "/revoke") {
      const usage = proxy.usageOf(String(input.token ?? ""));
      proxy.revoke(String(input.token ?? ""));
      return json(res, usage ? 200 : 404, usage ?? { err: "unknown token" });
    }
    if (req.method === "GET" && req.url === "/health") return json(res, 200, { ok: true, key: process.env.ANTHROPIC_API_KEY ? "set" : "missing" });
    json(res, 404, { err: "not found" });
  });
});
rmSync(CONTROL, { force: true });
control.listen(CONTROL, () => chmodSync(CONTROL, 0o600));
console.log(`trial proxy on 0.0.0.0:8787, control on ${CONTROL}, key ${process.env.ANTHROPIC_API_KEY ? "set" : "missing (probe phases only)"}`);
const stop = () => {
  control.close();
  proxy.onModuleDestroy();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
