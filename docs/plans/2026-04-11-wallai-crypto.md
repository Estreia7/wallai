# WallAI Crypto Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the WallAI Crypto module — holdings tracker with CoinGecko live pricing, unrealized P&L, a 30/90/365-day value chart, a nightly snapshot job, and dashboard integration that un-dims the existing "Crypto" stat card.

**Architecture:** Self-contained module mirroring the bank module. One `coingecko.ts` file is the only place that talks to the external API. Pure data helpers in `crypto-data.ts`. Server-rendered page loads holdings + snapshots from Prisma and live prices from CoinGecko (60s cache). Nightly snapshot job is a Next.js API route guarded by a shared-secret header, triggered by a system crontab entry. See `docs/superpowers/specs/2026-04-11-wallai-crypto-design.md` for the approved design.

**Tech Stack:** Next.js 15 (App Router), Prisma + PostgreSQL, NextAuth, Recharts, Tailwind, CoinGecko free API.

**Dependencies:** All three wallai plans (foundation, bank, dashboard) must already be shipped. An earlier foundation-era `CryptoHolding` stub model is replaced wholesale by Task 1.

---

## File Structure

**Created:**
```
src/lib/wallai/crypto/types.ts                                      # shared types
src/lib/wallai/crypto/coingecko.ts                                  # external API client
src/lib/wallai/crypto/popular-coins.ts                              # baked-in 8-chip constant
src/lib/wallai/crypto/crypto-data.ts                                # pure helpers + Prisma loaders
src/app/api/wallai/crypto/holdings/route.ts                         # GET/POST holdings
src/app/api/wallai/crypto/holdings/[id]/route.ts                    # PATCH/DELETE holdings
src/app/api/wallai/crypto/coins/search/route.ts                     # GET typeahead
src/app/api/wallai/crypto/snapshot/route.ts                         # POST nightly job
src/components/wallai/crypto/crypto-hero.tsx                        # total value + P&L
src/components/wallai/crypto/crypto-chart.tsx                       # 30/90/365-day trend
src/components/wallai/crypto/crypto-holdings-table.tsx              # per-coin rows + row menu
src/components/wallai/crypto/crypto-add-holding-modal.tsx           # popular chips + typeahead
src/components/wallai/crypto/crypto-empty-state.tsx                 # "no coins yet" card
```

**Modified:**
```
prisma/schema.prisma                                                # replace CryptoHolding, add CryptoSnapshot
.env                                                                # add WALLAI_SNAPSHOT_SECRET
.env.example                                                        # document WALLAI_SNAPSHOT_SECRET
src/lib/wallai/dashboard-data.ts                                    # compute crypto stats
src/app/wallai/dashboard/page.tsx                                   # un-hardcode Crypto StatCard
src/app/wallai/crypto/page.tsx                                      # replace 12-line stub
```

---

## Conventions to follow

Read these once before starting — every task assumes them:

1. **API routes** start with `const session = await auth();` then `if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });`. See `src/app/api/wallai/bank-accounts/route.ts` for the canonical shape.
2. **Dynamic route params** use `type RouteContext = { params: Promise<{ id: string }> };` and `const { id } = await context.params;` (Next 15 pattern).
3. **Ownership check** on PATCH/DELETE — fetch the row, confirm `existing.userId === session.user.id`, else return 404 (not 403, to avoid leaking existence).
4. **Server pages** (like dashboard) use `const session = await auth(); if (!session?.user?.id) redirect("/wallai");`.
5. **Money rendering** uses `new Intl.NumberFormat("en-IE", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)`. EUR everywhere.
6. **Glass cards** — use `<GlassCard>` from `@/components/wallai/glass-card`. Charts wrap themselves in a GlassCard with an h3 title.
7. **Modal** — reuse `@/components/wallai/modal` (`isOpen`, `onClose`, `title`, `size?: "md"|"lg"`).
8. **Color palette** — emerald `#10b981`, red `#ef4444`, cyan for crypto accents. Matches existing dashboard components.
9. **No tests** — bank and dashboard both shipped untested. Manual verification only. Do not add vitest.
10. **Commit after every task** (not every step). Use `feat:` for new functionality, `fix:` only for fixes to work already in the branch.

---

## Task 1: Replace CryptoHolding schema and migrate

**Files:**
- Modify: `prisma/schema.prisma:125-138`

- [ ] **Step 1: Open the current `CryptoHolding` model in the schema**

Read `prisma/schema.prisma` — you'll find this block around line 125 under the `// ── Crypto ──` header:

```prisma
model CryptoHolding {
  id          String   @id @default(cuid())
  userId      String
  coin        String
  quantity    Float
  buyPrice    Float
  buyCurrency String   @default("USD")
  dateAdded   DateTime @default(now())
  notes       String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

This is a foundation-era stub. There is no API, no UI, no production data consuming it. Replace it.

- [ ] **Step 2: Replace the CryptoHolding model and add CryptoSnapshot**

Replace the block above with:

```prisma
model CryptoHolding {
  id          String   @id @default(cuid())
  userId      String

  coinId      String   // CoinGecko id: "bitcoin", "ethereum"
  symbol      String   // "BTC" — denormalized for display
  name        String   // "Bitcoin" — denormalized for display

  quantity    Float
  avgCostEur  Float

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshots CryptoSnapshot[]

  @@unique([userId, coinId])
  @@index([userId])
}

