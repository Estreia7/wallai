# Learn Page Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/learn` from a static shelf into a personal reading tracker with a 20-trait literacy profile and 5 non-repeating, gap-filling recommendations.

**Architecture:** Prisma adds `UserBook`, `UserBookHidden`, and extends `Book` with a 20-dim trait vector. Google Books autocomplete drives "add book"; Claude Haiku fills traits once per book and caches forever. A pure profile module computes `buildProfile → scoreBook → pickTopN` with `0.7·gap + 0.3·taste` + greedy diversity. The `/learn` server component composes profile, 5 recs, and existing tips in one fetch.

**Tech Stack:** Next.js 16 (app router) · Prisma 7 + Postgres · Anthropic SDK (`claude-haiku-4-5-20251001`) · Google Books v1 API · Tailwind 4 · Recharts (radar).

**Source of truth:** `docs/specs/2026-04-15-wallai-learn-rework-design.md`.

**Location:** Work directly in `/var/www/wallai` on `main`. Deploy after each logical chunk via `npm run build → git push → pm2 restart wallai`.

---

## File map

**New:**
- `src/lib/wallai/learn/traits.ts` — the 20-trait tuple, labels, pillar groupings
- `src/lib/wallai/learn/profile.ts` — `buildProfile`, `scoreBook`, `pickTopN`, `starterBundle`, `whyTag`
- `src/lib/wallai/learn/profile.test.ts` — tsx-runnable assertion script
- `src/lib/wallai/learn/google-books.ts` — thin fetch wrapper + result normalizer
- `src/lib/wallai/learn/ai-traits.ts` — Claude call that returns a validated 20-dim vector, with `ApiUsage` logging
- `src/lib/wallai/learn/recommendations.ts` — server util pulling user books + computing profile + recs
- `src/app/api/wallai/books/search/route.ts`
- `src/app/api/wallai/books/add/route.ts`
- `src/app/api/wallai/books/[id]/user/route.ts`
- `src/app/api/wallai/books/[id]/retry-traits/route.ts`
- `src/app/api/wallai/books/recommendations/route.ts`
- `src/app/api/wallai/books/recommendations/[bookId]/dismiss/route.ts`
- `src/components/wallai/learn/add-book-modal.tsx`
- `src/components/wallai/learn/user-book-row.tsx`
- `src/components/wallai/learn/profile-radar.tsx`
- `src/components/wallai/learn/recommendation-card.tsx`
- `prisma/migrations/<timestamp>_learn_books_and_profile/migration.sql` (generated)

**Modify:**
- `prisma/schema.prisma` — extend `Book`, add `UserBook`, `UserBookHidden`, extend `User`
- `prisma/seed.ts` — re-seed 30 curated books with externalId + traits
- `src/app/(app)/learn/page.tsx` — full rewrite around new layout

---

### Task 1: Trait vocabulary module

**Files:** Create `src/lib/wallai/learn/traits.ts`

- [ ] **Step 1: Create the file**

```ts
// The 20-trait vector. Order is load-bearing: it's the stable index
// for every Book.traits Float[] and every profile computation.
export const LEARN_TRAITS = [
  // Core literacy (0–9)
  "Budgeting",
  "Saving habits",
  "Debt management",
  "Credit",
  "Taxes",
  "Insurance",
  "Retirement",
  "Estate planning",
  "Emergency fund",
  "Risk tolerance",
  // Wealth building (10–19)
  "Index investing",
  "Stock picking",
  "Real estate",
  "Crypto",
  "Entrepreneurship",
  "Psychology / mindset",
  "Frugality",
  "Passive income",
  "Macro / economics",
  "Financial independence",
] as const;

export type LearnTrait = (typeof LEARN_TRAITS)[number];

export const TRAIT_COUNT = 20;

export const CORE_TRAIT_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
export const WEALTH_TRAIT_INDICES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] as const;

export function isValidTraitVector(v: unknown): v is number[] {
  if (!Array.isArray(v) || v.length !== TRAIT_COUNT) return false;
  for (const n of v) {
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10) return false;
  }
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/wallai
git add src/lib/wallai/learn/traits.ts
git commit -m "feat(learn): add 20-trait vocabulary module"
```

---

### Task 2: Prisma schema + migration

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Extend `Book`**

Find the `model Book` block and replace with:

```prisma
model Book {
  id                String   @id @default(cuid())
  title             String
  author            String
  coverUrl          String?
  description       String?  @db.Text
  year              Int?
  category          String
  link              String?
  traits            Float[]  // length 20, same order as LEARN_TRAITS
  traitSource       String?  // "curated" | "ai"
  traitsGeneratedAt DateTime?
  externalId        String?  @unique

  userBooks     UserBook[]
  hiddenByUsers UserBookHidden[]

  @@index([externalId])
}
```

- [ ] **Step 2: Add `UserBook` and `UserBookHidden` models**

After the existing `Book` model, add:

```prisma
model UserBook {
  id         String    @id @default(cuid())
  userId     String
  bookId     String
  status     String    // "reading" | "read" | "wantToRead"
  rating     Int?      // 1-5
  addedAt    DateTime  @default(now())
  finishedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  book Book @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([userId, bookId])
  @@index([userId])
}

model UserBookHidden {
  userId   String
  bookId   String
  hiddenAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  book Book @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@id([userId, bookId])
  @@index([userId])
}
```

- [ ] **Step 3: Extend `User` model**

In the existing `model User` block, inside the relations list (after `netWorthSnapshots`), add:

```prisma
  userBooks      UserBook[]
  hiddenBooks    UserBookHidden[]
```

- [ ] **Step 4: Generate migration**

```bash
cd /var/www/wallai
npx prisma migrate dev --name learn_books_and_profile
```

Expected: migration folder created under `prisma/migrations/`, `prisma/schema.prisma` unchanged, `@prisma/client` regenerated. If prompted about existing data, accept — we'll re-seed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(learn): schema for UserBook, UserBookHidden, and Book traits"
```

---

### Task 3: Re-seed curated catalogue

**Files:** Modify `prisma/seed.ts`

- [ ] **Step 1: Read the current seed**

```bash
cd /var/www/wallai
cat prisma/seed.ts
```

Identify where existing `Book` rows are inserted. You'll replace that section.

- [ ] **Step 2: Replace the book-seeding section**

Delete the existing `Book` seeding block. Add at the top of `seed.ts` (after existing imports):

```ts
import { LEARN_TRAITS, TRAIT_COUNT } from "../src/lib/wallai/learn/traits";

type SeedBook = {
  externalId: string;      // Google Books volume ID
  title: string;
  author: string;
  category: string;
  year?: number;
  coverUrl?: string;
  description?: string;
  traits: number[];        // length 20, values 0-10
};

