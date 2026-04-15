import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordSnapshot } from "@/lib/wallai/snapshots";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const snap = await recordSnapshot(session.user.id);
  return NextResponse.json({ snapshot: snap });
}
