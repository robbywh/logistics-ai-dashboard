"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CarrierBreakdownChart } from "./CarrierBreakdownChart";
import { DateRangeControl } from "./DateRangeControl";
import { DeliveryPerformanceChart } from "./DeliveryPerformanceChart";
import { KpiCard } from "./KpiCard";
import { OrderVolumeChart } from "./OrderVolumeChart";

type DashboardSummary = {
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

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function fetchSummary(range: { from: string; to: string } | null): Promise<DashboardSummary> {
  const params = range ? new URLSearchParams({ from: range.from, to: range.to }) : null;
  const res = await fetch(`/api/dashboard/summary${params ? `?${params}` : ""}`);
  if (!res.ok) throw new Error("Failed to load dashboard data.");
  return res.json();
}

export function DashboardClient() {
  // null = "use the dataset's full range" (server-resolved); set once the
  // user picks a range via DateRangeControl.
  const [selectedRange, setSelectedRange] = useState<{ from: string; to: string } | null>(null);

  const {
    data: summary,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["dashboard-summary", selectedRange?.from, selectedRange?.to],
    queryFn: () => fetchSummary(selectedRange),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {summary && (
          <DateRangeControl
            from={summary.range.from}
            to={summary.range.to}
            onChange={setSelectedRange}
          />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error instanceof Error ? error.message : "Something went wrong."}
        </div>
      )}

      {isLoading && !summary && !error && (
        <p className="text-zinc-500 dark:text-zinc-400">Loading…</p>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard label="Total orders" value={summary.kpis.totalOrders.toLocaleString()} />
            <KpiCard label="Delivered" value={summary.kpis.delivered.toLocaleString()} />
            <KpiCard label="Delayed" value={summary.kpis.delayed.toLocaleString()} />
            <KpiCard label="On-time rate" value={formatPercent(summary.kpis.onTimeRate)} />
            <KpiCard
              label="Avg delivery time"
              value={`${summary.kpis.avgDeliveryDays.toFixed(1)}d`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <OrderVolumeChart data={summary.orderVolumeByMonth} />
            <DeliveryPerformanceChart
              onTime={summary.deliveryPerformance.onTime}
              late={summary.deliveryPerformance.late}
            />
            <div className="lg:col-span-2">
              <CarrierBreakdownChart data={summary.carrierBreakdown} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
