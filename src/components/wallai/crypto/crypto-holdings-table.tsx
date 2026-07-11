"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/wallai/glass-card";
import { Modal } from "@/components/wallai/modal";
import type { HoldingWithLivePrice } from "@/lib/wallai/crypto/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQty(q: number): string {
  if (q === 0) return "0";
  const abs = Math.abs(q);
  const digits = abs >= 1 ? 4 : 8;
  return q.toFixed(digits).replace(/\.?0+$/, "");
}

function formatPct(pct: number | null): string {
  if (pct === null) return "—";
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(2)}%`;
}

export function CryptoHoldingsTable({
  holdings,
}: {
  holdings: HoldingWithLivePrice[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<HoldingWithLivePrice | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editAvgCost, setEditAvgCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit(h: HoldingWithLivePrice) {
    setEditing(h);
    setEditQuantity(String(h.quantity));
    setEditAvgCost(String(h.avgCostEur));
    setError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const quantity = Number(editQuantity);
    const avgCostEur = Number(editAvgCost);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    if (!Number.isFinite(avgCostEur) || avgCostEur < 0) {
      setError("Average cost must be 0 or a positive number");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/wallai/crypto/holdings/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ quantity, avgCostEur }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteHolding(h: HoldingWithLivePrice) {
    if (!confirm(`Delete ${h.symbol}? This cannot be undone.`)) return;
    const res = await fetch(`/api/wallai/crypto/holdings/${h.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <>
      <GlassCard>
        <h3 className="mb-3 text-xs font-semibold text-white/70 sm:mb-4 sm:text-sm">
          Holdings
        </h3>
        {/* Mobile: stacked cards */}
        <div className="space-y-2 sm:hidden">
          {holdings.map((h) => {
            const pnlColor =
              h.pnlEur > 0
                ? "text-emerald-400"
                : h.pnlEur < 0
                  ? "text-red-400"
                  : "text-white/70";
            return (
              <div
                key={h.id}
                className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{h.symbol}</div>
                    <div className="truncate text-[10px] text-white/70">{h.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-white tabular-nums">
                      {formatCurrency(h.valueEur)}
                    </div>
                    <div className={`text-[10px] tabular-nums ${pnlColor}`}>
                      {h.pnlEur >= 0 ? "+" : ""}
                      {formatCurrency(h.pnlEur)} ({formatPct(h.pnlPct)})
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-2 text-[11px]">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/50">Qty</div>
                    <div className="text-white/80 tabular-nums">{formatQty(h.quantity)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/50">Avg cost</div>
                    <div className="text-white/80 tabular-nums">{formatCurrency(h.avgCostEur)}</div>
                  </div>
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/50">Price</div>
                    <div className="text-white/80 tabular-nums">
                      {h.priceEur !== null ? formatCurrency(h.priceEur) : <span className="text-amber-400">—</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex justify-end gap-1 border-t border-white/5 pt-2">
                  <button
                    onClick={() => openEdit(h)}
                    className="rounded-md px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteHolding(h)}
                    className="rounded-md px-3 py-1.5 text-xs text-white/70 hover:bg-red-500/10 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-white/70">
                <th className="pb-2 font-medium">Coin</th>
                <th className="pb-2 font-medium">Qty</th>
                <th className="pb-2 font-medium">Avg cost</th>
                <th className="pb-2 font-medium">Price</th>
                <th className="pb-2 font-medium">Value</th>
                <th className="pb-2 font-medium">P&amp;L</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const pnlColor =
                  h.pnlEur > 0
                    ? "text-emerald-400"
                    : h.pnlEur < 0
                      ? "text-red-400"
                      : "text-white/70";
                return (
                  <tr key={h.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5">
                      <div className="font-semibold text-white">{h.symbol}</div>
                      <div className="text-[10px] text-white/70 sm:text-xs">{h.name}</div>
                    </td>
                    <td className="py-2.5 text-white/80">{formatQty(h.quantity)}</td>
                    <td className="py-2.5 text-white/80">{formatCurrency(h.avgCostEur)}</td>
                    <td className="py-2.5 text-white/80">
                      {h.priceEur !== null ? formatCurrency(h.priceEur) : <span className="text-amber-400">—</span>}
                    </td>
                    <td className="py-2.5 text-white">{formatCurrency(h.valueEur)}</td>
                    <td className={`py-2.5 ${pnlColor}`}>
                      {h.pnlEur >= 0 ? "+" : ""}
                      {formatCurrency(h.pnlEur)}
                      <div className="text-[10px] sm:text-xs">{formatPct(h.pnlPct)}</div>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        onClick={() => openEdit(h)}
                        className="rounded-md px-2 py-1 text-[10px] text-white/60 hover:bg-white/10 hover:text-white sm:text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteHolding(h)}
                        className="ml-1 rounded-md px-2 py-1 text-[10px] text-white/60 hover:bg-red-500/10 hover:text-red-400 sm:text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <Modal
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.symbol}` : "Edit"}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Quantity</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-white/60">Avg cost (€ per unit)</span>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={editAvgCost}
              onChange={(e) => setEditAvgCost(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
            />
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={saveEdit}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
