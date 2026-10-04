"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Plus, Send, Sparkles, Trash2, Eye, FlaskConical, Loader2, Mail, ChevronLeft,
  Copy, FileText, ThumbsUp, AlertTriangle, Lightbulb, CheckCircle2, XCircle, PenLine,
} from "lucide-react";
import { StatusBadge, EmptyState, SectionHeader, LoadingBlock, ScoreRing, AiProviderChip } from "./shared";
import { api, fmtDateTime, type CampaignSummary, type CampaignFull, type AiAnalysis, type Template } from "@/lib/oc-client";

const PERSONALIZATION = ["{{first_name}}", "{{last_name}}", "{{email}}", "{{company}}", "{{unsubscribe}}"];

export function Campaigns({ refreshKey, openNew, presetTemplateId, onNewDialogClosed }: { refreshKey: number; openNew: boolean; presetTemplateId?: string; onNewDialogClosed?: () => void }) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(openNew);

  const handleNewDialogChange = (v: boolean) => {
    setShowNew(v);
    if (!v && onNewDialogClosed) onNewDialogClosed();
  };

  const load = useCallback(async () => {
    try {
      const d = await api<{ campaigns: CampaignSummary[] }>("/api/campaigns");
      setCampaigns(d.campaigns);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const createCampaign = async (name: string, templateId?: string) => {
    try {
      let content = "";
      let subject = "";
      if (templateId) {
        const t = await api<{ template: Template }>(`/api/templates/${templateId}`);
        content = t.template.content;
        subject = t.template.subject || "";
      }
      const d = await api<{ campaign: { id: string } }>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify({ name, content, subject }),
      });
      toast.success("Draft created");
      handleNewDialogChange(false);
      setSelectedId(d.campaign.id);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create campaign");
    }
  };

  if (loading) return <LoadingBlock rows={5} />;

  if (selectedId) {
    return <CampaignDetail id={selectedId} onBack={() => { setSelectedId(null); load(); }} />;
  }

  return (
    <div>
      <SectionHeader
        title="Campaigns"
        body="Draft, review and send email campaigns."
        actions={
          <Button onClick={() => handleNewDialogChange(true)} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            <Plus className="size-4" /> New campaign
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<Mail className="size-5" />}
          title="No campaigns yet"
          body="Create your first campaign — start from scratch or pick a template."
          action={<Button onClick={() => handleNewDialogChange(true)} className="bg-neutral-900 hover:bg-neutral-800 text-white">Create campaign</Button>}
        />
      ) : (
        <div className="space-y-3">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="rounded-xl border-neutral-200 shadow-none p-4 hover:border-neutral-300 transition-colors cursor-pointer"
              onClick={() => setSelectedId(c.id)}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <p className="font-medium text-neutral-900 truncate">{c.name}</p>
                    <StatusBadge status={c.status} />
                    {c.hasAnalysis ? <span className="text-[11px] text-neutral-400 flex items-center gap-1"><Sparkles className="size-3" /> analyzed</span> : null}
                  </div>
                  <p className="text-sm text-neutral-500 truncate mt-0.5">{c.subject || "No subject yet"}</p>
                </div>
                <div className="flex items-center gap-6 text-sm text-neutral-500 tabular-nums shrink-0">
                  {c.status === "sent" ? (
                    <>
                      <span className="text-center"><span className="block font-semibold text-neutral-900">{c.recipients}</span><span className="text-xs">recipients</span></span>
                      <span className="text-center"><span className="block font-semibold text-neutral-900">{c.recipients ? Math.round((c.opens / c.recipients) * 100) : 0}%</span><span className="text-xs">opens</span></span>
                      <span className="text-center"><span className="block font-semibold text-neutral-900">{c.recipients ? Math.round((c.clicks / c.recipients) * 100) : 0}%</span><span className="text-xs">clicks</span></span>
                    </>
                  ) : (
                    <span className="text-xs">created {fmtDateTime(c.createdAt)}</span>
                  )}
                  <ChevronLeft className="size-4 rotate-180 text-neutral-300" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewCampaignDialog open={showNew} onOpenChange={handleNewDialogChange} onCreate={createCampaign} defaultTemplateId={presetTemplateId} />
    </div>
  );
}

