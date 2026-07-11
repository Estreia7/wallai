import { GlassCard } from "@/components/wallai/glass-card";
import type { DashboardData } from "@/lib/wallai/dashboard-data";

type NetWorthHeroProps = {
  netWorth: DashboardData["netWorth"];
  freshness: DashboardData["freshness"];
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function relativeFromNow(date: Date | null): string {
  if (!date) return "no data yet";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months === 1) return "a month ago";
  return `${months} months ago`;
}

export function NetWorthHero({ netWorth, freshness }: NetWorthHeroProps) {
  const hasChange = netWorth.changeAbs !== null && netWorth.changePct !== null;
  const positive = (netWorth.changeAbs ?? 0) >= 0;

  return (
    <GlassCard className="mb-4 sm:mb-6">
      <p className="text-[10px] font-medium uppercase tracking-wider text-white/70 sm:text-xs">
        Net Worth
      </p>
      <p className="mt-1 text-3xl font-bold text-white sm:mt-2 sm:text-4xl xl:text-5xl">
        {formatCurrency(netWorth.total, netWorth.currency)}
      </p>
      {hasChange ? (
        <p
          className={`mt-1 text-xs font-medium sm:text-sm ${
            positive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {positive ? "+" : ""}
          {formatCurrency(netWorth.changeAbs!, netWorth.currency)}
          {" "}
          ({positive ? "+" : ""}
          {netWorth.changePct!.toFixed(1)}%) vs last month
        </p>
      ) : (
        <p className="mt-1 text-xs text-white/70 sm:text-sm">— vs last month</p>
      )}
      <p className="mt-2 text-[10px] text-white/70 sm:text-xs">
        Net worth as of {formatDate(netWorth.asOf)} • Bank data updated{" "}
        {relativeFromNow(freshness.bankLastUpdated)}
      </p>
    </GlassCard>
  );
}
