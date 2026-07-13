import { prisma } from "@/lib/prisma";
import {
  isIncome,
  isExpense,
  isTransfer,
} from "@/lib/wallai/categories";
import { getCategorySets, type CategorySets } from "@/lib/wallai/categories-data";
import { buildConverter } from "@/lib/wallai/fx";
import { projectYear, type Projection } from "@/lib/wallai/budget-projection";

export type BudgetMonthTotals = { income: number; expenses: number; net: number };
export type BudgetCategoryRow = { category: string; monthly: number[]; total: number };
export type BudgetTotals = { income: number; expenses: number; net: number; savingsRate: number | null };
export type BudgetYearData = {
  year: number;
  currency: string;
  hasData: boolean;
  months: BudgetMonthTotals[];
  income: BudgetCategoryRow[];
  expenses: BudgetCategoryRow[];
  totals: BudgetTotals;
  projection: Projection | null;
};
export type BudgetCategoryDelta = {
  category: string;
  amount: number;
  pct: number;
  prevAmount: number;
  delta: number;
};
export type BudgetMonthData = {
  year: number;
  month: number;
  currency: string;
  hasData: boolean;
  income: BudgetCategoryDelta[];
  expenses: BudgetCategoryDelta[];
  totals: BudgetTotals;
};

function incomeCat(category: string | null, sets: CategorySets): string {
  return category && sets.income.has(category) ? category : "Other Income";
}
function expenseCat(category: string | null, sets: CategorySets): string {
  return category && sets.expense.has(category) ? category : "Other Expense";
}
function savings(income: number, expenses: number): number | null {
  return income > 0 ? ((income - expenses) / income) * 100 : null;
}

export async function listBudgetYears(userId: string): Promise<number[]> {
  const rows = await prisma.$queryRaw<Array<{ year: number }>>`
    SELECT DISTINCT EXTRACT(YEAR FROM "date")::int AS year
    FROM "Transaction"
    WHERE "userId" = ${userId}
    ORDER BY year DESC
  `;
  const years = rows.map((r) => r.year);
  const current = new Date().getUTCFullYear();
  if (!years.includes(current)) years.unshift(current);
  return years;
}

export async function getBudgetYear(userId: string, year: number): Promise<BudgetYearData> {
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));

  const [user, transactions, activeBills, sets] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lt: end } },
      select: { amount: true, currency: true, category: true, date: true },
    }),
    prisma.recurringBill.findMany({
      where: { userId, status: "active", cadence: "monthly" },
      select: { expectedAmount: true },
    }),
    getCategorySets(userId),
  ]);

  const currency = user?.primaryCurrency ?? "EUR";
  const txCurrencies = new Set<string>();
  for (const t of transactions) txCurrencies.add(t.currency);
  const toPrimary = await buildConverter(currency, txCurrencies);

  const months: BudgetMonthTotals[] = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0, net: 0 }));
  const incomeByCat = new Map<string, number[]>();
  const expenseByCat = new Map<string, number[]>();
  let incomeTotal = 0;
  let expenseTotal = 0;

  const ensure = (map: Map<string, number[]>, cat: string): number[] => {
    let arr = map.get(cat);
    if (!arr) { arr = new Array(12).fill(0); map.set(cat, arr); }
    return arr;
  };

  for (const tx of transactions) {
    if (isTransfer(tx, sets)) continue;
    const mi = tx.date.getUTCMonth();
    const converted = toPrimary(tx.amount, tx.currency);
    if (isIncome(tx, sets)) {
      const amt = converted;
      months[mi].income += amt;
      incomeTotal += amt;
      ensure(incomeByCat, incomeCat(tx.category, sets))[mi] += amt;
    } else if (isExpense(tx, sets)) {
      const amt = Math.abs(converted);
      months[mi].expenses += amt;
      expenseTotal += amt;
      ensure(expenseByCat, expenseCat(tx.category, sets))[mi] += amt;
    }
  }
  for (const m of months) m.net = m.income - m.expenses;

  const toRows = (map: Map<string, number[]>): BudgetCategoryRow[] =>
    Array.from(map.entries())
      .map(([category, monthly]) => ({ category, monthly, total: monthly.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total);

  const currentYear = new Date().getUTCFullYear();
  let projection: Projection | null = null;
  if (year === currentYear && transactions.length > 0) {
    const recurringBillsTotal = activeBills.reduce((s, b) => s + (b.expectedAmount ?? 0), 0);
    projection = projectYear({
      actualIncome: incomeTotal,
      actualExpense: expenseTotal,
      monthsElapsed: new Date().getUTCMonth() + 1,
      recurringBillsTotal,
    });
  }

  return {
    year,
    currency,
    hasData: transactions.length > 0,
    months,
    income: toRows(incomeByCat),
    expenses: toRows(expenseByCat),
    totals: { income: incomeTotal, expenses: expenseTotal, net: incomeTotal - expenseTotal, savingsRate: savings(incomeTotal, expenseTotal) },
    projection,
  };
}

export async function getBudgetMonth(userId: string, year: number, month: number): Promise<BudgetMonthData> {
  // month is 1–12. Fetch this month + previous month (for deltas).
  const curStart = new Date(Date.UTC(year, month - 1, 1));
  const curEnd = new Date(Date.UTC(year, month, 1));
  const prevStart = new Date(Date.UTC(year, month - 2, 1));

  const [user, transactions, sets] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: prevStart, lt: curEnd } },
      select: { amount: true, currency: true, category: true, date: true },
    }),
    getCategorySets(userId),
  ]);

  const currency = user?.primaryCurrency ?? "EUR";
  const txCurrencies = new Set<string>();
  for (const t of transactions) txCurrencies.add(t.currency);
  const toPrimary = await buildConverter(currency, txCurrencies);

  const curInc = new Map<string, number>();
  const curExp = new Map<string, number>();
  const prevInc = new Map<string, number>();
  const prevExp = new Map<string, number>();
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const tx of transactions) {
    if (isTransfer(tx, sets)) continue;
    const isCur = tx.date >= curStart;
    const converted = toPrimary(tx.amount, tx.currency);
    if (isIncome(tx, sets)) {
      const amt = converted;
      const cat = incomeCat(tx.category, sets);
      if (isCur) { curInc.set(cat, (curInc.get(cat) ?? 0) + amt); incomeTotal += amt; }
      else prevInc.set(cat, (prevInc.get(cat) ?? 0) + amt);
    } else if (isExpense(tx, sets)) {
      const amt = Math.abs(converted);
      const cat = expenseCat(tx.category, sets);
      if (isCur) { curExp.set(cat, (curExp.get(cat) ?? 0) + amt); expenseTotal += amt; }
      else prevExp.set(cat, (prevExp.get(cat) ?? 0) + amt);
    }
  }

  const toDeltas = (cur: Map<string, number>, prev: Map<string, number>, total: number): BudgetCategoryDelta[] =>
    Array.from(cur.entries())
      .map(([category, amount]) => {
        const prevAmount = prev.get(category) ?? 0;
        return { category, amount, pct: total > 0 ? (amount / total) * 100 : 0, prevAmount, delta: amount - prevAmount };
      })
      .sort((a, b) => b.amount - a.amount);

  const hasCurrent = curInc.size > 0 || curExp.size > 0;
  return {
    year,
    month,
    currency,
    hasData: hasCurrent,
    income: toDeltas(curInc, prevInc, incomeTotal),
    expenses: toDeltas(curExp, prevExp, expenseTotal),
    totals: { income: incomeTotal, expenses: expenseTotal, net: incomeTotal - expenseTotal, savingsRate: savings(incomeTotal, expenseTotal) },
  };
}
