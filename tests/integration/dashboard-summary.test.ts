import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { GET } from "../../app/api/dashboard/summary/route";

/**
 * Integration layer: exercises the real route handler — Prisma fetch,
 * Accelerate cache, and computeDashboardSummary() wired together — against
 * whatever DATABASE_URL is configured, instead of calling
 * computeDashboardSummary() directly over fixture data (that's the unit
 * layer, see lib/dashboard.test.ts). Requires the seeded dataset: run
 * `npm run db:seed` first if this fails with unexpected totals.
 */
describe("GET /api/dashboard/summary (integration)", () => {
  it("returns full-dataset KPIs computed from the real database", async () => {
    const res = await GET(new NextRequest("http://localhost/api/dashboard/summary"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.range).toEqual({ from: "2025-01-01", to: "2025-12-30" });
    expect(body.kpis.totalOrders).toBe(400);
    expect(body.kpis.delivered).toBe(304);
    expect(body.kpis.delayed).toBe(66);
  });

  it("applies a ?from=&to= query range", async () => {
    const res = await GET(
      new NextRequest("http://localhost/api/dashboard/summary?from=2025-01-01&to=2025-01-31"),
    );
    const body = await res.json();

    expect(body.range).toEqual({ from: "2025-01-01", to: "2025-01-31" });
    expect(body.kpis.totalOrders).toBe(75);
  });
});
