import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SearchDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  cover_i?: number;
};

async function findBestCover(title: string, author: string): Promise<{ coverUrl: string; externalId: string } | null> {
  const q = `${title} ${author.split(",")[0]}`.trim();
  const params = new URLSearchParams({
    q,
    limit: "5",
    fields: "key,title,author_name,cover_i",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { docs?: SearchDoc[] };
  const hit = (json.docs ?? []).find((d) => d.cover_i && d.key) ?? (json.docs ?? [])[0];
  if (!hit?.cover_i || !hit.key) return null;
  return {
    coverUrl: `https://covers.openlibrary.org/b/id/${hit.cover_i}-M.jpg`,
    externalId: hit.key,
  };
}

async function main() {
  const books = await prisma.book.findMany({
    where: { OR: [{ coverUrl: null }, { coverUrl: "" }] },
  });
  console.log(`${books.length} books missing covers`);

  let updated = 0;
  for (const b of books) {
    const result = await findBestCover(b.title, b.author);
    if (!result) {
      console.log(`[skip] ${b.title} — no match`);
      continue;
    }
    await prisma.book.update({
      where: { id: b.id },
      data: {
        coverUrl: result.coverUrl,
        // Only overwrite externalId if the book didn't already have one
        ...(b.externalId ? {} : { externalId: result.externalId }),
      },
    });
    console.log(`[ok]   ${b.title} → ${result.coverUrl}`);
    updated++;
    // Open Library asks for gentle rate-limiting (~100/min is fine)
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone: updated ${updated} / ${books.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
