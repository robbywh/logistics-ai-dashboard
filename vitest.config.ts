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
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      // Scoped to lib/ — the pure-function unit-test layer `npm run
      // test:coverage` runs. Route handlers (app/api/**) are exercised by
      // the integration layer instead (real DB required, see README
      // "Testing"), not included here to keep coverage DB-free and fast.
      include: ["lib/**/*.ts"],
      exclude: [
        "lib/**/*.test.ts",
        "lib/ai/**",
        "lib/prisma.ts",
        "lib/query-log.ts",
        "lib/orders.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
