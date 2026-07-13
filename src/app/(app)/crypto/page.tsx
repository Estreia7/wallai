import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import {
  loadHoldings,
  loadSnapshots,
  computeTotals,
} from "@/lib/wallai/crypto/crypto-data";
import { fetchPrices } from "@/lib/wallai/crypto/coingecko";
import { CryptoHero } from "@/components/wallai/crypto/crypto-hero";
import { CryptoChart } from "@/components/wallai/crypto/crypto-chart";
import { CryptoHoldingsTable } from "@/components/wallai/crypto/crypto-holdings-table";
import { CryptoAddHoldingButton } from "@/components/wallai/crypto/crypto-add-holding-modal";
import { CryptoEmptyState } from "@/components/wallai/crypto/crypto-empty-state";

export const dynamic = "force-dynamic";

export default async function CryptoPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const holdings = await loadHoldings(userId);

  let priceMap = new Map<string, number>();
  let priceError = false;
  if (holdings.length > 0) {
    try {
      priceMap = await fetchPrices(holdings.map((h) => h.coinId));
      priceError = priceMap.size === 0;
    } catch (err) {
      console.error("[wallai/crypto] fetchPrices failed", err);
      priceError = true;
    }
  }

  const snapshots = await loadSnapshots(userId, { days: 365 });

  if (priceError && holdings.length > 0) {
    priceMap = await fallbackPriceMapFromSnapshots(userId, holdings.map((h) => h.coinId));
  }

  const { totals, enriched } = computeTotals(holdings, priceMap);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="section-title">Crypto</h2>
        {holdings.length > 0 && <CryptoAddHoldingButton />}
      </div>

      {priceError && (
        <GlassCard className="mb-4 border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-300 sm:text-sm">
            ⚠ Live prices unavailable — showing last known values from the most recent snapshot.
          </p>
        </GlassCard>
      )}

      {holdings.length === 0 ? (
        <>
          <div className="mb-4">
            <CryptoAddHoldingButton />
          </div>
          <CryptoEmptyState />
        </>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <CryptoHero totals={totals} />
          <CryptoChart snapshots={snapshots} />
          <CryptoHoldingsTable holdings={enriched} />
        </div>
      )}
    </div>
  );
}

async function fallbackPriceMapFromSnapshots(
  userId: string,
  coinIds: string[],
): Promise<Map<string, number>> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRaw<
    Array<{ coinId: string; priceEur: number }>
  >`
    SELECT h."coinId" AS "coinId", s."priceEur"
    FROM "CryptoHolding" h
    JOIN "CryptoSnapshot" s ON s."holdingId" = h."id"
    WHERE h."userId" = ${userId}
      AND h."coinId" = ANY(${coinIds}::text[])
      AND s."date" = (
        SELECT MAX(s2."date")
        FROM "CryptoSnapshot" s2
        WHERE s2."holdingId" = h."id"
      )
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.coinId, row.priceEur);
  }
  return map;
}
