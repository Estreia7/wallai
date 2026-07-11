# Budget / Cashflow Control Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A new `/budget` page giving calendar-based income/expense control — year/month views, a category × month matrix table, category tables with month-over-month deltas, and a recurring-bills-floored full-year projection.

**Architecture:** A server component reads `year`/`view`/`month` from searchParams and calls `budget-data.ts`, which fetches the year's transactions and buckets them in JS (mirroring `analysis-data.ts`). The full-year projection math is a pure, unit-tested function. Charts and tables reuse the established lazy-chart pattern and mobile-first conventions.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 + Postgres, Tailwind 4, Recharts (lazy), FX via `buildConverter`.

## Global Constraints

- Reuse `isIncome`/`isExpense`/`isTransfer` + `INCOME_CATEGORIES`/`EXPENSE_CATEGORIES` from `@/lib/wallai/categories`; transfers are excluded from all totals.
- FX: convert every amount to the user's `primaryCurrency` via `buildConverter(currency, txCurrencies)` (see `analysis-data.ts`).
- `savingsRate` is a **percentage** (`net / income * 100`), `null` when income = 0 — matches `analysis-data.ts`.
- Charts must be lazy-loaded (`*.impl.tsx` recharts body + `next/dynamic({ssr:false})` wrapper + `ChartSkeleton`). Never import recharts eagerly.
- Mobile-first: responsive Tailwind, tap targets ≥44px, verify at 375px. Wide tables scroll inside their own `overflow-x-auto` container — the page body must never scroll horizontally.
- Uncategorized transactions map to `"Other Income"` / `"Other Expense"` by amount sign (matches `analysis-data.ts`).
- Tests are plain `tsx` files with a local `assert()` helper, run with `npx tsx <path>`. No test framework.
- Deploy: `npm run build` must pass; live deploy is `pm2 restart wallai` (port 3003).

---

### Task 1: Year projection (pure, TDD)

**Files:**
- Create: `src/lib/wallai/budget-projection.ts`
- Test: `src/lib/wallai/budget-projection.test.ts`

**Interfaces:**
- Produces:
  - `type Projection = { actualIncome: number; actualExpense: number; projectedIncome: number; projectedExpense: number; projectedNet: number; monthsElapsed: number; monthsLeft: number; recurringBillsTotal: number }`
  - `projectYear(input: { actualIncome: number; actualExpense: number; monthsElapsed: number; recurringBillsTotal: number }): Projection`

- [ ] **Step 1: Write failing test**

