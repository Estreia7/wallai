import { prisma } from "@/lib/prisma";

export type EffectiveBankAccount = {
  id: string;
  name: string;
  currency: string;
  type: string;
  storedBalance: number;
  balanceAsOf: Date | null;
  effectiveBalance: number;
};

/**
 * Bank accounts with balances adjusted for transactions logged after the
 * last statement upload. `currentBalance` is only refreshed when a newer
 * statement is imported, so manual transactions in between would otherwise
 * not be reflected anywhere (cash card, net worth, etc.).
 *
 * effective = storedBalance + sum(amount where date > balanceAsOf)
 *
 * If balanceAsOf is null (no statement ever imported for this account),
 * the stored balance is treated as the complete picture.
 */
export async function loadEffectiveBankAccounts(
  userId: string,
): Promise<EffectiveBankAccount[]> {
  const accounts = await prisma.bankAccount.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      currency: true,
      type: true,
      currentBalance: true,
      balanceAsOf: true,
    },
  });

  if (accounts.length === 0) return [];

  // Pull deltas for every account in a single grouped query.
  const deltas = await prisma.$queryRaw<
    Array<{ bankAccountId: string; delta: number }>
  >`
    SELECT t."bankAccountId" AS "bankAccountId",
           SUM(t."amount")::float AS delta
    FROM "Transaction" t
    JOIN "BankAccount" b ON b."id" = t."bankAccountId"
    WHERE t."userId" = ${userId}
      AND (b."balanceAsOf" IS NULL OR t."date" > b."balanceAsOf")
    GROUP BY t."bankAccountId"
  `;

  const deltaMap = new Map<string, number>();
  for (const d of deltas) deltaMap.set(d.bankAccountId, d.delta);

  return accounts.map((a) => {
    // When balanceAsOf is null, the stored balance already represents
    // everything — don't add deltas or we'd double-count.
    const adjust = a.balanceAsOf === null ? 0 : deltaMap.get(a.id) ?? 0;
    return {
      id: a.id,
      name: a.name,
      currency: a.currency,
      type: a.type,
      storedBalance: a.currentBalance,
      balanceAsOf: a.balanceAsOf,
      effectiveBalance: a.currentBalance + adjust,
    };
  });
}
