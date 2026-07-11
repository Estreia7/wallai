import { higherSource, SOURCE_RANK } from "./matcher";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }

assert(SOURCE_RANK["user_correction"] > SOURCE_RANK["confirmed"], "correction > confirmed");
assert(SOURCE_RANK["confirmed"] > SOURCE_RANK["ai_guess"], "confirmed > ai_guess");
assert(higherSource("ai_guess", "confirmed") === "confirmed", "picks higher");
assert(higherSource("user_correction", "confirmed") === "user_correction", "correction wins");
console.log("matcher.test.ts PASSED");
