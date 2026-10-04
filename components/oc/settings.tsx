"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Sparkles, Save, Bot, Cpu, Globe, KeyRound } from "lucide-react";
import { SectionHeader, LoadingBlock } from "./shared";
import { api, type Settings as SettingsType } from "@/lib/oc-client";

const PROVIDERS = [
  {
    id: "local",
    name: "Local engine",
    desc: "Built-in heuristics. Analyzes subject lines, spam signals, links, personalization and structure — no key, no data leaves the server.",
    icon: <Cpu className="size-4" />,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    desc: "Uses your OpenRouter key and picks the best free model automatically — you get LLM-quality analysis at zero cost.",
    icon: <Bot className="size-4" />,
  },
  {
    id: "openai",
    name: "OpenAI",
    desc: "Chat Completions with your OpenAI key (gpt-4o-mini by default). Fast, thorough, costs a fraction of a cent per analysis.",
    icon: <Sparkles className="size-4" />,
  },
  {
    id: "publikhq",
    name: "PublikHQ",
    desc: "Routes analysis through a PublikHQ-compatible AI endpoint. Point it at your publikhq.com deployment and add the API key.",
    icon: <Globe className="size-4" />,
  },
];

export function Settings({ settings, onSaved }: { settings: SettingsType | null; onSaved: (s: SettingsType) => void }) {
  const [form, setForm] = useState<SettingsType | null>(settings);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [freeModel, setFreeModel] = useState<string | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  if (!form) return <LoadingBlock rows={4} />;

  const patch = (p: Partial<SettingsType>) => setForm({ ...form, ...p });

  const save = async () => {
    setBusy(true);
    try {
      const d = await api<{ settings: SettingsType }>("/api/settings", { method: "PUT", body: JSON.stringify(form) });
      onSaved(d.settings);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const testProvider = async (provider: string) => {
    setTesting(provider);
    try {
      const d = await api<{ message: string; model?: string }>("/api/settings/test-ai", {
        method: "POST",
        body: JSON.stringify({ provider, openrouterKey: form.openrouterKey, openaiKey: form.openaiKey, publikhqUrl: form.publikhqUrl, publikhqKey: form.publikhqKey }),
      });
      if (provider === "openrouter" && d.model) setFreeModel(d.model);
      toast.success(d.message);
      // persist keys together with the successful test
      await api("/api/settings", { method: "PUT", body: JSON.stringify(form) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(null);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <SectionHeader
        title="Settings"
        body="Sending defaults, delivery and the AI analysis engine."
        actions={
          <Button onClick={save} disabled={busy} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save changes
          </Button>
        }
      />

      {/* Sending defaults */}
      <Card className="rounded-xl border-neutral-200 shadow-none p-5 space-y-4">
        <h3 className="font-semibold text-neutral-900">Sending defaults</h3>
        <p className="text-sm text-neutral-500 -mt-2">Pre-filled for new campaigns and automations.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>From name</Label><Input value={form.fromName} onChange={(e) => patch({ fromName: e.target.value })} placeholder="Ava from Fieldnote" /></div>
          <div className="space-y-1.5"><Label>From email</Label><Input type="email" value={form.fromEmail} onChange={(e) => patch({ fromEmail: e.target.value })} placeholder="you@yourdomain.com" /></div>
          <div className="space-y-1.5"><Label>Reply-to <span className="text-neutral-400 font-normal">(optional)</span></Label><Input type="email" value={form.replyTo} onChange={(e) => patch({ replyTo: e.target.value })} /></div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3.5 py-3">
          <div>
            <p className="text-sm font-medium text-neutral-800">Double opt-in</p>
            <p className="text-xs text-neutral-500">New signups are marked pending until they confirm.</p>
          </div>
          <Switch checked={form.doubleOptIn} onCheckedChange={(v) => patch({ doubleOptIn: v })} />
        </div>
      </Card>

      {/* Delivery */}
      <Card className="rounded-xl border-neutral-200 shadow-none p-5 space-y-4">
        <h3 className="font-semibold text-neutral-900">Delivery (SMTP)</h3>
        <p className="text-sm text-neutral-500 -mt-2">
          Add credentials to send campaigns for real. Without SMTP, sending runs in simulation mode — recipients and tracking are recorded, nothing is delivered.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Host</Label><Input value={form.smtpHost} onChange={(e) => patch({ smtpHost: e.target.value })} placeholder="smtp.yourprovider.com" /></div>
          <div className="space-y-1.5"><Label>Port</Label><Input type="number" value={form.smtpPort} onChange={(e) => patch({ smtpPort: parseInt(e.target.value || "587", 10) })} /></div>
          <div className="space-y-1.5"><Label>Username</Label><Input value={form.smtpUser} onChange={(e) => patch({ smtpUser: e.target.value })} autoComplete="off" /></div>
          <div className="space-y-1.5"><Label>Password</Label><Input type="password" value={form.smtpPass} onChange={(e) => patch({ smtpPass: e.target.value })} autoComplete="new-password" /></div>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3.5 py-3">
          <div>
            <p className="text-sm font-medium text-neutral-800">Use TLS/SSL (port 465)</p>
            <p className="text-xs text-neutral-500">Leave off for STARTTLS on port 587.</p>
          </div>
          <Switch checked={form.smtpSecure} onCheckedChange={(v) => patch({ smtpSecure: v })} />
        </div>
      </Card>

      {/* AI analysis */}
      <Card className="rounded-xl border-neutral-200 shadow-none p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-neutral-900">AI analysis</h3>
          <p className="text-sm text-neutral-500 mt-1">Pick the engine behind the &ldquo;AI review&rdquo; tab on every campaign. All providers return the same score-and-suggestions report.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => patch({ aiProvider: p.id })}
              className={`text-left rounded-xl border p-4 transition-all ${
                form.aiProvider === p.id ? "border-neutral-900 ring-1 ring-neutral-900 bg-neutral-50" : "border-neutral-200 hover:border-neutral-300 bg-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-sm text-neutral-900">{p.icon} {p.name}</span>
                <span className={`size-3.5 rounded-full border-2 ${form.aiProvider === p.id ? "border-neutral-900 bg-neutral-900" : "border-neutral-300"}`}>
                  {form.aiProvider === p.id ? <span className="block size-full rounded-full bg-white scale-50" /> : null}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{p.desc}</p>
            </button>
          ))}
        </div>

        {form.aiProvider === "openrouter" ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5" /> OpenRouter API key</Label>
            <div className="flex gap-2">
              <Input type="password" value={form.openrouterKey} onChange={(e) => patch({ openrouterKey: e.target.value })} placeholder="sk-or-v1-…" autoComplete="off" />
              <Button variant="outline" className="shrink-0" disabled={testing !== null || !form.openrouterKey} onClick={() => testProvider("openrouter")}>
                {testing === "openrouter" ? <Loader2 className="size-4 animate-spin" /> : null} Test
              </Button>
            </div>
            {freeModel ? <p className="text-xs text-emerald-700">Auto-selected free model: <span className="font-mono">{freeModel}</span></p> : null}
            <p className="text-xs text-neutral-400">The model list is fetched live and a free one is chosen automatically — refreshes hourly. Get a key at openrouter.ai/keys.</p>
          </div>
        ) : null}

        {form.aiProvider === "openai" ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5" /> OpenAI API key</Label>
            <div className="flex gap-2">
              <Input type="password" value={form.openaiKey} onChange={(e) => patch({ openaiKey: e.target.value })} placeholder="sk-…" autoComplete="off" />
              <Button variant="outline" className="shrink-0" disabled={testing !== null || !form.openaiKey} onClick={() => testProvider("openai")}>
                {testing === "openai" ? <Loader2 className="size-4 animate-spin" /> : null} Test
              </Button>
            </div>
          </div>
        ) : null}

        {form.aiProvider === "publikhq" ? (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><KeyRound className="size-3.5" /> PublikHQ endpoint &amp; key</Label>
            <div className="flex gap-2">
              <Input value={form.publikhqUrl} onChange={(e) => patch({ publikhqUrl: e.target.value })} placeholder="https://publikhq.com" />
              <Input type="password" value={form.publikhqKey} onChange={(e) => patch({ publikhqKey: e.target.value })} placeholder="API key" autoComplete="off" />
              <Button variant="outline" className="shrink-0" disabled={testing !== null} onClick={() => testProvider("publikhq")}>
                {testing === "publikhq" ? <Loader2 className="size-4 animate-spin" /> : null} Test
              </Button>
            </div>
            <p className="text-xs text-neutral-400">
              Calls <span className="font-mono">{(form.publikhqUrl || "https://publikhq.com").replace(/\/+$/, "")}/api/v1/ai/analyze</span>. When you deploy OpenCampaign on publikhq.com, point this at your own domain and it becomes fully self-hosted AI.
            </p>
          </div>
        ) : null}

        {form.aiProvider === "local" ? (
          <p className="text-xs text-neutral-500 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            The local engine runs entirely in this app. It checks subject length, spam trigger words, caps and punctuation, image-to-text balance, link count, CTA verbs, personalization and unsubscribe compliance — then scores the campaign out of 100 with concrete fixes. Nothing leaves your server.
          </p>
        ) : null}
      </Card>
    </div>
  );
}
