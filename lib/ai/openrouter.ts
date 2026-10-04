/**
 * OpenRouter provider — automatically picks a free model.
 * Queries the public model list, filters for $0 prompt+completion pricing,
 * prefers a curated list of strong free models, falls back to the largest
 * free context window available. Result is cached for 1 hour.
 */
import type { AiAnalysis, AiInput } from "./types";
import { AiProviderError } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt, normalizeAnalysis, parseJsonish, fetchWithTimeout } from "./llm";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

// Preferred free models in order (all $0.00 at time of writing)
const PREFERRED_FREE = [
  "deepseek/deepseek-chat-v3-0324:free",
  "deepseek/deepseek-r1-0528:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemma-3-27b-it:free",
  "mistralai/mistral-small-3.2-24b-instruct:free",
  "moonshotai/kimi-k2:free",
];

interface ORModel {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

let cache: { models: string[]; at: number } | null = null;
const CACHE_MS = 60 * 60 * 1000;

async function fetchFreeModels(apiKey: string): Promise<string[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.models;
  const res = await fetchWithTimeout(`${OPENROUTER_BASE}/models`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new AiProviderError(`OpenRouter model list failed (${res.status}). Check the API key.`);
  const data = (await res.json()) as { data?: ORModel[] };
  const free = (data.data || [])
    .filter((m) => {
      const p = m.pricing;
      if (!p) return false;
      const prompt = Number(p.prompt ?? "1");
      const completion = Number(p.completion ?? "1");
      return prompt === 0 && completion === 0;
    })
    .map((m) => ({ id: m.id, ctx: m.context_length ?? 0 }));

  if (free.length === 0) throw new AiProviderError("No free models are currently available on OpenRouter.");

  const ordered: string[] = [];
  for (const pref of PREFERRED_FREE) {
    if (free.some((m) => m.id === pref)) ordered.push(pref);
  }
  const rest = free
    .filter((m) => !ordered.includes(m.id))
    .sort((a, b) => b.ctx - a.ctx)
    .map((m) => m.id);
  const models = [...ordered, ...rest];
  cache = { models, at: Date.now() };
  return models;
}

export async function pickFreeModel(apiKey: string): Promise<string> {
  const models = await fetchFreeModels(apiKey);
  return models[0];
}

export async function analyzeOpenRouter(input: AiInput, apiKey: string, preferredModel?: string): Promise<AiAnalysis> {
  const free = await fetchFreeModels(apiKey);
  const candidates = preferredModel ? [preferredModel, ...free] : free;
  let lastErr: unknown = null;

  for (const model of candidates.slice(0, 4)) {
    try {
      const res = await fetchWithTimeout(`${OPENROUTER_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://opencampaign.app",
          "X-Title": "OpenCampaign",
        },
        body: JSON.stringify({
          model,
          temperature: 0.4,
          max_tokens: 1400,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserPrompt(input) },
          ],
        }),
      });
      if (!res.ok) {
        lastErr = new AiProviderError(`Model ${model} returned ${res.status}`);
        continue;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content ?? "";
      const parsed = parseJsonish(content);
      if (!parsed) {
        lastErr = new AiProviderError(`Model ${model} returned unreadable output`);
        continue;
      }
      return normalizeAnalysis(parsed, "openrouter", `${model} (auto-selected free)`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw new AiProviderError(
    `OpenRouter analysis failed on all free models. ${lastErr instanceof Error ? lastErr.message : ""}`.trim()
  );
}
