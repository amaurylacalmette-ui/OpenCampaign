"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Send, MousePointerClick, Eye, Zap, FileText, Sparkles, Plus, Inbox, ListChecks, Upload, ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { StatCard, StatusBadge, SectionHeader, LoadingBlock, EmptyState } from "./shared";
import { api, fmtDateTime, timeAgo, type Activity, type CampaignSummary } from "@/lib/oc-client";

interface Stats {
  totalContacts: number;
  subscribed: number;
  pending: number;
  unsubscribed: number;
  campaignsSent: number;
  drafts: number;
  totalRecipients: number;
  openRate: number;
  clickRate: number;
  totalOpens: number;
  totalClicks: number;
  automationsActive: number;
}

interface DashboardData {
  stats: Stats;
  activity: Activity[];
  recentCampaigns: (Pick<CampaignSummary, "id" | "name" | "subject" | "status" | "sentAt" | "recipients" | "opens" | "clicks">)[];
}

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  account_created: <ListChecks className="size-3.5" />,
  campaign_sent: <Send className="size-3.5" />,
  contact_added: <Users className="size-3.5" />,
  contact_imported: <Inbox className="size-3.5" />,
  contact_unsubscribed: <Users className="size-3.5" />,
  automation_sent: <Zap className="size-3.5" />,
  automation_created: <Zap className="size-3.5" />,
  ai_analysis: <Sparkles className="size-3.5" />,
};

