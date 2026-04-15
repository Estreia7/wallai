"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { LEARN_TRAITS, CORE_TRAIT_INDICES, WEALTH_TRAIT_INDICES } from "@/lib/wallai/learn/traits";

type Props = {
  profile: number[];
};

export function ProfileRadar({ profile }: Props) {
  const core = CORE_TRAIT_INDICES.map((i) => ({
    trait: LEARN_TRAITS[i],
    value: Number(profile[i].toFixed(1)),
  }));
  const wealth = WEALTH_TRAIT_INDICES.map((i) => ({
    trait: LEARN_TRAITS[i],
    value: Number(profile[i].toFixed(1)),
  }));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <RadarPanel title="Core literacy" data={core} />
      <RadarPanel title="Wealth building" data={wealth} />
    </div>
  );
}

function RadarPanel({
  title,
  data,
}: {
  title: string;
  data: Array<{ trait: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">{title}</p>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="trait"
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 9 }}
            />
            <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