```ts
import { projectYear } from "./budget-projection";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

// simple run-rate, no recurring bills
{
  const p = projectYear({ actualIncome: 12000, actualExpense: 6000, monthsElapsed: 6, recurringBillsTotal: 0 });
  assert(p.projectedIncome === 24000, `income 24000, got ${p.projectedIncome}`);
  assert(p.projectedExpense === 12000, `expense 12000, got ${p.projectedExpense}`);
  assert(p.projectedNet === 12000, `net 12000, got ${p.projectedNet}`);
  assert(p.monthsLeft === 6, "monthsLeft 6");
}

// recurring floor raises remaining-month spend above the run-rate average
{
  const p = projectYear({ actualIncome: 6000, actualExpense: 3000, monthsElapsed: 6, recurringBillsTotal: 800 });
  // avgMonthlyExpense=500 < 800 -> floor to 800; 3000 + 800*6 = 7800
  assert(p.projectedExpense === 7800, `expense 7800, got ${p.projectedExpense}`);
}

// December: no months left -> projection equals actuals
{
  const p = projectYear({ actualIncome: 10000, actualExpense: 8000, monthsElapsed: 12, recurringBillsTotal: 500 });
  assert(p.projectedIncome === 10000 && p.projectedExpense === 8000, "December = actuals");
  assert(p.monthsLeft === 0, "monthsLeft 0");
}

// zero months elapsed is safe (no division by zero)
{
  const p = projectYear({ actualIncome: 0, actualExpense: 0, monthsElapsed: 0, recurringBillsTotal: 0 });
  assert(p.projectedIncome === 0 && p.projectedExpense === 0, "empty stays zero");
}
console.log("budget-projection.test.ts PASSED");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/lib/wallai/budget-projection.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
export type Projection = {
  actualIncome: number;
  actualExpense: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedNet: number;
  monthsElapsed: number;
  monthsLeft: number;
  recurringBillsTotal: number;
};

export function projectYear(input: {
  actualIncome: number;
  actualExpense: number;
  monthsElapsed: number;
  recurringBillsTotal: number;
}): Projection {
  const monthsElapsed = Math.max(0, Math.min(12, input.monthsElapsed));
  const monthsLeft = Math.max(0, 12 - monthsElapsed);
  const avgIncome = monthsElapsed > 0 ? input.actualIncome / monthsElapsed : 0;
  const avgExpense = monthsElapsed > 0 ? input.actualExpense / monthsElapsed : 0;
  const perRemainingMonthExpense = Math.max(avgExpense, input.recurringBillsTotal);

  const projectedIncome = input.actualIncome + avgIncome * monthsLeft;
  const projectedExpense = input.actualExpense + perRemainingMonthExpense * monthsLeft;

  return {
    actualIncome: input.actualIncome,
    actualExpense: input.actualExpense,
    projectedIncome,
    projectedExpense,
    projectedNet: projectedIncome - projectedExpense,
    monthsElapsed,
    monthsLeft,
    recurringBillsTotal: input.recurringBillsTotal,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx src/lib/wallai/budget-projection.test.ts`
Expected: `budget-projection.test.ts PASSED`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallai/budget-projection.ts src/lib/wallai/budget-projection.test.ts
git commit -m "feat(budget): year projection (recurring-floored run-rate) + tests"
```

---

### Task 2: Budget data layer

**Files:**
- Create: `src/lib/wallai/budget-data.ts`

**Interfaces:**
- Consumes: `prisma`, `buildConverter`, `isIncome`/`isExpense`/`isTransfer`, `INCOME_CATEGORIES`/`EXPENSE_CATEGORIES`, `projectYear` (Task 1).
- Produces:
  - `type BudgetMonthTotals = { income: number; expenses: number; net: number }`
  - `type BudgetCategoryRow = { category: string; monthly: number[]; total: number }` (monthly length 12)
  - `type BudgetTotals = { income: number; expenses: number; net: number; savingsRate: number | null }`
  - `type BudgetYearData = { year: number; currency: string; hasData: boolean; months: BudgetMonthTotals[]; income: BudgetCategoryRow[]; expenses: BudgetCategoryRow[]; totals: BudgetTotals; projection: Projection | null }`
  - `type BudgetCategoryDelta = { category: string; amount: number; pct: number; prevAmount: number; delta: number }`
  - `type BudgetMonthData = { year: number; month: number; currency: string; hasData: boolean; income: BudgetCategoryDelta[]; expenses: BudgetCategoryDelta[]; totals: BudgetTotals }`
  - `listBudgetYears(userId: string): Promise<number[]>`
  - `getBudgetYear(userId: string, year: number): Promise<BudgetYearData>`
  - `getBudgetMonth(userId: string, year: number, month: number): Promise<BudgetMonthData>` (month is 1–12)

- [ ] **Step 1: Implement `budget-data.ts`**

```ts
import { prisma } from "@/lib/prisma";
import {
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
  isIncome,
  isExpense,
  isTransfer,
} from "@/lib/wallai/categories";
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

const INCOME_SET = new Set<string>(INCOME_CATEGORIES);
const EXPENSE_SET = new Set<string>(EXPENSE_CATEGORIES);

