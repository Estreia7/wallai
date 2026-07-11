import Link from "next/link";
import { GlassCard } from "@/components/wallai/glass-card";
import { isIncome, type DashboardData } from "@/lib/wallai/dashboard-data";

type RecentTransactionsProps = {
  transactions: DashboardData["recentTransactions"];
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const d = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const diffDays = Math.round((today - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <GlassCard className="relative overflow-hidden">
      <div className="mb-3 flex items-center justify-between sm:mb-4">
        <h3 className="text-xs font-semibold text-white/70 sm:text-sm">
          Recent Transactions
        </h3>
        <Link
          href="/bank"
          className="text-[10px] text-emerald-400 hover:text-emerald-300 sm:text-xs"
        >
          View all
        </Link>
      </div>
      {transactions.length === 0 ? (
        <p className="py-4 text-center text-xs text-white/70 sm:text-sm">
          No transactions yet
        </p>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {transactions.map((tx) => {
            const income = isIncome(tx);
            const positiveIncome = income && tx.amount > 0;
            const fmt = new Intl.NumberFormat("en-IE", {
              style: "currency",
              currency: tx.currency,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
            return (
              <div
                key={tx.id}
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 transition-colors sm:px-4 sm:py-3 sm:hover:bg-white/5"
              >
                <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold sm:h-9 sm:w-9 ${
                      positiveIncome
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-white/5 text-white/50"
                    }`}
                  >
                    {tx.description.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                      {tx.description}
                    </p>
                    <p className="truncate text-[10px] text-white/50 sm:text-xs">
                      {tx.category ?? "Uncategorized"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={`text-xs font-semibold sm:text-sm ${
                      positiveIncome ? "text-emerald-400" : "text-white/80"
                    }`}
                  >
                    {positiveIncome ? "+" : ""}
                    {fmt.format(tx.amount)}
                  </p>
                  <p className="text-[10px] text-white/50 sm:text-xs">
                    {formatRelativeDate(tx.date)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
