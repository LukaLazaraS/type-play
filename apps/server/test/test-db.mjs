// The tests' database (docs/environments.md): typeplay_test on this PC's Postgres (scripts/local-db.mjs), never the
// live one. Every test script calls this first: the test env files are read (.env.test before the root .env, so the
// APIs a test starts inherit the test database too), the server is started if needed, and the database is brought up to
// date and emptied.
import { join, resolve } from "node:path";
import { freshTestDatabase } from "../../../scripts/local-db.mjs";

export async function useTestDatabase() {
  const root = resolve(import.meta.dirname, "../../..");
  process.env.TYPEPLAY_ENV = "test";
  const { assertLocalDatabase, loadEnvFiles } = await import("../dist/env-files.js");
  loadEnvFiles(root, "test");
  assertLocalDatabase(process.env.DATABASE_URL, "test");
  if (!/\/typeplay_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("the tests run on typeplay_test only (.env.test)");
  await freshTestDatabase();
  return join(root, ".env.test");
}
