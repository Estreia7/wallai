# WallAI — Long-Term Financial Knowledge + AI Usage Tracking

**Date:** 2026-07-11
**Status:** Design (approved for spec write)

## 1. Problem & Goal

Data ingestion in WallAI is currently *stateless*. Every statement import re-runs
the same static-prompt LLM categorization; user corrections are discarded and the
next similar transaction is re-guessed from scratch. There is no per-user memory,
no merchant concept, and no notion of expected recurring bills.

**Goal:** a long-term, per-user financial *knowledge* layer that gets smarter over
time. It should:

1. Learn merchant → category mappings from AI guesses and (authoritatively) from
   user corrections, so future statements auto-match instantly with no AI cost.
2. On statement import, match transactions against known merchants and known
   recurring bills.
3. Discover recurring bills (water, gas, energy, rent, subscriptions) and prompt
   the user via to-dos to confirm them or add ones that never appear in statements.
4. Use Anthropic **Haiku** (`claude-haiku-4-5-20251001`) as the *intelligence* that
   builds and enriches the knowledge — never on the fast path.
5. Provide a dedicated **AI Usage & Cost** page (per day, per month, by category).

## 2. Core Approach (approved: "Approach A")

Deterministic **merchant-key normalizer + rules table**, with Haiku used only at
knowledge-building moments (unknown merchants, recurring-bill detection). Known
merchants are matched deterministically and auto-applied with **zero AI, zero cost**.

Rejected alternatives: vector/embedding similarity (opaque, heavy, overkill for
personal-finance volumes); LLM-with-memory-in-prompt (every import still hits the
LLM, prompt bloats with history, no free path).

## 3. Trust / Automation Model (approved)

On import, recognized merchants are categorized **instantly and silently** from
memory. Only genuinely-new/unknown merchants get Haiku and surface in a to-do for
confirmation.

## 4. Data Model (new Prisma models)

### MerchantRule — the learning layer
```
model MerchantRule {
  id          String    @id @default(cuid())
  userId      String
  merchantKey String                    // normalized identity
  displayName String                    // clean name e.g. "Pingo Doce"
  category    String                    // one of ALL_CATEGORIES
  source      String                    // "user_correction" | "confirmed" | "ai_guess"
  hitCount    Int       @default(0)
  lastSeenAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, merchantKey])
  @@index([userId])
}
```
Confidence is encoded by `source` rank: `user_correction` > `confirmed` > `ai_guess`.

### RecurringBill — expected recurring expenses
```
model RecurringBill {
  id             String    @id @default(cuid())
  userId         String
  name           String                    // "Energy (EDP)"
  category       String    @default("Bills & Utilities")
  billType       String?                   // "energy" | "water" | "gas" | "internet" | "rent" | "subscription" | "other"
  merchantKey    String?                   // primary matcher
  matchKeywords  String[]                  // fallback keyword matchers
  cadence        String    @default("monthly")  // v1: monthly only
  expectedAmount Float?
  currency       String    @default("EUR")
  dayOfMonthHint Int?
  status         String                    // "candidate" | "active" | "dismissed"
  source         String                    // "auto_detected" | "user_added"
  lastSeenAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, status])
}
```

### Todo — the knowledge prompts
```
model Todo {
  id         String    @id @default(cuid())
  userId     String
  type       String                     // "confirm_merchants" | "confirm_bill" | "add_bill_hint" | "missing_bill"
  status     String    @default("pending")  // "pending" | "done" | "dismissed"
  title      String
  body       String?
  payload    Json                       // type-specific (billId, merchantKeys, month, suggestedCategory, ...)
  dedupeKey  String                     // stable per (type + subject); prevents duplicate pending todos
  createdAt  DateTime  @default(now())
  resolvedAt DateTime?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, dedupeKey])
  @@index([userId, status])
}
```

All three add back-relations on `User`.

## 5. Merchant Normalization — `lib/wallai/knowledge/normalize.ts`

Pure function `normalizeMerchant(description) => { merchantKey, displayName }`.
Deterministic pipeline:

1. Uppercase, trim.
2. Strip PT/EU transaction prefixes: `COMPRA`, `PAGAMENTO`, `PAG.`, `PAG `, `TRF`,
   `TRANSF`, `DD`, `DEB DIR`, `MB WAY`, `MBWAY`, `LEVANTAMENTO`, `COMPRA C DEB`, etc.
3. Remove dates (`dd-mm`, `dd/mm/yyyy`, `yyyy-mm-dd`), times (`hh:mm`), and runs of
   ≥4 digits (card/reference/store numbers).
