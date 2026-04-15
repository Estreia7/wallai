import { prisma } from "@/lib/prisma";
import { buildProfile, pickTopN, starterBundle, whyTag, type Profile } from "./profile";
import { TRAIT_COUNT } from "./traits";

export type UserBookDTO = {
  bookId: string;
  status: "reading" | "read" | "wantToRead";
  rating: number | null;
  addedAt: string;
  book: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    category: string;
    traits: number[];
    traitSource: string | null;
  };
};

export type RecommendationDTO = {
  book: UserBookDTO["book"];
  score: number;
  whyTag: string;
};

export type LearnPayload = {
  userBooks: UserBookDTO[];
  profile: Profile | null;
  readCount: number;
  isStarter: boolean;
  recommendations: RecommendationDTO[];
};

export async function loadLearnPayload(userId: string): Promise<LearnPayload> {
  const [userBooksRaw, hidden, allBooks] = await Promise.all([
    prisma.userBook.findMany({
      where: { userId },
      include: { book: true },
      orderBy: [{ status: "asc" }, { addedAt: "desc" }],
    }),
    prisma.userBookHidden.findMany({ where: { userId }, select: { bookId: true } }),
    prisma.book.findMany({}),
  ]);

  const userBooks: UserBookDTO[] = userBooksRaw.map((ub) => ({
    bookId: ub.bookId,
    status: ub.status as UserBookDTO["status"],
    rating: ub.rating,
    addedAt: ub.addedAt.toISOString(),
    book: {
      id: ub.book.id,
      title: ub.book.title,
      author: ub.book.author,
      coverUrl: ub.book.coverUrl,
      category: ub.book.category,
      traits: ub.book.traits,
      traitSource: ub.book.traitSource,
    },
  }));

  const readBooks = userBooks
    .filter((ub) => ub.status === "read" && ub.book.traits.length === TRAIT_COUNT)
    .map((ub) => ({
      id: ub.book.id,
      traits: ub.book.traits,
      status: ub.status,
      rating: ub.rating,
    }));

  const profile = buildProfile(readBooks);
  const readCount = userBooks.filter((ub) => ub.status === "read").length;

  const userBookIds = new Set(userBooks.map((ub) => ub.bookId));
  const hiddenIds = new Set(hidden.map((h) => h.bookId));
  const pool = allBooks
    .filter(
      (b) =>
        b.traits.length === TRAIT_COUNT &&
        !userBookIds.has(b.id) &&
        !hiddenIds.has(b.id),
    )
    .map((b) => ({
      id: b.id,
      traits: b.traits,
      raw: b,
    }));

  if (profile === null) {
    const starter = starterBundle(
      pool.map((p) => ({ id: p.id, traits: p.traits })),
      5,
    );
    const rawByIndex = new Map(pool.map((p) => [p.id, p.raw]));
    return {
      userBooks,
      profile: null,
      readCount,
      isStarter: true,
      recommendations: starter.map((s) => {
        const raw = rawByIndex.get(s.id)!;
        return {
          book: {
            id: raw.id,
            title: raw.title,
            author: raw.author,
            coverUrl: raw.coverUrl,
            category: raw.category,
            traits: raw.traits,
            traitSource: raw.traitSource,
          },
          score: 0,
          whyTag: "A great place to start",
        };
      }),
    };
  }

  const picked = pickTopN(
    pool.map((p) => ({ id: p.id, traits: p.traits })),
    profile,
    5,
  );
  const rawByIndex = new Map(pool.map((p) => [p.id, p.raw]));
  const recommendations: RecommendationDTO[] = picked.map((p) => {
    const raw = rawByIndex.get(p.book.id)!;
    return {
      book: {
        id: raw.id,
        title: raw.title,
        author: raw.author,
        coverUrl: raw.coverUrl,
        category: raw.category,
        traits: raw.traits,
        traitSource: raw.traitSource,
      },
      score: p.score,
      whyTag: whyTag(p.book, profile),
    };
  });

  return { userBooks, profile, readCount, isStarter: false, recommendations };
}
