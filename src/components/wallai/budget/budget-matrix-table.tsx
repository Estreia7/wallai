import { GlassCard } from "@/components/wallai/glass-card";
import type { BudgetCategoryRow, BudgetMonthTotals } from "@/lib/wallai/budget-data";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmt(v: number, currency: string): string {
  if (v === 0) return "—";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function BudgetMatrixTable({
  income,
  expenses,
  months,
  currency,
}: {
  income: BudgetCategoryRow[];
  expenses: BudgetCategoryRow[];
  months: BudgetMonthTotals[];
  currency: string;
}) {
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpenses = months.reduce((s, m) => s + m.expenses, 0);

  const Cell = ({ v, strong }: { v: number; strong?: boolean }) => (
    <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${strong ? "font-semibold text-white" : "text-white/70"}`}>
      {fmt(v, currency)}
    </td>
  );

  const section = (label: string, rows: BudgetCategoryRow[], sumRow: number[], sumTotal: number, accent: string) => (
    <>
      <tr>
        <td colSpan={14} className={`px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider ${accent}`}>{label}</td>
      </tr>
      {rows.map((r) => (
        <tr key={label + r.category} className="border-t border-white/5">
          <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0A0E1A] px-3 py-2 text-white/80">{r.category}</td>
          {r.monthly.map((v, i) => <Cell key={i} v={v} />)}
          <Cell v={r.total} strong />
        </tr>
      ))}
      <tr className="border-t border-white/10">
        <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0A0E1A] px-3 py-2 text-xs font-semibold text-white/60">Total {label}</td>
        {sumRow.map((v, i) => <Cell key={i} v={v} strong />)}
        <Cell v={sumTotal} strong />
      </tr>
    </>
  );

  return (
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-white/40">
              <th className="sticky left-0 z-10 bg-[#0A0E1A] px-3 py-2 text-left">Category</th>
              {MONTHS.map((m) => <th key={m} className="px-3 py-2 text-right">{m}</th>)}
              <th className="px-3 py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {section("Income", income, months.map((m) => m.income), totalIncome, "text-emerald-300")}
            {section("Expenses", expenses, months.map((m) => m.expenses), totalExpenses, "text-red-300")}
            <tr className="border-t-2 border-white/20">
              <td className="sticky left-0 z-10 whitespace-nowrap bg-[#0A0E1A] px-3 py-2 font-bold text-white">Net</td>
              {months.map((m, i) => (
                <td key={i} className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${m.net >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {fmt(m.net, currency)}
                </td>
              ))}
              <td className={`whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums ${totalIncome - totalExpenses >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {fmt(totalIncome - totalExpenses, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
