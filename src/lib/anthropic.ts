import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { calculateCost } from "@/lib/pricing";

export class ApiKeyNotConfiguredError extends Error {
  constructor() {
    super("Anthropic API key not configured. Please add it in Settings.");
    this.name = "ApiKeyNotConfiguredError";
  }
}

export async function getAnthropicClient(userId: string): Promise<Anthropic> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { anthropicKeyEncrypted: true },
  });

  if (!user?.anthropicKeyEncrypted) {
    throw new ApiKeyNotConfiguredError();
  }

  const apiKey = decrypt(user.anthropicKeyEncrypted);
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
