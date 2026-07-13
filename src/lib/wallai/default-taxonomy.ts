// The curated default category taxonomy seeded for every user. Groups and
// subcategories give the budget charts structure while staying string-based on
// Transaction.category. Users can rename, recolor, archive, or add their own.
//
// `parent` refers to another entry's `name` in this same list (must appear
// before its children for seeding order). Kept in one place so the seed helper,
// the fallback category list, and any docs stay in sync.

export type TaxonomyKind = "income" | "expense" | "transfer";

export type TaxonomyEntry = {
  name: string;
  kind: TaxonomyKind;
  group: string;
  parent?: string; // name of parent category
  color?: string;
  icon?: string;
};

// Group-level accent colors (used when a category has no explicit color).
export const GROUP_COLORS: Record<string, string> = {
  Income: "#34d399",
  Essentials: "#60a5fa",
  Transport: "#a78bfa",
  Lifestyle: "#f472b6",
  Financial: "#fbbf24",
  Transfers: "#94a3b8",
};

export const DEFAULT_TAXONOMY: TaxonomyEntry[] = [
  // ── Income ──────────────────────────────────────────────
  { name: "Salary", kind: "income", group: "Income", icon: "💼" },
  { name: "Freelance", kind: "income", group: "Income", icon: "🧾" },
  { name: "Interest", kind: "income", group: "Income", icon: "📈" },
  { name: "Refund", kind: "income", group: "Income", icon: "↩️" },
  { name: "Other Income", kind: "income", group: "Income", icon: "➕" },

  // ── Essentials ──────────────────────────────────────────
  { name: "Groceries", kind: "expense", group: "Essentials", icon: "🛒" },
  { name: "Housing", kind: "expense", group: "Essentials", icon: "🏠" },
  { name: "Rent", kind: "expense", group: "Essentials", parent: "Housing", icon: "🔑" },
  { name: "Bills & Utilities", kind: "expense", group: "Essentials", icon: "💡" },
  { name: "Energy", kind: "expense", group: "Essentials", parent: "Bills & Utilities", icon: "⚡" },
  { name: "Water", kind: "expense", group: "Essentials", parent: "Bills & Utilities", icon: "💧" },
  { name: "Internet & Phone", kind: "expense", group: "Essentials", parent: "Bills & Utilities", icon: "📶" },
  { name: "Health", kind: "expense", group: "Essentials", icon: "🩺" },
  { name: "Pharmacy", kind: "expense", group: "Essentials", parent: "Health", icon: "💊" },
  { name: "Insurance", kind: "expense", group: "Essentials", icon: "🛡️" },
  { name: "Kids", kind: "expense", group: "Essentials", icon: "🧸" },
  { name: "Pets", kind: "expense", group: "Essentials", icon: "🐾" },

  // ── Transport ───────────────────────────────────────────
  { name: "Transport", kind: "expense", group: "Transport", icon: "🚗" },
  { name: "Fuel", kind: "expense", group: "Transport", parent: "Transport", icon: "⛽" },
  { name: "Public Transit", kind: "expense", group: "Transport", parent: "Transport", icon: "🚈" },
  { name: "Ride-hailing", kind: "expense", group: "Transport", parent: "Transport", icon: "🚕" },
  { name: "Tolls & Parking", kind: "expense", group: "Transport", parent: "Transport", icon: "🅿️" },

  // ── Lifestyle ───────────────────────────────────────────
  { name: "Dining", kind: "expense", group: "Lifestyle", icon: "🍽️" },
  { name: "Coffee", kind: "expense", group: "Lifestyle", parent: "Dining", icon: "☕" },
  { name: "Shopping", kind: "expense", group: "Lifestyle", icon: "🛍️" },
  { name: "Clothing", kind: "expense", group: "Lifestyle", parent: "Shopping", icon: "👕" },
  { name: "Electronics", kind: "expense", group: "Lifestyle", parent: "Shopping", icon: "🎧" },
  { name: "Entertainment", kind: "expense", group: "Lifestyle", icon: "🎬" },
  { name: "Subscriptions", kind: "expense", group: "Lifestyle", icon: "🔁" },
  { name: "Travel", kind: "expense", group: "Lifestyle", icon: "✈️" },
  { name: "Fitness", kind: "expense", group: "Lifestyle", icon: "🏋️" },
  { name: "Gifts & Donations", kind: "expense", group: "Lifestyle", icon: "🎁" },

  // ── Financial ───────────────────────────────────────────
  { name: "Fees", kind: "expense", group: "Financial", icon: "🏦" },
  { name: "Taxes", kind: "expense", group: "Financial", icon: "🧮" },
  { name: "Savings", kind: "expense", group: "Financial", icon: "🐖" },
  { name: "Investments", kind: "expense", group: "Financial", icon: "📊" },
  { name: "Cash", kind: "expense", group: "Financial", icon: "💵" },
  { name: "Other Expense", kind: "expense", group: "Financial", icon: "❓" },

  // ── Transfers (excluded from totals) ────────────────────
  { name: "Transfer In", kind: "transfer", group: "Transfers", icon: "⬇️" },
  { name: "Transfer Out", kind: "transfer", group: "Transfers", icon: "⬆️" },
];

export const DEFAULT_INCOME_NAMES = DEFAULT_TAXONOMY.filter((c) => c.kind === "income").map((c) => c.name);
export const DEFAULT_EXPENSE_NAMES = DEFAULT_TAXONOMY.filter((c) => c.kind === "expense").map((c) => c.name);
export const DEFAULT_TRANSFER_NAMES = DEFAULT_TAXONOMY.filter((c) => c.kind === "transfer").map((c) => c.name);
