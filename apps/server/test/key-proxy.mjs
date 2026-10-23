// The key proxy's metering, against a mock Anthropic on this machine (no key, no network):
//   npm run test:proxy -w @typeplay/server        (after npm run build)
// A run token makes a plain JSON call and a streamed one (with cache fields); the proxy must swap in
// the key, pass the answers through unchanged, and add the usage up priced per family
// (src/credits/prices.ts): the run's charge is the larger of this and what the agent reports.
import { createServer } from "node:http";

let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};

const seenKeys = [];
const JSON_USAGE = { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
const upstream = createServer((req, res) => {
  seenKeys.push(req.headers["x-api-key"]);
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const { stream } = JSON.parse(body);
    if (!stream) {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ id: "msg_1", type: "message", role: "assistant", content: [{ type: "text", text: "hi" }], usage: JSON_USAGE }));
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    const event = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`);
    event("message_start", { message: { id: "msg_2", usage: { input_tokens: 1000, output_tokens: 1, cache_creation_input_tokens: 200, cache_read_input_tokens: 300 } } });
    event("content_block_start", { index: 0, content_block: { type: "text", text: "" } });
    // Split across writes: the meter must handle an event arriving in pieces.
    res.write("event: content_block_delta\ndata: {\"type\":\"content_block_delta\",");
    setTimeout(() => {
      res.write("\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"hello\"}}\n\n");
      event("message_delta", { delta: { stop_reason: "end_turn" }, usage: { output_tokens: 50 } });
      event("message_stop", {});
      res.end();
    }, 30);
  });
});
await new Promise((r) => upstream.listen(0, "127.0.0.1", r));

process.env.AGENT_AUTH = "api";
process.env.ANTHROPIC_API_KEY = "sk-ant-api-test-only";
process.env.ANTHROPIC_UPSTREAM = `http://127.0.0.1:${upstream.address().port}`;
const { KeyProxy } = await import("../dist/runs/key-proxy.js");
const { usageCostUsd } = await import("../dist/credits/prices.js");

const proxy = new KeyProxy();
const port = await proxy.listen(0, "127.0.0.1");
const token = proxy.issue("test run", "sonnet", 5);
const call = (body, key = token) =>
  fetch(`http://127.0.0.1:${port}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "accept-encoding": "gzip" },
    body: JSON.stringify(body),
  });

console.log("key proxy metering");
const plain = await call({ model: "claude-haiku-5-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }] });
const plainBody = await plain.json();
ok(plain.status === 200 && plainBody.content?.[0]?.text === "hi", "a JSON answer passes through");
const streamed = await call({ model: "claude-sonnet-5-5", max_tokens: 10, stream: true, messages: [{ role: "user", content: "hi" }] });
const streamText = await streamed.text();
ok(streamed.status === 200 && /text_delta/.test(streamText) && /message_stop/.test(streamText), "a streamed answer passes through");
ok(seenKeys.every((k) => k === "sk-ant-api-test-only"), "only our key reached upstream");
await new Promise((r) => setTimeout(r, 50));
const u = proxy.usageOf(token);
ok(u?.requests === 2, "two requests counted");
ok(u?.usage.input === 1100 && u.usage.output === 70 && u.usage.cacheWrite === 200 && u.usage.cacheRead === 300, "tokens added up: 1100 in, 70 out, 200 cache written, 300 cache read");
const expected = usageCostUsd("haiku", { input: 100, output: 20, cacheWrite: 0, cacheRead: 0 }) + usageCostUsd("sonnet", { input: 1000, output: 50, cacheWrite: 200, cacheRead: 300 });
ok(Math.abs(u.costUsd - expected) < 1e-12 && Math.abs(expected - 0.00308) < 1e-12, `priced per family: $${u.costUsd.toFixed(5)} (Haiku 100/20 + Sonnet 1000/50, cache 200 written, 300 read)`);
ok(Math.abs(usageCostUsd("haiku", { input: 150_000, output: 0, cacheWrite: 0, cacheRead: 0 }) - 0.075) < 1e-12, "Haiku over 100K input tokens in one call: 5x");
ok((await call({ model: "claude-opus-5-5", messages: [] })).status === 403, "a model outside the run's family: 403");
ok((await call({ model: "claude-haiku-5-5", messages: [] }, "tp-run-nope")).status === 401, "an unknown token: 401");
proxy.revoke(token);
ok(proxy.usageOf(token) === null, "revoked: no usage to read");

proxy.onModuleDestroy();
upstream.close();
console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
