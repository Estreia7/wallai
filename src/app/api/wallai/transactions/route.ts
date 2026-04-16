import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

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
