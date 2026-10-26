"use client";

import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GradientBg } from "@/components/wallai/gradient-bg";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none backdrop-blur-sm transition-colors focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { status, data: session, update } = useSession();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const forced = session?.user?.mustChangePassword === true;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Pick a password different from the current one.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/wallai/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not change the password. Try again.");
      setSaving(false);
      return;
    }

    // Refresh the client session so the app shell stops redirecting here.
    await update();
    router.push("/dashboard");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <div className="relative flex min-h-screen items-center justify-center">
        <GradientBg />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <GradientBg />

      <div className="relative z-10 w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {forced ? "Set your password" : "Change password"}
          </h1>
          <p className="mt-2 text-sm text-white/70">
            {forced
              ? "This account is still using the temporary password. Choose your own to continue."
              : "Enter your current password and pick a new one."}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="current" className="mb-1.5 block text-sm font-medium text-white/60">
                Current password
              </label>
              <input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClass}
                autoComplete="current-password"
                required
              />
            </div>

            <div>
              <label htmlFor="new" className="mb-1.5 block text-sm font-medium text-white/60">
                New password
              </label>
              <input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <p className="mt-1.5 text-xs text-white/50">At least 8 characters.</p>
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-white/60">
                Confirm new password
              </label>
              <input
                id="confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <InteractiveHoverButton
              type="submit"
              disabled={saving}
              className="w-full"
              text={saving ? "Saving..." : "Save new password"}
            />
          </form>
        </div>

        {!forced && (
          <p className="mt-6 text-center text-xs text-white/50">
            <a href="/dashboard" className="text-white/60 transition-colors hover:text-emerald-300">
              ← Back to dashboard
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
