"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import { BankAccountForm, type BankAccountFormValue } from "./bank-account-form";
import {
  bankAccountTypeLabel,
  type BankAccountType,
} from "@/lib/wallai/bank-account-types";

export type BankAccount = {
  id: string;
  name: string;
  currency: string;
  type: BankAccountType;
  currentBalance: number;
  createdAt: string;
};

export function BankAccountList({
  onSelect,
  selectedId,
}: {
  onSelect?: (account: BankAccount) => void;
  selectedId?: string | null;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);

  async function loadAccounts() {
    setLoading(true);
    const res = await fetch("/api/wallai/bank-accounts");
    const data = await res.json();
    setAccounts(data.accounts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function handleSubmit(value: BankAccountFormValue) {
    const url = value.id
      ? `/api/wallai/bank-accounts/${value.id}`
      : "/api/wallai/bank-accounts";
    const method = value.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: value.name,
        currency: value.currency,
        type: value.type,
        currentBalance: value.currentBalance,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to save");
    }

    setModalOpen(false);
    setEditing(null);
    await loadAccounts();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this account and all its transactions?")) return;
    await fetch(`/api/wallai/bank-accounts/${id}`, { method: "DELETE" });
    await loadAccounts();
  }

  return (
    <>
      <GlassCard>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Bank Accounts</h3>
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-xs font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110"
          >
            + Add
          </button>
        </div>

        {loading ? (
          <p className="text-xs text-white/40">Loading...</p>
        ) : accounts.length === 0 ? (
          <p className="text-xs text-white/40">No accounts yet. Add one to start tracking.</p>
        ) : (
          <div className="space-y-2">
            {accounts.map((account) => {
              const isSelected = selectedId === account.id;
              return (
                <div
                  key={account.id}
                  className={`group flex items-center justify-between rounded-xl border px-3 py-2.5 transition-colors ${
                    isSelected
                      ? "border-emerald-400/40 bg-emerald-500/10"
                      : "border-white/5 bg-white/[0.02] hover:bg-white/5"
                  }`}
                >
                  <button
                    onClick={() => onSelect?.(account)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/90">{account.name}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
                        {bankAccountTypeLabel(account.type)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/40">
                      {new Intl.NumberFormat("en-IE", {
                        style: "currency",
                        currency: account.currency,
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }).format(account.currentBalance)}
                    </p>
                  </button>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(account);
                        setModalOpen(true);
                      }}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                      aria-label="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(account.id);
                      }}
                      className="rounded-lg p-1.5 text-white/40 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit Bank Account" : "New Bank Account"}
      >
        <BankAccountForm
          initial={editing ?? undefined}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
        />
      </Modal>
    </>
  );
}
