import { describe, expect, it } from "vitest";
import { selectChartType } from "./chart-select";

describe("selectChartType", () => {
  it("returns 'stat' for no groupBy (single aggregate)", () => {
    expect(selectChartType(undefined)).toBe("stat");
  });

  it.each(["day", "week", "month"])("returns 'line' for time-series groupBy=%s", (groupBy) => {
    expect(selectChartType(groupBy)).toBe("line");
  });

  it.each(["carrier", "region", "category", "status"])(
    "returns 'bar' for categorical groupBy=%s",
    (groupBy) => {
      expect(selectChartType(groupBy)).toBe("bar");
    },
  );
});
