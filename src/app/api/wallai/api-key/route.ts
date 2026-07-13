import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { getAdminSession } from "@/lib/admin";

// The Anthropic key is app-wide and admin-owned: stored on the admin user
// record and shared by all users' AI calls. Only admins may read/write it.

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicKeyEncrypted: true },
  });

  return NextResponse.json({ configured: Boolean(user?.anthropicKeyEncrypted) });
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const apiKey = body?.apiKey;
  if (typeof apiKey !== "string" || apiKey.length < 20) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicKeyEncrypted: encrypt(apiKey) },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicKeyEncrypted: null },
  });

  return NextResponse.json({ success: true });
}
