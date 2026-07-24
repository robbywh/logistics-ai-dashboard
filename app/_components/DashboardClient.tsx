"use client";

import { useCallback, useEffect, useState } from "react";
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

export function DashboardClient() {
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (requestedRange: { from: string; to: string }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: requestedRange.from,
        to: requestedRange.to,
      });
      const res = await fetch(`/api/dashboard/summary?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load dashboard data.");

      const data: DashboardSummary = await res.json();
      setSummary(data);
      setRange({ from: data.range.from, to: data.range.to });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: fetches the full dataset range. State is only set after
  // the first `await`, so nothing runs synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      try {
        const res = await fetch("/api/dashboard/summary");
        if (!res.ok) throw new Error("Failed to load dashboard data.");
        const data: DashboardSummary = await res.json();
        if (cancelled) return;
        setSummary(data);
        setRange({ from: data.range.from, to: data.range.to });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {range && (
          <DateRangeControl from={range.from} to={range.to} onChange={fetchSummary} />
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !summary && !error && (
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
