# WallAI — Dashboard Module Design Spec

**Date:** 2026-04-11
**Module:** Dashboard (`/wallai/dashboard`)
**Depends on:** Foundation module (done), Bank module (done)

## 1. Overview

The Dashboard is the user's financial home screen — a net-worth-first overview that summarises cash, crypto, property equity, and debt, with monthly trends and recent activity. It is read-only: no forms, no mutations, only queries.

This spec covers **Dashboard v1**, which ships while only the Bank module has real data. Crypto, Property, and Debt modules are not yet built, so their stat cards render as "Not configured" placeholders that will start populating automatically as those modules come online in later stages.

The existing `src/app/wallai/dashboard/page.tsx` is a fully-polished mock UI with hardcoded arrays for balances, weekly spending, category breakdown, and recent transactions. This spec replaces it with a data-driven version that keeps the same visual language (glass cards, gradient stat cards, Recharts) but pulls everything from Prisma.

## 2. Architecture

**Rendering model:** async server component with client chart wrappers.

- `src/app/wallai/dashboard/page.tsx` — async React server component. On every request it gets the session user id, runs all queries in parallel via a single helper, and passes typed props to presentational components.
- `src/lib/wallai/dashboard-data.ts` — new module with pure data-fetching functions. Exports a single `getDashboardData(userId)` that runs all required queries in parallel and returns a typed shape (defined in section 3). Also exports the shared income/expense classification helper so the stat card and the chart stay consistent.
- `src/components/wallai/dashboard/` — new folder for dashboard-specific presentational components. Chart wrappers are `"use client"` because Recharts requires the browser; pure markup components are server components.
- No new API route. The dashboard is a static snapshot per page load — there's no live filtering or refresh like the bank page has — so server rendering is strictly simpler than a `/api/wallai/dashboard` + client-fetch pattern.

**Why server-rendered:** faster first paint, zero client-side loading state, simpler error handling, no extra round trip. The existing dashboard was `"use client"` only because Recharts needs to hydrate on the client — that requirement is satisfied by making the chart components (not the whole page) client components.

**Reuses:** `GlassCard`, `GradientBg`, and the existing shared WallAI layout (`src/app/wallai/layout.tsx`) and auth handling.

## 3. Data Shape

```ts
type DashboardData = {
  user: { name: string | null; primaryCurrency: string };
  netWorth: {
    total: number;
    previousMonthTotal: number | null;   // null if no prior month data
    changePct: number | null;
    changeAbs: number | null;
    currency: string;                     // always user.primaryCurrency in v1
    asOf: Date;                           // now
  };
  stats: {
    cash:       { value: number; accountCount: number; configured: true };
    crypto:     { value: 0; configured: false };
    propertyEq: { value: 0; configured: false };
    debt:       { value: 0; configured: false };
  };
  netWorthTrend: Array<{ month: string; value: number }>;   // "YYYY-MM", up to 12 points
  incomeVsExpenses: Array<{ month: string; income: number; expenses: number }>; // 6 points
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
  hasAnyTransactions: boolean;            // drives full-page empty state
  hasNonPrimaryCurrencyAccount: boolean;  // drives warning badge
};
```

## 4. Queries

All queries run in parallel with `Promise.all`. They read only from tables owned by the Foundation and Bank modules: `User`, `BankAccount`, `Transaction`, `FinancialTip`.

### 4.1 Cash total & account count
- `SUM(Transaction.amount) GROUP BY bankAccountId` across the user's accounts → running balance per account, then summed.
- Derived from transactions (not a cached `balance` column) so corrections and re-imports reflect immediately.
- `accountCount` = `COUNT(*)` on `BankAccount WHERE userId = ?`.

### 4.2 Net worth total
- v1: `netWorth.total = stats.cash.value` (crypto/property/debt are all zero placeholders).
- `previousMonthTotal` = cumulative sum of all transactions with `date < firstDayOfThisMonth`. Null if no transactions exist before this month.
- `changeAbs = total - previousMonthTotal`, `changePct = changeAbs / previousMonthTotal * 100` (guarded against divide-by-zero → null).

### 4.3 Monthly net worth trend (up to 12 points)
- Raw SQL via `prisma.$queryRaw` (Prisma's aggregate API can't express running-sum-by-month cleanly):
  - `SELECT date_trunc('month', date) AS month, SUM(amount) AS delta FROM "Transaction" WHERE "userId" = ? GROUP BY 1 ORDER BY 1`
  - Running sum applied in JS: for each month row, `value = value_of_previous_month + delta`. Result is end-of-period balance per month.
