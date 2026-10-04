/**
 * PublikHQ provider — talks to a PublikHQ-compatible AI endpoint.
 *
 * Default endpoint:  POST {publikhqUrl}/api/v1/ai/analyze
 * Auth:              Authorization: Bearer {apiKey}
 * Request body:      { "campaign": { name, subject, previewText, content, fromName, fromEmail } }
 *
 * Accepted response shapes (parsed defensively, in order):
 *   1. { "score": n, "summary": "...", "strengths": [], "issues": [], "suggestions": [], "subjectIdeas": [] }
 *   2. { "data": { ...same as 1... } }
 *   3. { "analysis": "JSON or prose string" }
 *   4. { "content": "JSON or prose string" }  /  { "text": "..." }
 * Prose fallback: the local engine supplies the score and the prose is used
 * as the summary, split into suggestions.
 */
import type { AiAnalysis, AiInput } from "./types";
import { AiProviderError } from "./types";
import { analyzeLocally } from "./local";
import { buildUserPrompt, parseJsonish, fetchWithTimeout } from "./llm";

export async function analyzePublikhq(
  input: AiInput,
  baseUrl: string,
  apiKey: string
): Promise<AiAnalysis> {
  const base = (baseUrl || "https://publikhq.com").replace(/\/+$/, "");
  const endpoint = `${base}/api/v1/ai/analyze`;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      endpoint,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ campaign: input, prompt: buildUserPrompt(input) }),
      },
      90000
    );
  } catch {
    throw new AiProviderError(`Could not reach the PublikHQ endpoint at ${endpoint}.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new AiProviderError("PublikHQ rejected the API key. Check it under Settings → AI Analysis.");
  }
  if (!res.ok) {
    throw new AiProviderError(`PublikHQ request failed (${res.status}).`);
  }

  const raw = await res.text();
  let payload: Record<string, unknown> | null = null;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  // unwrap common envelopes
  let inner: unknown = payload;
  if (inner && typeof inner === "object") {
    const obj = inner as Record<string, unknown>;
    if (obj.data && typeof obj.data === "object") inner = obj.data;
  }
  if (inner && typeof inner === "object") {
    const obj = inner as Record<string, unknown>;
    for (const key of ["analysis", "content", "text", "result"]) {
      if (typeof obj[key] === "string" && obj[key]) {
        const parsedInner = parseJsonish(obj[key] as string);
        if (parsedInner) {
          return finalize(parsedInner, base);
        }
        // prose response — merge with local scoring
        return proseAnalysis(obj[key] as string, input);
      }
    }
  }
  if (inner && typeof inner === "object") {
    return finalize(inner as Record<string, unknown>, base);
  }
  if (payload === null && raw.trim().length > 0) {
    return proseAnalysis(raw, input);
  }
  throw new AiProviderError("PublikHQ returned an unreadable response.");
}

function finalize(parsed: Record<string, unknown>, base: string): AiAnalysis {
  const local = { ...parsed } as Partial<AiAnalysis> & { subjectIdeas?: string[] };
  if (local.model && typeof local.model === "string") {
    // pass through
  }
  const normalized = normalizeLoose(local, `PublikHQ AI (${base})`);
  return normalized;
}

function normalizeLoose(parsed: Partial<AiAnalysis>, model: string): AiAnalysis {
  const clamp = (n: unknown) =>
    typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  const arr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim()).map((x) => x.trim()).slice(0, 6)
      : [];
  const score = clamp(parsed.score);
  const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : "PublikHQ analysis completed.";
  return {
    provider: "publikhq",
    model,
    score: score ?? 60,
    summary: score === null ? `${summary} (no numeric score returned.)` : summary,
    strengths: arr(parsed.strengths),
    issues: arr(parsed.issues),
    suggestions: arr(parsed.suggestions),
    subjectIdeas: arr(parsed.subjectIdeas),
    checkedAt: new Date().toISOString(),
  };
}

function proseAnalysis(prose: string, input: AiInput): AiAnalysis {
  const local = analyzeLocally(input);
  const lines = prose
    .split(/\n+/)
    .map((l) => l.replace(/^[\s\-*\d.)]+/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 6);
  return {
    provider: "publikhq",
    model: "PublikHQ AI (prose)",
    score: local.score,
    summary: prose.trim().slice(0, 500),
    strengths: local.strengths.slice(0, 2),
    issues: local.issues.slice(0, 3),
    suggestions: lines.length ? lines : local.suggestions,
    checkedAt: new Date().toISOString(),
  };
}
