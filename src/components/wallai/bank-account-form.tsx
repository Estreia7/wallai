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
  institutionId: string | null;
};

export type InstitutionOption = { id: string; name: string };

export function BankAccountForm({
  initial,
  institutions,
  onSubmit,
  onCancel,
  onCreateInstitution,
}: {
  initial?: Partial<BankAccountFormValue>;
  institutions: InstitutionOption[];
  onSubmit: (value: BankAccountFormValue) => Promise<void>;
  onCancel: () => void;
  onCreateInstitution?: (name: string) => Promise<InstitutionOption>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [type, setType] = useState<BankAccountType>(
    (initial?.type as BankAccountType) ?? "checking"
  );
  const [balanceInput, setBalanceInput] = useState(
    initial?.currentBalance !== undefined ? String(initial.currentBalance) : "0"
  );
  const [institutionId, setInstitutionId] = useState<string | null>(
    initial?.institutionId ?? null
  );
  const [creatingInstitution, setCreatingInstitution] = useState(false);
  const [newInstitutionName, setNewInstitutionName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateInstitution(e: React.FormEvent) {
    e.preventDefault();
    if (!onCreateInstitution) return;
    const trimmed = newInstitutionName.trim();
    if (!trimmed) return;
    try {
      const created = await onCreateInstitution(trimmed);
      setInstitutionId(created.id);
      setNewInstitutionName("");
      setCreatingInstitution(false);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create institution");
    }
  }

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
        institutionId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">Institution</label>
        {creatingInstitution ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={newInstitutionName}
              onChange={(e) => setNewInstitutionName(e.target.value)}
              placeholder="e.g. BPI"
              autoFocus
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreateInstitution}
                className="rounded-xl bg-emerald-500/80 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreatingInstitution(false);
                  setNewInstitutionName("");
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <select
            value={institutionId ?? ""}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "__new__") {
                setCreatingInstitution(true);
              } else {
                setInstitutionId(value || null);
              }
            }}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
          >
            <option value="">— None —</option>
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
            {onCreateInstitution && <option value="__new__">+ New institution…</option>}
          </select>
        )}
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-white/60">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Main Account"
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
            <span className="ml-2 text-white/70">(use a negative number for debt)</span>
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
          className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:brightness-110 disabled:opacity-40"
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
