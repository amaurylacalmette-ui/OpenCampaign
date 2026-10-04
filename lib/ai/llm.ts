/**
 * Shared helpers for LLM-backed providers (OpenRouter / OpenAI / PublikHQ).
 */
import type { AiAnalysis, AiInput } from "./types";

export const SYSTEM_PROMPT =
  "You are an expert email marketing analyst. You evaluate campaign emails for deliverability, engagement and copy quality. You answer with strict JSON only — no markdown fences, no commentary.";

export function buildUserPrompt(input: AiInput): string {
  const text = input.content
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);
  return `Analyze this email campaign and reply with JSON matching exactly this shape:
{"score": <integer 0-100>, "summary": "<2-3 sentence verdict>", "strengths": ["..."], "issues": ["..."], "suggestions": ["..."], "subjectIdeas": ["..."]}
Rules: score 100 = excellent, below 50 = should not be sent. Give 2-4 items per list. suggestions must be concrete rewrites, not generic advice. subjectIdeas = 3 alternative subject lines.

Campaign name: ${input.name}
From: ${input.fromName || "unknown"} <${input.fromEmail || "unknown"}>
Subject line: ${input.subject || "(empty)"}
Preview text: ${input.previewText || "(none)"}
Body text: ${text || "(empty)"}`;
}

export function parseJsonish(raw: string): Partial<AiAnalysis> | null {
  if (!raw) return null;
  let s = raw.trim();
  s = s.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1));
    if (typeof obj === "object" && obj !== null) return obj;
    return null;
  } catch {
    return null;
  }
}

export function normalizeAnalysis(
  parsed: Partial<AiAnalysis>,
  provider: AiAnalysis["provider"],
  model: string
): AiAnalysis {
  const clampScore = (n: unknown) =>
    typeof n === "number" && isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  const strArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim()).slice(0, 6) : [];
  const score = clampScore(parsed.score);
  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : "Analysis completed.";
  return {
    provider,
    model,
    score: score ?? 60,
    summary: score === null ? `${summary} (provider did not return a numeric score.)` : summary,
    strengths: strArr(parsed.strengths),
    issues: strArr(parsed.issues),
    suggestions: strArr(parsed.suggestions),
    subjectIdeas: strArr(parsed.subjectIdeas),
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60000): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}
