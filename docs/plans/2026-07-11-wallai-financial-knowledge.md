# WallAI Financial Knowledge + AI Usage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a long-term per-user financial knowledge layer (merchant memory, recurring-bill detection, to-dos) with Haiku enrichment on the slow path only, plus a dedicated AI usage/cost page.

**Architecture:** Deterministic `merchantKey` normalizer + `MerchantRule` table gives instant, free auto-categorization of known merchants. Haiku runs only for unknown merchants (enriched categorize call) and AI-labeled recurring-bill detection over a cheap frequency pre-filter. A `Todo` table (deduped) drives dashboard prompts. `ApiUsage` (already logged) powers a new `/usage` page grouped by endpoint category.

**Tech Stack:** Next.js 16 (App Router), React 19, Prisma 7 + Postgres, NextAuth 5, Tailwind 4, Recharts (lazy), Anthropic SDK (`claude-haiku-4-5-20251001`).

## Global Constraints

- Model id: `claude-haiku-4-5-20251001` (matches existing code).
- All AI calls go through `getAnthropicClient(userId)` and `logApiUsage({ userId, endpoint, model, inputTokens, outputTokens })`.
- Mobile-first: responsive Tailwind, tap targets ≥44px, verify at 375px width.
- Charts must be lazy-loaded via the existing `next/dynamic` wrapper pattern (`*.impl.tsx` + `ChartSkeleton`).
- Tests are plain `tsx` files using a local `assert()` helper, run with `npx tsx <path>`. No test framework.
- Categories come from `@/lib/wallai/categories` (`ALL_CATEGORIES`, etc.).
- Source confidence rank: `user_correction` (3) > `confirmed` (2) > `ai_guess` (1). Source only upgrades, never downgrades.
- Cadence v1: monthly only. No scheduler. No anomaly alerts.
- Deploy: `npm run build` must pass; live deploy is `pm2 restart wallai` (port 3003).

---

### Task 1: Prisma models + migration

**Files:**
- Modify: `prisma/schema.prisma` (add 3 models + User back-relations)

**Interfaces:**
- Produces: Prisma models `MerchantRule`, `RecurringBill`, `Todo` with the fields below; `prisma.merchantRule`, `prisma.recurringBill`, `prisma.todo` clients.

- [ ] **Step 1: Add models to `prisma/schema.prisma`** (append after `ApiUsage`)

```prisma
model MerchantRule {
  id          String    @id @default(cuid())
  userId      String
  merchantKey String
  displayName String
  category    String
  source      String    // "user_correction" | "confirmed" | "ai_guess"
  hitCount    Int       @default(0)
  lastSeenAt  DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, merchantKey])
  @@index([userId])
}

model RecurringBill {
  id             String    @id @default(cuid())
  userId         String
  name           String
  category       String    @default("Bills & Utilities")
  billType       String?   // "energy" | "water" | "gas" | "internet" | "rent" | "subscription" | "other"
  merchantKey    String?
  matchKeywords  String[]
  cadence        String    @default("monthly")
  expectedAmount Float?
  currency       String    @default("EUR")
  dayOfMonthHint Int?
  status         String    // "candidate" | "active" | "dismissed"
  source         String    // "auto_detected" | "user_added"
  lastSeenAt     DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, status])
}

model Todo {
  id         String    @id @default(cuid())
  userId     String
  type       String    // "confirm_merchants" | "confirm_bill" | "add_bill_hint" | "missing_bill"
  status     String    @default("pending")
  title      String
  body       String?
  payload    Json
  dedupeKey  String
  createdAt  DateTime  @default(now())
  resolvedAt DateTime?
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, dedupeKey])
  @@index([userId, status])
}
```

- [ ] **Step 2: Add back-relations to `model User`** (add three lines alongside its other relations)

```prisma
  merchantRules  MerchantRule[]
  recurringBills RecurringBill[]
  todos          Todo[]
```

- [ ] **Step 3: Create + apply migration**

Run: `npx prisma migrate dev --name financial_knowledge`
Expected: migration created and applied; `prisma generate` runs clean.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(knowledge): add MerchantRule, RecurringBill, Todo models"
```

---

### Task 2: Merchant normalizer (pure, TDD)

**Files:**
- Create: `src/lib/wallai/knowledge/normalize.ts`
- Test: `src/lib/wallai/knowledge/normalize.test.ts`

**Interfaces:**
- Produces: `normalizeMerchant(description: string): { merchantKey: string; displayName: string }`

- [ ] **Step 1: Write failing test `normalize.test.ts`**

```ts
import { normalizeMerchant } from "./normalize";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// strips prefix, ref numbers and city -> stable key across branches
{
  const a = normalizeMerchant("COMPRA 1234 PINGO DOCE 4521 LISBOA");
  const b = normalizeMerchant("COMPRA PINGO DOCE 9987 PORTO");
  assert(a.merchantKey === b.merchantKey, "two Pingo Doce branches share a key");
  assert(a.merchantKey === "pingo doce", `key is 'pingo doce', got '${a.merchantKey}'`);
  assert(a.displayName === "Pingo Doce", `display 'Pingo Doce', got '${a.displayName}'`);
}

// distinct merchants must NOT collide (under-merge bias)
{
  const a = normalizeMerchant("PAGAMENTO SERVICOS EDP COMERCIAL");
  const b = normalizeMerchant("COMPRA CONTINENTE ONLINE");
  assert(a.merchantKey !== b.merchantKey, "EDP and Continente differ");
}

// strips MB WAY / dates / times
{
  const r = normalizeMerchant("MB WAY 12/03 21:44 GLOVO");
  assert(r.merchantKey === "glovo", `expected 'glovo', got '${r.merchantKey}'`);
}

// empty / junk input is safe
{
  const r = normalizeMerchant("   ");
  assert(typeof r.merchantKey === "string", "returns a string key for blank input");
}

console.log("normalize.test.ts PASSED");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/lib/wallai/knowledge/normalize.test.ts`
Expected: FAIL (module not found / not a function).

- [ ] **Step 3: Implement `normalize.ts`**

```ts
// Deterministic bank-description normalizer. Bias: UNDER-merge.
// Keeping two distinct merchants apart is safer than wrongly merging them.

const PREFIXES = [
  "COMPRA C DEB",
  "COMPRA CONTACTLESS",
  "COMPRA",
  "PAGAMENTO SERVICOS",
  "PAGAMENTO",
  "PAG.",
  "PAG ",
  "TRANSFERENCIA",
  "TRANSF",
  "TRF",
  "DEB DIR",
  "DEBITO DIRETO",
  "DD ",
  "MB WAY",
  "MBWAY",
  "LEVANTAMENTO",
  "COMPRAS",
];

