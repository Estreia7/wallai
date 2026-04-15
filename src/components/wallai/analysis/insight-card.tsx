"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type InsightState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; text: string; cached: boolean; generatedAt?: string }
  | { kind: "error"; message: string };

export function InsightCard({ period }: { period: number }) {
  const [state, setState] = useState<InsightState>({ kind: "idle" });

  async function load(force: boolean) {
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/wallai/analysis/insights?period=${period}`,
        { method: force ? "POST" : "GET" },
      );
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? "Failed to generate insight" });
        return;
      }
      setState({
        kind: "ready",
        text: data.text,
        cached: Boolean(data.cached),
        generatedAt: data.generatedAt,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  // Try cache on mount; never force. Re-run when period changes.
  useEffect(() => {
    load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  return (
    <GlassCard className="border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.04] to-emerald-500/[0.02]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-cyan-300">
            AI insight
          </span>
          {state.kind === "ready" && state.cached && (
            <span className="text-[10px] text-white/30">cached</span>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={state.kind === "loading"}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/10 disabled:opacity-40"
        >
          {state.kind === "loading" ? "Thinking…" : "Regenerate"}
        </button>
      </div>

      {state.kind === "loading" && (
        <div className="space-y-2">
          <div className="h-3 w-11/12 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-10/12 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-9/12 animate-pulse rounded bg-white/5" />
        </div>
      )}

      {state.kind === "ready" && (
        <div className="space-y-2 text-sm leading-relaxed text-white/85">
          {state.text.split(/\n\n+/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-2">
          <p className="text-xs text-red-400">⚠ {state.message}</p>
          {state.message.toLowerCase().includes("api key") && (
            <a
              href="/settings"
              className="inline-block text-xs text-emerald-400 hover:text-emerald-300"
            >
              Add your API key in Settings →
            </a>
          )}
        </div>
      )}
    </GlassCard>
  );
}
