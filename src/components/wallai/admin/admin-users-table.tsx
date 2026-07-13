"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  plan: string;
  createdAt: string;
  transactionCount: number;
  aiSpend: number;
  aiCalls: number;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IE", { year: "numeric", month: "short", day: "numeric" });
}

export function AdminUsersTable() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/wallai/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setPlan(id: string, plan: string) {
    setBusyId(id);
    await fetch(`/api/wallai/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, plan } : u)));
    setBusyId(null);
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Users</h3>
        <span className="text-xs text-white/50">{users.length} total</span>
      </div>

      {loading ? (
        <p className="text-xs text-white/70">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/40">
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Joined</th>
                <th className="py-2 pr-3 text-right font-medium">Txns</th>
                <th className="py-2 pr-3 text-right font-medium">AI spend</th>
                <th className="py-2 pr-3 font-medium">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.02]">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-white/90">{u.name || "—"}</p>
                    <p className="text-[11px] text-white/50">{u.email}</p>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] ${
                        u.role === "admin"
                          ? "bg-cyan-500/20 text-cyan-300"
                          : "bg-white/5 text-white/50"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-white/60">{fmtDate(u.createdAt)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-white/70">{u.transactionCount}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-white/70">
                    ${u.aiSpend.toFixed(2)}
                    <span className="ml-1 text-[10px] text-white/40">({u.aiCalls})</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <select
                      value={u.plan}
                      disabled={busyId === u.id || u.role === "admin"}
                      onChange={(e) => setPlan(u.id, e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/80 outline-none focus:border-white/20 disabled:opacity-40"
                    >
                      <option value="free" className="bg-[#0A0E1A]">Free</option>
                      <option value="paid" className="bg-[#0A0E1A]">Paid</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </GlassCard>
  );
}
