import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadLearnPayload } from "@/lib/wallai/learn/recommendations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await loadLearnPayload(session.user.id);
  return NextResponse.json(payload);
}
