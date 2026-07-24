import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrdersCsv } from "../prisma/csv";
import { computeDashboardSummary } from "./dashboard";

const csvPath = path.join(
  __dirname,
  "..",
  "docs",
  "data",
  "mock_logistics_data.csv",
);
const orders = parseOrdersCsv(fs.readFileSync(csvPath, "utf-8"));

describe("computeDashboardSummary", () => {
  it("matches hand-calculated KPIs over the full dataset", () => {
    const summary = computeDashboardSummary(orders);

    expect(summary.kpis.totalOrders).toBe(400);
    expect(summary.kpis.delivered).toBe(304);
    expect(summary.kpis.delayed).toBe(66); // 55 delayed + 11 exception
    expect(summary.kpis.onTimeRate).toBeCloseTo(304 / 370, 6);
    expect(summary.kpis.avgDeliveryDays).toBeCloseTo(3.8297297297, 6);
  });

  it("matches a hand-calculated slice (January 2025)", () => {
    const summary = computeDashboardSummary(orders, {
      from: new Date("2025-01-01"),
      to: new Date("2025-01-31"),
    });

    expect(summary.kpis.totalOrders).toBe(75);
    expect(summary.kpis.delivered).toBe(57);
    expect(summary.kpis.delayed).toBe(15);
  });

  it("returns zeros for an out-of-data-range window instead of erroring", () => {
    const summary = computeDashboardSummary(orders, {
      from: new Date("2030-01-01"),
      to: new Date("2030-12-31"),
    });

    expect(summary.kpis.totalOrders).toBe(0);
    expect(summary.kpis.onTimeRate).toBe(0);
    expect(summary.kpis.avgDeliveryDays).toBe(0);
    expect(summary.orderVolumeByMonth).toEqual([]);
    expect(summary.carrierBreakdown).toEqual([]);
  });

  it("produces 12 months of order volume covering the full 2025 dataset", () => {
    const summary = computeDashboardSummary(orders);
    expect(summary.orderVolumeByMonth).toHaveLength(12);
    expect(summary.orderVolumeByMonth[0]).toEqual({ month: "2025-01", count: 75 });
  });

  it("computes carrier delay rates matching the source data", () => {
    const summary = computeDashboardSummary(orders);
    const dhl = summary.carrierBreakdown.find((c) => c.carrier === "DHL");
    const gls = summary.carrierBreakdown.find((c) => c.carrier === "GLS");

    expect(dhl?.total).toBe(58);
    expect(dhl?.delayRate).toBeCloseTo(0.069, 3);
    expect(gls?.total).toBe(8);
    expect(gls?.delayRate).toBeCloseTo(0.375, 3);
  });

  it("sorts carrier breakdown by delay rate descending", () => {
    const summary = computeDashboardSummary(orders);
    const rates = summary.carrierBreakdown.map((c) => c.delayRate);
    const sorted = [...rates].sort((a, b) => b - a);
    expect(rates).toEqual(sorted);
  });

  it("echoes the full dataset range when no range is given", () => {
    const summary = computeDashboardSummary(orders);
    expect(summary.range).toEqual({ from: "2025-01-01", to: "2025-12-30" });
  });
});
