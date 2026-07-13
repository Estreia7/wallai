import { buildSankeyLayout } from "./sankey-layout";
function assert(c: unknown, m: string): asserts c { if (!c) throw new Error("FAIL: " + m); }
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

// basic: income splits into expenses + savings, percentages sum right
{
  const l = buildSankeyLayout({
    income: [{ category: "Salary", amount: 8000 }, { category: "Freelance", amount: 2000 }],
    expenses: [{ category: "Housing", amount: 3000 }, { category: "Food", amount: 1500 }],
    net: 5500,
  });
  assert(l.total === 10000, `total 10000, got ${l.total}`);
  const salary = l.nodes.find((n) => n.id === "in:Salary")!;
  assert(near(salary.pct, 80), `salary 80%, got ${salary.pct}`);
  const savings = l.nodes.find((n) => n.id === "savings")!;
  assert(savings && near(savings.pct, 55), `savings 55%, got ${savings?.pct}`);
  const hub = l.nodes.find((n) => n.id === "hub")!;
  assert(hub.pct === 100 && hub.y0 === 0 && hub.y1 === 1, "hub spans full height at 100%");
}

// hub incoming bands sum to full height (100% of income)
{
  const l = buildSankeyLayout({
    income: [{ category: "Salary", amount: 6000 }, { category: "Other Income", amount: 4000 }],
    expenses: [{ category: "Housing", amount: 5000 }],
    net: 5000,
  });
  const inLinks = l.links.filter((k) => k.target === "hub");
  const span = Math.max(...inLinks.map((k) => k.ty1)) - Math.min(...inLinks.map((k) => k.ty0));
  assert(near(span, 1), `hub incoming spans 1, got ${span}`);
  // bands are contiguous (no crossing): each ty0 equals previous ty1
  assert(near(inLinks[0].ty1, inLinks[1].ty0), "income bands contiguous on hub");
}

// negative net: no savings band, right column scaled to fit
{
  const l = buildSankeyLayout({
    income: [{ category: "Salary", amount: 5000 }],
    expenses: [{ category: "Housing", amount: 4000 }, { category: "Food", amount: 3000 }],
    net: -2000,
  });
  assert(!l.nodes.some((n) => n.id === "savings"), "no savings band when net negative");
  const housing = l.nodes.find((n) => n.id === "ex:Housing")!;
  assert(near(housing.pct, 80), `housing 80% of income, got ${housing.pct}`);
  // right nodes stay within [0,1]
  const maxY = Math.max(...l.nodes.filter((n) => n.side === "right").map((n) => n.y1));
  assert(maxY <= 1 + 1e-9, `right column within frame, got ${maxY}`);
}

// empty input is safe
{
  const l = buildSankeyLayout({ income: [], expenses: [], net: 0 });
  assert(l.total === 0 && l.links.length === 0, "empty layout safe");
  assert(l.nodes.length === 1 && l.nodes[0].id === "hub", "only hub node when empty");
}

// zero-amount categories are filtered out
{
  const l = buildSankeyLayout({
    income: [{ category: "Salary", amount: 1000 }, { category: "Refund", amount: 0 }],
    expenses: [{ category: "Housing", amount: 400 }, { category: "Cash", amount: 0 }],
    net: 600,
  });
  assert(!l.nodes.some((n) => n.id === "in:Refund"), "zero income filtered");
  assert(!l.nodes.some((n) => n.id === "ex:Cash"), "zero expense filtered");
}

console.log("sankey-layout.test.ts PASSED");
