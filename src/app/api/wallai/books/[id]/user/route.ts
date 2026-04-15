import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = new Set(["reading", "read", "wantToRead"]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: bookId } = await params;
  const body = await request.json().catch(() => ({}));

  const data: {
    status?: string;
    rating?: number | null;
    finishedAt?: Date | null;
  } = {};

  if (typeof body?.status === "string") {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.finishedAt = body.status === "read" ? new Date() : null;
  }
  if ("rating" in body) {
    if (body.rating === null) {
      data.rating = null;
    } else if (typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5) {
      data.rating = body.rating;
    } else {
      return NextResponse.json({ error: "invalid rating" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const existing = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: session.user.id, bookId } },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.userBook.update({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    data,
  });

  return NextResponse.json({ userBook: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: bookId } = await params;

  await prisma.userBook.deleteMany({
    where: { userId: session.user.id, bookId },
  });

  return NextResponse.json({ ok: true });
}
