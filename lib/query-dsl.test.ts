import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrdersCsv } from "../prisma/csv";
import { datasetAnchorDate, resolveRelativeRange } from "./date-anchor";
import { executeQueryAnalytics } from "./query-dsl";

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

describe("date-anchor resolution", () => {
  it("anchors to the dataset's own max order date, not real wall-clock time", () => {
    const anchor = datasetAnchorDate(orders);
    expect(anchor.getFullYear()).toBe(2025); // the dataset is a 2025 snapshot
    expect(anchor.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("resolves last_3_months as a trailing window ending at the anchor", () => {
    // Date-only ISO string parses as UTC midnight — matches how `orderDate`
    // is actually constructed from the CSV in prisma/csv.ts.
    const anchor = new Date("2025-12-30");
    const { from, to } = resolveRelativeRange("last_3_months", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2025-09-30");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });
});

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
});
