import { projectYear } from "./budget-projection";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

// simple run-rate, no recurring bills
{
  const p = projectYear({ actualIncome: 12000, actualExpense: 6000, monthsElapsed: 6, recurringBillsTotal: 0 });
  assert(p.projectedIncome === 24000, `income 24000, got ${p.projectedIncome}`);
  assert(p.projectedExpense === 12000, `expense 12000, got ${p.projectedExpense}`);
  assert(p.projectedNet === 12000, `net 12000, got ${p.projectedNet}`);
  assert(p.monthsLeft === 6, "monthsLeft 6");
}

// recurring floor raises remaining-month spend above the run-rate average
{
  const p = projectYear({ actualIncome: 6000, actualExpense: 3000, monthsElapsed: 6, recurringBillsTotal: 800 });
  // avgMonthlyExpense=500 < 800 -> floor to 800; 3000 + 800*6 = 7800
  assert(p.projectedExpense === 7800, `expense 7800, got ${p.projectedExpense}`);
}

// December: no months left -> projection equals actuals
{
  const p = projectYear({ actualIncome: 10000, actualExpense: 8000, monthsElapsed: 12, recurringBillsTotal: 500 });
  assert(p.projectedIncome === 10000 && p.projectedExpense === 8000, "December = actuals");
  assert(p.monthsLeft === 0, "monthsLeft 0");
}

// zero months elapsed is safe (no division by zero)
{
  const p = projectYear({ actualIncome: 0, actualExpense: 0, monthsElapsed: 0, recurringBillsTotal: 0 });
  assert(p.projectedIncome === 0 && p.projectedExpense === 0, "empty stays zero");
}
console.log("budget-projection.test.ts PASSED");
