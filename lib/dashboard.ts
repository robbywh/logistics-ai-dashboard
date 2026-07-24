import { OrderStatus } from "../generated/prisma/client";
import type { OrderRecord } from "./orders";

/** Orders with a completed transit outcome — the only ones that can be
 * meaningfully "on time" or "late". Matches FSD §3.3(1). */
const COMPLETED_STATUSES = new Set<OrderStatus>([
  OrderStatus.DELIVERED,
  OrderStatus.DELAYED,
  OrderStatus.EXCEPTION,
]);

const LATE_STATUSES = new Set<OrderStatus>([
  OrderStatus.DELAYED,
  OrderStatus.EXCEPTION,
]);

export type DateRange = { from?: Date; to?: Date };

export type DashboardSummary = {
  range: { from: string; to: string };
  kpis: {
    totalOrders: number;
    delivered: number;
    delayed: number;
    onTimeRate: number;
    avgDeliveryDays: number;
  };
  orderVolumeByMonth: { month: string; count: number }[];
  deliveryPerformance: { onTime: number; late: number };
  carrierBreakdown: { carrier: string; total: number; delayRate: number }[];
};

function inRange(date: Date, range: DateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

function monthKey(date: Date): string {
  return date.toISOString().slice(0, 7); // YYYY-MM
}

function daysBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

export function datasetRange(orders: OrderRecord[]): { from: Date; to: Date } {
  const dates = orders.map((o) => o.orderDate.getTime());
  return {
    from: new Date(Math.min(...dates)),
    to: new Date(Math.max(...dates)),
  };
}

export function computeDashboardSummary(
  orders: OrderRecord[],
  range: DateRange = {},
): DashboardSummary {
  const filtered = orders.filter((o) => inRange(o.orderDate, range));
  const completed = filtered.filter((o) => COMPLETED_STATUSES.has(o.status));
  const delivered = completed.filter((o) => o.status === OrderStatus.DELIVERED);
  const late = completed.filter((o) => LATE_STATUSES.has(o.status));

  const onTimeRate = completed.length > 0 ? delivered.length / completed.length : 0;

  const withDuration = completed.filter((o) => o.deliveryDate !== null);
  const avgDeliveryDays =
    withDuration.length > 0
      ? withDuration.reduce(
          (sum, o) => sum + daysBetween(o.orderDate, o.deliveryDate as Date),
          0,
        ) / withDuration.length
      : 0;

  const volumeByMonth = new Map<string, number>();
  for (const order of filtered) {
    const key = monthKey(order.orderDate);
    volumeByMonth.set(key, (volumeByMonth.get(key) ?? 0) + 1);
  }
  const orderVolumeByMonth = [...volumeByMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const carrierStats = new Map<string, { delivered: number; late: number }>();
  for (const order of completed) {
    const entry = carrierStats.get(order.carrier) ?? { delivered: 0, late: 0 };
    if (order.status === OrderStatus.DELIVERED) entry.delivered++;
    else entry.late++;
    carrierStats.set(order.carrier, entry);
  }
  const carrierBreakdown = [...carrierStats.entries()]
    .map(([carrier, { delivered: d, late: l }]) => ({
      carrier,
      total: d + l,
      delayRate: d + l > 0 ? l / (d + l) : 0,
    }))
    .sort((a, b) => b.delayRate - a.delayRate);

  const fullRange = datasetRange(orders);
  const responseFrom = range.from ?? fullRange.from;
  const responseTo = range.to ?? fullRange.to;

  return {
    range: {
      from: responseFrom.toISOString().slice(0, 10),
      to: responseTo.toISOString().slice(0, 10),
    },
    kpis: {
      totalOrders: filtered.length,
      delivered: delivered.length,
      delayed: late.length,
      onTimeRate,
      avgDeliveryDays,
    },
    orderVolumeByMonth,
    deliveryPerformance: { onTime: delivered.length, late: late.length },
    carrierBreakdown,
  };
}
