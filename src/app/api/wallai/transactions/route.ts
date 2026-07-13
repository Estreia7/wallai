import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { learnFromCorrection } from "@/lib/wallai/knowledge/matcher";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const bankAccountId = url.searchParams.get("bankAccountId");
  const institutionId = url.searchParams.get("institutionId");
  const category = url.searchParams.get("category");
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100", 10), 500);

  const where: Prisma.TransactionWhereInput = { userId: session.user.id };
  if (bankAccountId) {
    where.bankAccountId = bankAccountId;
  } else if (institutionId) {
    where.bankAccount = { institutionId };
  }
  if (category) where.category = category;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { date: "desc" },
    take: limit,
    include: {
      bankAccount: { select: { id: true, name: true, currency: true } },
    },
  });

  return NextResponse.json({ transactions });
}

/**
 * Bulk-assign a category to many transactions at once. Each affected
 * transaction also teaches the categorizer via learnFromCorrection, so a bulk
 * fix trains the system the same way single edits do.
 * Body: { ids: string[], category: string }
 */
export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;
  const body = await request.json();
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : [];
  const category = typeof body?.category === "string" ? body.category : null;
  if (ids.length === 0 || !category) {
    return NextResponse.json({ error: "ids and category required" }, { status: 400 });
  }

  // Only touch the user's own transactions.
  const txs = await prisma.transaction.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, description: true },
  });

  await prisma.transaction.updateMany({
    where: { id: { in: txs.map((t) => t.id) }, userId },
    data: { category },
  });

  // Teach one rule per distinct description so future imports match.
  const seenDesc = new Set<string>();
  for (const t of txs) {
    if (seenDesc.has(t.description)) continue;
    seenDesc.add(t.description);
    await learnFromCorrection(userId, t.description, category);
  }

  return NextResponse.json({ updated: txs.length });
}
