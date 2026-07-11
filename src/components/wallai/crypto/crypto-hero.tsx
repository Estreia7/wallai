import { GlassCard } from "@/components/wallai/glass-card";
import type { CryptoTotals } from "@/lib/wallai/crypto/types";

function formatCurrency(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function CryptoHero({ totals }: { totals: CryptoTotals }) {
  const hasCoins = totals.coinCount > 0;
  const pnlColor =
    totals.totalPnlEur > 0
      ? "text-emerald-400"
      : totals.totalPnlEur < 0
        ? "text-red-400"
        : "text-white/70";
  const pnlSign = totals.totalPnlEur >= 0 ? "+" : "";

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 pointer-events-none" />
      <div className="relative">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/70 sm:text-xs">
          Total Crypto Value
        </p>
        <p className="mt-1 text-2xl font-bold text-white sm:mt-2 sm:text-4xl">
          {formatCurrency(totals.totalValueEur)}
        </p>
        {hasCoins && totals.totalPnlPct !== null ? (
          <p className={`mt-1 text-xs font-medium sm:text-sm ${pnlColor}`}>
            {pnlSign}
            {formatCurrency(totals.totalPnlEur)}{" "}
            ({formatPct(totals.totalPnlPct)}) unrealized
          </p>
        ) : (
          <p className="mt-1 text-xs text-white/70 sm:text-sm">
            {hasCoins ? "—" : "No holdings yet"}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