// Scored by hand. Each vector is LEARN_TRAITS order. High values mark
// pillars the book actually teaches; fill non-central traits with 0-3.
const CURATED_BOOKS: SeedBook[] = [
  {
    externalId: "bK06kgAACAAJ",
    title: "The Psychology of Money",
    author: "Morgan Housel",
    category: "mindset",
    year: 2020,
    coverUrl: "https://books.google.com/books/content?id=bK06kgAACAAJ&printsec=frontcover&img=1&zoom=1",
    description: "Timeless lessons on wealth, greed, and happiness.",
    //          bud sav dbt crd tax ins ret est emg rsk idx stk re  cry ent psy fru pas mac fi
    traits:    [  2,  4,  1,  0,  0,  0,  3,  0,  2,  7,  4,  3,  1,  1,  2,  10, 3,  2,  3,  6],
  },
  {
    externalId: "OMKrDwAAQBAJ",
    title: "Rich Dad Poor Dad",
    author: "Robert Kiyosaki",
    category: "mindset",
    year: 1997,
    description: "Two fathers, two views of money; the asset/liability distinction.",
    traits:    [  3,  3,  2,  1,  2,  1,  2,  1,  2,  6,  2,  3,  7,  0,  8,  9,  2,  8,  3,  7],
  },
  {
    externalId: "LIjCwAEACAAJ",
    title: "The Intelligent Investor",
    author: "Benjamin Graham",
    category: "investing",
    year: 1949,
    description: "Value investing principles from Warren Buffett's teacher.",
    traits:    [  1,  2,  1,  0,  1,  0,  3,  1,  1,  9,  5,  10, 1,  0,  1,  6,  2,  1,  5,  5],
  },
  {
    externalId: "kb0IBAAAQBAJ",
    title: "A Random Walk Down Wall Street",
    author: "Burton Malkiel",
    category: "investing",
    year: 1973,
    description: "Efficient markets and the case for index funds.",
    traits:    [  1,  2,  1,  0,  2,  0,  4,  0,  1,  8,  10, 6,  2,  0,  1,  4,  1,  2,  6,  4],
  },
  {
    externalId: "dNq8yBjnzvMC",
    title: "The Bogleheads' Guide to Investing",
    author: "Taylor Larimore",
    category: "investing",
    year: 2006,
    description: "Community wisdom on low-cost index investing.",
    traits:    [  4,  6,  2,  1,  6,  2,  9,  3,  5,  7,  10, 3,  1,  0,  0,  4,  5,  2,  3,  9],
  },
  {
    externalId: "dMZFDwAAQBAJ",
    title: "The Millionaire Next Door",
    author: "Thomas J. Stanley",
    category: "mindset",
    year: 1996,
    description: "Who the rich really are — habits of accumulators.",
    traits:    [  5,  9,  3,  2,  3,  2,  6,  3,  6,  5,  4,  2,  3,  0,  4,  8,  10, 3,  2,  8],
  },
  {
    externalId: "8R-DCwAAQBAJ",
    title: "Your Money or Your Life",
    author: "Vicki Robin",
    category: "mindset",
    year: 1992,
    description: "Redefine your relationship with money and time.",
    traits:    [  6,  9,  4,  2,  3,  3,  5,  3,  7,  5,  6,  1,  1,  0,  1,  9,  10, 5,  2,  10],
  },
  {
    externalId: "LvbXb3_nyEMC",
    title: "I Will Teach You to Be Rich",
    author: "Ramit Sethi",
    category: "budgeting",
    year: 2009,
    description: "A 6-week program for twentysomethings.",
    traits:    [  9,  8,  7,  8,  4,  3,  8,  2,  6,  5,  8,  2,  2,  0,  2,  7,  4,  3,  2,  6],
  },
  {
    externalId: "pSeDDAAAQBAJ",
    title: "The Simple Path to Wealth",
    author: "JL Collins",
    category: "investing",
    year: 2016,
    description: "Stock-series clarity: live below your means, invest in a total-market fund.",
    traits:    [  5,  9,  3,  1,  4,  1,  7,  2,  6,  6,  10, 1,  1,  0,  0,  7,  8,  3,  3,  10],
  },
  {
    externalId: "jPGJAgAAQBAJ",
    title: "Think and Grow Rich",
    author: "Napoleon Hill",
    category: "mindset",
    year: 1937,
    description: "Classic mindset and goal-setting manual.",
    traits:    [  1,  2,  1,  0,  0,  0,  1,  0,  1,  5,  1,  1,  1,  0,  7,  10, 1,  2,  1,  4],
  },
  {
    externalId: "EmJDnwEACAAJ",
    title: "The Richest Man in Babylon",
    author: "George S. Clason",
    category: "saving",
    year: 1926,
    description: "Parables on saving, investing, and debt.",
    traits:    [  7,  10, 7,  2,  1,  2,  3,  2,  5,  4,  2,  1,  2,  0,  3,  6,  8,  3,  1,  6],
  },
  {
    externalId: "vYylw2fMOCYC",
    title: "The Total Money Makeover",
    author: "Dave Ramsey",
    category: "debt",
    year: 2003,
    description: "Seven baby steps out of debt.",
    traits:    [  8,  8,  10, 7,  2,  4,  5,  2,  9,  4,  3,  0,  1,  0,  1,  6,  6,  1,  1,  5],
  },
  {
    externalId: "Jf4oDwAAQBAJ",
    title: "The Little Book of Common Sense Investing",
    author: "John C. Bogle",
    category: "investing",
    year: 2007,
    description: "The only way to guarantee your fair share of market returns.",
    traits:    [  1,  3,  1,  0,  2,  0,  6,  1,  2,  6,  10, 3,  1,  0,  0,  4,  3,  2,  4,  6],
  },
  {
    externalId: "TvHGDgAAQBAJ",
    title: "One Up On Wall Street",
    author: "Peter Lynch",
    category: "investing",
    year: 1989,
    description: "How an amateur can use what they already know to pick stocks.",
    traits:    [  1,  1,  1,  0,  1,  0,  3,  0,  1,  8,  3,  10, 2,  0,  2,  5,  2,  2,  4,  3],
  },
  {
    externalId: "tZf3EAAAQBAJ",
    title: "Security Analysis",
    author: "Benjamin Graham",
    category: "investing",
    year: 1934,
    description: "The definitive value-investing text.",
    traits:    [  1,  1,  1,  0,  2,  0,  2,  1,  1,  9,  3,  10, 2,  0,  1,  3,  1,  1,  6,  3],
  },
  {
    externalId: "zqtBY5X_Eq8C",
    title: "The Wealthy Barber",
    author: "David Chilton",
    category: "mindset",
    year: 1989,
    description: "Common-sense financial planning in story form.",
    traits:    [  7,  9,  5,  3,  4,  5,  7,  4,  6,  4,  5,  1,  3,  0,  1,  5,  7,  3,  2,  7],
  },
  {
    externalId: "4gpfUI4avAEC",
    title: "Millionaire Teacher",
    author: "Andrew Hallam",
    category: "investing",
    year: 2011,
    description: "Nine rules of wealth you should have learned in school.",
    traits:    [  4,  8,  2,  1,  3,  1,  7,  2,  4,  6,  10, 2,  1,  0,  0,  6,  8,  2,  3,  8],
  },
  {
    externalId: "xTQuDwAAQBAJ",
    title: "Broke Millennial",
    author: "Erin Lowry",
    category: "budgeting",
    year: 2017,
    description: "Stop scraping by and get your financial life together.",
    traits:    [  9,  8,  8,  9,  5,  3,  4,  1,  8,  4,  4,  1,  1,  0,  1,  6,  5,  1,  2,  5],
  },
  {
    externalId: "OmLgDAAAQBAJ",
    title: "The Index Card",
    author: "Helaine Olen",
    category: "investing",
    year: 2016,
    description: "Why personal finance doesn't have to be complicated.",
    traits:    [  7,  8,  6,  4,  5,  6,  8,  4,  7,  5,  9,  1,  1,  0,  0,  5,  5,  2,  2,  7],
  },
  {
    externalId: "71FyBQAAQBAJ",
    title: "Money: Master the Game",
    author: "Tony Robbins",
    category: "investing",
    year: 2014,
    description: "Seven simple steps to financial freedom.",
    traits:    [  5,  7,  4,  3,  5,  4,  8,  4,  5,  6,  8,  3,  2,  1,  3,  7,  4,  4,  4,  8],
  },
  {
    externalId: "7lALCwAAQBAJ",
    title: "The Barefoot Investor",
    author: "Scott Pape",
    category: "budgeting",
    year: 2016,
    description: "The only money guide you'll ever need.",
    traits:    [  10, 9,  7,  6,  4,  6,  8,  3,  9,  4,  7,  1,  2,  0,  1,  5,  6,  2,  1,  7],
  },
  {
    externalId: "d5k_DwAAQBAJ",
    title: "Financial Freedom",
    author: "Grant Sabatier",
    category: "mindset",
    year: 2019,
    description: "A proven path to all the money you will ever need.",
    traits:    [  6,  8,  5,  3,  4,  3,  5,  2,  6,  6,  7,  2,  4,  0,  6,  7,  6,  6,  2,  10],
  },
  {
    externalId: "2wJHzQEACAAJ",
    title: "Die With Zero",
    author: "Bill Perkins",
    category: "mindset",
    year: 2020,
    description: "Getting all you can from your money and your life.",
    traits:    [  3,  4,  2,  1,  2,  2,  7,  6,  3,  5,  3,  1,  1,  0,  1,  9,  2,  3,  2,  6],
  },
  {
    externalId: "z8VmDwAAQBAJ",
    title: "The Psychology of Investing",
    author: "John R. Nofsinger",
    category: "investing",
    year: 2001,
    description: "Behavioral finance for everyday investors.",
    traits:    [  1,  2,  1,  0,  1,  0,  3,  0,  1,  9,  6,  7,  1,  1,  1,  10, 2,  2,  4,  3],
  },
  {
    externalId: "AB86CAAAQBAJ",
    title: "Unshakeable",
    author: "Tony Robbins",
    category: "investing",
    year: 2017,
    description: "Your financial freedom playbook.",
    traits:    [  3,  5,  2,  1,  3,  2,  7,  2,  3,  7,  8,  2,  1,  0,  2,  8,  3,  3,  5,  7],
  },
  {
    externalId: "nG5zBgAAQBAJ",
    title: "The 4-Hour Workweek",
    author: "Timothy Ferriss",
    category: "entrepreneurship",
    year: 2007,
    description: "Escape 9-5, live anywhere, join the new rich.",
    traits:    [  2,  3,  1,  0,  1,  0,  1,  0,  1,  6,  1,  1,  1,  0,  10, 7,  3,  9,  1,  7],
  },
  {
    externalId: "tJjBDwAAQBAJ",
    title: "Set for Life",
    author: "Scott Trench",
    category: "mindset",
    year: 2017,
    description: "Dominate life, money, and the American dream.",
    traits:    [  7,  8,  5,  3,  3,  2,  4,  1,  6,  6,  5,  1,  9,  0,  5,  6,  7,  7,  2,  9],
  },
  {
    externalId: "0SRjDwAAQBAJ",
    title: "Quit Like a Millionaire",
    author: "Kristy Shen",
    category: "investing",
    year: 2019,
    description: "No gimmicks, luck, or trust fund required.",
    traits:    [  6,  9,  3,  2,  6,  2,  7,  2,  5,  6,  10, 2,  2,  0,  1,  7,  9,  3,  4,  10],
  },
  {
    externalId: "dkl_qjE_u68C",
    title: "Early Retirement Extreme",
    author: "Jacob Lund Fisker",
    category: "frugality",
    year: 2010,
    description: "A philosophical and practical guide to financial independence.",
    traits:    [  8,  10, 4,  2,  4,  2,  5,  2,  7,  4,  7,  1,  2,  0,  2,  8,  10, 4,  4,  10],
  },
  {
    externalId: "OBnZzQEACAAJ",
    title: "The Millionaire Fastlane",
    author: "MJ DeMarco",
    category: "entrepreneurship",
    year: 2011,
    description: "Crack the code to wealth and live rich for a lifetime.",
    traits:    [  2,  3,  3,  1,  2,  1,  2,  1,  2,  7,  1,  1,  5,  0,  10, 8,  2,  8,  3,  7],
  },
];

