"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";

type Props = {
  chartType: "line" | "bar" | "stat";
  data: { label: string; value: number }[];
  metric: string;
};

function formatMetricValue(metric: string, value: number | undefined): string {
  if (value === undefined) return "—";
  if (metric === "delayRate") return `${(value * 100).toFixed(1)}%`;
  if (metric === "avgDeliveryDays") return `${value.toFixed(1)}d`;
  return value.toLocaleString();
}

export function QueryResultChart({ chartType, data, metric }: Props) {
  if (chartType === "stat") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-950">
        <div className="text-4xl font-semibold text-zinc-900 dark:text-zinc-50">
          {formatMetricValue(metric, data[0]?.value)}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        No matching data.
      </div>
    );
  }

  const formatter = (value: number) => formatMetricValue(metric, value);

  if (chartType === "line") {
    return (
      <ChartCard title="Result">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-zinc-200 dark:text-zinc-800"
            />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={formatter} />
            <Tooltip formatter={(value) => formatMetricValue(metric, value as number)} />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }

  return (
    <ChartCard title="Result">
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
        <BarChart data={data} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-zinc-200 dark:text-zinc-800"
          />
          <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={formatter} />
          <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatMetricValue(metric, value as number)} />
          <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
