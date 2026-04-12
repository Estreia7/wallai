# WallAI Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock-data dashboard at `/wallai/dashboard` with a real server-rendered net-worth overview driven by Prisma queries over the existing Bank module data.

**Architecture:** Async server component page calls a single `getDashboardData(userId)` helper that runs all queries in parallel via `Promise.all`. Data is passed as props to presentational components. Chart components are `"use client"` wrappers around Recharts; everything else is a server component. No new API route, no client-side fetching.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Prisma 7 + PostgreSQL, NextAuth v5, Tailwind 4, Recharts, TypeScript 5.

**Spec:** `docs/superpowers/specs/2026-04-11-wallai-dashboard-design.md`

**Context notes for the implementer:**
- You're working in `/var/www/playground`. It's a Next.js 16 app using the App Router.
- There's no test runner — the Bank module shipped without tests and this module follows the same pattern. Verification for each task is type-check (`npx tsc --noEmit`) plus a final full build and manual browser check.
- Server session access: `import { auth } from "@/lib/auth"` then `const session = await auth();` — check `session?.user?.id`.
- Prisma client: `import { prisma } from "@/lib/prisma"`.
- Existing shared components: `GlassCard` at `@/components/wallai/glass-card` and `GradientBg` at `@/components/wallai/gradient-bg`. Reuse them.
- Never guess — if a path or type is unclear, open the file at the exact path given.
- Commit after every task. Keep commits small, with messages matching the pattern from recent history (`feat: add X component`, `feat: integrate Y`).

---

## File Structure

**New files:**
- `src/lib/wallai/dashboard-data.ts` — data fetching, types, `isIncome` classifier, income category allowlist
- `src/components/wallai/dashboard/net-worth-hero.tsx` — server component
- `src/components/wallai/dashboard/stat-card.tsx` — server component (reused for all 4 stat cards)
- `src/components/wallai/dashboard/net-worth-chart.tsx` — `"use client"` (Recharts)
- `src/components/wallai/dashboard/income-expenses-chart.tsx` — `"use client"` (Recharts)
- `src/components/wallai/dashboard/allocation-donut.tsx` — `"use client"` (Recharts)
- `src/components/wallai/dashboard/tip-card.tsx` — server component
- `src/components/wallai/dashboard/recent-transactions.tsx` — server component
- `src/components/wallai/dashboard/empty-state.tsx` — server component

**Rewritten:**
- `src/app/wallai/dashboard/page.tsx` — replaces the mock-data client component with an async server component

---

## Task 1: Dashboard Data Layer (types, classifier, queries)

**Files:**
- Create: `src/lib/wallai/dashboard-data.ts`

This is the biggest task — all data fetching for the dashboard lives here. Everything else in this plan consumes the types and data returned by `getDashboardData`.

- [ ] **Step 1: Create the directory**

```bash
cd /var/www/playground
mkdir -p src/lib/wallai
```

- [ ] **Step 2: Write `src/lib/wallai/dashboard-data.ts`**

Create the file with this exact content:

