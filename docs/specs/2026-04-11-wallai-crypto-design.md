# WallAI Crypto Module — Design

**Date:** 2026-04-11
**Status:** Design approved, ready for implementation plan
**Depends on:** wallai-foundation, wallai-bank, wallai-dashboard (all shipped)

## Goal

Light up the dimmed "Crypto" stat card on the WallAI dashboard by giving users a place to track crypto holdings with live pricing from CoinGecko. Holdings are stored with an average cost per unit, enabling unrealized P&L without a full trade ledger. A nightly snapshot job records per-coin value so we can draw a value-over-time chart on the crypto page and (eventually) fold crypto into the dashboard's net-worth trend.

## Scoping decisions (from brainstorm)

| Decision | Choice |
|---|---|
| History depth | Current holdings + manually-entered avg cost. No full trade ledger. |
| Price source | CoinGecko free tier (no API key) |
| Value history | Daily snapshots via cron |
| Coin entry UX | Typeahead search + 8 popular-coin shortcut chips |
| Dashboard card | Total value + unrealized P&L (€ + %) |
| Page layout | Hero + 30-day chart + holdings table (matches dashboard rhythm) |
| Snapshot execution | Next.js API route guarded by a shared-secret header, triggered by system crontab |
| Currency | EUR only (consistent with rest of wallai) |

## Architecture

Self-contained module mirroring the bank module's shape. Boundaries:

- `src/lib/wallai/crypto/coingecko.ts` is the **only** place that talks to CoinGecko.
- `src/lib/wallai/crypto/crypto-data.ts` is pure: takes Prisma rows and a price map, returns display-ready totals. No fetching.
- The snapshot job and the page use the same `coingecko.fetchPrices()` — one code path for pricing.
- Dashboard integration is one file: `dashboard-data.ts` gains a `crypto` block alongside `cash`; the existing stat card consumes it.

### File structure

```
src/app/wallai/crypto/page.tsx                     # server component, auth-gated
src/app/api/wallai/crypto/
  holdings/route.ts                                # GET list / POST add-or-merge
  holdings/[id]/route.ts                           # PATCH edit / DELETE remove
  coins/search/route.ts                            # GET ?q=bit — typeahead over cached coin list
  snapshot/route.ts                                # POST (shared-secret) — nightly job endpoint
src/components/wallai/crypto/
  crypto-hero.tsx                                  # big total + P&L (server)
  crypto-chart.tsx                                 # 30/90/365-day value trend (client, Recharts)
  crypto-holdings-table.tsx                        # per-coin rows with live price + delta
  crypto-add-holding-modal.tsx                     # popular chips + typeahead + qty/avg-cost inputs
  crypto-empty-state.tsx                           # "No coins yet" card
src/lib/wallai/crypto/
  coingecko.ts                                     # fetchPrices, searchCoins, coinList
  crypto-data.ts                                   # loadHoldings, loadSnapshots, computeTotals, mergeHolding
  types.ts                                         # Holding, Snapshot, CoinSummary, PopularCoin
  popular-coins.ts                                 # baked-in 8-chip constant (BTC/ETH/SOL/XRP/ADA/DOT/MATIC/LINK)
```

Dashboard integration touches only `src/lib/wallai/dashboard-data.ts` and the existing crypto stat card component (removes the dimmed/"Not configured" branch).

## Data model

An earlier foundation-era stub of `CryptoHolding` exists (`coin`, `quantity`, `buyPrice`, `buyCurrency`, `dateAdded`, `notes`) with no API routes or UI consuming it. **It is replaced wholesale** — the migration drops the old table and creates the new one. The whole wallai schema uses `Float` for money, so crypto follows suit (no `Decimal`).

