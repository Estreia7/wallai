import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function main() {
  const books = await prisma.book.findMany({});
  const byKey = new Map<string, typeof books>();
  for (const b of books) {
    const key = normalize(b.title);
    const list = byKey.get(key) ?? [];
    list.push(b);
    byKey.set(key, list);
  }

  let merged = 0;
  for (const [key, group] of byKey) {
    if (group.length < 2) continue;
    // Keep the one with highest popularity (curated tier wins); break ties by traits length then id.
    group.sort((a, b) => {
      if (b.popularity !== a.popularity) return b.popularity - a.popularity;
      if (b.traits.length !== a.traits.length) return b.traits.length - a.traits.length;
      return a.id.localeCompare(b.id);
    });
    const [keep, ...drop] = group;
    console.log(`[merge] "${keep.title}" → keeping ${keep.id} (pop ${keep.popularity})`);
    for (const d of drop) {
      // Re-point any UserBooks/hides pointing at the drop row.
      await prisma.userBook.updateMany({
        where: { bookId: d.id },
        data: { bookId: keep.id },
      }).catch(async (e) => {
        // Unique userId_bookId may collide — resolve by preferring the existing keep-side row.
        if (String(e).includes("Unique")) {
          const conflicts = await prisma.userBook.findMany({ where: { bookId: d.id } });
          for (const ub of conflicts) {
            const existing = await prisma.userBook.findUnique({
              where: { userId_bookId: { userId: ub.userId, bookId: keep.id } },
            });
            if (existing) {
              await prisma.userBook.delete({ where: { id: ub.id } });
            } else {
              await prisma.userBook.update({
                where: { id: ub.id },
                data: { bookId: keep.id },
              });
            }
          }
        } else {
          throw e;
        }
      });
      await prisma.userBookHidden.updateMany({
        where: { bookId: d.id },
        data: { bookId: keep.id },
      }).catch(() => { /* ignore unique-conflicts; delete below will clean up */ });
      await prisma.userBookHidden.deleteMany({ where: { bookId: d.id } });
      await prisma.book.delete({ where: { id: d.id } });
      console.log(`         dropped ${d.id} (pop ${d.popularity}, extId ${d.externalId})`);
      merged++;
    }
  }

  console.log(`\nMerged ${merged} duplicate book(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