// Conservative trailing-location tokens to drop.
const LOCATIONS = new Set([
  "LISBOA", "LISBON", "PORTO", "OPORTO", "COIMBRA", "BRAGA", "FARO",
  "SETUBAL", "AVEIRO", "ONLINE", "PT", "ESP", "PRT",
]);

function stripPrefixes(s: string): string {
  let out = s;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PREFIXES) {
      if (out.startsWith(p + " ") || out === p) {
        out = out.slice(p.length).trimStart();
        changed = true;
      }
    }
  }
  return out;
}

export function normalizeMerchant(description: string): {
  merchantKey: string;
  displayName: string;
} {
  let s = (description || "").toUpperCase().trim();

  // remove dates and times
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  s = s.replace(/\b\d{1,2}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?\b/g, " ");
  s = s.replace(/\b\d{1,2}:\d{2}\b/g, " ");

  s = stripPrefixes(s);

  // remove standalone digit runs of length >= 4 (card/ref/store numbers)
  s = s.replace(/\b\d{4,}\b/g, " ");
  // remove any remaining pure-number tokens
  s = s.replace(/\b\d+\b/g, " ");

  // collapse punctuation to spaces, squeeze whitespace
  s = s.replace(/[^A-Z ]+/g, " ").replace(/\s+/g, " ").trim();

  // drop trailing location tokens
  let tokens = s.split(" ").filter(Boolean);
  while (tokens.length > 1 && LOCATIONS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  // keep up to first 3 meaningful tokens
  tokens = tokens.slice(0, 3);

  const merchantKey = tokens.join(" ").toLowerCase();
  const displayName = tokens
    .map((t) => t.charAt(0) + t.slice(1).toLowerCase())
    .join(" ");

  return { merchantKey, displayName };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx src/lib/wallai/knowledge/normalize.test.ts`
Expected: `normalize.test.ts PASSED`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallai/knowledge/normalize.ts src/lib/wallai/knowledge/normalize.test.ts
git commit -m "feat(knowledge): deterministic merchant normalizer + tests"
```

---

### Task 3: AI usage categories (pure, TDD)

**Files:**
- Create: `src/lib/wallai/ai-usage-categories.ts`
- Test: `src/lib/wallai/ai-usage-categories.test.ts`

**Interfaces:**
- Produces: `endpointCategory(endpoint: string): string`; `USAGE_CATEGORY_ORDER: string[]`.

- [ ] **Step 1: Write failing test**

```ts
import { endpointCategory } from "./ai-usage-categories";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

assert(endpointCategory("parse-statement") === "Statement parsing", "parse-statement");
assert(endpointCategory("categorize-transactions") === "Transaction categorization", "categorize");
assert(endpointCategory("detect-recurring-bills") === "Recurring-bill detection", "bills");
assert(endpointCategory("analysis-insight") === "Financial insights", "insights");
assert(endpointCategory("learn/ai-traits") === "Book analysis", "books");
assert(endpointCategory("something-else") === "Other", "fallback");
console.log("ai-usage-categories.test.ts PASSED");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/lib/wallai/ai-usage-categories.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
const MAP: Record<string, string> = {
  "parse-statement": "Statement parsing",
  "categorize-transactions": "Transaction categorization",
  "detect-recurring-bills": "Recurring-bill detection",
  "analysis-insight": "Financial insights",
  "learn/ai-traits": "Book analysis",
};

export const USAGE_CATEGORY_ORDER = [
  "Statement parsing",
  "Transaction categorization",
  "Recurring-bill detection",
  "Financial insights",
  "Book analysis",
  "Other",
];

export function endpointCategory(endpoint: string): string {
  return MAP[endpoint] ?? "Other";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx src/lib/wallai/ai-usage-categories.test.ts`
Expected: PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallai/ai-usage-categories.ts src/lib/wallai/ai-usage-categories.test.ts
git commit -m "feat(usage): endpoint -> category mapping + tests"
```

---

### Task 4: Source-rank helper + matcher (TDD for pure part)

**Files:**
- Create: `src/lib/wallai/knowledge/matcher.ts`
- Test: `src/lib/wallai/knowledge/matcher.test.ts`

**Interfaces:**
- Consumes: `normalizeMerchant` (Task 2), `prisma`.
- Produces:
  - `SOURCE_RANK: Record<string, number>`
  - `higherSource(a: string, b: string): string`
  - `matchCategory(userId, txs: {id;description;amount}[]): Promise<{ hits: {txId;category;ruleId}[]; misses: typeof txs }>`
  - `learnFromCategorization(userId, entries: {description;category;displayName?}[], source: string): Promise<void>`
  - `learnFromCorrection(userId, description: string, category: string): Promise<void>`

- [ ] **Step 1: Write failing test (pure helper only)**

```ts
import { higherSource, SOURCE_RANK } from "./matcher";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

assert(SOURCE_RANK["user_correction"] > SOURCE_RANK["confirmed"], "correction > confirmed");
assert(SOURCE_RANK["confirmed"] > SOURCE_RANK["ai_guess"], "confirmed > ai_guess");
assert(higherSource("ai_guess", "confirmed") === "confirmed", "picks higher");
assert(higherSource("user_correction", "confirmed") === "user_correction", "correction wins");
console.log("matcher.test.ts PASSED");
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/lib/wallai/knowledge/matcher.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `matcher.ts`**

```ts
import { prisma } from "@/lib/prisma";
import { normalizeMerchant } from "./normalize";

export const SOURCE_RANK: Record<string, number> = {
  ai_guess: 1,
  confirmed: 2,
  user_correction: 3,
};

export function higherSource(a: string, b: string): string {
  return (SOURCE_RANK[a] ?? 0) >= (SOURCE_RANK[b] ?? 0) ? a : b;
}

type TxLite = { id: string; description: string; amount: number };

export async function matchCategory(
  userId: string,
  txs: TxLite[],
): Promise<{ hits: { txId: string; category: string; ruleId: string }[]; misses: TxLite[] }> {
  const rules = await prisma.merchantRule.findMany({ where: { userId } });
  const byKey = new Map(rules.map((r) => [r.merchantKey, r]));
  const hits: { txId: string; category: string; ruleId: string }[] = [];
  const misses: TxLite[] = [];
  for (const tx of txs) {
    const { merchantKey } = normalizeMerchant(tx.description);
    const rule = merchantKey ? byKey.get(merchantKey) : undefined;
    if (rule) hits.push({ txId: tx.id, category: rule.category, ruleId: rule.id });
    else misses.push(tx);
  }
  return { hits, misses };
}

async function upsertRule(
  userId: string,
  description: string,
  category: string,
  source: string,
  displayName?: string,
): Promise<void> {
  const norm = normalizeMerchant(description);
  if (!norm.merchantKey) return;
  const existing = await prisma.merchantRule.findUnique({
    where: { userId_merchantKey: { userId, merchantKey: norm.merchantKey } },
  });
  if (!existing) {
    await prisma.merchantRule.create({
      data: {
        userId,
        merchantKey: norm.merchantKey,
        displayName: displayName || norm.displayName,
        category,
        source,
        hitCount: 1,
        lastSeenAt: new Date(),
      },
    });
    return;
  }
  const winningSource = higherSource(existing.source, source);
  // Only overwrite category when the incoming source is at least as authoritative.
  const nextCategory =
    (SOURCE_RANK[source] ?? 0) >= (SOURCE_RANK[existing.source] ?? 0)
      ? category
      : existing.category;
  await prisma.merchantRule.update({
    where: { id: existing.id },
    data: {
      category: nextCategory,
      source: winningSource,
      displayName: displayName || existing.displayName,
      hitCount: { increment: 1 },
      lastSeenAt: new Date(),
    },
  });
}

export async function learnFromCategorization(
  userId: string,
  entries: { description: string; category: string; displayName?: string }[],
  source: string,
): Promise<void> {
  for (const e of entries) {
    await upsertRule(userId, e.description, e.category, source, e.displayName);
  }
}

export async function learnFromCorrection(
  userId: string,
  description: string,
  category: string,
): Promise<void> {
  await upsertRule(userId, description, category, "user_correction");
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx src/lib/wallai/knowledge/matcher.test.ts`
Expected: PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallai/knowledge/matcher.ts src/lib/wallai/knowledge/matcher.test.ts
git commit -m "feat(knowledge): merchant matcher + source-upgrade learning"
```

---

### Task 5: Recurring-bill pre-filter (pure, TDD)

**Files:**
- Create: `src/lib/wallai/knowledge/bill-detect.ts`
- Test: `src/lib/wallai/knowledge/bill-detect.test.ts`

**Interfaces:**
- Consumes: `normalizeMerchant`.
- Produces: `selectRecurringCandidates(txs: {date: string|Date; description: string; amount: number}[], opts?): CandidateSummary[]` where
  `CandidateSummary = { merchantKey: string; displayName: string; monthsSeen: number; avgAmount: number; sampleDescriptions: string[] }`.
  Rule: expense (amount < 0), appears in ≥3 distinct calendar months, coefficient-of-variation of |amount| ≤ 0.35.

- [ ] **Step 1: Write failing test**

```ts
import { selectRecurringCandidates } from "./bill-detect";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

const txs = [
  { date: "2026-01-10", description: "PAGAMENTO SERVICOS EDP", amount: -60 },
  { date: "2026-02-10", description: "PAGAMENTO SERVICOS EDP", amount: -62 },
  { date: "2026-03-10", description: "PAGAMENTO SERVICOS EDP", amount: -61 },
  { date: "2026-01-05", description: "COMPRA PINGO DOCE", amount: -14 },
  { date: "2026-01-06", description: "COMPRA PINGO DOCE", amount: -80 },
];
const out = selectRecurringCandidates(txs);
assert(out.length === 1, `one candidate, got ${out.length}`);
assert(out[0].merchantKey === "edp", `edp key, got ${out[0].merchantKey}`);
assert(out[0].monthsSeen === 3, "3 months");
assert(Math.abs(out[0].avgAmount - 61) < 1.5, "avg ~61");
console.log("bill-detect.test.ts PASSED");
```

Note: `PAGAMENTO SERVICOS` is a stripped prefix, so the EDP key is `edp`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx src/lib/wallai/knowledge/bill-detect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { normalizeMerchant } from "./normalize";

export type CandidateSummary = {
  merchantKey: string;
  displayName: string;
  monthsSeen: number;
  avgAmount: number;
  sampleDescriptions: string[];
};

export function selectRecurringCandidates(
  txs: { date: string | Date; description: string; amount: number }[],
  opts: { minMonths?: number; maxCv?: number } = {},
): CandidateSummary[] {
  const minMonths = opts.minMonths ?? 3;
  const maxCv = opts.maxCv ?? 0.35;

  const groups = new Map<
    string,
    { displayName: string; months: Set<string>; amounts: number[]; samples: Set<string> }
  >();

  for (const tx of txs) {
    if (tx.amount >= 0) continue; // expenses only
    const { merchantKey, displayName } = normalizeMerchant(tx.description);
    if (!merchantKey) continue;
    const d = new Date(tx.date);
    const monthKey = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    const g = groups.get(merchantKey) ?? {
      displayName,
      months: new Set<string>(),
      amounts: [],
      samples: new Set<string>(),
    };
    g.months.add(monthKey);
    g.amounts.push(Math.abs(tx.amount));
    if (g.samples.size < 3) g.samples.add(tx.description);
    groups.set(merchantKey, g);
  }

  const out: CandidateSummary[] = [];
  for (const [merchantKey, g] of groups) {
    if (g.months.size < minMonths) continue;
    const mean = g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length;
    if (mean === 0) continue;
    const variance =
      g.amounts.reduce((a, b) => a + (b - mean) ** 2, 0) / g.amounts.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > maxCv) continue;
    out.push({
      merchantKey,
      displayName: g.displayName,
      monthsSeen: g.months.size,
      avgAmount: Math.round(mean * 100) / 100,
      sampleDescriptions: Array.from(g.samples),
    });
  }
  return out.sort((a, b) => b.monthsSeen - a.monthsSeen);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx tsx src/lib/wallai/knowledge/bill-detect.test.ts`
Expected: PASSED.

- [ ] **Step 5: Commit**

```bash
git add src/lib/wallai/knowledge/bill-detect.ts src/lib/wallai/knowledge/bill-detect.test.ts
git commit -m "feat(knowledge): recurring-bill frequency pre-filter + tests"
```

---

### Task 6: Shared Haiku-enriched categorize function

**Files:**
- Create: `src/lib/wallai/knowledge/categorize.ts`
- Modify: `src/app/api/wallai/transactions/categorize/route.ts` (delegate to shared fn)

**Interfaces:**
- Consumes: `getAnthropicClient`, `logApiUsage`, `ALL_CATEGORIES`, `INCOME_CATEGORIES`, `EXPENSE_CATEGORIES`.
- Produces: `enrichUnknownMerchants(userId, txs: {id;description;amount}[]): Promise<EnrichResult[]>` where
  `EnrichResult = { id: string; category: string; displayName: string; isLikelyRecurring: boolean; billType: string | null }`.

**Note:** Before implementing, consult the `claude-api` skill to confirm model id, message shape, and token usage fields.

- [ ] **Step 1: Implement `categorize.ts`** (Haiku call, batched, tolerant parsing — mirror the existing route's batching/parse guards)

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";
import {
  ALL_CATEGORIES,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from "@/lib/wallai/categories";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 16384;
const BATCH_SIZE = 120;

export type EnrichResult = {
  id: string;
  category: string;
  displayName: string;
  isLikelyRecurring: boolean;
  billType: string | null;
};

const PROMPT = `You are categorizing bank transactions from a Portuguese or European personal bank account and extracting merchant info. For each transaction return one object.

Allowed INCOME categories (money IN, positive amounts):
${INCOME_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Allowed EXPENSE categories (money OUT, negative amounts):
${EXPENSE_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Rules:
- Sign decides income vs expense: positive = income category, negative = expense category.
- PT grocery chains (PINGO DOCE, LIDL, CONTINENTE, INTERMARCHE, MINIPRECO, AUCHAN, MERCADONA) -> Groceries.
- Restaurants, cafes, delivery (UBER EATS, GLOVO) -> Dining. Ride-hailing/fuel/tolls -> Transport.
- Utilities: electricity (EDP, ENDESA, IBERDROLA), water (EPAL, AGUAS), gas (GALP, GOLDENERGY), internet/phone (MEO, NOS, VODAFONE) -> Bills & Utilities.
- Streaming (NETFLIX, SPOTIFY, HBO, DISNEY, ICLOUD) -> Subscriptions.
- displayName: the clean human merchant name (e.g. "Pingo Doce", "EDP"), Title Case, no ref numbers/dates.
- isLikelyRecurring: true if this looks like a monthly bill or subscription (utility, rent, streaming, insurance).
- billType: one of "energy","water","gas","internet","rent","subscription","other" when isLikelyRecurring, else null.

Return ONLY a JSON array, one object per input in the same order, no markdown fences:
[{"id":"cmx","category":"Groceries","displayName":"Pingo Doce","isLikelyRecurring":false,"billType":null}]`;

export async function enrichUnknownMerchants(
  userId: string,
  txs: { id: string; description: string; amount: number }[],
): Promise<EnrichResult[]> {
  if (txs.length === 0) return [];
  const client = await getAnthropicClient(userId);
  const allowed = new Set<string>(ALL_CATEGORIES);
  const results: EnrichResult[] = [];

  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    const batch = txs.slice(i, i + BATCH_SIZE);
    const input = batch.map((t) => ({ id: t.id, description: t.description, amount: t.amount }));
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: `${PROMPT}\n\nTransactions:\n${JSON.stringify(input)}` }],
    });
    await logApiUsage({
      userId,
      endpoint: "categorize-transactions",
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const textBlock = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text",
    );
    if (!textBlock) continue;
    let raw = textBlock.text.trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence) raw = fence[1].trim();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.category !== "string") continue;
      if (!allowed.has(o.category)) continue;
      results.push({
        id: o.id,
        category: o.category,
        displayName: typeof o.displayName === "string" ? o.displayName : "",
        isLikelyRecurring: o.isLikelyRecurring === true,
        billType: typeof o.billType === "string" ? o.billType : null,
      });
    }
  }
  return results;
}
```

- [ ] **Step 2: Refactor the categorize route to use memory + enrichment**

Replace the body of `POST` in `src/app/api/wallai/transactions/categorize/route.ts` so it: (a) loads uncategorized txs, (b) `matchCategory` → apply hits, (c) `enrichUnknownMerchants` on misses → apply + `learnFromCategorization(..., "ai_guess")`. Keep the `ApiKeyNotConfiguredError` handling.

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiKeyNotConfiguredError } from "@/lib/anthropic";
import { matchCategory, learnFromCategorization } from "@/lib/wallai/knowledge/matcher";
import { enrichUnknownMerchants } from "@/lib/wallai/knowledge/categorize";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const uncategorized = await prisma.transaction.findMany({
    where: { userId, category: null },
    select: { id: true, description: true, amount: true },
    orderBy: { date: "asc" },
  });
  if (uncategorized.length === 0) return NextResponse.json({ categorized: 0, total: 0 });

  try {
    const { hits, misses } = await matchCategory(userId, uncategorized);
    for (const h of hits) {
      await prisma.transaction.update({ where: { id: h.txId }, data: { category: h.category } });
    }

    let aiCount = 0;
    if (misses.length > 0) {
      const enriched = await enrichUnknownMerchants(userId, misses);
      const byId = new Map(misses.map((m) => [m.id, m]));
      const learn: { description: string; category: string; displayName?: string }[] = [];
      for (const e of enriched) {
        await prisma.transaction.update({ where: { id: e.id }, data: { category: e.category } });
        const tx = byId.get(e.id);
        if (tx) learn.push({ description: tx.description, category: e.category, displayName: e.displayName });
        aiCount++;
      }
      await learnFromCategorization(userId, learn, "ai_guess");
    }

    return NextResponse.json({ categorized: hits.length + aiCount, total: uncategorized.length });
  } catch (error) {
    if (error instanceof ApiKeyNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[categorize] error:", error);
    return NextResponse.json({ error: "Failed to categorize transactions." }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Compiles + type-checks clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallai/knowledge/categorize.ts src/app/api/wallai/transactions/categorize/route.ts
git commit -m "feat(knowledge): memory-first categorize with Haiku enrichment"
```

