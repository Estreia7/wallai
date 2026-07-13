import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";

/** App-wide AI usage totals across all users (admin backend). */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [allTime, thisMonth] = await Promise.all([
    prisma.apiUsage.aggregate({ _sum: { estimatedCost: true }, _count: { _all: true } }),
    prisma.apiUsage.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { estimatedCost: true },
      _count: { _all: true },
    }),
  ]);

  // Last 6 months trend (all users combined).
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const trendRows = await prisma.apiUsage.findMany({
    where: { createdAt: { gte: trendStart } },
    select: { estimatedCost: true, createdAt: true },
  });
  const trendMap = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    trendMap.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, 0);
  }
  for (const r of trendRows) {
    const key = `${r.createdAt.getUTCFullYear()}-${String(r.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
    if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + r.estimatedCost);
  }

  return NextResponse.json({
    allTimeCost: allTime._sum.estimatedCost ?? 0,
    allTimeCalls: allTime._count._all,
    thisMonthCost: thisMonth._sum.estimatedCost ?? 0,
    thisMonthCalls: thisMonth._count._all,
    monthlyTrend: Array.from(trendMap.entries()).map(([month, cost]) => ({ month, cost })),
  });
}
