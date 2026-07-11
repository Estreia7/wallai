import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";
import {
  ALL_CATEGORIES,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from "@/lib/wallai/categories";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 16384;
const BATCH_SIZE = 120;

export type EnrichResult = {
  id: string;
  category: string;
  displayName: string;
  isLikelyRecurring: boolean;
  billType: string | null;
};

const PROMPT = `You are categorizing bank transactions from a Portuguese or European personal bank account and extracting merchant info. For each transaction return one object.

Allowed INCOME categories (money IN, positive amounts):
${INCOME_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Allowed EXPENSE categories (money OUT, negative amounts):
${EXPENSE_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Rules:
- Sign decides income vs expense: positive = income category, negative = expense category.
- PT grocery chains (PINGO DOCE, LIDL, CONTINENTE, INTERMARCHE, MINIPRECO, AUCHAN, MERCADONA) -> Groceries.
- Restaurants, cafes, delivery (UBER EATS, GLOVO) -> Dining. Ride-hailing/fuel/tolls -> Transport.
- Utilities: electricity (EDP, ENDESA, IBERDROLA), water (EPAL, AGUAS), gas (GALP, GOLDENERGY), internet/phone (MEO, NOS, VODAFONE) -> Bills & Utilities.
- Streaming (NETFLIX, SPOTIFY, HBO, DISNEY, ICLOUD) -> Subscriptions.
- displayName: the clean human merchant name (e.g. "Pingo Doce", "EDP"), Title Case, no ref numbers/dates.
- isLikelyRecurring: true if this looks like a monthly bill or subscription (utility, rent, streaming, insurance).
- billType: one of "energy","water","gas","internet","rent","subscription","other" when isLikelyRecurring, else null.

Return ONLY a JSON array, one object per input in the same order, no markdown fences:
[{"id":"cmx","category":"Groceries","displayName":"Pingo Doce","isLikelyRecurring":false,"billType":null}]`;

export async function enrichUnknownMerchants(
  userId: string,
  txs: { id: string; description: string; amount: number }[],
): Promise<EnrichResult[]> {
  if (txs.length === 0) return [];
  const client = await getAnthropicClient(userId);
  const allowed = new Set<string>(ALL_CATEGORIES);
  const results: EnrichResult[] = [];

  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    const batch = txs.slice(i, i + BATCH_SIZE);
    const input = batch.map((t) => ({ id: t.id, description: t.description, amount: t.amount }));
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: `${PROMPT}\n\nTransactions:\n${JSON.stringify(input)}` }],
    });
    await logApiUsage({
      userId,
      endpoint: "categorize-transactions",
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });
    const textBlock = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text",
    );
    if (!textBlock) continue;
    let raw = textBlock.text.trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence) raw = fence[1].trim();
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(parsed)) continue;
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      if (typeof o.id !== "string" || typeof o.category !== "string") continue;
      if (!allowed.has(o.category)) continue;
      results.push({
        id: o.id,
        category: o.category,
        displayName: typeof o.displayName === "string" ? o.displayName : "",
        isLikelyRecurring: o.isLikelyRecurring === true,
        billType: typeof o.billType === "string" ? o.billType : null,
      });
    }
  }
  return results;
}
