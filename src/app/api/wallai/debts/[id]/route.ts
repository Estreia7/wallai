import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isDebtType } from "@/lib/wallai/debt-types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.type === "string" && isDebtType(body.type)) data.type = body.type;
  if (typeof body?.currency === "string" && body.currency.trim().length === 3) {
    data.currency = body.currency.trim().toUpperCase();
  }
  if (typeof body?.originalAmount === "number" && body.originalAmount >= 0) {
    data.originalAmount = body.originalAmount;
  }
  if (typeof body?.currentBalance === "number" && body.currentBalance >= 0) {
    data.currentBalance = body.currentBalance;
  }
  if (typeof body?.interestRate === "number" && body.interestRate >= 0) {
    data.interestRate = body.interestRate;
  }
  if (typeof body?.monthlyPayment === "number" && body.monthlyPayment >= 0) {
    data.monthlyPayment = body.monthlyPayment;
  }
  if (typeof body?.startDate === "string") {
    const d = new Date(body.startDate);
    if (!Number.isNaN(d.getTime())) data.startDate = d;
  }
  if (body?.endDate === null || body?.endDate === "") {
    data.endDate = null;
  } else if (typeof body?.endDate === "string") {
    const d = new Date(body.endDate);
    if (!Number.isNaN(d.getTime())) data.endDate = d;
  }
  if (body?.notes === null || body?.notes === "") {
    data.notes = null;
  } else if (typeof body?.notes === "string") {
    data.notes = body.notes.trim() || null;
  }

  const debt = await prisma.debt.update({ where: { id }, data });
  return NextResponse.json({ debt });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.debt.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.debt.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
