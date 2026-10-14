import { defineConfig, devices } from "@playwright/test";

/**
 * E2E tests run at a phone viewport against the local dev stack:
 *   1. supabase start            (local auth + db)
 *   2. preview servers           (api on :8081, vite on :5173)
 * They hit the real Wikipedia API — no article mocking.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  fullyParallel: false,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    ...devices["iPhone 13"],
    trace: "retain-on-failure",
  },
});
