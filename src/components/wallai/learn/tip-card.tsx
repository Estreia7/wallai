import { GlassCard } from "@/components/wallai/glass-card";

type Tip = {
  id: string;
  content: string;
  type: string;
  author: string | null;
  category: string | null;
};

export function TipCard({ tip }: { tip: Tip }) {
  const isQuote = tip.type === "quote";
  return (
    <GlassCard className="relative">
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
            isQuote
              ? "bg-cyan-500/10 text-cyan-300"
              : "bg-emerald-500/10 text-emerald-300"
          }`}
        >
          {isQuote ? "Quote" : "Tip"}
        </span>
        {tip.category && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
            {tip.category}
          </span>
        )}
      </div>
      <p className="text-sm leading-relaxed text-white/90">
        {isQuote && <span className="text-cyan-400/60">&ldquo;</span>}
        {tip.content}
        {isQuote && <span className="text-cyan-400/60">&rdquo;</span>}
      </p>
      {tip.author && (
        <p className="mt-2 text-[11px] text-white/70">— {tip.author}</p>
      )}
    </GlassCard>
  );
}
