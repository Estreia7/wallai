"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import { DebtForm, type DebtFormValue } from "./debt-form";
import { debtTypeLabel, projectPayoff, type DebtType } from "@/lib/wallai/debt-types";

type Debt = {
  id: string;
  name: string;
  type: DebtType;
  currency: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string;
  endDate: string | null;
  notes: string | null;
};

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCurrencyPrecise(value: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMonths(m: number): string {
  if (m < 12) return `${m} mo`;
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r === 0 ? `${y}y` : `${y}y ${r}m`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-IE", { month: "short", year: "numeric" });
}

function DebtCard({
  debt,
  onEdit,
  onDelete,
}: {
  debt: Debt;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const paid = Math.max(debt.originalAmount - debt.currentBalance, 0);
  const progress =
    debt.originalAmount > 0 ? Math.min((paid / debt.originalAmount) * 100, 100) : 0;

  const projection = projectPayoff(
    debt.currentBalance,
    debt.interestRate,
    debt.monthlyPayment,
  );

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-colors sm:hover:bg-white/[0.04]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-white sm:text-base">
              {debt.name}
            </h3>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
              {debtTypeLabel(debt.type)}
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-white/70 sm:text-xs">
            {debt.interestRate.toFixed(2)}% APR • {formatCurrencyPrecise(debt.monthlyPayment, debt.currency)}/mo
          </p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold text-white tabular-nums sm:text-lg">
            {formatCurrency(debt.currentBalance, debt.currency)}
          </div>
          <div className="text-[10px] text-white/70">
            of {formatCurrency(debt.originalAmount, debt.currency)}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-white/70">
          <span>Paid {formatCurrency(paid, debt.currency)}</span>
          <span className="tabular-nums">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Projection */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/5 pt-3 text-xs">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Payoff in</div>
          <div className="font-semibold text-white tabular-nums">
            {projection.paymentCoversInterest && projection.monthsRemaining !== null
              ? formatMonths(projection.monthsRemaining)
              : "—"}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Payoff date</div>
          <div className="font-semibold text-white/80 tabular-nums">
            {projection.payoffDate ? formatDate(projection.payoffDate) : "—"}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-white/50">Total interest</div>
          <div className="font-semibold text-amber-400 tabular-nums">
            {projection.totalInterest !== null
              ? formatCurrency(projection.totalInterest, debt.currency)
              : "—"}
          </div>
        </div>
      </div>

      {!projection.paymentCoversInterest && (
        <p className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-1.5 text-[10px] text-amber-300">
          ⚠ Monthly payment doesn&apos;t cover interest — debt is growing.
        </p>
      )}

      {debt.notes && (
        <p className="mt-3 border-t border-white/5 pt-2 text-[11px] text-white/50">
          {debt.notes}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-1 border-t border-white/5 pt-2">
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
    </div>
  );
}

export function DebtList() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  async function loadDebts() {
    setLoading(true);
    const res = await fetch("/api/wallai/debts");
    const data = await res.json();
    setDebts(data.debts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadDebts();
  }, []);

  async function handleSubmit(value: DebtFormValue) {
    const url = value.id ? `/api/wallai/debts/${value.id}` : "/api/wallai/debts";
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
    await loadDebts();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this debt? This cannot be undone.")) return;
    await fetch(`/api/wallai/debts/${id}`, { method: "DELETE" });
    await loadDebts();
  }

  // Totals across all debts (displayed in primary currency — naive sum, assumes same currency)
  const totalBalance = debts.reduce((s, d) => s + d.currentBalance, 0);
  const totalMonthly = debts.reduce((s, d) => s + d.monthlyPayment, 0);
  const primaryCurrency = debts[0]?.currency ?? "EUR";

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-title">Debts &amp; Loans</h2>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110"
        >
          + Add debt
        </button>
      </div>

      {loading ? (
        <GlassCard>
          <p className="text-xs text-white/70">Loading...</p>
        </GlassCard>
      ) : debts.length === 0 ? (
        <GlassCard>
          <div className="py-6 text-center">
            <p className="text-sm text-white/60">No debts tracked yet.</p>
            <p className="mt-1 text-xs text-white/70">
              Add a mortgage, loan, or credit line to see payoff projections.
            </p>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {/* Totals summary */}
          <GlassCard>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/70">Total debt</div>
                <div className="mt-1 text-xl font-bold text-white tabular-nums sm:text-2xl">
                  {formatCurrency(totalBalance, primaryCurrency)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/70">Monthly payments</div>
                <div className="mt-1 text-xl font-bold text-white/90 tabular-nums sm:text-2xl">
                  {formatCurrency(totalMonthly, primaryCurrency)}
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <div className="text-[10px] uppercase tracking-wider text-white/70">Active debts</div>
                <div className="mt-1 text-xl font-bold text-white/90 tabular-nums sm:text-2xl">
                  {debts.length}
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Debt cards */}
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {debts.map((d) => (
              <DebtCard
                key={d.id}
                debt={d}
                onEdit={() => {
                  setEditing(d);
                  setModalOpen(true);
                }}
                onDelete={() => handleDelete(d.id)}
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
        title={editing ? "Edit Debt" : "New Debt"}
      >
        <DebtForm
          initial={editing ?? undefined}
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
