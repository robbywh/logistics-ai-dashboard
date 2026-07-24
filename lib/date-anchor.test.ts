import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseOrdersCsv } from "../prisma/csv";
import { datasetAnchorDate, resolveRelativeRange } from "./date-anchor";

const csvPath = path.join(
  __dirname,
  "..",
  "docs",
  "data",
  "mock_logistics_data.csv",
);
const orders = parseOrdersCsv(fs.readFileSync(csvPath, "utf-8"));

describe("datasetAnchorDate", () => {
  it("anchors to the dataset's own max order date, not real wall-clock time", () => {
    const anchor = datasetAnchorDate(orders);
    expect(anchor.getFullYear()).toBe(2025); // the dataset is a 2025 snapshot
    expect(anchor.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("is the max regardless of array order (not just the last element)", () => {
    const [first, ...rest] = [...orders].sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
    const shuffled = [...rest, first]; // max order now sits in the middle/last, not first
    expect(datasetAnchorDate(shuffled).toISOString().slice(0, 10)).toBe("2025-12-30");
  });
});

describe("resolveRelativeRange", () => {
  const anchor = new Date("2025-12-30");

  it("last_week: trailing 7 days ending at the anchor", () => {
    const { from, to } = resolveRelativeRange("last_week", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2025-12-23");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("last_month: trailing 1 calendar month ending at the anchor", () => {
    const { from, to } = resolveRelativeRange("last_month", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2025-11-30");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("last_3_months: trailing window ending at the anchor", () => {
    const { from, to } = resolveRelativeRange("last_3_months", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2025-09-30");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("last_6_months: trailing window ending at the anchor", () => {
    const { from, to } = resolveRelativeRange("last_6_months", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2025-06-30");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("last_year: trailing 12 months, crossing a year boundary", () => {
    const { from, to } = resolveRelativeRange("last_year", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2024-12-30");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("year_to_date: Jan 1 of the anchor's year through the anchor", () => {
    const { from, to } = resolveRelativeRange("year_to_date", anchor);
    expect(from.toISOString().slice(0, 10)).toBe("2025-01-01");
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("all_time: the Unix epoch through the anchor", () => {
    const { from, to } = resolveRelativeRange("all_time", anchor);
    expect(from.getTime()).toBe(0);
    expect(to.toISOString().slice(0, 10)).toBe("2025-12-30");
  });

  it("normalizes a mid-day anchor to the start of its UTC day", () => {
    const midDayAnchor = new Date("2025-12-30T15:42:00Z");
    const { to } = resolveRelativeRange("last_week", midDayAnchor);
    expect(to.toISOString()).toBe("2025-12-30T00:00:00.000Z");
  });
});
