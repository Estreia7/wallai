// Pure geometry for the budget money-flow (Sankey) diagram.
//
// Shape: income sources (left) -> a single "Income" hub (middle) ->
// expense categories + a "Savings" band (right). Every node and link
// is positioned in a unit-less [0,1] coordinate space so the SVG
// component can scale it to any width/height. Keeping this pure makes
// the layout unit-testable and the component a thin renderer.

export type SankeyInput = {
  income: { category: string; amount: number }[];
  expenses: { category: string; amount: number }[];
  net: number; // income - expenses; positive => a "Savings" band on the right
};

export type SankeySide = "left" | "middle" | "right";

export type SankeyNode = {
  id: string;
  label: string;
  side: SankeySide;
  amount: number;
  pct: number; // share of total income, 0–100
  // normalized rect in [0,1] space (y grows downward)
  y0: number;
  y1: number;
  tone: "income" | "hub" | "expense" | "savings";
};

export type SankeyLink = {
  source: string; // node id
  target: string; // node id
  amount: number;
  pct: number; // share of total income
  // normalized vertical band at each endpoint
  sy0: number;
  sy1: number;
  ty0: number;
  ty1: number;
  tone: "income" | "expense" | "savings";
};

export type SankeyLayout = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  total: number; // total income (the 100% reference)
};

// Fraction of vertical space reserved as gaps between stacked nodes.
const GAP_FRACTION = 0.14;

type Raw = { id: string; label: string; amount: number; tone: SankeyNode["tone"] };

// Stack a column of items into [0,1], distributing GAP_FRACTION evenly
// between them. Returns each item's [y0,y1] plus a cursor map by id.
function stack(items: Raw[], total: number): Map<string, { y0: number; y1: number }> {
  const out = new Map<string, { y0: number; y1: number }>();
  if (items.length === 0 || total <= 0) return out;
  const gaps = items.length > 1 ? items.length - 1 : 0;
  const gapEach = gaps > 0 ? GAP_FRACTION / gaps : 0;
  const usable = 1 - (gaps > 0 ? GAP_FRACTION : 0);
  let cursor = 0;
  for (let i = 0; i < items.length; i++) {
    const h = (items[i].amount / total) * usable;
    const y0 = cursor;
    const y1 = cursor + h;
    out.set(items[i].id, { y0, y1 });
    cursor = y1 + gapEach;
  }
  return out;
}

export function buildSankeyLayout(input: SankeyInput): SankeyLayout {
  const incomeItems = input.income
    .filter((d) => d.amount > 0)
    .map<Raw>((d) => ({ id: `in:${d.category}`, label: d.category, amount: d.amount, tone: "income" }));

  const total = incomeItems.reduce((s, d) => s + d.amount, 0);

  // Right column = expenses (+ a Savings band when net is positive), all
  // measured as a share of income so the middle hub balances left↔right.
  const rightItems: Raw[] = input.expenses
    .filter((d) => d.amount > 0)
    .map<Raw>((d) => ({ id: `ex:${d.category}`, label: d.category, amount: d.amount, tone: "expense" }));
  if (input.net > 0) {
    rightItems.push({ id: "savings", label: "Savings", amount: input.net, tone: "savings" });
  }

  const pct = (a: number) => (total > 0 ? (a / total) * 100 : 0);

  const leftStack = stack(incomeItems, total);
  // The right column sums to expenses+savings; when net<0 this exceeds
  // income, so scale the right column by its own sum to keep it in-frame.
  const rightSum = rightItems.reduce((s, d) => s + d.amount, 0);
  const rightStack = stack(rightItems, Math.max(rightSum, total));

  const nodes: SankeyNode[] = [];

  for (const it of incomeItems) {
    const p = leftStack.get(it.id)!;
    nodes.push({ id: it.id, label: it.label, side: "left", amount: it.amount, pct: pct(it.amount), y0: p.y0, y1: p.y1, tone: "income" });
  }

  // The hub spans the full column height (represents 100% of income).
  nodes.push({ id: "hub", label: "Income", side: "middle", amount: total, pct: 100, y0: 0, y1: 1, tone: "hub" });

  for (const it of rightItems) {
    const p = rightStack.get(it.id)!;
    nodes.push({ id: it.id, label: it.label, side: "right", amount: it.amount, pct: pct(it.amount), y0: p.y0, y1: p.y1, tone: it.tone });
  }

  const links: SankeyLink[] = [];

  // Left links: each income source feeds the hub, stacked on the hub in
  // the same order (top→down) so bands don't cross.
  let hubInCursor = 0;
  for (const it of incomeItems) {
    const s = leftStack.get(it.id)!;
    const h = it.amount / Math.max(total, 1e-9);
    const ty0 = hubInCursor;
    const ty1 = hubInCursor + h;
    hubInCursor = ty1;
    links.push({ source: it.id, target: "hub", amount: it.amount, pct: pct(it.amount), sy0: s.y0, sy1: s.y1, ty0, ty1, tone: "income" });
  }

  // Right links: the hub distributes into each right node, stacked on the
  // hub's outgoing side in the right column's order.
  let hubOutCursor = 0;
  for (const it of rightItems) {
    const t = rightStack.get(it.id)!;
    const h = it.amount / Math.max(total, 1e-9);
    const sy0 = hubOutCursor;
    const sy1 = hubOutCursor + h;
    hubOutCursor = sy1;
    // Right-column items are only ever "expense" or "savings" (never "hub").
    const tone: SankeyLink["tone"] = it.tone === "savings" ? "savings" : "expense";
    links.push({ source: "hub", target: it.id, amount: it.amount, pct: pct(it.amount), sy0, sy1, ty0: t.y0, ty1: t.y1, tone });
  }

  return { nodes, links, total };
}
