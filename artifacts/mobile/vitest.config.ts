import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const root = dirname(fileURLToPath(import.meta.url));

// Mirrors the tsconfig.json "paths" so tests resolve "@/..." imports the same
// way Metro and tsc do. Tests that need a fake still declare it with vi.mock.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/assets\//, replacement: `${resolve(root, "assets")}/` },
      { find: /^@\//, replacement: `${resolve(root, "src")}/` },
    ],
  },
});