- Capped at the most recent 12 months.
- If fewer than 2 points → chart renders an inline empty state ("Upload more statements to see your trend") instead of a broken area chart.

### 4.4 Monthly income vs expenses (6 points)
- Window: last 6 calendar months, zero-filled (months with no transactions show as `{income: 0, expenses: 0}` so the bar chart has a consistent X axis).
- Classification uses the **shared hybrid rule** defined in `isIncome(transaction)`:
  - If `category` is one of the income allowlist → income
  - Else if `category IS NULL` AND `amount > 0` → income
  - Else → expense
- Income allowlist (constant, exported from `dashboard-data.ts`):
  ```ts
  const INCOME_CATEGORIES = new Set([
    "Salary", "Freelance", "Refund", "Interest", "Transfer In",
  ]);
  ```
- Query pulls all transactions in the 6-month window in one go, then buckets in JS by month + classification. Volume is low enough (a few hundred rows at most) that this is fine.

### 4.5 Allocation donut
- v1: a single slice `{ name: "Cash", value: cash.value, color: "#10b981" }`. Looks sparse on purpose — will fill in as other modules come online.

### 4.6 Recent transactions
- `ORDER BY date DESC, id DESC LIMIT 8` across all the user's accounts.

### 4.7 Tip of the session
- `ORDER BY RANDOM() LIMIT 1` from `FinancialTip`. Postgres handles this natively. The seed has 15 rows, so this always returns one in normal operation; defensive fallback to `null` if somehow empty.
- Re-randomises on every page reload (simpler than per-session cookies and the user explicitly said "no cron, no persistence for this").

### 4.8 Freshness
- `bankLastUpdated` = `MAX(Transaction.date)` across the user's accounts. Null if none.

### 4.9 Has-any-transactions + has-non-primary-currency
- `hasAnyTransactions` = `COUNT > 0`. Drives the full-page empty state.
- `hasNonPrimaryCurrencyAccount` = `EXISTS BankAccount WHERE currency != user.primaryCurrency`. Drives a small warning badge on the cash card. v1 assumes single currency; this flag tells the user why totals might be wrong.

## 5. UI Layout

Responsive grid, keeps the existing emerald/cyan/violet/amber palette and glass-card aesthetic. Breakpoints match the rest of WallAI (`sm:` 640px, `xl:` 1280px).

### 5.1 Header
- Same as current mock: "Good morning, `{session.user.name || 'there'}`" + date pill + avatar circle (initial of name).
- Date pill reads the current month/year in the user's locale.

### 5.2 Net Worth hero (full width, new)
- Huge number: `€12,340.50` (formatted with `Intl.NumberFormat`, currency from `netWorth.currency`).
- Sub-line: `+€420.00 (+3.5%) vs last month` — emerald if positive, red if negative, white/50 if null (no prior data, shows `—`).
- Footer line (tiny, white/40): `Net worth as of Apr 11, 2026 • Bank data updated 2 days ago` (uses `freshness.bankLastUpdated`).

### 5.3 Stat cards (4, responsive grid: 2×2 → 4×1 at `xl:`)
- **Total Cash** (emerald gradient, fully opaque) — `€12,340.50` + subtext "3 accounts". Shows a small warning badge `⚠ Non-EUR account detected` if `hasNonPrimaryCurrencyAccount`.
- **Crypto** (cyan gradient, 50% opacity, "Not configured" badge)
- **Property Equity** (violet gradient, 50% opacity, "Not configured" badge)
- **Total Debt** (amber gradient, 50% opacity, "Not configured" badge)

### 5.4 Row 2 — charts
- **Net Worth Trend** (`xl:col-span-2`, area chart) — emerald gradient area, monthly points on X. If `netWorthTrend.length < 2`, render centered message "Upload more statements to see your trend".
- **Asset Allocation** (donut) — v1 has a single cash slice. Legend below.

### 5.5 Row 3 — charts
- **Monthly Income vs Expenses** (`xl:col-span-2`, grouped bar chart) — green income bars + red expense bars, 6 months on X. Zero-filled months render as 0-height bars (X axis still present).
- **Tip of the session** — glass card. Italic quote, author in smaller white/50 below, category label as tiny uppercase pill.

### 5.6 Recent Transactions (full width)
- 8 rows, same visual style as the current mock. "View all" button links to `/wallai/bank`.
- Avatar circle shows first letter of `description`. Amount in emerald if `isIncome(tx)`, white/80 otherwise.

