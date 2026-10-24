// Prisma CLI config (migrations, generate). Migrations use DIRECT_URL (Supabase session pooler on the live server;
// this PC's Postgres in development and tests: src/env-files.ts); the app itself connects with DATABASE_URL (src/prisma.ts).
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig } from "prisma/config";
import { assertLocalDatabase, loadEnvFiles } from "./src/env-files.ts";

// The repo root (the folder with the env files), found by walking up from here.
for (let dir = resolve("."); ; dir = dirname(dir)) {
  if (existsSync(join(dir, ".env")) || existsSync(join(dir, ".env.development"))) {
    loadEnvFiles(dir);
    break;
  }
  if (dirname(dir) === dir) break;
}
assertLocalDatabase(process.env.DIRECT_URL);

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Empty during `prisma generate` without an env file (CI): generate needs no database.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