model CryptoSnapshot {
  id        String   @id @default(cuid())
  holdingId String

  date      DateTime @db.Date
  quantity  Float
  priceEur  Float
  valueEur  Float

  createdAt DateTime @default(now())

  holding CryptoHolding @relation(fields: [holdingId], references: [id], onDelete: Cascade)

  @@unique([holdingId, date])
  @@index([holdingId, date])
}
```

Leave the `User.cryptoHoldings CryptoHolding[]` line in the `User` model alone — Prisma already has it (line ~28).

- [ ] **Step 3: Create the migration**

Run from the project root:

```bash
cd /var/www/playground
npx prisma migrate dev --name replace_crypto_holdings
```

Expected: Prisma prompts with "We need to reset the database" or generates a migration that includes `DROP TABLE "CryptoHolding"` and `CREATE TABLE`. Accept the prompt if it appears. The Prisma client is regenerated automatically.

If Prisma complains that reset would destroy data, confirm there are no rows: `npx prisma studio` → CryptoHolding should be empty in production use. If there's any seed data from an earlier plan, drop it with `DELETE FROM "CryptoHolding";` in psql first.

- [ ] **Step 4: Verify the migration applied**

```bash
cd /var/www/playground
npx prisma migrate status
```

Expected: `Database schema is up to date!`

Also inspect the generated SQL under `prisma/migrations/<timestamp>_replace_crypto_holdings/migration.sql` — it should DROP the old table and create the new `CryptoHolding` + `CryptoSnapshot` with the correct columns and constraints.

- [ ] **Step 5: Commit**

```bash
cd /var/www/playground
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: replace CryptoHolding schema with CoinGecko-aligned shape"
```

---

## Task 2: Environment variable + shared types file

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Create: `src/lib/wallai/crypto/types.ts`

- [ ] **Step 1: Generate a snapshot secret**

```bash
openssl rand -hex 32
```

Expected: a 64-character hex string. Copy it.

- [ ] **Step 2: Add it to `.env`**

Append to `/var/www/playground/.env`:

```
WALLAI_SNAPSHOT_SECRET=<paste the hex string from step 1>
```

- [ ] **Step 3: Document it in `.env.example`**

Append to `/var/www/playground/.env.example`:

```
# Shared secret for the nightly crypto snapshot cron hook
WALLAI_SNAPSHOT_SECRET=
```

- [ ] **Step 4: Create the types file**

Create `src/lib/wallai/crypto/types.ts`:

```ts
export type CoinSummary = {
  id: string;      // CoinGecko id, e.g. "bitcoin"
  symbol: string;  // "btc" / "BTC" — normalized to uppercase on write
  name: string;    // "Bitcoin"
};

export type HoldingDTO = {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  quantity: number;
  avgCostEur: number;
  createdAt: string;
  updatedAt: string;
};

export type HoldingWithLivePrice = HoldingDTO & {
  priceEur: number | null;    // null if CoinGecko failed for this coin
  valueEur: number;            // 0 if priceEur is null
  costBasisEur: number;        // quantity * avgCostEur
  pnlEur: number;              // valueEur - costBasisEur
  pnlPct: number | null;       // null if costBasis is 0
};

export type CryptoTotals = {
  totalValueEur: number;
  totalCostEur: number;
  totalPnlEur: number;
  totalPnlPct: number | null;  // null if totalCost is 0 or no holdings
  coinCount: number;
};

export type SnapshotPoint = {
  date: string;       // ISO date-only "YYYY-MM-DD"
  valueEur: number;   // summed across all of the user's holdings
};

export type PopularCoin = {
  id: string;
  symbol: string;
  name: string;
};
```

- [ ] **Step 5: Commit**

```bash
cd /var/www/playground
git add .env.example src/lib/wallai/crypto/types.ts
git commit -m "feat: crypto module env var and shared types"
```

> Note: `.env` is gitignored and will not be staged. That is correct. The generated secret lives only on the host.

---

## Task 3: CoinGecko client

**Files:**
- Create: `src/lib/wallai/crypto/coingecko.ts`

- [ ] **Step 1: Understand what the file exports**

Three public functions:
- `fetchPrices(coinIds: string[]): Promise<Map<string, number>>` — in-memory price cache, 60s TTL per coin, batched CoinGecko call.
- `searchCoins(query: string): Promise<CoinSummary[]>` — uses `coinList()` and filters by prefix.
- `coinList(): Promise<CoinSummary[]>` — cached on disk at `.cache/coingecko-coin-list.json`, 24h TTL, falls back to stale cache on network error.

Plus one internal helper exported for testing/manual verification:
- `parsePrices(json: unknown): Map<string, number>` — defensive parser for CoinGecko's `{ <id>: { eur: <num> } }` response shape.

- [ ] **Step 2: Create the file**

Create `src/lib/wallai/crypto/coingecko.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CoinSummary } from "./types";

const BASE_URL = "https://api.coingecko.com/api/v3";
const PRICE_TTL_MS = 60 * 1000;
const COIN_LIST_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IDS_PER_CALL = 250;
const COIN_LIST_CACHE_PATH = path.join(
  process.cwd(),
  ".cache",
  "coingecko-coin-list.json",
);

type PriceCacheEntry = { price: number; fetchedAt: number };
const priceCache = new Map<string, PriceCacheEntry>();

type CoinListCacheShape = { fetchedAt: number; coins: CoinSummary[] };
let coinListMemory: CoinListCacheShape | null = null;

/* ── parsePrices ─────────────────────────────────────────── */

export function parsePrices(json: unknown): Map<string, number> {
  const result = new Map<string, number>();
  if (!json || typeof json !== "object") return result;
  for (const [coinId, value] of Object.entries(json as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const eur = (value as Record<string, unknown>).eur;
    if (typeof eur === "number" && Number.isFinite(eur)) {
      result.set(coinId, eur);
    }
  }
  return result;
}

/* ── fetchPrices ─────────────────────────────────────────── */

export async function fetchPrices(
  coinIds: string[],
): Promise<Map<string, number>> {
  const now = Date.now();
  const fresh = new Map<string, number>();
  const stale: string[] = [];

  const uniqueIds = [...new Set(coinIds)];
  for (const id of uniqueIds) {
    const entry = priceCache.get(id);
    if (entry && now - entry.fetchedAt < PRICE_TTL_MS) {
      fresh.set(id, entry.price);
    } else {
      stale.push(id);
    }
  }

  if (stale.length === 0) return fresh;

  // Batch calls in case the user has more than MAX_IDS_PER_CALL coins (unlikely)
  for (let i = 0; i < stale.length; i += MAX_IDS_PER_CALL) {
    const batch = stale.slice(i, i + MAX_IDS_PER_CALL);
    try {
      const parsed = await fetchPriceBatch(batch);
      for (const [id, price] of parsed) {
        priceCache.set(id, { price, fetchedAt: now });
        fresh.set(id, price);
      }
    } catch (err) {
      console.error("[coingecko] fetchPrices batch failed", err);
      // Fall through — any id that was in the failed batch simply isn't in `fresh`.
      // Callers treat missing entries as "no live price".
    }
  }

  return fresh;
}

async function fetchPriceBatch(ids: string[]): Promise<Map<string, number>> {
  const url = new URL(`${BASE_URL}/simple/price`);
  url.searchParams.set("ids", ids.join(","));
  url.searchParams.set("vs_currencies", "eur");

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    throw new Error(`CoinGecko /simple/price returned ${res.status}`);
  }
  const json = await res.json();
  return parsePrices(json);
}