function NewCampaignDialog({ open, onOpenChange, onCreate, defaultTemplateId }: { open: boolean; onOpenChange: (v: boolean) => void; onCreate: (name: string, templateId?: string) => void; defaultTemplateId?: string }) {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api<{ templates: Template[] }>("/api/templates").then((d) => setTemplates(d.templates)).catch(() => {});
    }, 0);
    return () => clearTimeout(t);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>Name it now, edit content next. You can start from a template.</DialogDescription>
        </DialogHeader>
        <DialogBody templates={templates} defaultTemplateId={defaultTemplateId} onOpenChange={onOpenChange} onCreate={onCreate} />
      </DialogContent>
      ) : null}
    </Dialog>
  );
}

function DialogBody({ templates, defaultTemplateId, onOpenChange, onCreate }: { templates: Template[]; defaultTemplateId?: string; onOpenChange: (v: boolean) => void; onCreate: (name: string, templateId?: string) => void }) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<string>(defaultTemplateId || "none");
  const [busy, setBusy] = useState(false);

  return (
    <>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="camp-name">Campaign name</Label>
          <Input id="camp-name" placeholder="e.g. October newsletter" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          <Label>Start from</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Blank canvas</SelectItem>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          disabled={!name.trim() || busy}
          className="bg-neutral-900 hover:bg-neutral-800 text-white"
          onClick={async () => { setBusy(true); await onCreate(name.trim(), templateId === "none" ? undefined : templateId); setBusy(false); }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} Create draft
        </Button>
      </DialogFooter>
    </>
  );
}

function CampaignDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const [campaign, setCampaign] = useState<CampaignFull | null>(null);
  const [tab, setTab] = useState<"edit" | "review" | "report">("edit");
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const d = await api<{ campaign: CampaignFull }>(`/api/campaigns/${id}`);
    setCampaign(d.campaign);
    if (d.campaign.analysis) {
      try { setAnalysis(JSON.parse(d.campaign.analysis)); } catch { /* ignore */ }
    }
  }, [id]);

  useEffect(() => {
    load().catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load campaign"));
  }, [load]);

  const save = async (patch: Partial<CampaignFull>) => {
    setSaving(true);
    try {
      const d = await api<{ campaign: CampaignFull }>(`/api/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setCampaign((prev) => (prev ? { ...prev, ...d.campaign } : d.campaign));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // optimistic edit: update local state immediately, debounce the API write
  const pendingPatch = useRef<Partial<CampaignFull>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edit = useCallback(
    (patch: Partial<CampaignFull>) => {
      setCampaign((prev) => (prev ? { ...prev, ...patch } : prev));
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        const body = pendingPatch.current;
        pendingPatch.current = {};
        try {
          const d = await api<{ campaign: CampaignFull }>(`/api/campaigns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
          setCampaign((prev) => (prev ? { ...prev, ...d.campaign } : d.campaign));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Save failed");
        } finally {
          setSaving(false);
        }
      }, 700);
    },
    [id]
  );

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const d = await api<{ analysis: AiAnalysis }>(`/api/campaigns/${id}/analyze`, { method: "POST", body: JSON.stringify({}) });
      setAnalysis(d.analysis);
      toast.success(`Analysis complete — score ${d.analysis.score}/100 (${d.analysis.provider})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const deleteCampaign = async () => {
    if (!confirm("Delete this campaign? This can't be undone.")) return;
    await api(`/api/campaigns/${id}`, { method: "DELETE" });
    toast.success("Campaign deleted");
    onBack();
  };

  if (!campaign) {
    return <LoadingBlock rows={4} />;
  }

  const isSent = campaign.status === "sent";

  return (
    <div>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="-ml-2 text-neutral-500 mb-2" onClick={onBack}>
          <ChevronLeft className="size-4" /> All campaigns
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-neutral-900">{campaign.name}</h1>
              <StatusBadge status={campaign.status} />
            </div>
            {isSent ? <p className="text-sm text-neutral-500 mt-0.5">Sent {fmtDateTime(campaign.sentAt)} · {campaign.recipients.length} recipients</p> : <p className="text-sm text-neutral-500 mt-0.5">{saving ? "Saving…" : "All changes save automatically"}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!isSent ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowTest(true)}><FlaskConical className="size-4" /> Test</Button>
                <Button size="sm" className="bg-neutral-900 hover:bg-neutral-800 text-white" onClick={() => setShowSend(true)}>
                  <Send className="size-4" /> Send
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setShowTest(true)}><FlaskConical className="size-4" /> View as email</Button>
            )}
            {!isSent && campaign.recipients.length === 0 ? (
              <Button variant="ghost" size="icon" className="text-neutral-400 hover:text-red-600" onClick={deleteCampaign}><Trash2 className="size-4" /></Button>
            ) : null}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="bg-neutral-100 rounded-lg p-1">
          <TabsTrigger value="edit" className="rounded-md data-[state=active]:bg-white"><PenLine className="size-3.5 mr-1.5" />Content</TabsTrigger>
          <TabsTrigger value="review" className="rounded-md data-[state=active]:bg-white"><Sparkles className="size-3.5 mr-1.5" />AI review</TabsTrigger>
          <TabsTrigger value="report" className="rounded-md data-[state=active]:bg-white" disabled={!isSent}><Eye className="size-3.5 mr-1.5" />Report</TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-5">
          <CampaignEditor campaign={campaign} onEdit={edit} />
        </TabsContent>
        <TabsContent value="review" className="mt-5">
          <AiReview
            campaign={campaign}
            analysis={analysis}
            analyzing={analyzing}
            onAnalyze={runAnalysis}
            onApplySubject={(s) => edit({ subject: s })}
          />
        </TabsContent>
        <TabsContent value="report" className="mt-5">
          <CampaignReport campaign={campaign} />
        </TabsContent>
      </Tabs>

      <SendDialog open={showSend} onOpenChange={setShowSend} campaign={campaign} onSent={() => load()} />
      <TestDialog open={showTest} onOpenChange={setShowTest} campaignId={id} />
    </div>
  );
}

function CampaignEditor({ campaign, onEdit }: { campaign: CampaignFull; onEdit: (patch: Partial<CampaignFull>) => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-5">
        <Card className="rounded-xl border-neutral-200 shadow-none p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ed-subject">Subject</Label>
              <Input id="ed-subject" value={campaign.subject} placeholder="Your subject line" onChange={(e) => onEdit({ subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-preview">Preview text <span className="text-neutral-400 font-normal">(optional)</span></Label>
              <Input id="ed-preview" value={campaign.previewText} placeholder="Shown after the subject in the inbox" onChange={(e) => onEdit({ previewText: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-fromname">From name</Label>
              <Input id="ed-fromname" value={campaign.fromName} placeholder="Ava from Fieldnote" onChange={(e) => onEdit({ fromName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed-fromemail">From email</Label>
              <Input id="ed-fromemail" type="email" value={campaign.fromEmail} placeholder="you@yourdomain.com" onChange={(e) => onEdit({ fromEmail: e.target.value })} />
            </div>
          </div>
        </Card>

        <Card className="rounded-xl border-neutral-200 shadow-none p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <Label htmlFor="content-editor">Content (HTML)</Label>
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-xs text-neutral-400 mr-1">Insert:</span>
              {PERSONALIZATION.map((t) => (
                <button key={t} onClick={() => onEdit({ content: insertAtCursor(t) })} className="text-[11px] font-mono bg-neutral-100 hover:bg-amber-100 border border-neutral-200 rounded px-1.5 py-0.5 text-neutral-600 transition-colors">
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            id="content-editor"
            value={campaign.content}
            onChange={(e) => onEdit({ content: e.target.value })}
            placeholder="<h1>Hey {{first_name}},</h1><p>Write your email as HTML.</p>"
            className="font-mono text-[13px] min-h-[320px] resize-y bg-neutral-50 border-neutral-200 focus-visible:ring-neutral-400"
          />
          <p className="text-xs text-neutral-400 mt-2">Personalization tokens work per recipient. An unsubscribe footer is appended automatically if you don&apos;t add one.</p>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-sm font-medium text-neutral-700 flex items-center gap-1.5"><Eye className="size-4 text-neutral-400" /> Live preview</p>
          <span className="text-xs text-neutral-400">with sample data</span>
        </div>
        <div className="rounded-xl border border-neutral-200 overflow-hidden bg-white shadow-sm">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50/70">
            <p className="text-[13px] font-medium text-neutral-900 truncate">{campaign.subject || <span className="text-neutral-400">Your subject line</span>}</p>
            <p className="text-xs text-neutral-500 truncate mt-0.5">{campaign.fromName || "From name"} <span className="text-neutral-300">·</span> preview text shows here</p>
          </div>
          <iframe
            title="Email preview"
            className="w-full h-[480px] bg-white"
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#222;background:#fff} img{max-width:100%}</style></head><body>${campaign.content
              .replace(/\{\{\s*first_name\s*\}\}/gi, "Alex")
              .replace(/\{\{\s*last_name\s*\}\}/gi, "River")
              .replace(/\{\{\s*email\s*\}\}/gi, "alex@example.com")
              .replace(/\{\{\s*company\s*\}\}/gi, "Acme Inc")
              .replace(/\{\{\s*unsubscribe\s*\}\}/gi, "#")}</body></html>`}
            sandbox=""
          />
        </div>
      </div>
    </div>
  );
}

