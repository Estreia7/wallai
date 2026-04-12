import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicKeyEncrypted: true },
  });

  return NextResponse.json({ configured: Boolean(user?.anthropicKeyEncrypted) });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = body?.apiKey;

  if (typeof apiKey !== "string" || apiKey.length < 20) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 400 });
  }

  const encrypted = encrypt(apiKey);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicKeyEncrypted: encrypted },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicKeyEncrypted: null },
  });

  return NextResponse.json({ success: true });
}