### 5.7 Empty state
If `hasAnyTransactions === false`, the entire dashboard body (everything below the header) collapses to a single centered card:
- Large heading: "No data yet"
- Sub: "Upload your first bank statement to see your financial overview"
- Primary CTA button (emerald gradient, matches the existing button style used in `bank-account-form.tsx`) linking to `/wallai/bank`

## 6. Error Handling & Edge Cases

**Error model:** all queries run inside one top-level `try/catch` in `getDashboardData`. On failure, the whole page renders an error card (glass card with the error message in white/70 and a "Retry" link back to `/wallai/dashboard`). No partial degradation — if one query dies, something is genuinely broken and a half-rendered dashboard is confusing.

**Explicit edge cases:**

| Case | Behaviour |
|---|---|
| No bank accounts and no transactions | Full-page empty state (§5.7) |
| Exactly 1 month of transactions | Stat cards populate; trend chart shows "Upload more…"; income/expense bar shows 1 populated month + 5 zero months |
| No tips in DB | Tip card renders with message "No tip today" |
| No session | Handled upstream by `layout.tsx` auth gate; page assumes `session.user.id` exists |
| Non-standard category string | Hybrid rule falls through to sign-based classification — nothing breaks |
| Non-EUR transaction | Counted verbatim (no conversion in v1). Warning badge on cash card |
| Transaction with `amount === 0` | Ignored (neither income nor expense) |
| User with no `name` set | Header greeting says "Good morning, there" |

**No retry logic, no caching layer, no streaming.** A single user dashboard query is cheap; if it's slow enough to warrant those, the fix is an index, not an abstraction.

## 7. Testing

Consistent with the rest of this project, `/var/www/playground` has no test suite and the Bank module shipped without tests. Dashboard v1 follows the same pattern. Verification plan:

1. `npm run build` — TypeScript + Next.js static analysis must pass cleanly.
2. PM2 restart the `playground` process.
3. Manual browser verification with real data:
   - Log in as `admin@wallai.app`
   - Upload a test statement via `/wallai/bank`
   - Navigate to `/wallai/dashboard` and verify every section populates correctly
   - Delete a transaction in the bank page, reload dashboard, verify numbers update
   - Confirm "Not configured" cards render dimmed
   - Test empty state by logging in as a user with no transactions (or manually clearing them)

If a unit-test runner is to be introduced later (Vitest), the prime candidates for coverage are `isIncome()`, the monthly aggregator, and the running-sum logic in §4.3. These are pure functions — trivial to test once the harness exists. Out of scope for this plan.

## 8. Out of Scope (deferred to later stages)

- Crypto, Property, Debt data sources — these modules don't exist yet; dashboard reads zero for all three.
- Currency conversion (Frankfurter) — deferred to the Crypto module plan, which is the first stage that actually introduces a non-EUR data source.
- AI analysis panel — lives on `/wallai/analysis` (a separate future module), not on the dashboard.
- Month/period selector — dashboard always shows "current month" vs "last month". Historical drill-down is a future enhancement.
- Net worth snapshots table + cron — not needed because the trend is derived from transactions. Revisit if/when non-transactional assets (crypto, property) need historical tracking.
- Customisable layout, hideable cards, favourite widgets — YAGNI for v1.

## 9. Files Touched

**New:**
- `src/lib/wallai/dashboard-data.ts` — query helper and `isIncome()` classifier
- `src/components/wallai/dashboard/net-worth-hero.tsx`
- `src/components/wallai/dashboard/stat-card.tsx`
- `src/components/wallai/dashboard/net-worth-chart.tsx` (client)
- `src/components/wallai/dashboard/income-expenses-chart.tsx` (client)
- `src/components/wallai/dashboard/allocation-donut.tsx` (client)
- `src/components/wallai/dashboard/tip-card.tsx`
- `src/components/wallai/dashboard/recent-transactions.tsx`
- `src/components/wallai/dashboard/empty-state.tsx`

**Rewritten:**
- `src/app/wallai/dashboard/page.tsx` — from client component with mock data to async server component

**Unchanged (but read-only consumers):**
- `src/lib/prisma.ts`, `src/lib/auth.ts` — reused as-is

**Commit shape:** one commit per logical piece (data layer, individual components, page rewrite), ending in a final "integrate dashboard with real data" commit. Matches the Bank module's commit style.
