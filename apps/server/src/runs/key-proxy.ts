// The key proxy (AGENT_AUTH=api). The game agent's Claude Code is pointed at this proxy
// (ANTHROPIC_BASE_URL) with a run token as its "API key"; the proxy swaps in our real key and
// forwards to Anthropic. So the key is never in the agent's environment, files or shell: it lives
// only in this process (on the live server: the api container, which agent runs can't enter).
// A run token works only while its run lasts, only for the Messages API, only for the run's model
// family plus Haiku (genre pick, player message, Claude Code's own small calls), a few requests at a
// time. That bounds what a prompt-injected agent could spend by calling the proxy itself.
// Every answer that passes through is metered: the `usage` of a JSON answer, or the message_start /
// message_delta events of a stream, priced per family (credits/prices.ts). The run's charge is the
// larger of what the agent reports about itself and this count (runs.service.ts), so model calls
// the agent's shell makes on its own are paid for too.
import { randomBytes } from "node:crypto";
import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { request as httpsRequest } from "node:https";
import { StringDecoder } from "node:string_decoder";
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { addUsage, NO_USAGE, usageCostUsd, type TokenUsage } from "../credits/prices.js";
import { config } from "../env.js";

export type ModelFamily = "haiku" | "sonnet" | "opus";

interface Grant {
  label: string;
  families: Set<ModelFamily>;
  expires: number;
  inFlight: number;
  requests: number;
  /** Every answered call's tokens and their cost at list prices. */
  usage: TokenUsage;
  costUsd: number;
}

/** What a run's model calls added up to (KeyProxy.usageOf). */
export interface RunUsage {
  requests: number;
  usage: TokenUsage;
  costUsd: number;
}

const PATHS = /^\/v1\/messages(\/count_tokens)?(\?[^#]*)?$/;
/** Claude Code calls the model one turn at a time (plus a small background call now and then). */
const MAX_IN_FLIGHT = 4;
/** Our longest builds take ~100 turns (two Haiku sessions of up to 50); this is a runaway stop. */
const MAX_REQUESTS = 1000;
const MAX_BODY = 32 << 20;
/** An answer is metered from at most this much of its body (a message with its usage is far smaller). */
const METER_MAX = 8 << 20;
const HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host"]);

const familyOf = (model: unknown): ModelFamily | null =>
  (typeof model === "string" ? /claude-(opus|sonnet|haiku)/i.exec(model)?.[1]?.toLowerCase() : null) as ModelFamily | null;

function error(res: ServerResponse, status: number, type: string, message: string) {
  if (res.headersSent) return void res.destroy();
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify({ type: "error", error: { type, message } }));
}

function readBody(req: IncomingMessage): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => resolve(null));
  });
}

/** The API's usage object (a JSON answer's `usage`, a stream's message_start / message_delta). */
interface ApiUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** Reads the usage out of one answer as it streams through: tokens only, nothing is kept. */
class ResponseMeter {
  private readonly dec = new StringDecoder("utf8");
  private text = "";
  private bytes = 0;
  private usage: ApiUsage | null = null;

  constructor(private readonly stream: boolean) {}

  feed(chunk: Buffer) {
    if (this.bytes > METER_MAX) return;
    this.bytes += chunk.length;
    this.text += this.dec.write(chunk);
    if (this.stream) this.drainEvents();
  }

  /** The answer's tokens, or null when it carried no usage (an error, a cut-off stream). */
  end(): TokenUsage | null {
    this.text += this.dec.end();
    if (this.stream) this.drainEvents(true);
    else this.takeJson(this.text);
    const u = this.usage;
    if (!u) return null;
    return { input: u.input_tokens ?? 0, output: u.output_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0 };
  }

  /** Server-sent events: `data: {...}` blocks separated by a blank line. */
  private drainEvents(final = false) {
    for (;;) {
      const cut = this.text.indexOf("\n\n");
      if (cut < 0) {
        if (final && this.text.trim()) this.takeEvent(this.text);
        return;
      }
      this.takeEvent(this.text.slice(0, cut));
      this.text = this.text.slice(cut + 2);
    }
  }

  private takeEvent(block: string) {
    const data = block
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (data) this.takeJson(data);
  }

  private takeJson(text: string) {
    let e: { type?: string; usage?: ApiUsage; message?: { usage?: ApiUsage } };
    try {
      e = JSON.parse(text);
    } catch {
      return;
    }
    // message_start carries the input side (and the first output tokens); each message_delta the
    // output total so far (newer API versions repeat the input fields there too). A plain JSON
    // answer carries everything at once. Later figures replace earlier ones, field by field.
    const u = e.type === "message_start" ? e.message?.usage : e.usage;
    if (!u || typeof u !== "object") return;
    this.usage = { ...(this.usage ?? {}) };
    for (const k of ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"] as const) {
      if (typeof u[k] === "number") this.usage[k] = u[k];
    }
  }
}

