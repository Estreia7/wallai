import { prisma } from "@/lib/prisma";
import { normalizeMerchant } from "./normalize";

export const SOURCE_RANK: Record<string, number> = {
  ai_guess: 1,
  confirmed: 2,
  user_correction: 3,
};

export function higherSource(a: string, b: string): string {
  return (SOURCE_RANK[a] ?? 0) >= (SOURCE_RANK[b] ?? 0) ? a : b;
}

type TxLite = { id: string; description: string; amount: number };

export async function matchCategory(
  userId: string,
  txs: TxLite[],
): Promise<{ hits: { txId: string; category: string; ruleId: string }[]; misses: TxLite[] }> {
  const rules = await prisma.merchantRule.findMany({ where: { userId } });
  const byKey = new Map(rules.map((r) => [r.merchantKey, r]));
  const hits: { txId: string; category: string; ruleId: string }[] = [];
  const misses: TxLite[] = [];
  for (const tx of txs) {
    const { merchantKey } = normalizeMerchant(tx.description);
    const rule = merchantKey ? byKey.get(merchantKey) : undefined;
    if (rule) hits.push({ txId: tx.id, category: rule.category, ruleId: rule.id });
    else misses.push(tx);
  }
  return { hits, misses };
}

async function upsertRule(
  userId: string,
  description: string,
  category: string,
  source: string,
  displayName?: string,
): Promise<void> {
  const norm = normalizeMerchant(description);
  if (!norm.merchantKey) return;
  const existing = await prisma.merchantRule.findUnique({
    where: { userId_merchantKey: { userId, merchantKey: norm.merchantKey } },
  });
  if (!existing) {
    await prisma.merchantRule.create({
      data: {
        userId,
        merchantKey: norm.merchantKey,
        displayName: displayName || norm.displayName,
        category,
        source,
        hitCount: 1,
        lastSeenAt: new Date(),
      },
    });
    return;
  }
  const winningSource = higherSource(existing.source, source);
  // Only overwrite category when the incoming source is at least as authoritative.
  const nextCategory =
    (SOURCE_RANK[source] ?? 0) >= (SOURCE_RANK[existing.source] ?? 0)
      ? category
      : existing.category;
  await prisma.merchantRule.update({
    where: { id: existing.id },
    data: {
      category: nextCategory,
      source: winningSource,
      displayName: displayName || existing.displayName,
      hitCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });
}

export async function learnFromCategorization(
  userId: string,
  entries: { description: string; category: string; displayName?: string }[],
  source: string,
): Promise<void> {
  for (const e of entries) {
    await upsertRule(userId, e.description, e.category, source, e.displayName);
  }
}

export async function learnFromCorrection(
  userId: string,
  description: string,
  category: string,
): Promise<void> {
  await upsertRule(userId, description, category, "user_correction");
}
