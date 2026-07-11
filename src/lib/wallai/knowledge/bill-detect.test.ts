import { selectRecurringCandidates } from "./bill-detect";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

const txs = [
  { date: "2026-01-10", description: "PAGAMENTO SERVICOS EDP", amount: -60 },
  { date: "2026-02-10", description: "PAGAMENTO SERVICOS EDP", amount: -62 },
  { date: "2026-03-10", description: "PAGAMENTO SERVICOS EDP", amount: -61 },
  { date: "2026-01-05", description: "COMPRA PINGO DOCE", amount: -14 },
  { date: "2026-01-06", description: "COMPRA PINGO DOCE", amount: -80 },
];
const out = selectRecurringCandidates(txs);
assert(out.length === 1, `one candidate, got ${out.length}`);
assert(out[0].merchantKey === "edp", `edp key, got ${out[0].merchantKey}`);
assert(out[0].monthsSeen === 3, "3 months");
assert(Math.abs(out[0].avgAmount - 61) < 1.5, "avg ~61");
console.log("bill-detect.test.ts PASSED");
