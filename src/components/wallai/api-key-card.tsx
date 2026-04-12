"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./glass-card";

export function ApiKeyCard() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/wallai/api-key")
      .then((res) => res.json())
      .then((data) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (res.ok) {
      setConfigured(true);
      setApiKey("");
      setMessage({ type: "success", text: "API key saved securely." });
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage({ type: "error", text: data.error || "Failed to save API key." });
    }
    setSaving(false);
  }

  async function handleRemove() {
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/wallai/api-key", { method: "DELETE" });

    if (res.ok) {
      setConfigured(false);
      setMessage({ type: "success", text: "API key removed." });
    } else {
      setMessage({ type: "error", text: "Failed to remove API key." });
    }
    setSaving(false);
  }

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Anthropic API Key</h3>
          <p className="mt-1 text-xs text-white/40">
            Required for parsing bank statements and AI analysis. Get one at console.anthropic.com.
          </p>
        </div>
        {configured !== null && (
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              configured ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-white/40"
            }`}
          >
            {configured ? "Configured" : "Not set"}
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={configured ? "Enter new key to replace existing" : "sk-ant-..."}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-emerald-400/50 focus:bg-white/10 focus:ring-1 focus:ring-emerald-400/30"
          autoComplete="off"
        />
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || apiKey.length < 20}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:brightness-110 disabled:opacity-40"
          >
            {saving ? "Saving..." : configured ? "Replace key" : "Save key"}
          </button>
          {configured && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
      </form>

      {message && (
        <p
          className={`mt-3 text-xs ${
            message.type === "success" ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}
    </GlassCard>
  );
}
