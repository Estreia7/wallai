import type Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";
import {
  ALL_CATEGORIES,
  INCOME_CATEGORIES,
  EXPENSE_CATEGORIES,
} from "@/lib/wallai/categories";
import { getCategorySets } from "@/lib/wallai/categories-data";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 16384;
const BATCH_SIZE = 120;

export type EnrichResult = {
  id: string;
  /** null when the model is not confident — transaction stays uncategorized for review. */
  category: string | null;
  displayName: string;
  isLikelyRecurring: boolean;
  billType: string | null;
  confidence: number;
};

// Below this, we do NOT auto-apply the category — a wrong guess costs the user
// a correction and pollutes charts, so we prefer to surface it for review.
const CONFIDENCE_THRESHOLD = 0.6;

function buildPrompt(incomeNames: string[], expenseNames: string[]): string {
  return `You are categorizing bank transactions from a Portuguese or European personal bank account and extracting merchant info. For each transaction return one object.

Allowed INCOME categories (money IN, positive amounts):
${incomeNames.map((c) => `- ${c}`).join("\n")}

Allowed EXPENSE categories (money OUT, negative amounts):
${expenseNames.map((c) => `- ${c}`).join("\n")}

Rules:
- Sign decides income vs expense: positive = income category, negative = expense category.
- PT grocery chains (PINGO DOCE, LIDL, CONTINENTE, INTERMARCHE, MINIPRECO, AUCHAN, MERCADONA) -> Groceries.
- Restaurants, cafes, delivery (UBER EATS, GLOVO, BOLT FOOD) -> Dining. Ride-hailing (UBER, BOLT, FREENOW), fuel (GALP, BP, REPSOL), tolls (VIA VERDE) -> Transport.
- Utilities: electricity (EDP, ENDESA, IBERDROLA), water (EPAL, AGUAS), gas (GALP, GOLDENERGY), internet/phone (MEO, NOS, VODAFONE) -> Bills & Utilities.
- Streaming/software (NETFLIX, SPOTIFY, HBO, DISNEY, ICLOUD, MICROSOFT, ADOBE) -> Subscriptions.
- Pharmacies (FARMACIA, WELLS), clinics, gyms -> Health. ATM withdrawals -> Cash. Bank commissions/stamp duty/interest charged -> Fees.
- displayName: the clean human merchant name (e.g. "Pingo Doce", "EDP"), Title Case, no ref numbers/dates.
- isLikelyRecurring: true if this looks like a monthly bill or subscription (utility, rent, streaming, insurance, gym).
- billType: one of "energy","water","gas","internet","rent","subscription","other" when isLikelyRecurring, else null.
- confidence: 0.0-1.0. Be honest. A clear named merchant -> 0.9+. A generic/opaque description (bare reference numbers, an unknown acronym, a person's name for an MB WAY transfer) where you are guessing -> below 0.6. DO NOT force a category just to fill the field; a low confidence is expected and useful.

Examples:
- "COMPRA CONTACTLESS PINGO DOCE LISBOA", -42.10 -> {"category":"Groceries","displayName":"Pingo Doce","isLikelyRecurring":false,"billType":null,"confidence":0.98}
- "DD EDP COMERCIAL 062024", -61.30 -> {"category":"Bills & Utilities","displayName":"EDP","isLikelyRecurring":true,"billType":"energy","confidence":0.95}
- "MB WAY P/ JOAO SILVA", -20.00 -> {"category":null,"displayName":"Joao Silva","isLikelyRecurring":false,"billType":null,"confidence":0.25}
- "TRF REF 889321 004512", -150.00 -> {"category":null,"displayName":"","isLikelyRecurring":false,"billType":null,"confidence":0.15}

Return ONLY a JSON array, one object per input in the same order, no markdown fences:
[{"id":"cmx","category":"Groceries","displayName":"Pingo Doce","isLikelyRecurring":false,"billType":null,"confidence":0.98}]`;
}

export async function enrichUnknownMerchants(
  userId: string,
  txs: { id: string; description: string; amount: number }[],
): Promise<EnrichResult[]> {
  if (txs.length === 0) return [];
  const client = await getAnthropicClient(userId);

  // Build the allowed list + prompt from the user's live categories, falling
  // back to the defaults if they somehow have none.
  const sets = await getCategorySets(userId);
  const incomeNames = sets.income.size > 0 ? [...sets.income] : [...INCOME_CATEGORIES];
  const expenseNames = sets.expense.size > 0 ? [...sets.expense] : [...EXPENSE_CATEGORIES];
  const allowed = sets.all.length > 0 ? new Set<string>(sets.all.map((c) => c.name)) : new Set<string>(ALL_CATEGORIES);
  const prompt = buildPrompt(incomeNames, expenseNames);
  const results: EnrichResult[] = [];

  for (let i = 0; i < txs.length; i += BATCH_SIZE) {
    const batch = txs.slice(i, i + BATCH_SIZE);
    const input = batch.map((t) => ({ id: t.id, description: t.description, amount: t.amount }));
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: `${prompt}\n\nTransactions:\n${JSON.stringify(input)}` }],
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
      if (typeof o.id !== "string") continue;
      const confidence = typeof o.confidence === "number" ? o.confidence : 0;
      // Only accept a category if it's known AND the model is confident enough.
      const rawCategory = typeof o.category === "string" && allowed.has(o.category) ? o.category : null;
      const category = rawCategory && confidence >= CONFIDENCE_THRESHOLD ? rawCategory : null;
      results.push({
        id: o.id,
        category,
        displayName: typeof o.displayName === "string" ? o.displayName : "",
        isLikelyRecurring: o.isLikelyRecurring === true,
        billType: typeof o.billType === "string" ? o.billType : null,
        confidence,
      });
    }
  }
  return results;
}
