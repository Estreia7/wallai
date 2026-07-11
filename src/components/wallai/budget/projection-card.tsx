import { GlassCard } from "@/components/wallai/glass-card";
import type { Projection } from "@/lib/wallai/budget-projection";

function fmt(v: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

export function ProjectionCard({ projection, currency }: { projection: Projection; currency: string }) {
  const p = projection;
  const items = [
    { label: "Projected income", value: p.projectedIncome, tone: "text-emerald-300" },
    { label: "Projected expenses", value: p.projectedExpense, tone: "text-red-300" },
    { label: "Projected net", value: p.projectedNet, tone: p.projectedNet >= 0 ? "text-emerald-300" : "text-red-300" },
  ];
  return (
    <GlassCard>
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300">Full-year projection</h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/50">{it.label}</p>
            <p className={`mt-1 text-lg font-bold tabular-nums ${it.tone}`}>{fmt(it.value, currency)}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-white/50">
        {p.monthsElapsed} month{p.monthsElapsed === 1 ? "" : "s"} actual + {p.monthsLeft} projected
        {p.recurringBillsTotal > 0
          ? ` · remaining months floored at ${fmt(p.recurringBillsTotal, currency)}/mo of known recurring bills`
          : ""}
        .
      </p>
    </GlassCard>
  );
}
