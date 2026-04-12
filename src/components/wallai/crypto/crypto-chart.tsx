"use client";

import { useId, useMemo, useState } from "react";
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
import type { SnapshotPoint } from "@/lib/wallai/crypto/types";

type Window = 30 | 90 | 365;

function formatTick(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-IE", { month: "short", day: "numeric" }).format(dt);
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
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
      <p className="text-white/50">{formatTick(p.payload.date)}</p>
      <p className="font-semibold text-white">
        {new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(p.value)}
      </p>
    </div>
  );
}

export function CryptoChart({ snapshots }: { snapshots: SnapshotPoint[] }) {
  const gradientId = useId();
  const [win, setWin] = useState<Window>(30);

  const filtered = useMemo(() => {
    if (snapshots.length === 0) return [];
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - win);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return snapshots.filter((s) => s.date >= cutoffIso);
  }, [snapshots, win]);

  const hasEnough = filtered.length >= 2;

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h3 className="text-xs font-semibold text-white/70 sm:text-sm">
          Portfolio Value
        </h3>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          {[30, 90, 365].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setWin(n as Window)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors sm:text-xs ${
                win === n
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      {hasEnough ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={filtered.map((p) => ({ ...p, label: formatTick(p.date) }))}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fontSize: 11 }}
              tickFormatter={formatYTick}
              width={45}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="valueEur"
              stroke="#06b6d4"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-center text-xs text-white/40 sm:text-sm">
            Not enough history yet — the nightly job fills this in over time.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
