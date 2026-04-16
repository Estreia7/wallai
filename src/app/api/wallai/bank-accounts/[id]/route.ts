import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBankAccountType } from "@/lib/wallai/bank-account-types";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    name?: string;
    currency?: string;
    type?: string;
    currentBalance?: number;
    institutionId?: string | null;
  } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.currency === "string" && body.currency.trim().length === 3) {
    data.currency = body.currency.trim().toUpperCase();
  }
  if (typeof body?.type === "string" && isBankAccountType(body.type)) {
    data.type = body.type;
  }
  if (typeof body?.currentBalance === "number") {
    data.currentBalance = body.currentBalance;
  }
  if (body && typeof body === "object" && "institutionId" in body) {
    if (body.institutionId === null) {
      data.institutionId = null;
    } else if (typeof body.institutionId === "string" && body.institutionId) {
      const institution = await prisma.institution.findUnique({
        where: { id: body.institutionId },
        select: { userId: true },
      });
      if (!institution || institution.userId !== session.user.id) {
        return NextResponse.json({ error: "Invalid institution" }, { status: 400 });
      }
      data.institutionId = body.institutionId;
    } else {
      return NextResponse.json({ error: "Invalid institutionId" }, { status: 400 });
    }
  }

  const account = await prisma.bankAccount.update({ where: { id }, data });
  return NextResponse.json({ account });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.bankAccount.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.bankAccount.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
