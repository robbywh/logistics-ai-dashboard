import { tool } from "ai";
import { z } from "zod";
import { forecastDemandSchema } from "../forecast";
import { queryAnalyticsSchema } from "../query-dsl";

export const clarifySchema = z.object({
  reason: z
    .string()
    .describe(
      "Why the question can't be answered by queryAnalytics or forecastDemand.",
    ),
  suggestion: z
    .string()
    .nullable()
    .optional()
    .describe(
      "A rephrased example question the user could ask instead, or null if none applies.",
    ),
});

export type ClarifyInput = z.infer<typeof clarifySchema>;

/**
 * No `execute` on any of these — the route decides which tool was called
 * and runs the matching deterministic function itself (lib/query-dsl.ts,
 * lib/forecast.ts). Keeping tool definitions execute-free avoids threading
 * mutable state out of the AI SDK's call and keeps "the model routes, plain
 * code computes" an explicit, easily-testable step rather than an implicit
 * side effect inside a callback.
 */
export const orchestratorTools = {
  queryAnalytics: tool({
    description:
      "Answer analytics questions about the logistics order dataset: counts, delay rates, or average delivery time, optionally broken down by time (day/week/month), carrier, region, product category, or status. Use for descriptive/diagnostic questions, e.g. 'how many orders were delayed', 'which carrier has the highest delay rate', 'show delayed orders by week for the last 3 months'.",
    inputSchema: queryAnalyticsSchema,
  }),
  forecastDemand: tool({
    description:
      "Forecast future demand (order quantity) for a product category and recommend how much inventory to stock. Use for predictive questions, e.g. 'predict demand for CRAYON for the next 4 months', 'how much inventory should I plan for PAINT'.",
    inputSchema: forecastDemandSchema,
  }),
  clarify: tool({
    description:
      "Use ONLY when the question cannot be answered by queryAnalytics or forecastDemand — it's off-topic, too ambiguous, or asks about something outside this dataset (orders, carriers, delivery performance, product categories, demand forecasting). Never fabricate an answer instead of using this.",
    inputSchema: clarifySchema,
  }),
};
