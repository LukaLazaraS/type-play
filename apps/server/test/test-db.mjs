// The automated tests' database (docs/environments.md): one of the run's own on this PC's Postgres, never the live one
// and never another run's (scripts/test-run.mjs). Every test script calls this first: the autotest env files are read
// (.env.autotest before the root .env, for the secrets), the server is started if needed, typeplay_autotest_<script>_<id>
// is made from this checkout's migrations, and DATABASE_URL and DIRECT_URL point at it, so the APIs and admin CLIs the
// test starts use it too. It is dropped when the test's process exits.
import { basename, resolve } from "node:path";
import { runDatabase } from "../../../scripts/test-run.mjs";

export async function useTestDatabase(label = basename(process.argv[1] ?? "test", ".mjs")) {
  const root = resolve(import.meta.dirname, "../../..");
  process.env.TYPEPLAY_ENV = "autotest";
  const { assertLocalDatabase, loadEnvFiles } = await import("../dist/env-files.js");
  loadEnvFiles(root, "autotest");
  const { name, url } = await runDatabase(label);
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  assertLocalDatabase(process.env.DATABASE_URL, "autotest");
  console.log(`this run's database: ${name}`);
  return name;
}
