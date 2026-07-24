import { z } from "zod";
import { OrderStatus } from "../generated/prisma/client";
import { type ChartType, selectChartType } from "./chart-select";
import { datasetRange } from "./dashboard";
import { datasetAnchorDate, RELATIVE_RANGE_KEYS, resolveRelativeRange } from "./date-anchor";
import type { OrderRecord } from "./orders";

export const PRODUCT_CATEGORIES = [
  "PAPER",
  "CRAYON",
  "BOOK",
  "PENCIL",
  "STICKER",
  "MARKER",
  "BRUSH",
  "PAINT",
] as const;

export const CARRIERS = [
  "DHL",
  "FedEx",
  "UPS",
  "USPS",
  "LaserShip",
  "OnTrac",
  "GLS",
  "DPD",
  "Royal Mail",
] as const;

export const REGIONS = ["UK", "EU", "US-C", "US-E", "US-W"] as const;

const METRICS = ["count", "delayRate", "avgDeliveryDays"] as const;
const GROUP_BY_VALUES = [
  "day",
  "week",
  "month",
  "carrier",
  "region",
  "category",
  "status",
] as const;
const STATUS_VALUES = [
  "DELIVERED",
  "DELAYED",
  "EXCEPTION",
  "IN_TRANSIT",
  "CANCELED",
] as const;

export const queryAnalyticsSchema = z.object({
  metric: z
    .enum(METRICS)
    .describe(
      "What to compute: 'count' of matching orders, 'delayRate' (late / completed orders), or 'avgDeliveryDays' (average days from order to delivery, completed orders only).",
    ),
  groupBy: z
    .enum(GROUP_BY_VALUES)
    .nullable()
    .optional()
    .describe(
      "Breakdown dimension for a chart/table. Use null for a single aggregate number.",
    ),
  filters: z
    .object({
      status: z
        .enum(STATUS_VALUES)
        .nullable()
        .optional()
        .describe(
          "Use null unless the user's question names a specific status (e.g. 'delayed orders'). Only meaningful with metric='count' — 'delayRate' and 'avgDeliveryDays' already classify completed/late internally, so do not combine a status filter with those metrics.",
        ),
      carrier: z
        .enum(CARRIERS)
        .nullable()
        .optional()
        .describe(
          "Use null unless the user's question names a specific carrier (e.g. 'FedEx', 'DHL'). Do not guess or pick an example carrier.",
        ),
      region: z
        .enum(REGIONS)
        .nullable()
        .optional()
        .describe("Use null unless the user's question names a specific region."),
      category: z
        .enum(PRODUCT_CATEGORIES)
        .nullable()
        .optional()
        .describe(
          "Use null unless the user's question names a specific product category.",
        ),
      dateFrom: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Use null unless the user names an explicit calendar date/month/year directly (e.g. 'in March 2025'), as ISO YYYY-MM-DD. Never pass an empty string — use null.",
        ),
      dateTo: z
        .string()
        .nullable()
        .optional()
        .describe(
          "ISO date (YYYY-MM-DD), paired with dateFrom. Use null otherwise — never pass an empty string.",
        ),
      relativeDateRange: z
        .enum(RELATIVE_RANGE_KEYS)
        .nullable()
        .optional()
        .describe(
          "Use null unless the question uses a RELATIVE phrase like 'last month', 'last 3 months', 'this year'. Resolved server-side against the dataset's own latest order date — never compute actual calendar dates yourself for a relative phrase.",
        ),
    })
    .nullable()
    .optional()
    .describe(
      "Set each sub-field to null unless the user's question explicitly names that value. Do not populate carrier/region/category/dates unless the question explicitly mentions them — an unfiltered or lightly-filtered query is expected and correct for broad questions.",
    ),
});

export type QueryAnalyticsInput = z.infer<typeof queryAnalyticsSchema>;

export type QueryResult = {
  metric: (typeof METRICS)[number];
  dimension?: string;
  filtersApplied: {
    status?: string;
    carrier?: string;
    region?: string;
    category?: string;
  };
  dateRange: { from: string; to: string };
  chartType: ChartType;
  data: { label: string; value: number }[];
};

const COMPLETED_STATUSES = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.DELAYED,
  OrderStatus.EXCEPTION,
]);
const LATE_STATUSES = new Set<OrderStatus>([
  OrderStatus.DELAYED,
  OrderStatus.EXCEPTION,
]);

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** ISO-style: buckets by the Monday that starts the order's week. Pure UTC
 * arithmetic throughout — mixing local-timezone getters with UTC output
 * shifts results by a day depending on the server's timezone. */
