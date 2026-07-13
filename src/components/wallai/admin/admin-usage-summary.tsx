"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type Usage = {
  allTimeCost: number;
  allTimeCalls: number;
  thisMonthCost: number;
  thisMonthCalls: number;
  monthlyTrend: { month: string; cost: number }[];
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <GlassCard>
      <p className="kicker">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-white sm:text-xl">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-white/50">{sub}</p>}
    </GlassCard>
  );
}

export function AdminUsageSummary() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    fetch("/api/wallai/admin/usage")
      .then((r) => r.json())
      .then((d) => setUsage(d))
      .catch(() => {});
  }, []);

  if (!usage) {
    return <p className="text-xs text-white/70">Loading usage…</p>;
  }

  const peak = Math.max(...usage.monthlyTrend.map((m) => m.cost), 0.0001);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="AI spend (all time)" value={`$${usage.allTimeCost.toFixed(2)}`} sub={`${usage.allTimeCalls} calls`} />
        <Stat label="AI spend (this month)" value={`$${usage.thisMonthCost.toFixed(2)}`} sub={`${usage.thisMonthCalls} calls`} />
      </div>

      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">AI spend — last 6 months (all users)</h3>
        <div className="flex items-end gap-2" style={{ height: 120 }}>
          {usage.monthlyTrend.map((m) => (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t bg-gradient-to-t from-cyan-500/40 to-emerald-400/70"
                  style={{ height: `${Math.max((m.cost / peak) * 100, 2)}%` }}
                  title={`$${m.cost.toFixed(2)}`}
                />
              </div>
              <span className="text-[9px] text-white/40">{m.month.slice(5)}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