```ts
import { prisma } from "@/lib/prisma";
import type { Transaction } from "@prisma/client";

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
    crypto: { value: 0; configured: false };
    propertyEq: { value: 0; configured: false };
    debt: { value: 0; configured: false };
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
  hasAnyTransactions: boolean;
  hasNonPrimaryCurrencyAccount: boolean;
};

/* ── Income classification (shared hybrid rule) ────────────────── */

export const INCOME_CATEGORIES = new Set([
  "Salary",
  "Freelance",
  "Refund",
  "Interest",
  "Transfer In",
]);

export function isIncome(tx: Pick<Transaction, "category" | "amount">): boolean {
  if (tx.category && INCOME_CATEGORIES.has(tx.category)) return true;
  if (!tx.category && tx.amount > 0) return true;
  return false;
}

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
    cashTotalRow,
    previousMonthSumRow,
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
      select: { id: true, currency: true },
    }),
    prisma.transaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId, date: { lt: startOfThisMonth } },
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
  const cashValue = cashTotalRow._sum.amount ?? 0;
  const previousMonthTotal = previousMonthSumRow._sum.amount;
  const hasAnyTransactions = anyCountRow > 0;

  /* ── Net worth change calc ───────────────────────── */

  let changeAbs: number | null = null;
  let changePct: number | null = null;
  if (previousMonthTotal !== null && previousMonthTotal !== undefined) {
    changeAbs = cashValue - previousMonthTotal;
    if (previousMonthTotal !== 0) {
      changePct = (changeAbs / previousMonthTotal) * 100;
    }
  }

  /* ── Running-sum monthly trend (cap 12 months) ───── */

  const trendAll: Array<{ month: string; value: number }> = [];
  let running = 0;
  for (const row of monthlyDeltaRows) {
    running += row.delta;
    trendAll.push({ month: formatMonth(row.month), value: running });
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
      total: cashValue,
      previousMonthTotal: previousMonthTotal ?? null,
      changePct,
      changeAbs,
      currency: primaryCurrency,
      asOf: now,
    },
    stats: {
      cash: {
        value: cashValue,
        accountCount: bankAccounts.length,
        configured: true,
      },
      crypto: { value: 0, configured: false },
      propertyEq: { value: 0, configured: false },
      debt: { value: 0, configured: false },
    },
    netWorthTrend,
    incomeVsExpenses,
    allocation: [{ name: "Cash", value: cashValue, color: "#10b981" }],
    recentTransactions,
    tip: tipRows[0]
      ? {
          content: tipRows[0].content,
          author: tipRows[0].author,
          type: tipRows[0].type,
        }
      : null,
    freshness: { bankLastUpdated: freshnessRow._max.date ?? null },
    hasAnyTransactions,
    hasNonPrimaryCurrencyAccount,
  };
}
```

**Note on imports:** `import { prisma } from "@/lib/prisma"` and `import type { Transaction } from "@prisma/client"` — matches the rest of this project (verified against `src/lib/prisma.ts` and `src/app/api/wallai/transactions/route.ts`).

- [ ] **Step 3: Verify type-check passes**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -30
```

Expected: no errors.

If you see "Cannot find module '@/generated/prisma'" or similar, fix the `Transaction` type import path (see note above) and rerun.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/lib/wallai/dashboard-data.ts
git commit -m "feat: add dashboard data layer with queries and income classifier"
```

---

## Task 2: Stat Card Component

**Files:**
- Create: `src/components/wallai/dashboard/stat-card.tsx`

Generic presentational stat card used by all 4 dashboard cards (cash + 3 placeholders).

- [ ] **Step 1: Create the directory**

```bash
cd /var/www/playground
mkdir -p src/components/wallai/dashboard
```

- [ ] **Step 2: Write `src/components/wallai/dashboard/stat-card.tsx`**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string | null;
  gradient: string;
  configured: boolean;
  warning?: string | null;
};

