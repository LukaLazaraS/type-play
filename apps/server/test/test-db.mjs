// The automated tests' database (docs/environments.md): typeplay_autotest on this PC's Postgres (scripts/local-db.mjs),
// never the live one. Every test script calls this first: the autotest env files are read (.env.autotest before the root
// .env, so the APIs a test starts inherit that database too), the server is started if needed, and the database is brought up to
// date and emptied.
import { join, resolve } from "node:path";
import { freshAutotestDatabase } from "../../../scripts/local-db.mjs";

export async function useTestDatabase() {
  const root = resolve(import.meta.dirname, "../../..");
  process.env.TYPEPLAY_ENV = "autotest";
  const { assertLocalDatabase, loadEnvFiles } = await import("../dist/env-files.js");
  loadEnvFiles(root, "autotest");
  assertLocalDatabase(process.env.DATABASE_URL, "autotest");
  if (!/\/typeplay_autotest(\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("the tests run on typeplay_autotest only (.env.autotest)");
  await freshAutotestDatabase();
  return join(root, ".env.autotest");
}
