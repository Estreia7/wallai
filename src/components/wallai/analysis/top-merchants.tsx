import { GlassCard } from "@/components/wallai/glass-card";
import type { TopMerchant } from "@/lib/wallai/analysis-data";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function TopMerchantsCard({
  merchants,
  currency,
}: {
  merchants: TopMerchant[];
  currency: string;
}) {
  return (
    <GlassCard>
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Top spending destinations
      </h3>
      {merchants.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/70">No expenses in this period.</p>
      ) : (
        <div className="space-y-1.5">
          {merchants.map((m, idx) => (
            <div
              key={m.description}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.03]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-[10px] font-semibold text-white/50 tabular-nums">
                  #{idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs text-white/90 sm:text-sm">{m.description}</p>
                  <p className="text-[10px] text-white/70">
                    {m.count} {m.count === 1 ? "transaction" : "transactions"}
                  </p>
                </div>
              </div>
              <p className="shrink-0 text-xs font-semibold tabular-nums text-white sm:text-sm">
                {formatCurrency(m.amount, currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
