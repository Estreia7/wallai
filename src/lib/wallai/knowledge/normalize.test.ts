import { normalizeMerchant } from "./normalize";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

// strips prefix, ref numbers and city -> stable key across branches
{
  const a = normalizeMerchant("COMPRA 1234 PINGO DOCE 4521 LISBOA");
  const b = normalizeMerchant("COMPRA PINGO DOCE 9987 PORTO");
  assert(a.merchantKey === b.merchantKey, "two Pingo Doce branches share a key");
  assert(a.merchantKey === "pingo doce", `key is 'pingo doce', got '${a.merchantKey}'`);
  assert(a.displayName === "Pingo Doce", `display 'Pingo Doce', got '${a.displayName}'`);
}

// distinct merchants must NOT collide (under-merge bias)
{
  const a = normalizeMerchant("PAGAMENTO SERVICOS EDP COMERCIAL");
  const b = normalizeMerchant("COMPRA CONTINENTE ONLINE");
  assert(a.merchantKey !== b.merchantKey, "EDP and Continente differ");
}

// strips MB WAY / dates / times
{
  const r = normalizeMerchant("MB WAY 12/03 21:44 GLOVO");
  assert(r.merchantKey === "glovo", `expected 'glovo', got '${r.merchantKey}'`);
}

// empty / junk input is safe
{
  const r = normalizeMerchant("   ");
  assert(typeof r.merchantKey === "string", "returns a string key for blank input");
}

console.log("normalize.test.ts PASSED");
