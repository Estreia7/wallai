import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchCategory, learnFromCategorization } from "@/lib/wallai/knowledge/matcher";
import { enrichUnknownMerchants } from "@/lib/wallai/knowledge/categorize";
import {
  matchTransactionsToBills,
  detectAndProposeBills,
  checkMissingBills,
  bootstrapBillHints,
} from "@/lib/wallai/knowledge/bills";
import { upsertTodo } from "@/lib/wallai/knowledge/todos";

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

  // ── Long-term knowledge pipeline ────────────────────────────────────
  // Runs best-effort: a Haiku/API-key failure must never break the import.
  let newMerchantCount = 0;
  try {
    const created = await prisma.transaction.findMany({
      where: { userId, statementId: statement.id },
      select: { id: true, description: true, amount: true, date: true, category: true },
    });
    const uncategorized = created
      .filter((t) => !t.category)
      .map((t) => ({ id: t.id, description: t.description, amount: t.amount }));

    // 1. Memory match — auto-apply known merchants (0 AI).
    const { hits, misses } = await matchCategory(userId, uncategorized);
    for (const h of hits) {
      await prisma.transaction.update({ where: { id: h.txId }, data: { category: h.category } });
    }

    // 2. Haiku enrichment for unknown merchants.
    if (misses.length > 0) {
      const enriched = await enrichUnknownMerchants(userId, misses);
      const byId = new Map(misses.map((m) => [m.id, m]));
      const learn: { description: string; category: string; displayName?: string }[] = [];
      for (const e of enriched) {
        await prisma.transaction.update({ where: { id: e.id }, data: { category: e.category } });
        const tx = byId.get(e.id);
        if (tx) learn.push({ description: tx.description, category: e.category, displayName: e.displayName });
      }
      await learnFromCategorization(userId, learn, "ai_guess");
      newMerchantCount = learn.length;
      if (newMerchantCount > 0) {
        await upsertTodo(userId, {
          type: "confirm_merchants",
          dedupeKey: `confirm_merchants:${statement.id}`,
          title: `Confirm categories for ${newMerchantCount} new merchant${newMerchantCount === 1 ? "" : "s"}`,
          body: "WallAI guessed these — tap to confirm or fix so it learns.",
          payload: { statementId: statement.id },
        });
      }
    }

    // 3. Recurring bills: match, detect, missing, bootstrap.
    await matchTransactionsToBills(
      userId,
      created.map((t) => ({ date: t.date, description: t.description, amount: t.amount })),
    );
    await detectAndProposeBills(userId);
    await checkMissingBills(userId, new Date());
    await bootstrapBillHints(userId);
  } catch (err) {
    console.error("[confirm] knowledge pipeline error:", err);
  }

  return NextResponse.json({
    statementId: statement.id,
    imported: insertResult.count,
    skipped,
    primaryBalanceUpdated,
    secondaryBalancesUpdated,
    createdAccounts,
    newMerchants: newMerchantCount,
  });
}
