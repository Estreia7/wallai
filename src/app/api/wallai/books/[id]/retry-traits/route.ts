import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTraits } from "@/lib/wallai/learn/ai-traits";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: bookId } = await params;

  const userBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    include: { book: true },
  });
  if (!userBook) return NextResponse.json({ error: "not found" }, { status: 404 });

  const result = await generateTraits({
    userId: session.user.id,
    title: userBook.book.title,
    author: userBook.book.author,
    description: userBook.book.description,
  });
  if (!result.ok) {
    const status = result.error === "no_api_key" ? 400 : 502;
    return NextResponse.json({ error: result.error }, { status });
  }

  const updated = await prisma.book.update({
    where: { id: bookId },
    data: {
      traits: result.traits,
      traitSource: "ai",
      traitsGeneratedAt: new Date(),
    },
  });

  return NextResponse.json({ book: updated });
}
