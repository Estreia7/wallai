"use client";

import { useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import {
  StatementReviewTable,
  type ReviewTransaction,
  type ReviewDetectedAccount,
  type ReviewConfirmPayload,
} from "./statement-review-table";

type ParseResult = {
  transactions: ReviewTransaction[];
  primaryBalance: number | null;
  detectedAccounts: ReviewDetectedAccount[];
  fileName: string;
  fileType: string;
  storagePath: string;
};

export function StatementUpload({
  bankAccountId,
  bankAccountName,
  disabledReason,
  onImported,
}: {
  bankAccountId: string | null;
  bankAccountName: string | null;
  disabledReason?: string | null;
  onImported: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function handleFile(file: File) {
    if (!bankAccountId) {
      setError("Select a bank account first");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bankAccountId", bankAccountId);

    try {
      const res = await fetch("/api/wallai/statements/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to parse statement");
      }

      const hasTransactions = Array.isArray(data.transactions) && data.transactions.length > 0;
      const hasDetected = Array.isArray(data.detectedAccounts) && data.detectedAccounts.length > 0;
      const hasBalance = typeof data.primaryBalance === "number";

      if (!hasTransactions && !hasDetected && !hasBalance) {
        setError("Nothing parseable was found in the file");
        setUploading(false);
        return;
      }

      setParseResult({
        transactions: data.transactions ?? [],
        primaryBalance: data.primaryBalance ?? null,
        detectedAccounts: data.detectedAccounts ?? [],
        fileName: data.fileName,
        fileType: data.fileType,
        storagePath: data.storagePath,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }

    setUploading(false);
  }

  async function handleConfirm(payload: ReviewConfirmPayload) {
    if (!parseResult || !bankAccountId) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/wallai/statements/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankAccountId,
          fileName: parseResult.fileName,
          fileType: parseResult.fileType,
          storagePath: parseResult.storagePath,
          transactions: payload.transactions,
          primaryBalance: parseResult.primaryBalance,
          detectedAccounts: payload.detectedAccounts,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to import transactions");
      }

      const imported = typeof data.imported === "number" ? data.imported : 0;
      const skipped = typeof data.skipped === "number" ? data.skipped : 0;
      const createdAccounts =
        typeof data.createdAccounts === "number" ? data.createdAccounts : 0;

      const parts: string[] = [];
      parts.push(`${imported} imported`);
      if (skipped > 0) parts.push(`${skipped} duplicate${skipped === 1 ? "" : "s"} skipped`);
      if (createdAccounts > 0) {
        parts.push(
          `${createdAccounts} new account${createdAccounts === 1 ? "" : "s"} created`
        );
      }
      setSuccess(parts.join(" • "));

      setParseResult(null);
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setSaving(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <>
      <GlassCard>
        <h3 className="mb-3 text-sm font-semibold text-white">Upload Statement</h3>

        {!bankAccountId ? (
          <p className="text-xs text-white/70">
            {disabledReason ?? "Select a bank account above to upload statements."}
          </p>
        ) : (
          <>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                dragActive
                  ? "border-emerald-400/50 bg-emerald-500/5"
                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
              }`}
            >
              <input
                type="file"
                accept=".pdf,.csv,.xlsx,.xls"
                onChange={onFileInputChange}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <p className="text-sm text-white/60">Parsing with Claude...</p>
              ) : (
                <>
                  <svg className="mb-2 h-8 w-8 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs text-white/60">
                    Drop a file for <span className="font-medium text-white/80">{bankAccountName}</span>
                  </p>
                  <p className="mt-1 text-[10px] text-white/50">PDF, CSV, or Excel</p>
                </>
              )}
            </label>

            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            {success && <p className="mt-3 text-xs text-emerald-400">✓ {success}</p>}
          </>
        )}
      </GlassCard>

      <Modal
        isOpen={parseResult !== null}
        onClose={() => {
          if (!saving) setParseResult(null);
        }}
        title="Review Statement"
        size="lg"
      >
        {parseResult && (
          <StatementReviewTable
            transactions={parseResult.transactions}
            primaryBalance={parseResult.primaryBalance}
            detectedAccounts={parseResult.detectedAccounts}
            onConfirm={handleConfirm}
            onCancel={() => setParseResult(null)}
            saving={saving}
          />
        )}
      </Modal>
    </>
  );
}
