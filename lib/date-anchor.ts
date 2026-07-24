import type { OrderRecord } from "./orders";

export const RELATIVE_RANGE_KEYS = [
  "last_week",
  "last_month",
  "last_3_months",
  "last_6_months",
  "last_year",
  "year_to_date",
  "all_time",
] as const;

export type RelativeRangeKey = (typeof RELATIVE_RANGE_KEYS)[number];

/**
 * The dataset is a static historical snapshot (2025), not a live feed. So
 * relative phrases like "last 3 months" must anchor to the latest order
 * date IN THE DATA, never to the server's real wall-clock date — anchoring
 * to real "today" would silently return zero rows for every relative query
 * against this fixed dataset.
 */
export function datasetAnchorDate(orders: OrderRecord[]): Date {
  const max = Math.max(...orders.map((o) => o.orderDate.getTime()));
  return new Date(max);
}

// All arithmetic here is UTC-based. `orderDate` values are parsed from
// date-only strings ("2025-01-01"), which JS treats as UTC midnight — mixing
// that with local-timezone Date construction would shift results by a day
// depending on the server's timezone (verified: this broke on a UTC+7 dev
// machine before being caught by tests).
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

function subDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

/**
 * Trailing-window semantics (e.g. "last month" = the 1 month immediately
 * before the anchor date), not calendar-aligned buckets. Simpler and
 * consistent across every relative key; the exact resolved range is always
 * surfaced in the explainability panel so the interpretation is never
 * hidden from the user.
 */
export function resolveRelativeRange(
  key: RelativeRangeKey,
  anchor: Date,
): { from: Date; to: Date } {
  const to = startOfUtcDay(anchor);
  switch (key) {
    case "last_week":
      return { from: subDays(to, 7), to };
    case "last_month":
      return { from: subMonths(to, 1), to };
    case "last_3_months":
      return { from: subMonths(to, 3), to };
    case "last_6_months":
      return { from: subMonths(to, 6), to };
    case "last_year":
      return { from: subMonths(to, 12), to };
    case "year_to_date":
      return { from: new Date(Date.UTC(to.getUTCFullYear(), 0, 1)), to };
    case "all_time":
      return { from: new Date(0), to };
  }
}
