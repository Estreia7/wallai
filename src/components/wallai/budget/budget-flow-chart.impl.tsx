"use client";

import { useMemo, useState, useId } from "react";
import { buildSankeyLayout, type SankeyInput } from "@/lib/wallai/sankey-layout";

type Props = SankeyInput & { currency: string };

const VB_W = 1000;
const VB_H = 460;
const PAD_Y = 12;
const NODE_W = 14;
// x positions of the three columns (left edge of each node band)
const COL_X = { left: 150, middle: 493, right: 836 };

const TONE = {
  income: { fill: "#34d399", flow: "rgba(52,211,153,0.28)", flowHi: "rgba(52,211,153,0.5)" },
  hub: { fill: "#38bdf8", flow: "rgba(56,189,248,0.28)", flowHi: "rgba(56,189,248,0.5)" },
  expense: { fill: "#f87171", flow: "rgba(248,113,113,0.26)", flowHi: "rgba(248,113,113,0.5)" },
  savings: { fill: "#2dd4bf", flow: "rgba(45,212,191,0.3)", flowHi: "rgba(45,212,191,0.55)" },
} as const;

function fmt(currency: string) {
  return (v: number) =>
    new Intl.NumberFormat("en-IE", { style: "currency", currency, maximumFractionDigits: 0 }).format(v);
}

// vertical [0,1] -> pixel y within the padded plot area
const py = (t: number) => PAD_Y + t * (VB_H - PAD_Y * 2);

// A smooth left→right ribbon between two vertical bands.
function ribbon(x0: number, x1: number, sy0: number, sy1: number, ty0: number, ty1: number): string {
  const cx = (x0 + x1) / 2;
  return [
    `M${x0},${sy0}`,
    `C${cx},${sy0} ${cx},${ty0} ${x1},${ty0}`,
    `L${x1},${ty1}`,
    `C${cx},${ty1} ${cx},${sy1} ${x0},${sy1}`,
    "Z",
  ].join(" ");
}

export function BudgetFlowChart({ income, expenses, net, currency }: Props) {
  const layout = useMemo(() => buildSankeyLayout({ income, expenses, net }), [income, expenses, net]);
  const [hover, setHover] = useState<string | null>(null);
  const gradId = useId();
  const f = fmt(currency);

  if (layout.total <= 0) {
    return <div className="py-10 text-center text-sm text-white/50">No income to chart for this period.</div>;
  }

  const nodeById = new Map(layout.nodes.map((n) => [n.id, n]));
  const xOf = (side: string) => (side === "left" ? COL_X.left : side === "middle" ? COL_X.middle : COL_X.right);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Money flow: income to expenses">
        <defs>
          <linearGradient id={`${gradId}-in`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor={TONE.income.fill} stopOpacity="0.35" />
            <stop offset="100%" stopColor={TONE.hub.fill} stopOpacity="0.35" />
          </linearGradient>
        </defs>

        {/* links */}
        <g>
          {layout.links.map((k, i) => {
            const s = nodeById.get(k.source)!;
            const t = nodeById.get(k.target)!;
            const x0 = xOf(s.side) + (s.side === "middle" ? NODE_W : NODE_W);
            const x1 = xOf(t.side);
            const active = hover === null || hover === k.source || hover === k.target;
            const tone = TONE[k.tone];
            const d = ribbon(x0, x1, py(k.sy0), py(k.sy1), py(k.ty0), py(k.ty1));
            return (
              <path
                key={i}
                d={d}
                fill={k.tone === "income" ? `url(#${gradId}-in)` : tone.flow}
                style={{ opacity: active ? 1 : 0.15, transition: "opacity 150ms" }}
              >
                <title>{`${nodeById.get(k.target === "hub" ? k.source : k.target)!.label}: ${f(k.amount)} (${k.pct.toFixed(1)}%)`}</title>
              </path>
            );
          })}
        </g>

        {/* nodes + labels */}
        <g>
          {layout.nodes.map((n) => {
            const x = xOf(n.side);
            const y0 = py(n.y0);
            const y1 = py(n.y1);
            const h = Math.max(y1 - y0, 2);
            const tone = TONE[n.tone];
            const active = hover === null || hover === n.id;
            const labelLeft = n.side === "left";
            const labelX = labelLeft ? x - 10 : x + NODE_W + 10;
            const anchor = labelLeft ? "end" : "start";
            const midY = (y0 + y1) / 2;
            const showPct = h >= 16 || n.side === "middle";
            return (
              <g
                key={n.id}
                style={{ opacity: active ? 1 : 0.35, transition: "opacity 150ms", cursor: "default" }}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
              >
                <rect x={x} y={y0} width={NODE_W} height={h} rx={3} fill={tone.fill} />
                {n.side === "middle" ? (
                  <text x={x + NODE_W / 2} y={midY} textAnchor="middle" transform={`rotate(-90 ${x + NODE_W / 2} ${midY})`} className="fill-white" style={{ fontSize: 15, fontWeight: 700 }}>
                    {n.label} · {f(n.amount)}
                  </text>
                ) : (
                  <text x={labelX} textAnchor={anchor} className="fill-white/90" style={{ fontSize: 13 }}>
                    <tspan x={labelX} y={showPct ? midY - 4 : midY + 4} style={{ fontWeight: 600 }}>{n.label}</tspan>
                    {showPct && (
                      <tspan x={labelX} y={midY + 12} className="fill-white/55" style={{ fontSize: 11 }}>
                        {f(n.amount)} · {n.pct.toFixed(0)}%
                      </tspan>
                    )}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