```prisma
model CryptoHolding {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  coinId      String   // CoinGecko id: "bitcoin", "ethereum"
  symbol      String   // "BTC", "ETH" — denormalized for display
  name        String   // "Bitcoin" — denormalized for display

  quantity    Float    // same convention as BankAccount.currentBalance
  avgCostEur  Float    // per-unit avg cost in EUR

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  snapshots   CryptoSnapshot[]

  @@unique([userId, coinId])   // one row per user per coin
  @@index([userId])
}

model CryptoSnapshot {
  id          String   @id @default(cuid())
  holdingId   String
  holding     CryptoHolding @relation(fields: [holdingId], references: [id], onDelete: Cascade)

  date        DateTime @db.Date
  quantity    Float
  priceEur    Float
  valueEur    Float   // precomputed quantity × priceEur

  createdAt   DateTime @default(now())

  @@unique([holdingId, date])  // idempotent re-runs
  @@index([holdingId, date])
}
```

**Model rationale:**

- `@@unique([userId, coinId])` enforces the "no ledger" decision — adding a coin you already own is a merge, not a new row.
- `Float` everywhere for quantity and money matches the existing wallai schema convention. Double precision handles realistic crypto magnitudes — a billion DOGE × €1 fits in 2^53 exactly — and we're not a trading exchange.
- `symbol`/`name` denormalized so table renders never need a CoinGecko call. The nightly job refreshes them in case CoinGecko renames a coin.
- `CryptoSnapshot.date` is `@db.Date` (not timestamp) so `@@unique([holdingId, date])` makes the upsert trivially idempotent.
- `valueEur` stored pre-multiplied because chart queries `SUM(valueEur) GROUP BY date` over potentially 365+ rows per coin — keeps read paths simple.
- No `Coin` table. CoinGecko is the universe; we cache its `/coins/list` on disk.

**Migration:** `prisma migrate dev --name replace_crypto_holdings`. The generated SQL drops the old `CryptoHolding` table (incompatible columns, no production data to preserve) and creates the new `CryptoHolding` + `CryptoSnapshot`.

## Components & data flow

### Page load (`/wallai/crypto`, server component)

```ts
const holdings = await loadHoldings(userId);                        // Prisma
const priceMap = await fetchPrices(holdings.map(h => h.coinId));    // CoinGecko, 60s cache
const snapshots = await loadSnapshots(userId, { days: 365 });       // Prisma
const totals = computeTotals(holdings, priceMap);                   // pure
```

Renders in order: `<CryptoHero>`, `<CryptoChart>`, `<CryptoHoldingsTable>`, `<AddHoldingButton>`.

**Empty state** (`holdings.length === 0`): swap to `<CryptoEmptyState>`. Hide chart and table. Hero shows €0 / P&L `—`.

### Add Holding modal (client)

Reuses `src/components/wallai/modal.tsx`.

1. **Popular chips row** — 8 baked-in coins from `popular-coins.ts`. Clicking a chip skips the search step.
2. **Search input** — debounced 250ms, hits `GET /api/wallai/crypto/coins/search?q=…`, renders top 10 matches as clickable rows (`symbol — name`).
3. **Inputs** after coin selection — quantity, avg cost (EUR per unit).
4. **Save** — `POST /api/wallai/crypto/holdings` with `{coinId, symbol, name, quantity, avgCostEur}`. If a holding already exists for that coin, the route runs a weighted-average merge:
   ```
   newAvgCost = (oldQty × oldAvgCost + addQty × addAvgCost) / (oldQty + addQty)
   newQty     = oldQty + addQty
   ```
5. **On success** — modal closes, page calls `router.refresh()`.

### Edit / delete

Per-row menu on the holdings table:

- **Edit** — opens the same modal pre-filled, PATCHes. Edit **overwrites** quantity and avgCost rather than merging.
- **Delete** — confirm, then `DELETE /api/wallai/crypto/holdings/[id]`.

### Chart

Recharts line chart, client component. Default 30-day window with 30/90/365 toggle buttons. Data source: `loadSnapshots()` returns `{ date, totalValueEur }[]` grouped by date across all holdings. Fewer than 2 snapshots → placeholder card: "Upload more history — the nightly job will fill this in."

### Price cache

`coingecko.fetchPrices()` holds a module-level `Map<coinId, {price, fetchedAt}>`. Entries under 60s old are served from memory; otherwise one batched CoinGecko call refreshes all missing entries at once. Keeps the page responsive on rapid reloads and limits outbound requests to ~1/min per unique coin.

