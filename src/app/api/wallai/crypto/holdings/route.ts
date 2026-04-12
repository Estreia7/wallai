import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coinList } from "@/lib/wallai/crypto/coingecko";
import { mergeHolding } from "@/lib/wallai/crypto/crypto-data";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await prisma.cryptoHolding.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ holdings });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const coinId = typeof body?.coinId === "string" ? body.coinId.trim() : "";
  const quantity = typeof body?.quantity === "number" ? body.quantity : NaN;
  const avgCostEur = typeof body?.avgCostEur === "number" ? body.avgCostEur : NaN;

  if (!coinId) {
    return NextResponse.json({ error: "coinId is required" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(avgCostEur) || avgCostEur < 0) {
    return NextResponse.json({ error: "avgCostEur must be a non-negative number" }, { status: 400 });
  }

  const all = await coinList();
  const meta = all.find((c) => c.id === coinId);
  if (!meta) {
    return NextResponse.json({ error: "Unknown coinId" }, { status: 400 });
  }

  const existing = await prisma.cryptoHolding.findUnique({
    where: { userId_coinId: { userId: session.user.id, coinId } },
  });

  let holding;
  if (existing) {
    const merged = mergeHolding(
      { quantity: existing.quantity, avgCostEur: existing.avgCostEur },
      { quantity, avgCostEur },
    );
    holding = await prisma.cryptoHolding.update({
      where: { id: existing.id },
      data: {
        quantity: merged.quantity,
        avgCostEur: merged.avgCostEur,
        symbol: meta.symbol,
        name: meta.name,
      },
    });
  } else {
    holding = await prisma.cryptoHolding.create({
      data: {
        userId: session.user.id,
        coinId,
        symbol: meta.symbol,
        name: meta.name,
        quantity,
        avgCostEur,
      },
    });
  }

  return NextResponse.json({ holding }, { status: existing ? 200 : 201 });
}
