"use client";

import { useState } from "react";
import { BankAccountList, type BankAccount } from "@/components/wallai/bank-account-list";
import { StatementUpload } from "@/components/wallai/statement-upload";
import { TransactionList } from "@/components/wallai/transaction-list";

export default function BankPage() {
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  function handleImported() {
    setRefreshToken((t) => t + 1);
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Bank Statements</h2>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <BankAccountList
            onSelect={setSelectedAccount}
            selectedId={selectedAccount?.id ?? null}
          />
          <StatementUpload
            bankAccountId={selectedAccount?.id ?? null}
            bankAccountName={selectedAccount?.name ?? null}
            onImported={handleImported}
          />
        </div>
        <div className="lg:col-span-2">
          <TransactionList
            bankAccountId={selectedAccount?.id ?? null}
            refreshToken={refreshToken}
          />
        </div>
      </div>
    </div>
  );
}
