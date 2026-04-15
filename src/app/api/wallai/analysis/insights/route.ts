import { NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAnthropicClient,
  logApiUsage,
  ApiKeyNotConfiguredError,
} from "@/lib/anthropic";
import {
  getAnalysisData,
  type AnalysisPeriod,
} from "@/lib/wallai/analysis-data";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 800;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function parsePeriod(v: unknown): AnalysisPeriod {
  const n = Number(v);
  if (n === 3 || n === 6 || n === 12) return n;
  return 6;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

type CachePayload = {
  period: AnalysisPeriod;
  text: string;
  fingerprint: string;
};

function isCachePayload(v: unknown): v is CachePayload {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as CachePayload).period === "number" &&
    typeof (v as CachePayload).text === "string" &&
    typeof (v as CachePayload).fingerprint === "string"
  );
}

export async function GET(request: Request) {
  return handle(request, { force: false });
}

export async function POST(request: Request) {
  return handle(request, { force: true });
}

async function handle(request: Request, { force }: { force: boolean }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const period = parsePeriod(url.searchParams.get("period"));
  const userId = session.user.id;

  const data = await getAnalysisData(userId, period);
  if (!data.hasData) {
    return NextResponse.json({
      period,
      text: "No transactions in the selected window. Import a statement to unlock insights.",
      cached: false,
    });
  }

  const fingerprint = [
    period,
    Math.round(data.totals.income),
    Math.round(data.totals.expenses),
    data.expensesByCategory
      .slice(0, 3)
      .map((c) => `${c.category}:${Math.round(c.amount)}`)
      .join("|"),
  ].join(":");

  if (!force) {
    const cached = await prisma.analysisCache.findFirst({
      where: { userId },
      orderBy: { generatedAt: "desc" },
    });
    if (cached && isCachePayload(cached.summary)) {
      const ageMs = Date.now() - cached.generatedAt.getTime();
      if (
        cached.summary.period === period &&
        cached.summary.fingerprint === fingerprint &&
        ageMs < CACHE_TTL_MS
      ) {
        return NextResponse.json({
          period,
          text: cached.summary.text,
          cached: true,
          generatedAt: cached.generatedAt,
        });
      }
    }
  }

  const currency = data.currency;
  const topExpenses = data.expensesByCategory
    .slice(0, 5)
    .map((c) => `- ${c.category}: ${formatCurrency(c.amount, currency)} (${c.pct.toFixed(0)}%)`)
    .join("\n");
  const topIncome = data.incomeByCategory
    .slice(0, 3)
    .map((c) => `- ${c.category}: ${formatCurrency(c.amount, currency)} (${c.pct.toFixed(0)}%)`)
    .join("\n");
  const topMerchants = data.topMerchants
    .slice(0, 5)
    .map(
      (m) => `- ${m.description}: ${formatCurrency(m.amount, currency)} (${m.count}x)`,
    )
    .join("\n");
  const monthly = data.monthly
    .map(
      (m) =>
        `- ${m.month}: in ${formatCurrency(m.income, currency)}, out ${formatCurrency(
          m.expenses,
          currency,
        )}, net ${formatCurrency(m.net, currency)}`,
    )
    .join("\n");

  const savingsRateText =
    data.totals.savingsRate !== null
      ? `${data.totals.savingsRate.toFixed(1)}%`
      : "n/a";

  const prompt = `You are a pragmatic personal-finance coach. Review this ${period}-month summary and write a short, actionable insight for the user in plain prose, ~120 words.

Rules:
- Call out the 1-2 most useful observations (unusual spend, rising category, healthy trend, thin savings, concentration in one merchant).
- If the savings rate is below 10%, flag it. If above 25%, acknowledge it.
- Be specific — use category names and amounts. Don't restate every line.
- Finish with ONE concrete suggestion the user could try this month.
- No preamble, no headings, no bullet points — just 2-3 short paragraphs.

Totals (${currency}):
- Income: ${formatCurrency(data.totals.income, currency)}
- Expenses: ${formatCurrency(data.totals.expenses, currency)}
- Net: ${formatCurrency(data.totals.net, currency)}
- Savings rate: ${savingsRateText}

Top expense categories:
${topExpenses}

Top income categories:
${topIncome}

Top spending destinations:
${topMerchants}

Monthly flow:
${monthly}`;

  try {
    const client = await getAnthropicClient(userId);
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: prompt }],
    });

    await logApiUsage({
      userId,
      endpoint: "analysis-insight",
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === "text",
    );
    const text = textBlock?.text.trim() ?? "No insight generated.";

    const payload: CachePayload = { period, text, fingerprint };
    await prisma.analysisCache.create({
      data: {
        userId,
        summary: payload,
      },
    });

    return NextResponse.json({ period, text, cached: false });
  } catch (err) {
    if (err instanceof ApiKeyNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[analysis/insights] error:", err);
    return NextResponse.json(
      { error: "Failed to generate insight. Check server logs." },
      { status: 500 },
    );
  }
}
