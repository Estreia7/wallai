import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveTodo } from "@/lib/wallai/knowledge/todos";
import { learnFromCorrection } from "@/lib/wallai/knowledge/matcher";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Ctx) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;
  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const todo = await prisma.todo.findFirst({ where: { id, userId } });
  if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const payload = (todo.payload ?? {}) as Record<string, unknown>;

  if (todo.type === "confirm_bill") {
    const billId = payload.billId as string | undefined;
    if (billId) {
      if (body.action === "dismiss") {
        await prisma.recurringBill.updateMany({ where: { id: billId, userId }, data: { status: "dismissed" } });
      } else {
        const edits = (body.edits ?? {}) as Record<string, unknown>;
        await prisma.recurringBill.updateMany({
          where: { id: billId, userId },
          data: {
            status: "active",
            ...(typeof edits.name === "string" ? { name: edits.name } : {}),
            ...(typeof edits.expectedAmount === "number" ? { expectedAmount: edits.expectedAmount } : {}),
            ...(typeof edits.dayOfMonthHint === "number" ? { dayOfMonthHint: edits.dayOfMonthHint } : {}),
          },
        });
      }
    }
    await resolveTodo(userId, id, "done");
    return NextResponse.json({ ok: true });
  }

  if (todo.type === "add_bill_hint") {
    if (body.action === "add") {
      await prisma.recurringBill.create({
        data: {
          userId,
          name: typeof body.name === "string" ? body.name : (payload.name as string) ?? "Bill",
          category: typeof body.category === "string" ? body.category : "Bills & Utilities",
          billType: typeof body.billType === "string" ? body.billType : (payload.billType as string) ?? "other",
          matchKeywords: Array.isArray(body.matchKeywords) ? body.matchKeywords : [],
          cadence: "monthly",
          expectedAmount: typeof body.expectedAmount === "number" ? body.expectedAmount : null,
          status: "active",
          source: "user_added",
        },
      });
    }
    await resolveTodo(userId, id, body.action === "add" ? "done" : "dismissed");
    return NextResponse.json({ ok: true });
  }

  if (todo.type === "confirm_merchants") {
    if (body.action === "fix" && Array.isArray(body.updates)) {
      for (const u of body.updates) {
        if (typeof u?.transactionId !== "string" || typeof u?.category !== "string") continue;
        const tx = await prisma.transaction.findFirst({ where: { id: u.transactionId, userId } });
        if (!tx) continue;
        await prisma.transaction.update({ where: { id: tx.id }, data: { category: u.category } });
        await learnFromCorrection(userId, tx.description, u.category);
      }
    } else if (body.action === "confirm") {
      // Upgrade this statement's ai_guess rules to a higher-confidence source.
      const statementId = payload.statementId as string | undefined;
      if (statementId) {
        const txs = await prisma.transaction.findMany({
          where: { userId, statementId }, select: { description: true, category: true },
        });
        const seen = new Set<string>();
        for (const t of txs) {
          if (!t.category || seen.has(t.description)) continue;
          seen.add(t.description);
          await learnFromCorrection(userId, t.description, t.category);
        }
      }
    }
    await resolveTodo(userId, id, "done");
    return NextResponse.json({ ok: true });
  }

  // missing_bill and any other -> resolve/dismiss
  await resolveTodo(userId, id, body.action === "dismiss" ? "dismissed" : "done");
  return NextResponse.json({ ok: true });
}
