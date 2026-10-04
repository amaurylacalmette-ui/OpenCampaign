"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { BarChart3, Eye, MousePointerClick, Users } from "lucide-react";
import { EmptyState, SectionHeader, LoadingBlock } from "./shared";
import { api, fmtDateTime } from "@/lib/oc-client";

interface PerCampaign {
  id: string;
  name: string;
  subject: string;
  sentAt: string | null;
  recipients: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
  totalOpens: number;
  totalClicks: number;
}

interface ReportsData {
  perCampaign: PerCampaign[];
  timeline: { date: string; opens: number; clicks: number }[];
  totals: { recipients: number; opens: number; clicks: number; openRate: number; clickRate: number };
}

export function Reports() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await api<ReportsData>("/api/reports");
      setData(d);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingBlock rows={5} />;
  if (!data || data.perCampaign.length === 0) {
    return (
      <div>
        <SectionHeader title="Reports" body="Opens, clicks and engagement per campaign." />
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title="No sent campaigns yet"
          body="Once you send your first campaign, opens and clicks will show up here."
        />
      </div>
    );
  }

  const maxTimeline = Math.max(1, ...data.timeline.map((d) => Math.max(d.opens, d.clicks)));

  return (
    <div className="max-w-5xl space-y-8">
      <SectionHeader title="Reports" body="Engagement across everything you've sent." />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Emails delivered", value: data.totals.recipients.toLocaleString(), icon: <Users className="size-4" /> },
          { label: "Open rate", value: `${data.totals.openRate}%`, icon: <Eye className="size-4" /> },
          { label: "Click rate", value: `${data.totals.clickRate}%`, icon: <MousePointerClick className="size-4" /> },
          { label: "Campaigns sent", value: data.perCampaign.length, icon: <BarChart3 className="size-4" /> },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl border-neutral-200 shadow-none p-5">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-medium text-neutral-500">{s.label}</p>
              <span className="text-neutral-300">{s.icon}</span>
            </div>
            <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-neutral-200 shadow-none p-5">
        <h3 className="font-semibold text-neutral-900">Opens &amp; clicks — last 30 days</h3>
        <p className="text-xs text-neutral-400 mt-0.5 mb-4">Unique contacts per day.</p>
        <div className="flex items-end gap-[3px] h-36">
          {data.timeline.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col justify-end items-center gap-px group relative" title={`${d.date}: ${d.opens} opens, ${d.clicks} clicks`}>
              <div className="w-full bg-neutral-900 rounded-t-sm min-h-[2px]" style={{ height: `${(d.opens / maxTimeline) * 100}%` }} />
              <div className="w-full bg-amber-400 rounded-t-sm min-h-[2px]" style={{ height: `${(d.clicks / maxTimeline) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-5 mt-3 text-xs text-neutral-500">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-neutral-900" /> Opens</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-400" /> Clicks</span>
        </div>
      </Card>

      <Card className="rounded-xl border-neutral-200 shadow-none overflow-hidden">
        <div className="px-5 pt-5 pb-1">
          <h3 className="font-semibold text-neutral-900">By campaign</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-neutral-400 border-b border-neutral-100">
                <th className="font-medium px-5 py-3">Campaign</th>
                <th className="font-medium px-5 py-3">Sent</th>
                <th className="font-medium px-5 py-3 text-right">Recipients</th>
                <th className="font-medium px-5 py-3 text-right">Open rate</th>
                <th className="font-medium px-5 py-3 text-right">Click rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {data.perCampaign.map((c) => (
                <tr key={c.id} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-neutral-900">{c.name}</p>
                    <p className="text-xs text-neutral-400">{c.subject}</p>
                  </td>
                  <td className="px-5 py-3.5 text-neutral-500 text-xs">{fmtDateTime(c.sentAt)}</td>
                  <td className="px-5 py-3.5 text-right tabular-nums text-neutral-700">{c.recipients}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-14 rounded-full bg-neutral-100 overflow-hidden inline-block">
                        <span className="block h-full bg-neutral-900 rounded-full" style={{ width: `${Math.min(100, c.openRate)}%` }} />
                      </span>
                      <span className="tabular-nums text-neutral-700">{c.openRate}%</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-14 rounded-full bg-neutral-100 overflow-hidden inline-block">
                        <span className="block h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, c.clickRate)}%` }} />
                      </span>
                      <span className="tabular-nums text-neutral-700">{c.clickRate}%</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
