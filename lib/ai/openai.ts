/**
 * OpenAI provider — chat completions with a JSON-forced analysis prompt.
 */
import type { AiAnalysis, AiInput } from "./types";
import { AiProviderError } from "./types";
import { SYSTEM_PROMPT, buildUserPrompt, normalizeAnalysis, parseJsonish, fetchWithTimeout } from "./llm";

const OPENAI_BASE = "https://api.openai.com/v1";

export async function analyzeOpenAi(input: AiInput, apiKey: string, model = "gpt-4o-mini"): Promise<AiAnalysis> {
  let res: Response;
  try {
    res = await fetchWithTimeout(`${OPENAI_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input) },
        ],
      }),
    });
  } catch {
    throw new AiProviderError("Could not reach the OpenAI API (network error or timeout).");
  }
  if (res.status === 401) throw new AiProviderError("OpenAI rejected the API key (401).");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AiProviderError(`OpenAI request failed (${res.status}). ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const parsed = parseJsonish(content);
  if (!parsed) throw new AiProviderError("OpenAI returned unreadable output.");
  return normalizeAnalysis(parsed, "openai", model);
}
