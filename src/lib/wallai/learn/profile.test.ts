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

// scoreBook: popularity beats gap-fill at equal popularity delta
{
  const profile = vec(10, 10, 10, 10, 10, 0, 0, 0, 0, 0);
  const popularBook = { id: "p", traits: vec(10, 10, 10, 10, 10), popularity: 100 };
  const nichegapBook = { id: "g", traits: vec(0, 0, 0, 0, 0, 10, 10, 10, 10, 10), popularity: 20 };
  const popScore = scoreBook(popularBook, profile);
  const nicheScore = scoreBook(nichegapBook, profile);
  assert(popScore > nicheScore, `popular taste-match should beat niche gap-fill (pop ${popScore} vs niche ${nicheScore})`);
}

// scoreBook: at equal popularity, taste-match beats pure gap-fill
{
  const profile = vec(10, 10, 10, 10, 10, 0, 0, 0, 0, 0);
  const tasteBook = { id: "t", traits: vec(10, 10, 10, 10, 10), popularity: 50 };
  const gapBook   = { id: "g", traits: vec(0, 0, 0, 0, 0, 10, 10, 10, 10, 10), popularity: 50 };
  const tasteScore = scoreBook(tasteBook, profile);
  const gapScore = scoreBook(gapBook, profile);
  assert(tasteScore > gapScore, `tasteBook should outscore gapBook at equal popularity (taste ${tasteScore} vs gap ${gapScore})`);
}

// pickTopN: diversity actually diverges picks
{
  const profile = vec(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
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
  const profile = vec(10, 10, 10, 10, 0, 10, 10, 10, 10, 10);
  const book = { id: "tax", traits: vec(0, 0, 0, 0, 10, 0, 0, 0, 0, 0) };
  const tag = whyTag(book, profile);
  assert(tag.includes("Taxes"), `expected Taxes tag, got: ${tag}`);
}

// starterBundle: sorts by popularity (foundational classics first)
{
  const pool = [
    { id: "niche",   traits: vec(10, 10, 10), popularity: 30 },
    { id: "classic", traits: vec(10, 0, 0),   popularity: 98 },
    { id: "solid",   traits: vec(0, 10, 0),   popularity: 75 },
  ];
  const picks = starterBundle(pool, 2);
  assert(picks.length === 2, "two picks");
  assert(picks[0].id === "classic", `most-popular book first (got ${picks[0].id})`);
  assert(picks[1].id === "solid", `second-most-popular second (got ${picks[1].id})`);
}

console.log("profile.test.ts — all assertions passed");
