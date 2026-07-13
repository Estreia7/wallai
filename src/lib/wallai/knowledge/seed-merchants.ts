// Built-in dictionary of common Portuguese / European merchants → category.
// Matched deterministically against the raw (uppercased) bank description
// BEFORE any AI call. This is the biggest lever for cutting "Other Expense"
// and AI cost: the vast majority of everyday transactions hit a known chain.
//
// Bias: only include merchants whose category is unambiguous. When a brand
// spans categories (e.g. a hypermarket that also sells fuel), pick the
// dominant everyday use. Users can always correct, and corrections win.
//
// Keywords are matched as case-insensitive substrings on the ORIGINAL
// description (not the normalized key) so bank prefixes/suffixes don't hide
// them. Keep keywords specific enough to avoid false positives.

export type SeedMerchant = {
  /** Uppercase substrings; ANY match assigns the category. */
  keywords: string[];
  category: string;
  /** Clean merchant name for display / learned rules. */
  displayName: string;
  /** Monthly-bill-ish? Feeds isLikelyRecurring downstream. */
  recurring?: boolean;
};

// NOTE: categories here must exist in the default taxonomy. Once user-defined
// categories land, unknown categories from this list are ignored per-user.
export const SEED_MERCHANTS: SeedMerchant[] = [
  // ── Groceries (PT + ES chains) ──────────────────────────────
  { keywords: ["PINGO DOCE", "PINGODOCE"], category: "Groceries", displayName: "Pingo Doce" },
  { keywords: ["CONTINENTE"], category: "Groceries", displayName: "Continente" },
  { keywords: ["LIDL"], category: "Groceries", displayName: "Lidl" },
  { keywords: ["ALDI"], category: "Groceries", displayName: "Aldi" },
  { keywords: ["INTERMARCHE"], category: "Groceries", displayName: "Intermarché" },
  { keywords: ["MINIPRECO", "MINIPREÇO"], category: "Groceries", displayName: "Minipreço" },
  { keywords: ["AUCHAN", "JUMBO"], category: "Groceries", displayName: "Auchan" },
  { keywords: ["MERCADONA"], category: "Groceries", displayName: "Mercadona" },
  { keywords: ["EL CORTE INGLES SUPER", "SUPERCOR"], category: "Groceries", displayName: "El Corte Inglés Super" },
  { keywords: ["CARREFOUR"], category: "Groceries", displayName: "Carrefour" },
  { keywords: ["FROIZ"], category: "Groceries", displayName: "Froiz" },
  { keywords: ["MERCEARIA", "TALHO", "PADARIA", "FRUTARIA"], category: "Groceries", displayName: "Local Grocer" },

  // ── Dining / delivery / coffee ──────────────────────────────
  { keywords: ["UBER EATS", "UBEREATS"], category: "Dining", displayName: "Uber Eats" },
  { keywords: ["GLOVO"], category: "Dining", displayName: "Glovo" },
  { keywords: ["BOLT FOOD", "BOLTFOOD"], category: "Dining", displayName: "Bolt Food" },
  { keywords: ["MCDONALD", "MC DONALD"], category: "Dining", displayName: "McDonald's" },
  { keywords: ["BURGER KING"], category: "Dining", displayName: "Burger King" },
  { keywords: ["KFC"], category: "Dining", displayName: "KFC" },
  { keywords: ["TELEPIZZA", "DOMINO", "PIZZA HUT"], category: "Dining", displayName: "Pizza" },
  { keywords: ["STARBUCKS"], category: "Dining", displayName: "Starbucks" },
  { keywords: ["RESTAURANTE", "TASCA", "CERVEJARIA", "MARISQUEIRA", "CAFE ", "CAFETARIA", "SNACK BAR", "PASTELARIA"], category: "Dining", displayName: "Restaurant" },

  // ── Transport ───────────────────────────────────────────────
  { keywords: ["UBER"], category: "Transport", displayName: "Uber" }, // after UBER EATS above
  { keywords: ["BOLT"], category: "Transport", displayName: "Bolt" }, // after BOLT FOOD above
  { keywords: ["FREENOW", "FREE NOW"], category: "Transport", displayName: "FreeNow" },
  { keywords: ["CP ", "COMBOIOS", "COMB DE PORTUGAL"], category: "Transport", displayName: "CP - Comboios" },
  { keywords: ["METRO DE LISBOA", "METROPOLITANO", "CARRIS", "METRO DO PORTO", "STCP", "TRANSPORTES"], category: "Transport", displayName: "Public Transit" },
  { keywords: ["VIA VERDE", "VIAVERDE", "PORTAGEM", "BRISA"], category: "Transport", displayName: "Via Verde / Tolls" },
  { keywords: ["GALP", "BP ", "REPSOL", "CEPSA", "PRIO", "COMBUSTIVEL", "GASOLINA", "GASOLEO"], category: "Transport", displayName: "Fuel" },
  { keywords: ["FLIXBUS", "REDE EXPRESSOS", "RENFE"], category: "Transport", displayName: "Coach / Rail" },

  // ── Bills & Utilities (recurring) ───────────────────────────
  { keywords: ["EDP", "ENDESA", "IBERDROLA", "GALP ENERGIA", "GOLDENERGY", "GOLD ENERGY", "REPSOL LUZ"], category: "Bills & Utilities", displayName: "Energy", recurring: true },
  { keywords: ["EPAL", "AGUAS DE", "AGUAS DO", "SMAS", "INDAQUA"], category: "Bills & Utilities", displayName: "Water", recurring: true },
  { keywords: ["MEO", "NOS ", "VODAFONE", "NOWO", "DIGI"], category: "Bills & Utilities", displayName: "Telecom", recurring: true },

  // ── Subscriptions (recurring) ───────────────────────────────
  { keywords: ["NETFLIX"], category: "Subscriptions", displayName: "Netflix", recurring: true },
  { keywords: ["SPOTIFY"], category: "Subscriptions", displayName: "Spotify", recurring: true },
  { keywords: ["DISNEY"], category: "Subscriptions", displayName: "Disney+", recurring: true },
  { keywords: ["HBO", "MAX.COM"], category: "Subscriptions", displayName: "HBO Max", recurring: true },
  { keywords: ["AMAZON PRIME", "PRIME VIDEO"], category: "Subscriptions", displayName: "Amazon Prime", recurring: true },
  { keywords: ["YOUTUBE PREMIUM", "GOOGLE YOUTUBE"], category: "Subscriptions", displayName: "YouTube Premium", recurring: true },
  { keywords: ["ICLOUD", "APPLE.COM/BILL", "APPLE COM BILL"], category: "Subscriptions", displayName: "Apple", recurring: true },
  { keywords: ["GOOGLE STORAGE", "GOOGLE ONE"], category: "Subscriptions", displayName: "Google One", recurring: true },
  { keywords: ["OPENAI", "CHATGPT", "ANTHROPIC", "CLAUDE.AI"], category: "Subscriptions", displayName: "AI Subscription", recurring: true },
  { keywords: ["MICROSOFT", "OFFICE 365", "MICROSOFT 365"], category: "Subscriptions", displayName: "Microsoft 365", recurring: true },
  { keywords: ["ADOBE"], category: "Subscriptions", displayName: "Adobe", recurring: true },
  { keywords: ["GITHUB", "VERCEL", "NOTION", "CLOUDFLARE", "DIGITALOCEAN", "HETZNER", "AWS", "AMAZON WEB"], category: "Subscriptions", displayName: "SaaS / Cloud", recurring: true },

  // ── Shopping ────────────────────────────────────────────────
  { keywords: ["AMAZON", "AMZN"], category: "Shopping", displayName: "Amazon" },
  { keywords: ["ALIEXPRESS", "ALITOOLS", "TEMU", "SHEIN", "WISH"], category: "Shopping", displayName: "Online Marketplace" },
  { keywords: ["WORTEN", "FNAC", "MEDIA MARKT", "MEDIAMARKT", "RADIO POPULAR"], category: "Shopping", displayName: "Electronics" },
  { keywords: ["IKEA", "LEROY MERLIN", "AKI", "MAXMAT", "CONFORAMA"], category: "Shopping", displayName: "Home & DIY" },
  { keywords: ["ZARA", "H&M", "H E M", "BERSHKA", "PULL", "STRADIVARIUS", "PRIMARK", "MANGO", "DECATHLON", "SPORT ZONE", "SPRINGFIELD"], category: "Shopping", displayName: "Clothing" },

  // ── Health ──────────────────────────────────────────────────
  { keywords: ["FARMACIA", "FARMÁCIA", "WELLS", "PHARMACY"], category: "Health", displayName: "Pharmacy" },
  { keywords: ["HOSPITAL", "CLINICA", "CLÍNICA", "CUF", "LUSIADAS", "CENTRO MEDICO", "MEDICO", "DENTISTA", "ANALISES", "LABORATORIO"], category: "Health", displayName: "Medical" },
  { keywords: ["GINASIO", "GINÁSIO", "FITNESS", "HOLMES PLACE", "FITNESS HUT", "GYM", "PADEL"], category: "Health", displayName: "Fitness", recurring: true },

  // ── Entertainment ───────────────────────────────────────────
  { keywords: ["CINEMA", "NOS CINEMAS", "CINEPLACE", "UCI"], category: "Entertainment", displayName: "Cinema" },
  { keywords: ["STEAM", "PLAYSTATION", "XBOX", "NINTENDO", "EPIC GAMES"], category: "Entertainment", displayName: "Gaming" },
  { keywords: ["FEVER", "TICKETLINE", "BLUETICKET", "EVENTBRITE", "SEETICKETS"], category: "Entertainment", displayName: "Events / Tickets" },

  // ── Travel ──────────────────────────────────────────────────
  { keywords: ["RYANAIR", "TAP ", "TAP PORTUGAL", "EASYJET", "VUELING", "IBERIA", "LUFTHANSA", "WIZZ AIR"], category: "Travel", displayName: "Airline" },
  { keywords: ["BOOKING.COM", "BOOKING COM", "AIRBNB", "HOTELS.COM", "EXPEDIA", "TRIVAGO"], category: "Travel", displayName: "Accommodation" },
  { keywords: ["HERTZ", "AVIS", "EUROPCAR", "SIXT", "GOLDCAR", "RENT A CAR"], category: "Travel", displayName: "Car Rental" },

  // ── Cash / ATM ──────────────────────────────────────────────
  { keywords: ["LEVANTAMENTO", "MULTIBANCO ATM", "SAQUE", "ATM "], category: "Cash", displayName: "Cash Withdrawal" },

  // ── Fees / bank ─────────────────────────────────────────────
  { keywords: ["COMISSAO", "COMISSÃO", "IMPOSTO SELO", "IMP. SELO", "MANUTENCAO", "MANUTENÇÃO", "JUROS", "ANUIDADE", "ENCARGOS"], category: "Fees", displayName: "Bank Fees" },

  // ── Income ──────────────────────────────────────────────────
  { keywords: ["ORDENADO", "VENCIMENTO", "SALARIO", "SALÁRIO", "PAYROLL"], category: "Salary", displayName: "Salary" },
  { keywords: ["REEMBOLSO", "REFUND", "ESTORNO", "DEVOLUCAO"], category: "Refund", displayName: "Refund" },
  { keywords: ["JUROS CREDORES", "JUROS A CREDITO"], category: "Interest", displayName: "Interest" },
];

/**
 * Match a raw bank description against the seed dictionary.
 * Returns the first matching entry, or null. Keyword order within the list
 * matters: more-specific entries (UBER EATS) must precede broader ones (UBER).
 */
export function matchSeedMerchant(
  description: string,
  amount: number,
): SeedMerchant | null {
  const up = (description || "").toUpperCase();
  for (const m of SEED_MERCHANTS) {
    if (!m.keywords.some((k) => up.includes(k))) continue;
    // Sign guard: never assign an expense category to a positive amount,
    // nor an income category to a negative one. Ambiguous → skip, let AI decide.
    const isIncomeCat = INCOME_CAT_NAMES.has(m.category);
    if (isIncomeCat && amount < 0) continue;
    if (!isIncomeCat && amount > 0) continue;
    return m;
  }
  return null;
}

const INCOME_CAT_NAMES = new Set(["Salary", "Freelance", "Refund", "Interest", "Other Income"]);
