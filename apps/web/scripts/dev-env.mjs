// The env the screenshot scripts share with the API they drive (docs/environments.md): this PC's development database
// (typeplay_dev, from .env.development), never the live one. Needs the API built (npm run build -w @typeplay/server).
import { join } from "node:path";
import { freePorts, lock, runDatabase } from "../../../scripts/test-run.mjs";

const root = join(import.meta.dirname, "../../..");

export async function useDevEnv() {
  const { assertLocalDatabase, loadEnvFiles } = await import("../../server/dist/env-files.js");
  loadEnvFiles(root, "development");
  assertLocalDatabase(process.env.DATABASE_URL, "development");
}

/**
 * For a walk-through that starts a stack of its own (shot-beta, shot-compare, shot-platform, shot-queue), so any number
 * of them, from any checkout, run at once beside the local site and the tests (scripts/test-run.mjs): the env above,
 * then a database of the run's own (typeplay_autotest_shot_<name>_<id>, dropped at the end) that the API it starts and
 * the admin CLI use instead of typeplay_dev, and `count` ports picked free. First it waits for this checkout's `next dev`
 * to be its own: two walk-throughs in one checkout would share tsconfig.json (`next dev` writes its type folders into
 * it, and each puts it back as it found it) and, the same one twice, its .next folder. Other checkouts never wait.
 */
export async function useOwnStack(name, count) {
  await useDevEnv();
  await ownNextDev();
  const { url } = await runDatabase(`shot_${name}`);
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  return freePorts(count);
}

/** This checkout's `next dev` for this walk-through alone, until it exits (see above); held, it returns at once. */
export const ownNextDev = () => lock(`next dev in ${join(root, "apps/web")}`);
