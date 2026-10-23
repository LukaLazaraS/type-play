// Unit test of the Android export's pure parts (no server, no database, no JDK):
//   npm run build -w @typeplay/server && npm run test:android -w @typeplay/server
// The preset writer and project.godot patch (runner/android-prepare.mjs), the package-name rules and
// the default scheme, the version name, the keystore crypto (seal/open: a flipped byte, a wrong key id,
// a wrong project all throw), the PNG parser and the icon rules, the manifest check (each mismatch
// kind), the checks list, the zip reader and the ELF alignment check, the runner's secret guard, the
// failure classifier, and the phone link (short in every store; what it leads to; refused when
// expired or gone).
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { deflateSync } from "node:zlib";
import {
  androidPreset, APP_NAME_MAX, defaultPackageName, packageNameProblem, patchProjectGodot, versionNameOf, withAndroidPreset,
} from "../runner/android-prepare.mjs";
import { newPassword, newToken, open, parseMasterKey, sameToken, seal } from "../dist/android/crypto.js";
import { certMismatch, checksOf, mismatches } from "../dist/android/inspect.js";
import { phoneLinkUrl, PRESIGN_MAX_SEC, presignSeconds } from "../dist/android/links.js";
import { iconProblem, pngInfo } from "../dist/android/png.js";
import { abisOf, elfLoadAlign16k, zipEntries, zipRead } from "../dist/android/zipdir.js";
import { AndroidService, classifyFailure } from "../dist/android/android.service.js";
import { config } from "../dist/env.js";
import { r2PresignGet } from "../dist/games/r2.js";
import { zip } from "../dist/games/zip.js";

