import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrdersCsv } from "../prisma/csv";
import { executeQueryAnalytics, type QueryAnalyticsInput } from "./query-dsl";

const csvPath = path.join(
  __dirname,
  "..",
  "docs",
  "data",
  "mock_logistics_data.csv",
);
const orders = parseOrdersCsv(fs.readFileSync(csvPath, "utf-8"));

describe("executeQueryAnalytics — REQUIREMENTS §4.2 example questions", () => {
  it('"Show delayed orders by week for the last 3 months"', () => {
    const result = executeQueryAnalytics(orders, {
      metric: "count",
      groupBy: "week",
      filters: { status: "DELAYED", relativeDateRange: "last_3_months" },
    });

    expect(result.chartType).toBe("line");
    expect(result.dateRange).toEqual({ from: "2025-09-30", to: "2025-12-30" });
    const total = result.data.reduce((sum, row) => sum + row.value, 0);
    expect(total).toBe(10); // independently hand-calculated
  });

  it('"Which carrier has the highest delay rate?"', () => {
    const result = executeQueryAnalytics(orders, {
      metric: "delayRate",
      groupBy: "carrier",
    });

    expect(result.chartType).toBe("bar");
    expect(result.data[0]).toEqual({ label: "GLS", value: expect.closeTo(0.375, 3) });
    // sorted descending by delay rate
    const values = result.data.map((d) => d.value);
    expect(values).toEqual([...values].sort((a, b) => b - a));
  });

  it('"How many orders were delivered late last month?"', () => {
    const result = executeQueryAnalytics(orders, {
      metric: "count",
      filters: { status: "DELAYED", relativeDateRange: "last_month" },
    });

    expect(result.chartType).toBe("stat");
    expect(result.data).toEqual([{ label: "count", value: 3 }]); // independently hand-calculated
  });
});

// Date-anchor resolution itself (all 7 relative-range keys, UTC-day
// normalization) is unit-tested in its own file: date-anchor.test.ts.

describe("executeQueryAnalytics — additional metrics", () => {
  it("computes avgDeliveryDays matching the dashboard's definition", () => {
    const result = executeQueryAnalytics(orders, { metric: "avgDeliveryDays" });
    expect(result.data[0].value).toBeCloseTo(3.8297297297, 6);
  });

  it("applies a category filter", () => {
    const result = executeQueryAnalytics(orders, {
      metric: "count",
      filters: { category: "CRAYON" },
    });
    expect(result.data[0].value).toBe(69); // matches known CRAYON row count
  });

  it("returns zero, not NaN, when no orders match", () => {
    const result = executeQueryAnalytics(orders, {
      metric: "delayRate",
      filters: { dateFrom: "2030-01-01", dateTo: "2030-12-31" },
    });
    expect(result.data[0].value).toBe(0);
  });

  it("returns zero avgDeliveryDays, not NaN, when no orders have a completed duration", () => {
    const result = executeQueryAnalytics(orders, {
      metric: "avgDeliveryDays",
      filters: { dateFrom: "2030-01-01", dateTo: "2030-12-31" },
    });
    expect(result.data[0].value).toBe(0);
  });

  it("applies a carrier filter", () => {
    const result = executeQueryAnalytics(orders, {
      metric: "count",
      filters: { carrier: "DHL" },
    });
    // Total DHL rows regardless of status (63) — not the dashboard's
    // completed-only carrier breakdown total (58, see dashboard.test.ts),
    // since this is an unfiltered `count` metric.
    expect(result.data[0].value).toBe(63);
  });

  it("applies a region filter", () => {
    const result = executeQueryAnalytics(orders, {
      metric: "count",
      filters: { region: "UK" },
    });
    expect(result.data[0].value).toBe(54); // matches known UK row count
  });
});

// Figures below were computed independently of executeQueryAnalytics (plain
// array filtering over the parsed CSV — see the comment on each) so these
// tests aren't just checking the code agrees with itself.
describe("executeQueryAnalytics — every groupBy dimension", () => {
  it("groupBy: day buckets by calendar day", () => {
    const result = executeQueryAnalytics(orders, { metric: "count", groupBy: "day" });
    expect(result.chartType).toBe("line");
    expect(result.data).toHaveLength(233); // distinct order days in the CSV
    expect(result.data.find((d) => d.label === "2025-01-01")?.value).toBe(7);
    // sorted ascending by day, unlike the categorical dimensions below
    const labels = result.data.map((d) => d.label);
    expect(labels).toEqual([...labels].sort());
  });

  it("groupBy: month buckets by calendar month", () => {
    const result = executeQueryAnalytics(orders, { metric: "count", groupBy: "month" });
    expect(result.chartType).toBe("line");
    expect(result.data).toHaveLength(12);
    expect(result.data.find((d) => d.label === "2025-01")?.value).toBe(75);
  });

  it("groupBy: region breaks down by the 5 known regions", () => {
    const result = executeQueryAnalytics(orders, { metric: "count", groupBy: "region" });
    expect(result.chartType).toBe("bar");
    expect(Object.fromEntries(result.data.map((d) => [d.label, d.value]))).toEqual({
      "US-E": 95,
      "US-W": 92,
      EU: 81,
      "US-C": 78,
      UK: 54,
    });
  });

  it("groupBy: category breaks down by the 8 product categories", () => {
    const result = executeQueryAnalytics(orders, { metric: "count", groupBy: "category" });
    expect(result.chartType).toBe("bar");
    expect(result.data).toHaveLength(8);
    expect(result.data.find((d) => d.label === "CRAYON")?.value).toBe(69);
  });

  it("groupBy: status breaks down by order status", () => {
    const result = executeQueryAnalytics(orders, { metric: "count", groupBy: "status" });
    expect(result.chartType).toBe("bar");
    expect(Object.fromEntries(result.data.map((d) => [d.label, d.value]))).toEqual({
      DELIVERED: 304,
      DELAYED: 55,
      IN_TRANSIT: 27,
      EXCEPTION: 11,
      CANCELED: 3,
    });
  });

  it("groupBy: region computes delayRate per region, not just count", () => {
    const result = executeQueryAnalytics(orders, { metric: "delayRate", groupBy: "region" });
    const uk = result.data.find((d) => d.label === "UK");
    expect(uk?.value).toBeCloseTo(9 / 49, 6); // UK: 9 late of 49 completed, hand-counted
  });

  it("falls back to 'unknown' instead of crashing on a groupBy value with no dimensionKey mapping", () => {
    // GROUP_BY_VALUES/zod already close this off for real callers — this
    // simulates a future enum value added without updating dimensionKey's
    // switch, the defensive case that fallback exists for.
    const input = { metric: "count", groupBy: "warehouse" } as unknown as QueryAnalyticsInput;
    const result = executeQueryAnalytics(orders, input);
    expect(result.data).toEqual([{ label: "unknown", value: orders.length }]);
  });
});
