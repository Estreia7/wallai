export type CoinSummary = {
  id: string;
  symbol: string;
  name: string;
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
  priceEur: number | null;
  valueEur: number;
  costBasisEur: number;
  pnlEur: number;
  pnlPct: number | null;
};

export type CryptoTotals = {
  totalValueEur: number;
  totalCostEur: number;
  totalPnlEur: number;
  totalPnlPct: number | null;
  coinCount: number;
};

export type SnapshotPoint = {
  date: string;
  valueEur: number;
};

export type PopularCoin = {
  id: string;
  symbol: string;
  name: string;
};
