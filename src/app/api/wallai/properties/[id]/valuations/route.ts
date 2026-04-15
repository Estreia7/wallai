import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property || property.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const estimatedValue =
    typeof body?.estimatedValue === "number" ? body.estimatedValue : NaN;
  const notes = typeof body?.notes === "string" ? body.notes.trim() || null : null;

  if (!Number.isFinite(estimatedValue) || estimatedValue < 0) {
    return NextResponse.json({ error: "Value must be a non-negative number" }, { status: 400 });
  }

  const valuation = await prisma.propertyValuation.create({
    data: { propertyId: id, estimatedValue, notes },
  });

  return NextResponse.json({ valuation }, { status: 201 });
}
