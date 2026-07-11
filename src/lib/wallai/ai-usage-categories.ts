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
