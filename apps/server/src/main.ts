// TypePlay API: http://127.0.0.1:3002 on this PC; https://api.typeplay.app live (deploy/README.md).
import "reflect-metadata";
import type { IncomingMessage } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import type { Express } from "express";
import { AndroidService } from "./android/android.service.js";
import { AppModule } from "./app.module.js";
import { InboxService } from "./billing/inbox.service.js";
import { PaddleService } from "./billing/paddle.service.js";
import { ApiErrorFilter } from "./common/api-error.js";
import { assertSafeConfig, config, ROOT } from "./env.js";
import { PushService } from "./notify/push.service.js";
import { RunRegistry } from "./runs/registry.js";
import { runnerHealthy } from "./runs/runner-client.js";

assertSafeConfig();

// On this PC the game agent, Godot and the hidden browser run as our children: keep them (and us)
// on 12 of the 16 cores at below-normal priority so Luka's PC never freezes (CLAUDE.md, Known traps).
if (!config.production) {
  const cpu = (await import(pathToFileURL(join(ROOT, "packages/agent/tools/cpu.mjs")).href)) as { limitThisProcess: () => void };
  cpu.limitThisProcess();
}

// rawBody: the Paddle webhook verifies its signature over the bytes as sent (billing/webhooks.controller.ts).
const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ["log", "warn", "error"], rawBody: true });
app.disable("x-powered-by");
// JSON up to 1.5 MB: a Paddle event can be big, and an Android icon (a PNG of up to 1 MB) arrives as base64, 1.4 MB
// (until 10-20 the limit was 1 MB, so an icon over ~750 KB failed). A bigger body is 413 (common/api-error.ts). The
// webhook path is parsed as JSON whatever its Content-Type says (Paddle doesn't document it); everything else must say
// application/json.
app.useBodyParser("json", {
  limit: "1500kb",
  type: (req: IncomingMessage) => req.url === "/webhooks/paddle" || /^application\/([a-z0-9.+-]+\+)?json\b/i.test(req.headers["content-type"] ?? ""),
});
// GET /health, no sign-in: the deploy script and the container health check. 503 when the runner
// (live server) does not answer; `runs` is how many builds are going (a deploy stops them); `queued` how many wait in
// line (they keep their place through a restart);
// `billing`: the mode, whether Paddle answered the catalog check, and the webhook inbox's counts;
// `android`: whether this server builds for Android and how many builds are going; `inviteOnly`: the
// closed beta is on (BETA_INVITE_ONLY: only invited emails get past the sign-in); `push`: notifications go out (both
// VAPID keys set: deploy/README.md).
const registry = app.get(RunRegistry);
const paddle = app.get(PaddleService);
const inbox = app.get(InboxService);
const android = app.get(AndroidService);
const push = app.get(PushService);
(app.getHttpAdapter().getInstance() as Express).get("/health", async (_req, res) => {
  const runner = config.runnerSocket ? await runnerHealthy() : true;
  // `billing.problem`: the Paddle key was refused (expired, revoked, a permission missing): billing is 503, the rest runs.
  const billing = { mode: paddle.mode, ready: paddle.ready, problem: paddle.problem, ...(paddle.mode === "off" ? {} : await inbox.stats().catch(() => ({ error: "inbox stats failed" }))) };
  // `android.running`: builds going (a deploy restarts the runner and stops them, like runs).
  res.status(runner ? 200 : 503).json({
    ok: runner,
    runner,
    runs: registry.active.size,
    queued: registry.queued.size,
    agent: config.agentFake ? "fake" : config.agentAuth,
    billing,
    android: { enabled: android.enabled, running: android.runningCount },
    inviteOnly: config.betaInviteOnly,
    push: push.on,
  });
});
app.enableCors({
  origin: config.corsOrigins,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  // Last-Event-ID: the account's stream picks up where it left off (GET /me/events, notifications).
  allowedHeaders: ["Authorization", "Content-Type", "Last-Event-ID"],
  // Downloads (a game as .zip, the account data as .json) name their file here.
  exposedHeaders: ["Content-Disposition"],
  maxAge: 600,
});
app.useGlobalFilters(new ApiErrorFilter());
app.enableShutdownHooks();
await app.listen(config.port, config.host);
new Logger("main").log(
  `TypePlay API on http://${config.host}:${config.port}` + (config.devAuth ? " (DEV_AUTH on)" : "") + (config.agentFake ? " (AGENT_FAKE on)" : "") +
    (config.betaInviteOnly ? " (closed beta: invited emails only)" : "") +
    (push.on ? "" : " (notifications off: no VAPID keys)") +
    ` (agent: ${config.agentAuth}${config.runnerSocket ? ", in the runner" : ""}; builds: ${config.gamesPublish}; billing: ${paddle.mode}${paddle.mode !== "off" && !paddle.ready ? ", not ready" : ""})`,
);
