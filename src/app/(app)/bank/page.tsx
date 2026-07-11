"use client";

import { useState } from "react";
import {
  BankAccountList,
  type BankSelection,
} from "@/components/wallai/bank-account-list";
import { StatementUpload } from "@/components/wallai/statement-upload";
import { TransactionList } from "@/components/wallai/transaction-list";

export default function BankPage() {
  const [selection, setSelection] = useState<BankSelection | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  function handleImported() {
    setRefreshToken((t) => t + 1);
  }

  const accountForUpload =
    selection?.kind === "account" ? selection.account : null;

  return (
    <div>
      <h2 className="mb-6 section-title">Bank Statements</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <BankAccountList onSelect={setSelection} selection={selection} />
          <StatementUpload
            bankAccountId={accountForUpload?.id ?? null}
            bankAccountName={accountForUpload?.name ?? null}
            disabledReason={
              selection?.kind === "institution"
                ? "Pick a subaccount to upload a statement."
                : null
            }
            onImported={handleImported}
          />
        </div>
        <div className="lg:col-span-2">
          <TransactionList
            bankAccountId={selection?.kind === "account" ? selection.id : null}
            institutionId={selection?.kind === "institution" ? selection.id : null}
            refreshToken={refreshToken}
          />
        </div>
      </div>
    </div>
  );
}
