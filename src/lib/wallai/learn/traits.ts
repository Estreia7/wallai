// The 20-trait vector. Order is load-bearing: it's the stable index
// for every Book.traits Float[] and every profile computation.
export const LEARN_TRAITS = [
  // Core literacy (0–9)
  "Budgeting",
  "Saving habits",
  "Debt management",
  "Credit",
  "Taxes",
  "Insurance",
  "Retirement",
  "Estate planning",
  "Emergency fund",
  "Risk tolerance",
  // Wealth building (10–19)
  "Index investing",
  "Stock picking",
  "Real estate",
  "Crypto",
  "Entrepreneurship",
  "Psychology / mindset",
  "Frugality",
  "Passive income",
  "Macro / economics",
  "Financial independence",
] as const;

export type LearnTrait = (typeof LEARN_TRAITS)[number];

export const TRAIT_COUNT = 20;

export const CORE_TRAIT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const WEALTH_TRAIT_INDICES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

export function isValidTraitVector(v: unknown): v is number[] {
  if (!Array.isArray(v) || v.length !== TRAIT_COUNT) return false;
  for (const n of v) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10) return false;
  }
  return true;
}
