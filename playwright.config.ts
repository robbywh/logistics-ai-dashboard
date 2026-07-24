import { defineConfig, devices } from "@playwright/test";

// A dedicated port, distinct from the usual `npm run dev` on 3000, so E2E
// runs never collide with a dev server the developer already has open.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Dashboard specs read the real (seeded) database; Ask AI specs mock
  // /api/query and /api/query/history at the browser network layer (see
  // tests/e2e/ask.spec.ts), so no OPENAI_API_KEY is needed to run this suite.
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
