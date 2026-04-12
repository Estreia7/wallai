"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type UsageDetail = {
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  createdAt: string;
};

type DailyData = {
  date: string;
  cost: number;
  calls: number;
  details: UsageDetail[];
};

type UsageResponse = {
  totalCost: number;
  totalCalls: number;
  dailyData: DailyData[];
};

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  return new Intl.DateTimeFormat("en-IE", { day: "numeric", month: "short" }).format(d);
}

function formatCost(v: number): string {
  return `$${v.toFixed(4)}`;
}

function formatModel(model: string): string {
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" });
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { calls: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
      <p className="font-semibold text-emerald-400">{formatCost(data.value)}</p>
      <p className="text-white/50">{data.payload.calls} call{data.payload.calls !== 1 ? "s" : ""}</p>
    </div>
  );
}

export function UsageCard() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/wallai/usage")
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold text-white">API Usage</h3>
        <p className="text-xs text-white/40">Loading...</p>
      </GlassCard>
    );
  }

  if (!data) {
    return (
      <GlassCard>
        <h3 className="mb-4 text-sm font-semibold text-white">API Usage</h3>
        <p className="text-xs text-white/40">Failed to load usage data.</p>
      </GlassCard>
    );
  }

  const chartData = data.dailyData.map((d) => ({
    ...d,
    label: formatDay(d.date),
  }));

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
              Cost this month
            </p>
            <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
              {formatCost(data.totalCost)}
            </p>
          </div>
        </GlassCard>
        <GlassCard className="relative overflow-hidden">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 pointer-events-none" />
          <div className="relative">
            <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
              API calls this month
            </p>
            <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
              {data.totalCalls}
            </p>
          </div>
        </GlassCard>
      </div>

      {/* Daily chart */}
      {chartData.length > 0 && (
        <GlassCard className="relative overflow-hidden">
          <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
            Daily Cost
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
              <YAxis
                stroke="rgba(255,255,255,0.2)"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: number) => `$${v.toFixed(3)}`}
                width={55}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.05)" }}
                content={<ChartTooltip />}
              />
              <Bar dataKey="cost" name="Cost" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCard>
      )}

      {/* Per-day breakdown */}
      {data.dailyData.length > 0 && (
        <GlassCard>
          <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">
            Daily Breakdown
          </h3>
          <div className="space-y-1">
            {data.dailyData.map((day) => (
              <div key={day.date}>
                <button
                  onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{formatDay(day.date)}</span>
                    <span className="text-xs text-white/40">{day.calls} call{day.calls !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-emerald-400">{formatCost(day.cost)}</span>
                    <svg
                      className={`h-4 w-4 text-white/30 transition-transform ${expandedDay === day.date ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedDay === day.date && (
                  <div className="mb-2 ml-3 border-l border-white/10 pl-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-white/30">
                          <th className="pb-1 text-left font-medium">Time</th>
                          <th className="pb-1 text-left font-medium">Endpoint</th>
                          <th className="pb-1 text-left font-medium">Model</th>
                          <th className="pb-1 text-right font-medium">Tokens</th>
                          <th className="pb-1 text-right font-medium">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {day.details.map((d, i) => (
                          <tr key={i} className="text-white/60">
                            <td className="py-1">{formatTime(d.createdAt)}</td>
                            <td className="py-1">{d.endpoint}</td>
                            <td className="py-1">{formatModel(d.model)}</td>
                            <td className="py-1 text-right">
                              {(d.inputTokens + d.outputTokens).toLocaleString()}
                            </td>
                            <td className="py-1 text-right text-emerald-400/80">
                              {formatCost(d.cost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
