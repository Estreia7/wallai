"use client";

import { useRouter } from "next/navigation";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function BudgetControls({
  years,
  year,
  view,
  month,
}: {
  years: number[];
  year: number;
  view: "year" | "month";
  month: number;
}) {
  const router = useRouter();
  function go(next: { year?: number; view?: "year" | "month"; month?: number }) {
    const y = next.year ?? year;
    const v = next.view ?? view;
    const m = next.month ?? month;
    const params = new URLSearchParams({ year: String(y), view: v });
    if (v === "month") params.set("month", String(m));
    router.push(`/budget?${params.toString()}`);
  }

  const selectClass =
    "min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-emerald-400/50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {(["year", "month"] as const).map((v) => (
          <button
            key={v}
            onClick={() => go({ view: v })}
            className={`min-h-[36px] rounded-lg px-3 text-sm font-medium capitalize transition ${
              view === v ? "bg-emerald-400/20 text-white" : "text-white/60"
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <select className={selectClass} value={year} onChange={(e) => go({ year: Number(e.target.value) })}>
        {years.map((y) => (
          <option key={y} value={y} className="bg-[#0A0E1A]">{y}</option>
        ))}
      </select>
      {view === "month" && (
        <select className={selectClass} value={month} onChange={(e) => go({ month: Number(e.target.value) })}>
          {MONTHS.map((label, i) => (
            <option key={label} value={i + 1} className="bg-[#0A0E1A]">{label}</option>
          ))}
        </select>
      )}
    </div>
  );
}
