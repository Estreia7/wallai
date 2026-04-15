import { prisma } from "@/lib/prisma";
import { loadHoldings, computeTotals } from "@/lib/wallai/crypto/crypto-data";
import { fetchPrices } from "@/lib/wallai/crypto/coingecko";
import { buildConverter } from "@/lib/wallai/fx";
import { loadEffectiveBankAccounts } from "@/lib/wallai/balances";

export type CurrentSnapshot = {
  currency: string;
  total: number;
  cash: number;
  crypto: number;
  property: number;
  debt: number;
};

/** Compute the user's current net worth breakdown in their primary currency. */
export async function computeCurrentSnapshot(userId: string): Promise<CurrentSnapshot> {
  const [user, bankAccounts, debts, properties] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { primaryCurrency: true },
    }),
    loadEffectiveBankAccounts(userId),
    prisma.debt.findMany({
      where: { userId },
      select: { currency: true, currentBalance: true },
    }),
    prisma.property.findMany({
      where: { userId },
      select: {
        currency: true,
        valuations: {
          orderBy: { date: "desc" },
          take: 1,
          select: { estimatedValue: true },
        },
      },
    }),
  ]);

  const currency = user?.primaryCurrency ?? "EUR";

  const holdings = await loadHoldings(userId);
  let priceMap = new Map<string, number>();
  if (holdings.length > 0) {
    try {
      priceMap = await fetchPrices(holdings.map((h) => h.coinId));
    } catch (err) {
      console.error("[snapshots] fetchPrices failed", err);
    }
  }
  const { totals: cryptoTotals } = computeTotals(holdings, priceMap);

  const currencies = new Set<string>(["EUR"]);
  for (const a of bankAccounts) currencies.add(a.currency);
  for (const d of debts) currencies.add(d.currency);
  for (const p of properties) currencies.add(p.currency);

  const toPrimary = await buildConverter(currency, currencies);

  let cash = 0;
  let creditSigned = 0;
  for (const a of bankAccounts) {
    const v = toPrimary(a.effectiveBalance, a.currency);
    if (a.type === "checking" || a.type === "savings") cash += v;
    else if (a.type === "credit") creditSigned += v;
  }

  const loanDebt = debts.reduce(
    (sum, d) => sum + toPrimary(d.currentBalance, d.currency),
    0,
  );
  const debt = -creditSigned + loanDebt;

  const property = properties.reduce(
    (sum, p) => sum + toPrimary(p.valuations[0]?.estimatedValue ?? 0, p.currency),
    0,
  );

  const crypto = toPrimary(cryptoTotals.totalValueEur, "EUR");

  const total = cash + creditSigned - loanDebt + crypto + property;

  return { currency, total, cash, crypto, property, debt };
}

function startOfUtcDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

/** Record (upsert) a net-worth snapshot for the given user at today's UTC date. */
export async function recordSnapshot(userId: string) {
  const snap = await computeCurrentSnapshot(userId);
  const date = startOfUtcDay(new Date());
  return prisma.netWorthSnapshot.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...snap },
    update: { ...snap },
  });
}

/** Get the most recent N daily snapshots, oldest first. */
export async function loadSnapshots(userId: string, days: number) {
  const since = startOfUtcDay(new Date());
  since.setUTCDate(since.getUTCDate() - (days - 1));

  return prisma.netWorthSnapshot.findMany({
    where: { userId, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { date: true, total: true, cash: true, crypto: true, property: true, debt: true },
  });
}
