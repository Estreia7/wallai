"use client";

import { useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

const CURRENCIES = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "USD", label: "US Dollar (USD)" },
  { code: "GBP", label: "British Pound (GBP)" },
  { code: "CHF", label: "Swiss Franc (CHF)" },
  { code: "BRL", label: "Brazilian Real (BRL)" },
];

type CurrencyCardProps = {
  initialCurrency: string;
};

export function CurrencyCard({ initialCurrency }: CurrencyCardProps) {
  const [currency, setCurrency] = useState(initialCurrency);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleChange(newCurrency: string) {
    if (newCurrency === currency) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency: newCurrency }),
    });

    if (res.ok) {
      setCurrency(newCurrency);
      setMessage({ type: "success", text: "Currency updated." });
    } else {
      setMessage({ type: "error", text: "Failed to update currency." });
    }
    setSaving(false);
  }

  return (
    <GlassCard>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">Display Currency</h3>
        <p className="mt-1 text-xs text-white/40">
          All values across the app will be shown in this currency.
        </p>
      </div>

      <select
        value={currency}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white outline-none transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30 disabled:opacity-40"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code} className="bg-[#0A0E1A] text-white">
            {c.label}
          </option>
        ))}
      </select>

      {message && (
        <p className={`mt-2 text-xs ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </p>
      )}
    </GlassCard>
  );
}
