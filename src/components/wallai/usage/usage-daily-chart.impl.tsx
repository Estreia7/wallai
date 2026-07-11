"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type DailyPoint = { date: string; cost: number };

function fmtUsd(v: number): string {
  return `$${v.toFixed(v >= 1 ? 2 : 3)}`;
}

export function UsageDailyChart({ data }: { data: DailyPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: d.date.slice(8) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={rows}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
        <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} width={48} tickFormatter={fmtUsd} />
        <Tooltip
          formatter={(value) => [fmtUsd(Number(value)), "Cost"] as [string, string]}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="cost" fill="#34d399" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
