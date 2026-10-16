// Root ESLint flat config for the workspace.
//
// Covers artifacts/api-server, artifacts/web, lib/* and scripts.
// artifacts/mobile keeps its own "expo lint" script and is ignored here.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "artifacts/mobile/**",
    "artifacts/web/playwright-report/**",
    "artifacts/web/test-results/**",
    "lib/db/**",
    "scripts/src/hello.ts",
    "supabase/**",
    "docs/**",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      // The only plain JavaScript files in scope are Node build scripts.
      globals: globals.node,
    },
    rules: {
      // Downgraded: 28 existing uses in 10 files. Follow-up: type them, then restore "error".
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow the `{ omitted: _x, ...rest }` pattern used to drop fields from a result.
      "@typescript-eslint/no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  // Existing findings, downgraded per file so this config lands without source edits.
  // Follow-up: fix each finding and delete its block.
  {
    files: ["artifacts/api-server/src/routes/daily.ts", "artifacts/api-server/src/routes/game.ts"],
    rules: { "prefer-const": "warn" },
  },
  {
    files: ["artifacts/web/src/hooks/use-toast.ts"],
    rules: { "@typescript-eslint/no-unused-vars": "warn" },
  },
  {
    files: ["lib/share-intent/src/index.test.ts"],
    rules: { "@typescript-eslint/ban-ts-comment": "warn" },
  }
);
