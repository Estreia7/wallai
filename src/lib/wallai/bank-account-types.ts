export const BANK_ACCOUNT_TYPES = ["checking", "savings", "credit"] as const;
export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

export function isBankAccountType(value: string): value is BankAccountType {
  return (BANK_ACCOUNT_TYPES as readonly string[]).includes(value);
}

export function bankAccountTypeLabel(type: string): string {
  switch (type) {
    case "checking":
      return "Checking";
    case "savings":
      return "Savings";
    case "credit":
      return "Credit / Mortgage";
    default:
      return type;
  }
}
