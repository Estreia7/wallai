"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type CategoryPoint = { category: string; cost: number; calls: number };

const COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#f472b6", "#94a3b8"];

function fmtUsd(v: number): string {
  return `$${v.toFixed(v >= 1 ? 2 : 3)}`;
}

export function UsageCategoryDonut({ data }: { data: CategoryPoint[] }) {
  const rows = data.filter((d) => d.cost > 0);
  if (rows.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center">
        <p className="text-center text-xs text-white/60 sm:text-sm">No AI usage yet this month</p>
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={rows} dataKey="cost" nameKey="category" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {rows.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => fmtUsd(Number(value))}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
