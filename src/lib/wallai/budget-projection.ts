export type Projection = {
  actualIncome: number;
  actualExpense: number;
  projectedIncome: number;
  projectedExpense: number;
  projectedNet: number;
  monthsElapsed: number;
  monthsLeft: number;
  recurringBillsTotal: number;
};

export function projectYear(input: {
  actualIncome: number;
  actualExpense: number;
  monthsElapsed: number;
  recurringBillsTotal: number;
}): Projection {
  const monthsElapsed = Math.max(0, Math.min(12, input.monthsElapsed));
  const monthsLeft = Math.max(0, 12 - monthsElapsed);
  const avgIncome = monthsElapsed > 0 ? input.actualIncome / monthsElapsed : 0;
  const avgExpense = monthsElapsed > 0 ? input.actualExpense / monthsElapsed : 0;
  const perRemainingMonthExpense = Math.max(avgExpense, input.recurringBillsTotal);

  const projectedIncome = input.actualIncome + avgIncome * monthsLeft;
  const projectedExpense = input.actualExpense + perRemainingMonthExpense * monthsLeft;

  return {
    actualIncome: input.actualIncome,
    actualExpense: input.actualExpense,
    projectedIncome,
    projectedExpense,
    projectedNet: projectedIncome - projectedExpense,
    monthsElapsed,
    monthsLeft,
    recurringBillsTotal: input.recurringBillsTotal,
  };
}
