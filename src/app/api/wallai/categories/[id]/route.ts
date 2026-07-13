import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

async function ownCategory(userId: string, id: string) {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat || cat.userId !== userId) return null;
  return cat;
}

/** Rewrite the category name across transactions + merchant rules for a user. */
async function renameEverywhere(userId: string, from: string, to: string) {
  await prisma.$transaction([
    prisma.transaction.updateMany({ where: { userId, category: from }, data: { category: to } }),
    prisma.merchantRule.updateMany({ where: { userId, category: from }, data: { category: to } }),
    prisma.recurringBill.updateMany({ where: { userId, category: from }, data: { category: to } }),
  ]);
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await context.params;
  const cat = await ownCategory(userId, id);
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const data: {
    name?: string;
    group?: string | null;
    color?: string | null;
    icon?: string | null;
    parentId?: string | null;
    archived?: boolean;
    sortOrder?: number;
  } = {};

  // Rename: must propagate to transactions + rules, and keep name unique.
  if (typeof body?.name === "string" && body.name.trim() && body.name.trim() !== cat.name) {
    const newName = body.name.trim();
    const clash = await prisma.category.findUnique({ where: { userId_name: { userId, name: newName } } });
    if (clash) return NextResponse.json({ error: "Name already used" }, { status: 409 });
    data.name = newName;
    await renameEverywhere(userId, cat.name, newName);
  }
  if (typeof body?.group === "string") data.group = body.group;
  if (body?.group === null) data.group = null;
  if (typeof body?.color === "string") data.color = body.color;
  if (body?.color === null) data.color = null;
  if (typeof body?.icon === "string") data.icon = body.icon;
  if (body?.icon === null) data.icon = null;
  if (typeof body?.archived === "boolean") data.archived = body.archived;
  if (typeof body?.sortOrder === "number") data.sortOrder = body.sortOrder;
  if (typeof body?.parentId === "string" || body?.parentId === null) {
    // Guard against self-parenting / cross-user parents.
    if (body.parentId === id) return NextResponse.json({ error: "Cannot parent to self" }, { status: 400 });
    if (body.parentId) {
      const parent = await ownCategory(userId, body.parentId);
      if (!parent) return NextResponse.json({ error: "Invalid parent" }, { status: 400 });
    }
    data.parentId = body.parentId;
  }

  const updated = await prisma.category.update({ where: { id }, data });
  return NextResponse.json({ category: updated });
}

/**
 * Delete a category. If `?mergeInto=<name>` is provided, reassign all
 * transactions/rules to that category first (a merge). Otherwise the category
 * is removed and its transactions fall back to Other via string membership.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await context.params;
  const cat = await ownCategory(userId, id);
  if (!cat) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const url = new URL(request.url);
  const mergeInto = url.searchParams.get("mergeInto");
  if (mergeInto && mergeInto !== cat.name) {
    const target = await prisma.category.findUnique({ where: { userId_name: { userId, name: mergeInto } } });
    if (!target) return NextResponse.json({ error: "Merge target not found" }, { status: 400 });
    await renameEverywhere(userId, cat.name, mergeInto);
  }

  // Detach children so they don't cascade-null unexpectedly, then delete.
  await prisma.category.updateMany({ where: { userId, parentId: id }, data: { parentId: null } });
  await prisma.category.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
