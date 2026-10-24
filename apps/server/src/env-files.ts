// Which env files a process reads, and the rule that this PC uses only local databases (docs/environments.md).
// The root .env (git-ignored) holds the live values: deploy reads it, and so does the admin CLI's explicit live mode.
// Development and the automated tests on this PC get their databases from committed, secret-free files
// (.env.development, .env.autotest) that come first, so the live database is never the default here. The first file to set a key wins, and
// the process's own environment wins over every file. The live server reads none of this: NODE_ENV=production and its
// container's environment.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * development: `npm run dev`, the local site, the admin CLI; autotest: the automated test scripts; live: `npm run
 * admin:live`. ("test" is the online test environment for inner testers, later: a server of its own, like production.)
 */
export type EnvMode = "production" | "live" | "autotest" | "development";

export const ENV_FILES: Record<EnvMode, string[]> = {
  production: [".env"],
  live: [".env"],
  autotest: [".env.autotest.local", ".env.autotest", ".env"],
  development: [".env.local", ".env.development", ".env"],
};

/** The mode from the environment: NODE_ENV=production on the live server, TYPEPLAY_ENV=live|autotest set by the scripts. */
export function envMode(env: NodeJS.ProcessEnv = process.env): EnvMode {
  if (env.NODE_ENV === "production") return "production";
  if (env.TYPEPLAY_ENV === "live") return "live";
  if (env.TYPEPLAY_ENV === "autotest" || env.NODE_ENV === "test") return "autotest";
  return "development";
}

/** Loads the mode's files that exist into process.env; returns every key they define (kept from the game agent). */
export function loadEnvFiles(root: string, mode: EnvMode = envMode()): string[] {
  const keys = new Set<string>();
  for (const name of ENV_FILES[mode]) {
    const file = join(root, name);
    if (!existsSync(file)) continue;
    for (const m of readFileSync(file, "utf8").matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) keys.add(m[1]);
    process.loadEnvFile(file);
  }
  return [...keys];
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** This PC's development and tests only ever use a local database: anything else stops the process (live mode excepted). */
export function assertLocalDatabase(url: string | undefined, mode: EnvMode = envMode()) {
  if (mode === "production" || mode === "live" || !url) return;
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    // not a URL: refused below
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `DATABASE_URL points at ${host || "something that isn't a URL"}, not a database on this PC: ${mode} uses this PC's Postgres ` +
        `(.env.${mode === "autotest" ? "autotest" : "development"}; docs/environments.md). For the live database use npm run admin:live.`,
    );
  }
}