const here = resolve(import.meta.dirname, "..");
let failures = 0;
function ok(cond, what) {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${what}`);
  if (!cond) failures++;
}
const throws = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

console.log("package names");
ok(packageNameProblem("app.typeplay.cat_jump_k3x9p2m7qd") === null, "the default scheme passes");
ok(packageNameProblem("com.luka.mygame") === null, "a reverse-DNS name passes");
ok(packageNameProblem("com.example.x") !== null, "com.example.* refused (Play refuses it)");
ok(packageNameProblem("com.google.game") !== null && packageNameProblem("android.x") !== null, "com.google.* and android.* refused");
ok(packageNameProblem("1a.b") !== null, "a digit can't start a segment");
ok(packageNameProblem("Com.A") !== null, "uppercase refused");
ok(packageNameProblem("game") !== null, "one segment refused (needs a dot)");
ok(packageNameProblem("a.b-c") !== null, "a dash refused");
ok(packageNameProblem("") !== null && packageNameProblem(undefined) !== null, "empty refused");
ok(packageNameProblem("a." + "b".repeat(80)) !== null, "over 80 chars refused");
ok(defaultPackageName("Cat Jump!", "k3x9p2m7qd") === "app.typeplay.cat_jump_k3x9p2m7qd", "default: slug + project id");
ok(defaultPackageName("2048 Blocks", "abcdefghij") === "app.typeplay.g2048_blocks_abcdefghij", "a digit start gets a g");
ok(defaultPackageName("", "abcdefghij") === "app.typeplay.g_abcdefghij" && packageNameProblem(defaultPackageName("", "abcdefghij")) === null, "an empty name still yields a valid name");
ok(defaultPackageName("A very long game name with many words indeed", "abcdefghij").length <= 80 && /^app\.typeplay\.[a-z0-9_]{1,20}_abcdefghij$/.test(defaultPackageName("A very long game name with many words indeed", "abcdefghij")), "the slug is cut to 20");
ok(packageNameProblem(defaultPackageName("Тетрис 🎮", "abcdefghij")) === null, "non-Latin names fall back to a valid name");
ok(versionNameOf(7, 3) === "7.3" && versionNameOf(1, 1) === "1.1", "version name <versionN>.<versionCode>");
ok(APP_NAME_MAX === 30, "app name limit is Play's 30");

console.log("preset writer");
const opts = { format: "aab", packageName: "app.typeplay.cat_abcdefghij", appName: 'Cat "Jump" \\ Go', versionCode: 3, versionName: "2.3" };
const blank = readFileSync(join(here, "../../packages/agent/templates/blank/export_presets.cfg"), "utf8");
const cfg = withAndroidPreset(blank, opts);
ok(/^\[preset\.0\]\n\nname="Web"/m.test(cfg) && /^\[preset\.1\]\n\nname="Android"/m.test(cfg), "the Web preset stays as preset.0, Android is preset.1");
ok(/^platform="Android"$/m.test(cfg) && /^runnable=false$/m.test(cfg), "platform Android, not runnable (no adb poll thread)");
ok(/^gradle_build\/use_gradle_build=true$/m.test(cfg) && /^gradle_build\/export_format=1$/m.test(cfg), "aab: Gradle build, export format 1");
ok(/^package\/signed=false$/m.test(cfg), "unsigned (the signer signs)");
ok(/^package\/unique_name="app\.typeplay\.cat_abcdefghij"$/m.test(cfg) && /^version\/code=3$/m.test(cfg) && /^version\/name="2\.3"$/m.test(cfg), "package, version code and name");
ok(/^package\/name="Cat \\"Jump\\" \\\\ Go"$/m.test(cfg), 'the app name escapes " and \\');
ok(/^architectures\/arm64-v8a=true$/m.test(cfg) && /^architectures\/armeabi-v7a=false$/m.test(cfg) && /^architectures\/x86_64=false$/m.test(cfg), "arm64 only");
ok(/^launcher_icons\/main_192x192="res:\/\/export\/icons\/icon-192\.png"$/m.test(cfg), "icons from export/icons");
ok(!/keystore\//.test(cfg) && !/permissions\/internet/.test(cfg), "no keystore keys, no permissions");
ok(/^export_path="export\/android\/game\.aab"$/m.test(cfg) && /^exclude_filter="export\/\*,test\/\*,NOTES\.md"$/m.test(cfg), "export path and filter");
const apk = androidPreset(0, { ...opts, format: "apk" });
ok(/^gradle_build\/use_gradle_build=false$/m.test(apk) && /^gradle_build\/export_format=0$/m.test(apk), "apk: prebuilt template, export format 0");
const planted = blank + '\n[preset.1]\n\nname="Android"\nplatform="Android"\nrunnable=true\n\n[preset.1.options]\n\nkeystore/release="evil.jks"\npermissions/internet=true\n\n[preset.2]\n\nname="Linux"\nplatform="Linux"\n\n[preset.2.options]\n\nbinary_format/embed_pck=true\n';
const cleaned = withAndroidPreset(planted, opts);
ok(!/evil\.jks/.test(cleaned) && !/permissions\/internet/.test(cleaned), "an agent-written Android preset is stripped");
ok(/^\[preset\.1\]\n\nname="Linux"/m.test(cleaned) && /^\[preset\.2\]\n\nname="Android"/m.test(cleaned) && /^binary_format\/embed_pck=true$/m.test(cleaned), "other presets are kept and renumbered, ours is last");
ok((cleaned.match(/platform="Android"/g) ?? []).length === 1, "exactly one Android preset");
ok(withAndroidPreset("", opts).startsWith("[preset.0]\n\nname=\"Android\""), "no presets file: ours is preset.0");

console.log("project.godot patch");
const pg = readFileSync(join(here, "../../packages/agent/templates/blank/project.godot"), "utf8");
const patched = patchProjectGodot(pg, "landscape");
ok(/^\[rendering\]\n\ntextures\/vram_compression\/import_etc2_astc=true$/m.test(patched), "ETC2/ASTC import added under [rendering]");
ok(/^window\/handheld\/orientation=1$/m.test(patched) && !/orientation=0/.test(patched), "an existing orientation is kept");
ok(patchProjectGodot(patched, "landscape") === patched, "idempotent");
const noDisplay = "config_version=5\n\n[application]\n\nconfig/name=\"X\"\n";
const p2 = patchProjectGodot(noDisplay, "landscape");
ok(/\[display\]\n\nwindow\/handheld\/orientation=0/.test(p2) && /\[rendering\]\n\ntextures\/vram_compression\/import_etc2_astc=true/.test(p2), "missing sections are added; landscape = 0");
ok(/window\/handheld\/orientation=1/.test(patchProjectGodot(noDisplay, "portrait")), "portrait = 1");
ok(patchProjectGodot("[rendering]\n\ntextures/vram_compression/import_etc2_astc=false\n", "portrait").includes("import_etc2_astc=true"), "a false value is turned on");

console.log("keystore crypto");
const master = parseMasterKey(randomBytes(32).toString("hex"));
const other = parseMasterKey(randomBytes(32).toString("hex"));
ok(master?.length === 32 && parseMasterKey("abc") === null && parseMasterKey(undefined) === null && parseMasterKey("g".repeat(64)) === null, "a master key is 64 hex chars");
const keys = { current: { id: 1, key: master }, previous: [] };
const p12 = randomBytes(2800);
const password = newPassword();
ok(/^[A-Za-z0-9]{32}$/.test(password) && newPassword() !== password, "password: 32 letters and digits, random");
const blob = seal(keys, "projectA", { p12, password });
ok(blob[0] === 1 && blob.length === 1 + 12 + 16 + Buffer.byteLength(JSON.stringify({ p12: p12.toString("base64"), password })), "blob = keyId | nonce | tag | ciphertext");
const back = open(keys, "projectA", blob);
ok(back.p12.equals(p12) && back.password === password, "round trip");
ok(!seal(keys, "projectA", { p12, password }).equals(blob), "a fresh nonce every time");
const flipped = Buffer.from(blob);
flipped[40] ^= 1;
ok(throws(() => open(keys, "projectA", flipped)), "a flipped byte throws");
ok(throws(() => open(keys, "projectB", blob)), "another project's id (the AAD) throws");
ok(throws(() => open({ current: { id: 1, key: other }, previous: [] }, "projectA", blob)), "a wrong master key throws");
const wrongId = Buffer.from(blob);
wrongId[0] = 7;
ok(throws(() => open(keys, "projectA", wrongId)), "an unknown key id throws");
ok(open({ current: { id: 2, key: other }, previous: [{ id: 1, key: master }] }, "projectA", blob).password === password, "an older key id still opens (rotation)");
ok(throws(() => open(keys, "projectA", Buffer.alloc(10))), "a short blob throws");
const t1 = newToken();
ok(t1.length >= 40 && sameToken(t1, t1) && !sameToken(t1, newToken()) && !sameToken(t1, t1.slice(1)), "download tokens compare in constant time");

console.log("PNG parser and icon rules");
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const png = (w, h) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  const raw = Buffer.alloc((w * 4 + 1) * h);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
ok(pngInfo(png(512, 512))?.width === 512 && pngInfo(png(432, 936))?.height === 936, "width and height from IHDR");
ok(pngInfo(Buffer.from("not a png at all, really not")) === null && pngInfo(Buffer.alloc(0)) === null, "non-PNG refused");
ok(iconProblem(png(512, 512)) === null && iconProblem(png(1024, 1024)) === null, "512 and 1024 square ok");
ok(iconProblem(png(511, 511)) !== null, "511 refused");
ok(iconProblem(png(512, 600)) !== null, "not square refused");
ok(iconProblem(Buffer.from("JFIF")) !== null, "non-PNG refused");
ok(iconProblem(Buffer.concat([png(512, 512), Buffer.alloc(1 << 20)])) !== null, "over 1 MB refused");
for (const f of ["icon-192.png", "fg-432.png", "bg-432.png"]) {
  const info = pngInfo(readFileSync(join(here, "../../deploy/api/android/icons", f)));
  ok(info && info.width === Number(f.match(/(\d+)\.png$/)[1]) && info.width === info.height, `placeholder ${f} is ${info?.width}×${info?.height}`);
}

console.log("manifest check (the tamper detector)");
const expect = { format: "aab", packageName: "app.typeplay.cat_abcdefghij", versionCode: 3, versionName: "2.3", certSha256: "ab".repeat(32) };
const good = { package: expect.packageName, versionCode: 3, versionName: "2.3", minSdk: 24, targetSdk: 36, debuggable: false, abis: ["arm64-v8a"], permissions: [], certSha256: null, pageAlign16k: true, signed: false };
ok(mismatches(expect, good).length === 0, "a matching unsigned build passes");
const cases = {
  "another package": { package: "com.other.app" },
  "another version code": { versionCode: 4 },
  "another version name": { versionName: "2.4" },
  debuggable: { debuggable: true },
  "target SDK 35": { targetSdk: 35 },
  "an extra ABI": { abis: ["arm64-v8a", "armeabi-v7a"] },
  "no ABI": { abis: [] },
  "a permission": { permissions: ["android.permission.INTERNET"] },
  "no 16 KB alignment": { pageAlign16k: false },
};
for (const [name, change] of Object.entries(cases)) ok(mismatches(expect, { ...good, ...change }).length === 1, `${name}: one mismatch`);
ok(mismatches(expect, { ...good, package: "x.y", debuggable: true }).length === 2, "two problems: two reasons");
const signedGood = { ...good, signed: true, certSha256: expect.certSha256 };
ok(certMismatch(expect, signedGood) === null, "signed with the key's certificate passes");
ok(certMismatch(expect, { ...signedGood, certSha256: "cd".repeat(32) }) !== null, "another certificate fails");
ok(certMismatch(expect, good) !== null, "unsigned fails the certificate check");
ok(certMismatch({ ...expect, certSha256: "AB".repeat(32) }, signedGood) === null, "fingerprint case does not matter");
const checks = checksOf(expect, signedGood);
ok(checks.length === 8 && checks.every((c) => c.ok), "the checks list is all green for a good signed AAB");
ok(checks.find((c) => c.id === "format").text.includes(".aab") && checksOf({ ...expect, format: "apk" }, signedGood).find((c) => c.id === "format").text.includes(".apk"), "the format line names the file kind");
const bad = checksOf(expect, { ...signedGood, targetSdk: 34, debuggable: true, abis: ["x86"], pageAlign16k: false, permissions: ["android.permission.CAMERA"], versionCode: 9, certSha256: "00".repeat(32) });
ok(bad.filter((c) => !c.ok).map((c) => c.id).join() === "signed,target,arm64,pages16k,version,debuggable,permissions", "each problem turns its line red");
ok(bad.find((c) => c.id === "permissions").text.includes("CAMERA"), "the permissions line names them");

console.log("zip reader and ELF alignment");
const elf = (align) => {
  const b = Buffer.alloc(0x40 + 56 * 2);
  b.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1], 0);
  b.writeBigUInt64LE(0x40n, 0x20); // e_phoff
  b.writeUInt16LE(56, 0x36); // e_phentsize
  b.writeUInt16LE(2, 0x38); // e_phnum
  for (let i = 0; i < 2; i++) {
    const p = 0x40 + i * 56;
    b.writeUInt32LE(1, p); // PT_LOAD
    b.writeBigUInt64LE(BigInt(align), p + 48);
  }
  return b;
};
const archive = zip([
  { name: "base/lib/arm64-v8a/libgodot_android.so", data: elf(16384) },
  { name: "base/lib/arm64-v8a/libc++_shared.so", data: elf(65536) },
  { name: "base/manifest/AndroidManifest.xml", data: Buffer.from("<manifest/>") },
]);
const entries = zipEntries(archive);
ok(entries.length === 3 && abisOf(entries).join() === "arm64-v8a", "entries listed, ABIs from lib/<abi>/");
ok(zipRead(archive, entries[2]).toString() === "<manifest/>", "an entry inflates back");
ok(abisOf(zipEntries(zip([{ name: "lib/x86/a.so", data: elf(4096) }, { name: "lib/arm64-v8a/b.so", data: elf(4096) }]))).join() === "arm64-v8a,x86", "APK layout (lib/<abi>/), sorted");
ok(elfLoadAlign16k(elf(16384)) && elfLoadAlign16k(elf(65536)), "16 KB and 64 KB LOAD alignment pass");
ok(!elfLoadAlign16k(elf(4096)) && !elfLoadAlign16k(Buffer.from("not an elf")), "4 KB alignment and a non-ELF fail");
ok(throws(() => zipEntries(Buffer.alloc(100))), "not a zip throws");

console.log("the runner never sees keystores");
const runner = readFileSync(join(here, "runner/runner.mjs"), "utf8");
const secret = new RegExp(runner.match(/const SECRET = \/(.*)\/;/)[1]);
for (const k of ["ANDROID_KEY_MASTER", "ANDROID_KEY_MASTER_PREV", "GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD", "SIGNER_SOCKET", "R2_SECRET_ACCESS_KEY"]) ok(secret.test(k), `runner refuses to start with ${k}`);
for (const k of ["JAVA_HOME", "ANDROID_HOME", "GRADLE_SEED", "ANDROID_ICONS"]) ok(!secret.test(k), `runner keeps its own ${k}`);
const compose = readFileSync(join(here, "../../deploy/api/compose.yaml"), "utf8");
const runnerBlock = compose.slice(compose.indexOf("\n  runner:"), compose.indexOf("\n  signer:"));
ok(!/ANDROID_KEY_MASTER|SIGNER_SOCKET|exports:/.test(runnerBlock), "the runner's compose block has no master key, signer socket or exports volume");
const signerBlock = compose.slice(compose.indexOf("\n  signer:"), compose.indexOf("\n  caddy:"));
ok(/network_mode: none/.test(signerBlock) && /read_only: true/.test(signerBlock) && !/api\.env|ANDROID_KEY_MASTER|\.\/data:/.test(signerBlock), "the signer has no network, a read-only root, no secrets file, no /data");

console.log("failure classifier");
ok(classifyFailure("ERROR: A valid Java SDK path is required in Editor Settings.") === "toolchain", "a missing JDK is ours");
ok(classifyFailure("Unable to find Android SDK build-tools' apksigner command.") === "toolchain", "a missing apksigner is ours");
ok(classifyFailure("SCRIPT ERROR: Parse Error: Identifier not found\n   at: GDScript::reload (res://main.gd:12)") === "game", "a script error is the game's");
ok(classifyFailure("ETC2/ASTC texture compression is required for Android export.") === "game", "the ETC2 message counts as the game's (the patch should prevent it)");
ok(classifyFailure("Building of Android project failed, check output for the error:\nBUILD FAILED") === "gradle", "a Gradle failure is the packaging step");
ok(classifyFailure("") === "gradle", "nothing recognisable: the packaging step");

console.log("phone link: short in every store");
const linkToken = newToken();
const shortLink = phoneLinkUrl("https://api.typeplay.app", linkToken);
ok(shortLink === `https://api.typeplay.app/android/dl/${linkToken}` && /^https:\/\/api\.typeplay\.app\/android\/dl\/[A-Za-z0-9_-]{43}$/.test(shortLink), "the link is <API>/android/dl/<43-character token>");
ok(shortLink.length === 79 && shortLink.length < 100, `…${shortLink.length} characters, far under the QR encoder's 213 bytes`);
ok(phoneLinkUrl("https://api.typeplay.app/", linkToken) === shortLink && phoneLinkUrl("https://api.typeplay.app//", linkToken) === shortLink, "a trailing slash on the API address is dropped");
ok(phoneLinkUrl("http://127.0.0.1:3002", linkToken) === `http://127.0.0.1:3002/android/dl/${linkToken}`, "the dev address works the same");
Object.assign(config.r2, { accountId: "fakeaccount", accessKeyId: "FAKEKEYID", secretAccessKey: "fakesecret" });
const longLink = r2PresignGet("android/p1/p1-a1.apk", { bucket: "typeplay-exports", expiresSec: 600, filename: "a-cat-that-jumps-over-boxes-v1.apk" });
ok(longLink.length > 400 && longLink.length > shortLink.length * 5, `…a presigned storage URL is ${longLink.length} characters: why the link is not that`);
ok(PRESIGN_MAX_SEC === 300 && config.android.linkSeconds === 600, "a link lives 10 minutes; the URL behind its redirect at most 5");
const t0 = 1_800_000_000_000;
ok(presignSeconds(t0 + 600_000, t0) === 300, "a fresh link: the presigned URL lives 5 minutes");
ok(presignSeconds(t0 + 120_000, t0) === 120 && presignSeconds(t0 + 299_999, t0) === 299, "…cut to what is left of the link's life");
ok(presignSeconds(t0 + 400, t0) === 1 && presignSeconds(t0 - 5_000, t0) === 1, "…never below 1 second");
ok(presignSeconds(t0 + 36_000_000, t0) === 300, "…never above 5 minutes");

console.log("phone link: what it leads to, refused when expired or gone (the service, stubbed database)");
const rejects = async (fn) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e;
  }
};
const aRow = (o = {}) => ({ id: "p1-a1", projectId: "p1", status: "done", path: "android/p1/p1-a1.apk", format: "apk", versionCode: 1, ...o });
let dbRow = aRow();
const service = new AndroidService(
  { androidBuild: { findFirst: async () => dbRow, findUnique: async () => dbRow } },
  {},
  {},
  { owned: async () => ({ id: "p1", name: "A cat that jumps over boxes" }) },
);
const owner = { id: "u1", plan: "medium" };
const tokenOf = (l) => l.url.split("/").pop();
const expiresOf = (target) => Number(new URL(target.redirect).searchParams.get("X-Amz-Expires"));
const realNow = Date.now;
let clock = realNow();
Date.now = () => clock; // the service reads the time through Date.now: a clock we move by hand
try {
  const start = clock;
  const l1 = await service.link(owner, "p1", "p1-a1");
  ok(l1.url === phoneLinkUrl(config.publicUrl, tokenOf(l1)) && l1.url.length < 100, "link(): the short API link, although the file is in R2");
  ok(Date.parse(l1.expiresAt) - start === 600_000, "…good for 10 minutes");
  const l1b = await service.link(owner, "p1", "p1-a1");
  ok(tokenOf(l1b) !== tokenOf(l1), "…a token of its own each time");
  const hop1 = await service.downloadByToken(tokenOf(l1));
  const u1 = new URL(hop1.redirect);
  ok("redirect" in hop1 && u1.host === "fakeaccount.r2.cloudflarestorage.com" && u1.pathname === "/typeplay-exports/android/p1/p1-a1.apk", "opened: a redirect to the object in the exports bucket");
  ok(expiresOf(hop1) === 300 && u1.searchParams.get("X-Amz-Algorithm") === "AWS4-HMAC-SHA256" && /^[0-9a-f]{64}$/.test(u1.searchParams.get("X-Amz-Signature") ?? ""), "…a presigned URL good for 5 minutes");
  ok(u1.searchParams.get("response-content-disposition") === 'attachment; filename="a-cat-that-jumps-over-boxes-v1.apk"', "…that saves as <game>-v<build>.apk");
  clock = start + 8 * 60_000;
  ok(expiresOf(await service.downloadByToken(tokenOf(l1))) === 120, "8 minutes in: the URL is made fresh and lives only the 2 minutes the link has left");
  clock = start + 599_500;
  ok(expiresOf(await service.downloadByToken(tokenOf(l1))) === 1, "half a second before the end: 1 second, never past the link");
  clock = start + 600_001;
  const expired = await rejects(() => service.downloadByToken(tokenOf(l1)));
  ok(expired?.status === 404 && expired.code === "not_found" && /expired/.test(expired.message), "past 10 minutes: refused, 404 'this link has expired'");
  ok((await rejects(() => service.downloadByToken(tokenOf(l1b))))?.status === 404, "…the other token too");
  ok((await rejects(() => service.downloadByToken("x".repeat(43))))?.status === 404 && (await rejects(() => service.downloadByToken("")))?.status === 404, "an unknown token or none: 404");

  clock = start + 700_000;
  const l2 = await service.link(owner, "p1", "p1-a1");
  dbRow = aRow({ status: "expired", path: null }); // the 30-day sweep took the file within the link's ten minutes
  const swept = await rejects(() => service.downloadByToken(tokenOf(l2)));
  ok(swept?.status === 404 && /file is gone/.test(swept.message), "the build expired meanwhile: refused, 404 'the file is gone'");
  dbRow = aRow({ projectId: "p2" });
  ok((await rejects(() => service.downloadByToken(tokenOf(l2))))?.status === 404, "a link is for one game's build: a row of another game is refused");
  dbRow = aRow();
  ok("redirect" in (await service.downloadByToken(tokenOf(l2))), "…and the same link works while the build is there");
  dbRow = null;
  ok((await rejects(() => service.downloadByToken(tokenOf(l2))))?.status === 404, "the game deleted meanwhile (the row is gone): 404");

  dbRow = aRow({ path: "data/android/p1/p1-a1.apk" }); // the folder store: nothing to presign, the API streams (the e2e reads real bytes); a missing file is a 404
  const l3 = await service.link(owner, "p1", "p1-a1");
  ok(l3.url.length < 100 && (await rejects(() => service.downloadByToken(tokenOf(l3))))?.status === 404, "folder store: no redirect, and a file that is not there is a 404");
  dbRow = aRow({ status: "failed", path: null });
  ok((await rejects(() => service.link(owner, "p1", "p1-a1")))?.status === 404, "no link for a build that has no file");
} finally {
  Date.now = realNow;
}

