# Learn page rework — design

**Date:** 2026-04-15
**Status:** draft, pending plan

## Goal

Turn `/learn` from a static shelf into a personal reading tracker that:
1. Lets the user add books they've read, are reading, or want to read
2. Derives a "financial-literacy profile" from their read-and-liked books (vector of 20 trait scores)
3. Recommends 5 unread books that fill the profile's gaps while still matching taste
4. Never repeats a recommendation — dismissed books stay dismissed

## The 20-trait vocabulary

Two pillars × 10 traits. Fixed order so the `Float[20]` index is stable across the codebase and a radar chart can be split into two readable halves on mobile.

| # | Core literacy | # | Wealth building |
|---|---------------|---|-----------------|
| 0 | Budgeting | 10 | Index investing |
| 1 | Saving habits | 11 | Stock picking |
| 2 | Debt management | 12 | Real estate |
| 3 | Credit | 13 | Crypto |
| 4 | Taxes | 14 | Entrepreneurship |
| 5 | Insurance | 15 | Psychology / mindset |
| 6 | Retirement | 16 | Frugality |
| 7 | Estate planning | 17 | Passive income |
| 8 | Emergency fund | 18 | Macro / economics |
| 9 | Risk tolerance | 19 | Financial independence |

Scores are `0-10`. A book that barely touches a trait scores 0-1; a book centered on it scores 9-10.

The trait list is exported from `src/lib/wallai/learn/traits.ts` as a `readonly` tuple so nothing else in the codebase can drift.

## Schema changes (Prisma)

```prisma
model Book {
  id              String   @id @default(cuid())
  title           String
  author          String
  coverUrl        String?
  description     String?  @db.Text
  year            Int?
  category        String
  link            String?
  traits          Float[]  // length 20, matches traits.ts order
  traitSource     String?  // "curated" | "ai"
  traitsGeneratedAt DateTime?
  externalId      String?  @unique  // Google Books volume ID, used as dedupe key

  userBooks       UserBook[]
  @@index([externalId])
}

model UserBook {
  id         String   @id @default(cuid())
  userId     String
  bookId     String
  status     String   // "reading" | "read" | "wantToRead"
  rating     Int?     // 1-5, null if not rated
  addedAt    DateTime @default(now())
  finishedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  book Book @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([userId, bookId])
  @@index([userId])
}

model UserBookHidden {
  userId  String
  bookId  String
  hiddenAt DateTime @default(now())

  @@id([userId, bookId])
  @@index([userId])
}
```

`User` gets a relation `userBooks` and `hiddenBooks`. Migration name: `learn_books_and_profile`.

The existing seeded `Book` rows predate `externalId` and `traits`. The migration is additive (new fields are nullable / default empty array). The re-run of `prisma/seed.ts` deletes the old rows and re-inserts the 30 curated books with filled trait vectors and a stable `externalId` (Google Books volume ID for each). Users who already added the original seed books to a `UserBook` list don't exist yet, so no migration backfill is needed.

## Book lookup (Google Books)

- Client-side autocomplete in an "Add book" modal. As user types title/author, debounce 300ms, call `GET /api/wallai/books/search?q=...`.
- API proxies Google Books (`https://www.googleapis.com/books/v1/volumes?q=...&maxResults=10`). No API key needed for anonymous read — we'll still accept one via `GOOGLE_BOOKS_API_KEY` env var for higher quotas.
- Results return `{ googleId, title, authors, coverUrl, description, publishedYear }`.
- When the user picks a result, we POST to `/api/wallai/books/add` with the googleId.
- Server finds-or-creates `Book` by `externalId = googleId`. If the book is new (no traits yet), call Claude to fill the 20 traits.

Caching is two-layered: Google Books search results aren't cached (cheap, fast). Once a book is saved to our DB, traits live there forever — next user who picks the same book reuses them.

### Claude trait prompt

Single-shot, JSON-mode request to `claude-haiku-4-5-20251001` (cheap, fast, sufficient):

```
System: You are a financial-literacy librarian. Given a book's title, author, and description,
score how strongly it teaches each of these 20 traits on a 0-10 scale (0 = not at all,
10 = central theme). Return ONLY a JSON object: {"traits": [n0, n1, ..., n19]}.

User: Title: {title}
Author: {author}
Description: {description ?? "not provided"}

Traits (in order):
0. Budgeting
1. Saving habits
...
19. Financial independence
```

Validate: 20 numbers, each `0 <= n <= 10`. On validation or network failure, save the book with `traits = []` and `traitSource = null`; the UI shows a retry badge. Record the call via `ApiUsage` like existing endpoints do.

## Profile + recommendation logic

Module: `src/lib/wallai/learn/profile.ts`.

```ts
// readRatedBooks = user's UserBooks where status = "read" and (rating === null || rating >= 4)
// If none with rating >= 4, fall back to all status="read" books.
// If fewer than 3, return null (caller shows "read a few more" empty state).

function buildProfile(books: BookWithTraits[]): Float64Array | null {
  if (books.length < 3) return null;
  const p = new Float64Array(20);
  let weightSum = 0;
  for (const b of books) {
    if (b.traits.length !== 20) continue;
    // optional per-book rating weight: rating ?? 4 (so unrated counts the same as a "liked")
    const w = (b.rating ?? 4) / 5;
    for (let i = 0; i < 20; i++) p[i] += b.traits[i] * w;
    weightSum += w;
  }
  if (weightSum === 0) return null;
  for (let i = 0; i < 20; i++) p[i] /= weightSum;
  return p;
}
```

**Scoring an unread book `B`:**

```
gap[i]     = 10 - profile[i]
gapScore   = dot(gap, B.traits) / (20 * 10 * 10)        // normalized 0-1
tasteScore = cosine(profile, B.traits)                   // 0-1
score      = 0.7 * gapScore + 0.3 * tasteScore
```

