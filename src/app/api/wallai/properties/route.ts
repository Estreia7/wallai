import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const properties = await prisma.property.findMany({
    where: { userId: session.user.id },
    include: {
      debt: { select: { id: true, name: true, currentBalance: true, currency: true } },
      valuations: {
        orderBy: { date: "desc" },
        take: 1,
        select: { id: true, estimatedValue: true, date: true },
      },
    },
  });

  return NextResponse.json({ properties });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "EUR";
  const debtId = typeof body?.debtId === "string" && body.debtId ? body.debtId : null;
  const initialValue = typeof body?.initialValue === "number" ? body.initialValue : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be 3 letters" }, { status: 400 });
  }

  if (debtId) {
    const debt = await prisma.debt.findUnique({ where: { id: debtId } });
    if (!debt || debt.userId !== session.user.id) {
      return NextResponse.json({ error: "Linked debt not found" }, { status: 400 });
    }
  }

  const property = await prisma.property.create({
    data: {
      userId: session.user.id,
      name,
      currency,
      debtId,
      valuations:
        initialValue !== null && initialValue >= 0
          ? { create: { estimatedValue: initialValue } }
          : undefined,
    },
    include: {
      debt: { select: { id: true, name: true, currentBalance: true, currency: true } },
      valuations: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({ property }, { status: 201 });
}