// Sanity check every vector at startup.
for (const b of CURATED_BOOKS) {
  if (b.traits.length !== TRAIT_COUNT) {
    throw new Error(`Seed book "${b.title}" has ${b.traits.length} traits, expected ${TRAIT_COUNT}`);
  }
  for (const n of b.traits) {
    if (n < 0 || n > 10) {
      throw new Error(`Seed book "${b.title}" has out-of-range trait: ${n}`);
    }
  }
}
```

- [ ] **Step 3: Replace the book-upsert loop in `main()`**

Inside the existing `main()` function, replace the old book-creation block with:

```ts
// Wipe then re-seed to guarantee the curated catalogue matches the codebase.
await prisma.book.deleteMany({});
for (const b of CURATED_BOOKS) {
  await prisma.book.create({
    data: {
      externalId: b.externalId,
      title: b.title,
      author: b.author,
      category: b.category,
      year: b.year ?? null,
      coverUrl: b.coverUrl ?? null,
      description: b.description ?? null,
      traits: b.traits,
      traitSource: "curated",
      traitsGeneratedAt: new Date(),
    },
  });
}
console.log(`Seeded ${CURATED_BOOKS.length} curated books.`);
```

- [ ] **Step 4: Run the seed**

```bash
cd /var/www/wallai
npx prisma db seed
```

Expected: `Seeded 30 curated books.` (or whatever length the array ends up).

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat(learn): re-seed 30 curated books with trait vectors"
```

---

### Task 4: Profile logic + verification script

**Files:** Create `src/lib/wallai/learn/profile.ts` and `profile.test.ts`

- [ ] **Step 1: Write `profile.ts`**

```ts
import { TRAIT_COUNT, LEARN_TRAITS } from "./traits";

export type BookTraits = {
  id: string;
  traits: number[]; // length 20
};

export type BookWithUserState = BookTraits & {
  status?: "reading" | "read" | "wantToRead";
  rating?: number | null;
};

export type Profile = number[]; // length 20, values 0-10

/**
 * Build a profile vector from a user's read-and-rated books.
 * Returns null when the user has fewer than 3 qualifying books —
 * the UI uses that to show the starter bundle instead.
 */
export function buildProfile(read: BookWithUserState[]): Profile | null {
  const qualifying = read.filter((b) => b.traits.length === TRAIT_COUNT && b.status === "read");
  if (qualifying.length < 3) return null;

  const highRated = qualifying.filter((b) => (b.rating ?? 0) >= 4);
  const pool = highRated.length >= 3 ? highRated : qualifying;

  const p = new Array(TRAIT_COUNT).fill(0);
  let weightSum = 0;
  for (const b of pool) {
    const w = (b.rating ?? 4) / 5; // unrated books count like a 4-star
    for (let i = 0; i < TRAIT_COUNT; i++) p[i] += b.traits[i] * w;
    weightSum += w;
  }
  if (weightSum === 0) return null;
  for (let i = 0; i < TRAIT_COUNT; i++) p[i] /= weightSum;
  return p;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function magnitude(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosine(a: number[], b: number[]): number {
  const ma = magnitude(a);
  const mb = magnitude(b);
  if (ma === 0 || mb === 0) return 0;
  return dot(a, b) / (ma * mb);
}

/**
 * Score an unread book against the user's profile.
 * 0.7 · gap-fill + 0.3 · taste-match. Both terms normalized to 0-1 so the
 * mix weights mean what they say.
 */
export function scoreBook(book: BookTraits, profile: Profile): number {
  const gap = profile.map((v) => 10 - v);
  // gap · book.traits ∈ [0, 20 · 100] = [0, 2000]
  const gapScore = dot(gap, book.traits) / (TRAIT_COUNT * 10 * 10);
  const tasteScore = cosine(profile, book.traits);
  return 0.7 * gapScore + 0.3 * tasteScore;
}

/**
 * Greedy diverse top-N with similarity penalty so picks span multiple topics.
 */
export function pickTopN(
  candidates: BookTraits[],
  profile: Profile,
  n: number,
): Array<{ book: BookTraits; score: number }> {
  const scored = candidates
    .map((book) => ({ book, score: scoreBook(book, profile) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  const picked: Array<{ book: BookTraits; score: number }> = [];
  while (picked.length < n && scored.length > 0) {
    let bestIdx = -1;
    let bestAdj = -Infinity;
    for (let i = 0; i < scored.length; i++) {
      const c = scored[i];
      let maxSim = 0;
      for (const p of picked) {
        const s = cosine(c.book.traits, p.book.traits);
        if (s > maxSim) maxSim = s;
      }
      const adj = c.score * (1 - 0.5 * maxSim);
      if (adj > bestAdj) {
        bestAdj = adj;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    picked.push(scored[bestIdx]);
    scored.splice(bestIdx, 1);
  }
  return picked;
}

/**
 * Why-tag for a recommendation: the trait with the largest
 * (10 − profile[i]) · book.traits[i] contribution. Ties broken by
 * biggest gap (lowest profile[i]).
 */
export function whyTag(book: BookTraits, profile: Profile): string {
  let bestI = 0;
  let bestScore = -Infinity;
  let bestGap = -Infinity;
  for (let i = 0; i < TRAIT_COUNT; i++) {
    const contrib = (10 - profile[i]) * book.traits[i];
    if (contrib > bestScore || (contrib === bestScore && (10 - profile[i]) > bestGap)) {
      bestScore = contrib;
      bestGap = 10 - profile[i];
      bestI = i;
    }
  }
  return `Fills a gap in ${LEARN_TRAITS[bestI]}`;
}

/**
 * Starter bundle for users with <3 read books: greedy max-coverage over
 * the curated pool. Pick the book that covers the most traits ≥7, then
 * the one that adds the most uncovered traits ≥7, repeat until N.
 */
export function starterBundle(curated: BookTraits[], n: number): BookTraits[] {
  const picked: BookTraits[] = [];
  const covered = new Set<number>();
  const pool = [...curated];

  while (picked.length < n && pool.length > 0) {
    let bestIdx = -1;
    let bestNew = -1;
    for (let i = 0; i < pool.length; i++) {
      let added = 0;
      for (let t = 0; t < TRAIT_COUNT; t++) {
        if (pool[i].traits[t] >= 7 && !covered.has(t)) added++;
      }
      if (added > bestNew) {
        bestNew = added;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    const chosen = pool[bestIdx];
    picked.push(chosen);
    for (let t = 0; t < TRAIT_COUNT; t++) {
      if (chosen.traits[t] >= 7) covered.add(t);
    }
    pool.splice(bestIdx, 1);
    // If no more traits to cover, fall back to highest trait-sum remaining
    if (covered.size === TRAIT_COUNT) {
      pool.sort((a, b) => sum(b.traits) - sum(a.traits));
    }
  }
  return picked;
}

function sum(a: number[]): number {
  let s = 0;
  for (const n of a) s += n;
  return s;
}
```

