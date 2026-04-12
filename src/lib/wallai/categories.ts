import type { Transaction } from "@prisma/client";

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Refund",
  "Interest",
  "Transfer In",
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
  "Transfer Out",
  "Other Expense",
] as const;

export const ALL_CATEGORIES: readonly string[] = [
  ...INCOME_CATEGORIES,
  ...EXPENSE_CATEGORIES,
];

const INCOME_SET = new Set<string>(INCOME_CATEGORIES);

export function isIncome(tx: Pick<Transaction, "category" | "amount">): boolean {
  if (tx.category && INCOME_SET.has(tx.category)) return true;
  if (!tx.category && tx.amount > 0) return true;
  return false;
}
