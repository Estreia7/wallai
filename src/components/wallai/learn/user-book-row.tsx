"use client";

import { useState } from "react";

type UserBook = {
  bookId: string;
  status: "reading" | "read" | "wantToRead";
  rating: number | null;
  book: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    traitSource: string | null;
    traits: number[];
  };
};

type Props = {
  userBook: UserBook;
  onChanged: () => void;
};

const STATUS_LABEL: Record<UserBook["status"], string> = {
  reading: "Reading",
  read: "Read",
  wantToRead: "Want to read",
};

const STATUS_COLOR: Record<UserBook["status"], string> = {
  reading: "bg-amber-500/15 text-amber-300",
  read: "bg-emerald-500/15 text-emerald-300",
  wantToRead: "bg-indigo-500/15 text-indigo-300",
};

export function UserBookRow({ userBook, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsTraits = userBook.book.traits.length !== 20;

  async function patch(body: unknown) {
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/${userBook.bookId}/user`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onChanged();
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this book from your list?")) return;
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/${userBook.bookId}/user`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function retryTraits() {
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/${userBook.bookId}/retry-traits`, { method: "POST" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      {userBook.book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={userBook.book.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
      ) : (
        <div className="h-16 w-11 shrink-0 rounded bg-white/5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{userBook.book.title}</p>
        <p className="truncate text-xs text-white/50">{userBook.book.author}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_COLOR[userBook.status]}`}>
            {STATUS_LABEL[userBook.status]}
          </span>
          {userBook.status === "read" && userBook.rating !== null && (
            <span className="text-[10px] text-amber-300">
              {"★".repeat(userBook.rating)}
              <span className="text-white/10">{"★".repeat(5 - userBook.rating)}</span>
            </span>
          )}
          {needsTraits && (
            <button
              type="button"
              onClick={retryTraits}
              disabled={busy}
              className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/10"
            >
              traits pending — retry
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg p-1.5 text-white/70 hover:bg-white/5"
          aria-label="Book options"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-white/10 bg-[#0b0b0e] p-1 shadow-xl">
            {(["read", "reading", "wantToRead"] as const)
              .filter((s) => s !== userBook.status)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => patch({ status: s })}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5"
                >
                  Mark as {STATUS_LABEL[s]}
                </button>
              ))}
            <hr className="my-1 border-white/5" />
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-red-400 hover:bg-white/5"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
