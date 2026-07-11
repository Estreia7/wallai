"use client";

import { useId } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type NetWorthChartProps = {
  data: Array<{ month: string; value: number }>;
  currency: string;
};

function formatShortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-IE", { month: "short" }).format(date);
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { month: string } }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs">
      <p className="text-white/50">{p.payload.month}</p>
      <p className="font-semibold text-white">
        {new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(p.value)}
      </p>
    </div>
  );
}

function formatYTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1000)}k`;
  return `${Math.round(v)}`;
}

export function NetWorthChart({ data, currency }: NetWorthChartProps) {
  const gradientId = useId();
  const hasEnough = data.length >= 2;

  return (
    <GlassCard className="relative overflow-hidden xl:col-span-2">
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Net Worth Trend
      </h3>
      {hasEnough ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.map((p) => ({ ...p, label: formatShortMonth(p.month) }))}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
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
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-center text-xs text-white/70 sm:text-sm">
            Upload more statements to see your trend
          </p>
        </div>
      )}
    </GlassCard>
  );
}
