import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectFileType, parseStatement } from "@/lib/statement-parser";
import { ApiKeyNotConfiguredError } from "@/lib/anthropic";

const UPLOADS_DIR = join(process.cwd(), "uploads");

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const bankAccountId = formData.get("bankAccountId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }
  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
  }

  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  const fileType = detectFileType(file.name, file.type);
  if (!fileType) {
    return NextResponse.json(
      { error: "Unsupported file type. Use PDF, CSV, or Excel." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const userDir = join(UPLOADS_DIR, session.user.id);
  await mkdir(userDir, { recursive: true });
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = join(userDir, `${timestamp}-${safeName}`);
  await writeFile(storagePath, buffer);

  try {
    const statementData = await parseStatement(session.user.id, buffer, fileType);
    return NextResponse.json({
      ...statementData,
      fileName: file.name,
      fileType,
      storagePath,
    });
  } catch (error) {
    if (error instanceof ApiKeyNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Statement parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse statement. Check your API key and try again." },
      { status: 500 }
    );
  }
}
