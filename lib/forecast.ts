import { z } from "zod";
import { datasetRange } from "./dashboard";
import type { OrderRecord } from "./orders";
import { PRODUCT_CATEGORIES } from "./query-dsl";

export const forecastDemandSchema = z.object({
  category: z
    .enum(PRODUCT_CATEGORIES)
    .describe(
      "Product category to forecast. Forecasting runs at the category level, not per-SKU — the seed dataset has too few orders per individual SKU (355 distinct SKUs across 400 orders) to fit a trend.",
    ),
  horizonMonths: z
    .number()
    .int()
    .min(1)
    .max(6)
    .nullable()
    .optional()
    .describe("How many months ahead to forecast. Use null to default to 4."),
  sku: z
    .string()
    .nullable()
    .optional()
    .describe(
      "If the user names a specific SKU, pass it here for context, otherwise use null. The forecast itself still runs at the category level — the response explains this substitution rather than silently forecasting from 1-2 data points.",
    ),
});

export type ForecastDemandInput = z.infer<typeof forecastDemandSchema>;

export type ForecastResult = {
  category: string;
  sku?: string;
  historical: { month: string; quantity: number }[];
  forecast: { month: string; quantity: number; recommendedInventory: number }[];
  methodology: string;
};

const DEFAULT_HORIZON_MONTHS = 4;
const MIN_HISTORY_MONTHS = 3;
const SAFETY_STOCK_Z = 1.5;

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/** Full calendar-month range spanning the dataset, inclusive. Months with no
 * orders for the given category still appear (as zero) — a gap is a real
 * data point for the regression, not something to skip over. */
function monthRange(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= end.getTime()) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function nextMonths(lastMonth: string, count: number): string[] {
  const [startYear, startMonth] = lastMonth.split("-").map(Number);
  const months: string[] = [];
  let year = startYear;
  let month = startMonth;
  for (let i = 0; i < count; i++) {
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

/** Ordinary least squares over (monthIndex, quantity) pairs. */
function fitLinearRegression(ys: number[]): { slope: number; intercept: number; residualStdDev: number } {
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (xs[i] - xMean) * (ys[i] - yMean);
    denominator += (xs[i] - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const residualVariance =
    n > 1 ? residuals.reduce((sum, r) => sum + r * r, 0) / (n - 1) : 0;

  return { slope, intercept, residualStdDev: Math.sqrt(residualVariance) };
}

/**
 * Linear regression over monthly order-quantity history for one product
 * category. See FSD §5.5: acceptable per the assignment's listed methods
 * (moving average / linear regression / exponential smoothing / trend).
 * Inventory recommendation = forecast + 1.5 x the standard deviation of
 * in-sample regression residuals (a simple safety-stock buffer).
 */
export function forecastCategory(
  orders: OrderRecord[],
  input: ForecastDemandInput,
): ForecastResult {
  const horizonMonths = input.horizonMonths ?? DEFAULT_HORIZON_MONTHS;
  const sku = input.sku ?? undefined;

  const categoryOrders = orders.filter((o) => o.productCategory === input.category);
  const fullRange = datasetRange(orders);
  const months = monthRange(fullRange.from, fullRange.to);

  const quantityByMonth = new Map<string, number>();
  for (const order of categoryOrders) {
    const key = monthKey(order.orderDate);
    quantityByMonth.set(key, (quantityByMonth.get(key) ?? 0) + order.quantity);
  }
  const historical = months.map((month) => ({
    month,
    quantity: quantityByMonth.get(month) ?? 0,
  }));

  if (historical.length < MIN_HISTORY_MONTHS) {
    return {
      category: input.category,
      sku,
      historical,
      forecast: [],
      methodology: `Insufficient history to forecast ${input.category}: only ${historical.length} month(s) of data available (need at least ${MIN_HISTORY_MONTHS}).`,
    };
  }

  const { slope, intercept, residualStdDev } = fitLinearRegression(
    historical.map((h) => h.quantity),
  );

  const n = historical.length;
  const futureMonths = nextMonths(months[months.length - 1], horizonMonths);
  const forecast = futureMonths.map((month, i) => {
    const x = n + i;
    const quantity = Math.max(0, Math.round(intercept + slope * x));
    const recommendedInventory = Math.max(
      quantity,
      Math.ceil(quantity + SAFETY_STOCK_Z * residualStdDev),
    );
    return { month, quantity, recommendedInventory };
  });

  return {
    category: input.category,
    sku,
    historical,
    forecast,
    methodology: `Linear regression (ordinary least squares) fitted over ${n} months of historical order quantity for ${input.category}, projected ${horizonMonths} month(s) ahead. Inventory recommendation = forecast + ${SAFETY_STOCK_Z}× the standard deviation of in-sample regression residuals (a simple safety-stock buffer).`,
  };
}
