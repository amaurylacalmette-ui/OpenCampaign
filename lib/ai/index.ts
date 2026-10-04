/**
 * AI dispatcher — routes an analysis request to the configured provider.
 * Settings (and API keys) are per-account.
 */
import type { AiAnalysis, AiInput } from "./types";
import { AiProviderError } from "./types";
import { analyzeLocally } from "./local";
import { analyzeOpenRouter, pickFreeModel } from "./openrouter";
import { analyzeOpenAi } from "./openai";
import { analyzePublikhq } from "./publikhq";
import { db } from "@/lib/db";
import { ensureSettings } from "@/lib/auth";

export { pickFreeModel };
export type { AiAnalysis, AiInput };
export { AiProviderError };

export async function runAnalysis(input: AiInput, providerOverride?: string, userId?: string): Promise<AiAnalysis> {
  if (!userId) throw new AiProviderError("No account context for AI analysis.");
  const settings = await ensureSettings(userId);
  const provider = providerOverride || settings.aiProvider || "local";

  switch (provider) {
    case "local":
      return analyzeLocally(input);
    case "openrouter": {
      const key = settings.openrouterKey || "";
      if (!key) throw new AiProviderError("No OpenRouter API key configured. Add one under Settings → AI Analysis.");
      return analyzeOpenRouter(input, key);
    }
    case "openai": {
      const key = settings.openaiKey || "";
      if (!key) throw new AiProviderError("No OpenAI API key configured. Add one under Settings → AI Analysis.");
      return analyzeOpenAi(input, key);
    }
    case "publikhq":
      return analyzePublikhq(input, settings.publikhqUrl || "https://publikhq.com", settings.publikhqKey || "");
    default:
      throw new AiProviderError(`Unknown AI provider: ${provider}`);
  }
}