function insertAtCursor(token: string): string {
  const el = document.getElementById("content-editor") as HTMLTextAreaElement | null;
  if (!el) return token;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const next = el.value.slice(0, start) + token + el.value.slice(end);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + token.length, start + token.length);
  });
  return next;
}

function AiReview({
  campaign,
  analysis,
  analyzing,
  onAnalyze,
  onApplySubject,
}: {
  campaign: CampaignFull;
  analysis: AiAnalysis | null;
  analyzing: boolean;
  onAnalyze: () => void;
  onApplySubject: (s: string) => void;
}) {
  const isEmpty = !campaign.subject.trim() && !campaign.content.replace(/<[^>]+>/g, "").trim();

  return (
    <div className="max-w-3xl">
      <Card className="rounded-xl border-neutral-200 shadow-none p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {analysis ? <ScoreRing score={analysis.score} /> : (
              <div className="size-[92px] rounded-full border-[8px] border-neutral-100 flex items-center justify-center">
                <Sparkles className="size-6 text-neutral-300" />
              </div>
            )}
            <div>
              <h2 className="font-semibold text-neutral-900">AI review</h2>
              <p className="text-sm text-neutral-500 mt-0.5 max-w-sm">
                A pre-send check of your subject, copy, links and deliverability signals.
              </p>
              {analysis ? <div className="mt-2"><AiProviderChip provider={analysis.provider} model={analysis.model} /></div> : null}
            </div>
          </div>
          <Button
            onClick={onAnalyze}
            disabled={analyzing || isEmpty}
            className="bg-amber-300 hover:bg-amber-400 text-neutral-900 font-medium"
          >
            {analyzing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {analyzing ? "Analyzing…" : analysis ? "Re-analyze" : "Analyze campaign"}
          </Button>
        </div>
        {isEmpty ? <p className="text-sm text-neutral-400 mt-4">Write a subject and some content first — then run the analysis.</p> : null}
      </Card>

      {analysis ? (
        <div className="mt-5 space-y-5">
          <Card className="rounded-xl border-neutral-200 shadow-none p-5">
            <p className="text-[15px] leading-relaxed text-neutral-800">{analysis.summary}</p>
            <p className="text-xs text-neutral-400 mt-3">Checked {fmtDateTime(analysis.checkedAt)}</p>
          </Card>

          {analysis.strengths.length ? (
            <AnalysisList icon={<ThumbsUp className="size-4 text-emerald-600" />} title="What works" items={analysis.strengths} />
          ) : null}
          {analysis.issues.length ? (
            <AnalysisList icon={<AlertTriangle className="size-4 text-amber-600" />} title="Fix before sending" items={analysis.issues} />
          ) : null}
          {analysis.suggestions.length ? (
            <AnalysisList icon={<Lightbulb className="size-4 text-amber-500" />} title="Suggestions" items={analysis.suggestions} />
          ) : null}
          {analysis.subjectIdeas?.length ? (
            <Card className="rounded-xl border-neutral-200 shadow-none p-5">
              <p className="text-sm font-medium text-neutral-900 mb-3 flex items-center gap-2"><Sparkles className="size-4 text-amber-400" /> Subject line ideas</p>
              <div className="space-y-2">
                {analysis.subjectIdeas.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 px-3.5 py-2.5">
                    <span className="text-sm text-neutral-800 truncate">{s}</span>
                    <Button variant="ghost" size="sm" className="shrink-0 text-neutral-500" onClick={() => onApplySubject(s)}>
                      Use
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function AnalysisList({ icon, title, items }: { icon: React.ReactNode; title: string; items: string[] }) {
  return (
    <Card className="rounded-xl border-neutral-200 shadow-none p-5">
      <p className="text-sm font-medium text-neutral-900 mb-3 flex items-center gap-2">{icon} {title}</p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-neutral-600 leading-relaxed flex gap-2">
            <span className="mt-[7px] size-1 rounded-full bg-neutral-300 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function CampaignReport({ campaign }: { campaign: CampaignFull }) {
  const rs = campaign.recipients;
  const delivered = rs.filter((r) => r.status !== "bounced").length;
  const bounced = rs.filter((r) => r.status === "bounced").length;
  const opens = rs.filter((r) => r.openCount > 0);
  const clicks = rs.filter((r) => r.clickCount > 0);
  const pct = (n: number) => (rs.length ? Math.round((n / rs.length) * 1000) / 10 : 0);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Recipients", value: rs.length, sub: `${delivered} delivered · ${bounced} bounced` },
          { label: "Unique opens", value: `${pct(opens.length)}%`, sub: `${opens.length} contacts · ${rs.reduce((n, r) => n + r.openCount, 0)} total opens` },
          { label: "Unique clicks", value: `${pct(clicks.length)}%`, sub: `${clicks.length} contacts · ${rs.reduce((n, r) => n + r.clickCount, 0)} total clicks` },
          { label: "Unopened", value: `${pct(rs.length - opens.length)}%`, sub: "worth a subject-line test" },
        ].map((s) => (
          <Card key={s.label} className="rounded-xl border-neutral-200 shadow-none p-5">
            <p className="text-[13px] font-medium text-neutral-500">{s.label}</p>
            <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{s.value}</p>
            <p className="text-xs text-neutral-400 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl border-neutral-200 shadow-none">
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-semibold text-neutral-900">Recipients</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Open and click tracking is per contact.</p>
        </div>
        <ScrollArea className="h-96">
          <div className="px-5 pb-5 divide-y divide-neutral-100">
            {rs.length === 0 ? <p className="text-sm text-neutral-500 py-4">No recipients recorded.</p> : rs.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-800 truncate">{r.contact.firstName ? `${r.contact.firstName} ${r.contact.lastName}` : r.contact.email}</p>
                  <p className="text-xs text-neutral-400 truncate">{r.contact.email}</p>
                </div>
                <div className="flex items-center gap-5 text-xs shrink-0">
                  <span className="flex items-center gap-1.5 text-neutral-600 tabular-nums">
                    {r.openCount > 0 ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-neutral-300" />}
                    {r.openCount} open{r.openCount === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1.5 text-neutral-600 tabular-nums">
                    {r.clickCount > 0 ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <XCircle className="size-3.5 text-neutral-300" />}
                    {r.clickCount} click{r.clickCount === 1 ? "" : "s"}
                  </span>
                  {r.status === "bounced" ? <StatusBadge status="bounced" /> : null}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>
    </div>
  );
}

function SendDialog({ open, onOpenChange, campaign, onSent }: { open: boolean; onOpenChange: (v: boolean) => void; campaign: CampaignFull; onSent: () => void }) {
  const [audience, setAudience] = useState<number | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const [smtpOn, setSmtpOn] = useState<boolean | null>(null);
  const [simulate, setSimulate] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; mode: string; errors: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setConfirmSend(false);
      api<{ stats: { subscribed: number } }>("/api/stats").then((d) => setAudience(d.stats.subscribed)).catch(() => setAudience(0));
      api<{ settings: { smtpHost: string } }>("/api/settings").then((d) => {
        setSmtpOn(Boolean(d.settings.smtpHost));
        setSimulate(!d.settings.smtpHost);
      }).catch(() => { setSmtpOn(false); setSimulate(true); });
    }
  }, [open]);

  const send = async () => {
    setSending(true);
    try {
      const d = await api<{ sent: number; failed: number; mode: string; errors: string[] }>(`/api/campaigns/${campaign.id}/send`, {
        method: "POST",
        body: JSON.stringify({ simulate }),
      });
      setResult(d);
      onSent();
      if (d.mode === "simulated") {
        toast.success(`Simulated send to ${d.sent} contacts`);
      } else {
        toast.success(`Sent to ${d.sent} contacts${d.failed ? `, ${d.failed} failed` : ""}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send &ldquo;{campaign.name}&rdquo;</DialogTitle>
          <DialogDescription>Final check before it goes out.</DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-2 space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-emerald-800">
                  {result.mode === "simulated" ? "Simulation complete" : "Campaign sent"}
                </p>
                <p className="text-emerald-700">{result.sent} recipients{result.failed ? ` · ${result.failed} failed` : ""}. Tracking is live on the links and pixels.</p>
              </div>
            </div>
            {result.mode === "simulated" ? (
              <p className="text-xs text-neutral-500">Simulation mode records recipients and enables tracking without delivering email. Configure SMTP under Settings to send for real.</p>
            ) : null}
            {result.errors.length ? <p className="text-xs text-red-600">{result.errors.join(" · ")}</p> : null}
          </div>
        ) : (
          <div className="py-2 space-y-4">
            <div className="rounded-lg border border-neutral-200 divide-y divide-neutral-100 text-sm">
              <div className="flex justify-between px-4 py-2.5"><span className="text-neutral-500">Subject</span><span className="font-medium truncate max-w-[240px]">{campaign.subject || <span className="text-red-500">missing</span>}</span></div>
              <div className="flex justify-between px-4 py-2.5"><span className="text-neutral-500">Recipients</span><span className="font-medium">{audience === null ? "…" : `${audience} subscribed contacts`}</span></div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-neutral-500">Delivery</span>
                {smtpOn === null ? <span className="text-neutral-400">…</span> : (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className={simulate ? "text-neutral-500" : "font-medium text-emerald-700"}>Live SMTP</span>
                    <Switch checked={!simulate} onCheckedChange={(v) => setSimulate(!v)} disabled={!smtpOn} />
                    <span className={simulate ? "font-medium" : "text-neutral-500"}>Simulation</span>
                  </label>
                )}
              </div>
            </div>
            {smtpOn === false ? (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">No SMTP configured — sending runs in simulation mode. Add SMTP credentials in Settings to deliver for real.</p>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
              <input type="checkbox" checked={confirmSend} onChange={(e) => setConfirmSend(e.target.checked)} className="accent-neutral-900" />
              I&apos;ve reviewed the content and I&apos;m ready to send
            </label>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button onClick={() => onOpenChange(false)} className="bg-neutral-900 hover:bg-neutral-800 text-white">Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button disabled={!confirmSend || sending || !campaign.subject.trim()} onClick={send} className="bg-neutral-900 hover:bg-neutral-800 text-white">
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {simulate ? "Run send" : "Send now"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TestDialog({ open, onOpenChange, campaignId }: { open: boolean; onOpenChange: (v: boolean) => void; campaignId: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  useEffect(() => {
    if (open) { setEmail(""); setPreviewHtml(null); }
  }, [open]);

  const sendTest = async () => {
    setBusy(true);
    try {
      const d = await api<{ mode: string; message: string; preview?: string }>(`/api/campaigns/${campaignId}/test`, {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      if (d.preview) {
        setPreviewHtml(d.preview);
        toast.info("SMTP not configured — showing the email that would be delivered.");
      } else {
        toast.success(d.message);
        onOpenChange(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send a test</DialogTitle>
          <DialogDescription>Delivers the exact email — personalization, tracking and unsubscribe included — using sample contact data.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 py-2">
          <Input type="email" placeholder="you@yourdomain.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={sendTest} disabled={!email.includes("@") || busy} className="bg-neutral-900 hover:bg-neutral-800 text-white shrink-0">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />} Send test
          </Button>
        </div>
        {previewHtml ? (
          <iframe title="Test preview" srcDoc={previewHtml} className="w-full h-96 rounded-lg border border-neutral-200" sandbox="" />
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => { navigator.clipboard.writeText(window.location.origin + `/api/campaigns/${campaignId}`); toast.success("Campaign API path copied"); }}>
            <Copy className="size-4" /> Copy API path
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
