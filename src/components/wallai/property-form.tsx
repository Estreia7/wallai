"use client";

import { useEffect, useState } from "react";

export type PropertyFormValue = {
  id?: string;
  name: string;
  currency: string;
  debtId: string | null;
  initialValue: number | null;
};

type DebtOption = { id: string; name: string; currency: string };

export function PropertyForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Partial<PropertyFormValue>;
  onSubmit: (value: PropertyFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const isEditing = Boolean(initial?.id);
  const [name, setName] = useState(initial?.name ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "EUR");
  const [debtId, setDebtId] = useState<string>(initial?.debtId ?? "");
  const [initialValue, setInitialValue] = useState("");
  const [debts, setDebts] = useState<DebtOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/wallai/debts")
      .then((res) => res.json())
      .then((data) => setDebts(data.debts || []))
      .catch(() => setDebts([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("Name is required");
    if (currency.length !== 3) return setError("Currency must be 3 letters");

    let parsedValue: number | null = null;
    if (initialValue.trim()) {
      parsedValue = Number(initialValue.replace(",", "."));
      if (!Number.isFinite(parsedValue) || parsedValue < 0) {
        return setError("Value must be a non-negative number");
      }
    }

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        currency: currency.toUpperCase(),
        debtId: debtId || null,
        initialValue: parsedValue,
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
          placeholder="e.g. Lisbon Apartment"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div>
          <label className={labelClass}>Linked mortgage (optional)</label>
          <select
            value={debtId}
            onChange={(e) => setDebtId(e.target.value)}
            className={inputClass}
          >
            <option value="">None</option>
            {debts.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!isEditing && (
        <div>
          <label className={labelClass}>Current market value (optional)</label>
          <input
            type="text"
            inputMode="decimal"
            value={initialValue}
            onChange={(e) => setInitialValue(e.target.value)}
            placeholder="0.00"
            className={inputClass}
          />
          <p className="mt-1 text-[10px] text-white/70">
            You can record more valuations over time from the property card.
          </p>
        </div>
      )}

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
