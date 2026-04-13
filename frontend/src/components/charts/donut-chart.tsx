"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ChartPoint } from "@/types";

const COLORS = ["#7FFFD4", "#1C8DFF", "#FF7A59", "#7A5CFA"];

export function PortfolioDonut({ data }: { data: ChartPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} innerRadius={70} outerRadius={95} dataKey="value" paddingAngle={5}>
            {data.map((entry, index) => (
              <Cell key={entry.label} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | string, name: string) => [
              <span key="value" style={{ color: "var(--text-strong)", fontWeight: 700 }}>
                {typeof value === "number" ? value.toLocaleString("en-IN") : value}
              </span>,
              <span key="name" style={{ color: "var(--muted)" }}>
                {name}
              </span>,
            ]}
            contentStyle={{
              border: "1px solid var(--border)",
              background: "var(--surface-elevated)",
              borderRadius: "18px",
              color: "var(--text-strong)",
            }}
            itemStyle={{ color: "var(--text-strong)" }}
            labelStyle={{ color: "var(--muted)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
