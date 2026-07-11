"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TrendPoint = { month: string; cost: number };

function fmtUsd(v: number): string {
  return `$${v.toFixed(v >= 1 ? 2 : 3)}`;
}

export function UsageTrendChart({ data }: { data: TrendPoint[] }) {
  const rows = data.map((d) => {
    const [y, m] = d.month.split("-").map(Number);
    const label = new Intl.DateTimeFormat("en-IE", { month: "short" }).format(new Date(Date.UTC(y, m - 1, 1)));
    return { ...d, label };
  });
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={rows}>
        <defs>
          <linearGradient id="usageTrend" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
        <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} width={48} tickFormatter={fmtUsd} />
        <Tooltip
          formatter={(value) => [fmtUsd(Number(value)), "Cost"] as [string, string]}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="cost" stroke="#22d3ee" strokeWidth={2} fill="url(#usageTrend)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