export function Dashboard({ onNavigate, onNewCampaign }: { onNavigate: (v: string) => void; onNewCampaign: () => void }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api<DashboardData>("/api/stats");
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!loading && error && !data) {
    return (
      <div className="space-y-8">
        <SectionHeader
          title="Dashboard"
          body="Your audience and campaigns at a glance."
          actions={
            <Button onClick={onNewCampaign} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              <Plus className="size-4" /> New campaign
            </Button>
          }
        />
        <EmptyState
          icon={<AlertTriangle className="size-5" />}
          title="Couldn't load your dashboard"
          body={error}
          action={
            <Button variant="outline" onClick={() => load()}>
              Try again
            </Button>
          }
        />
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[104px] rounded-xl bg-neutral-100 animate-pulse" />
          ))}
        </div>
        <LoadingBlock rows={4} />
      </div>
    );
  }

  const { stats } = data;
  const brandNew = stats.totalContacts === 0 && stats.campaignsSent === 0 && stats.drafts === 0;

  return (
    <div className="space-y-8">
      <SectionHeader
        title="Dashboard"
        body="Your audience and campaigns at a glance."
        actions={
          <Button onClick={onNewCampaign} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      {brandNew ? (
        <WelcomeChecklist onNavigate={onNavigate} onNewCampaign={onNewCampaign} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Subscribed contacts" value={stats.subscribed.toLocaleString()} sub={`${stats.totalContacts.toLocaleString()} total in audience`} icon={<Users className="size-4" />} />
            <StatCard label="Campaigns sent" value={stats.campaignsSent} sub={stats.drafts ? `${stats.drafts} draft${stats.drafts === 1 ? "" : "s"} waiting` : "No drafts pending"} icon={<Send className="size-4" />} />
            <StatCard label="Average open rate" value={`${stats.openRate}%`} sub={`${stats.totalOpens.toLocaleString()} total opens`} icon={<Eye className="size-4" />} progress={stats.openRate} />
            <StatCard label="Average click rate" value={`${stats.clickRate}%`} sub={`${stats.totalClicks.toLocaleString()} total clicks`} icon={<MousePointerClick className="size-4" />} progress={stats.clickRate} progressClass="bg-amber-400" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2 rounded-xl border-neutral-200 shadow-none">
              <div className="flex items-center justify-between px-5 pt-5 pb-3">
                <h2 className="font-semibold text-neutral-900">Recent campaigns</h2>
                <Button variant="ghost" size="sm" className="text-neutral-500" onClick={() => onNavigate("campaigns")}>
                  View all
                </Button>
              </div>
              {data.recentCampaigns.length === 0 ? (
                <p className="px-5 pb-6 text-sm text-neutral-500">Nothing sent yet — your first campaign is one click away.</p>
              ) : (
                <div className="divide-y divide-neutral-100">
                  {data.recentCampaigns.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => onNavigate("campaigns")}
                      className="w-full text-left px-5 py-3.5 hover:bg-neutral-50 transition-colors flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-neutral-900 truncate">{c.name}</p>
                        <p className="text-xs text-neutral-500 truncate mt-0.5">{c.subject || "No subject yet"}</p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {c.status === "sent" ? (
                          <div className="hidden sm:flex items-center gap-4 text-xs text-neutral-500 tabular-nums">
                            <span><span className="font-semibold text-neutral-800">{c.opens}</span> opens</span>
                            <span><span className="font-semibold text-neutral-800">{c.clicks}</span> clicks</span>
                          </div>
                        ) : null}
                        <StatusBadge status={c.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card className="rounded-xl border-neutral-200 shadow-none">
              <div className="px-5 pt-5 pb-3">
                <h2 className="font-semibold text-neutral-900">Activity</h2>
              </div>
              <div className="px-5 pb-5 space-y-4 max-h-80 overflow-y-auto oc-scroll">
                {data.activity.length === 0 ? (
                  <p className="text-sm text-neutral-500">Activity will show up here.</p>
                ) : (
                  data.activity.map((a) => (
                    <div key={a.id} className="flex gap-3">
                      <div className="shrink-0 size-7 rounded-full bg-neutral-100 text-neutral-500 flex items-center justify-center">
                        {ACTIVITY_ICON[a.type] || <FileText className="size-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] leading-snug text-neutral-800">{a.message}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{timeAgo(a.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <button onClick={() => onNavigate("audience")} className="text-left rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 hover:shadow-sm transition-all">
          <Users className="size-4 text-neutral-400 mb-3" />
          <p className="font-medium text-sm text-neutral-900">Grow your audience</p>
          <p className="text-xs text-neutral-500 mt-1">{stats.totalContacts === 0 ? "Import a CSV or share your signup form to collect subscribers." : `${stats.pending} pending · ${stats.unsubscribed} unsubscribed · import CSV or share your signup form.`}</p>
        </button>
        <button onClick={() => onNavigate("automations")} className="text-left rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 hover:shadow-sm transition-all">
          <Zap className="size-4 text-neutral-400 mb-3" />
          <p className="font-medium text-sm text-neutral-900">Automations running</p>
          <p className="text-xs text-neutral-500 mt-1">{stats.automationsActive > 0 ? `${stats.automationsActive} active. Welcome emails and tag triggers keep working while you sleep.` : "No active automations. Set up a welcome email in a couple of minutes."}</p>
        </button>
        <button onClick={() => onNavigate("campaigns")} className="text-left rounded-xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 hover:shadow-sm transition-all">
          <Sparkles className="size-4 text-neutral-400 mb-3" />
          <p className="font-medium text-sm text-neutral-900">AI review before sending</p>
          <p className="text-xs text-neutral-500 mt-1">Run an analysis on any draft — local engine, OpenRouter, OpenAI or PublikHQ.</p>
        </button>
      </div>
    </div>
  );
}

function WelcomeChecklist({ onNavigate, onNewCampaign }: { onNavigate: (v: string) => void; onNewCampaign: () => void }) {
  const steps = [
    {
      icon: <Upload className="size-4" />,
      title: "Add your first contacts",
      body: "Import a CSV from your old tool, add people manually, or share a signup form.",
      cta: "Go to Audience",
      action: () => onNavigate("audience"),
    },
    {
      icon: <Send className="size-4" />,
      title: "Create a campaign",
      body: "Write it from scratch or start from a template. Save drafts freely — nothing goes out until you say so.",
      cta: "New campaign",
      action: onNewCampaign,
    },
    {
      icon: <Sparkles className="size-4" />,
      title: "Run the AI review",
      body: "Every draft can be scored before sending — subject line, spam signals, links, structure.",
      cta: "Open Campaigns",
      action: () => onNavigate("campaigns"),
    },
  ];

  return (
    <Card className="rounded-xl border-neutral-200 shadow-none overflow-hidden">
      <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-neutral-100 bg-gradient-to-br from-neutral-50 to-white">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-amber-600">Getting started</p>
        <h2 className="text-xl font-semibold tracking-tight text-neutral-900 mt-1.5">Set up your workspace in three steps</h2>
        <p className="text-sm text-neutral-500 mt-1.5 max-w-lg">
          Everything starts empty — your numbers reflect real activity only. Here is the shortest path to your first sent campaign.
        </p>
      </div>
      <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-100">
        {steps.map((s, i) => (
          <div key={s.title} className="p-6 flex flex-col">
            <div className="flex items-center gap-2.5 mb-3">
              <span className="size-8 rounded-lg bg-neutral-900 text-amber-300 flex items-center justify-center">{s.icon}</span>
              <span className="text-xs font-semibold text-neutral-400">STEP {i + 1}</span>
            </div>
            <p className="font-medium text-sm text-neutral-900">{s.title}</p>
            <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed flex-1">{s.body}</p>
            <button onClick={s.action} className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-900 hover:text-neutral-600 transition-colors self-start">
              {s.cta} <ArrowRight className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="px-6 sm:px-8 py-4 bg-neutral-50/70 border-t border-neutral-100 flex items-center gap-2 text-xs text-neutral-500">
        <CheckCircle2 className="size-3.5 text-emerald-500" />
        Sending is in simulation mode until you connect SMTP under Settings — safe to explore.
      </div>
    </Card>
  );
}
