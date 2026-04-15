import { prisma } from "@/lib/prisma";
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES, isIncome } from "@/lib/wallai/categories";
import { buildConverter } from "@/lib/wallai/fx";

export type AnalysisPeriod = 3 | 6 | 12;

export type CategoryBreakdown = {
  category: string;
  amount: number;
  pct: number;
};

export type MonthlyFlow = {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  net: number;
};

export type TopMerchant = {
  description: string;
  amount: number;
  count: number;
};

export type AnalysisData = {
  period: AnalysisPeriod;
  currency: string;
  hasData: boolean;
  totals: {
    income: number;
    expenses: number;
    net: number;
    savingsRate: number | null; // null if income=0
  };
  monthly: MonthlyFlow[];
  incomeByCategory: CategoryBreakdown[];
  expensesByCategory: CategoryBreakdown[];
  topMerchants: TopMerchant[];
};

function firstDayOfMonth(offsetMonths: number): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d;
}

function formatMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

const INCOME_SET = new Set<string>(INCOME_CATEGORIES);
const EXPENSE_SET = new Set<string>(EXPENSE_CATEGORIES);

export async function getAnalysisData(
  userId: string,
  period: AnalysisPeriod,
): Promise<AnalysisData> {
  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCurrency: true },
    }),
    prisma.transaction.findMany({
      where: {
        userId,
        date: { gte: firstDayOfMonth(-(period - 1)) },
      },
      select: {
        description: true,
        amount: true,
        currency: true,
        category: true,
        date: true,
      },
    }),
  ]);

  const currency = user?.primaryCurrency ?? "EUR";
  const txCurrencies = new Set<string>();
  for (const tx of transactions) txCurrencies.add(tx.currency);
  const toPrimary = await buildConverter(currency, txCurrencies);

  if (transactions.length === 0) {
    return {
      period,
      currency,
      hasData: false,
      totals: { income: 0, expenses: 0, net: 0, savingsRate: null },
      monthly: [],
      incomeByCategory: [],
      expensesByCategory: [],
      topMerchants: [],
    };
  }

  /* ── Monthly buckets (zero-filled) ── */
  const monthlyMap = new Map<string, MonthlyFlow>();
  for (let i = period - 1; i >= 0; i--) {
    const key = formatMonth(firstDayOfMonth(-i));
    monthlyMap.set(key, { month: key, income: 0, expenses: 0, net: 0 });
  }

  /* ── Totals + category + merchants ── */
  let incomeTotal = 0;
  let expensesTotal = 0;
  const incomeByCat = new Map<string, number>();
  const expensesByCat = new Map<string, number>();
  const merchantMap = new Map<string, { amount: number; count: number }>();

  for (const tx of transactions) {
    const bucket = monthlyMap.get(formatMonth(tx.date));
    const converted = toPrimary(tx.amount, tx.currency);

    if (isIncome(tx)) {
      const amt = converted;
      incomeTotal += amt;
      if (bucket) bucket.income += amt;
      const cat = tx.category && INCOME_SET.has(tx.category) ? tx.category : "Other Income";
      incomeByCat.set(cat, (incomeByCat.get(cat) ?? 0) + amt);
    } else if (converted < 0) {
      const amt = Math.abs(converted);
      expensesTotal += amt;
      if (bucket) bucket.expenses += amt;
      const cat = tx.category && EXPENSE_SET.has(tx.category) ? tx.category : "Other Expense";
      expensesByCat.set(cat, (expensesByCat.get(cat) ?? 0) + amt);

      // Merchant key: first 60 chars of description
      const descKey = tx.description.trim().slice(0, 60);
      if (descKey) {
        const existing = merchantMap.get(descKey) ?? { amount: 0, count: 0 };
        existing.amount += amt;
        existing.count += 1;
        merchantMap.set(descKey, existing);
      }
    }
  }

  // Compute net per month
  for (const m of monthlyMap.values()) {
    m.net = m.income - m.expenses;
  }

  const savingsRate =
    incomeTotal > 0 ? ((incomeTotal - expensesTotal) / incomeTotal) * 100 : null;

  function toBreakdown(map: Map<string, number>, total: number): CategoryBreakdown[] {
    if (total === 0) return [];
    return Array.from(map.entries())
      .map(([category, amount]) => ({
        category,
        amount,
        pct: (amount / total) * 100,
      }))
      .sort((a, b) => b.amount - a.amount);
  }

  const topMerchants: TopMerchant[] = Array.from(merchantMap.entries())
    .map(([description, v]) => ({ description, amount: v.amount, count: v.count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  return {
    period,
    currency,
    hasData: true,
    totals: {
      income: incomeTotal,
      expenses: expensesTotal,
      net: incomeTotal - expensesTotal,
      savingsRate,
    },
    monthly: Array.from(monthlyMap.values()),
    incomeByCategory: toBreakdown(incomeByCat, incomeTotal),
    expensesByCategory: toBreakdown(expensesByCat, expensesTotal),
    topMerchants,
  };
}
