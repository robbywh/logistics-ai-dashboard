"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";

type Props = {
  historical: { month: string; quantity: number }[];
  forecast: { month: string; quantity: number; recommendedInventory: number }[];
};

export function ForecastChart({ historical, forecast }: Props) {
  if (historical.length === 0 && forecast.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
        No forecast data available yet.
      </div>
    );
  }

  const combined = [
    ...historical.map((h) => ({
      month: h.month,
      historical: h.quantity,
      forecast: null as number | null,
    })),
    ...forecast.map((f) => ({
      month: f.month,
      historical: null as number | null,
      forecast: f.quantity,
    })),
  ];

  return (
    <ChartCard title="Historical demand + forecast">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={combined}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            className="text-zinc-200 dark:text-zinc-800"
          />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="historical"
            name="Historical"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
          <Line
            type="monotone"
            dataKey="forecast"
            name="Forecast"
            stroke="#f97316"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            isAnimationActive={false}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
