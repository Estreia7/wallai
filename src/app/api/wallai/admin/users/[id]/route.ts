import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin";

type RouteContext = { params: Promise<{ id: string }> };

const PLANS = new Set(["free", "paid"]);

/** Update a user's plan (free/paid). Admin only. */
export async function PATCH(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json();

  const data: { plan?: string } = {};
  if (typeof body?.plan === "string") {
    if (!PLANS.has(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }
    data.plan = body.plan;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, plan: true },
  });
  return NextResponse.json({ user: updated });
}
