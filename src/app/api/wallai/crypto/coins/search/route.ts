import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchCoins } from "@/lib/wallai/crypto/coingecko";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ coins: [] });
  }

  const coins = await searchCoins(q);
  return NextResponse.json({ coins });
}