---

### Task 7: Todos helper

**Files:**
- Create: `src/lib/wallai/knowledge/todos.ts`

**Interfaces:**
- Produces:
  - `upsertTodo(userId, { type; dedupeKey; title; body?; payload }): Promise<void>` (no-op if a pending todo with same `dedupeKey` exists)
  - `listPendingTodos(userId): Promise<Todo[]>`
  - `resolveTodo(userId, id, status: "done" | "dismissed"): Promise<void>`

- [ ] **Step 1: Implement**

```ts
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function upsertTodo(
  userId: string,
  t: { type: string; dedupeKey: string; title: string; body?: string; payload: Prisma.InputJsonValue },
): Promise<void> {
  await prisma.todo.upsert({
    where: { userId_dedupeKey: { userId, dedupeKey: t.dedupeKey } },
    create: {
      userId, type: t.type, dedupeKey: t.dedupeKey,
      title: t.title, body: t.body ?? null, payload: t.payload, status: "pending",
    },
    update: {
      // refresh content but keep it pending; do not resurrect resolved items
      title: t.title, body: t.body ?? null, payload: t.payload,
    },
  });
}

export function listPendingTodos(userId: string) {
  return prisma.todo.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export async function resolveTodo(userId: string, id: string, status: "done" | "dismissed") {
  await prisma.todo.updateMany({
    where: { id, userId },
    data: { status, resolvedAt: new Date() },
  });
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallai/knowledge/todos.ts
git commit -m "feat(knowledge): todo upsert/list/resolve helpers"
```

