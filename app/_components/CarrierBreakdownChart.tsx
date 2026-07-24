"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { UnderlyingDataToggle } from "./UnderlyingDataToggle";

type Props = {
  data: { carrier: string; total: number; delayRate: number }[];
};

export function CarrierBreakdownChart({ data }: Props) {
  const chartData = data.map((d) => ({
    ...d,
    delayRatePct: Math.round(d.delayRate * 1000) / 10,
  }));

  return (
    <ChartCard title="Carrier delay rate">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-zinc-200 dark:text-zinc-800" />
          <XAxis type="number" unit="%" tick={{ fontSize: 12 }} />
          <YAxis type="category" dataKey="carrier" width={90} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => `${value}%`} />
          <Bar
            dataKey="delayRatePct"
            name="Delay rate"
            fill="#f97316"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <UnderlyingDataToggle
        rows={chartData}
        columns={[
          { key: "carrier", label: "Carrier" },
          { key: "total", label: "Completed orders" },
          { key: "delayRatePct", label: "Delay rate %" },
        ]}
      />
    </ChartCard>
  );
}
