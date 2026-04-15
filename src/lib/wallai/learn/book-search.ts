export type BookSearchHit = {
  externalId: string; // Open Library work key, e.g. "/works/OL21640039W"
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string | null;
  publishedYear: number | null;
  category: string;
};

type SearchDoc = {
  key: string;
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  subject?: string[];
};

type WorkDetails = {
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  subjects?: string[];
  authors?: Array<{ author?: { key?: string } }>;
  first_publish_date?: string;
};

function coverUrlFromId(coverId: number | undefined | null, size: "S" | "M" | "L" = "M"): string | null {
  if (!coverId) return null;
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg`;
}

function pickCategory(subjects: string[] | undefined): string {
  if (!subjects || subjects.length === 0) return "general";
  const joined = subjects.slice(0, 10).join(" ").toLowerCase();
  if (joined.includes("invest")) return "investing";
  if (joined.includes("budget") || joined.includes("personal finance")) return "budgeting";
  if (joined.includes("entrepreneur") || joined.includes("business")) return "entrepreneurship";
  if (joined.includes("psychology") || joined.includes("self-help")) return "mindset";
  return "general";
}

export async function searchBooks(query: string, limit = 10): Promise<BookSearchHit[]> {
  const q = query.trim();
  if (!q) return [];

  const params = new URLSearchParams({
    q,
    limit: String(Math.min(limit, 20)),
    fields: "key,title,author_name,first_publish_year,cover_i,subject",
  });
  const url = `https://openlibrary.org/search.json?${params.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const json = (await res.json()) as { docs?: SearchDoc[] };
  const docs = json.docs ?? [];

  return docs
    .filter((d) => d.key && d.title)
    .map((d): BookSearchHit => ({
      externalId: d.key,
      title: d.title ?? "Unknown",
      authors: d.author_name ?? [],
      coverUrl: coverUrlFromId(d.cover_i),
      description: null,
      publishedYear: d.first_publish_year ?? null,
      category: pickCategory(d.subject),
    }));
}

/** Fetch a single work (with description) by its Open Library work key. */
export async function getWorkByExternalId(externalId: string): Promise<BookSearchHit | null> {
  // externalId looks like "/works/OL21640039W" — add .json to fetch details.
  const path = externalId.startsWith("/") ? externalId : `/${externalId}`;
  const url = `https://openlibrary.org${path}.json`;

  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  const work = (await res.json()) as WorkDetails;
  let description: string | null = null;
  if (typeof work.description === "string") description = work.description;
  else if (work.description && typeof work.description === "object") description = work.description.value ?? null;

  // Fetch author name from the first linked author key (one extra hop).
  let authors: string[] = [];
  const firstAuthorKey = work.authors?.[0]?.author?.key;
  if (firstAuthorKey) {
    try {
      const ares = await fetch(`https://openlibrary.org${firstAuthorKey}.json`, { cache: "no-store" });
      if (ares.ok) {
        const a = (await ares.json()) as { name?: string };
        if (a.name) authors = [a.name];
      }
    } catch {
      // ignore — we still have the book
    }
  }

  const yearMatch = work.first_publish_date?.match(/(\d{4})/);

  return {
    externalId,
    title: work.title ?? "Unknown",
    authors,
    coverUrl: coverUrlFromId(work.covers?.[0]),
    description,
    publishedYear: yearMatch ? Number(yearMatch[1]) : null,
    category: pickCategory(work.subjects),
  };
}