function incomeCat(category: string | null): string {
  return category && INCOME_SET.has(category) ? category : "Other Income";
}
function expenseCat(category: string | null): string {
  return category && EXPENSE_SET.has(category) ? category : "Other Expense";
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

  const [user, transactions, activeBills] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: start, lt: end } },
      select: { amount: true, currency: true, category: true, date: true },
    }),
    prisma.recurringBill.findMany({
      where: { userId, status: "active", cadence: "monthly" },
      select: { expectedAmount: true },
    }),
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
    if (isTransfer(tx)) continue;
    const mi = tx.date.getUTCMonth();
    const converted = toPrimary(tx.amount, tx.currency);
    if (isIncome(tx)) {
      const amt = converted;
      months[mi].income += amt;
      incomeTotal += amt;
      ensure(incomeByCat, incomeCat(tx.category))[mi] += amt;
    } else if (isExpense(tx)) {
      const amt = Math.abs(converted);
      months[mi].expenses += amt;
      expenseTotal += amt;
      ensure(expenseByCat, expenseCat(tx.category))[mi] += amt;
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

  const [user, transactions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { primaryCurrency: true } }),
    prisma.transaction.findMany({
      where: { userId, date: { gte: prevStart, lt: curEnd } },
      select: { amount: true, currency: true, category: true, date: true },
    }),
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
    if (isTransfer(tx)) continue;
    const isCur = tx.date >= curStart;
    const converted = toPrimary(tx.amount, tx.currency);
    if (isIncome(tx)) {
      const amt = converted;
      const cat = incomeCat(tx.category);
      if (isCur) { curInc.set(cat, (curInc.get(cat) ?? 0) + amt); incomeTotal += amt; }
      else prevInc.set(cat, (prevInc.get(cat) ?? 0) + amt);
    } else if (isExpense(tx)) {
      const amt = Math.abs(converted);
      const cat = expenseCat(tx.category);
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
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean compile + type-check.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallai/budget-data.ts
git commit -m "feat(budget): year/month data layer with FX + projection"
```

---

### Task 3: Controls (client)

**Files:**
- Create: `src/components/wallai/budget/budget-controls.tsx`

**Interfaces:**
- Consumes: `next/navigation` `useRouter`.
- Produces: `<BudgetControls years={number[]} year={number} view={"year"|"month"} month={number} />` — updates the URL (`?year=&view=&month=`) on change.

- [ ] **Step 1: Implement**

```tsx
"use client";

import { useRouter } from "next/navigation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function BudgetControls({
  years,
  year,
  view,
  month,
}: {
  years: number[];
  year: number;
  view: "year" | "month";
  month: number;
}) {
  const router = useRouter();
  function go(next: { year?: number; view?: "year" | "month"; month?: number }) {
    const y = next.year ?? year;
    const v = next.view ?? view;
    const m = next.month ?? month;
    const params = new URLSearchParams({ year: String(y), view: v });
    if (v === "month") params.set("month", String(m));
    router.push(`/budget?${params.toString()}`);
  }

  const selectClass =
    "min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-400/50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["year", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => go({ view: v })}
            className={`min-h-[36px] rounded-lg px-3 text-sm font-medium capitalize transition ${
              view === v ? "bg-emerald-400/20 text-white" : "text-white/60"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <select className={selectClass} value={year} onChange={(e) => go({ year: Number(e.target.value) })}>
        {years.map((y) => (
          <option key={y} value={y} className="bg-[#0A0E1A]">{y}</option>
        ))}
      </select>
      {view === "month" && (
        <select className={selectClass} value={month} onChange={(e) => go({ month: Number(e.target.value) })}>
          {MONTHS.map((label, i) => (
            <option key={label} value={i + 1} className="bg-[#0A0E1A]">{label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build` — Expected: clean (the component is used in Task 7; a standalone build still type-checks it once imported. If not yet imported, skip build here and rely on Task 7's build).

- [ ] **Step 3: Commit**

```bash
git add src/components/wallai/budget/budget-controls.tsx
git commit -m "feat(budget): year/view/month controls"
```

---

### Task 4: Matrix + month tables

**Files:**
- Create: `src/components/wallai/budget/budget-matrix-table.tsx`
- Create: `src/components/wallai/budget/budget-month-table.tsx`

**Interfaces:**
- Consumes: `BudgetCategoryRow`, `BudgetMonthTotals`, `BudgetCategoryDelta` from `budget-data.ts`; `GlassCard`.
- Produces: `<BudgetMatrixTable income expenses months currency />` and `<BudgetMonthTable income expenses currency />`.

- [ ] **Step 1: Implement `budget-matrix-table.tsx`**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";
import type { BudgetCategoryRow, BudgetMonthTotals } from "@/lib/wallai/budget-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(v: number, currency: string): string {
  if (v === 0) return "—";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function BudgetMatrixTable({
  income,
  expenses,
  months,
  currency,
}: {
  income: BudgetCategoryRow[];
  expenses: BudgetCategoryRow[];
  months: BudgetMonthTotals[];
  currency: string;
}) {
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);

  const Cell = ({ v, strong }: { v: number; strong?: boolean }) => (
    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${strong ? "font-semibold text-white" : "text-white/70"}`}>
      {fmt(v, currency)}
    </td>
  );

  const section = (label: string, rows: BudgetCategoryRow[], sumRow: number[], sumTotal: number, accent: string) => (
    <>
      <tr>
        <td colSpan={14} className={`px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider ${accent}`}>{label}</td>
      </tr>
      {rows.map((r) => (
        <tr key={label + r.category} className="border-t border-white/5">
          <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0A0E1A] px-3 py-2 text-white/80">{r.category}</td>
          {r.monthly.map((v, i) => <Cell key={i} v={v} />)}
          <Cell v={r.total} strong />
        </tr>
      ))}
      <tr className="border-t border-white/10">
        <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0A0E1A] px-3 py-2 text-xs font-semibold text-white/60">Total {label}</td>
        {sumRow.map((v, i) => <Cell key={i} v={v} strong />)}
        <Cell v={sumTotal} strong />
      </tr>
    </>
  );

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-white/40">
              <th className="sticky left-0 z-10 bg-[#0A0E1A] px-3 py-2 text-left">Category</th>
              {MONTHS.map((m) => <th key={m} className="px-3 py-2 text-right">{m}</th>)}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {section("Income", income, months.map((m) => m.income), totalIncome, "text-emerald-300")}
            {section("Expenses", expenses, months.map((m) => m.expenses), totalExpenses, "text-red-300")}
            <tr className="border-t-2 border-white/20">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0A0E1A] px-3 py-2 font-bold text-white">Net</td>
              {months.map((m, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${m.net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {fmt(m.net, currency)}
                </td>
              ))}
              <td className={`whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums ${totalIncome - totalExpenses >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {fmt(totalIncome - totalExpenses, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Implement `budget-month-table.tsx`**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";
import type { BudgetCategoryDelta } from "@/lib/wallai/budget-data";

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function DeltaCell({ delta, currency }: { delta: number; currency: string }) {
  if (delta === 0) return <span className="text-white/40">—</span>;
  const up = delta > 0;
  return (
    <span className={up ? "text-amber-300" : "text-emerald-300"}>
      {up ? "▲" : "▼"} {fmt(Math.abs(delta), currency)}
    </span>
  );
}

function Section({ title, rows, currency, accent }: { title: string; rows: BudgetCategoryDelta[]; currency: string; accent: string }) {
  return (
    <GlassCard>
      <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${accent}`}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/60">Nothing this month.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((r) => (
            <li key={r.category} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-white/80">{r.category}</span>
              <span className="w-12 shrink-0 text-right text-white/40">{r.pct.toFixed(0)}%</span>
              <span className="w-24 shrink-0 text-right font-semibold text-white tabular-nums">{fmt(r.amount, currency)}</span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums"><DeltaCell delta={r.delta} currency={currency} /></span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

export function BudgetMonthTable({
  income,
  expenses,
  currency,
}: {
  income: BudgetCategoryDelta[];
  expenses: BudgetCategoryDelta[];
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Income" rows={income} currency={currency} accent="text-emerald-300" />
      <Section title="Expenses" rows={expenses} currency={currency} accent="text-red-300" />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wallai/budget/budget-matrix-table.tsx src/components/wallai/budget/budget-month-table.tsx
git commit -m "feat(budget): matrix + month category tables"
```

---

### Task 5: Projection card

**Files:**
- Create: `src/components/wallai/budget/projection-card.tsx`

**Interfaces:**
- Consumes: `Projection` from `budget-projection.ts`; `GlassCard`.
- Produces: `<ProjectionCard projection currency />`.

- [ ] **Step 1: Implement**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";
import type { Projection } from "@/lib/wallai/budget-projection";

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function ProjectionCard({ projection, currency }: { projection: Projection; currency: string }) {
  const p = projection;
  const items = [
    { label: "Projected income", value: p.projectedIncome, tone: "text-emerald-300" },
    { label: "Projected expenses", value: p.projectedExpense, tone: "text-red-300" },
    { label: "Projected net", value: p.projectedNet, tone: p.projectedNet >= 0 ? "text-emerald-300" : "text-red-300" },
  ];
  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Full-year projection</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/50">{it.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${it.tone}`}>{fmt(it.value, currency)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/50">
        {p.monthsElapsed} month{p.monthsElapsed === 1 ? "" : "s"} actual + {p.monthsLeft} projected
        {p.recurringBillsTotal > 0
          ? ` · remaining months floored at ${fmt(p.recurringBillsTotal, currency)}/mo of known recurring bills`
          : ""}
        .
      </p>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wallai/budget/projection-card.tsx
git commit -m "feat(budget): full-year projection card"
```

---

### Task 6: Lazy charts

**Files:**
- Create: `src/components/wallai/budget/budget-year-chart.impl.tsx` + `budget-year-chart.tsx`
- Create: `src/components/wallai/budget/budget-month-chart.impl.tsx` + `budget-month-chart.tsx`

**Interfaces:**
- `<BudgetYearChart months={BudgetMonthTotals[]} currency />` — 12-month income vs expenses grouped bars.
- `<BudgetMonthChart data={{category, amount}[]} currency />` — horizontal category bars.

- [ ] **Step 1: `budget-year-chart.impl.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { BudgetMonthTotals } from "@/lib/wallai/budget-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(currency: string) {
  return (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function BudgetYearChart({ months, currency }: { months: BudgetMonthTotals[]; currency: string }) {
  const rows = months.map((m, i) => ({ label: MONTHS[i], income: m.income, expenses: m.expenses }));
  const f = fmt(currency);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} />
        <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} width={52} tickFormatter={(v) => f(Number(v))} />
        <Tooltip
          formatter={(value, name) => [f(Number(value)), name] as [string, string]}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="income" name="Income" fill="#34d399" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="#f87171" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: `budget-year-chart.tsx`** (lazy wrapper)

```tsx
"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BudgetYearChart as ChartImpl } from "./budget-year-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./budget-year-chart.impl").then((m) => m.BudgetYearChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={260} />,
});

export function BudgetYearChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
```

- [ ] **Step 3: `budget-month-chart.impl.tsx`**

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

function fmt(currency: string) {
  return (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function BudgetMonthChart({ data, currency }: { data: { category: string; amount: number }[]; currency: string }) {
  const rows = data.slice(0, 8);
  const f = fmt(currency);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={rows} layout="vertical" margin={{ left: 12 }}>
        <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} tickFormatter={(v) => f(Number(v))} />
        <YAxis type="category" dataKey="category" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11 }} width={90} />
        <Tooltip
          formatter={(value) => f(Number(value))}
          contentStyle={{ background: "#0A0E1A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
        />
        <Bar dataKey="amount" fill="#f87171" radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: `budget-month-chart.tsx`** (lazy wrapper)

```tsx
"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { BudgetMonthChart as ChartImpl } from "./budget-month-chart.impl";
import { ChartSkeleton } from "@/components/wallai/chart-skeleton";

const Lazy = dynamic(() => import("./budget-month-chart.impl").then((m) => m.BudgetMonthChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={260} />,
});

export function BudgetMonthChart(props: ComponentProps<typeof ChartImpl>) {
  return <Lazy {...props} />;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/wallai/budget/budget-year-chart.impl.tsx src/components/wallai/budget/budget-year-chart.tsx src/components/wallai/budget/budget-month-chart.impl.tsx src/components/wallai/budget/budget-month-chart.tsx
git commit -m "feat(budget): lazy year + month charts"
```

---

### Task 7: Budget page (server)

**Files:**
- Create: `src/app/(app)/budget/page.tsx`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Implement `page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import {
  listBudgetYears,
  getBudgetYear,
  getBudgetMonth,
} from "@/lib/wallai/budget-data";
import { BudgetControls } from "@/components/wallai/budget/budget-controls";
import { BudgetMatrixTable } from "@/components/wallai/budget/budget-matrix-table";
import { BudgetMonthTable } from "@/components/wallai/budget/budget-month-table";
import { ProjectionCard } from "@/components/wallai/budget/projection-card";
import { BudgetYearChart } from "@/components/wallai/budget/budget-year-chart";
import { BudgetMonthChart } from "@/components/wallai/budget/budget-month-chart";

export const dynamic = "force-dynamic";

function fmtCur(v: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <GlassCard>
      <p className="kicker">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${tone ?? "text-white"}`}>{value}</p>
    </GlassCard>
  );
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; view?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  const userId = session.user.id;

  const sp = await searchParams;
  const years = await listBudgetYears(userId);
  const now = new Date();
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : years[0] ?? now.getUTCFullYear();
  const view = sp.view === "month" ? "month" : "year";
  const monthRaw = Number(sp.month);
  const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getUTCMonth() + 1;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Budget</h2>
          <p className="mt-0.5 text-xs text-white/70 sm:text-sm">In-depth income &amp; expense control</p>
        </div>
        <BudgetControls years={years} year={year} view={view} month={month} />
      </div>

      {view === "year" ? await YearView({ userId, year }) : await MonthView({ userId, year, month })}
    </div>
  );
}

async function YearView({ userId, year }: { userId: string; year: number }) {
  const data = await getBudgetYear(userId, year);
  if (!data.hasData) {
    return (
      <GlassCard>
        <div className="py-10 text-center">
          <p className="text-sm text-white/60">No transactions in {year}.</p>
          <p className="mt-1 text-xs text-white/70">Import a bank statement to see the breakdown.</p>
        </div>
      </GlassCard>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Tile label="Income" value={fmtCur(data.totals.income, data.currency)} tone="text-emerald-300" />
        <Tile label="Expenses" value={fmtCur(data.totals.expenses, data.currency)} tone="text-red-300" />
        <Tile label="Net" value={fmtCur(data.totals.net, data.currency)} tone={data.totals.net >= 0 ? "text-emerald-300" : "text-red-300"} />
        <Tile label="Savings rate" value={data.totals.savingsRate === null ? "—" : `${data.totals.savingsRate.toFixed(0)}%`} />
        {data.projection && (
          <Tile label="Proj. year net" value={fmtCur(data.projection.projectedNet, data.currency)} tone="text-cyan-300" />
        )}
      </div>

      {data.projection && <ProjectionCard projection={data.projection} currency={data.currency} />}

      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Income vs expenses — {year}</h3>
        <BudgetYearChart months={data.months} currency={data.currency} />
      </GlassCard>

      <BudgetMatrixTable income={data.income} expenses={data.expenses} months={data.months} currency={data.currency} />
    </div>
  );
}

async function MonthView({ userId, year, month }: { userId: string; year: number; month: number }) {
  const data = await getBudgetMonth(userId, year, month);
  const monthName = new Intl.DateTimeFormat("en-IE", { month: "long" }).format(new Date(Date.UTC(year, month - 1, 1)));
  if (!data.hasData) {
    return (
      <GlassCard>
        <div className="py-10 text-center">
          <p className="text-sm text-white/60">No transactions in {monthName} {year}.</p>
        </div>
      </GlassCard>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Tile label="Income" value={fmtCur(data.totals.income, data.currency)} tone="text-emerald-300" />
        <Tile label="Expenses" value={fmtCur(data.totals.expenses, data.currency)} tone="text-red-300" />
        <Tile label="Net" value={fmtCur(data.totals.net, data.currency)} tone={data.totals.net >= 0 ? "text-emerald-300" : "text-red-300"} />
        <Tile label="Savings rate" value={data.totals.savingsRate === null ? "—" : `${data.totals.savingsRate.toFixed(0)}%`} />
      </div>

      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Top expenses — {monthName} {year}</h3>
        <BudgetMonthChart data={data.expenses.map((e) => ({ category: e.category, amount: e.amount }))} currency={data.currency} />
      </GlassCard>

      <BudgetMonthTable income={data.income} expenses={data.expenses} currency={data.currency} />
    </div>
  );
}
```

Note: calling `await YearView(...)` from JSX works because they are async server functions returning JSX; if the toolchain rejects invoking them as plain functions, convert them to `<YearView .../>` async server components instead.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean; `/budget` appears in the route list.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/budget/page.tsx"
git commit -m "feat(budget): budget page with year/month views"
```

---

### Task 8: Navigation

**Files:**
- Modify: `src/components/wallai/nav-icons.tsx` (add `BudgetIcon`)
- Modify: `src/components/wallai/nav-sidebar.tsx`, `src/components/wallai/nav-mobile.tsx` (add `/budget` item)

- [ ] **Step 1: Add `BudgetIcon` to `nav-icons.tsx`** (insert before `LearnIcon`)

```tsx
export const BudgetIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
  </svg>
);
```

- [ ] **Step 2: Add to `nav-sidebar.tsx`** — import `BudgetIcon`, and add to `navItems` after the Analysis entry:

```tsx
  { icon: <BudgetIcon />, label: "Budget", href: "/budget" },
```

- [ ] **Step 3: Add to `nav-mobile.tsx`** — same import + same `navItems` entry after Analysis.

- [ ] **Step 4: Verify build**

Run: `npm run build` — Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/wallai/nav-icons.tsx src/components/wallai/nav-sidebar.tsx src/components/wallai/nav-mobile.tsx
git commit -m "feat(budget): add Budget nav item"
```

---

### Task 9: Full verification + deploy

- [ ] **Step 1: Unit test**

```bash
npx tsx src/lib/wallai/budget-projection.test.ts
```
Expected: `budget-projection.test.ts PASSED`.

- [ ] **Step 2: Production build**

Run: `npm run build` — Expected: clean; `/budget` in the route list.

- [ ] **Step 3: Manual smoke** (server on a test port)
  - `/budget` returns 200 (or redirect to login), no 500.
  - Logged in: Year view shows tiles, chart, matrix, and (current year) projection; toggle to Month view shows month tiles, category bar chart, and the two category tables; switch years/months via the controls.
  - Matrix year totals reconcile with `/analysis` and dashboard figures.
  - At 375px: the matrix scrolls inside its own container; the page body does not scroll horizontally.

- [ ] **Step 4: Deploy**

```bash
npm run build && pm2 restart wallai
```
Confirm `http://localhost:3003/budget` returns 200.
