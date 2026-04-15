import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkByExternalId } from "@/lib/wallai/learn/book-search";
import { generateTraits } from "@/lib/wallai/learn/ai-traits";

const ALLOWED_STATUSES = new Set(["reading", "read", "wantToRead"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  // externalId is the canonical param; accept legacy `googleId` as alias.
  const externalId =
    typeof body?.externalId === "string"
      ? body.externalId
      : typeof body?.googleId === "string"
        ? body.googleId
        : "";
  const bookId = typeof body?.bookId === "string" ? body.bookId : "";
  const status = typeof body?.status === "string" ? body.status : "wantToRead";
  const rating =
    typeof body?.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? body.rating
      : null;

  if (!externalId && !bookId) {
    return NextResponse.json({ error: "externalId or bookId required" }, { status: 400 });
  }
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  let book = bookId
    ? await prisma.book.findUnique({ where: { id: bookId } })
    : await prisma.book.findUnique({ where: { externalId } });

  if (!book && externalId) {
    const hit = await getWorkByExternalId(externalId);
    if (!hit) {
      return NextResponse.json({ error: "book not found" }, { status: 404 });
    }

    book = await prisma.book.create({
      data: {
        externalId: hit.externalId,
        title: hit.title,
        author: hit.authors.join(", ") || "Unknown",
        coverUrl: hit.coverUrl,
        description: hit.description,
        year: hit.publishedYear,
        category: hit.category,
        traits: [],
        traitSource: null,
      },
    });
  }

  if (!book) {
    return NextResponse.json({ error: "book not found" }, { status: 404 });
  }

  if (book.traits.length !== 20) {
    const result = await generateTraits({
      userId: session.user.id,
      title: book.title,
      author: book.author,
      description: book.description,
    });
    if (result.ok) {
      book = await prisma.book.update({
        where: { id: book.id },
        data: {
          traits: result.traits,
          traitSource: "ai",
          traitsGeneratedAt: new Date(),
        },
      });
    }
  }

  const userBook = await prisma.userBook.upsert({
    where: { userId_bookId: { userId: session.user.id, bookId: book.id } },
    create: {
      userId: session.user.id,
      bookId: book.id,
      status,
      rating,
      finishedAt: status === "read" ? new Date() : null,
    },
    update: {
      status,
      rating,
      finishedAt: status === "read" ? new Date() : null,
    },
  });

  return NextResponse.json({ book, userBook });
}
