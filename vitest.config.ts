import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit the real database (see tests/integration/) and
    // need DATABASE_URL from .env, same as prisma/seed.ts.
    setupFiles: ["dotenv/config"],
    // tests/e2e/ is Playwright's tree (different test API — `test()` from
    // @playwright/test, not vitest) and must never be picked up here.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
