"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCard({
  label,
  value,
  sub,
  icon,
  progress,
  progressClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  /** optional 0-100 value rendered as a slim bar under the number */
  progress?: number;
  progressClass?: string;
}) {
  return (
    <Card className="p-5 flex items-start justify-between gap-3 rounded-xl border-neutral-200 shadow-none">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-neutral-500">{label}</p>
        <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{value}</p>
        {typeof progress === "number" ? (
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full bg-neutral-900 transition-all", progressClass)}
              style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            />
          </div>
        ) : null}
        {sub ? <p className="text-xs text-neutral-400 mt-1.5 truncate">{sub}</p> : null}
      </div>
      {icon ? (
        <div className="shrink-0 size-9 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-700">
          {icon}
        </div>
      ) : null}
    </Card>
  );
}

const BADGE_STYLES: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700 border-emerald-200",
  subscribed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  draft: "bg-neutral-100 text-neutral-600 border-neutral-200",
  paused: "bg-amber-50 text-amber-700 border-amber-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-amber-50 text-amber-700 border-amber-200",
  unsubscribed: "bg-neutral-100 text-neutral-500 border-neutral-200",
  cleaned: "bg-red-50 text-red-600 border-red-200",
  bounced: "bg-red-50 text-red-600 border-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        BADGE_STYLES[status] || "bg-neutral-100 text-neutral-600 border-neutral-200"
      )}
    >
      {status}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 px-6 py-14 text-center">
      <div className="size-11 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-500 mb-4 shadow-sm">
        {icon}
      </div>
      <h3 className="font-semibold text-neutral-900">{title}</h3>
      <p className="mt-1 text-sm text-neutral-500 max-w-sm">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ScoreRing({ score, size = 92 }: { score: number; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 80 ? "#059669" : score >= 55 ? "#d97706" : "#dc2626";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eeeeec" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * filled} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold tabular-nums">{score}</span>
        <span className="text-[10px] uppercase tracking-wide text-neutral-400">score</span>
      </div>
    </div>
  );
}

export function SectionHeader({ title, body, actions }: { title: string; body?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h1>
        {body ? <p className="text-sm text-neutral-500 mt-0.5">{body}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function AiProviderChip({ provider, model }: { provider: string; model?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600 max-w-full">
      <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
      <span className="capitalize font-medium">{provider}</span>
      {model ? <span className="text-neutral-400 truncate">{model}</span> : null}
    </span>
  );
}
