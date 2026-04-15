import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadLearnPayload } from "@/lib/wallai/learn/recommendations";
import { LearnClient } from "@/components/wallai/learn/learn-client";
import { TipCard } from "@/components/wallai/learn/tip-card";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["mindset", "saving", "investing", "budgeting", "debt"] as const;

function categoryLabel(c: string | null): string {
  if (!c) return "General";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export default async function LearnPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [payload, tips] = await Promise.all([
    loadLearnPayload(session.user.id),
    prisma.financialTip.findMany({ orderBy: { id: "asc" } }),
  ]);

  const byCategory = new Map<string, typeof tips>();
  for (const t of tips) {
    const key = t.category ?? "general";
    const list = byCategory.get(key) ?? [];
    list.push(t);
    byCategory.set(key, list);
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter(
      (k) => !(CATEGORY_ORDER as readonly string[]).includes(k),
    ),
  ];

  return (
    <div>
      <LearnClient initial={payload} />

      {tips.length > 0 && (
        <section className="mt-10">
          <h3 className="mb-3 text-sm font-semibold text-white/80 sm:mb-4">Tips &amp; Quotes</h3>
          <div className="space-y-6">
            {orderedKeys.map((key) => {
              const list = byCategory.get(key) ?? [];
              return (
                <div key={key}>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {categoryLabel(key)}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((tip) => (
                      <TipCard key={tip.id} tip={tip} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
