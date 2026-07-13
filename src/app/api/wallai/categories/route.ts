import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserCategories } from "@/lib/wallai/categories-data";

const KINDS = new Set(["income", "expense", "transfer"]);

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const categories = await getUserCategories(session.user.id, { includeArchived: true });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const body = await request.json();

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const kind = typeof body?.kind === "string" ? body.kind : "expense";
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!KINDS.has(kind)) return NextResponse.json({ error: "Invalid kind" }, { status: 400 });

  const existing = await prisma.category.findUnique({
    where: { userId_name: { userId, name } },
  });
  if (existing) return NextResponse.json({ error: "Category already exists" }, { status: 409 });

  const parentId = typeof body?.parentId === "string" ? body.parentId : null;
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId } });
    if (!parent || parent.userId !== userId) {
      return NextResponse.json({ error: "Invalid parent" }, { status: 400 });
    }
  }

  const category = await prisma.category.create({
    data: {
      userId,
      name,
      kind,
      group: typeof body?.group === "string" ? body.group : null,
      parentId,
      color: typeof body?.color === "string" ? body.color : null,
      icon: typeof body?.icon === "string" ? body.icon : null,
      isDefault: false,
    },
  });
  return NextResponse.json({ category });
}
