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
  const gapScore = cosine(gap, book.traits);
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
