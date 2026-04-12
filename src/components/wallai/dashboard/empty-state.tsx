import Link from "next/link";
import { GlassCard } from "@/components/wallai/glass-card";

export function DashboardEmptyState() {
  return (
    <GlassCard className="flex flex-col items-center justify-center py-12 text-center sm:py-20">
      <p className="text-2xl font-bold text-white sm:text-3xl">No data yet</p>
      <p className="mt-2 max-w-md text-sm text-white/50 sm:text-base">
        Upload your first bank statement to see your financial overview.
      </p>
      <Link
        href="/wallai/bank"
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 px-5 py-2.5 text-sm font-semibold text-[#0A0E1A] transition-opacity hover:opacity-90"
      >
        Go to Bank
      </Link>
    </GlassCard>
  );
}
