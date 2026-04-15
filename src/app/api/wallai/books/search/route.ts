import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchBooks } from "@/lib/wallai/learn/book-search";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchBooks(q, 10);
  return NextResponse.json({ results });
}
