"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type Category = {
  id: string;
  name: string;
  kind: "income" | "expense" | "transfer";
  group: string | null;
  parentId: string | null;
  color: string | null;
  icon: string | null;
  isDefault: boolean;
  archived: boolean;
};

const KIND_LABELS: Record<Category["kind"], string> = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
};

export function CategoriesCard() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-category form
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<Category["kind"]>("expense");
  const [newGroup, setNewGroup] = useState("");

  // Rename inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/wallai/categories");
    const data = await res.json();
    setCategories(data.categories ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, Category[]>();
    for (const c of categories) {
      const key = c.group ?? "Ungrouped";
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  }, [categories]);

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    const res = await fetch("/api/wallai/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind: newKind, group: newGroup.trim() || null }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Failed to add category");
      return;
    }
    setNewName("");
    setNewGroup("");
    await load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/wallai/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Update failed");
    } else {
      await load();
    }
    setBusyId(null);
    setEditingId(null);
  }

  async function removeCategory(cat: Category) {
    // Offer a merge target: same-kind, non-archived, not itself.
    const targets = categories.filter(
      (c) => c.kind === cat.kind && c.id !== cat.id && !c.archived,
    );
    const mergeInto = window.prompt(
      `Delete "${cat.name}".\n\nTo move its transactions into another category, type that category's exact name. Leave blank to just delete (those transactions fall back to Other).\n\nOptions: ${targets.map((t) => t.name).join(", ")}`,
      "",
    );
    if (mergeInto === null) return; // cancelled
    setBusyId(cat.id);
    setError(null);
    const qs = mergeInto.trim() ? `?mergeInto=${encodeURIComponent(mergeInto.trim())}` : "";
    const res = await fetch(`/api/wallai/categories/${cat.id}${qs}`, { method: "DELETE" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Delete failed");
    } else {
      await load();
    }
    setBusyId(null);
  }

  return (
    <GlassCard>
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-white">Categories</h3>
        <p className="mt-1 text-xs text-white/70">
          Rename, recolor, group, merge, or archive the categories WallAI uses to
          sort your transactions. New categories become available to the
          auto-categorizer immediately.
        </p>
      </div>

      {/* Add new */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name"
          className="min-w-[8rem] flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400/50"
        />
        <input
          value={newGroup}
          onChange={(e) => setNewGroup(e.target.value)}
          placeholder="Group (optional)"
          className="w-32 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-emerald-400/50"
        />
        <select
          value={newKind}
          onChange={(e) => setNewKind(e.target.value as Category["kind"])}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80 outline-none focus:border-emerald-400/50"
        >
          <option value="expense" className="bg-[#0A0E1A]">Expense</option>
          <option value="income" className="bg-[#0A0E1A]">Income</option>
          <option value="transfer" className="bg-[#0A0E1A]">Transfer</option>
        </select>
        <button
          onClick={addCategory}
          disabled={!newName.trim()}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">⚠ {error}</p>}

      {loading ? (
        <p className="text-xs text-white/70">Loading…</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([groupName, cats]) => (
            <div key={groupName}>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {groupName}
              </p>
              <div className="space-y-1">
                {cats.map((cat) => (
                  <div
                    key={cat.id}
                    className={`flex items-center gap-2 rounded-lg border border-white/5 px-2 py-1.5 ${
                      cat.archived ? "opacity-40" : "bg-white/[0.02]"
                    } ${cat.parentId ? "ml-4" : ""}`}
                  >
                    <input
                      type="color"
                      value={cat.color ?? "#94a3b8"}
                      onChange={(e) => patch(cat.id, { color: e.target.value })}
                      className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      title="Category color"
                    />
                    {cat.icon && <span className="text-sm">{cat.icon}</span>}

                    {editingId === cat.id ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") patch(cat.id, { name: editName });
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => editName.trim() && editName !== cat.name ? patch(cat.id, { name: editName }) : setEditingId(null)}
                        className="flex-1 rounded border border-emerald-400/40 bg-white/5 px-2 py-0.5 text-xs text-white outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditName(cat.name);
                        }}
                        className="flex-1 text-left text-xs text-white/90 hover:text-white"
                        title="Rename"
                      >
                        {cat.name}
                      </button>
                    )}

                    <span className="shrink-0 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-white/40">
                      {KIND_LABELS[cat.kind]}
                    </span>

                    <button
                      onClick={() => patch(cat.id, { archived: !cat.archived })}
                      disabled={busyId === cat.id}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-white/50 hover:bg-white/5 hover:text-white/80"
                    >
                      {cat.archived ? "Restore" : "Archive"}
                    </button>
                    <button
                      onClick={() => removeCategory(cat)}
                      disabled={busyId === cat.id}
                      className="shrink-0 rounded px-1 py-0.5 text-white/30 hover:bg-red-500/10 hover:text-red-400"
                      title="Delete / merge"
                      aria-label="Delete category"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
