import { GlassCard } from "@/components/wallai/glass-card";

export function CryptoEmptyState() {
  return (
    <GlassCard className="text-center">
      <p className="text-base font-semibold text-white sm:text-lg">
        No crypto holdings yet
      </p>
      <p className="mt-2 text-xs text-white/50 sm:text-sm">
        Add your first coin to start tracking live value and unrealized P&amp;L.
        Use a popular shortcut or search any CoinGecko-listed coin.
      </p>
    </GlassCard>
  );
}