Normalization keeps both terms on the same scale so the weights mean what they say.

**Picking 5 diverse books:**

Greedy selection, penalizing similarity to already-selected recs:

```
candidates = sort unread/non-hidden books by score desc
recs = []
for candidate in candidates (top 30):
  diversityPenalty = max(cosine(candidate.traits, r.traits) for r in recs) if recs else 0
  adjustedScore = candidate.score * (1 - 0.5 * diversityPenalty)
  insert into recs with adjustedScore re-sort
  trim to 5
```

This prevents "all 5 recs are about index investing" when the user's gap is concentrated.

Each rec carries a **why-tag** — the single trait with the largest `(10 - profile[i]) * B.traits[i]` contribution, surfaced as `"Fills a gap in Taxes"` or `"More Psychology & mindset — you've liked this"`.

## Seed catalogue

30 curated books, scored by hand, loaded via `prisma/seed.ts` (extend existing seed). Covers the common canon:

Psychology of Money, Rich Dad Poor Dad, The Intelligent Investor, A Random Walk Down Wall Street, Bogleheads' Guide to Investing, The Millionaire Next Door, Your Money or Your Life, I Will Teach You to Be Rich, The Simple Path to Wealth, Think and Grow Rich, The Richest Man in Babylon, Total Money Makeover, The Little Book of Common Sense Investing, One Up On Wall Street, Security Analysis, The Wealthy Barber, Millionaire Teacher, Broke Millennial, The Index Card, Money Master the Game, The Barefoot Investor, Financial Freedom, Die With Zero, The Psychology of Investing, Unshakeable, The 4-Hour Workweek, Set for Life, Quit Like a Millionaire, Mr. Money Mustache (Blog compilation), The Millionaire Fastlane.

(The final list is what actually ships; order here is indicative.)

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/wallai/books/search` | GET | Google Books proxy, returns up to 10 results |
| `/api/wallai/books/add` | POST | Find-or-create Book by googleId, generate traits if new, create UserBook |
| `/api/wallai/books/[id]/user` | PATCH | Update status or rating on a UserBook |
| `/api/wallai/books/[id]/user` | DELETE | Remove book from user's list |
| `/api/wallai/books/[id]/retry-traits` | POST | Retry Claude trait generation for a book that failed |
| `/api/wallai/books/recommendations` | GET | Returns 5 recs + profile vector + read-count metadata |
| `/api/wallai/books/recommendations/[bookId]/dismiss` | POST | Add to UserBookHidden |

All protected by `auth()` session check, same pattern as existing routes.

## Page layout

Server component at `src/app/(app)/learn/page.tsx` fetches in parallel:

1. User's UserBooks + linked Book rows
2. Profile + 5 recs (via a new server util that wraps the logic above)
3. Tips (existing query)

Layout (top to bottom, mobile first):

1. **Header** — "Learn", subtitle, "+ Add book" button (opens search modal)
2. **Your reading** — grouped by status (currently reading → want to read → read). Compact rows: cover thumb, title, author, status chip, rating stars, overflow menu (change status, rate, remove)
3. **Your profile** — radar chart when `profile !== null`; empty state otherwise. Two stacked 10-axis radars (Core / Wealth) at mobile widths, side-by-side above `md`
4. **Picked for you** — 5 rec cards in a 1-col (mobile) / 2-col (md) / 3-col (lg) grid. Each card: cover, title, author, "Why this?" tag, [Add] [Dismiss] buttons
5. **Tips & Quotes** — existing section, unchanged

Components (new):
- `components/wallai/learn/add-book-modal.tsx`
- `components/wallai/learn/user-book-row.tsx`
- `components/wallai/learn/profile-radar.tsx`
- `components/wallai/learn/recommendation-card.tsx`

All styled consistent with `GlassCard` and the existing dark palette.

## Mobile-first reliability

Per the project's mobile-first memory: every component verified at 375px width. Search modal takes full screen on mobile. Recs stack vertically. Radar chart uses responsive container with min-height to stay readable.

## Edge cases

| Case | Behavior |
|------|----------|
| `<3` read books | Profile section shows "Read a few more to get personalized recs". Recs section shows a **starter bundle** — the 5 seed books whose greedy max-coverage across traits is highest (computed once at request time from curated seed books only: pick the book that covers the most traits ≥7, then add the book that fills the most remaining uncovered traits ≥7, repeat until 5) |
| User adds book, Claude trait call fails | Book saved with `traits=[]`. Row shows a small "traits pending — retry" link that calls `/retry-traits` |
| User adds a book already in someone else's list | Find-or-create on `externalId` hits existing Book, reuses cached traits — zero extra AI cost |
| Google Books search returns nothing | "No matches — try a different title or author" in modal |
| All non-hidden unread books exhausted | Rec section shows "You've seen every book we know. Add one yourself to get more recs." |
| Multiple traits tied for why-tag | Break ties by the trait with the lowest profile value (biggest gap) |

## Testing

- `src/lib/wallai/learn/profile.test.ts` — unit tests for `buildProfile`, `scoreBook`, `pickTopN` with synthetic vectors covering: empty, under-min, single-trait concentration, diversity selection actually diversifying
- E2E (manual): add 3 books → see profile radar → see 5 recs → dismiss one → refresh → confirm it's not back → add one of the recs → verify recs update with the new profile

## Non-goals

- Social features (sharing lists, friend recs)
- Book reviews / notes beyond rating
- Non-English books (catalogue is English-only for now)
- Genre categories beyond the 20-trait vector

## Open questions

None blocking. Google Books API works without a key for read endpoints; we'll add `GOOGLE_BOOKS_API_KEY` support for higher quotas if/when we hit them.
