// The env the screenshot scripts share with the API they drive (docs/environments.md): this PC's development database
// (typeplay_dev, from .env.development), never the live one. Needs the API built (npm run build -w @typeplay/server).
import { join } from "node:path";

export async function useDevEnv() {
  const root = join(import.meta.dirname, "../../..");
  const { assertLocalDatabase, loadEnvFiles } = await import("../../server/dist/env-files.js");
  loadEnvFiles(root, "development");
  assertLocalDatabase(process.env.DATABASE_URL, "development");
}
