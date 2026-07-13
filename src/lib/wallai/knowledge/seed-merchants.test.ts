import { matchSeedMerchant } from "./seed-merchants";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

// Grocery chains
assert(matchSeedMerchant("COMPRA CONTACTLESS PINGO DOCE LISBOA", -42.1)?.category === "Groceries", "pingo doce");
assert(matchSeedMerchant("LIDL PORTO", -18)?.category === "Groceries", "lidl");

// Ordering: UBER EATS must win over UBER (specific before broad)
assert(matchSeedMerchant("UBER EATS AMSTERDAM", -22)?.category === "Dining", "uber eats -> dining");
assert(matchSeedMerchant("UBER TRIP HELP.UBER.COM", -9.5)?.category === "Transport", "uber -> transport");
assert(matchSeedMerchant("BOLT FOOD LISBOA", -15)?.category === "Dining", "bolt food -> dining");
assert(matchSeedMerchant("BOLT.EU RIDE", -7)?.category === "Transport", "bolt -> transport");

// Utilities & subscriptions carry recurring flag
const edp = matchSeedMerchant("DD EDP COMERCIAL 062024", -61.3);
assert(edp?.category === "Bills & Utilities" && edp.recurring === true, "edp recurring utility");
const netflix = matchSeedMerchant("NETFLIX.COM", -13.99);
assert(netflix?.category === "Subscriptions" && netflix.recurring === true, "netflix recurring sub");

// Sign guard: a positive amount must NOT get an expense category, and salary
// keywords must NOT apply to a negative amount.
assert(matchSeedMerchant("PINGO DOCE REEMBOLSO", 42.1) === null || matchSeedMerchant("PINGO DOCE REEMBOLSO", 42.1)?.category !== "Groceries", "positive not groceries");
assert(matchSeedMerchant("ORDENADO EMPRESA XPTO", 1500)?.category === "Salary", "salary income");
assert(matchSeedMerchant("ORDENADO EMPRESA XPTO", -1500) === null, "salary keyword ignored on expense");

// Unknown merchant -> null (falls through to AI)
assert(matchSeedMerchant("TRF REF 889321 004512", -150) === null, "unknown -> null");

console.log("seed-merchants.test.ts PASSED");