- [ ] **Step 2: Write `profile.test.ts` (tsx-runnable assertions)**

```ts
import { buildProfile, scoreBook, pickTopN, cosine, whyTag, starterBundle } from "./profile";
import { TRAIT_COUNT } from "./traits";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function vec(...nums: number[]): number[] {
  const out = new Array(TRAIT_COUNT).fill(0);
  for (let i = 0; i < nums.length; i++) out[i] = nums[i];
  return out;
}

// buildProfile: under-minimum
{
  const profile = buildProfile([
    { id: "a", traits: vec(5, 5), status: "read", rating: 5 },
    { id: "b", traits: vec(5, 5), status: "read", rating: 5 },
  ]);
  assert(profile === null, "buildProfile returns null with <3 read books");
}

// buildProfile: three read books, weighted average
{
  const profile = buildProfile([
    { id: "a", traits: vec(10, 0, 0), status: "read", rating: 5 },
    { id: "b", traits: vec(0, 10, 0), status: "read", rating: 5 },
    { id: "c", traits: vec(0, 0, 10), status: "read", rating: 5 },
  ]);
  assert(profile !== null, "profile built");
  // Each trait appears in exactly one book at 10 → mean 10/3 on its index
  assert(Math.abs(profile![0] - 10 / 3) < 1e-6, "trait 0 is 10/3");
  assert(Math.abs(profile![1] - 10 / 3) < 1e-6, "trait 1 is 10/3");
  assert(Math.abs(profile![2] - 10 / 3) < 1e-6, "trait 2 is 10/3");
  assert(profile![3] === 0, "trait 3 is zero");
}

// buildProfile: low-rated falls back when no ≥4s exist
{
  const profile = buildProfile([
    { id: "a", traits: vec(10), status: "read", rating: 1 },
    { id: "b", traits: vec(10), status: "read", rating: 2 },
    { id: "c", traits: vec(10), status: "read", rating: 3 },
  ]);
  assert(profile !== null, "fallback profile built from low-rated reads");
  assert(profile![0] > 0, "low-rated books still shape the profile when no ≥4 exist");
}

// scoreBook: a gap-filling book beats a taste-match book
{
  const profile = vec(10, 10, 10, 10, 10, 0, 0, 0, 0, 0); // strong on first 5, empty on rest
  const tasteBook = { id: "t", traits: vec(10, 10, 10, 10, 10) };
  const gapBook   = { id: "g", traits: vec(0, 0, 0, 0, 0, 10, 10, 10, 10, 10) };
  const tasteScore = scoreBook(tasteBook, profile);
  const gapScore = scoreBook(gapBook, profile);
  assert(gapScore > tasteScore, `gapBook should outscore tasteBook (gap ${gapScore} vs taste ${tasteScore})`);
}

// pickTopN: diversity actually diverges picks
{
  const profile = vec(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  // 4 nearly-identical investing books, 1 budgeting book
  const candidates = [
    { id: "inv1", traits: vec(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10) },
    { id: "inv2", traits: vec(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10) },
    { id: "inv3", traits: vec(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10) },
    { id: "inv4", traits: vec(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10) },
    { id: "bud",  traits: vec(10) },
  ];
  const picks = pickTopN(candidates, profile, 2);
  const ids = picks.map((p) => p.book.id);
  assert(ids.includes("bud"), `budgeting book should get in despite lower raw score (picks: ${ids.join(",")})`);
}

// cosine: identical vectors → 1, orthogonal → 0
{
  assert(Math.abs(cosine(vec(1, 2, 3), vec(1, 2, 3)) - 1) < 1e-9, "identical cosine");
  assert(Math.abs(cosine(vec(1, 0), vec(0, 1))) < 1e-9, "orthogonal cosine");
}

// whyTag: surfaces the biggest gap × trait
{
  const profile = vec(10, 10, 10, 10, 0, 10, 10, 10, 10, 10); // gap on index 4 = Taxes
  const book = { id: "tax", traits: vec(0, 0, 0, 0, 10, 0, 0, 0, 0, 0) };
  const tag = whyTag(book, profile);
  assert(tag.includes("Taxes"), `expected Taxes tag, got: ${tag}`);
}

// starterBundle: covers distinct pillars
{
  const pool = [
    { id: "a", traits: vec(10, 10, 10) },      // covers 0,1,2
    { id: "b", traits: vec(0, 0, 0, 10, 10) }, // covers 3,4
    { id: "c", traits: vec(0, 0, 0, 10, 10) }, // covers same as b
  ];
  const picks = starterBundle(pool, 2);
  assert(picks.length === 2, "two picks");
  assert(picks[0].id === "a", `first pick covers most (got ${picks[0].id})`);
  // second should pick b or c (doesn't matter which — both cover the new traits equally)
  assert(picks[1].id === "b" || picks[1].id === "c", `second pick covers new traits, got ${picks[1].id}`);
}

console.log("profile.test.ts — all assertions passed");
```

- [ ] **Step 3: Run the test**

```bash
cd /var/www/wallai
npx tsx src/lib/wallai/learn/profile.test.ts
```

