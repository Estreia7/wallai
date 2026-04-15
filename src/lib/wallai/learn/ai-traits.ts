import { getAnthropicClient, logApiUsage, ApiKeyNotConfiguredError } from "@/lib/anthropic";
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
  title: string;
  author: string;
  description: string | null;
}): Promise<TraitGenResult> {
  let client;
  try {
    client = await getAnthropicClient(opts.userId);
  } catch (err) {
    if (err instanceof ApiKeyNotConfiguredError) return { ok: false, error: "no_api_key" };
    throw err;
  }

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

  const inputTokens = response.usage?.input_tokens ?? 0;
  const outputTokens = response.usage?.output_tokens ?? 0;
  await logApiUsage({
    userId: opts.userId,
    endpoint: "learn/ai-traits",
    model: MODEL,
    inputTokens,
    outputTokens,
  });

  const text = response.content
    .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
    .map((c) => c.text)
    .join("");

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
