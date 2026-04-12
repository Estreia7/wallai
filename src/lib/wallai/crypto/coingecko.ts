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

export async function coinList(): Promise<CoinSummary[]> {
  const now = Date.now();
  if (coinListMemory && now - coinListMemory.fetchedAt < COIN_LIST_TTL_MS) {
    return coinListMemory.coins;
  }

  const fromDisk = await readCoinListFromDisk();
  if (fromDisk && now - fromDisk.fetchedAt < COIN_LIST_TTL_MS) {
    coinListMemory = fromDisk;
    return fromDisk.coins;
  }

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
