"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const OPTIONS: Array<{ value: 3 | 6 | 12; label: string }> = [
  { value: 3, label: "3M" },
  { value: 6, label: "6M" },
  { value: 12, label: "12M" },
];

export function PeriodTabs({ active }: { active: 3 | 6 | 12 }) {
  const pathname = usePathname();
  const params = useSearchParams();

  function hrefFor(value: number) {
    const next = new URLSearchParams(params);
    next.set("period", String(value));
    return `${pathname}?${next.toString()}`;
  }

  return (
    <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
      {OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={hrefFor(opt.value)}
          scroll={false}
          className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:py-1.5 ${
            active === opt.value
              ? "bg-white/10 text-white"
              : "text-white/50 hover:text-white"
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
