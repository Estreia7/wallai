import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPendingTodos } from "@/lib/wallai/knowledge/todos";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const todos = await listPendingTodos(session.user.id);
  return NextResponse.json({ todos });
}