async function fetchWithRetry(url: string, attempt = 0): Promise<Response> {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (res.status === 429 && attempt === 0) {
    await new Promise((r) => setTimeout(r, 2000));
    return fetchWithRetry(url, attempt + 1);
  }
  return res;
}

/* ── coinList + searchCoins ──────────────────────────────── */

export async function coinList(): Promise<CoinSummary[]> {
  const now = Date.now();
  if (coinListMemory && now - coinListMemory.fetchedAt < COIN_LIST_TTL_MS) {
    return coinListMemory.coins;
  }

  // Try disk cache first
  const fromDisk = await readCoinListFromDisk();
  if (fromDisk && now - fromDisk.fetchedAt < COIN_LIST_TTL_MS) {
    coinListMemory = fromDisk;
    return fromDisk.coins;
  }

  // Fetch fresh
  try {
    const res = await fetchWithRetry(`${BASE_URL}/coins/list`);
    if (!res.ok) throw new Error(`CoinGecko /coins/list returned ${res.status}`);
    const raw = (await res.json()) as Array<{ id?: unknown; symbol?: unknown; name?: unknown }>;
    const coins: CoinSummary[] = [];
    for (const c of raw) {
      if (
        typeof c.id === "string" &&
        typeof c.symbol === "string" &&
        typeof c.name === "string"
      ) {
        coins.push({ id: c.id, symbol: c.symbol.toUpperCase(), name: c.name });
      }
    }
    const cacheShape: CoinListCacheShape = { fetchedAt: now, coins };
    coinListMemory = cacheShape;
    await writeCoinListToDisk(cacheShape);
    return coins;
  } catch (err) {
    console.error("[coingecko] coinList fetch failed", err);
    // Fall back to stale cache if we have one
    if (fromDisk) {
      coinListMemory = fromDisk;
      return fromDisk.coins;
    }
    return [];
  }
}

