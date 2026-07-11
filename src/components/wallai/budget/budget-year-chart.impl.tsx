"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { BudgetMonthTotals } from "@/lib/wallai/budget-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(currency: string) {
  return (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function BudgetYearChart({ months, currency }: { months: BudgetMonthTotals[]; currency: string }) {
  const rows = months.map((m, i) => ({ label: MONTHS[i], income: m.income, expenses: m.expenses }));
  const f = fmt(currency);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
        <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => f(Number(v))} />
        <Tooltip
          formatter={(value, name) => [f(Number(value)), name] as [string, string]}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
