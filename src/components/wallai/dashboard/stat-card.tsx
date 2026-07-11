import { GlassCard } from "@/components/wallai/glass-card";

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string | null;
  gradient: string;
  configured: boolean;
  warning?: string | null;
};

export function StatCard({
  label,
  value,
  subtext,
  gradient,
  configured,
  warning,
}: StatCardProps) {
  return (
    <GlassCard
      className={`relative overflow-hidden ${configured ? "" : "opacity-50"}`}
    >
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} pointer-events-none`}
      />
      <div className="relative">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/70 sm:text-xs">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
          {value}
        </p>
        {subtext && (
          <p className="mt-0.5 text-[10px] font-medium text-white/50 sm:mt-1 sm:text-xs">
            {subtext}
          </p>
        )}
        {!configured && (
          <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50 sm:text-[10px]">
            Not configured
          </span>
        )}
        {warning && (
          <p className="mt-1.5 text-[10px] text-amber-300/80 sm:text-xs">
            ⚠ {warning}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
