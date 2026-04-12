import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.cryptoHolding.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: { quantity?: number; avgCostEur?: number } = {};
  if (typeof body?.quantity === "number" && Number.isFinite(body.quantity) && body.quantity > 0) {
    data.quantity = body.quantity;
  }
  if (
    typeof body?.avgCostEur === "number" &&
    Number.isFinite(body.avgCostEur) &&
    body.avgCostEur >= 0
  ) {
    data.avgCostEur = body.avgCostEur;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update (quantity and/or avgCostEur required)" },
      { status: 400 },
    );
  }

  const holding = await prisma.cryptoHolding.update({ where: { id }, data });
  return NextResponse.json({ holding });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.cryptoHolding.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.cryptoHolding.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
