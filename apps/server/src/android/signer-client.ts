// Where the keystore work happens (docs/android-export-design.md §7): on the live server the signer
// sidecar (apps/server/signer/signer.mjs) over its Unix socket, which only the api container can
// open; on Luka's PC and in the WSL test the same tools (tools.ts) in this process. Either way a
// keystore is on disk, in a private folder, only for the seconds a tool runs.
import { request } from "node:http";
import { mkdirSync, rmSync } from "node:fs";
import { config } from "../env.js";
import type { Expected, Inspect } from "./inspect.js";
import { findToolchain, keygen, signAndInspect, type SignResult, type Toolchain, workDir } from "./tools.js";

export interface SignerOps {
  keygen(o: { projectId: string; appName: string; password: string }): Promise<{ p12: Buffer; certSha256: string }>;
  /** Signs `<exportsDir>/<buildId>/unsigned.<ext>` into `signed.<ext>` (+ inspect.json) in the same folder. */
  sign(o: { buildId: string; ext: "apk" | "aab"; p12: Buffer; password: string; expect: Expected }): Promise<SignResult>;
}

type Answer = { ok: true; p12?: string; certSha256?: string; result?: SignResult } | { ok: false; err: string };

/** One op over the signer's socket: a JSON request, a JSON answer; 3 minutes at most. */
function call(op: string, body: Record<string, unknown>): Promise<Answer> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ op, ...body });
    const req = request(
      { socketPath: config.android.signerSocket, path: "/jobs", method: "POST", headers: { "content-type": "application/json", "content-length": Buffer.byteLength(data) }, timeout: 180_000 },
      (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(text) as Answer);
          } catch {
            reject(new Error(`signer answered ${res.statusCode}: ${text.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("signer timed out")));
    req.on("error", (e) => reject(new Error(`signer unreachable: ${e.message}`)));
    req.end(data);
  });
}

const remote: SignerOps = {
  async keygen(o) {
    const a = await call("keygen", o);
    if (!a.ok) throw new Error(`signer keygen: ${a.err}`);
    return { p12: Buffer.from(a.p12 ?? "", "base64"), certSha256: a.certSha256 ?? "" };
  },
  async sign(o) {
    const a = await call("sign", { ...o, p12: o.p12.toString("base64") });
    if (!a.ok) throw new Error(`signer sign: ${a.err}`);
    return a.result as SignResult;
  },
};

/** This process, with the toolchain from the environment (JAVA_HOME, ANDROID_HOME, BUNDLETOOL_JAR). */
function local(tc: Toolchain): SignerOps {
  return {
    async keygen(o) {
      const dir = workDir(config.android.exportsDir, `keygen-${o.projectId}-${process.pid}`);
      try {
        return await keygen(tc, dir, o.appName, o.password);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    sign(o) {
      const dir = `${config.android.exportsDir}/${o.buildId}`;
      return signAndInspect(tc, { ext: o.ext, dir, p12: o.p12, password: o.password, expect: o.expect });
    },
  };
}

/** ANDROID_FAKE=1 (tests, the site's development): no JDK; the "signature" is a stamp, the inspection is what was asked for. */
const fake: SignerOps = {
  async keygen(o) {
    return { p12: Buffer.from(`FAKE-PKCS12 ${o.projectId} ${o.password}`), certSha256: "f".repeat(64) };
  },
  async sign(o) {
    const { readFileSync, writeFileSync } = await import("node:fs");
    const dir = `${config.android.exportsDir}/${o.buildId}`;
    const unsigned = readFileSync(`${dir}/unsigned.${o.ext}`);
    const inspect: Inspect = {
      package: o.expect.packageName, versionCode: o.expect.versionCode, versionName: o.expect.versionName, minSdk: 24, targetSdk: 36,
      debuggable: false, abis: ["arm64-v8a"], permissions: [], certSha256: "f".repeat(64), pageAlign16k: true, signed: true,
    };
    // A fake build whose name says MISMATCH comes back as a tampered manifest (the e2e's tamper case).
    if (unsigned.includes("MISMATCH")) return { ok: false, problem: "mismatch", reasons: ["package other.app instead of " + o.expect.packageName], inspect: { ...inspect, package: "other.app", signed: false, certSha256: null } };
    writeFileSync(`${dir}/signed.${o.ext}`, Buffer.concat([unsigned, Buffer.from("\nSIGNED-FAKE\n")]));
    writeFileSync(`${dir}/inspect.json`, JSON.stringify(inspect));
    return { ok: true, inspect };
  },
};

/** The signer for this server, or null when it has none (features.android is false then). */
export function signerFor(): { ops: SignerOps; how: "signer" | "local" | "fake" } | null {
  const a = config.android;
  if (!a.on) return null;
  mkdirSync(a.exportsDir, { recursive: true, mode: 0o700 });
  if (a.fake) return { ops: fake, how: "fake" };
  if (a.signerSocket) return { ops: remote, how: "signer" };
  const tc = findToolchain({ JAVA_HOME: a.javaHome, ANDROID_HOME: a.androidHome, BUNDLETOOL_JAR: a.bundletoolJar, ANDROID_BUILD_TOOLS: process.env.ANDROID_BUILD_TOOLS });
  return tc ? { ops: local(tc), how: "local" } : null;
}