---

### Task 8: Bills orchestration (detect + match + missing + bootstrap)

**Files:**
- Create: `src/lib/wallai/knowledge/bills.ts`

**Interfaces:**
- Consumes: `selectRecurringCandidates`, `normalizeMerchant`, `getAnthropicClient`, `logApiUsage`, `upsertTodo`, `prisma`.
- Produces:
  - `detectAndProposeBills(userId): Promise<void>` — pre-filter → Haiku label → create `candidate` bills + `confirm_bill` todos.
  - `matchTransactionsToBills(userId, txs): Promise<void>` — update `active` bills' `lastSeenAt`/`expectedAmount`.
  - `checkMissingBills(userId, ref: Date): Promise<void>` — create `missing_bill` todos.
  - `bootstrapBillHints(userId): Promise<void>` — seed `add_bill_hint` todos when the user has no bills.

- [ ] **Step 1: Implement** (Haiku labeling call logs endpoint `detect-recurring-bills`)

```ts
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";
import { normalizeMerchant } from "./normalize";
import { selectRecurringCandidates } from "./bill-detect";
import { upsertTodo } from "./todos";

const MODEL = "claude-haiku-4-5-20251001";

export async function detectAndProposeBills(userId: string): Promise<void> {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    select: { date: true, description: true, amount: true },
    orderBy: { date: "asc" },
  });
  const candidates = selectRecurringCandidates(
    txs.map((t) => ({ date: t.date, description: t.description, amount: t.amount })),
  );
  if (candidates.length === 0) return;

  // Exclude merchantKeys already tracked (any status).
  const existing = await prisma.recurringBill.findMany({
    where: { userId }, select: { merchantKey: true },
  });
  const known = new Set(existing.map((b) => b.merchantKey).filter(Boolean) as string[]);
  const fresh = candidates.filter((c) => !known.has(c.merchantKey));
  if (fresh.length === 0) return;

  // Haiku labels the candidates.
  let labels: Record<string, { name: string; category: string; billType: string; expectedAmount?: number }> = {};
  try {
    const client = await getAnthropicClient(userId);
    const prompt = `Label these recurring expense merchants as bills. Return ONLY a JSON object keyed by merchantKey:
{"edp":{"name":"Energy (EDP)","category":"Bills & Utilities","billType":"energy","expectedAmount":61}}
billType one of "energy","water","gas","internet","rent","subscription","other". category from the user's finance categories (default "Bills & Utilities").
Merchants:\n${JSON.stringify(fresh)}`;
    const response = await client.messages.create({
      model: MODEL, max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    await logApiUsage({
      userId, endpoint: "detect-recurring-bills", model: MODEL,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    });
    const tb = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
    if (tb) {
      let raw = tb.text.trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) raw = fence[1].trim();
      labels = JSON.parse(raw);
    }
  } catch {
    // On AI failure, fall back to generic labels below.
  }

  for (const c of fresh) {
    const l = labels[c.merchantKey];
    const bill = await prisma.recurringBill.create({
      data: {
        userId,
        name: l?.name || c.displayName,
        category: l?.category || "Bills & Utilities",
        billType: l?.billType || "other",
        merchantKey: c.merchantKey,
        matchKeywords: [],
        cadence: "monthly",
        expectedAmount: l?.expectedAmount ?? c.avgAmount,
        status: "candidate",
        source: "auto_detected",
      },
    });
    await upsertTodo(userId, {
      type: "confirm_bill",
      dedupeKey: `confirm_bill:${bill.id}`,
      title: `Is "${bill.name}" a recurring bill? (~${bill.expectedAmount?.toFixed(0)}/mo)`,
      body: "Confirm to track it and get reminders when it's missing.",
      payload: { billId: bill.id },
    });
  }
}

export async function matchTransactionsToBills(
  userId: string,
  txs: { date: string | Date; description: string; amount: number }[],
): Promise<void> {
  const bills = await prisma.recurringBill.findMany({ where: { userId, status: "active" } });
  if (bills.length === 0) return;
  for (const tx of txs) {
    if (tx.amount >= 0) continue;
    const { merchantKey } = normalizeMerchant(tx.description);
    const bill = bills.find(
      (b) =>
        (b.merchantKey && b.merchantKey === merchantKey) ||
        b.matchKeywords.some((k) => tx.description.toUpperCase().includes(k.toUpperCase())),
    );
    if (!bill) continue;
    const d = new Date(tx.date);
    if (!bill.lastSeenAt || d > bill.lastSeenAt) {
      await prisma.recurringBill.update({
        where: { id: bill.id },
        data: { lastSeenAt: d, expectedAmount: Math.abs(tx.amount) },
      });
    }
  }
}

export async function checkMissingBills(userId: string, ref: Date): Promise<void> {
  const bills = await prisma.recurringBill.findMany({ where: { userId, status: "active", cadence: "monthly" } });
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1));
  for (const bill of bills) {
    const seenThisMonth = bill.lastSeenAt && bill.lastSeenAt >= monthStart;
    if (seenThisMonth) continue;
    const dueDay = bill.dayOfMonthHint ?? 28;
    if (ref.getUTCDate() < dueDay) continue; // not due yet
    await upsertTodo(userId, {
      type: "missing_bill",
      dedupeKey: `missing_bill:${bill.id}:${y}-${m}`,
      title: `${bill.name} not seen this month`,
      body: `Expected ~${bill.expectedAmount?.toFixed(0) ?? "?"}. Did you pay it?`,
      payload: { billId: bill.id, month: `${y}-${String(m + 1).padStart(2, "0")}` },
    });
  }
}

const HINTS = [
  { billType: "water", name: "Water" },
  { billType: "gas", name: "Gas" },
  { billType: "energy", name: "Energy" },
  { billType: "internet", name: "Internet / Phone" },
  { billType: "rent", name: "Rent" },
];

export async function bootstrapBillHints(userId: string): Promise<void> {
  const count = await prisma.recurringBill.count({ where: { userId } });
  if (count > 0) return;
  for (const h of HINTS) {
    await upsertTodo(userId, {
      type: "add_bill_hint",
      dedupeKey: `add_bill_hint:${h.billType}`,
      title: `Add your ${h.name.toLowerCase()} bill`,
      body: "Tell WallAI the amount so it can track it monthly.",
      payload: { billType: h.billType, name: h.name },
    });
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallai/knowledge/bills.ts
git commit -m "feat(knowledge): AI bill detection, matching, missing + bootstrap"
```

