import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests hit the real database (see tests/integration/) and
    // need DATABASE_URL from .env, same as prisma/seed.ts.
    setupFiles: ["dotenv/config"],
    // Integration test files write/read the same shared real database
    // concurrently otherwise — e.g. query-history.test.ts's pagination
    // test asserting an exact page boundary would flake if query-route
    // .test.ts's rows land in between. Sequential execution trades a
    // little wall-clock time for a real database's lack of test isolation.
    fileParallelism: false,
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
