import { GlassCard } from "@/components/wallai/glass-card";
import type { CardTone } from "@/components/ui/course-design-cards";

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string | null;
  /** Colour that carries the category: cash green, crypto blue, property orange, debt red. */
  tone: CardTone;
  configured: boolean;
  warning?: string | null;
};

export function StatCard({
  label,
  value,
  subtext,
  tone,
  configured,
  warning,
}: StatCardProps) {
  return (
    <GlassCard
      tone={tone}
      hover
      className={configured ? "" : "opacity-50"}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/70 sm:text-xs">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular-nums text-white sm:mt-2 sm:text-2xl">
        {value}
      </p>
      {subtext && (
        <p className="mt-0.5 text-[10px] font-medium text-white/70 sm:mt-1 sm:text-xs">
          {subtext}
        </p>
      )}
      {!configured && (
        <span className="mt-2 inline-block rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/70 sm:text-[10px]">
          Not configured
        </span>
      )}
      {warning && (
        <p className="mt-1.5 text-[10px] text-amber-300/90 sm:text-xs">
          {warning}
        </p>
      )}
    </GlassCard>
  );
}