---

### Task 9: Learning hook on category correction

**Files:**
- Modify: `src/app/api/wallai/transactions/[id]/route.ts` (in `PATCH`, after update)

**Interfaces:**
- Consumes: `learnFromCorrection` (Task 4).

- [ ] **Step 1: Add the hook** — after `const updated = await prisma.transaction.update(...)`, when a category string was set, teach memory:

```ts
import { learnFromCorrection } from "@/lib/wallai/knowledge/matcher";
// ...
  const updated = await prisma.transaction.update({ where: { id }, data });
  if (typeof body?.category === "string" && body.category) {
    await learnFromCorrection(session.user.id, updated.description, body.category);
  }
  return NextResponse.json({ transaction: updated });
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallai/transactions/[id]/route.ts
git commit -m "feat(knowledge): learn merchant rule from category corrections"
```

---

### Task 10: Wire the statement-confirm flow

**Files:**
- Modify: `src/app/api/wallai/statements/confirm/route.ts` (after transactions are created)

**Interfaces:**
- Consumes: `matchCategory`, `learnFromCategorization`, `enrichUnknownMerchants`, `matchTransactionsToBills`, `detectAndProposeBills`, `checkMissingBills`, `bootstrapBillHints`, `upsertTodo`.

- [ ] **Step 1: After the transactions are inserted, load the newly-owned uncategorized txs and run the knowledge pipeline.** Add near the end of the handler, before the final JSON response. (Wrap in try/catch so a Haiku/key failure never breaks the import.)

