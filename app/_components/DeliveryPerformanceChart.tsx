"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard } from "./ChartCard";

type Props = {
  onTime: number;
  late: number;
};

const COLORS = ["#22c55e", "#ef4444"];

export function DeliveryPerformanceChart({ onTime, late }: Props) {
  const data = [
    { name: "On-time", value: onTime },
    { name: "Delayed / exception", value: late },
  ];

  return (
    <ChartCard title="Delivery performance">
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {data.map((entry, i) => (
              <Cell key={entry.name} fill={COLORS[i]} />
            ))}
          </Pie>
          <Legend />
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