4. Drop a conservative trailing location token list (`LISBOA`, `PORTO`, `LISBON`, …).
5. Collapse whitespace/punctuation; keep up to the first ~3 meaningful tokens.
6. `merchantKey` = lowercased normalized string; `displayName` = title-cased.

**Design bias: under-merge.** Keeping two distinct merchants separate is far safer
than wrongly collapsing them into one rule. When Haiku enriches a new merchant it
may supply a better `displayName`, but the deterministic `merchantKey` remains the
lookup key so behavior is stable and debuggable.

## 6. Matching Engine — `lib/wallai/knowledge/matcher.ts`

- `matchCategory(userId, txs)` → loads the user's rule map once; returns
  `{ hits: [{ txId, category, ruleId }], misses: Tx[] }`.
- `learnFromCategorization(userId, entries, source)` → upserts rules; **source only
  upgrades, never downgrades**; bumps `hitCount`, sets `lastSeenAt`.
- `learnFromCorrection(userId, tx, category)` → upsert at `user_correction`
  (always wins).

## 7. AI Layer (Haiku) — where intelligence runs

Model: `claude-haiku-4-5-20251001`, via existing `getAnthropicClient(userId)` +
`logApiUsage`. `claude-api` skill to be consulted before implementation to confirm
model id, structured-output pattern, and token handling.

**7.1 New-merchant enrichment (upgraded categorize call).** For unknown merchants
only, one Haiku call returns per item:
```
{ id, displayName: "Pingo Doce", category: "Groceries",
  isLikelyRecurring: false, billType: null }
```
This single call categorizes, produces the clean `displayName` for the MerchantRule,
and pre-flags utilities/subscriptions — no extra cost vs today's categorize call.
Logged under endpoint `categorize-transactions`.

**7.2 AI-driven recurring-bill detection.** The frequency heuristic is a cheap
pre-filter (see §8); the pre-filtered merchant summaries (merchant, month-count,
amount stats) go to Haiku, which returns labeled candidates:
```
{ name: "Energy (EDP)", category: "Bills & Utilities",
  billType: "energy", expectedAmount: 61.40, confidence: "high" }
```
Haiku supplies semantic labels a counter cannot (EDP=energy, EPAL/Águas=water,
MEO/NOS=internet/phone). Logged under new endpoint `detect-recurring-bills`.

**7.3 Bill → transaction matching stays deterministic** (merchantKey/keywords) for
v1 to bound cost.

**Fast path guarantee:** known merchants never call Haiku. AI runs only on
(a) unknown merchants during import, (b) the small pre-filtered set during bill
detection.

## 8. Ingestion & Recurring-Bill Flow

Refactor the current `/api/wallai/transactions/categorize` route body into a shared
`categorizeTransactions(userId, txs)` in `lib/wallai/knowledge/categorize.ts` (the
route keeps working for the manual "categorize now" button and backfill).

**On statement confirm (`/api/wallai/statements/confirm`), after transactions are created:**

1. **Match from memory** (`matchCategory`) → auto-apply known merchants (silent, 0 AI).
2. **Unknowns → Haiku** (§7.1) → apply categories + `learnFromCategorization("ai_guess")`
   with displayName; capture `isLikelyRecurring/billType` flags.
3. **Recurring-bill match** over new txs → update matched bills' `lastSeenAt`,
   refine `expectedAmount`.
4. **Recurring-bill detection** (§8a) + **missing-bill check** (§8b) → generate to-dos.

**8a. Detection — `lib/wallai/knowledge/bills.ts`**
- Pre-filter: group expense txs by `merchantKey`; select merchants appearing in
  **≥3 distinct months** with amount consistency (coefficient of variation within a
  band), excluding merchantKeys already tied to an active/dismissed bill.
- Send pre-filtered summaries to Haiku (§7.2) → create `RecurringBill(status="candidate")`
  + a `confirm_bill` todo per new candidate.

**8b. Missing-bill check**
- For each `active` bill, if no matching tx exists in the current month past its
  `dayOfMonthHint` (+ grace) → `missing_bill` todo.
- Computed lazily on import **and** on dashboard-data load. Idempotent via `dedupeKey`.
  **No scheduler required** (the app has none).

**8c. Bootstrap ("input your monthly expenses")**
- If the user has no bills at all, seed `add_bill_hint` to-dos for common ones:
  water, gas, energy, internet, rent. Resolving one creates a `user_added`
  RecurringBill with the amount the user types.

## 9. Learning Hook (corrections)

In `PATCH /api/wallai/transactions/[id]`, when the user sets a category, call
`learnFromCorrection(userId, tx, category)`. Every manual fix teaches the system
permanently at the highest confidence.

## 10. To-do System & Dashboard Surface

