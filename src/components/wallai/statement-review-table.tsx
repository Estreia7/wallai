"use client";

import { useMemo, useState } from "react";
import { bankAccountTypeLabel } from "@/lib/wallai/bank-account-types";

export type ReviewTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: string;
  category?: string | null;
};

export type ReviewDetectedAccount = {
  type: "savings" | "credit";
  name: string;
  balance: number;
  currency: string;
};

export type ReviewConfirmPayload = {
  transactions: ReviewTransaction[];
  detectedAccounts: ReviewDetectedAccount[];
};

type TransactionGroup = {
  monthKey: string;   // YYYY-MM
  label: string;      // e.g. "February 2026"
  indices: number[];  // indices into the rows array
  count: number;
  income: number;
  expenses: number;
};

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function StatementReviewTable({
  transactions,
  primaryBalance,
  detectedAccounts,
  onConfirm,
  onCancel,
  saving,
}: {
  transactions: ReviewTransaction[];
  primaryBalance: number | null;
  detectedAccounts: ReviewDetectedAccount[];
  onConfirm: (payload: ReviewConfirmPayload) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [rows, setRows] = useState<ReviewTransaction[]>(transactions);
  const [selectedDetected, setSelectedDetected] = useState<boolean[]>(
    () => detectedAccounts.map(() => true)
  );
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => {
    // Default: expand only the latest month
    if (transactions.length === 0) return new Set();
    const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1]?.date;
    return latest ? new Set([monthKey(latest)]) : new Set();
  });

  const groups = useMemo<TransactionGroup[]>(() => {
    const map = new Map<string, TransactionGroup>();
    rows.forEach((row, idx) => {
      const key = monthKey(row.date);
      let g = map.get(key);
      if (!g) {
        g = {
          monthKey: key,
          label: monthLabel(key),
          indices: [],
          count: 0,
          income: 0,
          expenses: 0,
        };
        map.set(key, g);
      }
      g.indices.push(idx);
      g.count += 1;
      if (row.amount >= 0) g.income += row.amount;
      else g.expenses += Math.abs(row.amount);
    });
    return Array.from(map.values()).sort((a, b) =>
      b.monthKey.localeCompare(a.monthKey)
    );
  }, [rows]);

  function updateRow(index: number, patch: Partial<ReviewTransaction>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleMonth(key: string) {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setExpandedMonths(new Set(groups.map((g) => g.monthKey)));
  }

  function collapseAll() {
    setExpandedMonths(new Set());
  }

  function toggleDetected(i: number) {
    setSelectedDetected((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function submit() {
    onConfirm({
      transactions: rows,
      detectedAccounts: detectedAccounts.filter((_, i) => selectedDetected[i]),
    });
  }

  const primaryCurrency = rows[0]?.currency ?? detectedAccounts[0]?.currency ?? "EUR";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-white/70">
          Found <span className="font-semibold text-white">{rows.length}</span> transactions across{" "}
          <span className="font-semibold text-white">{groups.length}</span>{" "}
          {groups.length === 1 ? "month" : "months"}.
        </p>
        {primaryBalance !== null && (
          <p className="text-xs text-white/50">
            Closing balance:{" "}
            <span className="font-semibold text-emerald-400">
              {fmt(primaryBalance, primaryCurrency)}
            </span>
          </p>
        )}
      </div>

      {detectedAccounts.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <p className="mb-2 text-xs font-semibold text-white/70">
            Also detected in this statement — create these accounts too?
          </p>
          <div className="space-y-1.5">
            {detectedAccounts.map((acc, i) => (
              <label
                key={`${acc.name}-${i}`}
                className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/[0.03]"
              >
                <input
                  type="checkbox"
                  checked={selectedDetected[i] ?? false}
                  onChange={() => toggleDetected(i)}
                  className="h-3.5 w-3.5 shrink-0 accent-emerald-400"
                />
                <span className="flex-1 text-white/80">{acc.name}</span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
                  {bankAccountTypeLabel(acc.type)}
                </span>
                <span
                  className={`font-semibold ${acc.balance < 0 ? "text-red-400" : "text-emerald-400"}`}
                >
                  {fmt(acc.balance, acc.currency)}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/70">Transactions by month</p>
        <div className="flex items-center gap-2 text-[10px] sm:text-xs">
          <button
            type="button"
            onClick={expandAll}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Expand all
          </button>
          <span className="text-white/20">•</span>
          <button
            type="button"
            onClick={collapseAll}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((group) => {
          const expanded = expandedMonths.has(group.monthKey);
          const net = group.income - group.expenses;
          return (
            <div
              key={group.monthKey}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => toggleMonth(group.monthKey)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] sm:px-4"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <svg
                    className={`h-3 w-3 shrink-0 text-white/40 transition-transform ${
                      expanded ? "rotate-90" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <p className="truncate text-sm font-medium text-white/90">
                    {group.label}
                  </p>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                    {group.count}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-right text-[10px] sm:gap-3 sm:text-xs">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/30 sm:text-[10px]">
                      In
                    </p>
                    <p className="font-semibold text-emerald-400">
                      {fmt(group.income, primaryCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/30 sm:text-[10px]">
                      Out
                    </p>
                    <p className="font-semibold text-red-400">
                      {fmt(group.expenses, primaryCurrency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-white/30 sm:text-[10px]">
                      Net
                    </p>
                    <p
                      className={`font-semibold ${
                        net >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {fmt(net, primaryCurrency)}
                    </p>
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="divide-y divide-white/5 border-t border-white/10">
                  {group.indices.map((i) => {
                    const row = rows[i];
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 px-3 py-2.5 hover:bg-white/[0.02] sm:px-4"
                      >
                        <div className="min-w-0 flex-1">
                          <input
                            type="text"
                            value={row.description}
                            onChange={(e) => updateRow(i, { description: e.target.value })}
                            className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-xs text-white outline-none focus:border-white/20 focus:bg-white/5 sm:text-sm"
                          />
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => updateRow(i, { date: e.target.value })}
                            className="mt-0.5 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[10px] text-white/40 outline-none focus:border-white/20 focus:bg-white/5 sm:text-xs"
                          />
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <input
                            type="number"
                            step="0.01"
                            value={row.amount}
                            onChange={(e) =>
                              updateRow(i, { amount: parseFloat(e.target.value) || 0 })
                            }
                            className={`w-20 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-right text-xs outline-none focus:border-white/20 focus:bg-white/5 sm:w-24 sm:text-sm ${
                              row.amount >= 0 ? "text-emerald-400" : "text-white"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => removeRow(i)}
                            className="rounded p-1 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                            aria-label="Remove"
                          >
                            <svg
                              className="h-3.5 w-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-4 -mb-4 flex gap-2 border-t border-white/10 bg-[#0A0E1A]/95 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:-mb-6 sm:px-6 sm:py-4">
        <button
          onClick={submit}
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Importing..." : `Import ${rows.length} transactions`}
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
