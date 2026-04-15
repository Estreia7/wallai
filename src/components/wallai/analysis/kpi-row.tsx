import { GlassCard } from "@/components/wallai/glass-card";

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

type Stat = {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "red" | "cyan" | "amber" | "neutral";
};

function StatCard({ stat }: { stat: Stat }) {
  const accentClass =
    stat.accent === "emerald"
      ? "text-emerald-400"
      : stat.accent === "red"
        ? "text-red-400"
        : stat.accent === "cyan"
          ? "text-cyan-400"
          : stat.accent === "amber"
            ? "text-amber-400"
            : "text-white";
  return (
    <GlassCard>
      <div className="text-[10px] uppercase tracking-wider text-white/40">{stat.label}</div>
      <div className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${accentClass}`}>
        {stat.value}
      </div>
      {stat.sub && <div className="mt-0.5 text-[10px] text-white/40">{stat.sub}</div>}
    </GlassCard>
  );
}

export function KpiRow({
  income,
  expenses,
  net,
  savingsRate,
  currency,
}: {
  income: number;
  expenses: number;
  net: number;
  savingsRate: number | null;
  currency: string;
}) {
  const stats: Stat[] = [
    { label: "Income", value: formatCurrency(income, currency), accent: "emerald" },
    { label: "Expenses", value: formatCurrency(expenses, currency), accent: "red" },
    {
      label: "Net",
      value: formatCurrency(net, currency),
      accent: net >= 0 ? "emerald" : "red",
    },
    {
      label: "Savings rate",
      value: savingsRate !== null ? `${savingsRate.toFixed(1)}%` : "—",
      accent:
        savingsRate === null
          ? "neutral"
          : savingsRate >= 20
            ? "emerald"
            : savingsRate >= 0
              ? "cyan"
              : "red",
      sub:
        savingsRate !== null && savingsRate < 0
          ? "Spending more than earning"
          : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {stats.map((s) => (
        <StatCard key={s.label} stat={s} />
      ))}
    </div>
  );
}
