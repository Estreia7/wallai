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
