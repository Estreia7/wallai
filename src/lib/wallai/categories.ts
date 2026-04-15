import type { Transaction } from "@prisma/client";

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Refund",
  "Interest",
  "Other Income",
] as const;

export const EXPENSE_CATEGORIES = [
  "Groceries",
  "Dining",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Subscriptions",
  "Entertainment",
  "Health",
  "Housing",
  "Travel",
  "Cash",
  "Fees",
  "Other Expense",
] as const;

// Transfers are movements between the user's own accounts — not real
// income or expense. Kept as selectable categories but excluded from
// all totals, charts, and savings-rate calculations.
export const TRANSFER_CATEGORIES = ["Transfer In", "Transfer Out"] as const;

export const ALL_CATEGORIES: readonly string[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
  ...TRANSFER_CATEGORIES,
];

const INCOME_SET = new Set<string>(INCOME_CATEGORIES);
const TRANSFER_SET = new Set<string>(TRANSFER_CATEGORIES);

export function isTransfer(tx: Pick<Transaction, "category">): boolean {
  return !!tx.category && TRANSFER_SET.has(tx.category);
}

export function isIncome(tx: Pick<Transaction, "category" | "amount">): boolean {
  if (tx.category && TRANSFER_SET.has(tx.category)) return false;
  if (tx.category && INCOME_SET.has(tx.category)) return true;
  if (!tx.category && tx.amount > 0) return true;
  return false;
}

export function isExpense(tx: Pick<Transaction, "category" | "amount">): boolean {
  if (tx.category && TRANSFER_SET.has(tx.category)) return false;
  if (tx.category && INCOME_SET.has(tx.category)) return false;
  return tx.amount < 0;
}