```ts
import { matchCategory, learnFromCategorization } from "@/lib/wallai/knowledge/matcher";
import { enrichUnknownMerchants } from "@/lib/wallai/knowledge/categorize";
import {
  matchTransactionsToBills, detectAndProposeBills, checkMissingBills, bootstrapBillHints,
} from "@/lib/wallai/knowledge/bills";
import { upsertTodo } from "@/lib/wallai/knowledge/todos";
// ...
  try {
    const created = await prisma.transaction.findMany({
      where: { userId, statementId: statement.id },
      select: { id: true, description: true, amount: true, date: true },
    });

    // 1. memory match
    const { hits, misses } = await matchCategory(userId, created);
    for (const h of hits) {
      await prisma.transaction.update({ where: { id: h.txId }, data: { category: h.category } });
    }

    // 2. Haiku for unknowns
    let newMerchantCount = 0;
    if (misses.length > 0) {
      const enriched = await enrichUnknownMerchants(userId, misses);
      const byId = new Map(misses.map((m) => [m.id, m]));
      const learn: { description: string; category: string; displayName?: string }[] = [];
      for (const e of enriched) {
        await prisma.transaction.update({ where: { id: e.id }, data: { category: e.category } });
        const tx = byId.get(e.id);
        if (tx) learn.push({ description: tx.description, category: e.category, displayName: e.displayName });
      }
      await learnFromCategorization(userId, learn, "ai_guess");
      newMerchantCount = learn.length;
      if (newMerchantCount > 0) {
        await upsertTodo(userId, {
          type: "confirm_merchants",
          dedupeKey: `confirm_merchants:${statement.id}`,
          title: `Confirm categories for ${newMerchantCount} new merchant${newMerchantCount === 1 ? "" : "s"}`,
          body: "WallAI guessed these — tap to confirm or fix so it learns.",
          payload: { statementId: statement.id },
        });
      }
    }

    // 3. bills
    await matchTransactionsToBills(userId, created);
    await detectAndProposeBills(userId);
    await checkMissingBills(userId, new Date());
    await bootstrapBillHints(userId);
  } catch (err) {
    console.error("[confirm] knowledge pipeline error:", err);
    // Import still succeeds even if enrichment fails.
  }
```