async function readCoinListFromDisk(): Promise<CoinListCacheShape | null> {
  try {
    const raw = await fs.readFile(COIN_LIST_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as CoinListCacheShape;
    if (
      typeof parsed.fetchedAt === "number" &&
      Array.isArray(parsed.coins)
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCoinListToDisk(cache: CoinListCacheShape): Promise<void> {
  try {
    await fs.mkdir(path.dirname(COIN_LIST_CACHE_PATH), { recursive: true });
    await fs.writeFile(COIN_LIST_CACHE_PATH, JSON.stringify(cache));
  } catch (err) {
    console.error("[coingecko] failed to write coin list cache", err);
  }
}

export async function searchCoins(query: string): Promise<CoinSummary[]> {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const all = await coinList();
  const starts: CoinSummary[] = [];
  const contains: CoinSummary[] = [];
  for (const c of all) {
    const sym = c.symbol.toLowerCase();
    const name = c.name.toLowerCase();
    if (sym === q || sym.startsWith(q) || name.startsWith(q)) {
      starts.push(c);
    } else if (sym.includes(q) || name.includes(q)) {
      contains.push(c);
    }
    if (starts.length >= 10) break;
  }
  return [...starts, ...contains].slice(0, 10);
}
```

- [ ] **Step 3: Add `.cache` to gitignore**

The module writes the CoinGecko coin list to `.cache/coingecko-coin-list.json`. Add this directory to `.gitignore` so it's never committed. Append to the end of `/var/www/playground/.gitignore`:

```
# CoinGecko coin list cache
.cache/
```

- [ ] **Step 4: Verify it type-checks**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors. (If there are errors, fix them in this file — do not continue.)

- [ ] **Step 5: Commit**

```bash
cd /var/www/playground
git add .gitignore src/lib/wallai/crypto/coingecko.ts
git commit -m "feat: CoinGecko client with in-memory + disk cache"
```

---

## Task 4: Popular coins constant

**Files:**
- Create: `src/lib/wallai/crypto/popular-coins.ts`

- [ ] **Step 1: Create the file**

```ts
import type { PopularCoin } from "./types";

export const POPULAR_COINS: PopularCoin[] = [
  { id: "bitcoin",       symbol: "BTC",   name: "Bitcoin" },
  { id: "ethereum",      symbol: "ETH",   name: "Ethereum" },
  { id: "solana",        symbol: "SOL",   name: "Solana" },
  { id: "ripple",        symbol: "XRP",   name: "XRP" },
  { id: "cardano",       symbol: "ADA",   name: "Cardano" },
  { id: "polkadot",      symbol: "DOT",   name: "Polkadot" },
  { id: "matic-network", symbol: "MATIC", name: "Polygon" },
  { id: "chainlink",     symbol: "LINK",  name: "Chainlink" },
];
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/lib/wallai/crypto/popular-coins.ts
git commit -m "feat: crypto popular coins quick-pick constant"
```

---

## Task 5: Pure data helpers and Prisma loaders

**Files:**
- Create: `src/lib/wallai/crypto/crypto-data.ts`

- [ ] **Step 1: Create the file**

```ts
import { prisma } from "@/lib/prisma";
import type {
  HoldingDTO,
  HoldingWithLivePrice,
  CryptoTotals,
  SnapshotPoint,
} from "./types";

/* ── Pure helpers ─────────────────────────────────────────── */

export function computeTotals(
  holdings: HoldingDTO[],
  priceMap: Map<string, number>,
): { totals: CryptoTotals; enriched: HoldingWithLivePrice[] } {
  let totalValueEur = 0;
  let totalCostEur = 0;

  const enriched: HoldingWithLivePrice[] = holdings.map((h) => {
    const priceEur = priceMap.get(h.coinId) ?? null;
    const valueEur = priceEur !== null ? h.quantity * priceEur : 0;
    const costBasisEur = h.quantity * h.avgCostEur;
    const pnlEur = valueEur - costBasisEur;
    const pnlPct = costBasisEur > 0 ? (pnlEur / costBasisEur) * 100 : null;
    totalValueEur += valueEur;
    totalCostEur += costBasisEur;
    return { ...h, priceEur, valueEur, costBasisEur, pnlEur, pnlPct };
  });

  const totalPnlEur = totalValueEur - totalCostEur;
  const totalPnlPct = totalCostEur > 0 ? (totalPnlEur / totalCostEur) * 100 : null;

  return {
    totals: {
      totalValueEur,
      totalCostEur,
      totalPnlEur,
      totalPnlPct,
      coinCount: holdings.length,
    },
    enriched,
  };
}

export function mergeHolding(
  existing: { quantity: number; avgCostEur: number },
  incoming: { quantity: number; avgCostEur: number },
): { quantity: number; avgCostEur: number } {
  const newQty = existing.quantity + incoming.quantity;
  if (newQty <= 0) {
    return { quantity: 0, avgCostEur: incoming.avgCostEur };
  }
  const newAvgCost =
    (existing.quantity * existing.avgCostEur +
      incoming.quantity * incoming.avgCostEur) /
    newQty;
  return { quantity: newQty, avgCostEur: newAvgCost };
}

/* ── Prisma loaders ───────────────────────────────────────── */

export async function loadHoldings(userId: string): Promise<HoldingDTO[]> {
  const rows = await prisma.cryptoHolding.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    coinId: r.coinId,
    symbol: r.symbol,
    name: r.name,
    quantity: r.quantity,
    avgCostEur: r.avgCostEur,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function loadSnapshots(
  userId: string,
  opts: { days: number },
): Promise<SnapshotPoint[]> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  since.setUTCDate(since.getUTCDate() - opts.days);

  const rows = await prisma.$queryRaw<Array<{ date: Date; total: number }>>`
    SELECT s."date" AS date, SUM(s."valueEur")::float AS total
    FROM "CryptoSnapshot" s
    JOIN "CryptoHolding" h ON h."id" = s."holdingId"
    WHERE h."userId" = ${userId}
      AND s."date" >= ${since}
    GROUP BY s."date"
    ORDER BY s."date" ASC
  `;

  return rows.map((r) => ({
    date: toIsoDate(r.date),
    valueEur: r.total,
  }));
}

function toIsoDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/lib/wallai/crypto/crypto-data.ts
git commit -m "feat: crypto pure helpers and Prisma loaders"
```

---

## Task 6: Holdings API — GET list / POST add-or-merge

**Files:**
- Create: `src/app/api/wallai/crypto/holdings/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { coinList } from "@/lib/wallai/crypto/coingecko";
import { mergeHolding } from "@/lib/wallai/crypto/crypto-data";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await prisma.cryptoHolding.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ holdings });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const coinId = typeof body?.coinId === "string" ? body.coinId.trim() : "";
  const quantity = typeof body?.quantity === "number" ? body.quantity : NaN;
  const avgCostEur = typeof body?.avgCostEur === "number" ? body.avgCostEur : NaN;

  if (!coinId) {
    return NextResponse.json({ error: "coinId is required" }, { status: 400 });
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return NextResponse.json({ error: "quantity must be a positive number" }, { status: 400 });
  }
  if (!Number.isFinite(avgCostEur) || avgCostEur < 0) {
    return NextResponse.json({ error: "avgCostEur must be a non-negative number" }, { status: 400 });
  }

  // Validate the coin exists in CoinGecko's universe
  const all = await coinList();
  const meta = all.find((c) => c.id === coinId);
  if (!meta) {
    return NextResponse.json({ error: "Unknown coinId" }, { status: 400 });
  }

  const existing = await prisma.cryptoHolding.findUnique({
    where: { userId_coinId: { userId: session.user.id, coinId } },
  });

  let holding;
  if (existing) {
    const merged = mergeHolding(
      { quantity: existing.quantity, avgCostEur: existing.avgCostEur },
      { quantity, avgCostEur },
    );
    holding = await prisma.cryptoHolding.update({
      where: { id: existing.id },
      data: {
        quantity: merged.quantity,
        avgCostEur: merged.avgCostEur,
        symbol: meta.symbol,
        name: meta.name,
      },
    });
  } else {
    holding = await prisma.cryptoHolding.create({
      data: {
        userId: session.user.id,
        coinId,
        symbol: meta.symbol,
        name: meta.name,
        quantity,
        avgCostEur,
      },
    });
  }

  return NextResponse.json({ holding }, { status: existing ? 200 : 201 });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/app/api/wallai/crypto/holdings/route.ts
git commit -m "feat: crypto holdings list and add-or-merge route"
```

---

## Task 7: Holdings API — PATCH edit / DELETE

**Files:**
- Create: `src/app/api/wallai/crypto/holdings/[id]/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  const existing = await prisma.cryptoHolding.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data: { quantity?: number; avgCostEur?: number } = {};
  if (typeof body?.quantity === "number" && Number.isFinite(body.quantity) && body.quantity > 0) {
    data.quantity = body.quantity;
  }
  if (
    typeof body?.avgCostEur === "number" &&
    Number.isFinite(body.avgCostEur) &&
    body.avgCostEur >= 0
  ) {
    data.avgCostEur = body.avgCostEur;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "Nothing to update (quantity and/or avgCostEur required)" },
      { status: 400 },
    );
  }

  const holding = await prisma.cryptoHolding.update({ where: { id }, data });
  return NextResponse.json({ holding });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const existing = await prisma.cryptoHolding.findUnique({ where: { id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.cryptoHolding.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/app/api/wallai/crypto/holdings/[id]/route.ts
git commit -m "feat: crypto holding edit and delete route"
```

---

## Task 8: Coin search route (typeahead)

**Files:**
- Create: `src/app/api/wallai/crypto/coins/search/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchCoins } from "@/lib/wallai/crypto/coingecko";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length === 0) {
    return NextResponse.json({ coins: [] });
  }

  const coins = await searchCoins(q);
  return NextResponse.json({ coins });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/app/api/wallai/crypto/coins/search/route.ts
git commit -m "feat: crypto coin typeahead search route"
```

---

## Task 9: Nightly snapshot route

**Files:**
- Create: `src/app/api/wallai/crypto/snapshot/route.ts`

- [ ] **Step 1: Create the file**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { coinList, fetchPrices } from "@/lib/wallai/crypto/coingecko";

export async function POST(request: Request) {
  const expected = process.env.WALLAI_SNAPSHOT_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "WALLAI_SNAPSHOT_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (request.headers.get("x-snapshot-secret") !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const holdings = await prisma.cryptoHolding.findMany({
    select: {
      id: true,
      coinId: true,
      symbol: true,
      name: true,
      quantity: true,
    },
  });

  if (holdings.length === 0) {
    return NextResponse.json({ snapshotted: 0, missingPrice: 0, renamed: 0 });
  }

  const uniqueCoinIds = [...new Set(holdings.map((h) => h.coinId))];
  const prices = await fetchPrices(uniqueCoinIds);
  const meta = await coinList();
  const metaByCoinId = new Map(meta.map((c) => [c.id, c]));

  let missingPrice = 0;
  let renamed = 0;

  // Snapshot upserts
  const snapshotOps = holdings.map((h) => {
    const priceEur = prices.get(h.coinId);
    if (priceEur == null) missingPrice++;
    const safePrice = priceEur ?? 0;
    const valueEur = h.quantity * safePrice;
    return prisma.cryptoSnapshot.upsert({
      where: { holdingId_date: { holdingId: h.id, date: today } },
      create: {
        holdingId: h.id,
        date: today,
        quantity: h.quantity,
        priceEur: safePrice,
        valueEur,
      },
      update: {
        quantity: h.quantity,
        priceEur: safePrice,
        valueEur,
      },
    });
  });

  // Denormalized symbol/name refresh
  const renameOps = holdings
    .map((h) => {
      const m = metaByCoinId.get(h.coinId);
      if (!m) return null;
      if (m.symbol === h.symbol && m.name === h.name) return null;
      renamed++;
      return prisma.cryptoHolding.update({
        where: { id: h.id },
        data: { symbol: m.symbol, name: m.name },
      });
    })
    .filter((op): op is NonNullable<typeof op> => op !== null);

  await prisma.$transaction([...snapshotOps, ...renameOps]);

  return NextResponse.json({
    snapshotted: holdings.length,
    missingPrice,
    renamed,
  });
}
```

- [ ] **Step 2: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd /var/www/playground
git add src/app/api/wallai/crypto/snapshot/route.ts
git commit -m "feat: crypto nightly snapshot route"
```

---

## Task 10: CryptoHero component

**Files:**
- Create: `src/components/wallai/crypto/crypto-hero.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";
import type { CryptoTotals } from "@/lib/wallai/crypto/types";

function formatCurrency(value: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function CryptoHero({ totals }: { totals: CryptoTotals }) {
  const hasCoins = totals.coinCount > 0;
  const pnlColor =
    totals.totalPnlEur > 0
      ? "text-emerald-400"
      : totals.totalPnlEur < 0
        ? "text-red-400"
        : "text-white/40";
  const pnlSign = totals.totalPnlEur >= 0 ? "+" : "";

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 pointer-events-none" />
      <div className="relative">
        <p className="text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
          Total Crypto Value
        </p>
        <p className="mt-1 text-2xl font-bold text-white sm:mt-2 sm:text-4xl">
          {formatCurrency(totals.totalValueEur)}
        </p>
        {hasCoins && totals.totalPnlPct !== null ? (
          <p className={`mt-1 text-xs font-medium sm:text-sm ${pnlColor}`}>
            {pnlSign}
            {formatCurrency(totals.totalPnlEur)}{" "}
            ({formatPct(totals.totalPnlPct)}) unrealized
          </p>
        ) : (
          <p className="mt-1 text-xs text-white/40 sm:text-sm">
            {hasCoins ? "—" : "No holdings yet"}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/crypto/crypto-hero.tsx
git commit -m "feat: crypto hero component with total value and P&L"
```

---

## Task 11: CryptoChart component (30/90/365 toggle)

**Files:**
- Create: `src/components/wallai/crypto/crypto-chart.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useId, useMemo, useState } from "react";
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
import type { SnapshotPoint } from "@/lib/wallai/crypto/types";

type Window = 30 | 90 | 365;

function formatTick(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat("en-IE", { month: "short", day: "numeric" }).format(dt);
}

function formatYTick(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${Math.round(v / 1000)}k`;
  return `${Math.round(v)}`;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: { date: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0A0E1A]/90 px-3 py-2 text-xs backdrop-blur-lg">
      <p className="text-white/50">{formatTick(p.payload.date)}</p>
      <p className="font-semibold text-white">
        {new Intl.NumberFormat("en-IE", {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 0,
        }).format(p.value)}
      </p>
    </div>
  );
}

export function CryptoChart({ snapshots }: { snapshots: SnapshotPoint[] }) {
  const gradientId = useId();
  const [win, setWin] = useState<Window>(30);

  const filtered = useMemo(() => {
    if (snapshots.length === 0) return [];
    const cutoff = new Date();
    cutoff.setUTCHours(0, 0, 0, 0);
    cutoff.setUTCDate(cutoff.getUTCDate() - win);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    return snapshots.filter((s) => s.date >= cutoffIso);
  }, [snapshots, win]);

  const hasEnough = filtered.length >= 2;

  return (
    <GlassCard className="relative overflow-hidden">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h3 className="text-xs font-semibold text-white/70 sm:text-sm">
          Portfolio Value
        </h3>
        <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-0.5">
          {[30, 90, 365].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setWin(n as Window)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors sm:text-xs ${
                win === n
                  ? "bg-white/15 text-white"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      {hasEnough ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={filtered.map((p) => ({ ...p, label: formatTick(p.date) }))}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
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
              tickFormatter={formatYTick}
              width={45}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="valueEur"
              stroke="#06b6d4"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[220px] items-center justify-center">
          <p className="text-center text-xs text-white/40 sm:text-sm">
            Not enough history yet — the nightly job fills this in over time.
          </p>
        </div>
      )}
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/crypto/crypto-chart.tsx
git commit -m "feat: crypto portfolio chart with 30/90/365 window"
```

---

## Task 12: CryptoHoldingsTable component (with row menu)

**Files:**
- Create: `src/components/wallai/crypto/crypto-holdings-table.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/wallai/glass-card";
import { Modal } from "@/components/wallai/modal";
import type { HoldingWithLivePrice } from "@/lib/wallai/crypto/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQty(q: number): string {
  if (q === 0) return "0";
  const abs = Math.abs(q);
  const digits = abs >= 1 ? 4 : 8;
  return q.toFixed(digits).replace(/\.?0+$/, "");
}

function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function CryptoHoldingsTable({
  holdings,
}: {
  holdings: HoldingWithLivePrice[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<HoldingWithLivePrice | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editAvgCost, setEditAvgCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(h: HoldingWithLivePrice) {
    setEditing(h);
    setEditQuantity(String(h.quantity));
    setEditAvgCost(String(h.avgCostEur));
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const quantity = Number(editQuantity);
    const avgCostEur = Number(editAvgCost);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    if (!Number.isFinite(avgCostEur) || avgCostEur < 0) {
      setError("Average cost must be 0 or a positive number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallai/crypto/holdings/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity, avgCostEur }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteHolding(h: HoldingWithLivePrice) {
    if (!confirm(`Delete ${h.symbol}? This cannot be undone.`)) return;
    const res = await fetch(`/api/wallai/crypto/holdings/${h.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
          Holdings
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/40">
                <th className="pb-2 font-medium">Coin</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">Avg cost</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Value</th>
                <th className="pb-2 font-medium">P&amp;L</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const pnlColor =
                  h.pnlEur > 0
                    ? "text-emerald-400"
                    : h.pnlEur < 0
                      ? "text-red-400"
                      : "text-white/40";
                return (
                  <tr key={h.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5">
                      <div className="font-semibold text-white">{h.symbol}</div>
                      <div className="text-[10px] text-white/40 sm:text-xs">{h.name}</div>
                    </td>
                    <td className="py-2.5 text-white/80">{formatQty(h.quantity)}</td>
                    <td className="py-2.5 text-white/80">{formatCurrency(h.avgCostEur)}</td>
                    <td className="py-2.5 text-white/80">
                      {h.priceEur !== null ? formatCurrency(h.priceEur) : <span className="text-amber-400">—</span>}
                    </td>
                    <td className="py-2.5 text-white">{formatCurrency(h.valueEur)}</td>
                    <td className={`py-2.5 ${pnlColor}`}>
                      {h.pnlEur >= 0 ? "+" : ""}
                      {formatCurrency(h.pnlEur)}
                      <div className="text-[10px] sm:text-xs">{formatPct(h.pnlPct)}</div>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => openEdit(h)}
                        className="rounded-md px-2 py-1 text-[10px] text-white/60 hover:bg-white/10 hover:text-white sm:text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteHolding(h)}
                        className="ml-1 rounded-md px-2 py-1 text-[10px] text-white/60 hover:bg-red-500/10 hover:text-red-400 sm:text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.symbol}` : "Edit"}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Quantity</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Avg cost (€ per unit)</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={editAvgCost}
              onChange={(e) => setEditAvgCost(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveEdit}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/crypto/crypto-holdings-table.tsx
git commit -m "feat: crypto holdings table with inline edit and delete"
```

---

## Task 13: Add Holding modal (popular chips + typeahead)

**Files:**
- Create: `src/components/wallai/crypto/crypto-add-holding-modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/wallai/modal";
import { POPULAR_COINS } from "@/lib/wallai/crypto/popular-coins";
import type { CoinSummary } from "@/lib/wallai/crypto/types";

type Step = "pick" | "form";

export function CryptoAddHoldingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoinSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CoinSummary | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("pick");
    setQuery("");
    setResults([]);
    setPicked(null);
    setQuantity("");
    setAvgCost("");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/wallai/crypto/coins/search?q=${encodeURIComponent(query)}`,
        );
        const data = await res.json();
        if (active) setResults(data.coins ?? []);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  function pick(coin: CoinSummary) {
    setPicked(coin);
    setStep("form");
    setError(null);
  }

  async function save() {
    if (!picked) return;
    const qtyNum = Number(quantity);
    const costNum = Number(avgCost);
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    if (!Number.isFinite(costNum) || costNum < 0) {
      setError("Average cost must be 0 or a positive number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wallai/crypto/holdings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coinId: picked.id,
          quantity: qtyNum,
          avgCostEur: costNum,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save");
        return;
      }
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-emerald-400"
      >
        + Add holding
      </button>

      <Modal
        isOpen={open}
        onClose={close}
        title={step === "pick" ? "Add holding" : `Add ${picked?.symbol}`}
      >
        {step === "pick" ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
                Popular
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_COINS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick({ id: c.id, symbol: c.symbol, name: c.name })}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/40 sm:text-xs">
                Search any coin
              </p>
              <input
                type="text"
                placeholder="e.g. doge, monero…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              />
              {searching && (
                <p className="mt-2 text-xs text-white/40">Searching…</p>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="mt-2 text-xs text-white/40">No matches</p>
              )}
              {results.length > 0 && (
                <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-white/10">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                      >
                        <span className="font-semibold text-white">{c.symbol}</span>
                        <span className="text-xs text-white/50">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span className="font-semibold text-white">{picked?.symbol}</span>
              <span className="ml-2 text-white/50">{picked?.name}</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Quantity</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 0.25"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Avg cost (€ per unit)</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="e.g. 42500"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/crypto/crypto-add-holding-modal.tsx
git commit -m "feat: crypto add-holding modal with popular chips and typeahead"
```

---

## Task 14: Empty state component

**Files:**
- Create: `src/components/wallai/crypto/crypto-empty-state.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { GlassCard } from "@/components/wallai/glass-card";

export function CryptoEmptyState() {
  return (
    <GlassCard className="text-center">
      <p className="text-base font-semibold text-white sm:text-lg">
        No crypto holdings yet
      </p>
      <p className="mt-2 text-xs text-white/50 sm:text-sm">
        Add your first coin to start tracking live value and unrealized P&amp;L.
        Use a popular shortcut or search any CoinGecko-listed coin.
      </p>
    </GlassCard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/playground
git add src/components/wallai/crypto/crypto-empty-state.tsx
git commit -m "feat: crypto empty state card"
```

---

## Task 15: Crypto page (server component, orchestrates everything)

**Files:**
- Modify: `src/app/wallai/crypto/page.tsx` (fully replaces the 12-line stub)

- [ ] **Step 1: Read the current stub** for reference

```bash
cat /var/www/playground/src/app/wallai/crypto/page.tsx
```

Expected: a 12-line placeholder component. Discard it.

- [ ] **Step 2: Replace the file**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import {
  loadHoldings,
  loadSnapshots,
  computeTotals,
} from "@/lib/wallai/crypto/crypto-data";
import { fetchPrices } from "@/lib/wallai/crypto/coingecko";
import { CryptoHero } from "@/components/wallai/crypto/crypto-hero";
import { CryptoChart } from "@/components/wallai/crypto/crypto-chart";
import { CryptoHoldingsTable } from "@/components/wallai/crypto/crypto-holdings-table";
import { CryptoAddHoldingButton } from "@/components/wallai/crypto/crypto-add-holding-modal";
import { CryptoEmptyState } from "@/components/wallai/crypto/crypto-empty-state";

export const dynamic = "force-dynamic";

export default async function CryptoPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/wallai");
  }
  const userId = session.user.id;

  const holdings = await loadHoldings(userId);

  let priceMap = new Map<string, number>();
  let priceError = false;
  if (holdings.length > 0) {
    try {
      priceMap = await fetchPrices(holdings.map((h) => h.coinId));
      priceError = priceMap.size === 0;
    } catch (err) {
      console.error("[wallai/crypto] fetchPrices failed", err);
      priceError = true;
    }
  }

  const snapshots = await loadSnapshots(userId, { days: 365 });

  // Fallback: if live prices are unavailable but we have snapshots, reconstruct
  // a best-effort price map from the most recent snapshot per holding so the
  // page still renders something useful.
  if (priceError && holdings.length > 0) {
    priceMap = await fallbackPriceMapFromSnapshots(userId, holdings.map((h) => h.coinId));
  }

  const { totals, enriched } = computeTotals(holdings, priceMap);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Crypto</h2>
        {holdings.length > 0 && <CryptoAddHoldingButton />}
      </div>

      {priceError && (
        <GlassCard className="mb-4 border-amber-500/30 bg-amber-500/5">
          <p className="text-xs text-amber-300 sm:text-sm">
            ⚠ Live prices unavailable — showing last known values from the most recent snapshot.
          </p>
        </GlassCard>
      )}

      {holdings.length === 0 ? (
        <>
          <div className="mb-4">
            <CryptoAddHoldingButton />
          </div>
          <CryptoEmptyState />
        </>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <CryptoHero totals={totals} />
          <CryptoChart snapshots={snapshots} />
          <CryptoHoldingsTable holdings={enriched} />
        </div>
      )}
    </div>
  );
}

async function fallbackPriceMapFromSnapshots(
  userId: string,
  coinIds: string[],
): Promise<Map<string, number>> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRaw<
    Array<{ coinId: string; priceEur: number }>
  >`
    SELECT h."coinId" AS "coinId", s."priceEur"
    FROM "CryptoHolding" h
    JOIN "CryptoSnapshot" s ON s."holdingId" = h."id"
    WHERE h."userId" = ${userId}
      AND h."coinId" = ANY(${coinIds}::text[])
      AND s."date" = (
        SELECT MAX(s2."date")
        FROM "CryptoSnapshot" s2
        WHERE s2."holdingId" = h."id"
      )
  `;
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.coinId, row.priceEur);
  }
  return map;
}
```

- [ ] **Step 3: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /var/www/playground
git add src/app/wallai/crypto/page.tsx
git commit -m "feat: crypto page with hero, chart, table, and price fallback"
```

---

## Task 16: Dashboard integration — compute and render crypto stats

**Files:**
- Modify: `src/lib/wallai/dashboard-data.ts`
- Modify: `src/app/wallai/dashboard/page.tsx:122-127` (the hardcoded Crypto `<StatCard>`)

- [ ] **Step 1: Update the `DashboardData` type in `dashboard-data.ts`**

Find the `stats` field near line 18. Replace the `crypto` sub-type:

```ts
// before:
crypto: { value: 0; configured: false };

// after:
crypto: {
  value: number;
  pnlEur: number;
  pnlPct: number | null;
  coinCount: number;
  configured: boolean;
};
```

- [ ] **Step 2: Import the crypto helpers at the top of `dashboard-data.ts`**

Add to the imports block at the top:

```ts
import { loadHoldings, computeTotals } from "@/lib/wallai/crypto/crypto-data";
import { fetchPrices } from "@/lib/wallai/crypto/coingecko";
```

- [ ] **Step 3: Load crypto data inside `getDashboardData`**

In the `Promise.all` block at line ~65-124, add a new entry for crypto holdings. Then *after* the `Promise.all` destructuring, fetch live prices and compute totals. Locate the `/* ── Balances by account type ─────── */` comment and insert the crypto block just above it:

```ts
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
```

- [ ] **Step 4: Fold crypto value into net worth and add the stats entry**

Find the `netWorthTotal` assignment (`const netWorthTotal = cashValue + creditSigned;`) and change it to:

```ts
const netWorthTotal = cashValue + creditSigned + cryptoTotals.totalValueEur;
```

Then in the final `return` object's `stats` field, replace the `crypto: { value: 0, configured: false }` line with:

```ts
crypto: {
  value: cryptoTotals.totalValueEur,
  pnlEur: cryptoTotals.totalPnlEur,
  pnlPct: cryptoTotals.totalPnlPct,
  coinCount: cryptoTotals.coinCount,
  configured: cryptoTotals.coinCount > 0,
},
```

- [ ] **Step 5: Include crypto in the allocation donut**

Find the `allocation:` line in the returned object:

```ts
allocation: [{ name: "Cash", value: Math.max(cashValue, 0), color: "#10b981" }],
```

Replace with:

```ts
allocation: [
  { name: "Cash", value: Math.max(cashValue, 0), color: "#10b981" },
  ...(cryptoTotals.coinCount > 0
    ? [{ name: "Crypto", value: Math.max(cryptoTotals.totalValueEur, 0), color: "#06b6d4" }]
    : []),
],
```

- [ ] **Step 6: Un-hardcode the Crypto StatCard on the dashboard page**

Open `src/app/wallai/dashboard/page.tsx`. Find the block around line 122-127:

```tsx
<StatCard
  label="Crypto"
  value={formatCurrency(0, data.netWorth.currency)}
  gradient="from-cyan-500/20 to-cyan-500/5"
  configured={false}
/>
```

Replace with:

```tsx
<StatCard
  label="Crypto"
  value={formatCurrency(data.stats.crypto.value, data.netWorth.currency)}
  subtext={
    data.stats.crypto.configured
      ? formatCryptoSubtext(
          data.stats.crypto.pnlEur,
          data.stats.crypto.pnlPct,
          data.netWorth.currency,
        )
      : null
  }
  gradient="from-cyan-500/20 to-cyan-500/5"
  configured={data.stats.crypto.configured}
/>
```

Add the `formatCryptoSubtext` helper just below the existing `formatCurrency` function at the top of `dashboard/page.tsx`:

```ts
function formatCryptoSubtext(
  pnlEur: number,
  pnlPct: number | null,
  currency: string,
): string {
  const sign = pnlEur >= 0 ? "+" : "";
  const amt = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(pnlEur);
  const pct = pnlPct !== null ? ` (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)` : "";
  return `${sign}${amt}${pct}`;
}
```

- [ ] **Step 7: Type-check**

```bash
cd /var/www/playground
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /var/www/playground
git add src/lib/wallai/dashboard-data.ts src/app/wallai/dashboard/page.tsx
git commit -m "feat: wire crypto totals into dashboard stats and allocation"
```

---

## Task 17: Install the nightly cron entry

**Files:** (host configuration — no repo files modified)

- [ ] **Step 1: Ensure the app is running under PM2**

```bash
pm2 list
```

Expected: `playground` process is `online`. If not, `pm2 start` it first per normal deploy procedure.

- [ ] **Step 2: Confirm the snapshot route is reachable**

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST https://playground.bruno-dev.xyz/api/wallai/crypto/snapshot
```

Expected: `401` (no secret header).

- [ ] **Step 3: Do a manual first run to seed snapshots**

```bash
SECRET=$(grep '^WALLAI_SNAPSHOT_SECRET=' /var/www/playground/.env | cut -d= -f2)
curl -s -X POST \
  -H "x-snapshot-secret: $SECRET" \
  https://playground.bruno-dev.xyz/api/wallai/crypto/snapshot
```

Expected: `{"snapshotted":N,"missingPrice":0,"renamed":0}` where N is the number of current holdings (0 if you haven't added any yet — that's fine).

- [ ] **Step 4: Install the crontab entry**

```bash
(crontab -l 2>/dev/null; echo '5 0 * * * SECRET=$(grep "^WALLAI_SNAPSHOT_SECRET=" /var/www/playground/.env | cut -d= -f2); curl -fsS -X POST -H "x-snapshot-secret: $SECRET" https://playground.bruno-dev.xyz/api/wallai/crypto/snapshot >> /var/log/wallai-snapshot.log 2>&1') | crontab -
```

- [ ] **Step 5: Verify the cron entry**

```bash
crontab -l | grep wallai-snapshot
```

Expected: the line from step 4 prints back.

- [ ] **Step 6: Pre-create the log file**

```bash
touch /var/log/wallai-snapshot.log
chmod 644 /var/log/wallai-snapshot.log
```

---

## Task 18: Deploy and verify

**Files:** (none — verification only)

- [ ] **Step 1: Restart PM2**

```bash
pm2 restart playground --update-env
```

Expected: `playground` process is `online`.

- [ ] **Step 2: Confirm the crypto page responds**

```bash
curl -sk -o /dev/null -w "%{http_code}\n" https://playground.bruno-dev.xyz/wallai/crypto
```

Expected: `200` or a redirect to `/wallai` login — both are acceptable.

- [ ] **Step 3: Manual browser verification**

Open `https://playground.bruno-dev.xyz/wallai/crypto` and log in as `admin@wallai.app` / `1234`.

Verify each flow:

1. **Empty state** — with no holdings, the page shows "No crypto holdings yet" plus an "Add holding" button. Hero / chart / table are hidden.
2. **Popular chip add** — click "Add holding" → click the BTC chip → enter quantity 0.1 and avg cost 40000 → Save. Modal closes, page refreshes, the Crypto Hero shows a non-zero total and a P&L delta, a Holdings table row appears for BTC.
3. **Typeahead add (off-chip coin)** — click "Add holding" → type "doge" → pick Dogecoin → enter quantity 1000 and avg cost 0.15 → Save. Row appears alongside BTC.
4. **Merge on re-add** — click "Add holding" → BTC chip again → enter quantity 0.1 and avg cost 60000 → Save. The existing BTC row's quantity should now be 0.2 and the avg cost should be €50,000 (weighted average of the two adds). Verify the P&L updates accordingly.
5. **Edit** — click Edit on the BTC row → change quantity to 0.15 → Save. Row updates without re-merging.
6. **Delete** — click Delete on the DOGE row → confirm. Row disappears.
7. **Dashboard card** — open `/wallai/dashboard`. The Crypto stat card is no longer dimmed. It shows the current crypto total and a P&L subtext like `+€320 (+2.6%)`. The allocation donut shows both Cash and Crypto slices.

- [ ] **Step 4: Re-run the snapshot job and verify idempotency**

```bash
SECRET=$(grep '^WALLAI_SNAPSHOT_SECRET=' /var/www/playground/.env | cut -d= -f2)
curl -s -X POST -H "x-snapshot-secret: $SECRET" https://playground.bruno-dev.xyz/api/wallai/crypto/snapshot
curl -s -X POST -H "x-snapshot-secret: $SECRET" https://playground.bruno-dev.xyz/api/wallai/crypto/snapshot
```

Expected: both calls return `{"snapshotted":N,...}` with the same N. No duplicate rows. Verify in psql or Prisma Studio:

```sql
SELECT "holdingId", "date", COUNT(*) FROM "CryptoSnapshot" GROUP BY 1,2 HAVING COUNT(*) > 1;
```

Expected: zero rows.

- [ ] **Step 5: Test the live-price fallback banner**

Temporarily break CoinGecko by editing `src/lib/wallai/crypto/coingecko.ts` and changing `BASE_URL` to an unreachable host (e.g. `https://api.coingecko-invalid.test/api/v3`). Restart PM2. Reload `/wallai/crypto`.

Expected: the amber warning banner shows *"Live prices unavailable — showing last known values from the most recent snapshot."* The page still renders with snapshot-derived prices.

Revert the BASE_URL, restart PM2, reload — verify the banner disappears.

- [ ] **Step 6: Check pm2 logs for runtime errors**

```bash
pm2 logs playground --lines 80 --nostream
```

Expected: no stack traces related to `/wallai/crypto` or `/api/wallai/crypto`. Any CoinGecko console.errors from step 5 should have been cleared on revert.

- [ ] **Step 7: If any issues surfaced, fix and commit**

```bash
cd /var/www/playground
git add -A
git commit -m "fix: adjustments from crypto deploy verification"
```

- [ ] **Step 8: Final sanity commit if needed**

If everything passes, no commit is needed — the feature is done.

---

## Post-task summary

After all tasks complete:

- The `/wallai/crypto` page is a full module with hero, 30/90/365-day chart, holdings table, and empty state.
- Adding a coin that already exists merges with a weighted-average cost basis.
- The dashboard Crypto stat card is live, fed by real holdings data, and the allocation donut reflects crypto alongside cash.
- A nightly snapshot job runs at 00:05 UTC via system crontab, is idempotent under re-runs, and refreshes denormalized symbol/name.
- Live prices come from CoinGecko's free API with 60s in-memory caching and a 24h on-disk cache for the full coin list. If CoinGecko is down, the page falls back to the most recent snapshot per holding and shows a warning banner.
- No new dependencies, no test infrastructure added, consistent with the bank and dashboard modules.
