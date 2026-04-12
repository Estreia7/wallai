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

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: {
    category?: string | null;
    description?: string;
    amount?: number;
    notes?: string | null;
  } = {};

  if (typeof body?.category === "string") data.category = body.category || null;
  if (body?.category === null) data.category = null;
  if (typeof body?.description === "string" && body.description.trim()) {
    data.description = body.description.trim();
  }
  if (typeof body?.amount === "number" && Number.isFinite(body.amount)) {
    data.amount = body.amount;
  }
  if (typeof body?.notes === "string") data.notes = body.notes || null;
  if (body?.notes === null) data.notes = null;

  const updated = await prisma.transaction.update({ where: { id }, data });
  return NextResponse.json({ transaction: updated });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
