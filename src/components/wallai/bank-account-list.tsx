"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GlassCard } from "./glass-card";
import { Modal } from "./modal";
import {
  BankAccountForm,
  type BankAccountFormValue,
  type InstitutionOption,
} from "./bank-account-form";
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
  institutionId: string | null;
  createdAt: string;
};

export type Institution = { id: string; name: string; createdAt: string };

export type BankSelection =
  | { kind: "account"; id: string; account: BankAccount }
  | { kind: "institution"; id: string; institution: Institution; accounts: BankAccount[] };

type Group = {
  institution: Institution | null;
  accounts: BankAccount[];
};

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function BankAccountList({
  onSelect,
  selection,
}: {
  onSelect?: (selection: BankSelection | null) => void;
  selection: BankSelection | null;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [accRes, instRes] = await Promise.all([
      fetch("/api/wallai/bank-accounts"),
      fetch("/api/wallai/institutions"),
    ]);
    const accData = await accRes.json();
    const instData = await instRes.json();
    const nextAccounts: BankAccount[] = accData.accounts || [];
    const nextInstitutions: Institution[] = instData.institutions || [];
    setAccounts(nextAccounts);
    setInstitutions(nextInstitutions);
    setExpanded((prev) => {
      const next: Record<string, boolean> = { ...prev };
      for (const inst of nextInstitutions) {
        if (next[inst.id] === undefined) next[inst.id] = true;
      }
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const groups = useMemo<Group[]>(() => {
    const byInstitution = new Map<string, BankAccount[]>();
    const ungrouped: BankAccount[] = [];
    for (const acc of accounts) {
      if (acc.institutionId) {
        const bucket = byInstitution.get(acc.institutionId) ?? [];
        bucket.push(acc);
        byInstitution.set(acc.institutionId, bucket);
      } else {
        ungrouped.push(acc);
      }
    }
    const result: Group[] = institutions.map((inst) => ({
      institution: inst,
      accounts: byInstitution.get(inst.id) ?? [],
    }));
    if (ungrouped.length > 0) {
      result.push({ institution: null, accounts: ungrouped });
    }
    return result;
  }, [accounts, institutions]);

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
        institutionId: value.institutionId,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to save");
    }

    setModalOpen(false);
    setEditing(null);
    await load();
  }

  async function handleDelete(account: BankAccount) {
    if (!confirm("Delete this account and all its transactions?")) return;
    await fetch(`/api/wallai/bank-accounts/${account.id}`, { method: "DELETE" });
    if (selection?.kind === "account" && selection.id === account.id) {
      onSelect?.(null);
    }
    await load();
  }

  async function createInstitution(name: string): Promise<InstitutionOption> {
    const res = await fetch("/api/wallai/institutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to create institution");
    }
    await load();
    return { id: data.institution.id, name: data.institution.name };
  }

  function toggle(instId: string) {
    setExpanded((prev) => ({ ...prev, [instId]: !prev[instId] }));
  }

  function selectAccount(account: BankAccount) {
    onSelect?.({ kind: "account", id: account.id, account });
  }

  function selectInstitution(inst: Institution, instAccounts: BankAccount[]) {
    onSelect?.({ kind: "institution", id: inst.id, institution: inst, accounts: instAccounts });
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
          <p className="text-xs text-white/70">Loading...</p>
        ) : accounts.length === 0 && institutions.length === 0 ? (
          <p className="text-xs text-white/70">No accounts yet. Add one to start tracking.</p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <GroupBlock
                key={group.institution?.id ?? "__ungrouped__"}
                group={group}
                expanded={group.institution ? !!expanded[group.institution.id] : true}
                onToggle={group.institution ? () => toggle(group.institution!.id) : undefined}
                selection={selection}
                onSelectAccount={selectAccount}
                onSelectInstitution={selectInstitution}
                onEditAccount={(account) => {
                  setEditing(account);
                  setModalOpen(true);
                }}
                onDeleteAccount={handleDelete}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end border-t border-white/5 pt-3">
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="text-[11px] text-white/70 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Manage institutions
          </button>
        </div>
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
          institutions={institutions.map((i) => ({ id: i.id, name: i.name }))}
          onSubmit={handleSubmit}
          onCancel={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onCreateInstitution={createInstitution}
        />
      </Modal>

      <Modal
        isOpen={manageOpen}
        onClose={() => setManageOpen(false)}
        title="Manage Institutions"
      >
        <ManageInstitutions
          institutions={institutions}
          accounts={accounts}
          onChange={load}
          onDeleted={(id) => {
            if (selection?.kind === "institution" && selection.id === id) {
              onSelect?.(null);
            }
          }}
        />
      </Modal>
    </>
  );
}

function GroupBlock({
  group,
  expanded,
  onToggle,
  selection,
  onSelectAccount,
  onSelectInstitution,
  onEditAccount,
  onDeleteAccount,
}: {
  group: Group;
  expanded: boolean;
  onToggle?: () => void;
  selection: BankSelection | null;
  onSelectAccount: (account: BankAccount) => void;
  onSelectInstitution: (inst: Institution, accounts: BankAccount[]) => void;
  onEditAccount: (account: BankAccount) => void;
  onDeleteAccount: (account: BankAccount) => void;
}) {
  const { institution, accounts } = group;
  const isInstSelected =
    institution !== null &&
    selection?.kind === "institution" &&
    selection.id === institution.id;

  const total = useMemo(() => {
    const byCurrency = new Map<string, number>();
    for (const acc of accounts) {
      byCurrency.set(acc.currency, (byCurrency.get(acc.currency) ?? 0) + acc.currentBalance);
    }
    return Array.from(byCurrency.entries());
  }, [accounts]);

  return (
    <div className="space-y-1.5">
      {institution && (
        <div
          className={`flex items-center gap-1 rounded-xl border px-1.5 py-1.5 transition-colors ${
            isInstSelected
              ? "border-emerald-400/40 bg-emerald-500/10"
              : "border-white/5 bg-white/[0.03] hover:bg-white/5"
          }`}
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse" : "Expand"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onSelectInstitution(institution, accounts)}
            className="flex-1 text-left"
          >
            <p className="text-sm font-semibold text-white/90">{institution.name}</p>
            <p className="text-[10px] text-white/70">
              {accounts.length === 0
                ? "No accounts"
                : total
                    .map(([cur, amt]) => formatCurrency(amt, cur))
                    .join(" · ")}
            </p>
          </button>
        </div>
      )}

      {(!institution || expanded) && (
        <div className={institution ? "space-y-1.5 pl-3" : "space-y-1.5"}>
          {accounts.length === 0 && institution ? (
            <p className="pl-2 text-[10px] text-white/50">No accounts under this institution.</p>
          ) : (
            accounts.map((account) => {
              const isSelected =
                selection?.kind === "account" && selection.id === account.id;
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
                    onClick={() => onSelectAccount(account)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white/90">{account.name}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wider text-white/50">
                        {bankAccountTypeLabel(account.type)}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/70">
                      {formatCurrency(account.currentBalance, account.currency)}
                    </p>
                  </button>
                  <div className="flex gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAccount(account);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 sm:h-8 sm:w-8 sm:hover:bg-white/10 sm:hover:text-white"
                      aria-label="Edit"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAccount(account);
                      }}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-white/70 sm:h-8 sm:w-8 sm:hover:bg-red-500/10 sm:hover:text-red-400"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function ManageInstitutions({
  institutions,
  accounts,
  onChange,
  onDeleted,
}: {
  institutions: Institution[];
  accounts: BankAccount[];
  onChange: () => Promise<void>;
  onDeleted: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const countsById = useMemo(() => {
    const counts = new Map<string, number>();
    for (const acc of accounts) {
      if (!acc.institutionId) continue;
      counts.set(acc.institutionId, (counts.get(acc.institutionId) ?? 0) + 1);
    }
    return counts;
  }, [accounts]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/wallai/institutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      setNewName("");
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/wallai/institutions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename");
      setEditingId(null);
      setEditingName("");
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    const count = countsById.get(id) ?? 0;
    const msg =
      count > 0
        ? `Delete "${name}"? Its ${count} account${count === 1 ? "" : "s"} will move to Ungrouped.`
        : `Delete "${name}"?`;
    if (!confirm(msg)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/wallai/institutions/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete");
      }
      onDeleted(id);
      await onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleCreate} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New institution name"
          disabled={busy}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-emerald-400/50 focus:ring-1 focus:ring-emerald-400/30"
        />
        <button
          type="submit"
          disabled={busy || !newName.trim()}
          className="rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-110 disabled:opacity-40"
        >
          + New
        </button>
      </form>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {institutions.length === 0 ? (
        <p className="text-xs text-white/70">No institutions yet.</p>
      ) : (
        <div className="space-y-2">
          {institutions.map((inst) => {
            const count = countsById.get(inst.id) ?? 0;
            const isEditing = editingId === inst.id;
            return (
              <div
                key={inst.id}
                className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2"
              >
                {isEditing ? (
                  <>
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white outline-none focus:border-emerald-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(inst.id)}
                      disabled={busy}
                      className="rounded-lg bg-emerald-500/80 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditingName("");
                      }}
                      disabled={busy}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm text-white/90">{inst.name}</p>
                      <p className="text-[10px] text-white/70">
                        {count} account{count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(inst.id);
                        setEditingName(inst.name);
                      }}
                      className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white"
                      aria-label="Rename"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(inst.id, inst.name)}
                      className="rounded-lg p-2 text-white/50 hover:bg-red-500/10 hover:text-red-400"
                      aria-label="Delete"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
