import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import {
  listBudgetYears,
  getBudgetYear,
  getBudgetMonth,
} from "@/lib/wallai/budget-data";
import { BudgetControls } from "@/components/wallai/budget/budget-controls";
import { BudgetMatrixTable } from "@/components/wallai/budget/budget-matrix-table";
import { BudgetMonthTable } from "@/components/wallai/budget/budget-month-table";
import { ProjectionCard } from "@/components/wallai/budget/projection-card";
import { BudgetYearChart } from "@/components/wallai/budget/budget-year-chart";
import { BudgetMonthChart } from "@/components/wallai/budget/budget-month-chart";
import { BudgetFlowChart } from "@/components/wallai/budget/budget-flow-chart";

export const dynamic = "force-dynamic";

function fmtCur(v: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <GlassCard>
      <p className="kicker">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums sm:text-xl ${tone ?? "text-white"}`}>{value}</p>
    </GlassCard>
  );
}

async function YearView({ userId, year }: { userId: string; year: number }) {
  const data = await getBudgetYear(userId, year);
  if (!data.hasData) {
    return (
      <GlassCard>
        <div className="py-10 text-center">
          <p className="text-sm text-white/60">No transactions in {year}.</p>
          <p className="mt-1 text-xs text-white/70">Import a bank statement to see the breakdown.</p>
        </div>
      </GlassCard>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Tile label="Income" value={fmtCur(data.totals.income, data.currency)} tone="text-emerald-300" />
        <Tile label="Expenses" value={fmtCur(data.totals.expenses, data.currency)} tone="text-red-300" />
        <Tile label="Net" value={fmtCur(data.totals.net, data.currency)} tone={data.totals.net >= 0 ? "text-emerald-300" : "text-red-300"} />
        <Tile label="Savings rate" value={data.totals.savingsRate === null ? "—" : `${data.totals.savingsRate.toFixed(0)}%`} />
        {data.projection && (
          <Tile label="Proj. year net" value={fmtCur(data.projection.projectedNet, data.currency)} tone="text-cyan-300" />
        )}
      </div>

      {data.projection && <ProjectionCard projection={data.projection} currency={data.currency} />}

      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Income vs expenses — {year}</h3>
        <BudgetYearChart months={data.months} currency={data.currency} />
      </GlassCard>

      <GlassCard>
        <h3 className="mb-1 text-xs font-semibold text-white/70 sm:text-sm">Money flow — {year}</h3>
        <p className="mb-3 text-[11px] text-white/50">Where income comes from and where it goes, as a share of total income.</p>
        <BudgetFlowChart
          income={data.income.map((r) => ({ category: r.category, amount: r.total }))}
          expenses={data.expenses.map((r) => ({ category: r.category, amount: r.total }))}
          net={data.totals.net}
          currency={data.currency}
        />
      </GlassCard>

      <BudgetMatrixTable income={data.income} expenses={data.expenses} months={data.months} currency={data.currency} />
    </div>
  );
}

async function MonthView({ userId, year, month }: { userId: string; year: number; month: number }) {
  const data = await getBudgetMonth(userId, year, month);
  const monthName = new Intl.DateTimeFormat("en-IE", { month: "long" }).format(new Date(Date.UTC(year, month - 1, 1)));
  if (!data.hasData) {
    return (
      <GlassCard>
        <div className="py-10 text-center">
          <p className="text-sm text-white/60">No transactions in {monthName} {year}.</p>
        </div>
      </GlassCard>
    );
  }
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Tile label="Income" value={fmtCur(data.totals.income, data.currency)} tone="text-emerald-300" />
        <Tile label="Expenses" value={fmtCur(data.totals.expenses, data.currency)} tone="text-red-300" />
        <Tile label="Net" value={fmtCur(data.totals.net, data.currency)} tone={data.totals.net >= 0 ? "text-emerald-300" : "text-red-300"} />
        <Tile label="Savings rate" value={data.totals.savingsRate === null ? "—" : `${data.totals.savingsRate.toFixed(0)}%`} />
      </div>

      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:text-sm">Top expenses — {monthName} {year}</h3>
        <BudgetMonthChart data={data.expenses.map((e) => ({ category: e.category, amount: e.amount }))} currency={data.currency} />
      </GlassCard>

      <GlassCard>
        <h3 className="mb-1 text-xs font-semibold text-white/70 sm:text-sm">Money flow — {monthName} {year}</h3>
        <p className="mb-3 text-[11px] text-white/50">Where income comes from and where it goes, as a share of total income.</p>
        <BudgetFlowChart
          income={data.income.map((e) => ({ category: e.category, amount: e.amount }))}
          expenses={data.expenses.map((e) => ({ category: e.category, amount: e.amount }))}
          net={data.totals.net}
          currency={data.currency}
        />
      </GlassCard>

      <BudgetMonthTable income={data.income} expenses={data.expenses} currency={data.currency} />
    </div>
  );
}

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; view?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const sp = await searchParams;
  const years = await listBudgetYears(userId);
  const now = new Date();
  const year = years.includes(Number(sp.year)) ? Number(sp.year) : years[0] ?? now.getUTCFullYear();
  const view = sp.view === "month" ? "month" : "year";
  const monthRaw = Number(sp.month);
  const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getUTCMonth() + 1;

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Budget</h2>
          <p className="mt-0.5 text-xs text-white/70 sm:text-sm">In-depth income &amp; expense control</p>
        </div>
        <BudgetControls years={years} year={year} view={view} month={month} />
      </div>

      {view === "year" ? (
        <YearView userId={userId} year={year} />
      ) : (
        <MonthView userId={userId} year={year} month={month} />
      )}
    </div>
  );
}
