// Deterministic bank-description normalizer. Bias: UNDER-merge.
// Keeping two distinct merchants apart is safer than wrongly merging them.

const PREFIXES = [
  "COMPRA C DEB",
  "COMPRA CONTACTLESS",
  "COMPRA",
  "PAGAMENTO SERVICOS",
  "PAGAMENTO",
  "PAG.",
  "PAG ",
  "TRANSFERENCIA",
  "TRANSF",
  "TRF",
  "DEB DIR",
  "DEBITO DIRETO",
  "DD ",
  "MB WAY",
  "MBWAY",
  "LEVANTAMENTO",
  "COMPRAS",
];

// Conservative trailing-location tokens to drop.
const LOCATIONS = new Set([
  "LISBOA", "LISBON", "PORTO", "OPORTO", "COIMBRA", "BRAGA", "FARO",
  "SETUBAL", "AVEIRO", "ONLINE", "PT", "ESP", "PRT",
]);

function stripPrefixes(s: string): string {
  let out = s;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of PREFIXES) {
      if (out.startsWith(p + " ") || out === p) {
        out = out.slice(p.length).trimStart();
        changed = true;
      }
    }
  }
  return out;
}

export function normalizeMerchant(description: string): {
  merchantKey: string;
  displayName: string;
} {
  let s = (description || "").toUpperCase().trim();

  // remove dates and times
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  s = s.replace(/\b\d{1,2}[/.\-]\d{1,2}([/.\-]\d{2,4})?\b/g, " ");
  s = s.replace(/\b\d{1,2}:\d{2}\b/g, " ");

  s = stripPrefixes(s);

  // remove standalone digit runs of length >= 4 (card/ref/store numbers)
  s = s.replace(/\b\d{4,}\b/g, " ");
  // remove any remaining pure-number tokens
  s = s.replace(/\b\d+\b/g, " ");

  // collapse punctuation to spaces, squeeze whitespace
  s = s.replace(/[^A-Z ]+/g, " ").replace(/\s+/g, " ").trim();

  // drop trailing location tokens
  let tokens = s.split(" ").filter(Boolean);
  while (tokens.length > 1 && LOCATIONS.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }

  // keep up to first 3 meaningful tokens
  tokens = tokens.slice(0, 3);

  const merchantKey = tokens.join(" ").toLowerCase();
  const displayName = tokens
    .map((t) => t.charAt(0) + t.slice(1).toLowerCase())
    .join(" ");

  return { merchantKey, displayName };
}
