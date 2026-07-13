import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { GlassCard } from "@/components/wallai/glass-card";
import {
  getAnalysisData,
  type AnalysisPeriod,
} from "@/lib/wallai/analysis-data";
import { PeriodTabs } from "@/components/wallai/analysis/period-tabs";
import { KpiRow } from "@/components/wallai/analysis/kpi-row";
import { MonthlyFlowChart } from "@/components/wallai/analysis/monthly-flow-chart";
import { CategoryBreakdownCard } from "@/components/wallai/analysis/category-breakdown";
import { TopMerchantsCard } from "@/components/wallai/analysis/top-merchants";
import { InsightCard } from "@/components/wallai/analysis/insight-card";

export const dynamic = "force-dynamic";

function parsePeriod(raw: string | string[] | undefined): AnalysisPeriod {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  if (n === 3 || n === 6 || n === 12) return n;
  return 6;
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { period: rawPeriod } = await searchParams;
  const period = parsePeriod(rawPeriod);

  const data = await getAnalysisData(session.user.id, period);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="section-title">Analysis</h2>
          <p className="mt-0.5 text-xs text-white/70 sm:text-sm">
            Spending and income insights
          </p>
        </div>
        <PeriodTabs active={period} />
      </div>

      {!data.hasData ? (
        <GlassCard>
          <div className="py-10 text-center">
            <p className="text-sm text-white/60">No transactions in the last {period} months.</p>
            <p className="mt-1 text-xs text-white/70">
              Import a bank statement to see spending analysis.
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          <KpiRow
            income={data.totals.income}
            expenses={data.totals.expenses}
            net={data.totals.net}
            savingsRate={data.totals.savingsRate}
            currency={data.currency}
          />

          <InsightCard period={period} />

          <MonthlyFlowChart data={data.monthly} currency={data.currency} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CategoryBreakdownCard
              title="Expenses by category"
              items={data.expensesByCategory}
              currency={data.currency}
              accent="red"
              emptyLabel="No expenses in this period."
            />
            <CategoryBreakdownCard
              title="Income by category"
              items={data.incomeByCategory}
              currency={data.currency}
              accent="emerald"
              emptyLabel="No income in this period."
            />
          </div>

          <TopMerchantsCard merchants={data.topMerchants} currency={data.currency} />
        </div>
      )}
    </div>
  );
}
