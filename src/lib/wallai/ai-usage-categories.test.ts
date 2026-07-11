import { endpointCategory } from "./ai-usage-categories";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

assert(endpointCategory("parse-statement") === "Statement parsing", "parse-statement");
assert(endpointCategory("categorize-transactions") === "Transaction categorization", "categorize");
assert(endpointCategory("detect-recurring-bills") === "Recurring-bill detection", "bills");
assert(endpointCategory("analysis-insight") === "Financial insights", "insights");
assert(endpointCategory("learn/ai-traits") === "Book analysis", "books");
assert(endpointCategory("something-else") === "Other", "fallback");
console.log("ai-usage-categories.test.ts PASSED");