function weekKey(d: Date): string {
  const date = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const isoDay = date.getUTCDay() || 7; // Mon=1 .. Sun=7
  date.setUTCDate(date.getUTCDate() - isoDay + 1);
  return date.toISOString().slice(0, 10);
}

function computeMetric(
  orders: OrderRecord[],
  metric: QueryAnalyticsInput["metric"],
): number {
  if (metric === "count") return orders.length;

  const completed = orders.filter((o) => COMPLETED_STATUSES.has(o.status));

  if (metric === "delayRate") {
    if (completed.length === 0) return 0;
    const late = completed.filter((o) => LATE_STATUSES.has(o.status)).length;
    return late / completed.length;
  }

  // avgDeliveryDays
  const withDuration = completed.filter((o) => o.deliveryDate !== null);
  if (withDuration.length === 0) return 0;
  const totalDays = withDuration.reduce(
    (sum, o) =>
      sum + ((o.deliveryDate as Date).getTime() - o.orderDate.getTime()) / 86_400_000,
    0,
  );
  return totalDays / withDuration.length;
}

function dimensionKey(order: OrderRecord, groupBy: string): string {
  switch (groupBy) {
    case "carrier":
      return order.carrier;
    case "region":
      return order.region;
    case "category":
      return order.productCategory;
    case "status":
      return order.status;
    default:
      return "unknown";
  }
}

export function executeQueryAnalytics(
  orders: OrderRecord[],
  input: QueryAnalyticsInput,
): QueryResult {
  const anchor = datasetAnchorDate(orders);
  const filters = input.filters ?? {};

  let from: Date | undefined;
  let to: Date | undefined;
  if (filters.relativeDateRange) {
    ({ from, to } = resolveRelativeRange(filters.relativeDateRange, anchor));
  } else {
    if (filters.dateFrom) from = new Date(filters.dateFrom);
    if (filters.dateTo) to = new Date(filters.dateTo);
  }

  let filtered = orders;
  if (from) filtered = filtered.filter((o) => o.orderDate >= (from as Date));
  if (to) filtered = filtered.filter((o) => o.orderDate <= (to as Date));
  if (filters.status) filtered = filtered.filter((o) => o.status === filters.status);
  if (filters.carrier) filtered = filtered.filter((o) => o.carrier === filters.carrier);
  if (filters.region) filtered = filtered.filter((o) => o.region === filters.region);
  if (filters.category)
    filtered = filtered.filter((o) => o.productCategory === filters.category);

  const fullRange = datasetRange(orders);
  const effectiveFrom = from ?? fullRange.from;
  const effectiveTo = to ?? fullRange.to;

  let data: { label: string; value: number }[];

  if (!input.groupBy) {
    data = [{ label: input.metric, value: computeMetric(filtered, input.metric) }];
  } else if (["day", "week", "month"].includes(input.groupBy)) {
    const keyFn =
      input.groupBy === "day" ? dayKey : input.groupBy === "week" ? weekKey : monthKey;
    const buckets = new Map<string, OrderRecord[]>();
    for (const o of filtered) {
      const key = keyFn(o.orderDate);
      const group = buckets.get(key) ?? [];
      group.push(o);
      buckets.set(key, group);
    }
    data = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, group]) => ({ label, value: computeMetric(group, input.metric) }));
  } else {
    const groupBy = input.groupBy;
    const buckets = new Map<string, OrderRecord[]>();
    for (const o of filtered) {
      const key = dimensionKey(o, groupBy);
      const group = buckets.get(key) ?? [];
      group.push(o);
      buckets.set(key, group);
    }
    data = [...buckets.entries()]
      .map(([label, group]) => ({ label, value: computeMetric(group, input.metric) }))
      .sort((a, b) => b.value - a.value);
  }

  return {
    metric: input.metric,
    dimension: input.groupBy ?? undefined,
    filtersApplied: {
      status: filters.status ?? undefined,
      carrier: filters.carrier ?? undefined,
      region: filters.region ?? undefined,
      category: filters.category ?? undefined,
    },
    dateRange: { from: dayKey(effectiveFrom), to: dayKey(effectiveTo) },
    chartType: selectChartType(input.groupBy ?? undefined),
    data,
  };
}