console.log("a Stop against the queue: a row is claimed or stopped in one step, never both");
{
  const calls = [];
  const emitted = [];
  let row = { id: "p1-a4", projectId: "p1", status: "queued", format: "apk", versionCode: 4, versionName: "1.4", versionN: 1, icon: "placeholder", godotVersion: "4", queuedAt: new Date(), checks: null };
  let claimWon = false; // true: the queue claimed the row between the Stop's read and its write
  const prismaStub = {
    androidBuild: {
      findFirst: async () => row,
      findUniqueOrThrow: async () => row,
      count: async () => 0,
      updateMany: async (q) => {
        calls.push(q);
        if (claimWon || row.status !== q.where.status) return { count: 0 };
        row = { ...row, ...q.data };
        return { count: 1 };
      },
    },
    androidApp: { findUnique: async () => ({ packageName: "app.typeplay.cat_p1", key: { certSha256: "ab".repeat(32), blob: Buffer.alloc(0) }, project: { orientation: "portrait" } }) },
    version: { findUnique: async () => ({ buildId: "p1-v1" }) },
  };
  const stopper = new AndroidService(prismaStub, {}, { emit: (_id, e) => emitted.push(e) }, { owned: async () => ({ id: "p1" }) });
  const idle = { projectId: "p1", handle: null, cancelled: false, timedOut: false, finished: Promise.resolve() };
  stopper.running.set("p1-a4", idle);
  const stopped = await stopper.cancelBuild({ id: "u1" }, "p1", "p1-a4");
  ok(stopped.status === "cancelled" && stopped.failMessage === "Stopped." && calls[0].where.status === "queued" && calls[0].data.status === "cancelled", "a queued build is stopped with one conditional update (only while it is still queued)");
  ok(emitted.length === 1 && emitted[0].type === "android" && emitted[0].build.status === "cancelled" && idle.cancelled === false, "…announced once, and no job was touched");
  // The queue got there first: the row is `running` by the time the Stop writes; the Stop goes to the job instead.
  row = { ...row, status: "queued", failMessage: null };
  claimWon = true;
  let killed = 0;
  const live = { projectId: "p1", handle: { kill: () => killed++ }, cancelled: false, timedOut: false, finished: Promise.resolve() };
  stopper.running.set("p1-a4", live);
  emitted.length = 0;
  await stopper.cancelBuild({ id: "u1" }, "p1", "p1-a4");
  ok(live.cancelled === true && killed === 1 && emitted.length === 0, "a build the queue claimed meanwhile: the job is stopped (killed once), the row is not overwritten");
  // And the other side: the job starts only if its row is still queued.
  row = { ...row, status: "cancelled" };
  calls.length = 0;
  emitted.length = 0;
  claimWon = false;
  await stopper.execute(row, { projectId: "p1", handle: null, cancelled: false, timedOut: false, finished: Promise.resolve() });
  ok(calls.length === 1 && calls[0].where.status === "queued" && calls[0].data.status === "running" && emitted.length === 0 && row.status === "cancelled", "a row stopped after the queue picked it up is not started, and stays stopped");
}

console.log(failures ? `${failures} FAILED` : "all good");
process.exit(failures ? 1 : 0);