- `lib/wallai/knowledge/todos.ts`: create (with `dedupeKey`), list, resolve, dismiss.
- API:
  - `GET /api/wallai/todos` → pending todos.
  - `POST /api/wallai/todos/[id]/resolve` → `{ action, payload }`.
    - `confirm_merchants`: upgrade rules to `confirmed`, or user-fixed category →
      `user_correction` (re-applies to matching transactions).
    - `confirm_bill`: set bill `active` (with edits) or `dismissed`.
    - `add_bill_hint`: create `user_added` bill from typed amount/details.
    - `missing_bill`: dismiss / mark handled.
- **Dashboard:** `TodosCard` component listing pending items + a count **badge** in
  `NavMobile` and `NavSidebar`. Responsive, tap targets ≥44px (project mobile rule).
  Dashboard-data fetch returns pending-todo count + top items.

## 11. AI Usage & Cost Page (new)

- **Route** `/usage` — new nav item + icon. Mobile-first.
- **Shared category map** `lib/wallai/ai-usage-categories.ts` (reused by settings
  usage card and this page):

  | endpoint (actual string in code) | category label |
  |---|---|
  | `parse-statement` | Statement parsing |
  | `categorize-transactions` | Transaction categorization + merchant enrichment |
  | `detect-recurring-bills` | Recurring-bill detection *(new)* |
  | `analysis-insight` | Financial insights |
  | `learn/ai-traits` | Book analysis |

  Unknown endpoints fall back to an "Other" label.
- **API:** extend `/api/wallai/usage` to return, in addition to current month daily
  data: a **per-category breakdown** (cost + calls per endpoint category) and a
  **multi-month trend** (last ~6 months cost totals).
- **Page contents:**
  - This-month total (USD) + call count, vs last month (▲/▼ delta).
  - Cost per day — bar chart (current month), lazy-loaded (per perf work).
  - Cost per month — trend chart (~6 months), lazy-loaded.
  - By-category breakdown — donut + table (cost/calls per usage type).
  - Model split (Haiku vs others) as a small stat.
- New knowledge features log via the same `logApiUsage`, so they appear automatically.

## 12. Testing

- **Unit (tsx, per existing `profile.test.ts` pattern):**
  - `normalize.ts` — real PT/EU description samples → expected `merchantKey`
    (including under-merge cases: two store branches must map together only when
    intended; two different merchants must not collide).
  - matcher — source never downgrades; `user_correction` always wins; `hitCount`
    increments.
  - bills detection pre-filter — synthetic tx sets → expected candidate set.
- **Integration (manual):** import a statement → known merchants auto-apply +
  unknowns produce a `confirm_merchants` todo; correct one category; re-import a
  similar statement → previously-unknown merchant now auto-applied with no AI call.
  Verify `/usage` reflects the new `detect-recurring-bills` category.

## 13. Scope / YAGNI (v1)

- Cadence: **monthly only** (schema allows others; logic handles monthly).
- **No** amount-spike/anomaly alerts (amounts are stored; alerting deferred).
- **No scheduler** — detection + missing-bill checks run on import and dashboard
  load, made idempotent by `Todo.dedupeKey`.
- Normalization stays conservative (bias to under-merge).
- Bill→tx matching deterministic (no per-transaction AI).

## 14. New / Changed Files (summary)

**New**
- `prisma/schema.prisma` — MerchantRule, RecurringBill, Todo (+ migration).
- `lib/wallai/knowledge/normalize.ts` (+ `normalize.test.ts`)
- `lib/wallai/knowledge/matcher.ts` (+ `matcher.test.ts`)
- `lib/wallai/knowledge/categorize.ts` (shared, Haiku-enriched)
- `lib/wallai/knowledge/bills.ts` (+ `bills.test.ts`)
- `lib/wallai/knowledge/todos.ts`
- `lib/wallai/ai-usage-categories.ts`
- `app/api/wallai/todos/route.ts`, `app/api/wallai/todos/[id]/resolve/route.ts`
- `app/(app)/usage/page.tsx` + usage chart components (lazy-loaded)
- `components/wallai/dashboard/todos-card.tsx`

**Changed**
- `app/api/wallai/transactions/categorize/route.ts` → delegates to shared fn.
- `app/api/wallai/statements/confirm/route.ts` → memory-match → Haiku → bills → todos.
- `app/api/wallai/transactions/[id]/route.ts` → learning hook on correction.
- `app/api/wallai/usage/route.ts` → per-category + multi-month data.
- `lib/wallai/dashboard-data.ts` → pending-todo count/items + missing-bill check.
- `components/wallai/nav-mobile.tsx`, `nav-sidebar.tsx` → to-do badge, `/usage` nav.
