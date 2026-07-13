import type { Category } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TAXONOMY, GROUP_COLORS } from "./default-taxonomy";

// ── Seeding ──────────────────────────────────────────────

/**
 * Ensure a user has the default category taxonomy. Idempotent: only creates
 * categories whose name doesn't already exist for the user, so it's safe to
 * call on every sign-in or lazily before reads. Parents are created before
 * children so parentId can be linked in a second pass.
 */
export async function seedDefaultCategories(userId: string): Promise<void> {
  const existing = await prisma.category.findMany({
    where: { userId },
    select: { name: true },
  });
  const have = new Set(existing.map((c) => c.name));
  const missing = DEFAULT_TAXONOMY.filter((t) => !have.has(t.name));
  if (missing.length === 0) return;

  // Pass 1: create rows (without parent links).
  let order = 0;
  for (const t of missing) {
    await prisma.category.create({
      data: {
        userId,
        name: t.name,
        kind: t.kind,
        group: t.group,
        color: t.color ?? GROUP_COLORS[t.group] ?? null,
        icon: t.icon ?? null,
        isDefault: true,
        sortOrder: order++,
      },
    });
  }

  // Pass 2: link parents by name (now that all rows exist).
  const rows = await prisma.category.findMany({ where: { userId }, select: { id: true, name: true } });
  const idByName = new Map(rows.map((r) => [r.name, r.id]));
  for (const t of missing) {
    if (!t.parent) continue;
    const parentId = idByName.get(t.parent);
    const childId = idByName.get(t.name);
    if (parentId && childId) {
      await prisma.category.update({ where: { id: childId }, data: { parentId } });
    }
  }
}

// ── Reads ────────────────────────────────────────────────

/**
 * Return the user's categories, seeding defaults first if they have none.
 * Excludes archived by default.
 */
export async function getUserCategories(
  userId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<Category[]> {
  let categories = await prisma.category.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  if (categories.length === 0) {
    await seedDefaultCategories(userId);
    categories = await prisma.category.findMany({
      where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  return categories;
}

export type CategorySets = {
  income: Set<string>;
  expense: Set<string>;
  transfer: Set<string>;
  /** All non-transfer names, for the AI allowed list. */
  all: Category[];
};

/**
 * Per-user membership sets, mirroring the old INCOME_SET/EXPENSE_SET/TRANSFER_SET
 * but sourced from the DB. Used by budget aggregation to bucket transactions.
 */
export async function getCategorySets(userId: string): Promise<CategorySets> {
  const cats = await getUserCategories(userId, { includeArchived: true });
  const income = new Set<string>();
  const expense = new Set<string>();
  const transfer = new Set<string>();
  for (const c of cats) {
    if (c.kind === "income") income.add(c.name);
    else if (c.kind === "transfer") transfer.add(c.name);
    else expense.add(c.name);
  }
  return { income, expense, transfer, all: cats };
}