### Dashboard integration

Two files change:

**`src/lib/wallai/dashboard-data.ts`** — `DashboardData.stats` gains a `crypto` field alongside `cash` and `debt`:

```ts
const cryptoHoldings = await loadHoldings(userId);
const priceMap = cryptoHoldings.length
  ? await fetchPrices(cryptoHoldings.map(h => h.coinId))
  : new Map();
const totals = computeTotals(cryptoHoldings, priceMap);

// stats.crypto: {
//   value: number;
//   pnl: number;
//   pnlPct: number | null;
//   accountCount: number;   // distinct coins held
//   configured: boolean;
// }
```

Net worth total also picks up `totals.value` so the hero stays consistent.

**`src/app/wallai/dashboard/page.tsx`** — the hardcoded Crypto `<StatCard configured={false} value={formatCurrency(0, …)}/>` is replaced with:

```tsx
<StatCard
  label="Crypto"
  value={formatCurrency(data.stats.crypto.value, data.netWorth.currency)}
  subtext={data.stats.crypto.configured ? data.stats.crypto.pnlLabel : null}
  gradient="from-cyan-500/20 to-cyan-500/5"
  configured={data.stats.crypto.configured}
/>
```

Where `pnlLabel` is a pre-formatted string like `"+€320 (+2.6%) unrealized"` (green/red styling isn't possible through `subtext` today — that's ok, the sign character is enough signal). Using the existing `subtext` prop means no changes to the `StatCard` component itself.

## External API — CoinGecko (`src/lib/wallai/crypto/coingecko.ts`)

Three exported functions:

```ts
fetchPrices(coinIds: string[]): Promise<Map<string, number>>
  → GET /simple/price?ids=<ids>&vs_currencies=eur
  → batches up to 250 ids per call
  → 60s in-memory cache keyed by coinId

searchCoins(query: string): Promise<CoinSummary[]>
  → calls coinList(), filters by symbol+name prefix (case-insensitive)
  → returns top 10

coinList(): Promise<CoinSummary[]>
  → GET /coins/list (~15k entries)
  → 24h on-disk cache at /var/www/playground/.cache/coingecko-coin-list.json
  → warm on first request, served from disk thereafter
```

Base URL (`https://api.coingecko.com/api/v3`) and batch size constant live at the top of the file. No API key required.

## Scheduler — nightly snapshot

### Endpoint: `POST /api/wallai/crypto/snapshot`

Auth: shared-secret header `x-snapshot-secret` matched against `process.env.WALLAI_SNAPSHOT_SECRET`.

Pseudocode:

```ts
if (req.headers.get("x-snapshot-secret") !== process.env.WALLAI_SNAPSHOT_SECRET) {
  return new Response("unauthorized", { status: 401 });
}

const today = startOfDayUTC(new Date());
const holdings = await prisma.cryptoHolding.findMany({
  select: { id: true, coinId: true, symbol: true, name: true, quantity: true },
});
const uniqueCoinIds = [...new Set(holdings.map(h => h.coinId))];
const prices = await fetchPrices(uniqueCoinIds);

const coinMeta = await coinList();
const metaByCoinId = new Map(coinMeta.map(c => [c.id, c]));

await prisma.$transaction([
  // Upsert today's snapshot per holding
  ...holdings.map(h => {
    const priceEur = prices.get(h.coinId) ?? 0;
    const valueEur = Number(h.quantity) * priceEur;
    return prisma.cryptoSnapshot.upsert({
      where: { holdingId_date: { holdingId: h.id, date: today } },
      create: { holdingId: h.id, date: today, quantity: h.quantity, priceEur, valueEur },
      update: { quantity: h.quantity, priceEur, valueEur },
    });
  }),
  // Refresh denormalized symbol/name in case CoinGecko renamed
  ...holdings.map(h => {
    const meta = metaByCoinId.get(h.coinId);
    if (!meta || (meta.symbol === h.symbol && meta.name === h.name)) return null;
    return prisma.cryptoHolding.update({
      where: { id: h.id },
      data: { symbol: meta.symbol, name: meta.name },
    });
  }).filter(Boolean),
]);

return Response.json({
  snapshotted: holdings.length,
  missingPrice: holdings.filter(h => !prices.has(h.coinId)).length,
});
```