export function StatCard({
  label,
  value,
  subtext,
  gradient,
  configured,
  warning,
}: StatCardProps) {
  return (
    <GlassCard
      className={`relative overflow-hidden ${configured ? "" : "opacity-50"}`}
    >
      <div
        className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${gradient} pointer-events-none`}
      />
      <div className="relative">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
          {label}
        </p>
        <p className="mt-1 text-lg font-bold text-white sm:mt-2 sm:text-2xl">
          {value}
        </p>
        {subtext && (
          <p className="mt-0.5 text-[10px] font-medium text-white/50 sm:mt-1 sm:text-xs">
            {subtext}
          </p>
        )}
        {!configured && (
          <span className="mt-2 inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50 sm:text-[10px]">
            Not configured
          </span>
        )}
        {warning && (
          <p className="mt-1.5 text-[10px] text-amber-300/80 sm:text-xs">
            ⚠ {warning}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/stat-card.tsx
git commit -m "feat: add dashboard stat card component"
```

---

## Task 3: Net Worth Hero Component

**Files:**
- Create: `src/components/wallai/dashboard/net-worth-hero.tsx`

Top-of-page hero with the big net-worth number, month-over-month delta, and freshness footer.

- [ ] **Step 1: Write `src/components/wallai/dashboard/net-worth-hero.tsx`**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";
import type { DashboardData } from "@/lib/wallai/dashboard-data";

type NetWorthHeroProps = {
  netWorth: DashboardData["netWorth"];
  freshness: DashboardData["freshness"];
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function relativeFromNow(date: Date | null): string {
  if (!date) return "no data yet";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "a month ago";
  return `${months} months ago`;
}

export function NetWorthHero({ netWorth, freshness }: NetWorthHeroProps) {
  const hasChange = netWorth.changeAbs !== null && netWorth.changePct !== null;
  const positive = (netWorth.changeAbs ?? 0) >= 0;

  return (
    <GlassCard className="mb-4 sm:mb-6">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
        Net Worth
      </p>
      <p className="mt-1 text-3xl font-bold text-white sm:mt-2 sm:text-4xl xl:text-5xl">
        {formatCurrency(netWorth.total, netWorth.currency)}
      </p>
      {hasChange ? (
        <p
          className={`mt-1 text-xs font-medium sm:text-sm ${
            positive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {positive ? "+" : ""}
          {formatCurrency(netWorth.changeAbs!, netWorth.currency)}
          {" "}
          ({positive ? "+" : ""}
          {netWorth.changePct!.toFixed(1)}%) vs last month
        </p>
      ) : (
        <p className="mt-1 text-xs text-white/40 sm:text-sm">— vs last month</p>
      )}
      <p className="mt-2 text-[10px] text-white/40 sm:text-xs">
        Net worth as of {formatDate(netWorth.asOf)} • Bank data updated{" "}
        {relativeFromNow(freshness.bankLastUpdated)}
      </p>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/net-worth-hero.tsx
git commit -m "feat: add dashboard net worth hero component"
```

---

## Task 4: Net Worth Trend Chart (client)

**Files:**
- Create: `src/components/wallai/dashboard/net-worth-chart.tsx`

Recharts area chart. Client component because Recharts needs the browser.

- [ ] **Step 1: Write `src/components/wallai/dashboard/net-worth-chart.tsx`**

```tsx
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type NetWorthChartProps = {
  data: Array<{ month: string; value: number }>;
  currency: string;
};

function formatShortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-IE", { month: "short" }).format(date);
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { month: string } }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
      <p className="text-white/50">{p.payload.month}</p>
      <p className="font-semibold text-white">
        {new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(p.value)}
      </p>
    </div>
  );
}

export function NetWorthChart({ data, currency }: NetWorthChartProps) {
  const hasEnough = data.length >= 2;

  return (
    <GlassCard className="relative overflow-hidden xl:col-span-2">
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Net Worth Trend
      </h3>
      {hasEnough ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data.map((p) => ({ ...p, label: formatShortMonth(p.month) }))}>
            <defs>
              <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              stroke="rgba(255,255,255,0.2)"
              tick={{ fontSize: 11 }}
            />
            <YAxis
              stroke="rgba(255,255,255,0.2)"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              width={45}
            />
            <Tooltip content={<ChartTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#nwGrad)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-center text-xs text-white/40 sm:text-sm">
            Upload more statements to see your trend
          </p>
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/net-worth-chart.tsx
git commit -m "feat: add dashboard net worth trend chart"
```

---

## Task 5: Income vs Expenses Chart (client)

**Files:**
- Create: `src/components/wallai/dashboard/income-expenses-chart.tsx`

Recharts grouped bar chart — green income bars, red expense bars, 6 months.

- [ ] **Step 1: Write `src/components/wallai/dashboard/income-expenses-chart.tsx`**

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type IncomeExpensesChartProps = {
  data: Array<{ month: string; income: number; expenses: number }>;
  currency: string;
};

function formatShortMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat("en-IE", { month: "short" }).format(date);
}

function ChartTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
      {payload.map((p) => (
        <p key={p.name} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {fmt.format(p.value)}
        </p>
      ))}
    </div>
  );
}

export function IncomeExpensesChart({ data, currency }: IncomeExpensesChartProps) {
  const chartData = data.map((p) => ({ ...p, label: formatShortMonth(p.month) }));

  return (
    <GlassCard className="relative overflow-hidden xl:col-span-2">
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Income vs Expenses
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
          <YAxis
            stroke="rgba(255,255,255,0.2)"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            width={45}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.05)" }}
            content={<ChartTooltip currency={currency} />}
          />
          <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
          <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/income-expenses-chart.tsx
git commit -m "feat: add dashboard income vs expenses chart"
```

---

## Task 6: Allocation Donut (client)

**Files:**
- Create: `src/components/wallai/dashboard/allocation-donut.tsx`

Recharts donut, single slice in v1 (cash).

- [ ] **Step 1: Write `src/components/wallai/dashboard/allocation-donut.tsx`**

```tsx
"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/wallai/glass-card";

type AllocationDonutProps = {
  data: Array<{ name: string; value: number; color: string }>;
  currency: string;
};

export function AllocationDonut({ data, currency }: AllocationDonutProps) {
  const fmt = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });

  return (
    <GlassCard className="relative overflow-hidden">
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
        Asset Allocation
      </h3>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { name: string; value: number };
              return (
                <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
                  <p className="text-white/50">{d.name}</p>
                  <p className="font-semibold text-white">{fmt.format(d.value)}</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-2 sm:gap-3">
        {data.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-1.5 text-[10px] text-white/50 sm:text-xs"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.name}
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/allocation-donut.tsx
git commit -m "feat: add dashboard allocation donut component"
```

---

## Task 7: Tip Card Component

**Files:**
- Create: `src/components/wallai/dashboard/tip-card.tsx`

Server component — italic quote, author, category pill.

- [ ] **Step 1: Write `src/components/wallai/dashboard/tip-card.tsx`**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";
import type { DashboardData } from "@/lib/wallai/dashboard-data";

type TipCardProps = {
  tip: DashboardData["tip"];
};

export function TipCard({ tip }: TipCardProps) {
  if (!tip) {
    return (
      <GlassCard className="flex items-center justify-center">
        <p className="text-xs text-white/40 sm:text-sm">No tip today</p>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col justify-between">
      <div>
        <span className="inline-block rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50 sm:text-[10px]">
          {tip.type}
        </span>
        <p className="mt-3 text-sm italic text-white/80 sm:text-base">
          &ldquo;{tip.content}&rdquo;
        </p>
      </div>
      {tip.author && (
        <p className="mt-3 text-xs text-white/50">— {tip.author}</p>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/tip-card.tsx
git commit -m "feat: add dashboard tip card component"
```

---

## Task 8: Recent Transactions Component

**Files:**
- Create: `src/components/wallai/dashboard/recent-transactions.tsx`

Server component. 8 rows, same visual style as the existing mock, with "View all" linking to `/wallai/bank`. Uses `isIncome` for color coding.

- [ ] **Step 1: Write `src/components/wallai/dashboard/recent-transactions.tsx`**

```tsx
import Link from "next/link";
import { GlassCard } from "@/components/wallai/glass-card";
import { isIncome, type DashboardData } from "@/lib/wallai/dashboard-data";

type RecentTransactionsProps = {
  transactions: DashboardData["recentTransactions"];
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IE", { month: "short", day: "numeric" }).format(date);
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h3 className="text-xs font-semibold text-white/70 sm:text-sm">
          Recent Transactions
        </h3>
        <Link
          href="/wallai/bank"
          className="text-[10px] text-emerald-400 hover:text-emerald-300 sm:text-xs"
        >
          View all
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/40 sm:text-sm">
          No transactions yet
        </p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {transactions.map((tx) => {
            const income = isIncome(tx);
            const fmt = new Intl.NumberFormat("en-IE", {
              style: "currency",
              currency: tx.currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/5 sm:px-4 sm:py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold sm:h-9 sm:w-9 ${
                      income
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {tx.description.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                      {tx.description}
                    </p>
                    <p className="truncate text-[10px] text-white/30 sm:text-xs">
                      {tx.category ?? "Uncategorized"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-xs font-semibold sm:text-sm ${
                      income ? "text-emerald-400" : "text-white/80"
                    }`}
                  >
                    {income && tx.amount > 0 ? "+" : ""}
                    {fmt.format(tx.amount)}
                  </p>
                  <p className="text-[10px] text-white/30 sm:text-xs">
                    {formatRelativeDate(tx.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/recent-transactions.tsx
git commit -m "feat: add dashboard recent transactions component"
```

---

## Task 9: Empty State Component

**Files:**
- Create: `src/components/wallai/dashboard/empty-state.tsx`

Full-width centered card shown when the user has zero transactions.

- [ ] **Step 1: Write `src/components/wallai/dashboard/empty-state.tsx`**

```tsx
import Link from "next/link";
import { GlassCard } from "@/components/wallai/glass-card";

export function DashboardEmptyState() {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-12 text-center sm:py-20">
      <p className="text-2xl font-bold text-white sm:text-3xl">No data yet</p>
      <p className="mt-2 max-w-md text-sm text-white/50 sm:text-base">
        Upload your first bank statement to see your financial overview.
      </p>
      <Link
        href="/wallai/bank"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-[#0A0E1A] transition-opacity hover:opacity-90"
      >
        Go to Bank
      </Link>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/dashboard/empty-state.tsx
git commit -m "feat: add dashboard empty state component"
```

---

## Task 10: Rewrite Dashboard Page

**Files:**
- Rewrite: `src/app/wallai/dashboard/page.tsx`

Replace the mock-data client page with an async server component that fetches real data and composes the components from Tasks 2–9.

- [ ] **Step 1: Replace `src/app/wallai/dashboard/page.tsx` with:**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import { getDashboardData } from "@/lib/wallai/dashboard-data";
import { NetWorthHero } from "@/components/wallai/dashboard/net-worth-hero";
import { StatCard } from "@/components/wallai/dashboard/stat-card";
import { NetWorthChart } from "@/components/wallai/dashboard/net-worth-chart";
import { IncomeExpensesChart } from "@/components/wallai/dashboard/income-expenses-chart";
import { AllocationDonut } from "@/components/wallai/dashboard/allocation-donut";
import { TipCard } from "@/components/wallai/dashboard/tip-card";
import { RecentTransactions } from "@/components/wallai/dashboard/recent-transactions";
import { DashboardEmptyState } from "@/components/wallai/dashboard/empty-state";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function DashboardHeader({ name }: { name: string | null }) {
  const displayName = name?.split(" ")[0] ?? "there";
  const initial = (name ?? "?").charAt(0).toUpperCase();
  const monthYear = new Intl.DateTimeFormat("en-IE", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-white sm:text-2xl">
          Good morning, {displayName}
        </h2>
        <p className="mt-0.5 text-xs text-white/40 sm:mt-1 sm:text-sm">
          Here&apos;s your financial overview
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 backdrop-blur-lg sm:px-4 sm:py-2 sm:text-sm">
          {monthYear}
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-xs font-bold text-[#0A0E1A] sm:h-10 sm:w-10 sm:text-sm">
          {initial}
        </div>
      </div>
    </div>
  );
}

function DashboardErrorCard({ message }: { message: string }) {
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-red-400">
        Could not load dashboard
      </p>
      <p className="mt-2 text-xs text-white/50 sm:text-sm">{message}</p>
      <a
        href="/wallai/dashboard"
        className="mt-4 inline-block text-xs text-emerald-400 hover:text-emerald-300 sm:text-sm"
      >
        Retry
      </a>
    </GlassCard>
  );
}

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/wallai");
  }

  let data;
  try {
    data = await getDashboardData(session.user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return (
      <>
        <DashboardHeader name={session.user.name ?? null} />
        <DashboardErrorCard message={message} />
      </>
    );
  }

  if (!data.hasAnyTransactions) {
    return (
      <>
        <DashboardHeader name={data.user.name} />
        <DashboardEmptyState />
      </>
    );
  }

  return (
    <>
      <DashboardHeader name={data.user.name} />

      <NetWorthHero netWorth={data.netWorth} freshness={data.freshness} />

      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Cash"
          value={formatCurrency(data.stats.cash.value, data.netWorth.currency)}
          subtext={`${data.stats.cash.accountCount} account${
            data.stats.cash.accountCount === 1 ? "" : "s"
          }`}
          gradient="from-emerald-500/20 to-emerald-500/5"
          configured
          warning={
            data.hasNonPrimaryCurrencyAccount
              ? `Non-${data.netWorth.currency} account detected`
              : null
          }
        />
        <StatCard
          label="Crypto"
          value={formatCurrency(0, data.netWorth.currency)}
          gradient="from-cyan-500/20 to-cyan-500/5"
          configured={false}
        />
        <StatCard
          label="Property Equity"
          value={formatCurrency(0, data.netWorth.currency)}
          gradient="from-violet-500/20 to-violet-500/5"
          configured={false}
        />
        <StatCard
          label="Total Debt"
          value={formatCurrency(0, data.netWorth.currency)}
          gradient="from-amber-500/20 to-amber-500/5"
          configured={false}
        />
      </div>

      {/* Row 2: net worth trend + allocation donut */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-3">
        <NetWorthChart data={data.netWorthTrend} currency={data.netWorth.currency} />
        <AllocationDonut data={data.allocation} currency={data.netWorth.currency} />
      </div>

      {/* Row 3: income vs expenses + tip */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-3">
        <IncomeExpensesChart
          data={data.incomeVsExpenses}
          currency={data.netWorth.currency}
        />
        <TipCard tip={data.tip} />
      </div>

      {/* Row 4: recent transactions */}
      <RecentTransactions transactions={data.recentTransactions} />
    </>
  );
}
```

- [ ] **Step 2: Run full build**

```bash
cd /var/www/playground
npm run build 2>&1 | tail -40
```

Expected: clean build, `/wallai/dashboard` listed as a server-rendered route (`ƒ`, not `○` — it's now dynamic because of `auth()`).

If the build fails on the removed `recharts` imports (the old page had `AreaChart`, `BarChart`, `PieChart` imports that are now only in the child components), that's fine — the new `page.tsx` doesn't import them. Make sure the new file doesn't still have the old mock data/imports at the top.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/app/wallai/dashboard/page.tsx
git commit -m "feat: rewrite dashboard page with real data and server rendering"
```

---

## Task 11: Deploy and Verify

- [ ] **Step 1: Restart PM2**

```bash
pm2 restart playground --update-env
```

Expected: process online.

- [ ] **Step 2: Verify the dashboard responds**

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://playground.bruno-dev.xyz/wallai/dashboard
```

Expected: `200` (redirects to `/wallai` login if no session — that's also acceptable, check with `-I -L` if curious).

- [ ] **Step 3: Manual verification in browser**

Open `https://playground.bruno-dev.xyz/wallai/dashboard` and log in as `admin@wallai.app` / `1234`.

Verify each section:
1. **Header** shows "Good morning, Admin" (or your name) + current month/year pill
2. **Net Worth hero** shows a currency-formatted number. If you have prior-month transactions, the delta line is populated; otherwise it shows `—`
3. **4 stat cards** — Cash is fully opaque with a real total + account count; Crypto, Property Equity, Total Debt are dimmed with "Not configured" badges
4. **Net Worth Trend** chart renders if you have ≥2 months of data, otherwise shows the upload-more message
5. **Asset Allocation** donut shows a single emerald "Cash" slice
6. **Income vs Expenses** chart shows 6 months on the X axis with green/red bars
7. **Tip card** shows one of your seeded `FinancialTip` rows
8. **Recent Transactions** shows up to 8 most recent, with "View all" linking to `/wallai/bank`

Test the empty state by logging in as a user with no transactions. If no such user exists, temporarily delete all your transactions in the bank page, reload, verify the empty state shows, then re-upload a statement.

Test the income/expense classifier:
- Upload or add a transaction with category "Salary" and a positive amount → should count as income on the bar chart
- A transaction with category `null` and negative amount → should count as expense
- A transaction with category "Groceries" and positive amount (refund) → should count as expense (non-income category wins)

- [ ] **Step 4: If any issues, fix them and commit**

```bash
cd /var/www/playground
git add -A
git commit -m "fix: adjustments from dashboard verification"
```

- [ ] **Step 5: Check pm2 logs for runtime errors**

```bash
pm2 logs playground --lines 50 --nostream
```

Expected: no errors related to the dashboard route.

---

## Post-task Summary

After all tasks complete, the dashboard at `/wallai/dashboard` reads real data from the Bank module, with crypto/property/debt placeholders that are ready to start populating the moment those modules come online. No schema changes, no new migrations, no new API routes, no new dependencies.
