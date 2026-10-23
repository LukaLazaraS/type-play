// The sign + inspect half of the WSL toolchain test (scripts/android-check.sh `export`), with the
// same code the API and the signer sidecar run (dist/android/tools.js): makes an upload keystore
// with keytool, signs <dir>/unsigned.apk (apksigner) and <dir>/unsigned.aab (jarsigner) after the
// pre-sign manifest check, verifies both, prints inspect.json and the checks list, then proves the
// manifest check refuses a build whose package differs from the request.
//   node apps/server/scripts/android-sign-check.mjs <dir with unsigned.apk and unsigned.aab> <projectId>
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const here = resolve(import.meta.dirname, "..");
const { findToolchain, keygen, signAndInspect, workDir } = await import(join(here, "dist/android/tools.js"));
const { checksOf } = await import(join(here, "dist/android/inspect.js"));
const { newPassword } = await import(join(here, "dist/android/crypto.js"));

const [dir, projectId = "wsltest1"] = process.argv.slice(2);
if (!dir) {
  console.error("usage: android-sign-check.mjs <dir> [projectId]");
  process.exit(2);
}
const tc = findToolchain(process.env);
if (!tc) {
  console.error("no toolchain: JAVA_HOME, ANDROID_HOME (with build-tools) and BUNDLETOOL_JAR");
  process.exit(1);
}
let failures = 0;
const ok = (cond, what) => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
};
const ms = () => Date.now();

const tmp = workDir(process.env.TMPDIR || "/tmp", `tp-sign-${process.pid}`);
let t = ms();
const password = newPassword();
const key = await keygen(tc, tmp, "Tower Defence", password);
console.log(`keygen: ${ms() - t} ms, ${key.p12.length} bytes, cert ${key.certSha256.slice(0, 16)}…`);
ok(/^[0-9a-f]{64}$/.test(key.certSha256) && key.p12.length > 1000, "keystore made (PKCS12, RSA 2048, alias upload)");

for (const ext of ["apk", "aab"]) {
  const unsigned = join(dir, `unsigned.${ext}`);
  if (!existsSync(unsigned)) {
    console.log(`  skip  no ${unsigned}`);
    continue;
  }
  const work = join(tmp, ext);
  mkdirSync(work, { recursive: true });
  copyFileSync(unsigned, join(work, `unsigned.${ext}`));
  // The request this file is checked against: what android-check.sh asked android-prepare.mjs for.
  const expect = { format: ext, packageName: `app.typeplay.tower_defence_${projectId}`, versionCode: 1, versionName: "1.1", certSha256: key.certSha256 };
  t = ms();
  const r = await signAndInspect(tc, { ext, dir: work, p12: key.p12, password, expect });
  console.log(`sign + inspect ${ext}: ${ms() - t} ms`);
  if (!r.ok) {
    console.log(`  problem ${r.problem}: ${r.reasons.join("; ")}`);
    console.log(JSON.stringify(r.inspect, null, 2));
  }
  ok(r.ok, `${ext}: inspected, signed and verified`);
  if (r.ok) {
    const signedFile = join(work, `signed.${ext}`);
    copyFileSync(signedFile, join(dir, `signed.${ext}`));
    console.log(`  inspect.json: ${JSON.stringify(r.inspect)}`);
    console.log(`  signed ${ext}: ${(statSync(signedFile).size / 1048576).toFixed(1)} MB → ${join(dir, `signed.${ext}`)}`);
    const checks = checksOf(expect, r.inspect);
    for (const c of checks) console.log(`  ${c.ok ? "green" : "RED  "} ${c.id}: ${c.text}`);
    ok(checks.every((c) => c.ok), `${ext}: every check green`);
    ok(r.inspect.certSha256 === key.certSha256, `${ext}: signed with the keystore's certificate`);
  }
  // The tamper detector: the same file against a different request must not be signed.
  const work2 = join(tmp, `${ext}-tamper`);
  mkdirSync(work2, { recursive: true });
  copyFileSync(unsigned, join(work2, `unsigned.${ext}`));
  const r2 = await signAndInspect(tc, { ext, dir: work2, p12: key.p12, password, expect: { ...expect, packageName: "com.other.app" } });
  ok(!r2.ok && r2.problem === "mismatch" && !existsSync(join(work2, `signed.${ext}`)), `${ext}: a different package name is refused before signing (${r2.ok ? "" : r2.reasons.join("; ")})`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(failures ? `${failures} FAILED` : "sign check: all good");
process.exit(failures ? 1 : 0);
