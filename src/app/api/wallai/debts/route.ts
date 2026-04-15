import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDebtType } from "@/lib/wallai/debt-types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const debts = await prisma.debt.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ debts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const type = typeof body?.type === "string" && isDebtType(body.type) ? body.type : "other";
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "EUR";
  const originalAmount = typeof body?.originalAmount === "number" ? body.originalAmount : 0;
  const currentBalance = typeof body?.currentBalance === "number" ? body.currentBalance : 0;
  const interestRate = typeof body?.interestRate === "number" ? body.interestRate : 0;
  const monthlyPayment = typeof body?.monthlyPayment === "number" ? body.monthlyPayment : 0;
  const startDate = typeof body?.startDate === "string" ? new Date(body.startDate) : new Date();
  const endDate = typeof body?.endDate === "string" && body.endDate ? new Date(body.endDate) : null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be 3 letters" }, { status: 400 });
  }
  if (originalAmount < 0 || currentBalance < 0 || interestRate < 0 || monthlyPayment < 0) {
    return NextResponse.json({ error: "Amounts must be non-negative" }, { status: 400 });
  }
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }

  const debt = await prisma.debt.create({
    data: {
      userId: session.user.id,
      name,
      type,
      currency,
      originalAmount,
      currentBalance,
      interestRate,
      monthlyPayment,
      startDate,
      endDate,
      notes,
    },
  });

  return NextResponse.json({ debt }, { status: 201 });
}
