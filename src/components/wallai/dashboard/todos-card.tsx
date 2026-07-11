"use client";

import { useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type Todo = { id: string; type: string; title: string; body: string | null };

export function TodosCard({ initial }: { initial: Todo[] }) {
  const [todos, setTodos] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  if (todos.length === 0) return null;

  async function act(id: string, action: string) {
    setBusy(id);
    try {
      await fetch(`/api/wallai/todos/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setTodos((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setBusy(null);
    }
  }

  return (
    <GlassCard className="xl:col-span-2">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-white/70 sm:text-sm">To-dos</h3>
        <span className="rounded-full bg-emerald-500/20 px-2 text-[11px] font-bold text-emerald-300">
          {todos.length}
        </span>
      </div>
      <ul className="flex flex-col gap-2">
        {todos.map((t) => (
          <li key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-sm font-medium text-white">{t.title}</p>
            {t.body ? <p className="mt-0.5 text-xs text-white/60">{t.body}</p> : null}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => act(t.id, "confirm")}
                disabled={busy === t.id}
                className="min-h-[44px] flex-1 rounded-lg bg-emerald-500/90 px-3 text-sm font-semibold text-white transition active:brightness-95 disabled:opacity-60"
              >
                Confirm
              </button>
              <button
                onClick={() => act(t.id, "dismiss")}
                disabled={busy === t.id}
                className="min-h-[44px] rounded-lg border border-white/10 px-3 text-sm text-white/70 transition active:bg-white/5 disabled:opacity-60"
              >
                Dismiss
              </button>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
