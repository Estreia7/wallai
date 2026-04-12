import { prisma } from "@/lib/prisma";
import { isIncome } from "@/lib/wallai/categories";
import { loadHoldings, computeTotals } from "@/lib/wallai/crypto/crypto-data";
import { fetchPrices } from "@/lib/wallai/crypto/coingecko";

export { isIncome } from "@/lib/wallai/categories";

/* ── Types ─────────────────────────────────────────────────────── */

export type DashboardData = {
  user: { name: string | null; primaryCurrency: string };
  netWorth: {
    total: number;
    previousMonthTotal: number | null;
    changePct: number | null;
    changeAbs: number | null;
    currency: string;
    asOf: Date;
  };
  stats: {
    cash: { value: number; accountCount: number; configured: true };
    crypto: {
      value: number;
      pnlEur: number;
      pnlPct: number | null;
      coinCount: number;
      configured: boolean;
    };
    propertyEq: { value: 0; configured: false };
    debt: { value: number; accountCount: number; configured: boolean };
  };
  netWorthTrend: Array<{ month: string; value: number }>;
  incomeVsExpenses: Array<{ month: string; income: number; expenses: number }>;
  allocation: Array<{ name: string; value: number; color: string }>;
  recentTransactions: Array<{
    id: string;
    description: string;
    category: string | null;
    amount: number;
    currency: string;
    date: Date;
  }>;
  tip: { content: string; author: string | null; type: string } | null;
  freshness: { bankLastUpdated: Date | null };
  hasAnyData: boolean;
  hasNonPrimaryCurrencyAccount: boolean;
};

/* ── Helpers ───────────────────────────────────────────────────── */

function formatMonth(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function firstDayOfMonth(offsetMonths: number): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMonth(d.getUTCMonth() + offsetMonths);
  return d;
}

