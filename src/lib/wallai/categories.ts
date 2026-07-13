import type { Transaction } from "@prisma/client";
import {
  DEFAULT_INCOME_NAMES,
  DEFAULT_EXPENSE_NAMES,
  DEFAULT_TRANSFER_NAMES,
} from "./default-taxonomy";

// These constants are the DEFAULT taxonomy, used as:
//   - the seed source for a new user's categories,
//   - the fallback classification sets when no per-user sets are supplied,
//   - the default AI-prompt allowed list.
// Per-user categories (categories-data.ts) override these at runtime.
export const INCOME_CATEGORIES = DEFAULT_INCOME_NAMES;
export const EXPENSE_CATEGORIES = DEFAULT_EXPENSE_NAMES;
export const TRANSFER_CATEGORIES = DEFAULT_TRANSFER_NAMES;

export const ALL_CATEGORIES: readonly string[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...TRANSFER_CATEGORIES,
];

const DEFAULT_INCOME_SET = new Set<string>(INCOME_CATEGORIES);
const DEFAULT_TRANSFER_SET = new Set<string>(TRANSFER_CATEGORIES);

/** Optional per-user membership sets; falls back to defaults when omitted. */
export type ClassifySets = { income: Set<string>; transfer: Set<string> };

export function isTransfer(
  tx: Pick<Transaction, "category">,
  sets?: ClassifySets,
): boolean {
  const transferSet = sets?.transfer ?? DEFAULT_TRANSFER_SET;
  return !!tx.category && transferSet.has(tx.category);
}

export function isIncome(
  tx: Pick<Transaction, "category" | "amount">,
  sets?: ClassifySets,
): boolean {
  const incomeSet = sets?.income ?? DEFAULT_INCOME_SET;
  const transferSet = sets?.transfer ?? DEFAULT_TRANSFER_SET;
  if (tx.category && transferSet.has(tx.category)) return false;
  if (tx.category && incomeSet.has(tx.category)) return true;
  if (!tx.category && tx.amount > 0) return true;
  return false;
}

export function isExpense(
  tx: Pick<Transaction, "category" | "amount">,
  sets?: ClassifySets,
): boolean {
  const incomeSet = sets?.income ?? DEFAULT_INCOME_SET;
  const transferSet = sets?.transfer ?? DEFAULT_TRANSFER_SET;
  if (tx.category && transferSet.has(tx.category)) return false;
  if (tx.category && incomeSet.has(tx.category)) return false;
  return tx.amount < 0;
}
