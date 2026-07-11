"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/wallai/modal";

type SearchHit = {
  externalId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string | null;
  publishedYear: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
};

const STATUS_OPTIONS = [
  { value: "read", label: "Read" },
  { value: "reading", label: "Reading" },
  { value: "wantToRead", label: "Want to read" },
] as const;

export function AddBookModal({ open, onClose, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [status, setStatus] = useState<"read" | "reading" | "wantToRead">("wantToRead");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setRating(null);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/wallai/books/search?q=${encodeURIComponent(query)}`,
        );
        const json = await res.json();
        setResults(json.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleAdd() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wallai/books/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalId: selected.externalId,
          status,
          rating: status === "read" ? rating : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to add book");
        return;
      }
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Add a book">
      {!selected ? (
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
          />
          {searching && <p className="text-xs text-white/70">Searching…</p>}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <li key={r.externalId}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="flex w-full items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left hover:bg-white/[0.06]"
                >
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded bg-white/5" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{r.title}</p>
                    <p className="truncate text-xs text-white/50">
                      {r.authors.join(", ")} {r.publishedYear ? `· ${r.publishedYear}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {query.length >= 2 && !searching && results.length === 0 && (
              <li className="text-xs text-white/70">No matches — try a different title or author</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            {selected.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.coverUrl} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-24 w-16 shrink-0 rounded bg-white/5" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selected.title}</p>
              <p className="truncate text-xs text-white/50">{selected.authors.join(", ")}</p>
              <button
                type="button"
                className="mt-1 text-[10px] text-white/70 underline"
                onClick={() => setSelected(null)}
              >
                Change
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-white/70">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    status === opt.value
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/5 bg-white/[0.02] text-white/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === "read" && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-white/70">Rating (optional)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`text-lg ${rating && n <= rating ? "text-amber-300" : "text-white/20"}`}
                    aria-label={`${n} star`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add to my list"}
          </button>
        </div>
      )}
    </Modal>
  );
}
