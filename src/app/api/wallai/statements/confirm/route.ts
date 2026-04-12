import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ConfirmTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
  category?: string | null;
};

type DetectedAccountToCreate = {
  type: "savings" | "credit";
  name: string;
  balance: number;
  currency: string;
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const bankAccountId = body?.bankAccountId;
  const fileName = body?.fileName;
  const fileType = body?.fileType;
  const storagePath = body?.storagePath;
  const transactions = body?.transactions;
  const primaryBalance =
    typeof body?.primaryBalance === "number" ? body.primaryBalance : null;
  const detectedAccounts: DetectedAccountToCreate[] = Array.isArray(body?.detectedAccounts)
    ? body.detectedAccounts.filter(
        (a: unknown): a is DetectedAccountToCreate =>
          typeof a === "object" &&
          a !== null &&
          ((a as { type?: unknown }).type === "savings" ||
            (a as { type?: unknown }).type === "credit") &&
          typeof (a as { name?: unknown }).name === "string" &&
          typeof (a as { balance?: unknown }).balance === "number" &&
          typeof (a as { currency?: unknown }).currency === "string"
      )
    : [];

  if (typeof bankAccountId !== "string" || !bankAccountId) {
    return NextResponse.json({ error: "bankAccountId is required" }, { status: 400 });
  }
  if (!Array.isArray(transactions)) {
    return NextResponse.json({ error: "transactions must be an array" }, { status: 400 });
  }

  const account = await prisma.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Bank account not found" }, { status: 404 });
  }

  const userId = session.user.id;

  const statement = await prisma.bankStatement.create({
    data: {
      userId,
      bankAccountId,
      fileName: typeof fileName === "string" ? fileName : "uploaded",
      fileType: typeof fileType === "string" ? fileType : "unknown",
      rawStoragePath: typeof storagePath === "string" ? storagePath : "",
    },
  });

  const txData = (transactions as ConfirmTransaction[]).map((t) => ({
    userId,
    bankAccountId,
    statementId: statement.id,
    date: new Date(t.date),
    description: t.description,
    amount: t.amount,
    currency: t.currency || account.currency,
    category: t.category || null,
  }));

  const insertResult =
    txData.length > 0
      ? await prisma.transaction.createMany({
          data: txData,
          skipDuplicates: true,
        })
      : { count: 0 };
  const skipped = txData.length - insertResult.count;

  // The newest transaction date in this upload stands in for the statement's
  // period-end. Balances only overwrite when this upload is on-or-after the
  // account's last recorded balanceAsOf — older statements never stomp newer ones.
  const statementAsOf = txData.reduce<Date | null>(
    (latest, t) => (latest === null || t.date > latest ? t.date : latest),
    null
  );

  let primaryBalanceUpdated = false;
  if (primaryBalance !== null && statementAsOf !== null) {
    if (!account.balanceAsOf || statementAsOf >= account.balanceAsOf) {
      await prisma.bankAccount.update({
        where: { id: bankAccountId },
        data: { currentBalance: primaryBalance, balanceAsOf: statementAsOf },
      });
      primaryBalanceUpdated = true;
    }
  }

  let createdAccounts = 0;
  let secondaryBalancesUpdated = 0;
  for (const acc of detectedAccounts) {
    const existing = await prisma.bankAccount.findFirst({
      where: { userId, name: acc.name },
    });
    if (existing) {
      const shouldUpdateBalance =
        statementAsOf !== null &&
        (!existing.balanceAsOf || statementAsOf >= existing.balanceAsOf);
      await prisma.bankAccount.update({
        where: { id: existing.id },
        data: {
          type: acc.type,
          currency: acc.currency,
          ...(shouldUpdateBalance
            ? { currentBalance: acc.balance, balanceAsOf: statementAsOf }
            : {}),
        },
      });
      if (shouldUpdateBalance) secondaryBalancesUpdated += 1;
    } else {
      await prisma.bankAccount.create({
        data: {
          userId,
          name: acc.name,
          currency: acc.currency,
          type: acc.type,
          currentBalance: acc.balance,
          balanceAsOf: statementAsOf,
        },
      });
      createdAccounts += 1;
    }
  }

  return NextResponse.json({
    statementId: statement.id,
    imported: insertResult.count,
    skipped,
    primaryBalanceUpdated,
    secondaryBalancesUpdated,
    createdAccounts,
  });
}
