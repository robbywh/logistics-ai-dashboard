"use client";

import { memo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { type Column } from "./DataTable";
import { UnderlyingDataToggle } from "./UnderlyingDataToggle";

type Props = {
  data: { month: string; count: number }[];
};

const COLUMNS: Column<{ month: string; count: number }>[] = [
  { key: "month", label: "Month" },
  { key: "count", label: "Orders" },
];

export const OrderVolumeChart = memo(function OrderVolumeChart({ data }: Props) {
  return (
    <ChartCard title="Order volume over time">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            name="Orders"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <UnderlyingDataToggle rows={data} columns={COLUMNS} />
    </ChartCard>
  );
});
