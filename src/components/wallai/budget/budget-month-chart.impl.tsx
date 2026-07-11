"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function fmt(currency: string) {
  return (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function BudgetMonthChart({ data, currency }: { data: { category: string; amount: number }[]; currency: string }) {
  const rows = data.slice(0, 8);
  const f = fmt(currency);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} tickFormatter={(v) => f(Number(v))} />
        <YAxis type="category" dataKey="category" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} width={90} />
        <Tooltip
          formatter={(value) => f(Number(value))}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="amount" fill="#f87171" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