Note: confirm the existing handler names its variables `userId` and `statement`; adapt if different.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallai/statements/confirm/route.ts
git commit -m "feat(knowledge): run knowledge pipeline on statement import"
```

---

### Task 11: Todos API routes

**Files:**
- Create: `src/app/api/wallai/todos/route.ts` (GET list)
- Create: `src/app/api/wallai/todos/[id]/resolve/route.ts` (POST resolve)

**Interfaces:**
- Consumes: `listPendingTodos`, `resolveTodo`, `learnFromCorrection`, `prisma`.
- Resolve actions by todo type:
  - `confirm_merchants`: `{ action: "confirm" }` → upgrade matched rules to `confirmed`; `{ action: "fix", updates: [{transactionId, category}] }` → PATCH each + `learnFromCorrection`.
  - `confirm_bill`: `{ action: "confirm", edits? }` → bill `active`; `{ action: "dismiss" }` → bill `dismissed`.
  - `add_bill_hint`: `{ action: "add", name, category, expectedAmount, billType }` → create `active` `user_added` bill.
  - `missing_bill`: `{ action: "dismiss" }`.

- [ ] **Step 1: Implement GET `todos/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPendingTodos } from "@/lib/wallai/knowledge/todos";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const todos = await listPendingTodos(session.user.id);
  return NextResponse.json({ todos });
}
```

- [ ] **Step 2: Implement POST `todos/[id]/resolve/route.ts`**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTodo } from "@/lib/wallai/knowledge/todos";
import { learnFromCorrection } from "@/lib/wallai/knowledge/matcher";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await context.params;
  const body = await request.json();

  const todo = await prisma.todo.findFirst({ where: { id, userId } });
  if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payload = (todo.payload ?? {}) as Record<string, unknown>;

  if (todo.type === "confirm_bill") {
    const billId = payload.billId as string | undefined;
    if (billId) {
      if (body.action === "dismiss") {
        await prisma.recurringBill.updateMany({ where: { id: billId, userId }, data: { status: "dismissed" } });
      } else {
        const edits = (body.edits ?? {}) as Record<string, unknown>;
        await prisma.recurringBill.updateMany({
          where: { id: billId, userId },
          data: {
            status: "active",
            ...(typeof edits.name === "string" ? { name: edits.name } : {}),
            ...(typeof edits.expectedAmount === "number" ? { expectedAmount: edits.expectedAmount } : {}),
            ...(typeof edits.dayOfMonthHint === "number" ? { dayOfMonthHint: edits.dayOfMonthHint } : {}),
          },
        });
      }
    }
    await resolveTodo(userId, id, "done");
    return NextResponse.json({ ok: true });
  }

  if (todo.type === "add_bill_hint") {
    if (body.action === "add") {
      await prisma.recurringBill.create({
        data: {
          userId,
          name: typeof body.name === "string" ? body.name : (payload.name as string) ?? "Bill",
          category: typeof body.category === "string" ? body.category : "Bills & Utilities",
          billType: typeof body.billType === "string" ? body.billType : (payload.billType as string) ?? "other",
          matchKeywords: Array.isArray(body.matchKeywords) ? body.matchKeywords : [],
          cadence: "monthly",
          expectedAmount: typeof body.expectedAmount === "number" ? body.expectedAmount : null,
          status: "active",
          source: "user_added",
        },
      });
    }
    await resolveTodo(userId, id, body.action === "add" ? "done" : "dismissed");
    return NextResponse.json({ ok: true });
  }

  if (todo.type === "confirm_merchants") {
    if (body.action === "fix" && Array.isArray(body.updates)) {
      for (const u of body.updates) {
        if (typeof u?.transactionId !== "string" || typeof u?.category !== "string") continue;
        const tx = await prisma.transaction.findFirst({ where: { id: u.transactionId, userId } });
        if (!tx) continue;
        await prisma.transaction.update({ where: { id: tx.id }, data: { category: u.category } });
        await learnFromCorrection(userId, tx.description, u.category);
      }
    } else if (body.action === "confirm") {
      // Upgrade ai_guess rules touched by this statement to "confirmed".
      const statementId = payload.statementId as string | undefined;
      if (statementId) {
        const txs = await prisma.transaction.findMany({
          where: { userId, statementId }, select: { description: true, category: true },
        });
        const seen = new Set<string>();
        for (const t of txs) {
          if (!t.category) continue;
          if (seen.has(t.description)) continue;
          seen.add(t.description);
          await learnFromCorrection(userId, t.description, t.category); // upgrades source
        }
      }
    }
    await resolveTodo(userId, id, "done");
    return NextResponse.json({ ok: true });
  }

  // missing_bill and any other -> just resolve/dismiss
  await resolveTodo(userId, id, body.action === "dismiss" ? "dismissed" : "done");
  return NextResponse.json({ ok: true });
}
```

Note: `confirm_merchants` "confirm" uses `learnFromCorrection` to bump `ai_guess` → `user_correction`. If you prefer a distinct `confirmed` tier, add a `confirmCategory` helper in matcher; `learnFromCorrection` is acceptable for v1.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/wallai/todos
git commit -m "feat(knowledge): todos list + resolve API"
```

---

### Task 12: Dashboard to-dos card + nav badge

**Files:**
- Create: `src/components/wallai/dashboard/todos-card.tsx` (client)
- Modify: `src/lib/wallai/dashboard-data.ts` (include pending todo count; run `checkMissingBills`)
- Modify: `src/app/(app)/dashboard/page.tsx` (render `TodosCard`)
- Modify: `src/components/wallai/nav-mobile.tsx`, `src/components/wallai/nav-sidebar.tsx` (badge)

**Interfaces:**
- Consumes: `GET /api/wallai/todos`, `POST /api/wallai/todos/[id]/resolve`.

- [ ] **Step 1: Add pending todos to dashboard data.** In `getDashboardData`, add a lazy missing-bill check + count:

```ts
import { checkMissingBills } from "@/lib/wallai/knowledge/bills";
import { listPendingTodos } from "@/lib/wallai/knowledge/todos";
// inside getDashboardData(userId), before returning:
  try { await checkMissingBills(userId, new Date()); } catch {}
  const pendingTodos = await listPendingTodos(userId);
// include in the returned object:
//   todoCount: pendingTodos.length,
//   todos: pendingTodos.slice(0, 5),
```
Add `todoCount` and `todos` to the returned type.

- [ ] **Step 2: Implement `todos-card.tsx`** (client component; lists todos, each with confirm/dismiss; mobile-first, tap targets ≥44px)

```tsx
"use client";

import { useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type Todo = { id: string; type: string; title: string; body: string | null };

export function TodosCard({ initial }: { initial: Todo[] }) {
  const [todos, setTodos] = useState(initial);
  if (todos.length === 0) return null;

  async function act(id: string, action: string) {
    await fetch(`/api/wallai/todos/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <GlassCard>
      <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">To-dos</h3>
      <ul className="flex flex-col gap-2">
        {todos.map((t) => (
          <li key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-medium text-white">{t.title}</p>
            {t.body ? <p className="mt-0.5 text-xs text-white/60">{t.body}</p> : null}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => act(t.id, "confirm")}
                className="min-h-[44px] flex-1 rounded-lg bg-emerald-500/90 px-3 text-sm font-semibold text-white active:brightness-95"
              >
                Confirm
              </button>
              <button
                onClick={() => act(t.id, "dismiss")}
                className="min-h-[44px] rounded-lg border border-white/10 px-3 text-sm text-white/70 active:bg-white/5"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
```
Note: v1 uses generic confirm/dismiss. `add_bill_hint`/`confirm_merchants` "fix" flows can be enhanced later; "confirm" already does the right server-side thing for bills and merchant confirmation, and `add_bill_hint` "confirm" resolves the hint (a dedicated amount-entry form is a future enhancement).

- [ ] **Step 3: Render on dashboard.** In `dashboard/page.tsx`, pass `data.todos` to `<TodosCard initial={data.todos} />` near the top of the grid.

- [ ] **Step 4: Nav badge.** In `nav-mobile.tsx` and `nav-sidebar.tsx`, fetch `/api/wallai/todos` (client) and show a count badge on the Dashboard item when > 0. Minimal:

```tsx
// inside the nav client component
const [todoCount, setTodoCount] = useState(0);
useEffect(() => {
  fetch("/api/wallai/todos").then((r) => r.json()).then((d) => setTodoCount(d.todos?.length ?? 0)).catch(() => {});
}, []);
// render next to Dashboard label when todoCount > 0:
// {todoCount > 0 && <span className="ml-auto rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">{todoCount}</span>}
```

- [ ] **Step 5: Verify build + mobile**

Run: `npm run build`
Then start the server and confirm the dashboard renders the card and badge at 375px width (no horizontal overflow).

- [ ] **Step 6: Commit**

```bash
git add src/components/wallai/dashboard/todos-card.tsx src/lib/wallai/dashboard-data.ts "src/app/(app)/dashboard/page.tsx" src/components/wallai/nav-mobile.tsx src/components/wallai/nav-sidebar.tsx
git commit -m "feat(knowledge): dashboard to-dos card + nav badge"
```

---

### Task 13: Usage API — per-category + multi-month

**Files:**
- Modify: `src/app/api/wallai/usage/route.ts`

**Interfaces:**
- Consumes: `endpointCategory` (Task 3), `prisma`.
- Produces (adds to existing response): `byCategory: {category;cost;calls}[]`, `monthlyTrend: {month;cost}[]` (last 6 months), `byModel: {model;cost;calls}[]`.

- [ ] **Step 1: Extend the route.** Keep existing `totalCost/totalCalls/dailyData`; add the three aggregates.

```ts
import { endpointCategory, USAGE_CATEGORY_ORDER } from "@/lib/wallai/ai-usage-categories";
// after building dailyData, before the response:

// by category (current month)
const catMap = new Map<string, { cost: number; calls: number }>();
for (const row of usageRows) {
  const c = endpointCategory(row.endpoint);
  const e = catMap.get(c) ?? { cost: 0, calls: 0 };
  e.cost += row.estimatedCost; e.calls += 1; catMap.set(c, e);
}
const byCategory = USAGE_CATEGORY_ORDER
  .filter((c) => catMap.has(c))
  .map((c) => ({ category: c, ...catMap.get(c)! }));

// by model (current month)
const modelMap = new Map<string, { cost: number; calls: number }>();
for (const row of usageRows) {
  const e = modelMap.get(row.model) ?? { cost: 0, calls: 0 };
  e.cost += row.estimatedCost; e.calls += 1; modelMap.set(row.model, e);
}
const byModel = Array.from(modelMap.entries()).map(([model, v]) => ({ model, ...v }));

// monthly trend (last 6 months)
const trendStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 5, 1));
const trendRows = await prisma.apiUsage.findMany({
  where: { userId: session.user.id, createdAt: { gte: trendStart } },
  select: { estimatedCost: true, createdAt: true },
});
const trendMap = new Map<string, number>();
for (let i = 5; i >= 0; i--) {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
  trendMap.set(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, 0);
}
for (const r of trendRows) {
  const key = `${r.createdAt.getUTCFullYear()}-${String(r.createdAt.getUTCMonth() + 1).padStart(2, "0")}`;
  if (trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + r.estimatedCost);
}
const monthlyTrend = Array.from(trendMap.entries()).map(([month, cost]) => ({ month, cost }));
```
Add `byCategory, byModel, monthlyTrend` to the returned JSON.

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wallai/usage/route.ts
git commit -m "feat(usage): per-category, per-model and 6-month trend aggregates"
```

---

### Task 14: AI Usage page + charts + nav

**Files:**
- Create: `src/app/(app)/usage/page.tsx` (server component shell)
- Create: `src/components/wallai/usage/usage-client.tsx` (client; fetches `/api/wallai/usage`)
- Create: `src/components/wallai/usage/usage-daily-chart.tsx` + `.impl.tsx` (lazy)
- Create: `src/components/wallai/usage/usage-trend-chart.tsx` + `.impl.tsx` (lazy)
- Create: `src/components/wallai/usage/usage-category-donut.tsx` + `.impl.tsx` (lazy)
- Modify: `nav-mobile.tsx`, `nav-sidebar.tsx`, `nav-icons.tsx` (add "AI Usage" nav item + icon)

**Interfaces:**
- Consumes: `GET /api/wallai/usage` (now returns `dailyData, byCategory, byModel, monthlyTrend, totalCost, totalCalls`).

- [ ] **Step 1: Page shell `usage/page.tsx`** (auth guard like other pages, render client)

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { UsageClient } from "@/components/wallai/usage/usage-client";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");
  return <UsageClient />;
}
```

- [ ] **Step 2: `usage-client.tsx`** — fetch, show total tiles, and the three charts (lazy). Follow the existing lazy-chart wrapper pattern (`*.impl.tsx` + `ChartSkeleton`) established in the perf work. Include: this-month total + call count, cost-per-day bar chart, 6-month trend line, category donut + table, model split stat. Mobile-first grid (`grid-cols-1 lg:grid-cols-2`).

- [ ] **Step 3: Chart components** — each chart is a `*.impl.tsx` (recharts) + a `next/dynamic({ ssr:false })` wrapper with `ChartSkeleton`, mirroring `net-worth-chart.tsx`.
  - `usage-daily-chart`: `BarChart` of `dailyData` (x=date, y=cost).
  - `usage-trend-chart`: `AreaChart`/`LineChart` of `monthlyTrend` (x=month, y=cost).
  - `usage-category-donut`: `PieChart` of `byCategory` (value=cost, label=category).

- [ ] **Step 4: Nav item.** Add an `AiUsageIcon` to `nav-icons.tsx` and a `{ icon: <AiUsageIcon />, label: "AI Usage", href: "/usage" }` entry to the `navItems` array in both `nav-mobile.tsx` and `nav-sidebar.tsx`.

- [ ] **Step 5: Verify build + mobile**

Run: `npm run build`
Then start the server, open `/usage`, confirm charts render lazily and the layout has no horizontal overflow at 375px.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/usage" src/components/wallai/usage src/components/wallai/nav-mobile.tsx src/components/wallai/nav-sidebar.tsx src/components/wallai/nav-icons.tsx
git commit -m "feat(usage): AI usage & cost page with lazy charts + nav"
```

---

### Task 15: Full verification pass

- [ ] **Step 1: Run all unit tests**

```bash
npx tsx src/lib/wallai/knowledge/normalize.test.ts
npx tsx src/lib/wallai/knowledge/matcher.test.ts
npx tsx src/lib/wallai/knowledge/bill-detect.test.ts
npx tsx src/lib/wallai/ai-usage-categories.test.ts
```
Expected: each prints `... PASSED`.

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: clean compile + type-check.

- [ ] **Step 3: Manual integration smoke** (server on a test port)
  - Import a statement → known merchants auto-apply, unknowns get a `confirm_merchants` todo.
  - Correct a category in the transaction list → re-import a similar statement → that merchant auto-applies with no AI call.
  - `/usage` shows a `Recurring-bill detection` category row after an import that detects bills.
  - Verify at 375px width: dashboard to-dos card, nav badge, `/usage` charts — no horizontal overflow.

- [ ] **Step 4: Deploy**

```bash
npm run build && pm2 restart wallai
```
Confirm `http://localhost:3003/usage` returns 200.
