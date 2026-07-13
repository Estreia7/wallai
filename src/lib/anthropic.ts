import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { calculateCost } from "@/lib/pricing";

export class ApiKeyNotConfiguredError extends Error {
  constructor() {
    super("AI is not available yet. The administrator hasn't configured an Anthropic API key.");
    this.name = "ApiKeyNotConfiguredError";
  }
}

/** Resolve the admin-owned, app-wide Anthropic key (shared by all users). */
async function getSharedApiKey(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: "admin", anthropicKeyEncrypted: { not: null } },
    select: { anthropicKeyEncrypted: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin?.anthropicKeyEncrypted) {
    throw new ApiKeyNotConfiguredError();
  }
  return decrypt(admin.anthropicKeyEncrypted);
}

/**
 * Returns an Anthropic client backed by the shared admin key. The `userId`
 * parameter is retained for call-site compatibility and usage attribution;
 * the key itself is app-wide, not per-user.
 */
export async function getAnthropicClient(_userId: string): Promise<Anthropic> {
  const apiKey = await getSharedApiKey();
  return new Anthropic({ apiKey });
}

export async function logApiUsage(params: {
  userId: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}): Promise<void> {
  const estimatedCost = calculateCost(params.model, params.inputTokens, params.outputTokens);
  await prisma.apiUsage.create({
    data: {
      userId: params.userId,
      endpoint: params.endpoint,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCost,
    },
  });
}