@Injectable()
export class KeyProxy implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("key-proxy");
  private readonly grants = new Map<string, Grant>();
  private server: Server | null = null;

  get enabled() {
    // FAKE_METER (tests only, env.ts): fake runs go through the proxy too, so the e2e can check what it meters.
    return config.agentAuth === "api" && (!config.agentFake || config.fakeMeter);
  }

  async onModuleInit() {
    if (!this.enabled) return;
    await this.listen();
    this.log.log(`key proxy on ${config.keyProxy.host}:${config.keyProxy.port} → ${config.keyProxy.upstream}; agents use ${config.keyProxy.url}`);
  }

  /** Starts the proxy server (tests call this directly). */
  async listen(port = config.keyProxy.port, host = config.keyProxy.host): Promise<number> {
    const server = createServer((req, res) => void this.handle(req, res).catch(() => error(res, 500, "api_error", "proxy error")));
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => resolve());
    });
    this.server = server;
    const addr = server.address();
    return typeof addr === "object" && addr ? addr.port : port;
  }

  onModuleDestroy() {
    this.server?.close();
    this.server?.closeAllConnections();
  }

  /** A token for one run, valid until revoked or `minutes` have passed. */
  issue(label: string, family: ModelFamily, minutes: number): string {
    const token = "tp-run-" + randomBytes(24).toString("base64url");
    this.grants.set(token, {
      label,
      families: new Set([family, "haiku"]),
      expires: Date.now() + minutes * 60_000,
      inFlight: 0,
      requests: 0,
      usage: NO_USAGE,
      costUsd: 0,
    });
    return token;
  }

  /** What the run's model calls have cost so far (null for a token this proxy doesn't know). */
  usageOf(token: string): RunUsage | null {
    const g = this.grants.get(token);
    return g ? { requests: g.requests, usage: g.usage, costUsd: g.costUsd } : null;
  }

  revoke(token: string) {
    const g = this.grants.get(token);
    if (g) this.log.log(`${g.label}: ${g.requests} model request(s), $${g.costUsd.toFixed(4)} metered`);
    this.grants.delete(token);
  }

  private async handle(req: IncomingMessage, res: ServerResponse) {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1];
    const token = (req.headers["x-api-key"] as string | undefined) ?? bearer ?? "";
    const grant = this.grants.get(token);
    if (!grant || grant.expires < Date.now()) return error(res, 401, "authentication_error", "This run's key is not valid (the run has ended).");
    const url = req.url ?? "/";
    if (req.method !== "POST" || !PATHS.test(url)) {
      this.log.warn(`${grant.label}: blocked ${req.method} ${url.split("?")[0]}`);
      return error(res, 404, "not_found_error", "Not available through TypePlay's proxy.");
    }
    if (grant.inFlight >= MAX_IN_FLIGHT) return error(res, 429, "rate_limit_error", "Too many requests at once for this run.");
    if (grant.requests >= MAX_REQUESTS) return error(res, 429, "rate_limit_error", "This run has made too many requests.");
    // Counted before the body is read: requests whose bodies are still arriving count as in flight,
    // or the 4-at-once bound would let any number through at the same time.
    grant.requests++;
    grant.inFlight++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        grant.inFlight--;
      }
    };
    const refuse = (status: number, type: string, message: string) => {
      release();
      error(res, status, type, message);
    };
    const body = await readBody(req);
    if (!body) return refuse(413, "request_too_large", "Request too large.");
    let model: unknown;
    try {
      model = (JSON.parse(body.toString("utf8")) as { model?: unknown }).model;
    } catch {
      return refuse(400, "invalid_request_error", "The body is not JSON.");
    }
    const family = familyOf(model);
    if (!family || !grant.families.has(family)) {
      this.log.warn(`${grant.label}: refused model ${String(model).slice(0, 60)}`);
      return refuse(403, "permission_error", "That model is not allowed for this run.");
    }
    this.forward(url, req.headers, body, res, release, (u) => {
      grant.usage = addUsage(grant.usage, u);
      grant.costUsd += usageCostUsd(family, u);
    });
  }

  private forward(url: string, inHeaders: IncomingHttpHeaders, body: Buffer, res: ServerResponse, release: () => void, metered: (u: TokenUsage) => void) {
    const headers: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(inHeaders)) {
      // No accept-encoding: the answer comes back plain, so its usage can be read as it passes.
      if (v === undefined || HOP.has(k) || k === "x-api-key" || k === "authorization" || k === "content-length" || k === "accept-encoding") continue;
      headers[k] = v;
    }
    headers["x-api-key"] = config.anthropicApiKey;
    headers["content-length"] = String(body.length);
    const target = new URL(config.keyProxy.upstream + url);
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;
    const up = send(target, { method: "POST", headers }, (upRes) => {
      const out: Record<string, string | string[]> = {};
      for (const [k, v] of Object.entries(upRes.headers)) if (v !== undefined && !HOP.has(k)) out[k] = v;
      res.writeHead(upRes.statusCode ?? 502, out);
      const ok = (upRes.statusCode ?? 0) >= 200 && (upRes.statusCode ?? 0) < 300;
      const meter = ok ? new ResponseMeter(/text\/event-stream/i.test(String(upRes.headers["content-type"] ?? ""))) : null;
      if (meter) upRes.on("data", (c: Buffer) => meter.feed(c));
      upRes.pipe(res);
      upRes.on("end", () => {
        const u = meter?.end();
        if (u) metered(u);
      });
      upRes.on("close", release);
    });
    up.setTimeout(15 * 60_000, () => up.destroy(new Error("upstream timeout")));
    up.on("error", (e) => {
      release();
      this.log.warn(`upstream: ${e.message}`);
      error(res, 502, "api_error", "Could not reach the model API.");
    });
    // The agent stopped (run cancelled): stop the upstream call too.
    res.on("close", () => {
      if (!res.writableFinished) up.destroy();
      release();
    });
    up.end(body);
  }
}
