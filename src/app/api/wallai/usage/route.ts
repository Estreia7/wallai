import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({
    totalCost,
    totalCalls: usageRows.length,
    dailyData: Array.from(dailyMap.values()),
  });
}
