import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { getAnthropicClient, logApiUsage } from "@/lib/anthropic";
import { normalizeMerchant } from "./normalize";
import { selectRecurringCandidates } from "./bill-detect";
import { upsertTodo } from "./todos";

const MODEL = "claude-haiku-4-5-20251001";

export async function detectAndProposeBills(userId: string): Promise<void> {
  const txs = await prisma.transaction.findMany({
    where: { userId },
    select: { date: true, description: true, amount: true },
    orderBy: { date: "asc" },
  });
  const candidates = selectRecurringCandidates(
    txs.map((t) => ({ date: t.date, description: t.description, amount: t.amount })),
  );
  if (candidates.length === 0) return;

  // Exclude merchantKeys already tracked (any status).
  const existing = await prisma.recurringBill.findMany({
    where: { userId }, select: { merchantKey: true },
  });
  const known = new Set(existing.map((b) => b.merchantKey).filter(Boolean) as string[]);
  const fresh = candidates.filter((c) => !known.has(c.merchantKey));
  if (fresh.length === 0) return;

  // Haiku labels the candidates.
  let labels: Record<string, { name: string; category: string; billType: string; expectedAmount?: number }> = {};
  try {
    const client = await getAnthropicClient(userId);
    const prompt = `Label these recurring expense merchants as bills. Return ONLY a JSON object keyed by merchantKey:
{"edp":{"name":"Energy (EDP)","category":"Bills & Utilities","billType":"energy","expectedAmount":61}}
billType one of "energy","water","gas","internet","rent","subscription","other". category from the user's finance categories (default "Bills & Utilities").
Merchants:\n${JSON.stringify(fresh)}`;
    const response = await client.messages.create({
      model: MODEL, max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });
    await logApiUsage({
      userId, endpoint: "detect-recurring-bills", model: MODEL,
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
    });
    const tb = response.content.find((b): b is Anthropic.Messages.TextBlock => b.type === "text");
    if (tb) {
      let raw = tb.text.trim();
      const fence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fence) raw = fence[1].trim();
      labels = JSON.parse(raw);
    }
  } catch {
    // On AI failure, fall back to generic labels below.
  }

  for (const c of fresh) {
    const l = labels[c.merchantKey];
    const bill = await prisma.recurringBill.create({
      data: {
        userId,
        name: l?.name || c.displayName,
        category: l?.category || "Bills & Utilities",
        billType: l?.billType || "other",
        merchantKey: c.merchantKey,
        matchKeywords: [],
        cadence: "monthly",
        expectedAmount: l?.expectedAmount ?? c.avgAmount,
        status: "candidate",
        source: "auto_detected",
      },
    });
    await upsertTodo(userId, {
      type: "confirm_bill",
      dedupeKey: `confirm_bill:${bill.id}`,
      title: `Is "${bill.name}" a recurring bill? (~${bill.expectedAmount?.toFixed(0)}/mo)`,
      body: "Confirm to track it and get reminders when it's missing.",
      payload: { billId: bill.id },
    });
  }
}

export async function matchTransactionsToBills(
  userId: string,
  txs: { date: string | Date; description: string; amount: number }[],
): Promise<void> {
  const bills = await prisma.recurringBill.findMany({ where: { userId, status: "active" } });
  if (bills.length === 0) return;
  for (const tx of txs) {
    if (tx.amount >= 0) continue;
    const { merchantKey } = normalizeMerchant(tx.description);
    const bill = bills.find(
      (b) =>
        (b.merchantKey && b.merchantKey === merchantKey) ||
        b.matchKeywords.some((k) => tx.description.toUpperCase().includes(k.toUpperCase())),
    );
    if (!bill) continue;
    const d = new Date(tx.date);
    if (!bill.lastSeenAt || d > bill.lastSeenAt) {
      await prisma.recurringBill.update({
        where: { id: bill.id },
        data: { lastSeenAt: d, expectedAmount: Math.abs(tx.amount) },
      });
    }
  }
}

export async function checkMissingBills(userId: string, ref: Date): Promise<void> {
  const bills = await prisma.recurringBill.findMany({ where: { userId, status: "active", cadence: "monthly" } });
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth();
  const monthStart = new Date(Date.UTC(y, m, 1));
  for (const bill of bills) {
    const seenThisMonth = bill.lastSeenAt && bill.lastSeenAt >= monthStart;
    if (seenThisMonth) continue;
    const dueDay = bill.dayOfMonthHint ?? 28;
    if (ref.getUTCDate() < dueDay) continue; // not due yet
    await upsertTodo(userId, {
      type: "missing_bill",
      dedupeKey: `missing_bill:${bill.id}:${y}-${m}`,
      title: `${bill.name} not seen this month`,
      body: `Expected ~${bill.expectedAmount?.toFixed(0) ?? "?"}. Did you pay it?`,
      payload: { billId: bill.id, month: `${y}-${String(m + 1).padStart(2, "0")}` },
    });
  }
}

const HINTS = [
  { billType: "water", name: "Water" },
  { billType: "gas", name: "Gas" },
  { billType: "energy", name: "Energy" },
  { billType: "internet", name: "Internet / Phone" },
  { billType: "rent", name: "Rent" },
];

export async function bootstrapBillHints(userId: string): Promise<void> {
  const count = await prisma.recurringBill.count({ where: { userId } });
  if (count > 0) return;
  for (const h of HINTS) {
    await upsertTodo(userId, {
      type: "add_bill_hint",
      dedupeKey: `add_bill_hint:${h.billType}`,
      title: `Add your ${h.name.toLowerCase()} bill`,
      body: "Tell WallAI the amount so it can track it monthly.",
      payload: { billType: h.billType, name: h.name },
    });
  }
}
