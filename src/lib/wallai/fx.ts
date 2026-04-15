import { prisma } from "@/lib/prisma";

// Supported currencies — keep in sync with settings/currency-card.
const SUPPORTED = new Set(["EUR", "USD", "GBP", "CHF", "BRL"]);

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/**
 * Get today's FX rate from `base` to `quote`. Identity returns 1.
 * Caches rates per-day in the FxRate table. Returns null if lookup fails.
 */
export async function getRate(base: string, quote: string): Promise<number | null> {
  if (base === quote) return 1;
  if (!SUPPORTED.has(base) || !SUPPORTED.has(quote)) return null;

  const today = startOfUtcDay(new Date());

  const cached = await prisma.fxRate.findUnique({
    where: { base_quote_date: { base, quote, date: today } },
  });
  if (cached) return cached.rate;

  // Try the reverse direction from cache and invert.
  const reverse = await prisma.fxRate.findUnique({
    where: { base_quote_date: { base: quote, quote: base, date: today } },
  });
  if (reverse && reverse.rate !== 0) return 1 / reverse.rate;

  // Fetch from Frankfurter (free, no key).
  try {
    const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}&symbols=${encodeURIComponent(quote)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { rates?: Record<string, number> };
    const rate = json.rates?.[quote];
    if (typeof rate !== "number" || !Number.isFinite(rate)) return null;

    await prisma.fxRate.upsert({
      where: { base_quote_date: { base, quote, date: today } },
      create: { base, quote, rate, date: today },
      update: { rate, fetchedAt: new Date() },
    });
    return rate;
  } catch (err) {
    console.error("[wallai/fx] fetch failed", err);
    return null;
  }
}

/**
 * Convert `amount` from `from` currency to `to` currency. If the rate can't be
 * resolved, returns the original amount unchanged (caller should consider the
 * result approximate).
 */
export async function convert(
  amount: number,
  from: string,
  to: string,
): Promise<number> {
  if (amount === 0 || from === to) return amount;
  const rate = await getRate(from, to);
  if (rate === null) return amount;
  return amount * rate;
}

/**
 * Build a currency conversion function that caches rates for a single
 * computation pass — used when aggregating many amounts to avoid duplicate
 * DB/HTTP lookups.
 */
export async function buildConverter(
  toCurrency: string,
  fromCurrencies: Iterable<string>,
): Promise<(amount: number, from: string) => number> {
  const rates = new Map<string, number>();
  rates.set(toCurrency, 1);

  const uniques = new Set<string>();
  for (const c of fromCurrencies) if (c && c !== toCurrency) uniques.add(c);

  await Promise.all(
    Array.from(uniques).map(async (c) => {
      const r = await getRate(c, toCurrency);
      rates.set(c, r ?? 1);
    }),
  );

  return (amount: number, from: string) => {
    const r = rates.get(from) ?? 1;
    return amount * r;
  };
}
