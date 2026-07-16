import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";

// Extraction (transcribing the whole statement into structured rows) is the
// step where an error is most damaging — a dropped row or mis-signed balance
// silently corrupts everything downstream. Sonnet is noticeably more reliable
// on messy multi-account statements, and this call runs once per statement
// (not per transaction), so the extra cost is small. Categorization stays on
// Haiku — see categorize.ts.
const MODEL = "claude-sonnet-4-5-20250929";
const MAX_TOKENS = 16384;

const EXTRACT_PROMPT = `You are parsing a bank statement. Extract three things and return them as a single JSON object.

Return ONLY a JSON object, no markdown fences, no explanations, no other text.

Shape:
{
  "transactions": [
    { "date": "YYYY-MM-DD", "description": "...", "amount": 123.45, "currency": "EUR" }
  ],
  "openingBalance": 3715.13,
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
- Skip movements from OTHER accounts' own sections (e.g. a savings-account "CONTAS POUPANÇA" section or a loan "CRÉDITO HABITAÇÃO" section listed later in the statement) — those belong to sibling accounts, not the checking account. Only include such a movement if it also appears as a line item debited/credited on the checking account itself.
- Skip scheduled / future / not-yet-settled movements: "MOVIMENTOS PREVISTOS", "MOVIMENTOS EM AGENDA", "PRÓXIMAS PRESTAÇÕES", or any row dated after the statement period end. Only settled transactions count.
- Keep descriptions as they appear on the statement.

Rules for "openingBalance":
- The starting/previous balance of the checking account before the first transaction (e.g. "SALDO ANTERIOR", "SALDO ANTERIOR CONTABILISTICO", "Opening balance", "Previous balance").
- Positive number for assets.
- If the statement has no opening balance, use null.

Rules for "primaryBalance":
- The current/closing balance of the checking account being statemented (e.g. "SALDO FINAL", "SALDO CONTABILISTICO FINAL", "SALDO ACTUAL CONTABILISTICO", "Closing balance", "Current balance").
- This is the checking account's OWN balance — NOT a combined "ACTIVOS"/"total assets" figure that sums several accounts.
- Positive number for assets.
- If the statement has no closing balance, use null.

Rules for "detectedAccounts":
- Only include accounts OTHER than the primary checking account. Look for the account summary table usually on page 1 of bank statements. Portuguese banks often show: "Depósitos à Ordem" (checking — SKIP this, it's the primary), "Aplicações de Prazo Fixo" / "Depósitos a Prazo" (savings), "Crédito Habitação" / "Crédito Hipotecário" / "Cartão de Crédito" (credit/debt).
- "type" must be exactly "savings" or "credit" — nothing else. Use "savings" for deposits/term accounts/investment accounts with a positive balance you own. Use "credit" for any kind of debt: mortgages, personal loans, credit cards.
- "balance" should be POSITIVE for savings accounts. For credit accounts, use a NEGATIVE number (e.g. -164056.87 for a mortgage you owe).
- "name" should be the label as it appears in the statement (keep the original language — Portuguese, English, etc).
- Return [] if no sibling accounts are visible.

Return {"transactions": [], "openingBalance": null, "primaryBalance": null, "detectedAccounts": []} if nothing is parseable.`;

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

/**
 * Result of checking whether the extracted transactions add up:
 * openingBalance + sum(amounts) should equal primaryBalance. When it doesn't,
 * the extraction likely dropped, duplicated, or mis-signed a row.
 */
export type Reconciliation = {
  /** Only true when we had both an opening and a closing balance to compare. */
  checked: boolean;
  reconciles: boolean;
  /** openingBalance + sum(amounts), rounded to cents. null when not checkable. */
  computedBalance: number | null;
  /** computedBalance - primaryBalance, rounded to cents. null when not checkable. */
  difference: number | null;
};

export type StatementData = {
  transactions: ParsedTransaction[];
  openingBalance: number | null;
  primaryBalance: number | null;
  detectedAccounts: DetectedAccount[];
  reconciliation: Reconciliation;
};

// Balances that land within a cent of each other count as reconciled — guards
// against float drift from summing many amounts.
const RECONCILE_TOLERANCE = 0.01;

function reconcile(
  transactions: ParsedTransaction[],
  openingBalance: number | null,
  primaryBalance: number | null,
): Reconciliation {
  if (openingBalance === null || primaryBalance === null) {
    return { checked: false, reconciles: false, computedBalance: null, difference: null };
  }
  const sum = transactions.reduce((acc, t) => acc + t.amount, 0);
  const computedBalance = Math.round((openingBalance + sum) * 100) / 100;
  const difference = Math.round((computedBalance - primaryBalance) * 100) / 100;
  return {
    checked: true,
    reconciles: Math.abs(difference) <= RECONCILE_TOLERANCE,
    computedBalance,
    difference,
  };
}

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

  const data = parseClaudeResponse(response.content);

  // Surface a bad extraction in server logs even if the user imports anyway.
  const r = data.reconciliation;
  if (r.checked && !r.reconciles) {
    console.warn(
      `[parse-statement] reconciliation failed for user ${userId}: ` +
        `opening=${data.openingBalance} + sum(${data.transactions.length} txns) ` +
        `= ${r.computedBalance}, but stated closing=${data.primaryBalance} (off by ${r.difference})`
    );
  }

  return data;
}

function parseClaudeResponse(content: Anthropic.Messages.ContentBlock[]): StatementData {
  const empty: StatementData = {
    transactions: [],
    openingBalance: null,
    primaryBalance: null,
    detectedAccounts: [],
    reconciliation: reconcile([], null, null),
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

  const openingBalance =
    typeof obj.openingBalance === "number" ? obj.openingBalance : null;

  const primaryBalance =
    typeof obj.primaryBalance === "number" ? obj.primaryBalance : null;

  const detectedAccounts = Array.isArray(obj.detectedAccounts)
    ? obj.detectedAccounts.filter(isValidDetectedAccount)
    : [];

  const reconciliation = reconcile(transactions, openingBalance, primaryBalance);

  return { transactions, openingBalance, primaryBalance, detectedAccounts, reconciliation };
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
