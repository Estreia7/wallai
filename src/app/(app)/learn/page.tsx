import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/wallai/glass-card";
import { TipCard } from "@/components/wallai/learn/tip-card";
import { BookCard } from "@/components/wallai/learn/book-card";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["mindset", "saving", "investing", "budgeting", "debt"] as const;

function categoryLabel(c: string | null): string {
  if (!c) return "General";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export default async function LearnPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [tips, books] = await Promise.all([
    prisma.financialTip.findMany({ orderBy: { id: "asc" } }),
    prisma.book.findMany({ orderBy: [{ category: "asc" }, { title: "asc" }] }),
  ]);

  // Group tips by category, preserving a canonical order
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
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Learn</h2>
        <p className="mt-0.5 text-xs text-white/40 sm:text-sm">
          Financial wisdom, tips, and book recommendations
        </p>
      </div>

      {tips.length === 0 && books.length === 0 ? (
        <GlassCard>
          <p className="py-6 text-center text-sm text-white/50">
            No content available yet.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-8">
          {/* Tips sections */}
          {orderedKeys.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-white/80 sm:mb-4">
                Tips &amp; Quotes
              </h3>
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

          {/* Books shelf */}
          {books.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-white/80 sm:mb-4">
                Recommended reading
              </h3>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {books.map((book) => (
                  <BookCard key={book.id} book={book} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