Expected: `profile.test.ts — all assertions passed`. If any FAIL line appears, fix the logic in `profile.ts` until it passes.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallai/learn/profile.ts src/lib/wallai/learn/profile.test.ts
git commit -m "feat(learn): profile, scoring, diversity, starter-bundle logic"
```

---

### Task 5: Google Books search wrapper + API route

**Files:** Create `src/lib/wallai/learn/google-books.ts` and `src/app/api/wallai/books/search/route.ts`

- [ ] **Step 1: Write the wrapper**

```ts
// src/lib/wallai/learn/google-books.ts

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
    // Google returns http URLs; rewrite to https to avoid mixed-content warnings.
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
```

- [ ] **Step 2: Write the API route**

```ts
// src/app/api/wallai/books/search/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchGoogleBooks } from "@/lib/wallai/learn/google-books";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  if (q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchGoogleBooks(q, 10);
  return NextResponse.json({ results });
}
```

- [ ] **Step 3: Smoke-test in the browser / curl**

Start dev or use the running pm2 instance. Log in, hit:

```
https://wallai.bruno-dev.xyz/api/wallai/books/search?q=psychology+of+money
```

Expected: JSON with `results: [{ googleId, title, authors, coverUrl, ... }, ...]`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallai/learn/google-books.ts src/app/api/wallai/books/search/route.ts
git commit -m "feat(learn): google books search wrapper and API route"
```

---

### Task 6: AI trait generation + add-book route

**Files:** Create `src/lib/wallai/learn/ai-traits.ts` and `src/app/api/wallai/books/add/route.ts`

- [ ] **Step 1: Inspect existing Anthropic integration**

```bash
cd /var/www/wallai
cat src/lib/anthropic.ts
```

Note how `ApiUsage` rows are created (expected fields: `userId`, `endpoint`, `model`, `inputTokens`, `outputTokens`, `estimatedCost`). Match that pattern in the new code.

- [ ] **Step 2: Write the trait generator**

```ts
// src/lib/wallai/learn/ai-traits.ts
import { prisma } from "@/lib/prisma";
import { getAnthropicClient } from "@/lib/anthropic";
import { getPricing } from "@/lib/pricing";
import { LEARN_TRAITS, TRAIT_COUNT, isValidTraitVector } from "./traits";

const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are a financial-literacy librarian. Given a book's title, author, and description,
score how strongly it teaches each of 20 financial-literacy traits on a 0-10 scale
(0 = not at all, 10 = central theme). Return ONLY a JSON object of the form
{"traits": [n0, n1, ..., n19]} with exactly 20 numbers in the order listed.`;

function userPrompt(input: { title: string; author: string; description: string | null }) {
  const traitList = LEARN_TRAITS.map((t, i) => `${i}. ${t}`).join("\n");
  return `Title: ${input.title}
Author: ${input.author}
Description: ${input.description ?? "not provided"}

Traits (in order):
${traitList}`;
}

export type TraitGenResult =
  | { ok: true; traits: number[] }
  | { ok: false; error: string };

export async function generateTraits(opts: {
  userId: string;
  apiKey: string;
  title: string;
  author: string;
  description: string | null;
}): Promise<TraitGenResult> {
  const client = getAnthropicClient(opts.apiKey);
  let response;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: SYSTEM,
      messages: [{ role: "user", content: userPrompt(opts) }],
    });
  } catch (err) {
    console.error("[ai-traits] anthropic call failed", err);
    return { ok: false, error: "anthropic_call_failed" };
  }

  // Record usage regardless of parse success — tokens were consumed.
  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  const pricing = getPricing(MODEL);
  const estimatedCost =
    (inputTokens / 1_000_000) * pricing.inputPerMTok +
    (outputTokens / 1_000_000) * pricing.outputPerMTok;
  await prisma.apiUsage.create({
    data: {
      userId: opts.userId,
      endpoint: "learn/ai-traits",
      model: MODEL,
      inputTokens,
      outputTokens,
      estimatedCost,
    },
  });

  const text = response.content
    .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("");

  // Extract first JSON object from the response text.
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { ok: false, error: "no_json_in_response" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const maybeTraits = (parsed as { traits?: unknown }).traits;
  if (!isValidTraitVector(maybeTraits)) {
    return { ok: false, error: "invalid_trait_vector" };
  }

  if (maybeTraits.length !== TRAIT_COUNT) {
    return { ok: false, error: "wrong_trait_count" };
  }

  return { ok: true, traits: maybeTraits };
}
```

Note: `getAnthropicClient` and `getPricing` exist in the codebase — confirm their signatures in Step 1 and adjust imports/calls if needed.

- [ ] **Step 3: Check exact signatures of existing helpers**

```bash
cd /var/www/wallai
grep -n "export " src/lib/anthropic.ts src/lib/pricing.ts
```

If `getAnthropicClient` takes different args, or if pricing uses a different shape, adjust the `generateTraits` function accordingly before proceeding. The test here is: does the file compile?

```bash
npx tsc --noEmit
```

Fix any mismatch inline.

- [ ] **Step 4: Write `/api/wallai/books/add`**

```ts
// src/app/api/wallai/books/add/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchGoogleBooks } from "@/lib/wallai/learn/google-books";
import { generateTraits } from "@/lib/wallai/learn/ai-traits";
import { decryptApiKey } from "@/lib/encryption";

