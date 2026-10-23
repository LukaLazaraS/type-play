// Prisma CLI config (migrations, generate). Migrations use DIRECT_URL (Supabase session pooler);
// the app itself connects with DATABASE_URL (transaction pooler) in src/prisma.ts.
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { defineConfig } from "prisma/config";

// The repo's root .env (git-ignored), found by walking up from here.
for (let dir = resolve("."); ; dir = dirname(dir)) {
  if (existsSync(join(dir, ".env"))) {
    process.loadEnvFile(join(dir, ".env"));
    break;
  }
  if (dirname(dir) === dir) break;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // Empty during `prisma generate` without a .env (CI): generate needs no database.
  datasource: { url: process.env.DIRECT_URL ?? "" },
});