**Properties:**

- **Idempotent** — `@@unique([holdingId, date])` + upsert. Safe to re-run the same day or backfill manually.
- **Missing price** — logs to response, writes `priceEur = 0, valueEur = 0` for that row. Chart's SUM undercounts that day; response surfaces the count.
- **Batched** — one CoinGecko call for all users combined.

### Cron

System crontab entry (not committed — the host owns the crontab; the plan documents it and installs it during deploy):

```
5 0 * * * curl -fsS -X POST -H "x-snapshot-secret: $WALLAI_SNAPSHOT_SECRET" https://playground.bruno-dev.xyz/api/wallai/crypto/snapshot >> /var/log/wallai-snapshot.log 2>&1
```

Runs at 00:05 UTC daily. `-fsS` causes curl to exit non-zero on HTTP errors so the system's cron mailer catches failures.

### Secret

- `WALLAI_SNAPSHOT_SECRET` added to `.env` (32-byte hex, generated with `openssl rand -hex 32`)
- `.env.example` gets the variable documented with an empty value
- Plan's deploy step generates the value and adds the crontab entry

## Error handling (user-facing)

| Failure | Behavior |
|---|---|
| CoinGecko down during page load | `fetchPrices` returns cached entries; if cache empty, page falls back to reading the most-recent `CryptoSnapshot` per holding and renders a warning banner: *"Live prices unavailable — showing last known values from yesterday's snapshot."* |
| CoinGecko rate-limited (HTTP 429) | `fetchPrices` retries once after 2s, then surfaces the same banner. No backoff storms. |
| Add holding with unknown coinId | API route validates coinId against `coinList()` before writing. Returns 400. |
| Stale denormalized symbol/name | Snapshot job refreshes in the same transaction as the upsert. |
| Snapshot job run twice in one day | Upsert overwrites; no duplicates. |
| Snapshot job misses a night | Next run's chart just has a gap for that date. No backfill. |

**Deliberately not handled:**

- Multi-currency. EUR only.
- Backfill from original trade dates — snapshots start the first time the job runs after a holding is added. Pre-holding chart is flat.
- Retry-on-failure queueing for the snapshot job.

## Testing

Scale: the bank and dashboard modules shipped without automated tests and there is no test infrastructure in the repo. Crypto follows the same approach — manual verification only. Pure-function correctness (`computeTotals`, `mergeHolding`, `coingecko.parsePrices`) is verified by hand during the deploy checklist rather than by spinning up vitest just for three tests.

### Manual verification

Same pattern as the bank and dashboard deploy checklists:

1. `curl` the snapshot route with the right secret → inspect rows inserted; re-run → verify no duplicates.
2. Open `/wallai/crypto`, add BTC via the popular chip, add DOGE via typeahead (not in the chip list), edit BTC quantity, delete DOGE → all persists through reload.
3. Load `/wallai/dashboard` → Crypto stat card is un-dimmed and shows total + P&L.
4. Temporarily set CoinGecko base URL to an invalid host → page renders with the fallback banner and yesterday's snapshot values.
5. Re-run the snapshot job after editing a holding → verify it upserts (no duplicate row for today).
6. `pm2 logs playground --lines 50 --nostream` → no runtime errors.

**Explicitly not tested:**

- React component rendering (no component test infrastructure in the repo)
- CoinGecko's actual response behavior (we trust the documented shape)

## Open questions

None. All scoping decisions are settled above.

## Out of scope (future work)

- Folding crypto into the dashboard's net-worth trend chart (currently cash-only — will happen when property and debts land and a multi-asset net-worth aggregator makes sense).
- Multi-currency.
- Full transaction ledger (buys, sells, transfers, per-lot cost basis).
- Tax reports, realized P&L.
- Exchange API sync (Coinbase/Binance).
- Alerts (price targets, % moves).
