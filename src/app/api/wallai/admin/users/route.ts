import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";

/** List all users with per-user stats (transaction count + total AI spend). */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      plan: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  });

  // Aggregate AI spend per user in one grouped query.
  const spendRows = await prisma.apiUsage.groupBy({
    by: ["userId"],
    _sum: { estimatedCost: true },
    _count: { _all: true },
  });
  const spendByUser = new Map(
    spendRows.map((r) => [r.userId, { cost: r._sum.estimatedCost ?? 0, calls: r._count._all }]),
  );

  const result = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    plan: u.plan,
    createdAt: u.createdAt.toISOString(),
    transactionCount: u._count.transactions,
    aiSpend: spendByUser.get(u.id)?.cost ?? 0,
    aiCalls: spendByUser.get(u.id)?.calls ?? 0,
  }));

  return NextResponse.json({ users: result });
}
