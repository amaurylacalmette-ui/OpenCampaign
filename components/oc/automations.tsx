"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Zap, Pencil, Pause, Play } from "lucide-react";
import { StatusBadge, EmptyState, SectionHeader, LoadingBlock } from "./shared";
import { api, fmtDate, type Automation } from "@/lib/oc-client";

export function Automations({ refreshKey }: { refreshKey: number }) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Automation | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ automations: Automation[] }>("/api/automations");
      setAutomations(d.automations);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const toggle = async (a: Automation) => {
    await api(`/api/automations/${a.id}`, { method: "PATCH", body: JSON.stringify({ status: a.status === "active" ? "paused" : "active" }) });
    toast.success(a.status === "active" ? "Automation paused" : "Automation active");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this automation? Queued jobs will be dropped.")) return;
    await api(`/api/automations/${id}`, { method: "DELETE" });
    toast.success("Automation deleted");
    load();
  };

  return (
    <div>
      <SectionHeader
        title="Automations"
        body="Emails that send themselves when contacts join or get tagged."
        actions={
          <Button onClick={() => setEditing("new")} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            <Plus className="size-4" /> New automation
          </Button>
        }
      />

      <Card className="rounded-xl border-amber-200 bg-amber-50/60 shadow-none p-4 mb-6 flex gap-3 items-start">
        <Zap className="size-4 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-900">
          Jobs are processed when the app is open (a background heartbeat every 60 s) or by any external scheduler hitting
          <code className="mx-1 rounded bg-amber-100 px-1.5 py-0.5 text-[12px]">POST /api/automations/process</code>
          — a cron call keeps things moving even when nobody is logged in.
        </p>
      </Card>

      {loading ? (
        <LoadingBlock rows={3} />
      ) : automations.length === 0 ? (
        <EmptyState
          icon={<Zap className="size-5" />}
          title="No automations yet"
          body="A welcome email is the classic first automation — every new signup gets it automatically."
          action={<Button onClick={() => setEditing("new")} className="bg-neutral-900 hover:bg-neutral-800 text-white">Create an automation</Button>}
        />
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <Card key={a.id} className="rounded-xl border-neutral-200 shadow-none p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <p className="font-medium text-neutral-900">{a.name}</p>
                    <StatusBadge status={a.status} />
                    <span className="text-[11px] text-neutral-400">
                      {a.trigger === "signup" ? "on signup" : `tagged #${a.triggerTag}`}
                      {a.delayHours > 0 ? ` · after ${a.delayHours}h` : " · immediately"}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-500 truncate mt-0.5">{a.subject}</p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {a.sentCount} sent{typeof a.queued === "number" && a.queued > 0 ? ` · ${a.queued} queued` : ""} · created {fmtDate(a.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Switch checked={a.status === "active"} onCheckedChange={() => toggle(a)} />
                  <Button variant="ghost" size="icon" className="size-8 text-neutral-400" onClick={() => setEditing(a)}><Pencil className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-neutral-400 hover:text-red-600" onClick={() => remove(a.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <AutomationDialog
        open={editing !== null}
        automation={editing === "new" ? null : editing}
        onOpenChange={(v) => setEditing(v ? editing : null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}

function AutomationDialog({ open, onOpenChange, automation, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; automation: Automation | null; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", trigger: "signup", triggerTag: "", delayHours: 0, subject: "", content: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (automation) {
        setForm({ name: automation.name, trigger: automation.trigger, triggerTag: automation.triggerTag, delayHours: automation.delayHours, subject: automation.subject, content: automation.content });
      } else {
        setForm({ name: "", trigger: "signup", triggerTag: "", delayHours: 0, subject: "", content: "" });
      }
    }
  }, [open, automation]);

  const save = async () => {
    setBusy(true);
    try {
      if (automation) {
        await api(`/api/automations/${automation.id}`, { method: "PATCH", body: JSON.stringify(form) });
        toast.success("Automation saved");
      } else {
        await api("/api/automations", { method: "POST", body: JSON.stringify(form) });
        toast.success("Automation created and active");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto oc-scroll">
        <DialogHeader>
          <DialogTitle>{automation ? "Edit automation" : "New automation"}</DialogTitle>
          <DialogDescription>Fires for contacts that match the trigger. Tokens resolve per recipient.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Welcome series" />
            </div>
            <div className="space-y-1.5">
              <Label>Delay after trigger</Label>
              <div className="flex items-center gap-2">
                <Input type="number" min={0} value={form.delayHours} onChange={(e) => setForm({ ...form, delayHours: parseInt(e.target.value || "0", 10) })} className="w-24" />
                <span className="text-sm text-neutral-500">hours</span>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Trigger</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="signup">Contact signs up</SelectItem>
                  <SelectItem value="tag">Contact gets a tag</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.trigger === "tag" ? (
              <div className="space-y-1.5">
                <Label>Tag</Label>
                <Input value={form.triggerTag} onChange={(e) => setForm({ ...form, triggerTag: e.target.value })} placeholder="vip" />
              </div>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Welcome aboard, {{first_name}}" />
          </div>
          <div className="space-y-1.5">
            <Label>HTML content</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="font-mono text-[13px] min-h-[200px] bg-neutral-50" placeholder="<h1>Welcome, {{first_name}}!</h1>…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.name.trim() || !form.subject.trim() || !form.content.trim() || busy} onClick={save} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} {automation ? "Save changes" : "Create automation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
