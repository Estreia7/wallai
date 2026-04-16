"use client";

import { useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";

type ProfileCardProps = {
  initialName: string;
  email: string;
};

export function ProfileCard({ initialName, email }: ProfileCardProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name === initialName) return;
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (res.ok) {
      setMessage({ type: "success", text: "Name updated." });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Failed to update name." });
    }
    setSaving(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword.length < 6) {
      setPwMessage({ type: "error", text: "Password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "Passwords don't match." });
      return;
    }

    setPwSaving(true);

    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (res.ok) {
      setPwMessage({ type: "success", text: "Password changed." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      const data = await res.json().catch(() => ({}));
      setPwMessage({ type: "error", text: data.error || "Failed to change password." });
    }
    setPwSaving(false);
  }

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30";
  const btnClass =
    "rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:brightness-110 disabled:opacity-40";

  return (
    <GlassCard>
      <h3 className="mb-4 text-sm font-semibold text-white">Profile</h3>

      {/* Email (read-only) */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-white/40">Email</label>
        <p className="text-sm text-white/60">{email}</p>
      </div>

      {/* Name */}
      <form onSubmit={handleNameSave} className="mb-6">
        <label className="mb-1 block text-xs text-white/40">Name</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={saving || !name.trim() || name === initialName}
            className={btnClass}
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
        {message && (
          <p className={`mt-2 text-xs ${message.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {message.text}
          </p>
        )}
      </form>

      {/* Password change */}
      <div className="border-t border-white/10 pt-4">
        <h4 className="mb-3 text-xs font-semibold text-white/60">Change Password</h4>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className={inputClass}
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className={inputClass}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
            className={btnClass}
          >
            {pwSaving ? "Changing..." : "Change Password"}
          </button>
        </form>
        {pwMessage && (
          <p className={`mt-2 text-xs ${pwMessage.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {pwMessage.text}
          </p>
        )}
      </div>
    </GlassCard>
  );
}
