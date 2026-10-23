// The signing and inspection tools (docs/android-export-design.md §6-7): keytool, apksigner,
// jarsigner, aapt2, zipalign, bundletool. Runs in the signer sidecar on the live server
// (apps/server/signer/signer.mjs: no network, no secrets, a tmpfs) and in-process on Luka's PC and
// in the WSL toolchain test. No dependency on the API's config: the toolchain comes in as paths.
// Every tool is spawned with a minimal environment and a timeout; a password reaches a tool only
// through an environment variable (keytool, jarsigner `:env`) or stdin (apksigner), never argv.
import { spawn } from "node:child_process";
import { X509Certificate } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mismatches, type Expected, type Inspect } from "./inspect.js";
import { abisOf, elfLoadAlign16k, zipEntries, zipRead } from "./zipdir.js";

export interface Toolchain {
  javaHome: string;
  androidHome: string;
  /** build-tools/<version>; the newest present when not given. */
  buildTools: string;
  bundletoolJar: string;
}

export type BuildExt = "apk" | "aab";

const TOOL_TIMEOUT_MS = 120_000;
const WIN = process.platform === "win32";

/** The toolchain from the environment (JAVA_HOME, ANDROID_HOME, BUNDLETOOL_JAR, ANDROID_BUILD_TOOLS), or null when a piece is missing. */
export function findToolchain(env: NodeJS.ProcessEnv = process.env): Toolchain | null {
  const javaHome = env.JAVA_HOME || "";
  const androidHome = env.ANDROID_HOME || "";
  const bundletoolJar = env.BUNDLETOOL_JAR || "";
  if (!javaHome || !androidHome || !bundletoolJar) return null;
  if (!existsSync(join(javaHome, "bin", WIN ? "java.exe" : "java")) || !existsSync(bundletoolJar)) return null;
  const dir = join(androidHome, "build-tools");
  let buildTools = env.ANDROID_BUILD_TOOLS || "";
  if (!buildTools) {
    const versions = existsSync(dir) ? readdirSync(dir).filter((v) => /^\d+\.\d+\.\d+$/.test(v)) : [];
    versions.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    buildTools = versions[0] ?? "";
  }
  if (!buildTools || !existsSync(join(dir, buildTools, WIN ? "aapt2.exe" : "aapt2"))) return null;
  return { javaHome, androidHome, buildTools, bundletoolJar };
}

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

