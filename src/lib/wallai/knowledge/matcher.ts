import { prisma } from "@/lib/prisma";
import { normalizeMerchant } from "./normalize";
import { matchSeedMerchant } from "./seed-merchants";

export const SOURCE_RANK: Record<string, number> = {
  seed: 1,
  ai_guess: 2,
  confirmed: 3,
  user_correction: 4,
};

export function higherSource(a: string, b: string): string {
  return (SOURCE_RANK[a] ?? 0) >= (SOURCE_RANK[b] ?? 0) ? a : b;
}

type TxLite = { id: string; description: string; amount: number };

export type MatchHit = {
  txId: string;
  category: string;
  /** How the category was resolved. Used to decide whether to learn a rule. */
  via: "rule" | "rule_fuzzy" | "seed";
  ruleId?: string;
  displayName?: string;
  recurring?: boolean;
};

/**
 * Resolve categories deterministically, before any AI call. Order of precedence:
 *   1. Learned rule, exact normalized-key match (fastest, most authoritative).
 *   2. Learned rule, fuzzy key match — one learned key is a substring of the
 *      other (covers "uber eats" vs "uber eats lisboa" city variants).
 *   3. Built-in seed dictionary of common PT/EU merchants.
 * Anything unresolved becomes a `miss` for the AI pass.
 */
export async function matchCategory(
  userId: string,
  txs: TxLite[],
): Promise<{ hits: MatchHit[]; misses: TxLite[] }> {
  const rules = await prisma.merchantRule.findMany({ where: { userId } });
  const byKey = new Map(rules.map((r) => [r.merchantKey, r]));
  // Precompute rule keys sorted longest-first so fuzzy match prefers the most
  // specific learned merchant.
  const ruleKeys = rules
    .map((r) => r.merchantKey)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);

  const hits: MatchHit[] = [];
  const misses: TxLite[] = [];

  for (const tx of txs) {
    const { merchantKey } = normalizeMerchant(tx.description);

    // 1. exact learned rule
    const exact = merchantKey ? byKey.get(merchantKey) : undefined;
    if (exact) {
      hits.push({ txId: tx.id, category: exact.category, via: "rule", ruleId: exact.id });
      continue;
    }

    // 2. fuzzy learned rule (bidirectional substring on the normalized key)
    if (merchantKey && merchantKey.length >= 4) {
      const fuzzyKey = ruleKeys.find(
        (k) => k.length >= 4 && (merchantKey.includes(k) || k.includes(merchantKey)),
      );
      const fuzzyRule = fuzzyKey ? byKey.get(fuzzyKey) : undefined;
      if (fuzzyRule) {
        hits.push({ txId: tx.id, category: fuzzyRule.category, via: "rule_fuzzy", ruleId: fuzzyRule.id });
        continue;
      }
    }

    // 3. built-in seed dictionary
    const seed = matchSeedMerchant(tx.description, tx.amount);
    if (seed) {
      hits.push({
        txId: tx.id,
        category: seed.category,
        via: "seed",
        displayName: seed.displayName,
        recurring: seed.recurring,
      });
      continue;
    }

    misses.push(tx);
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
