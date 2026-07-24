import { z } from "zod";
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

/**
 * STUB — real linear-regression forecast lands in Task 8 (lib/forecast.ts).
 * Kept as a separate, stable function so the AI tool wiring in Task 6 does
 * not need to change when the real implementation replaces this body.
 */
export function forecastCategory(input: ForecastDemandInput): ForecastResult {
  return {
    category: input.category,
    sku: input.sku ?? undefined,
    historical: [],
    forecast: [],
    methodology:
      "Forecasting is not implemented yet (lands in a later phase). This is a placeholder response.",
  };
}