/** One tool, minimal environment, bounded output, killed after the timeout. */
function run(tc: Toolchain, cmd: string, args: string[], o: { env?: Record<string, string>; stdin?: string; cwd?: string } = {}): Promise<Run> {
  return new Promise((resolve) => {
    const env: Record<string, string> = {
      PATH: [join(tc.javaHome, "bin"), WIN ? process.env.PATH ?? "" : "/usr/bin:/bin"].join(WIN ? ";" : ":"),
      JAVA_HOME: tc.javaHome,
      ANDROID_HOME: tc.androidHome,
      HOME: o.cwd ?? process.cwd(),
      JAVA_TOOL_OPTIONS: "-Xmx512m",
      ...(WIN ? { SYSTEMROOT: process.env.SYSTEMROOT ?? "C:\\Windows", TEMP: process.env.TEMP ?? "", TMP: process.env.TMP ?? "" } : {}),
      ...(o.env ?? {}),
    };
    // Windows: the build-tools' apksigner is a .bat, which needs the shell.
    const bat = WIN && cmd.endsWith(".bat");
    const child = spawn(bat ? "cmd.exe" : cmd, bat ? ["/c", cmd, ...args] : args, { env, cwd: o.cwd, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    const cap = (s: string, d: Buffer) => (s.length < 1 << 20 ? s + d.toString("utf8") : s);
    child.stdout.on("data", (d: Buffer) => (stdout = cap(stdout, d)));
    child.stderr.on("data", (d: Buffer) => (stderr = cap(stderr, d)));
    const timer = setTimeout(() => child.kill("SIGKILL"), TOOL_TIMEOUT_MS);
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\ncould not start ${cmd}: ${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
    if (o.stdin !== undefined) child.stdin.end(o.stdin);
    else child.stdin.end();
  });
}

const exe = (name: string) => (WIN ? `${name}.exe` : name);
const javaBin = (tc: Toolchain, name: string) => join(tc.javaHome, "bin", exe(name));
const buildTool = (tc: Toolchain, name: string, bat = false) => join(tc.androidHome, "build-tools", tc.buildTools, WIN ? `${name}.${bat ? "bat" : "exe"}` : name);

export class ToolError extends Error {
  constructor(
    readonly tool: string,
    readonly output: string,
  ) {
    super(`${tool} failed: ${output.trim().slice(-600)}`);
  }
}

const fail = (tool: string, r: Run) => new ToolError(tool, `${r.stderr}\n${r.stdout}`);

/** A fresh private work folder (0700) under `base`; the caller removes it. */
export function workDir(base: string, name: string): string {
  const dir = join(base, name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** The DN's CN: a few safe characters of the app name (RFC 2253 specials would need escaping). */
const safeCn = (name: string) => name.replace(/[^A-Za-z0-9 .'_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "TypePlay game";

/** Normalises a fingerprint ("AB:CD:…" or hex) to lowercase hex without colons. */
export const hexDigest = (s: string) => s.replace(/[^0-9a-fA-F]/g, "").toLowerCase();

/**
 * Makes a game's upload keystore (RSA 2048, valid 10,000 days, alias "upload") and returns its bytes
 * and the certificate's SHA-256. The keystore exists on disk only inside `dir` during this call.
 */
export async function keygen(tc: Toolchain, dir: string, appName: string, password: string): Promise<{ p12: Buffer; certSha256: string }> {
  const ks = join(dir, "k.p12");
  const env = { KS: password };
  const gen = await run(tc, javaBin(tc, "keytool"), [
    "-genkeypair", "-keystore", ks, "-storetype", "PKCS12", "-alias", "upload", "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
    "-dname", `CN=${safeCn(appName)}, O=TypePlay user`, "-storepass:env", "KS", "-keypass:env", "KS",
  ], { env, cwd: dir });
  if (gen.code !== 0 || !existsSync(ks)) throw fail("keytool -genkeypair", gen);
  const pem = join(dir, "cert.pem");
  const exp = await run(tc, javaBin(tc, "keytool"), ["-exportcert", "-keystore", ks, "-storetype", "PKCS12", "-alias", "upload", "-storepass:env", "KS", "-rfc", "-file", pem], { env, cwd: dir });
  if (exp.code !== 0 || !existsSync(pem)) throw fail("keytool -exportcert", exp);
  const cert = new X509Certificate(readFileSync(pem));
  const p12 = readFileSync(ks);
  rmSync(ks, { force: true });
  rmSync(pem, { force: true });
  return { p12, certSha256: hexDigest(cert.fingerprint256) };
}

// --- inspection -----------------------------------------------------------------------------------

/** `aapt2 dump badging` + the zip's native libraries + `zipalign -c -P 16 4` (unsigned or signed). */
export async function inspectApk(tc: Toolchain, file: string): Promise<Omit<Inspect, "certSha256" | "signed">> {
  const r = await run(tc, buildTool(tc, "aapt2"), ["dump", "badging", file]);
  if (r.code !== 0) throw fail("aapt2 dump badging", r);
  const t = r.stdout;
  const pkg = /^package: name='([^']*)' versionCode='(\d*)' versionName='([^']*)'/m.exec(t);
  if (!pkg) throw new ToolError("aapt2 dump badging", `no package line:\n${t.slice(0, 600)}`);
  const num = (re: RegExp) => Number(re.exec(t)?.[1] ?? 0);
  const permissions = [...t.matchAll(/^uses-permission: name='([^']+)'/gm)].map((m) => m[1]).sort();
  const buf = readFileSync(file);
  const align = await run(tc, buildTool(tc, "zipalign"), ["-c", "-P", "16", "4", file]);
  return {
    package: pkg[1],
    versionCode: Number(pkg[2]),
    versionName: pkg[3],
    minSdk: num(/^(?:min)?sdkVersion:'(\d+)'/m),
    targetSdk: num(/^targetSdkVersion:'(\d+)'/m),
    debuggable: /^application-debuggable/m.test(t),
    abis: abisOf(zipEntries(buf)),
    permissions,
    pageAlign16k: align.code === 0,
  };
}

/** `bundletool dump manifest` + `dump config` + the base module's libraries' ELF alignment. */
export async function inspectAab(tc: Toolchain, file: string): Promise<Omit<Inspect, "certSha256" | "signed">> {
  const java = javaBin(tc, "java");
  const man = await run(tc, java, ["-jar", tc.bundletoolJar, "dump", "manifest", `--bundle=${file}`]);
  if (man.code !== 0) throw fail("bundletool dump manifest", man);
  const x = man.stdout;
  const attr = (name: string, tag?: string) => {
    const scope = tag ? (new RegExp(`<${tag}\\b[^>]*>`, "s").exec(x)?.[0] ?? "") : (/<manifest\b[^>]*>/s.exec(x)?.[0] ?? "");
    return new RegExp(`\\b${name}="([^"]*)"`).exec(scope)?.[1];
  };
  const pkg = attr("package");
  if (!pkg) throw new ToolError("bundletool dump manifest", `no package attribute:\n${x.slice(0, 600)}`);
  const permissions = [...x.matchAll(/<uses-permission\b[^>]*android:name="([^"]+)"/g)].map((m) => m[1]).sort();
  const conf = await run(tc, java, ["-jar", tc.bundletoolJar, "dump", "config", `--bundle=${file}`]);
  if (conf.code !== 0) throw fail("bundletool dump config", conf);
  const buf = readFileSync(file);
  const entries = zipEntries(buf);
  // 16 KB: the bundle config says so (AGP 8.5.1+), and every shipped library's LOAD segments are aligned.
  const libs = entries.filter((e) => /\/lib\/[^/]+\/[^/]+\.so$/.test(e.name));
  const elfOk = libs.length > 0 && libs.every((e) => elfLoadAlign16k(zipRead(buf, e)));
  return {
    package: pkg,
    versionCode: Number(attr("android:versionCode") ?? 0),
    versionName: attr("android:versionName") ?? "",
    minSdk: Number(attr("android:minSdkVersion", "uses-sdk") ?? 0),
    targetSdk: Number(attr("android:targetSdkVersion", "uses-sdk") ?? 0),
    debuggable: attr("android:debuggable", "application") === "true",
    abis: abisOf(entries),
    permissions,
    pageAlign16k: /PAGE_ALIGNMENT_16K/.test(conf.stdout) && elfOk,
  };
}

export const inspectFile = (tc: Toolchain, file: string, ext: BuildExt) => (ext === "apk" ? inspectApk(tc, file) : inspectAab(tc, file));

// --- signing ----------------------------------------------------------------------------------------

/** apksigner (APK: already 16 KB-aligned by Godot, so sign after alignment) or jarsigner (AAB). */
export async function signFile(tc: Toolchain, o: { ext: BuildExt; unsigned: string; signed: string; p12: string; password: string; cwd: string }): Promise<void> {
  rmSync(o.signed, { force: true });
  if (o.ext === "apk") {
    const r = await run(tc, buildTool(tc, "apksigner", true), ["sign", "--ks", o.p12, "--ks-key-alias", "upload", "--ks-pass", "stdin", "--out", o.signed, o.unsigned], { stdin: o.password + "\n", cwd: o.cwd });
    if (r.code !== 0 || !existsSync(o.signed)) throw fail("apksigner sign", r);
    return;
  }
  const r = await run(tc, javaBin(tc, "jarsigner"), [
    "-keystore", o.p12, "-storetype", "PKCS12", "-storepass:env", "KS", "-keypass:env", "KS", "-sigalg", "SHA256withRSA", "-digestalg", "SHA-256",
    "-signedjar", o.signed, o.unsigned, "upload",
  ], { env: { KS: o.password }, cwd: o.cwd });
  if (r.code !== 0 || !existsSync(o.signed)) throw fail("jarsigner", r);
}

/** The signature and its certificate: `apksigner verify --print-certs` (APK) or `jarsigner -verify` + the signer's block (AAB). */
export async function verifySigned(tc: Toolchain, file: string, ext: BuildExt, dir: string): Promise<{ signed: boolean; certSha256: string | null }> {
  if (ext === "apk") {
    const r = await run(tc, buildTool(tc, "apksigner", true), ["verify", "--print-certs", file]);
    const m = /certificate SHA-256 digest: ([0-9a-f]+)/i.exec(r.stdout);
    return { signed: r.code === 0 && !!m, certSha256: m ? m[1].toLowerCase() : null };
  }
  const v = await run(tc, javaBin(tc, "jarsigner"), ["-verify", "-certs", file]);
  const verified = v.code === 0 && /jar verified/i.test(v.stdout + v.stderr);
  // The certificate: keytool -printcert reads the PKCS#7 block jarsigner wrote (META-INF/UPLOAD.RSA).
  const buf = readFileSync(file);
  const block = zipEntries(buf).find((e) => /^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(e.name));
  if (!verified || !block) return { signed: false, certSha256: null };
  const blockFile = join(dir, "signer.p7");
  writeFileSync(blockFile, zipRead(buf, block));
  const c = await run(tc, javaBin(tc, "keytool"), ["-printcert", "-file", blockFile]);
  rmSync(blockFile, { force: true });
  const m = /SHA256:\s*([0-9A-Fa-f:]+)/.exec(c.stdout);
  return { signed: !!m, certSha256: m ? hexDigest(m[1]) : null };
}

export interface SignRequest {
  ext: BuildExt;
  /** The folder holding unsigned.<ext>; signed.<ext> and inspect.json are written next to it. */
  dir: string;
  p12: Buffer;
  password: string;
  expect: Expected;
}

export type SignResult = { ok: true; inspect: Inspect } | { ok: false; problem: "mismatch" | "sign"; reasons: string[]; inspect: Inspect | null };

/**
 * The signer's `sign` op: inspects the unsigned file first and refuses to sign one that is not what
 * the API asked for (a prompt-injected export plugin fails the build instead of shipping), signs,
 * verifies the signature and its certificate, and leaves signed.<ext> + inspect.json in `dir`.
 * The keystore is on disk (0600) only while the tool runs.
 */
export async function signAndInspect(tc: Toolchain, req: SignRequest): Promise<SignResult> {
  const unsigned = join(req.dir, `unsigned.${req.ext}`);
  const signed = join(req.dir, `signed.${req.ext}`);
  const ks = join(req.dir, "k.p12");
  try {
    const before = await inspectFile(tc, unsigned, req.ext);
    const reasons = mismatches(req.expect, { ...before, certSha256: null, signed: false });
    if (reasons.length) return { ok: false, problem: "mismatch", reasons, inspect: { ...before, certSha256: null, signed: false } };
    writeFileSync(ks, req.p12, { mode: 0o600 });
    await signFile(tc, { ext: req.ext, unsigned, signed, p12: ks, password: req.password, cwd: req.dir });
    rmSync(ks, { force: true });
    const v = await verifySigned(tc, signed, req.ext, req.dir);
    const inspect: Inspect = { ...before, ...v };
    if (!v.signed) return { ok: false, problem: "sign", reasons: ["the signature did not verify"], inspect };
    if (req.expect.certSha256 && v.certSha256 !== req.expect.certSha256.toLowerCase()) {
      return { ok: false, problem: "sign", reasons: ["signed with a different certificate than the game's key"], inspect };
    }
    writeFileSync(join(req.dir, "inspect.json"), JSON.stringify(inspect, null, 2) + "\n");
    return { ok: true, inspect };
  } finally {
    rmSync(ks, { force: true });
  }
}
