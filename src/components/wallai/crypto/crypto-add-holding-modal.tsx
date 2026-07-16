"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/wallai/modal";
import { POPULAR_COINS } from "@/lib/wallai/crypto/popular-coins";
import type { CoinSummary } from "@/lib/wallai/crypto/types";

type Step = "pick" | "form";

export function CryptoAddHoldingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CoinSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CoinSummary | null>(null);
  const [quantity, setQuantity] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("pick");
    setQuery("");
    setResults([]);
    setPicked(null);
    setQuantity("");
    setAvgCost("");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  useEffect(() => {
    if (!open) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/wallai/crypto/coins/search?q=${encodeURIComponent(query)}`,
        );
        const data = await res.json();
        if (active) setResults(data.coins ?? []);
      } finally {
        if (active) setSearching(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  function pick(coin: CoinSummary) {
    setPicked(coin);
    setStep("form");
    setError(null);
  }

  async function save() {
    if (!picked) return;
    const qtyNum = Number(quantity);
    const investedNum = Number(avgCost); // total € invested
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setError("Quantity must be a positive number");
      return;
    }
    if (!Number.isFinite(investedNum) || investedNum < 0) {
      setError("Amount invested must be 0 or a positive number");
      return;
    }
    // Backend stores avg cost per unit; derive it from the total invested.
    const avgCostEur = investedNum / qtyNum;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wallai/crypto/holdings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          coinId: picked.id,
          quantity: qtyNum,
          avgCostEur,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save");
        return;
      }
      close();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-emerald-400"
      >
        + Add holding
      </button>

      <Modal
        isOpen={open}
        onClose={close}
        title={step === "pick" ? "Add holding" : `Add ${picked?.symbol}`}
      >
        {step === "pick" ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/70 sm:text-xs">
                Popular
              </p>
              <div className="flex flex-wrap gap-2">
                {POPULAR_COINS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pick({ id: c.id, symbol: c.symbol, name: c.name })}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white hover:bg-white/10"
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-white/70 sm:text-xs">
                Search any coin
              </p>
              <input
                type="text"
                placeholder="e.g. doge, monero…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              />
              {searching && (
                <p className="mt-2 text-xs text-white/70">Searching…</p>
              )}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="mt-2 text-xs text-white/70">No matches</p>
              )}
              {results.length > 0 && (
                <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg border border-white/10">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-white/80 hover:bg-white/5"
                      >
                        <span className="font-semibold text-white">{c.symbol}</span>
                        <span className="text-xs text-white/50">{c.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <span className="font-semibold text-white">{picked?.symbol}</span>
              <span className="ml-2 text-white/50">{picked?.name}</span>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Quantity</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 0.25"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-white/60">Amount invested (€ total)</span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={avgCost}
                onChange={(e) => setAvgCost(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30"
              />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex justify-between gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:bg-emerald-400 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
