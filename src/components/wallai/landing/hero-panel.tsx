"use client";

import { CountUp } from "./count-up";

/**
 * The hero's signature element: a floating "command card" that mimics the real
 * Wallai dashboard — a net-worth readout that counts up on load, a sparkline
 * drawn from a fixed 12-month series, and category chips echoing the app's
 * actual surfaces. It is deliberately a slice of the product, not an abstract
 * illustration: the most characteristic thing in Wallai's world is a number
 * that moves.
 */

// A believable 12-point net-worth curve (thousands). Fixed — no randomness so
// the SVG path is identical every render (Math.random is unavailable here too).
const SERIES = [58, 61, 60, 64, 69, 72, 71, 78, 83, 88, 94, 102];

function Sparkline() {
  const w = 320;
  const h = 84;
  const min = Math.min(...SERIES);
  const max = Math.max(...SERIES);
  const pts = SERIES.map((v, i) => {
    const x = (i / (SERIES.length - 1)) * w;
    const y = h - ((v - min) / (max - min)) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-4 w-full"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spark-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#spark-fill)" />
      <polyline
        points={line}
        fill="none"
        stroke="url(#spark-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="4" fill="#22d3ee" />
      <circle cx={lastX} cy={lastY} r="8" fill="#22d3ee" opacity="0.25" />
    </svg>
  );
}

const CHIPS = [
  { label: "Budget", value: "on track", tone: "emerald" },
  { label: "Crypto", value: "+12.4%", tone: "cyan" },
  { label: "Debts", value: "-€1.2k", tone: "amber" },
];

const toneClass: Record<string, string> = {
  emerald: "text-emerald-300",
  cyan: "text-cyan-300",
  amber: "text-amber-300",
};

export function HeroPanel() {
  return (
    <div className="relative">
      {/* soft glow behind the card */}
      <div
        className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent blur-2xl"
        aria-hidden
      />
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="flex items-center justify-between">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.15em] text-white/50">
            Net worth
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            +8.7% this month
          </span>
        </div>

        <div className="mt-2 flex items-end gap-2">
          <CountUp
            value={102480}
            prefix="€"
            className="text-4xl font-bold tracking-tight text-white sm:text-5xl"
          />
        </div>

        <Sparkline />

        <div className="mt-5 grid grid-cols-3 gap-2">
          {CHIPS.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
            >
              <div className="text-[0.65rem] uppercase tracking-wide text-white/40">
                {c.label}
              </div>
              <div className={`mt-0.5 text-sm font-semibold ${toneClass[c.tone]}`}>
                {c.value}
              </div>
            </div>
          ))}
        </div>

        {/* AI insight strip — the product's differentiator, shown, not told */}
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-cyan-400/15 bg-gradient-to-r from-cyan-500/[0.07] to-emerald-500/[0.07] px-4 py-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-[0.7rem] font-bold text-[#0A0E1A]">
            AI
          </div>
          <p className="text-xs leading-relaxed text-white/70">
            You spent 22% less on dining this month. At this pace you&apos;ll hit
            your savings goal <span className="text-white">6 weeks early</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
