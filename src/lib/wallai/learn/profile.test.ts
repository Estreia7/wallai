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

// scoreBook: a gap-filling book beats a taste-match book
{
  const profile = vec(10, 10, 10, 10, 10, 0, 0, 0, 0, 0);
  const tasteBook = { id: "t", traits: vec(10, 10, 10, 10, 10) };
  const gapBook   = { id: "g", traits: vec(0, 0, 0, 0, 0, 10, 10, 10, 10, 10) };
  const tasteScore = scoreBook(tasteBook, profile);
  const gapScore = scoreBook(gapBook, profile);
  assert(gapScore > tasteScore, `gapBook should outscore tasteBook (gap ${gapScore} vs taste ${tasteScore})`);
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

// starterBundle: covers distinct pillars
{
  const pool = [
    { id: "a", traits: vec(10, 10, 10) },
    { id: "b", traits: vec(0, 0, 0, 10, 10) },
    { id: "c", traits: vec(0, 0, 0, 10, 10) },
  ];
  const picks = starterBundle(pool, 2);
  assert(picks.length === 2, "two picks");
  assert(picks[0].id === "a", `first pick covers most (got ${picks[0].id})`);
  assert(picks[1].id === "b" || picks[1].id === "c", `second pick covers new traits, got ${picks[1].id}`);
}

console.log("profile.test.ts — all assertions passed");
