import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { endpointCategory, USAGE_CATEGORY_ORDER } from "@/lib/wallai/ai-usage-categories";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month");

  const now = new Date();
  let year: number, month: number;

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m;
  } else {
    year = now.getFullYear();
    month = now.getMonth() + 1;
  }

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 1));

  const usageRows = await prisma.apiUsage.findMany({
    where: {
      userId: session.user.id,
      createdAt: { gte: startDate, lt: endDate },
    },
    orderBy: { createdAt: "asc" },
  });

  let totalCost = 0;
  const dailyMap = new Map<string, {
    date: string;
    cost: number;
    calls: number;
    details: Array<{
      endpoint: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
      createdAt: string;
    }>;
  }>();

  for (const row of usageRows) {
    totalCost += row.estimatedCost;
    const dayKey = row.createdAt.toISOString().split("T")[0];

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, { date: dayKey, cost: 0, calls: 0, details: [] });
    }
    const day = dailyMap.get(dayKey)!;
    day.cost += row.estimatedCost;
    day.calls += 1;
    day.details.push({
      endpoint: row.endpoint,
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cost: row.estimatedCost,
      createdAt: row.createdAt.toISOString(),
    });
  }

  // Per-category breakdown (current month), ordered.
  const catMap = new Map<string, { cost: number; calls: number }>();
  for (const row of usageRows) {
    const c = endpointCategory(row.endpoint);
    const e = catMap.get(c) ?? { cost: 0, calls: 0 };
    e.cost += row.estimatedCost;
    e.calls += 1;
    catMap.set(c, e);
  }
  const byCategory = USAGE_CATEGORY_ORDER.filter((c) => catMap.has(c)).map((c) => ({
    category: c,
    ...catMap.get(c)!,
  }));

  // Per-model breakdown (current month).
  const modelMap = new Map<string, { cost: number; calls: number }>();
  for (const row of usageRows) {
    const e = modelMap.get(row.model) ?? { cost: 0, calls: 0 };
    e.cost += row.estimatedCost;
    e.calls += 1;
    modelMap.set(row.model, e);
  }
  const byModel = Array.from(modelMap.entries()).map(([model, v]) => ({ model, ...v }));

  // Monthly trend (last 6 months, always-present buckets).
  const trendStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const trendRows = await prisma.apiUsage.findMany({
    where: { userId: session.user.id, createdAt: { gte: trendStart } },
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
  const monthlyTrend = Array.from(trendMap.entries()).map(([month, cost]) => ({ month, cost }));

  return NextResponse.json({
    totalCost,
    totalCalls: usageRows.length,
    dailyData: Array.from(dailyMap.values()),
    byCategory,
    byModel,
    monthlyTrend,
  });
}
