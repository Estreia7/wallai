"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type AllocationDonutProps = {
  data: Array<{ name: string; value: number; color: string }>;
  currency: string;
};

export function AllocationDonut({ data, currency }: AllocationDonutProps) {
  const fmt = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  return (
    <GlassCard className="relative overflow-hidden">
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Asset Allocation
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={data.length > 1 ? 4 : 0}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { name: string; value: number };
              return (
                <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
                  <p className="text-white/50">{d.name}</p>
                  <p className="font-semibold text-white">{fmt.format(d.value)}</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-2 sm:gap-3">
        {data.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-1.5 text-[10px] text-white/50 sm:text-xs"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
