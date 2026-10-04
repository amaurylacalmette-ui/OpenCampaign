export type Severity = "good" | "info" | "warning" | "critical";

export interface AiFinding {
  severity: Severity;
  title: string;
  detail: string;
}

export interface AiAnalysis {
  provider: "local" | "openrouter" | "openai" | "publikhq";
  model?: string;
  score: number; // 0-100
  summary: string;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  subjectIdeas?: string[];
  checkedAt: string;
}

export interface AiInput {
  name: string;
  subject: string;
  previewText?: string;
  content: string;
  fromName?: string;
  fromEmail?: string;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}
