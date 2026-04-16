"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";
import type { MonthlyFlow } from "@/lib/wallai/analysis-data";

function formatShortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-IE", { month: "short" }).format(d);
}

function formatYTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1000)}k`;
  return `${Math.round(v)}`;
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs">
      {payload.map((p) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {fmt.format(p.value)}
        </p>
      ))}
    </div>
  );
}

export function MonthlyFlowChart({
  data,
  currency,
}: {
  data: MonthlyFlow[];
  currency: string;
}) {
  const chartData = data.map((p) => ({ ...p, label: formatShortMonth(p.month) }));

  return (
    <GlassCard className="relative overflow-hidden">
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Monthly income vs expenses
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11 }}
            tickFormatter={formatYTick}
            width={45}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            content={<ChartTooltip currency={currency} />}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