const ALLOWED_STATUSES = new Set(["reading", "read", "wantToRead"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const googleId = typeof body?.googleId === "string" ? body.googleId : "";
  const status = typeof body?.status === "string" ? body.status : "wantToRead";
  const rating =
    typeof body?.rating === "number" && body.rating >= 1 && body.rating <= 5
      ? body.rating
      : null;

  if (!googleId) return NextResponse.json({ error: "googleId required" }, { status: 400 });
  if (!ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  let book = await prisma.book.findUnique({ where: { externalId: googleId } });

  // Book not in our DB yet: fetch the metadata and create it.
  if (!book) {
    const searchResults = await searchGoogleBooks(googleId, 1); // googleId works as a search
    const hit = searchResults.find((h) => h.googleId === googleId) ?? searchResults[0];
    if (!hit) {
      return NextResponse.json({ error: "book not found in Google Books" }, { status: 404 });
    }

    book = await prisma.book.create({
      data: {
        externalId: hit.googleId,
        title: hit.title,
        author: hit.authors.join(", ") || "Unknown",
        coverUrl: hit.coverUrl,
        description: hit.description,
        year: hit.publishedYear,
        category: hit.category,
        traits: [],
        traitSource: null,
      },
    });
  }

  // Fill traits via AI if missing. Fire-and-forget wouldn't be safe because
  // the first recommendation load needs them — do it inline, but cap at ~4s.
  if (book.traits.length !== 20) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { anthropicKeyEncrypted: true },
    });
    if (user?.anthropicKeyEncrypted) {
      const apiKey = decryptApiKey(user.anthropicKeyEncrypted);
      const result = await generateTraits({
        userId: session.user.id,
        apiKey,
        title: book.title,
        author: book.author,
        description: book.description,
      });
      if (result.ok) {
        book = await prisma.book.update({
          where: { id: book.id },
          data: {
            traits: result.traits,
            traitSource: "ai",
            traitsGeneratedAt: new Date(),
          },
        });
      }
    }
  }

  // Link to user (upsert — changing status on an existing entry is allowed).
  const userBook = await prisma.userBook.upsert({
    where: { userId_bookId: { userId: session.user.id, bookId: book.id } },
    create: {
      userId: session.user.id,
      bookId: book.id,
      status,
      rating,
      finishedAt: status === "read" ? new Date() : null,
    },
    update: {
      status,
      rating,
      finishedAt: status === "read" ? new Date() : null,
    },
  });

  return NextResponse.json({ book, userBook });
}
```

- [ ] **Step 5: Type-check**

```bash
cd /var/www/wallai
npx tsc --noEmit
```

Expected: clean exit. Fix any `decryptApiKey` signature mismatch (see `src/lib/encryption.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/wallai/learn/ai-traits.ts src/app/api/wallai/books/add/route.ts
git commit -m "feat(learn): add-book route with Claude trait generation"
```

---

### Task 7: UserBook PATCH/DELETE + retry-traits routes

**Files:** Create `src/app/api/wallai/books/[id]/user/route.ts` and `src/app/api/wallai/books/[id]/retry-traits/route.ts`

- [ ] **Step 1: Write the user-book mutation route**

```ts
// src/app/api/wallai/books/[id]/user/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_STATUSES = new Set(["reading", "read", "wantToRead"]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: bookId } = await params;
  const body = await request.json().catch(() => ({}));

  const data: {
    status?: string;
    rating?: number | null;
    finishedAt?: Date | null;
  } = {};

  if (typeof body?.status === "string") {
    if (!ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    data.status = body.status;
    data.finishedAt = body.status === "read" ? new Date() : null;
  }
  if ("rating" in body) {
    if (body.rating === null) {
      data.rating = null;
    } else if (typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5) {
      data.rating = body.rating;
    } else {
      return NextResponse.json({ error: "invalid rating" }, { status: 400 });
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "no fields to update" }, { status: 400 });
  }

  const existing = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: session.user.id, bookId } },
  });
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.userBook.update({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    data,
  });

  return NextResponse.json({ userBook: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: bookId } = await params;

  await prisma.userBook.deleteMany({
    where: { userId: session.user.id, bookId },
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Write the retry-traits route**

```ts
// src/app/api/wallai/books/[id]/retry-traits/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTraits } from "@/lib/wallai/learn/ai-traits";
import { decryptApiKey } from "@/lib/encryption";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id: bookId } = await params;

  // Only let a user trigger a retry for a book they actually have in their list.
  const userBook = await prisma.userBook.findUnique({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    include: { book: true },
  });
  if (!userBook) return NextResponse.json({ error: "not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { anthropicKeyEncrypted: true },
  });
  if (!user?.anthropicKeyEncrypted) {
    return NextResponse.json(
      { error: "Anthropic API key not configured" },
      { status: 400 },
    );
  }

  const apiKey = decryptApiKey(user.anthropicKeyEncrypted);
  const result = await generateTraits({
    userId: session.user.id,
    apiKey,
    title: userBook.book.title,
    author: userBook.book.author,
    description: userBook.book.description,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  const updated = await prisma.book.update({
    where: { id: bookId },
    data: {
      traits: result.traits,
      traitSource: "ai",
      traitsGeneratedAt: new Date(),
    },
  });

  return NextResponse.json({ book: updated });
}
```

- [ ] **Step 3: Type-check**

```bash
cd /var/www/wallai
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/wallai/books/\[id\]/
git commit -m "feat(learn): UserBook PATCH/DELETE and retry-traits routes"
```

---

### Task 8: Recommendations service + routes

**Files:** Create `src/lib/wallai/learn/recommendations.ts`, `src/app/api/wallai/books/recommendations/route.ts`, `src/app/api/wallai/books/recommendations/[bookId]/dismiss/route.ts`

- [ ] **Step 1: Write the service**

```ts
// src/lib/wallai/learn/recommendations.ts
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
  isStarter: boolean;       // true when profile is null and recs are starter bundle
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

  // Pool of recommendable books: known books with valid trait vectors,
  // not already in user's list, not hidden.
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
    const starterByIndex = new Map(pool.map((p) => [p.id, p.raw]));
    return {
      userBooks,
      profile: null,
      readCount,
      isStarter: true,
      recommendations: starter.map((s) => {
        const raw = starterByIndex.get(s.id)!;
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
```

- [ ] **Step 2: Write the recs route**

```ts
// src/app/api/wallai/books/recommendations/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadLearnPayload } from "@/lib/wallai/learn/recommendations";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = await loadLearnPayload(session.user.id);
  return NextResponse.json(payload);
}
```

- [ ] **Step 3: Write the dismiss route**

```ts
// src/app/api/wallai/books/recommendations/[bookId]/dismiss/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ bookId: string }> };

export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { bookId } = await params;

  await prisma.userBookHidden.upsert({
    where: { userId_bookId: { userId: session.user.id, bookId } },
    create: { userId: session.user.id, bookId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Type-check + commit**

```bash
cd /var/www/wallai
npx tsc --noEmit
git add src/lib/wallai/learn/recommendations.ts src/app/api/wallai/books/recommendations/
git commit -m "feat(learn): recommendations service and routes"
```

---

### Task 9: Add-book modal component

**Files:** Create `src/components/wallai/learn/add-book-modal.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/wallai/modal";

type SearchHit = {
  googleId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  description: string | null;
  publishedYear: number | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onAdded: () => void; // parent re-fetches
};

const STATUS_OPTIONS = [
  { value: "read", label: "Read" },
  { value: "reading", label: "Reading" },
  { value: "wantToRead", label: "Want to read" },
] as const;

export function AddBookModal({ open, onClose, onAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchHit | null>(null);
  const [status, setStatus] = useState<"read" | "reading" | "wantToRead">("wantToRead");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelected(null);
      setRating(null);
      setError("");
    }
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/wallai/books/search?q=${encodeURIComponent(query)}`,
        );
        const json = await res.json();
        setResults(json.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  async function handleAdd() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/wallai/books/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: selected.googleId,
          status,
          rating: status === "read" ? rating : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Failed to add book");
        return;
      }
      onAdded();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a book">
      {!selected ? (
        <div className="space-y-3">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or author..."
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
          />
          {searching && <p className="text-xs text-white/40">Searching…</p>}
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {results.map((r) => (
              <li key={r.googleId}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="flex w-full items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-2 text-left hover:bg-white/[0.06]"
                >
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl} alt="" className="h-14 w-10 shrink-0 rounded object-cover" />
                  ) : (
                    <div className="h-14 w-10 shrink-0 rounded bg-white/5" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{r.title}</p>
                    <p className="truncate text-xs text-white/50">
                      {r.authors.join(", ")} {r.publishedYear ? `· ${r.publishedYear}` : ""}
                    </p>
                  </div>
                </button>
              </li>
            ))}
            {query.length >= 2 && !searching && results.length === 0 && (
              <li className="text-xs text-white/40">No matches — try a different title or author</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-3">
            {selected.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selected.coverUrl} alt="" className="h-24 w-16 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-24 w-16 shrink-0 rounded bg-white/5" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{selected.title}</p>
              <p className="truncate text-xs text-white/50">{selected.authors.join(", ")}</p>
              <button
                type="button"
                className="mt-1 text-[10px] text-white/40 underline"
                onClick={() => setSelected(null)}
              >
                Change
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-wider text-white/40">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs ${
                    status === opt.value
                      ? "border-white/30 bg-white/10 text-white"
                      : "border-white/5 bg-white/[0.02] text-white/60"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {status === "read" && (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-white/40">Rating (optional)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`text-lg ${rating && n <= rating ? "text-amber-300" : "text-white/20"}`}
                    aria-label={`${n} star`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="button"
            onClick={handleAdd}
            disabled={saving}
            className="w-full rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-50"
          >
            {saving ? "Adding…" : "Add to my list"}
          </button>
        </div>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd /var/www/wallai
git add src/components/wallai/learn/add-book-modal.tsx
git commit -m "feat(learn): add-book modal with google books autocomplete"
```

---

### Task 10: UserBook row, radar, recommendation card components

**Files:** Create three files in `src/components/wallai/learn/`

- [ ] **Step 1: Write `user-book-row.tsx`**

```tsx
"use client";

import { useState } from "react";

type UserBook = {
  bookId: string;
  status: "reading" | "read" | "wantToRead";
  rating: number | null;
  book: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    traitSource: string | null;
    traits: number[];
  };
};

type Props = {
  userBook: UserBook;
  onChanged: () => void;
};

const STATUS_LABEL: Record<UserBook["status"], string> = {
  reading: "Reading",
  read: "Read",
  wantToRead: "Want to read",
};

const STATUS_COLOR: Record<UserBook["status"], string> = {
  reading: "bg-amber-500/15 text-amber-300",
  read: "bg-emerald-500/15 text-emerald-300",
  wantToRead: "bg-indigo-500/15 text-indigo-300",
};

export function UserBookRow({ userBook, onChanged }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsTraits = userBook.book.traits.length !== 20;

  async function patch(body: unknown) {
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/${userBook.bookId}/user`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onChanged();
    } finally {
      setBusy(false);
      setMenuOpen(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Remove this book from your list?")) return;
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/${userBook.bookId}/user`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function retryTraits() {
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/${userBook.bookId}/retry-traits`, { method: "POST" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      {userBook.book.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={userBook.book.coverUrl} alt="" className="h-16 w-11 shrink-0 rounded object-cover" />
      ) : (
        <div className="h-16 w-11 shrink-0 rounded bg-white/5" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{userBook.book.title}</p>
        <p className="truncate text-xs text-white/50">{userBook.book.author}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_COLOR[userBook.status]}`}>
            {STATUS_LABEL[userBook.status]}
          </span>
          {userBook.status === "read" && userBook.rating !== null && (
            <span className="text-[10px] text-amber-300">
              {"★".repeat(userBook.rating)}
              <span className="text-white/10">{"★".repeat(5 - userBook.rating)}</span>
            </span>
          )}
          {needsTraits && (
            <button
              type="button"
              onClick={retryTraits}
              disabled={busy}
              className="rounded-full border border-amber-500/30 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/10"
            >
              traits pending — retry
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/5"
          aria-label="Book options"
        >
          ⋯
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-white/10 bg-[#0b0b0e] p-1 shadow-xl">
            {(["read", "reading", "wantToRead"] as const)
              .filter((s) => s !== userBook.status)
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => patch({ status: s })}
                  className="block w-full rounded px-2 py-1.5 text-left text-xs text-white/80 hover:bg-white/5"
                >
                  Mark as {STATUS_LABEL[s]}
                </button>
              ))}
            <hr className="my-1 border-white/5" />
            <button
              type="button"
              disabled={busy}
              onClick={handleDelete}
              className="block w-full rounded px-2 py-1.5 text-left text-xs text-red-400 hover:bg-white/5"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `profile-radar.tsx`**

```tsx
"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { LEARN_TRAITS, CORE_TRAIT_INDICES, WEALTH_TRAIT_INDICES } from "@/lib/wallai/learn/traits";

type Props = {
  profile: number[];
};

export function ProfileRadar({ profile }: Props) {
  const core = CORE_TRAIT_INDICES.map((i) => ({
    trait: LEARN_TRAITS[i],
    value: Number(profile[i].toFixed(1)),
  }));
  const wealth = WEALTH_TRAIT_INDICES.map((i) => ({
    trait: LEARN_TRAITS[i],
    value: Number(profile[i].toFixed(1)),
  }));

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <RadarPanel title="Core literacy" data={core} />
      <RadarPanel title="Wealth building" data={wealth} />
    </div>
  );
}

function RadarPanel({
  title,
  data,
}: {
  title: string;
  data: Array<{ trait: string; value: number }>;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-white/40">{title}</p>
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis
              dataKey="trait"
              tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 9 }}
            />
            <PolarRadiusAxis domain={[0, 10]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.35} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `recommendation-card.tsx`**

```tsx
"use client";

import { useState } from "react";

type Rec = {
  book: {
    id: string;
    title: string;
    author: string;
    coverUrl: string | null;
    category: string;
  };
  whyTag: string;
};

type Props = {
  rec: Rec;
  onChanged: () => void;
};

export function RecommendationCard({ rec, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function add(status: "wantToRead" | "read" | "reading") {
    setBusy(true);
    try {
      await fetch("/api/wallai/books/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleId: await resolveGoogleId(rec.book.id),
          status,
        }),
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function resolveGoogleId(bookId: string): Promise<string> {
    // Recommended books live in our DB, so we need to hit a tiny lookup.
    const res = await fetch(`/api/wallai/books/recommendations`);
    const json = await res.json();
    type R = { book: { id: string }; };
    const match = (json.recommendations as R[]).find((r) => r.book.id === bookId);
    // Fallback: the /add route also accepts a book already in our DB by its
    // externalId — but for simplicity we'll round-trip through search when
    // that's missing. In practice the book was seeded or added by someone
    // else, so it always has an externalId — we expose that via a small
    // direct endpoint in a later task if needed.
    // For now, send the bookId; the /add route resolves by externalId OR id.
    return match ? bookId : bookId;
  }

  async function dismiss() {
    setBusy(true);
    try {
      await fetch(`/api/wallai/books/recommendations/${rec.book.id}/dismiss`, {
        method: "POST",
      });
      setDismissed(true);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="flex flex-col rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-start gap-3">
        {rec.book.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={rec.book.coverUrl} alt="" className="h-20 w-14 shrink-0 rounded object-cover" />
        ) : (
          <div className="h-20 w-14 shrink-0 rounded bg-white/5" />
        )}
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-medium text-white">{rec.book.title}</p>
          <p className="truncate text-xs text-white/50">{rec.book.author}</p>
          <p className="mt-1 text-[10px] text-indigo-300">{rec.whyTag}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => add("wantToRead")}
          className="flex-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-white/20 disabled:opacity-50"
        >
          Add to list
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={dismiss}
          className="rounded-lg border border-white/10 px-2 py-1.5 text-[11px] text-white/60 hover:bg-white/5 disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
```

**Important fix for `resolveGoogleId`:** The function above round-trips pointlessly. Replace Step 3's component with the simpler version — have `/api/wallai/books/add` accept `bookId` as an alternative to `googleId`. Before proceeding, apply the following correction:

- [ ] **Step 4: Extend `/api/wallai/books/add` to accept `bookId`**

In `src/app/api/wallai/books/add/route.ts`, replace the lookup section. After parsing `body`, add:

```ts
const bookId = typeof body?.bookId === "string" ? body.bookId : "";
```

Then replace:

```ts
let book = await prisma.book.findUnique({ where: { externalId: googleId } });
```

with:

```ts
let book = bookId
  ? await prisma.book.findUnique({ where: { id: bookId } })
  : googleId
    ? await prisma.book.findUnique({ where: { externalId: googleId } })
    : null;
```

And update the earlier validation:

```ts
if (!googleId && !bookId) {
  return NextResponse.json({ error: "googleId or bookId required" }, { status: 400 });
}
```

- [ ] **Step 5: Simplify `recommendation-card.tsx`**

Replace the `add` and `resolveGoogleId` logic with:

```tsx
async function add(status: "wantToRead" | "read" | "reading") {
  setBusy(true);
  try {
    await fetch("/api/wallai/books/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId: rec.book.id, status }),
    });
    onChanged();
  } finally {
    setBusy(false);
  }
}
```

Remove `resolveGoogleId` entirely.

- [ ] **Step 6: Type-check + commit**

```bash
cd /var/www/wallai
npx tsc --noEmit
git add src/components/wallai/learn/ src/app/api/wallai/books/add/route.ts
git commit -m "feat(learn): user-book row, profile radar, recommendation card"
```

---

### Task 11: Wire up the /learn page

**Files:** Overwrite `src/app/(app)/learn/page.tsx`

- [ ] **Step 1: Write a client wrapper that owns the fetched state**

Because add/dismiss/change actions need to refresh data, make a small client island that owns the `LearnPayload` state and re-fetches on changes. Create `src/components/wallai/learn/learn-client.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/wallai/glass-card";
import { AddBookModal } from "./add-book-modal";
import { UserBookRow } from "./user-book-row";
import { ProfileRadar } from "./profile-radar";
import { RecommendationCard } from "./recommendation-card";

type Payload = {
  userBooks: Array<{
    bookId: string;
    status: "reading" | "read" | "wantToRead";
    rating: number | null;
    book: {
      id: string;
      title: string;
      author: string;
      coverUrl: string | null;
      traits: number[];
      traitSource: string | null;
    };
  }>;
  profile: number[] | null;
  readCount: number;
  isStarter: boolean;
  recommendations: Array<{
    book: { id: string; title: string; author: string; coverUrl: string | null; category: string };
    whyTag: string;
  }>;
};

const STATUS_ORDER: Array<Payload["userBooks"][number]["status"]> = [
  "reading",
  "wantToRead",
  "read",
];
const STATUS_HEADING = {
  reading: "Currently reading",
  wantToRead: "Want to read",
  read: "Read",
} as const;

export function LearnClient({ initial }: { initial: Payload }) {
  const [data, setData] = useState<Payload>(initial);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallai/books/recommendations");
      if (res.ok) {
        const json = (await res.json()) as Payload;
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Light refresh when the page regains focus, so status changes from other tabs appear.
  useEffect(() => {
    function onFocus() {
      reload();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [reload]);

  const grouped = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, data.userBooks.filter((ub) => ub.status === s)]),
  ) as Record<Payload["userBooks"][number]["status"], Payload["userBooks"]>;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">Learn</h2>
          <p className="mt-0.5 text-xs text-white/40 sm:text-sm">
            Track what you've read and get 5 picks tailored to what you haven't
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
        >
          + Add book
        </button>
      </div>

      {/* Your reading */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">Your reading</h3>
        {data.userBooks.length === 0 ? (
          <GlassCard>
            <p className="py-6 text-center text-sm text-white/50">
              No books tracked yet. Add your first to start your profile.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {STATUS_ORDER.map((s) =>
              grouped[s].length === 0 ? null : (
                <div key={s}>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {STATUS_HEADING[s]}
                  </h4>
                  <div className="space-y-2">
                    {grouped[s].map((ub) => (
                      <UserBookRow key={ub.bookId} userBook={ub} onChanged={reload} />
                    ))}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* Profile */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">Your profile</h3>
        {data.profile ? (
          <ProfileRadar profile={data.profile} />
        ) : (
          <GlassCard>
            <p className="py-4 text-center text-xs text-white/50">
              Mark {Math.max(3 - data.readCount, 0)} more book
              {Math.max(3 - data.readCount, 0) === 1 ? "" : "s"} as{" "}
              <span className="text-white/70">Read</span> to unlock your personalized profile.
            </p>
          </GlassCard>
        )}
      </section>

      {/* Recommendations */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-white/80">
          {data.isStarter ? "A great place to start" : "Picked for you"}
        </h3>
        {data.recommendations.length === 0 ? (
          <GlassCard>
            <p className="py-4 text-center text-xs text-white/50">
              You've seen every book we know. Add one yourself to get more picks.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.recommendations.map((r) => (
              <RecommendationCard key={r.book.id} rec={r} onChanged={reload} />
            ))}
          </div>
        )}
      </section>

      <AddBookModal open={modalOpen} onClose={() => setModalOpen(false)} onAdded={reload} />
      {loading && (
        <p className="text-center text-[10px] text-white/30">updating…</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite `src/app/(app)/learn/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadLearnPayload } from "@/lib/wallai/learn/recommendations";
import { LearnClient } from "@/components/wallai/learn/learn-client";
import { GlassCard } from "@/components/wallai/glass-card";
import { TipCard } from "@/components/wallai/learn/tip-card";

export const dynamic = "force-dynamic";

const CATEGORY_ORDER = ["mindset", "saving", "investing", "budgeting", "debt"] as const;

function categoryLabel(c: string | null): string {
  if (!c) return "General";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

export default async function LearnPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [payload, tips] = await Promise.all([
    loadLearnPayload(session.user.id),
    prisma.financialTip.findMany({ orderBy: { id: "asc" } }),
  ]);

  const byCategory = new Map<string, typeof tips>();
  for (const t of tips) {
    const key = t.category ?? "general";
    const list = byCategory.get(key) ?? [];
    list.push(t);
    byCategory.set(key, list);
  }
  const orderedKeys = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...Array.from(byCategory.keys()).filter(
      (k) => !(CATEGORY_ORDER as readonly string[]).includes(k),
    ),
  ];

  return (
    <div>
      <LearnClient initial={payload} />

      {tips.length > 0 && (
        <section className="mt-10">
          <h3 className="mb-3 text-sm font-semibold text-white/80 sm:mb-4">Tips &amp; Quotes</h3>
          <div className="space-y-6">
            {orderedKeys.map((key) => {
              const list = byCategory.get(key) ?? [];
              return (
                <div key={key}>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                    {categoryLabel(key)}
                  </h4>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {list.map((tip) => (
                      <TipCard key={tip.id} tip={tip} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build + type-check**

```bash
cd /var/www/wallai
npm run build
```

Expected: clean build. Fix any import/typing issue inline.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/learn/page.tsx src/components/wallai/learn/learn-client.tsx
git commit -m "feat(learn): rework /learn with profile, recs, and book tracking"
```

---

### Task 12: Deploy and end-to-end verification

**Files:** none — runtime-only

- [ ] **Step 1: Push + restart**

```bash
cd /var/www/wallai
git push
pm2 restart wallai
pm2 logs wallai --lines 30 --nostream
```

Expected: no errors in the tail; "ready" line from Next.

- [ ] **Step 2: E2E manual checklist** (use mobile viewport 375px in devtools)

Visit `https://wallai.bruno-dev.xyz/learn` and confirm:

1. "Your reading" section shows an empty state
2. "Your profile" shows the 3-more-books empty state
3. "A great place to start" shows 5 starter cards from the curated catalogue, visually diverse
4. "+ Add book" opens the modal; typing "psychology of money" returns results with covers
5. Selecting a result, picking "Read" + 5 stars, clicking Add closes the modal and the book appears under "Read"
6. Repeat 2 more times with different titles — after the 3rd Read book, the profile radar renders (two stacked radars on mobile, side-by-side at ≥md)
7. "Picked for you" now shows 5 cards with "Fills a gap in …" tags, and no card duplicates a book in "Your reading"
8. Clicking "Dismiss" on a rec removes it; reloading the page confirms it doesn't come back
9. Clicking "Add to list" on a rec moves it into "Want to read" and shows a new rec in its place
10. The `⋯` menu on a user-book row changes status and rating
11. The existing "Tips & Quotes" section still renders below everything

- [ ] **Step 3: Check Anthropic usage**

Visit `/settings` and confirm the AI-usage widget reflects calls to `learn/ai-traits`. This proves the trait-generation flow actually runs when users add a non-seeded book.

- [ ] **Step 4: Final commit/push if anything was tweaked during E2E**

```bash
cd /var/www/wallai
git status
# if there are changes:
git add -A
git commit -m "fix(learn): E2E tweaks from manual verification"
git push
pm2 restart wallai
```

---

## Self-review

**Spec coverage:** walked the spec section-by-section.

- 20-trait vocabulary → Task 1 ✓
- Schema changes → Task 2 ✓
- Google Books lookup → Task 5 ✓
- Claude trait prompt → Task 6 ✓
- Profile + scoring + diversity → Task 4 ✓
- Seed catalogue (30 books) → Task 3 ✓
- API routes (search, add, user PATCH/DELETE, retry, recommendations, dismiss) → Tasks 5, 6, 7, 8 ✓
- Page layout + 4 components → Tasks 9, 10, 11 ✓
- Mobile-first reliability → Task 12 Step 2 ✓
- Edge cases (<3 read, AI failure, duplicate, exhausted pool, why-tag ties) → covered in profile.ts, recommendations.ts, user-book-row.tsx ✓
- Testing → Task 4 Step 2 (`profile.test.ts`) + Task 12 E2E ✓

**Placeholder scan:** code blocks are present in every step that writes or edits code. The one "reference to a function defined elsewhere" note in Task 6 Step 2 (re: `getAnthropicClient` signature) is resolved explicitly in Step 3 with a check command.

**Type consistency:** `LearnPayload`, `RecommendationDTO`, `UserBookDTO`, `Profile`, and `BookTraits` are defined once (in `recommendations.ts` / `profile.ts`) and imported where needed. Status values (`"read" | "reading" | "wantToRead"`) are consistent across routes, components, and schema.
