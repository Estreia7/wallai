"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import { PropertyForm, type PropertyFormValue } from "./property-form";

type Valuation = { id: string; estimatedValue: number; date: string };

type LinkedDebt = { id: string; name: string; currentBalance: number; currency: string };

type Property = {
  id: string;
  name: string;
  currency: string;
  debtId: string | null;
  debt: LinkedDebt | null;
  debtInPropertyCurrency?: number;
  valuations: Valuation[];
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function PropertyCard({
  property,
  onEdit,
  onDelete,
  onValuationAdded,
}: {
  property: Property;
  onEdit: () => void;
  onDelete: () => void;
  onValuationAdded: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const latest = property.valuations[0] ?? null;
  const marketValue = latest?.estimatedValue ?? 0;
  // Use FX-converted debt balance (in the property's currency) when the
  // linked debt is in a different currency. Falls back to raw balance for
  // backwards compatibility if the API didn't provide it.
  const debtBalance =
    property.debtInPropertyCurrency ?? property.debt?.currentBalance ?? 0;
  const equity = marketValue - debtBalance;
  const equityPct = marketValue > 0 ? (equity / marketValue) * 100 : 0;

  async function submitValuation(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(newValue.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError("Value must be a non-negative number");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/wallai/properties/${property.id}/valuations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimatedValue: parsed }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to save");
      return;
    }
    setNewValue("");
    setAdding(false);
    onValuationAdded();
  }

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors sm:hover:bg-white/[0.04]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white sm:text-base">
            {property.name}
          </h3>
          {property.debt ? (
            <p className="mt-0.5 text-[10px] text-white/40 sm:text-xs">
              Linked: {property.debt.name} ({formatCurrency(property.debt.currentBalance, property.debt.currency)} owed)
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-white/40 sm:text-xs">No linked mortgage</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold text-white tabular-nums sm:text-lg">
            {latest ? formatCurrency(marketValue, property.currency) : "—"}
          </div>
          <div className="text-[10px] text-white/40">
            {latest ? `as of ${formatDate(latest.date)}` : "no valuation"}
          </div>
        </div>
      </div>

      {/* Equity */}
      {latest && (
        <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-xs">
          <div>
            <div className="text-[9px] uppercase tracking-wider text-white/30">Value</div>
            <div className="font-semibold text-white/90 tabular-nums">
              {formatCurrency(marketValue, property.currency)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-white/30">Debt</div>
            <div className="font-semibold text-amber-400 tabular-nums">
              {formatCurrency(debtBalance, property.currency)}
            </div>
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-white/30">Equity</div>
            <div
              className={`font-semibold tabular-nums ${
                equity >= 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatCurrency(equity, property.currency)}
              {marketValue > 0 && (
                <span className="ml-1 text-[9px] text-white/40">
                  ({equityPct.toFixed(0)}%)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline add valuation */}
      {adding ? (
        <form
          onSubmit={submitValuation}
          className="mt-3 flex flex-col gap-2 border-t border-white/5 pt-3 sm:flex-row sm:items-center"
        >
          <input
            type="text"
            inputMode="decimal"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="New market value"
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-[#0A0E1A] hover:bg-emerald-400 disabled:opacity-50 sm:flex-none"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewValue("");
                setError("");
              }}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
          {error && <p className="w-full text-xs text-red-400">{error}</p>}
        </form>
      ) : (
        <div className="mt-3 flex flex-wrap justify-end gap-1 border-t border-white/5 pt-2">
          <button
            onClick={() => setAdding(true)}
            className="rounded-md px-3 py-1.5 text-xs text-emerald-400 hover:bg-emerald-400/10"
          >
            + Valuation
          </button>
          <button
            onClick={onEdit}
            className="rounded-md px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="rounded-md px-3 py-1.5 text-xs text-white/70 hover:bg-red-500/10 hover:text-red-400"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export function PropertyList() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/wallai/properties");
    const data = await res.json();
    setProperties(data.properties || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(value: PropertyFormValue) {
    const url = value.id ? `/api/wallai/properties/${value.id}` : "/api/wallai/properties";
    const method = value.id ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to save");
    }
    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this property? Valuations will also be removed.")) return;
    await fetch(`/api/wallai/properties/${id}`, { method: "DELETE" });
    await load();
  }

  // Per-property equity uses the FX-converted debt, then we sum. Only
  // meaningful when all properties share a currency — flagged below.
  const totalValue = properties.reduce(
    (s, p) => s + (p.valuations[0]?.estimatedValue ?? 0),
    0,
  );
  const totalDebt = properties.reduce(
    (s, p) => s + (p.debtInPropertyCurrency ?? p.debt?.currentBalance ?? 0),
    0,
  );
  const totalEquity = totalValue - totalDebt;
  const primaryCurrency = properties[0]?.currency ?? "EUR";
  const mixedCurrencies = new Set(properties.map((p) => p.currency)).size > 1;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-white sm:text-2xl">Property</h2>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110"
        >
          + Add property
        </button>
      </div>

      {loading ? (
        <GlassCard>
          <p className="text-xs text-white/40">Loading...</p>
        </GlassCard>
      ) : properties.length === 0 ? (
        <GlassCard>
          <div className="py-6 text-center">
            <p className="text-sm text-white/60">No properties tracked yet.</p>
            <p className="mt-1 text-xs text-white/40">
              Add a home, apartment, or land to track market value and equity.
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          <GlassCard>
            {mixedCurrencies && (
              <p className="mb-2 text-[10px] text-amber-400/80">
                Totals shown in {primaryCurrency}. Mixed-currency properties — see the dashboard for the converted portfolio view.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40">Total value</div>
                <div className="mt-1 text-xl font-bold text-white tabular-nums sm:text-2xl">
                  {formatCurrency(totalValue, primaryCurrency)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/40">Mortgage debt</div>
                <div className="mt-1 text-xl font-bold text-amber-400 tabular-nums sm:text-2xl">
                  {formatCurrency(totalDebt, primaryCurrency)}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wider text-white/40">Total equity</div>
                <div
                  className={`mt-1 text-xl font-bold tabular-nums sm:text-2xl ${
                    totalEquity >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {formatCurrency(totalEquity, primaryCurrency)}
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {properties.map((p) => (
              <PropertyCard
                key={p.id}
                property={p}
                onEdit={() => {
                  setEditing(p);
                  setModalOpen(true);
                }}
                onDelete={() => handleDelete(p.id)}
                onValuationAdded={load}
              />
            ))}
          </div>
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit Property" : "New Property"}
      >
        <PropertyForm
          initial={
            editing
              ? {
                  id: editing.id,
                  name: editing.name,
                  currency: editing.currency,
                  debtId: editing.debtId,
                }
              : undefined
          }
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      </Modal>
    </>
  );
}
