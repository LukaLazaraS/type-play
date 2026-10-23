// Talks to the runner (apps/server/runner/runner.mjs) over its Unix socket. On the live server
// everything that executes inside a game folder goes there: game agent runs, Godot exports and git.
// The runner runs it as a throwaway user in a container that has no secrets and no internet.
// Protocol: POST /jobs with {kind, project, args, env}; the answer streams NDJSON lines:
// {"o": stdout line} {"e": stderr text} … then {"x": exit code, "s": signal} (or {"err": text}).
// Closing the request stops the job.
import { request, type ClientRequest } from "node:http";
import { config } from "../env.js";
import { readLines } from "./lines.js";

export type RunnerKind = "agent" | "export" | "android" | "git" | "remove";

export interface RunnerJob {
  kind: RunnerKind;
  /** The project id: the runner works only in <DATA_DIR>/projects/<project>. */
  project: string;
  args?: string[];
  /** Only the agent's ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY (a run token) and AGENT_AUTH pass. */
  env?: Record<string, string>;
  /** Android jobs: the launcher icon's picture, base64, at most 1 MB (written into the job's home). */
  files?: Record<string, string>;
}

export interface JobExit {
  /** The process's exit code; null when it was killed or the runner failed. */
  code: number | null;
  error?: string;
}

export interface RunnerProcess {
  exit: Promise<JobExit>;
  kill(): void;
}

export function startRunnerJob(job: RunnerJob, onLine: (line: string) => void, onStderr?: (text: string) => void): RunnerProcess {
  let req: ClientRequest | null = null;
  const exit = new Promise<JobExit>((resolve) => {
    let settled = false;
    const done = (r: JobExit) => {
      if (!settled) {
        settled = true;
        resolve(r);
      }
    };
    const body = JSON.stringify(job);
    req = request(
      {
        socketPath: config.runnerSocket,
        path: "/jobs",
        method: "POST",
        headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let text = "";
          res.on("data", (c) => (text += c));
          res.on("end", () => done({ code: null, error: `runner ${res.statusCode}: ${text.slice(0, 300)}` }));
          return;
        }
        // A cancel destroys the request: the stream then errors, which must not crash the API.
        res.on("error", () => done({ code: null, error: "stopped" }));
        // Bounded (lines.ts): the runner already cuts a job's lines, but never trust one hop to do it.
        readLines(res, (line) => {
          if (!line) return;
          let m: { o?: unknown; e?: unknown; x?: number | null; s?: string | null; err?: unknown };
          try {
            m = JSON.parse(line);
          } catch {
            return;
          }
          if (typeof m.o === "string") onLine(m.o);
          else if (typeof m.e === "string") onStderr?.(m.e);
          else if ("x" in m) done({ code: m.x ?? null, error: m.x === 0 ? undefined : m.s ? `stopped (${m.s})` : `exit code ${m.x}` });
          else if (typeof m.err === "string") done({ code: null, error: m.err });
        });
        res.on("close", () => done({ code: null, error: "the runner closed the connection" }));
      },
    );
    req.on("error", (e) => done({ code: null, error: `runner unreachable: ${e.message}` }));
    req.end(body);
  });
  return { exit, kill: () => req?.destroy() };
}

/** Runs a short job and collects its output. */
export async function runnerExec(job: RunnerJob): Promise<JobExit & { stdout: string; stderr: string }> {
  const out: string[] = [];
  let stderr = "";
  const r = await startRunnerJob(job, (l) => out.push(l), (t) => (stderr += t)).exit;
  return { ...r, stdout: out.join("\n"), stderr };
}

/** Whether the runner answers (the API's /health). */
export function runnerHealthy(timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const req = request({ socketPath: config.runnerSocket, path: "/health", method: "GET", timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end();
  });
}
