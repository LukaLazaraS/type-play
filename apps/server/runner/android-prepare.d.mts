// Types for android-prepare.mjs, so the API (src/android/) shares its package-name rules and
// version-name scheme with the job that writes the preset (one source for both).
export const PRESET_NAME: string;
export const PACKAGE_RE: RegExp;
export const PACKAGE_MAX: number;
export const RESERVED_PREFIXES: string[];
export const APP_NAME_MAX: number;
export function packageNameProblem(name: unknown): string | null;
export function defaultPackageName(gameName: string, projectId: string): string;
export function versionNameOf(versionN: number, versionCode: number): string;
export interface PresetOptions {
  format: "apk" | "aab";
  packageName: string;
  appName: string;
  versionCode: number;
  versionName: string;
}
export function androidPreset(n: number, o: PresetOptions): string;
export function withAndroidPreset(cfg: string, o: PresetOptions): string;
export function patchProjectGodot(text: string, orientation: "portrait" | "landscape"): string;
