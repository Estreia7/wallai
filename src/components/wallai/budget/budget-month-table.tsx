import { GlassCard } from "@/components/wallai/glass-card";
import type { BudgetCategoryDelta } from "@/lib/wallai/budget-data";

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

function DeltaCell({ delta, currency }: { delta: number; currency: string }) {
  if (delta === 0) return <span className="text-white/40">—</span>;
  const up = delta > 0;
  return (
    <span className={up ? "text-amber-300" : "text-emerald-300"}>
      {up ? "▲" : "▼"} {fmt(Math.abs(delta), currency)}
    </span>
  );
}

function Section({ title, rows, currency, accent }: { title: string; rows: BudgetCategoryDelta[]; currency: string; accent: string }) {
  return (
    <GlassCard>
      <h3 className={`mb-3 text-xs font-semibold uppercase tracking-wider ${accent}`}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-white/60">Nothing this month.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {rows.map((r) => (
            <li key={r.category} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-white/80">{r.category}</span>
              <span className="w-12 shrink-0 text-right text-white/40">{r.pct.toFixed(0)}%</span>
              <span className="w-24 shrink-0 text-right font-semibold text-white tabular-nums">{fmt(r.amount, currency)}</span>
              <span className="w-24 shrink-0 text-right text-xs tabular-nums"><DeltaCell delta={r.delta} currency={currency} /></span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

export function BudgetMonthTable({
  income,
  expenses,
  currency,
}: {
  income: BudgetCategoryDelta[];
  expenses: BudgetCategoryDelta[];
  currency: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Section title="Income" rows={income} currency={currency} accent="text-emerald-300" />
      <Section title="Expenses" rows={expenses} currency={currency} accent="text-red-300" />
    </div>
  );
}
