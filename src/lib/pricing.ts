// Anthropic model pricing in USD per million tokens.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5-20251001": { input: 0.8, output: 4.0 },
  "claude-sonnet-4-5-20250929": { input: 3.0, output: 15.0 },
  "claude-sonnet-4-6": { input: 3.0, output: 15.0 },
  "claude-opus-4-6": { input: 15.0, output: 75.0 },
};

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model];
  if (!pricing) {
    return ((inputTokens * 0.8) + (outputTokens * 4.0)) / 1_000_000;
  }
  return ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1_000_000;
}

export function getAvailableModels(): string[] {
  return Object.keys(PRICING);
}
