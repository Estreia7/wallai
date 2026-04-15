"use client";

import { useEffect, useState, useCallback } from "react";
import { GlassCard } from "./glass-card";
import { ALL_CATEGORIES } from "@/lib/wallai/categories";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  bankAccount?: { id: string; name: string; currency: string };
};

const COMMON_CATEGORIES = ALL_CATEGORIES;

export function TransactionList({
  bankAccountId,
  refreshToken,
}: {
  bankAccountId: string | null;
  refreshToken: number;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (bankAccountId) params.set("bankAccountId", bankAccountId);
    if (categoryFilter) params.set("category", categoryFilter);

    const res = await fetch(`/api/wallai/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setLoading(false);
  }, [bankAccountId, categoryFilter]);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  async function updateCategory(id: string, category: string) {
    await fetch(`/api/wallai/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category || null }),
    });
    setTransactions((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category: category || null } : t))
    );
  }

  async function deleteTransaction(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/wallai/transactions/${id}`, { method: "DELETE" });
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  async function autoCategorize() {
    setCategorizing(true);
    setCategorizeError(null);
    try {
      const res = await fetch("/api/wallai/transactions/categorize", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setCategorizeError(data.error ?? "Failed to categorize");
        return;
      }
      await load();
    } catch (err) {
      setCategorizeError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCategorizing(false);
    }
  }

  const uncategorizedCount = transactions.filter((t) => !t.category).length;

  return (
    <GlassCard>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-sm font-semibold text-white">Transactions</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={autoCategorize}
            disabled={categorizing || uncategorizedCount === 0}
            className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {categorizing
              ? "Categorizing…"
              : uncategorizedCount > 0
                ? `Auto-categorize (${uncategorizedCount})`
                : "All categorized"}
          </button>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 outline-none focus:border-white/20"
          >
            <option value="">All categories</option>
            {COMMON_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categorizeError && (
        <p className="mb-3 text-xs text-red-400">⚠ {categorizeError}</p>
      )}

      {loading ? (
        <p className="text-xs text-white/40">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="text-xs text-white/40">
          {bankAccountId ? "No transactions for this account yet." : "Select an account to view transactions."}
        </p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="group flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                  {tx.description}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/30">
                  <span>{new Date(tx.date).toLocaleDateString()}</span>
                  {tx.bankAccount && <span className="truncate">• {tx.bankAccount.name}</span>}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
                <select
                  value={tx.category || ""}
                  onChange={(e) => updateCategory(tx.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-white/70 outline-none focus:border-white/20 sm:w-28 sm:flex-none"
                >
                  <option value="">Uncategorized</option>
                  {COMMON_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <p
                  className={`shrink-0 text-right text-xs font-semibold tabular-nums sm:text-sm ${
                    tx.amount >= 0 ? "text-emerald-400" : "text-white"
                  }`}
                >
                  {tx.amount >= 0 ? "+" : ""}
                  {tx.amount.toFixed(2)} {tx.currency}
                </p>

                <button
                  onClick={() => deleteTransaction(tx.id)}
                  className="shrink-0 rounded p-1.5 text-white/40 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:text-white/20 sm:opacity-0 sm:group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <svg className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
