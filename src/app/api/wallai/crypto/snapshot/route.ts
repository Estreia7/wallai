import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coinList, fetchPrices } from "@/lib/wallai/crypto/coingecko";

export async function POST(request: Request) {
  const expected = process.env.WALLAI_SNAPSHOT_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "WALLAI_SNAPSHOT_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("x-snapshot-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const holdings = await prisma.cryptoHolding.findMany({
    select: {
      id: true,
      coinId: true,
      symbol: true,
      name: true,
      quantity: true,
    },
  });

  if (holdings.length === 0) {
    return NextResponse.json({ snapshotted: 0, missingPrice: 0, renamed: 0 });
  }

  const uniqueCoinIds = [...new Set(holdings.map((h) => h.coinId))];
  const prices = await fetchPrices(uniqueCoinIds);
  const meta = await coinList();
  const metaByCoinId = new Map(meta.map((c) => [c.id, c]));

  let missingPrice = 0;
  let renamed = 0;

  const snapshotOps = holdings.map((h) => {
    const priceEur = prices.get(h.coinId);
    if (priceEur == null) missingPrice++;
    const safePrice = priceEur ?? 0;
    const valueEur = h.quantity * safePrice;
    return prisma.cryptoSnapshot.upsert({
      where: { holdingId_date: { holdingId: h.id, date: today } },
      create: {
        holdingId: h.id,
        date: today,
        quantity: h.quantity,
        priceEur: safePrice,
        valueEur,
      },
      update: {
        quantity: h.quantity,
        priceEur: safePrice,
        valueEur,
      },
    });
  });

  const renameOps = holdings
    .map((h) => {
      const m = metaByCoinId.get(h.coinId);
      if (!m) return null;
      if (m.symbol === h.symbol && m.name === h.name) return null;
      renamed++;
      return prisma.cryptoHolding.update({
        where: { id: h.id },
        data: { symbol: m.symbol, name: m.name },
      });
    })
    .filter((op): op is NonNullable<typeof op> => op !== null);

  await prisma.$transaction([...snapshotOps, ...renameOps]);

  return NextResponse.json({
    snapshotted: holdings.length,
    missingPrice,
    renamed,
  });
}
