export type ChartType = "line" | "bar" | "stat";

const TIME_SERIES_DIMENSIONS = new Set(["day", "week", "month"]);

/** Chart type is a deterministic function of the query shape — never
 * chosen by the model. See FSD §5.3. */
export function selectChartType(groupBy: string | undefined): ChartType {
  if (!groupBy) return "stat";
  if (TIME_SERIES_DIMENSIONS.has(groupBy)) return "line";
  return "bar";
}
