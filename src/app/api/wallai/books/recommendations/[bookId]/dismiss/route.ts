import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ bookId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bookId } = await params;

  await prisma.userBookHidden.upsert({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    create: { userId: session.user.id, bookId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