/* ── Main entry ────────────────────────────────────────────────── */

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const now = new Date();
  const startOfThisMonth = firstDayOfMonth(0);
  const startOfSixMonthsAgo = firstDayOfMonth(-5); // last 6 months inclusive
  const twelveMonthsAgo = firstDayOfMonth(-11);    // last 12 months inclusive

  const [
    user,
    bankAccounts,
    thisMonthSumRow,
    monthlyDeltaRows,
    recentWindowTransactions,
    recentTransactions,
    tipRows,
    freshnessRow,
    anyCountRow,
  ] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, primaryCurrency: true },
    }),
    prisma.bankAccount.findMany({
      where: { userId },
      select: { id: true, currency: true, type: true, currentBalance: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { gte: startOfThisMonth } },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<Array<{ month: Date; delta: number }>>`
      SELECT date_trunc('month', "date") AS month,
             SUM("amount")::float AS delta
      FROM "Transaction"
      WHERE "userId" = ${userId}
      GROUP BY 1
      ORDER BY 1
    `,
    prisma.transaction.findMany({
      where: { userId, date: { gte: startOfSixMonthsAgo } },
      select: { date: true, amount: true, category: true },
    }),
    prisma.transaction.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        description: true,
        category: true,
        amount: true,
        currency: true,
        date: true,
      },
    }),
    prisma.$queryRaw<Array<{ id: string; content: string; type: string; author: string | null }>>`
      SELECT id, content, type, author
      FROM "FinancialTip"
      ORDER BY random()
      LIMIT 1
    `,
    prisma.transaction.aggregate({
      where: { userId },
      _max: { date: true },
    }),
    prisma.transaction.count({ where: { userId } }),
  ]);

  const primaryCurrency = user?.primaryCurrency ?? "EUR";
  const hasAnyTransactions = anyCountRow > 0;
  const hasAnyData = hasAnyTransactions || bankAccounts.length > 0;

  /* ── Crypto totals ────────────────────────────────── */

  const cryptoHoldings = await loadHoldings(userId);
  let cryptoPriceMap = new Map<string, number>();
  if (cryptoHoldings.length > 0) {
    try {
      cryptoPriceMap = await fetchPrices(cryptoHoldings.map((h) => h.coinId));
    } catch (err) {
      console.error("[dashboard] crypto fetchPrices failed", err);
    }
  }
  const cryptoResult = computeTotals(cryptoHoldings, cryptoPriceMap);
  const cryptoTotals = cryptoResult.totals;

  /* ── Balances by account type ─────────────────────── */

  const cashAccounts = bankAccounts.filter(
    (a) => a.type === "checking" || a.type === "savings"
  );
  const creditAccounts = bankAccounts.filter((a) => a.type === "credit");

  const cashValue = cashAccounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const creditSigned = creditAccounts.reduce((sum, a) => sum + a.currentBalance, 0); // negative for debt
  const debtValue = -creditSigned; // positive number for display

  const netWorthTotal = cashValue + creditSigned + cryptoTotals.totalValueEur; // creditSigned already negative if debt

  /* ── Net worth change calc (end of last month) ─────── */

  const thisMonthSum = thisMonthSumRow._sum.amount ?? 0;
  const previousMonthTotal = hasAnyTransactions ? netWorthTotal - thisMonthSum : null;

  let changeAbs: number | null = null;
  let changePct: number | null = null;
  if (previousMonthTotal !== null) {
    changeAbs = netWorthTotal - previousMonthTotal;
    if (previousMonthTotal !== 0) {
      changePct = (changeAbs / previousMonthTotal) * 100;
    }
  }

  /* ── Reverse-computed monthly trend (cap 12 months) ── */

  const trendAll: Array<{ month: string; value: number }> = [];
  let runningEnd = netWorthTotal;
  for (let i = monthlyDeltaRows.length - 1; i >= 0; i--) {
    const row = monthlyDeltaRows[i];
    trendAll.unshift({ month: formatMonth(row.month), value: runningEnd });
    runningEnd -= row.delta;
  }
  const netWorthTrend = trendAll.filter((p) => {
    const [y, m] = p.month.split("-").map(Number);
    const pointDate = new Date(Date.UTC(y, m - 1, 1));
    return pointDate >= twelveMonthsAgo;
  });

  /* ── Income vs expenses (6 months, zero-filled) ──── */

  const ivMap = new Map<string, { income: number; expenses: number }>();
  for (let i = 5; i >= 0; i--) {
    ivMap.set(formatMonth(firstDayOfMonth(-i)), { income: 0, expenses: 0 });
  }
  for (const tx of recentWindowTransactions) {
    const key = formatMonth(tx.date);
    const bucket = ivMap.get(key);
    if (!bucket) continue;
    if (isIncome(tx)) {
      bucket.income += tx.amount;
    } else if (tx.amount < 0) {
      bucket.expenses += Math.abs(tx.amount);
    }
  }
  const incomeVsExpenses = Array.from(ivMap.entries()).map(([month, v]) => ({
    month,
    income: v.income,
    expenses: v.expenses,
  }));

  /* ── Currency warning ────────────────────────────── */

  const hasNonPrimaryCurrencyAccount = bankAccounts.some(
    (a) => a.currency !== primaryCurrency
  );

  /* ── Assemble ────────────────────────────────────── */

  return {
    user: {
      name: user?.name ?? null,
      primaryCurrency,
    },
    netWorth: {
      total: netWorthTotal,
      previousMonthTotal,
      changePct,
      changeAbs,
      currency: primaryCurrency,
      asOf: now,
    },
    stats: {
      cash: {
        value: cashValue,
        accountCount: cashAccounts.length,
        configured: true,
      },
      crypto: {
        value: cryptoTotals.totalValueEur,
        pnlEur: cryptoTotals.totalPnlEur,
        pnlPct: cryptoTotals.totalPnlPct,
        coinCount: cryptoTotals.coinCount,
        configured: cryptoTotals.coinCount > 0,
      },
      propertyEq: { value: 0, configured: false },
      debt: {
        value: debtValue,
        accountCount: creditAccounts.length,
        configured: creditAccounts.length > 0,
      },
    },
    netWorthTrend,
    incomeVsExpenses,
    allocation: [
      { name: "Cash", value: Math.max(cashValue, 0), color: "#10b981" },
      ...(cryptoTotals.coinCount > 0
        ? [{ name: "Crypto", value: Math.max(cryptoTotals.totalValueEur, 0), color: "#06b6d4" }]
        : []),
    ],
    recentTransactions,
    tip: tipRows[0]
      ? {
          content: tipRows[0].content,
          author: tipRows[0].author,
          type: tipRows[0].type,
        }
      : null,
    freshness: { bankLastUpdated: freshnessRow._max.date ?? null },
    hasAnyData,
    hasNonPrimaryCurrencyAccount,
  };
}
