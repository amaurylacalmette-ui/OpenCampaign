"use client";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let unauthorizedHandler: (() => void) | null = null;

/**
 * Registered by the app shell. Fires when a data request comes back 401
 * (session expired / signed out elsewhere) so the UI can return to the
 * auth screen instead of crashing or showing stale empty views.
 */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Auth endpoints legitimately return 401 for bad credentials — only
    // treat 401s on data endpoints as session loss.
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      unauthorizedHandler?.();
    }
    throw new ApiError(
      (data as { error?: string }).error || `Request failed (${res.status})`,
      res.status
    );
  }
  return data as T;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Contact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  status: string;
  tags: string;
  createdAt: string;
}

export interface CampaignSummary {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  recipients: number;
  opens: number;
  clicks: number;
  hasAnalysis: boolean;
}

export interface CampaignFull {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  content: string;
  status: string;
  sentAt: string | null;
  analysis: string | null;
  recipients: {
    id: string;
    status: string;
    openCount: number;
    clickCount: number;
    lastOpened: string | null;
    lastClicked: string | null;
    contact: { email: string; firstName: string; lastName: string };
  }[];
}

export interface AiAnalysis {
  provider: string;
  model?: string;
  score: number;
  summary: string;
  strengths: string[];
  issues: string[];
  suggestions: string[];
  subjectIdeas?: string[];
  checkedAt: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  subject: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger: string;
  triggerTag: string;
  delayHours: number;
  subject: string;
  fromName: string;
  fromEmail: string;
  content: string;
  status: string;
  sentCount: number;
  queued?: number;
  createdAt: string;
}

export interface Settings {
  id: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpSecure: boolean;
  doubleOptIn: boolean;
  aiProvider: string;
  openrouterKey: string;
  openaiKey: string;
  publikhqUrl: string;
  publikhqKey: string;
}

export interface Activity {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}
