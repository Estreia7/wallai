import { prisma } from "@/lib/prisma";
import type {
  HoldingDTO,
  HoldingWithLivePrice,
  CryptoTotals,
  SnapshotPoint,
} from "./types";

export function computeTotals(
  holdings: HoldingDTO[],
  priceMap: Map<string, number>,
): { totals: CryptoTotals; enriched: HoldingWithLivePrice[] } {
  let totalValueEur = 0;
  let totalCostEur = 0;

  const enriched: HoldingWithLivePrice[] = holdings.map((h) => {
    const priceEur = priceMap.get(h.coinId) ?? null;
    const valueEur = priceEur !== null ? h.quantity * priceEur : 0;
    const costBasisEur = h.quantity * h.avgCostEur;
    const pnlEur = valueEur - costBasisEur;
    const pnlPct = costBasisEur > 0 ? (pnlEur / costBasisEur) * 100 : null;
    totalValueEur += valueEur;
    totalCostEur += costBasisEur;
    return { ...h, priceEur, valueEur, costBasisEur, pnlEur, pnlPct };
  });

  const totalPnlEur = totalValueEur - totalCostEur;
  const totalPnlPct = totalCostEur > 0 ? (totalPnlEur / totalCostEur) * 100 : null;

  return {
    totals: {
      totalValueEur,
      totalCostEur,
      totalPnlEur,
      totalPnlPct,
      coinCount: holdings.length,
    },
    enriched,
  };
}

export function mergeHolding(
  existing: { quantity: number; avgCostEur: number },
  incoming: { quantity: number; avgCostEur: number },
): { quantity: number; avgCostEur: number } {
  const newQty = existing.quantity + incoming.quantity;
  if (newQty <= 0) {
    return { quantity: 0, avgCostEur: incoming.avgCostEur };
  }
  const newAvgCost =
    (existing.quantity * existing.avgCostEur +
      incoming.quantity * incoming.avgCostEur) /
    newQty;
  return { quantity: newQty, avgCostEur: newAvgCost };
}

export async function loadHoldings(userId: string): Promise<HoldingDTO[]> {
  const rows = await prisma.cryptoHolding.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    coinId: r.coinId,
    symbol: r.symbol,
    name: r.name,
    quantity: r.quantity,
    avgCostEur: r.avgCostEur,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function loadSnapshots(
  userId: string,
  opts: { days: number },
): Promise<SnapshotPoint[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - opts.days);

  const rows = await prisma.$queryRaw<Array<{ date: Date; total: number }>>`
    SELECT s."date" AS date, SUM(s."valueEur")::float AS total
    FROM "CryptoSnapshot" s
    JOIN "CryptoHolding" h ON h."id" = s."holdingId"
    WHERE h."userId" = ${userId}
      AND s."date" >= ${since}
    GROUP BY s."date"
    ORDER BY s."date" ASC
  `;

  return rows.map((r) => ({
    date: toIsoDate(r.date),
    valueEur: r.total,
  }));
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
