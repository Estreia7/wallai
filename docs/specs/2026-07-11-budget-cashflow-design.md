# WallAI — Budget / Cashflow Control Page

**Date:** 2026-07-11
**Status:** Design (approved for spec write)

## 1. Problem & Goal

`/analysis` gives a rolling 3/6/12-month chart overview (KPI row, monthly flow
chart, category breakdowns, top merchants, AI insight). It is chart-and-card
focused and window-based, not calendar-based.

Users want deeper, spreadsheet-style control of income and expenses: pick a
specific calendar **month or year**, see the numbers in a dense **table** (not
just charts), drill by **category**, and get a **full-year projection**.

**Goal:** a new `/budget` page — the calendar-based deep-dive that complements
(does not replace) `/analysis`.

## 2. Approach (approved)

- **New dedicated page** at `/budget` (not folded into `/analysis`).
- Core view is a **category × month matrix table**.
- Full-year projection = **recurring-bills + run-rate**:
  `actuals so far + (recurring bills × months left) + (avg variable × months left)`.

## 3. Controls

- **Year selector** — dropdown of years that have transaction data; default =
  current calendar year.
- **View toggle: Year ⇄ Month.** In Month view a month picker (Jan–Dec of the
  selected year) appears.
- State is driven via `searchParams` (`?year=2026&view=year` /
  `?year=2026&view=month&month=7`) so the server component can render directly,
  matching the `/analysis` `?period=` pattern.

## 4. Summary tiles

Income · Expenses · Net · Savings-rate for the selected scope. In **Year view**
a 5th tile shows **Projected year-end net** (current year only).

Savings rate = `net / income` when income > 0, else null. Transfers are excluded
from all totals (consistent with the rest of the app via `isTransfer`).

## 5. Graphics (lazy-loaded)

All charts follow the established lazy pattern (`*.impl.tsx` recharts body +
`next/dynamic({ssr:false})` wrapper + `ChartSkeleton`).

- **Year view:** income-vs-expenses **grouped bar chart** across the 12 months
  of the selected year (same visual language as the existing monthly-flow chart).
- **Month view:** a horizontal **category bar chart** of that month's top expense
  categories.

## 6. The table (core)

### Year view — category × month matrix
- Rows grouped under **Income** and **Expenses** (one row per category present in
  that year).
- Columns = Jan … Dec + a **Total** column.
- Subtotal rows: **Total Income**, **Total Expenses**, and a **Net** row
  (income − expenses per month).
- Empty cells render as `0` (or blank/`—`) — no gaps.
- Amounts formatted in the user's primary currency, whole numbers in the matrix
  (compact), full precision in tooltips/month view.
- **Horizontally scrollable inside its own `overflow-x-auto` container** — the
  page body never scrolls horizontally at 375px.

### Month view — single-period table
- Rows = categories, split into **Income** and **Expenses** sections.
- Columns: category, **Amount**, **% of section total**, **vs previous month**
  (▲/▼ signed delta; `—` when no prior-month data).

## 7. Projection (Year view, current year only)

A **projection card** showing projected full-year **income / expenses / net**.
Precise, unambiguous definitions (so the pure function is testable):

```
monthsElapsed = current month number (1–12) for the current year
monthsLeft    = 12 − monthsElapsed
avgMonthlyExpense = actualExpense / monthsElapsed
avgMonthlyIncome  = actualIncome  / monthsElapsed

# Remaining-month spend is floored at the known fixed bills, so the projection
# never assumes a month cheaper than the user's committed recurring costs:
perRemainingMonthExpense = max(avgMonthlyExpense, recurringBillsTotal)

projectedIncome  = actualIncome  + avgMonthlyIncome        × monthsLeft
projectedExpense = actualExpense + perRemainingMonthExpense × monthsLeft
projectedNet     = projectedIncome − projectedExpense
```

- `recurringBillsTotal` = sum of `expectedAmount` for the user's **active**,
  monthly-cadence `RecurringBill` rows (the known fixed monthly costs). `0` if the
  user has no active bills — the projection then degrades gracefully to a simple
  run-rate.
- `monthsElapsed` uses the actual current month; if it's `0` (shouldn't happen)
  or `monthsLeft ≤ 0` (December), projection = actuals (no remaining months).
- Card shows the three projected figures, a one-line note
  ("N months actual + M months projected"), and lists the active fixed bills that
  fed the floor.
- Past years: no projection (fully actual) — hide the card.

The projection math lives in a **pure, unit-tested** function so the
recurring-bill / run-rate logic is verifiable without a database.

## 8. Data layer — `src/lib/wallai/budget-data.ts`

- `getBudgetYear(userId, year): Promise<BudgetYearData>`
  → `{ currency, months: MonthTotals[12], categories: { income: CategoryRow[], expenses: CategoryRow[] }, totals, projection | null }`
  where `CategoryRow = { category, monthly: number[12], total }` and
  `MonthTotals = { income, expenses, net }`.
- `getBudgetMonth(userId, year, month): Promise<BudgetMonthData>`
  → `{ currency, income: CategoryDelta[], expenses: CategoryDelta[], totals }`
  where `CategoryDelta = { category, amount, pct, prevAmount, delta }`.
- `listBudgetYears(userId): Promise<number[]>` — distinct years with data, for the
  selector.
- Uses a single grouped SQL aggregate (`date_trunc('month', date)` + `category`)
  like `dashboard-data.ts` already does. Reuses `isIncome`/`isExpense`/`isTransfer`
  from `categories.ts`. Uncategorized transactions fall into an "Uncategorized"
  row (income vs expense decided by amount sign, matching `isIncome`/`isExpense`).
- Projection helper: `src/lib/wallai/budget-projection.ts` (pure) +
  `budget-projection.test.ts`.

## 9. Files

**New**
- `src/app/(app)/budget/page.tsx` — server component: auth, parse
  `year`/`view`/`month`, fetch, render.
- `src/lib/wallai/budget-data.ts`
- `src/lib/wallai/budget-projection.ts` (+ `.test.ts`)
- `src/components/wallai/budget/budget-controls.tsx` (client — year/view/month
  selectors, updates the URL)
- `src/components/wallai/budget/budget-matrix-table.tsx`
- `src/components/wallai/budget/budget-month-table.tsx`
- `src/components/wallai/budget/projection-card.tsx`
- `src/components/wallai/budget/budget-year-chart.tsx` + `.impl.tsx`
- `src/components/wallai/budget/budget-month-chart.tsx` + `.impl.tsx`

**Changed**
- `src/components/wallai/nav-icons.tsx` — add `BudgetIcon`.
- `src/components/wallai/nav-sidebar.tsx`, `nav-mobile.tsx` — add `/budget` item.

## 10. Testing

- **Unit (tsx):** `budget-projection.ts` — actuals + recurring + variable math;
  edge cases (no data, past year → no projection, income = 0 → savings rate null,
  months-left = 0 in December).
- **Manual/integration:** build passes; import statements, open `/budget`,
  toggle Year/Month and switch years; verify the matrix totals reconcile with the
  `/analysis` and dashboard numbers; verify projection appears only for the
  current year; verify no horizontal page overflow at 375px (table scrolls inside
  its own container).

## 11. Scope / YAGNI (v1)

- **Read-only** — no editable budget targets/limits yet (natural follow-up).
- No CSV/export in v1.
- Projection only for the current calendar year.
- Monthly cadence bills only in the projection (matches the knowledge system's v1).
