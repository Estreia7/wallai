"use client";

import { useState } from "react";
import { DEBT_TYPES, debtTypeLabel, type DebtType } from "@/lib/wallai/debt-types";

export type DebtFormValue = {
  id?: string;
  name: string;
  type: DebtType;
  currency: string;
  originalAmount: number;
  currentBalance: number;
  interestRate: number;
  monthlyPayment: number;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  notes: string | null;
};

function toDateInput(value: unknown): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function DebtForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<DebtFormValue> & { startDate?: unknown; endDate?: unknown };
  onSubmit: (value: DebtFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<DebtType>((initial?.type as DebtType) ?? "mortgage");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [originalAmount, setOriginalAmount] = useState(
    initial?.originalAmount !== undefined ? String(initial.originalAmount) : "",
  );
  const [currentBalance, setCurrentBalance] = useState(
    initial?.currentBalance !== undefined ? String(initial.currentBalance) : "",
  );
  const [interestRate, setInterestRate] = useState(
    initial?.interestRate !== undefined ? String(initial.interestRate) : "",
  );
  const [monthlyPayment, setMonthlyPayment] = useState(
    initial?.monthlyPayment !== undefined ? String(initial.monthlyPayment) : "",
  );
  const [startDate, setStartDate] = useState(
    toDateInput(initial?.startDate) || new Date().toISOString().slice(0, 10),
  );
  const [endDate, setEndDate] = useState(toDateInput(initial?.endDate));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function parseNum(s: string): number {
    return Number(s.replace(",", "."));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return setError("Name is required");
    if (currency.length !== 3) return setError("Currency must be 3 letters");

    const orig = parseNum(originalAmount);
    const bal = parseNum(currentBalance);
    const rate = parseNum(interestRate);
    const pay = parseNum(monthlyPayment);
    if ([orig, bal, rate, pay].some((n) => !Number.isFinite(n) || n < 0)) {
      return setError("Amounts must be non-negative numbers");
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        type,
        currency: currency.toUpperCase(),
        originalAmount: orig,
        currentBalance: bal,
        interestRate: rate,
        monthlyPayment: pay,
        startDate,
        endDate: endDate || null,
        notes: notes.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30";
  const labelClass = "mb-1.5 block text-xs font-medium text-white/60";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. House Mortgage"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as DebtType)}
            className={inputClass}
          >
            {DEBT_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0A0E1A] text-white">{debtTypeLabel(t)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Original amount</label>
          <input
            type="text"
            inputMode="decimal"
            value={originalAmount}
            onChange={(e) => setOriginalAmount(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Current balance</label>
          <input
            type="text"
            inputMode="decimal"
            value={currentBalance}
            onChange={(e) => setCurrentBalance(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Interest rate (APR %)</label>
          <input
            type="text"
            inputMode="decimal"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            placeholder="3.50"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Monthly payment</label>
          <input
            type="text"
            inputMode="decimal"
            value={monthlyPayment}
            onChange={(e) => setMonthlyPayment(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Start date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>End date (optional)</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className={inputClass}
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
