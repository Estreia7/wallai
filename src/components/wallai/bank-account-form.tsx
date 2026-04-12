"use client";

import { useState } from "react";
import {
  BANK_ACCOUNT_TYPES,
  bankAccountTypeLabel,
  type BankAccountType,
} from "@/lib/wallai/bank-account-types";

export type BankAccountFormValue = {
  id?: string;
  name: string;
  currency: string;
  type: BankAccountType;
  currentBalance: number;
};

export function BankAccountForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<BankAccountFormValue>;
  onSubmit: (value: BankAccountFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [type, setType] = useState<BankAccountType>(
    (initial?.type as BankAccountType) ?? "checking"
  );
  const [balanceInput, setBalanceInput] = useState(
    initial?.currentBalance !== undefined ? String(initial.currentBalance) : "0"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (currency.length !== 3) {
      setError("Currency must be 3 letters (e.g. EUR)");
      return;
    }
    const parsedBalance = Number(balanceInput.replace(",", "."));
    if (Number.isNaN(parsedBalance)) {
      setError("Balance must be a number");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        currency: currency.toUpperCase(),
        type,
        currentBalance: parsedBalance,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. BPI Main Account"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BankAccountType)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
          >
            {BANK_ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {bankAccountTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-white/60">Currency</label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            maxLength={3}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
          />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">
          Current balance
          {type === "credit" && (
            <span className="ml-2 text-white/40">(use a negative number for debt)</span>
          )}
        </label>
        <input
          type="text"
          inputMode="decimal"
          value={balanceInput}
          onChange={(e) => setBalanceInput(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 disabled:opacity-40"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
