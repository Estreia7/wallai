"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";
import { UsageDailyChart } from "./usage-daily-chart";
import { UsageTrendChart } from "./usage-trend-chart";
import { UsageCategoryDonut } from "./usage-category-donut";

type UsageData = {
  totalCost: number;
  totalCalls: number;
  dailyData: Array<{ date: string; cost: number; calls: number }>;
  byCategory: Array<{ category: string; cost: number; calls: number }>;
  byModel: Array<{ model: string; cost: number; calls: number }>;
  monthlyTrend: Array<{ month: string; cost: number }>;
};

function usd(v: number): string {
  return `$${v.toFixed(v >= 1 ? 2 : 4)}`;
}

const CAT_COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24", "#f472b6", "#94a3b8"];

export function UsageClient() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallai/usage")
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load usage");
        return r.json();
      })
      .then((d: UsageData) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const monthLabel = new Intl.DateTimeFormat("en-IE", { month: "long", year: "numeric" }).format(new Date());
  const prevCost = data && data.monthlyTrend.length >= 2 ? data.monthlyTrend[data.monthlyTrend.length - 2].cost : null;
  const delta = data && prevCost !== null ? data.totalCost - prevCost : null;

  return (
    <>
      <div className="mb-6 sm:mb-8">
        <h2 className="section-title">AI Usage & Cost</h2>
        <p className="lead mt-1 text-xs sm:text-sm">Anthropic API spend by day, month, and category — {monthLabel}</p>
      </div>

      {loading && <GlassCard><p className="text-sm text-white/60">Loading usage…</p></GlassCard>}
      {error && (
        <GlassCard><p className="text-sm text-red-400">{error}</p></GlassCard>
      )}

      {data && !loading && (
        <>
          {/* Totals */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-4">
            <GlassCard>
              <p className="kicker">This month</p>
              <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{usd(data.totalCost)}</p>
              {delta !== null && (
                <p className={`mt-0.5 text-xs ${delta >= 0 ? "text-amber-300" : "text-emerald-300"}`}>
                  {delta >= 0 ? "▲" : "▼"} {usd(Math.abs(delta))} vs last month
                </p>
              )}
            </GlassCard>
            <GlassCard>
              <p className="kicker">API calls</p>
              <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{data.totalCalls}</p>
            </GlassCard>
            <GlassCard>
              <p className="kicker">Categories</p>
              <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{data.byCategory.length}</p>
            </GlassCard>
            <GlassCard>
              <p className="kicker">Models</p>
              <p className="mt-1 text-xl font-bold text-white sm:text-2xl">{data.byModel.length}</p>
            </GlassCard>
          </div>

          {/* Charts */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-2">
            <GlassCard>
              <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Cost per day</h3>
              <UsageDailyChart data={data.dailyData} />
            </GlassCard>
            <GlassCard>
              <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Cost per month</h3>
              <UsageTrendChart data={data.monthlyTrend} />
            </GlassCard>
          </div>

          {/* Category breakdown */}
          <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
            <GlassCard>
              <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">By category</h3>
              <UsageCategoryDonut data={data.byCategory} />
            </GlassCard>
            <GlassCard>
              <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Breakdown</h3>
              {data.byCategory.length === 0 ? (
                <p className="text-sm text-white/60">No AI usage yet this month.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {data.byCategory.map((c, i) => (
                    <li key={c.category} className="flex items-center gap-3 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CAT_COLORS[i % CAT_COLORS.length] }} />
                      <span className="min-w-0 flex-1 truncate text-white/80">{c.category}</span>
                      <span className="shrink-0 text-white/50">{c.calls} calls</span>
                      <span className="shrink-0 font-semibold text-white">{usd(c.cost)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>
        </>
      )}
    </>
  );
}
