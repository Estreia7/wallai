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

export function TransactionList({
  bankAccountId,
  institutionId,
  refreshToken,
}: {
  bankAccountId: string | null;
  institutionId?: string | null;
  refreshToken: number;
}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categorizing, setCategorizing] = useState(false);
  const [categorizeError, setCategorizeError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([...ALL_CATEGORIES]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/wallai/categories")
      .then((r) => r.json())
      .then((d: { categories?: { name: string; archived?: boolean }[] }) => {
        if (cancelled || !d.categories) return;
        setCategories(d.categories.filter((c) => !c.archived).map((c) => c.name));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (bankAccountId) {
      params.set("bankAccountId", bankAccountId);
    } else if (institutionId) {
      params.set("institutionId", institutionId);
    }
    // "__review__" is a client-side filter (uncategorized + Other), so we fetch
    // everything and narrow below. Any real category filters server-side.
    if (categoryFilter && categoryFilter !== "__review__") params.set("category", categoryFilter);

    const res = await fetch(`/api/wallai/transactions?${params}`);
    const data = await res.json();
    setTransactions(data.transactions || []);
    setSelected(new Set());
    setLoading(false);
  }, [bankAccountId, institutionId, categoryFilter]);

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

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkAssign() {
    if (selected.size === 0 || !bulkCategory) return;
    setBulkBusy(true);
    try {
      await fetch("/api/wallai/transactions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selected], category: bulkCategory }),
      });
      await load();
      setBulkCategory("");
    } finally {
      setBulkBusy(false);
    }
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

  const needsReview = (t: Transaction) =>
    !t.category || t.category === "Other Expense" || t.category === "Other Income";
  const visible =
    categoryFilter === "__review__" ? transactions.filter(needsReview) : transactions;
  const allVisibleSelected = visible.length > 0 && visible.every((t) => selected.has(t.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (visible.every((t) => prev.has(t.id))) {
        const next = new Set(prev);
        visible.forEach((t) => next.delete(t.id));
        return next;
      }
      const next = new Set(prev);
      visible.forEach((t) => next.add(t.id));
      return next;
    });
  }

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
            <option value="" className="bg-[#0A0E1A] text-white">All categories</option>
            <option value="__review__" className="bg-[#0A0E1A] text-white">⚠ Needs review (Other / uncategorized)</option>
            {categories.map((c) => (
              <option key={c} value={c} className="bg-[#0A0E1A] text-white">
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {categorizeError && (
        <p className="mb-3 text-xs text-red-400">⚠ {categorizeError}</p>
      )}

      {/* Bulk assignment bar */}
      {visible.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs">
          <label className="flex cursor-pointer items-center gap-1.5 text-white/60">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 accent-emerald-400"
            />
            Select all
          </label>
          <span className="text-white/30">•</span>
          <span className="text-white/50">{selected.size} selected</span>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              disabled={selected.size === 0}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/80 outline-none focus:border-white/20 disabled:opacity-40"
            >
              <option value="" className="bg-[#0A0E1A] text-white">Assign category…</option>
              {categories.map((c) => (
                <option key={c} value={c} className="bg-[#0A0E1A] text-white">{c}</option>
              ))}
            </select>
            <button
              onClick={bulkAssign}
              disabled={selected.size === 0 || !bulkCategory || bulkBusy}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              {bulkBusy ? "Applying…" : "Apply"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-white/70">Loading...</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-white/70">
          {categoryFilter === "__review__"
            ? "Nothing needs review — everything is categorized. 🎉"
            : bankAccountId || institutionId
              ? "No transactions yet."
              : "Select an account or institution to view transactions."}
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((tx) => (
            <div
              key={tx.id}
              className={`group flex flex-col gap-2 rounded-xl border px-3 py-2.5 hover:bg-white/5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                selected.has(tx.id)
                  ? "border-emerald-400/40 bg-emerald-400/[0.05]"
                  : "border-white/5 bg-white/[0.02]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(tx.id)}
                onChange={() => toggleSelected(tx.id)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-emerald-400 sm:mt-0"
                aria-label="Select transaction"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/90 sm:text-sm">
                  {tx.description}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-white/50">
                  <span>{new Date(tx.date).toLocaleDateString()}</span>
                  {(institutionId || !bankAccountId) && tx.bankAccount && (
                    <span className="truncate rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] text-white/50">
                      {tx.bankAccount.name}
                    </span>
                  )}
                  {!institutionId && bankAccountId && tx.bankAccount && (
                    <span className="truncate">• {tx.bankAccount.name}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end sm:gap-3">
                <select
                  value={tx.category || ""}
                  onChange={(e) => updateCategory(tx.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-2 text-xs text-white/70 outline-none focus:border-white/20 sm:w-28 sm:flex-none sm:px-1.5 sm:py-1 sm:text-[10px]"
                >
                  <option value="" className="bg-[#0A0E1A] text-white">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c} value={c} className="bg-[#0A0E1A] text-white">
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
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors sm:h-7 sm:w-7 sm:text-white/20 sm:opacity-0 sm:group-hover:opacity-100 sm:hover:bg-red-500/10 sm:hover:text-red-400"
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
