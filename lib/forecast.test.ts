import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrdersCsv } from "../prisma/csv";
import { forecastCategory } from "./forecast";
import type { OrderRecord } from "./orders";

const csvPath = path.join(
  __dirname,
  "..",
  "docs",
  "data",
  "mock_logistics_data.csv",
);
const orders = parseOrdersCsv(fs.readFileSync(csvPath, "utf-8"));

describe("forecastCategory", () => {
  it("matches an independently hand-computed OLS regression for CRAYON", () => {
    const result = forecastCategory(orders, { category: "CRAYON", horizonMonths: 4 });

    expect(result.historical.map((h) => h.quantity)).toEqual([
      60, 12, 34, 11, 3, 22, 5, 25, 23, 14, 4, 16,
    ]);
    expect(result.forecast).toHaveLength(4);
    expect(result.forecast.map((f) => f.quantity)).toEqual([6, 4, 2, 0]);
    expect(result.forecast.map((f) => f.recommendedInventory)).toEqual([28, 26, 24, 22]);
    expect(result.forecast[0].month).toBe("2026-01"); // month after the dataset's Dec 2025
  });

  it("matches an independently hand-computed OLS regression for PAINT", () => {
    const result = forecastCategory(orders, { category: "PAINT", horizonMonths: 4 });

    expect(result.historical.map((h) => h.quantity)).toEqual([
      9, 6, 17, 5, 4, 11, 15, 4, 0, 3, 17, 14,
    ]);
    expect(result.forecast.map((f) => f.quantity)).toEqual([10, 10, 10, 10]);
    expect(result.forecast.map((f) => f.recommendedInventory)).toEqual([19, 19, 19, 19]);
  });

  it("matches an independently hand-computed OLS regression for BRUSH (a declining trend)", () => {
    const result = forecastCategory(orders, { category: "BRUSH", horizonMonths: 4 });

    expect(result.historical.map((h) => h.quantity)).toEqual([
      31, 16, 30, 4, 8, 11, 23, 18, 0, 7, 21, 0,
    ]);
    expect(result.forecast.map((f) => f.quantity)).toEqual([4, 3, 1, 0]);
    // recommendedInventory never drops below the raw forecast quantity, even at 0
    for (const f of result.forecast) {
      expect(f.recommendedInventory).toBeGreaterThanOrEqual(f.quantity);
    }
  });

  it("respects the default horizon of 4 months when unset", () => {
    const result = forecastCategory(orders, { category: "STICKER" });
    expect(result.forecast).toHaveLength(4);
  });

  it("respects a custom horizon", () => {
    const result = forecastCategory(orders, { category: "STICKER", horizonMonths: 6 });
    expect(result.forecast).toHaveLength(6);
  });

  it("never forecasts a negative quantity", () => {
    for (const category of ["CRAYON", "PAINT", "BRUSH", "STICKER", "MARKER", "PENCIL", "PAPER", "BOOK"] as const) {
      const result = forecastCategory(orders, { category, horizonMonths: 6 });
      for (const f of result.forecast) {
        expect(f.quantity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("returns an insufficient-history result instead of a garbage regression when given <3 months of data", () => {
    const sparseOrders: OrderRecord[] = orders
      .filter((o) => o.productCategory === "CRAYON")
      .filter((o) => o.orderDate < new Date("2025-02-01"))
      .slice(0, 2)
      .map((o, i) => ({ ...o, orderDate: new Date(`2025-01-0${i + 1}`) }));

    const result = forecastCategory(sparseOrders, { category: "CRAYON" });
    expect(result.forecast).toEqual([]);
    expect(result.methodology).toMatch(/insufficient history/i);
  });
});
