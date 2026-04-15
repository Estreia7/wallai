export type GoogleBookHit = {
  googleId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string | null;
  publishedYear: number | null;
  category: string;
};

type VolumeRaw = {
  id: string;
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: string;
    imageLinks?: { thumbnail?: string; smallThumbnail?: string };
    publishedDate?: string;
    categories?: string[];
  };
};

function pickCategory(cats: string[] | undefined): string {
  if (!cats || cats.length === 0) return "general";
  const first = cats[0].toLowerCase();
  if (first.includes("invest")) return "investing";
  if (first.includes("budget") || first.includes("personal finance")) return "budgeting";
  if (first.includes("business") || first.includes("entrepreneur")) return "entrepreneurship";
  if (first.includes("psychology") || first.includes("self-help")) return "mindset";
  return "general";
}

export async function searchGoogleBooks(query: string, limit = 10): Promise<GoogleBookHit[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q,
    maxResults: String(Math.min(limit, 20)),
    printType: "books",
  });
  const key = process.env.GOOGLE_BOOKS_API_KEY;
  if (key) params.set("key", key);

  const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];

  const json = (await res.json()) as { items?: VolumeRaw[] };
  const items = json.items ?? [];

  return items.map((v): GoogleBookHit => {
    const info = v.volumeInfo ?? {};
    const rawCover = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail ?? null;
    const coverUrl = rawCover ? rawCover.replace(/^http:\/\//, "https://") : null;
    const yearMatch = info.publishedDate?.match(/^(\d{4})/);
    return {
      googleId: v.id,
      title: info.title ?? "Unknown",
      authors: info.authors ?? [],
      coverUrl,
      description: info.description ?? null,
      publishedYear: yearMatch ? Number(yearMatch[1]) : null,
      category: pickCategory(info.categories),
    };
  });
}
