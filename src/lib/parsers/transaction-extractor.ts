import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 16384;

const EXTRACT_PROMPT = `You are parsing a bank statement. Extract three things and return them as a single JSON object.

Return ONLY a JSON object, no markdown fences, no explanations, no other text.

Shape:
{
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "amount": 123.45, "currency": "EUR" }
  ],
  "primaryBalance": 2996.44,
  "detectedAccounts": [
    { "type": "savings", "name": "Aplicações de Prazo Fixo", "balance": 1500.00, "currency": "EUR" },
    { "type": "credit",  "name": "Crédito Habitação/Hipotecário", "balance": -164056.87, "currency": "EUR" }
  ]
}

Rules for "transactions":
- Only line-item transactions for the primary (checking) account being statemented.
- Positive amounts = money IN, negative amounts = money OUT.
- Dates in YYYY-MM-DD format — convert from any other format. If the statement only shows day/month, infer the year from the statement period header.
- Skip balance-only rows, subtotals, and section headers.
- Keep descriptions as they appear on the statement.

Rules for "primaryBalance":
- The current/closing balance of the checking account being statemented (e.g. "SALDO FINAL", "SALDO CONTABILISTICO FINAL", "Closing balance", "Current balance").
- Positive number for assets.
- If the statement has no closing balance, use null.

Rules for "detectedAccounts":
- Only include accounts OTHER than the primary checking account. Look for the account summary table usually on page 1 of bank statements. Portuguese banks often show: "Depósitos à Ordem" (checking — SKIP this, it's the primary), "Aplicações de Prazo Fixo" / "Depósitos a Prazo" (savings), "Crédito Habitação" / "Crédito Hipotecário" / "Cartão de Crédito" (credit/debt).
- "type" must be exactly "savings" or "credit" — nothing else. Use "savings" for deposits/term accounts/investment accounts with a positive balance you own. Use "credit" for any kind of debt: mortgages, personal loans, credit cards.
- "balance" should be POSITIVE for savings accounts. For credit accounts, use a NEGATIVE number (e.g. -164056.87 for a mortgage you owe).
- "name" should be the label as it appears in the statement (keep the original language — Portuguese, English, etc).
- Return [] if no sibling accounts are visible.

Return {"transactions": [], "primaryBalance": null, "detectedAccounts": []} if nothing is parseable.`;

export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
};

export type DetectedAccount = {
  type: "savings" | "credit";
  name: string;
  balance: number;
  currency: string;
};

export type StatementData = {
  transactions: ParsedTransaction[];
  primaryBalance: number | null;
  detectedAccounts: DetectedAccount[];
};

export async function extractStatementFromText(
  userId: string,
  text: string
): Promise<StatementData> {
  const client = await getAnthropicClient(userId);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: `${EXTRACT_PROMPT}\n\n---\n\nBANK DATA:\n\n${text}`,
      },
    ],
  });

  await logApiUsage({
    userId,
    endpoint: "parse-statement",
    model: MODEL,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  });

  if (response.stop_reason === "max_tokens") {
    throw new Error(
      "Statement too large: Claude hit the output token limit. Try a shorter statement or contact support."
    );
  }

  return parseClaudeResponse(response.content);
}

function parseClaudeResponse(content: Anthropic.Messages.ContentBlock[]): StatementData {
  const empty: StatementData = {
    transactions: [],
    primaryBalance: null,
    detectedAccounts: [],
  };

  const textBlock = content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === "text"
  );
  if (!textBlock) return empty;

  let text = textBlock.text.trim();

  const closedFence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (closedFence) {
    text = closedFence[1].trim();
  } else {
    const openFence = text.match(/^```(?:json)?\s*([\s\S]*)$/);
    if (openFence) text = openFence[1].trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return empty;
  }

  if (typeof parsed !== "object" || parsed === null) return empty;
  const obj = parsed as Record<string, unknown>;

  const transactions = Array.isArray(obj.transactions)
    ? obj.transactions.filter(isValidTransaction)
    : [];

  const primaryBalance =
    typeof obj.primaryBalance === "number" ? obj.primaryBalance : null;

  const detectedAccounts = Array.isArray(obj.detectedAccounts)
    ? obj.detectedAccounts.filter(isValidDetectedAccount)
    : [];

  return { transactions, primaryBalance, detectedAccounts };
}

function isValidTransaction(t: unknown): t is ParsedTransaction {
  if (typeof t !== "object" || t === null) return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.date === "string" &&
    typeof obj.description === "string" &&
    typeof obj.amount === "number" &&
    typeof obj.currency === "string"
  );
}

function isValidDetectedAccount(a: unknown): a is DetectedAccount {
  if (typeof a !== "object" || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    (obj.type === "savings" || obj.type === "credit") &&
    typeof obj.name === "string" &&
    typeof obj.balance === "number" &&
    typeof obj.currency === "string"
  );
}
