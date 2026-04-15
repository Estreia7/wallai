export const DEBT_TYPES = ["mortgage", "personal_loan", "car_loan", "student_loan", "other"] as const;
export type DebtType = (typeof DEBT_TYPES)[number];

export function isDebtType(v: unknown): v is DebtType {
  return typeof v === "string" && (DEBT_TYPES as readonly string[]).includes(v);
}

export function debtTypeLabel(t: DebtType): string {
  switch (t) {
    case "mortgage": return "Mortgage";
    case "personal_loan": return "Personal Loan";
    case "car_loan": return "Car Loan";
    case "student_loan": return "Student Loan";
    case "other": return "Other";
  }
}

export type PayoffProjection = {
  monthsRemaining: number | null;  // null if payment never covers interest
  totalInterest: number | null;
  payoffDate: Date | null;
  paymentCoversInterest: boolean;
};

/**
 * Amortization-based payoff projection.
 * Returns null months if monthly payment does not cover monthly interest.
 */
export function projectPayoff(
  currentBalance: number,
  annualInterestRate: number,
  monthlyPayment: number,
): PayoffProjection {
  if (currentBalance <= 0 || monthlyPayment <= 0) {
    return { monthsRemaining: 0, totalInterest: 0, payoffDate: new Date(), paymentCoversInterest: true };
  }

  const r = annualInterestRate / 100 / 12;

  if (r <= 0) {
    const months = Math.ceil(currentBalance / monthlyPayment);
    const payoffDate = new Date();
    payoffDate.setMonth(payoffDate.getMonth() + months);
    return { monthsRemaining: months, totalInterest: 0, payoffDate, paymentCoversInterest: true };
  }

  const monthlyInterest = currentBalance * r;
  if (monthlyPayment <= monthlyInterest) {
    return { monthsRemaining: null, totalInterest: null, payoffDate: null, paymentCoversInterest: false };
  }

  const months = Math.ceil(
    -Math.log(1 - (currentBalance * r) / monthlyPayment) / Math.log(1 + r),
  );
  const totalInterest = months * monthlyPayment - currentBalance;
  const payoffDate = new Date();
  payoffDate.setMonth(payoffDate.getMonth() + months);

  return { monthsRemaining: months, totalInterest, payoffDate, paymentCoversInterest: true };
}
