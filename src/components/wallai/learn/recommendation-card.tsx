"use client";

import { useState } from "react";

type Rec = {
  book: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    category: string;
  };
  whyTag: string;
};

type Props = {
  rec: Rec;
  onChanged: () => void;
};

export function RecommendationCard({ rec, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function add(status: "wantToRead" | "read" | "reading") {
    setBusy(true);
    try {
      await fetch("/api/wallai/books/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId: rec.book.id, status }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function dismiss() {
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/recommendations/${rec.book.id}/dismiss`, {
        method: "POST",
      });
      setDismissed(true);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        {rec.book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rec.book.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-20 w-14 shrink-0 rounded bg-white/5" />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium text-white">{rec.book.title}</p>
          <p className="truncate text-xs text-white/50">{rec.book.author}</p>
          <p className="mt-1 text-[10px] text-indigo-300">{rec.whyTag}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => add("wantToRead")}
          className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 disabled:opacity-50"
        >
          Add to list
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={dismiss}
          className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-white/60 hover:bg-white/5 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
