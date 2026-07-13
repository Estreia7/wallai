import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import { getDashboardData } from "@/lib/wallai/dashboard-data";
import { NetWorthHero } from "@/components/wallai/dashboard/net-worth-hero";
import { StatCard } from "@/components/wallai/dashboard/stat-card";
import { NetWorthChart } from "@/components/wallai/dashboard/net-worth-chart";
import { IncomeExpensesChart } from "@/components/wallai/dashboard/income-expenses-chart";
import { AllocationDonut } from "@/components/wallai/dashboard/allocation-donut";
import { TipCard } from "@/components/wallai/dashboard/tip-card";
import { RecentTransactions } from "@/components/wallai/dashboard/recent-transactions";
import { TodosCard } from "@/components/wallai/dashboard/todos-card";
import { DashboardEmptyState } from "@/components/wallai/dashboard/empty-state";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatCryptoSubtext(
  pnlEur: number,
  pnlPct: number | null,
  currency: string,
): string {
  const sign = pnlEur >= 0 ? "+" : "";
  const amt = new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(pnlEur);
  const pct = pnlPct !== null ? ` (${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%)` : "";
  return `${sign}${amt}${pct}`;
}

function DashboardHeader({ name }: { name: string | null }) {
  const displayName = name?.split(" ")[0] ?? "there";
  const initial = (name ?? "?").charAt(0).toUpperCase();
  const monthYear = new Intl.DateTimeFormat("en-IE", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="mb-6 flex items-start justify-between gap-3 sm:mb-8 sm:items-center">
      <div className="min-w-0 flex-1">
        <h2 className="section-title truncate">
          Good morning, {displayName}
        </h2>
        <p className="lead mt-1 text-xs sm:text-sm">
          Here&apos;s your financial overview
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50 sm:block sm:px-4 sm:py-2 sm:text-sm">
          {monthYear}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 text-xs font-bold text-[#0A0E1A] sm:h-10 sm:w-10 sm:text-sm">
          {initial}
        </div>
      </div>
    </div>
  );
}

function DashboardErrorCard({ message }: { message: string }) {
  return (
    <GlassCard>
      <p className="text-sm font-semibold text-red-400">
        Could not load dashboard
      </p>
      <p className="mt-2 text-xs text-white/50 sm:text-sm">{message}</p>
      <a
        href="/dashboard"
        className="mt-4 inline-block text-xs text-emerald-400 hover:text-emerald-300 sm:text-sm"
      >
        Retry
      </a>
    </GlassCard>
  );
}

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const userName = session.user.name ?? null;

  let data;
  try {
    data = await getDashboardData(userId);
  } catch (err) {
    console.error("[wallai/dashboard] getDashboardData failed", err);
    return (
      <>
        <DashboardHeader name={userName} />
        <DashboardErrorCard message="Something went wrong loading your dashboard." />
      </>
    );
  }

  if (!data.hasAnyData) {
    return (
      <>
        <DashboardHeader name={data.user.name} />
        <DashboardEmptyState />
      </>
    );
  }

  return (
    <>
      <DashboardHeader name={data.user.name} />

      <NetWorthHero netWorth={data.netWorth} freshness={data.freshness} />

      {data.todos.length > 0 && (
        <div className="mb-4 sm:mb-6">
          <TodosCard initial={data.todos} />
        </div>
      )}

      {/* Stat cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total Cash"
          value={formatCurrency(data.stats.cash.value, data.netWorth.currency)}
          subtext={`${data.stats.cash.accountCount} account${
            data.stats.cash.accountCount === 1 ? "" : "s"
          }`}
          gradient="from-emerald-500/20 to-emerald-500/5"
          configured
          warning={
            data.hasNonPrimaryCurrencyAccount
              ? `Non-${data.netWorth.currency} account detected`
              : null
          }
        />
        <StatCard
          label="Crypto"
          value={formatCurrency(data.stats.crypto.value, data.netWorth.currency)}
          subtext={
            data.stats.crypto.configured
              ? formatCryptoSubtext(
                  data.stats.crypto.pnlEur,
                  data.stats.crypto.pnlPct,
                  data.netWorth.currency,
                )
              : null
          }
          gradient="from-cyan-500/20 to-cyan-500/5"
          configured={data.stats.crypto.configured}
        />
        <StatCard
          label="Property"
          value={formatCurrency(data.stats.propertyEq.value, data.netWorth.currency)}
          gradient="from-violet-500/20 to-violet-500/5"
          configured={data.stats.propertyEq.configured}
        />
        <StatCard
          label="Total Debt"
          value={formatCurrency(data.stats.debt.value, data.netWorth.currency)}
          subtext={
            data.stats.debt.configured
              ? `${data.stats.debt.accountCount} account${
                  data.stats.debt.accountCount === 1 ? "" : "s"
                }`
              : null
          }
          gradient="from-amber-500/20 to-amber-500/5"
          configured={data.stats.debt.configured}
        />
      </div>

      {/* Row 2: net worth trend + allocation donut */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-3">
        <NetWorthChart data={data.netWorthTrend} currency={data.netWorth.currency} />
        <AllocationDonut data={data.allocation} currency={data.netWorth.currency} />
      </div>

      {/* Row 3: income vs expenses + tip */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 xl:grid-cols-3">
        <IncomeExpensesChart
          data={data.incomeVsExpenses}
          currency={data.netWorth.currency}
        />
        <TipCard tip={data.tip} />
      </div>

      {/* Row 4: recent transactions */}
      <RecentTransactions transactions={data.recentTransactions} />
    </>
  );
}
