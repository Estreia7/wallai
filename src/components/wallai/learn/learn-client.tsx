"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";
import { AddBookModal } from "./add-book-modal";
import { UserBookRow } from "./user-book-row";
import { ProfileRadar } from "./profile-radar";
import { RecommendationCard } from "./recommendation-card";

type Payload = {
  userBooks: Array<{
    bookId: string;
    status: "reading" | "read" | "wantToRead";
    rating: number | null;
    book: {
      id: string;
      title: string;
      author: string;
      coverUrl: string | null;
      traits: number[];
      traitSource: string | null;
    };
  }>;
  profile: number[] | null;
  readCount: number;
  isStarter: boolean;
  recommendations: Array<{
    book: { id: string; title: string; author: string; coverUrl: string | null; category: string };
    whyTag: string;
  }>;
};

const STATUS_ORDER: Array<Payload["userBooks"][number]["status"]> = [
  "reading",
  "wantToRead",
  "read",
];
const STATUS_HEADING = {
  reading: "Currently reading",
  wantToRead: "Want to read",
  read: "Read",
} as const;

export function LearnClient({ initial }: { initial: Payload }) {
  const [data, setData] = useState<Payload>(initial);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallai/books/recommendations");
      if (res.ok) {
        const json = (await res.json()) as Payload;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let lastReloadAt = Date.now();
    const STALE_MS = 60_000;
    function onFocus() {
      const now = Date.now();
      if (now - lastReloadAt < STALE_MS) return;
      lastReloadAt = now;
      reload();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const grouped = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, data.userBooks.filter((ub) => ub.status === s)]),
  ) as Record<Payload["userBooks"][number]["status"], Payload["userBooks"]>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">Learn</h2>
          <p className="mt-0.5 text-xs text-white/40 sm:text-sm">
            Track what you&apos;ve read and get 5 picks tailored to what you haven&apos;t
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          + Add book
        </button>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">Your reading</h3>
        {data.userBooks.length === 0 ? (
          <GlassCard>
            <p className="py-6 text-center text-sm text-white/50">
              No books tracked yet. Add your first to start your profile.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {STATUS_ORDER.map((s) =>
              grouped[s].length === 0 ? null : (
                <div key={s}>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {STATUS_HEADING[s]}
                  </h4>
                  <div className="space-y-2">
                    {grouped[s].map((ub) => (
                      <UserBookRow key={ub.bookId} userBook={ub} onChanged={reload} />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">Your profile</h3>
        {data.profile ? (
          <ProfileRadar profile={data.profile} />
        ) : (
          <GlassCard>
            <p className="py-4 text-center text-xs text-white/50">
              Mark {Math.max(3 - data.readCount, 0)} more book
              {Math.max(3 - data.readCount, 0) === 1 ? "" : "s"} as{" "}
              <span className="text-white/70">Read</span> to unlock your personalized profile.
            </p>
          </GlassCard>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">
          {data.isStarter ? "A great place to start" : "Picked for you"}
        </h3>
        {data.recommendations.length === 0 ? (
          <GlassCard>
            <p className="py-4 text-center text-xs text-white/50">
              You&apos;ve seen every book we know. Add one yourself to get more picks.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.recommendations.map((r) => (
              <RecommendationCard key={r.book.id} rec={r} onChanged={reload} />
            ))}
          </div>
        )}
      </section>

      <AddBookModal open={modalOpen} onClose={() => setModalOpen(false)} onAdded={reload} />
      {loading && (
        <p className="text-center text-[10px] text-white/30">updating…</p>
      )}
    </div>
  );
}
