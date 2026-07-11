import { GlassCard } from "@/components/wallai/glass-card";
import type { CategoryBreakdown } from "@/lib/wallai/analysis-data";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function CategoryBreakdownCard({
  title,
  items,
  currency,
  accent,
  emptyLabel,
}: {
  title: string;
  items: CategoryBreakdown[];
  currency: string;
  accent: "emerald" | "red";
  emptyLabel: string;
}) {
  const barClass =
    accent === "emerald"
      ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
      : "bg-gradient-to-r from-red-400 to-red-500";

  return (
    <GlassCard>
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">{title}</h3>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/70">{emptyLabel}</p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <div key={item.category}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate text-white/80">{item.category}</span>
                <span className="shrink-0 pl-2 tabular-nums text-white/60">
                  {formatCurrency(item.amount, currency)}
                  <span className="ml-1 text-[10px] text-white/50">
                    ({item.pct.toFixed(0)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className={`h-full ${barClass}`}
                  style={{ width: `${Math.max(item.pct, 1.5)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
