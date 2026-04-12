import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient, logApiUsage, ApiKeyNotConfiguredError } from "@/lib/anthropic";
import { ALL_CATEGORIES, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "@/lib/wallai/categories";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 16384;
const BATCH_SIZE = 150;

const PROMPT = `You are categorizing bank transactions from a Portuguese or European personal bank account. For each transaction, pick exactly one category from the allowed list below.

Allowed INCOME categories (use for money IN):
${INCOME_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Allowed EXPENSE categories (use for money OUT):
${EXPENSE_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Rules:
- The amount sign tells you income vs expense: positive = money in, negative = money out. Always pick an income category for positive amounts and an expense category for negative amounts.
- Common Portuguese grocery chains: PINGO DOCE, LIDL, CONTINENTE, INTERMARCHE, MINIPRECO, AUCHAN, MERCADONA → Groceries
- Restaurants, cafés, bars, food delivery (UBER EATS, GLOVO) → Dining
- Ride-hailing (UBER, BOLT), fuel, parking, tolls → Transport
- Clothing, electronics, home goods, online retailers → Shopping
- Electricity, water, gas, internet, phone, MEO, NOS, VODAFONE → Bills & Utilities
- Netflix, Spotify, HBO, Disney+, YouTube Premium, iCloud → Subscriptions
- Cinema, concerts, events, gaming → Entertainment
- Pharmacy, clinic, hospital, dental → Health
- Rent, mortgage payments, HOA, property tax, repairs → Housing
- Flights, hotels, Airbnb → Travel
- ATM withdrawals (LEVANTAMENTO, ATM) → Cash
- Bank fees, account maintenance, stamp duty (IMPOSTO DE SELO), interest charges → Fees
- Outgoing transfers to other accounts → Transfer Out
- Incoming transfers, reimbursements → Transfer In (or Refund if clearly a return)
- Employer payroll → Salary
- Invoices, contractor payments → Freelance
- Unclear → Other Expense (if negative) or Other Income (if positive)

Return ONLY a JSON array in this exact shape, one entry per input transaction, same order:
[
  { "id": "cmxxx", "category": "Groceries" }
]

No markdown fences, no prose, no explanations.`;

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const uncategorized = await prisma.transaction.findMany({
    where: { userId: session.user.id, category: null },
    select: { id: true, description: true, amount: true },
    orderBy: { date: "asc" },
  });

  if (uncategorized.length === 0) {
    return NextResponse.json({ categorized: 0, total: 0 });
  }

  const allowed = new Set<string>(ALL_CATEGORIES);

  try {
    const client = await getAnthropicClient(session.user.id);
    const updatesByCategory = new Map<string, string[]>();
    let processed = 0;

    for (let i = 0; i < uncategorized.length; i += BATCH_SIZE) {
      const batch = uncategorized.slice(i, i + BATCH_SIZE);
      const input = batch.map((t) => ({
        id: t.id,
        description: t.description,
        amount: t.amount,
      }));

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: `${PROMPT}\n\nTransactions:\n${JSON.stringify(input)}`,
          },
        ],
      });

      await logApiUsage({
        userId: session.user.id,
        endpoint: "categorize-transactions",
        model: MODEL,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      });

      if (response.stop_reason === "max_tokens") {
        return NextResponse.json(
          {
            error:
              "Too many transactions for one batch. Please retry — the batch size will be reduced on next run.",
          },
          { status: 500 }
        );
      }

      const textBlock = response.content.find(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );
      if (!textBlock) continue;

      let raw = textBlock.text.trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) raw = fence[1].trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(parsed)) continue;

      for (const entry of parsed) {
        if (
          typeof entry !== "object" ||
          entry === null ||
          typeof (entry as { id?: unknown }).id !== "string" ||
          typeof (entry as { category?: unknown }).category !== "string"
        ) {
          continue;
        }
        const { id, category } = entry as { id: string; category: string };
        if (!allowed.has(category)) continue;
        const list = updatesByCategory.get(category) ?? [];
        list.push(id);
        updatesByCategory.set(category, list);
      }
    }

    await prisma.$transaction(
      Array.from(updatesByCategory.entries()).map(([category, ids]) =>
        prisma.transaction.updateMany({
          where: { id: { in: ids }, userId: session.user.id },
          data: { category },
        })
      )
    );

    for (const ids of updatesByCategory.values()) {
      processed += ids.length;
    }

    return NextResponse.json({ categorized: processed, total: uncategorized.length });
  } catch (error) {
    if (error instanceof ApiKeyNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[categorize] error:", error);
    return NextResponse.json(
      { error: "Failed to categorize transactions. Check server logs." },
      { status: 500 }
    );
  }
}
