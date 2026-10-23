// What a build must look like before it is signed, and the checks list the user sees
// (docs/android-export-design.md §7, §11). Pure: the signer refuses to sign on a mismatch, the
// API stores the list on the build row, the unit test covers each mismatch kind.
import type { AndroidCheck } from "@typeplay/shared";

/** What the tools read out of the file (inspect.json on the build row, `checks` on the API). */
export interface Inspect {
  package: string;
  versionCode: number;
  versionName: string;
  minSdk: number;
  targetSdk: number;
  debuggable: boolean;
  abis: string[];
  permissions: string[];
  /** Lowercase hex, no colons; null before signing. */
  certSha256: string | null;
  pageAlign16k: boolean;
  signed: boolean;
}

/** What the API asked for (the build row) and the key it signs with. */
export interface Expected {
  format: "apk" | "aab";
  packageName: string;
  versionCode: number;
  versionName: string;
  /** The upload key's certificate; checked only after signing. */
  certSha256?: string;
}

/** Play's rule from 2026-08-31 (FACT F54); Godot 4.7.2's default (F22). */
export const MIN_TARGET_SDK = 36;
export const REQUIRED_ABIS = ["arm64-v8a"];
/** A plain TypePlay game asks for nothing; permissions arrive only with features that need them (deferred). */
export const ALLOWED_PERMISSIONS: readonly string[] = [];

/** The reasons a file must not be signed (empty = sign it). Checked on the unsigned file. */
export function mismatches(expect: Expected, i: Inspect): string[] {
  const out: string[] = [];
  if (i.package !== expect.packageName) out.push(`package ${i.package} instead of ${expect.packageName}`);
  if (i.versionCode !== expect.versionCode) out.push(`version code ${i.versionCode} instead of ${expect.versionCode}`);
  if (i.versionName !== expect.versionName) out.push(`version name "${i.versionName}" instead of "${expect.versionName}"`);
  if (i.debuggable) out.push("debuggable");
  if (!(i.targetSdk >= MIN_TARGET_SDK)) out.push(`target SDK ${i.targetSdk} (needs ${MIN_TARGET_SDK})`);
  if (i.abis.join() !== REQUIRED_ABIS.join()) out.push(`ABIs ${i.abis.join(", ") || "none"} instead of ${REQUIRED_ABIS.join(", ")}`);
  const extra = i.permissions.filter((p) => !ALLOWED_PERMISSIONS.includes(p));
  if (extra.length) out.push(`permissions ${extra.join(", ")}`);
  if (!i.pageAlign16k) out.push("native libraries not aligned to 16 KB pages");
  return out;
}

/** After signing: the certificate must be the game's upload key. */
export function certMismatch(expect: Expected, i: Inspect): string | null {
  if (!i.signed || !i.certSha256) return "not signed";
  if (expect.certSha256 && i.certSha256.toLowerCase() !== expect.certSha256.toLowerCase()) return "signed with a different certificate";
  return null;
}

/** The checks list the Hub shows, each green or with one sentence. */
export function checksOf(expect: Expected, i: Inspect): AndroidCheck[] {
  const keyOk = certMismatch(expect, i) === null;
  const targetOk = i.targetSdk >= MIN_TARGET_SDK;
  const abiOk = i.abis.join() === REQUIRED_ABIS.join();
  const perms = i.permissions.filter((p) => !ALLOWED_PERMISSIONS.includes(p));
  return [
    { id: "format", ok: true, text: expect.format === "aab" ? "Play package (.aab)" : "Phone package (.apk): Google Play takes the .aab" },
    { id: "signed", ok: keyOk, text: keyOk ? "Signed with your upload key, not a debug key" : "Not signed with your upload key" },
    { id: "target", ok: targetOk, text: targetOk ? `Targets Android 16 (API ${i.targetSdk})` : `Targets API ${i.targetSdk}; Google Play needs ${MIN_TARGET_SDK} or higher` },
    { id: "arm64", ok: abiOk, text: abiOk ? "64-bit (arm64)" : `Built for ${i.abis.join(", ") || "no architecture"}` },
    { id: "pages16k", ok: i.pageAlign16k, text: i.pageAlign16k ? "16 KB pages" : "Native libraries are not aligned to 16 KB pages" },
    { id: "version", ok: i.versionCode === expect.versionCode, text: i.versionCode === expect.versionCode ? `Build number ${i.versionCode}, higher than the last` : `Build number ${i.versionCode} instead of ${expect.versionCode}` },
    { id: "debuggable", ok: !i.debuggable, text: i.debuggable ? "Debuggable: Google Play refuses it" : "Not debuggable" },
    { id: "permissions", ok: !perms.length, text: perms.length ? `Asks for ${perms.join(", ")}` : "Asks for no permissions" },
  ];
}
