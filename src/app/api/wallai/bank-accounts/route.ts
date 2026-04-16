import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isBankAccountType } from "@/lib/wallai/bank-account-types";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.bankAccount.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      currency: true,
      type: true,
      currentBalance: true,
      balanceAsOf: true,
      institutionId: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "EUR";
  const type = typeof body?.type === "string" && isBankAccountType(body.type) ? body.type : "checking";
  const currentBalance = typeof body?.currentBalance === "number" ? body.currentBalance : 0;
  const institutionIdInput =
    body?.institutionId === null || body?.institutionId === undefined
      ? null
      : typeof body.institutionId === "string"
        ? body.institutionId
        : undefined;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (currency.length !== 3) {
    return NextResponse.json({ error: "Currency must be 3 letters" }, { status: 400 });
  }
  if (institutionIdInput === undefined) {
    return NextResponse.json({ error: "Invalid institutionId" }, { status: 400 });
  }

  let institutionId: string | null = null;
  if (institutionIdInput) {
    const institution = await prisma.institution.findUnique({
      where: { id: institutionIdInput },
      select: { userId: true },
    });
    if (!institution || institution.userId !== session.user.id) {
      return NextResponse.json({ error: "Invalid institution" }, { status: 400 });
    }
    institutionId = institutionIdInput;
  }

  const account = await prisma.bankAccount.create({
    data: {
      userId: session.user.id,
      name,
      currency,
      type,
      currentBalance,
      institutionId,
    },
  });

  return NextResponse.json({ account }, { status: 201 });
}
