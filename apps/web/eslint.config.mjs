import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import uiOnly from "./eslint/ui-only.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Every UI piece exists once, in src/components/ui (DESIGN.md "Components"): no copy of one anywhere else.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**"],
    plugins: { typeplay: { rules: { "ui-only": uiOnly } } },
    rules: { "typeplay/ui-only": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Godot's exported engine and the dev scripts are not app code.
    "games/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
