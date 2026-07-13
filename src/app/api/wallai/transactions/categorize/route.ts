import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiKeyNotConfiguredError } from "@/lib/anthropic";
import { matchCategory, learnFromCategorization } from "@/lib/wallai/knowledge/matcher";
import { enrichUnknownMerchants } from "@/lib/wallai/knowledge/categorize";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  const uncategorized = await prisma.transaction.findMany({
    where: { userId, category: null },
    select: { id: true, description: true, amount: true },
    orderBy: { date: "asc" },
  });
  if (uncategorized.length === 0) return NextResponse.json({ categorized: 0, total: 0 });

  try {
    const { hits, misses } = await matchCategory(userId, uncategorized);
    const byId = new Map(uncategorized.map((m) => [m.id, m]));

    for (const h of hits) {
      await prisma.transaction.update({ where: { id: h.txId }, data: { category: h.category } });
    }

    // Persist seed-dictionary matches as learned rules so repeat merchants
    // resolve instantly next time and feed recurring-bill detection.
    const seedLearn: { description: string; category: string; displayName?: string }[] = [];
    for (const h of hits) {
      if (h.via !== "seed") continue;
      const tx = byId.get(h.txId);
      if (tx) seedLearn.push({ description: tx.description, category: h.category, displayName: h.displayName });
    }
    if (seedLearn.length > 0) await learnFromCategorization(userId, seedLearn, "seed");

    let aiCount = 0;
    if (misses.length > 0) {
      const enriched = await enrichUnknownMerchants(userId, misses);
      const learn: { description: string; category: string; displayName?: string }[] = [];
      for (const e of enriched) {
        // Low-confidence guesses leave the transaction uncategorized for review
        // instead of forcing it into a wrong/"Other" bucket.
        if (!e.category) continue;
        await prisma.transaction.update({ where: { id: e.id }, data: { category: e.category } });
        const tx = byId.get(e.id);
        if (tx) learn.push({ description: tx.description, category: e.category, displayName: e.displayName });
        aiCount++;
      }
      await learnFromCategorization(userId, learn, "ai_guess");
    }

    return NextResponse.json({ categorized: hits.length + aiCount, total: uncategorized.length });
  } catch (error) {
    if (error instanceof ApiKeyNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[categorize] error:", error);
    return NextResponse.json({ error: "Failed to categorize transactions." }, { status: 500 });
  }
}
