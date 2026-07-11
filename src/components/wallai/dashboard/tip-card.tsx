import { GlassCard } from "@/components/wallai/glass-card";
import type { DashboardData } from "@/lib/wallai/dashboard-data";

type TipCardProps = {
  tip: DashboardData["tip"];
};

export function TipCard({ tip }: TipCardProps) {
  if (!tip) {
    return (
      <GlassCard className="flex items-center justify-center">
        <p className="text-xs text-white/70 sm:text-sm">No tip today</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col justify-between">
      <div>
        <span className="inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50 sm:text-[10px]">
          {tip.type}
        </span>
        <p className="mt-3 text-sm italic text-white/80 sm:text-base">
          &ldquo;{tip.content}&rdquo;
        </p>
      </div>
      {tip.author && (
        <p className="mt-3 text-xs text-white/50">— {tip.author}</p>
      )}
    </GlassCard>
  );
}
