"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, LayoutTemplate, Pencil, Copy } from "lucide-react";
import { EmptyState, SectionHeader, LoadingBlock } from "./shared";
import { api, fmtDate, type Template } from "@/lib/oc-client";

export function Templates({ onUseInCampaign }: { onUseInCampaign?: (templateId: string) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api<{ templates: Template[] }>("/api/templates");
      setTemplates(d.templates);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await api(`/api/templates/${id}`, { method: "DELETE" });
    toast.success("Template deleted");
    load();
  };

  const duplicate = async (t: Template) => {
    await api("/api/templates", { method: "POST", body: JSON.stringify({ name: `${t.name} copy`, category: t.category, subject: t.subject, content: t.content }) });
    toast.success("Template duplicated");
    load();
  };

  return (
    <div>
      <SectionHeader
        title="Templates"
        body="Reusable HTML layouts — start a campaign from any of them."
        actions={
          <Button onClick={() => setEditing("new")} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            <Plus className="size-4" /> New template
          </Button>
        }
      />

      {loading ? (
        <LoadingBlock rows={3} />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate className="size-5" />}
          title="No templates yet"
          body="Templates keep your emails consistent. Save any HTML layout here and reuse it in every campaign."
          action={<Button onClick={() => setEditing("new")} className="bg-neutral-900 hover:bg-neutral-800 text-white">Create a template</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="rounded-xl border-neutral-200 shadow-none overflow-hidden group">
              <div className="h-40 bg-neutral-50 border-b border-neutral-100 overflow-hidden relative">
                <iframe
                  title={`Preview of ${t.name}`}
                  srcDoc={`<style>body{margin:0;padding:12px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:#222;transform:scale(.62);transform-origin:top left;width:160%;} img{max-width:100%}</style>${t.content}`}
                  className="w-[160%] h-[260px] border-0 pointer-events-none"
                  sandbox=""
                />
                <div className="absolute inset-0 group-hover:bg-black/5 transition-colors" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900 truncate">{t.name}</p>
                  <span className="text-[11px] uppercase tracking-wide text-neutral-400 shrink-0">{t.category}</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Updated {fmtDate(t.updatedAt)}</p>
                <div className="flex items-center gap-1 mt-3">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => setEditing(t)}><Pencil className="size-3.5" /> Edit</Button>
                  {onUseInCampaign ? (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => onUseInCampaign(t.id)}>
                      <Plus className="size-3.5" /> Use
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="icon" className="size-8 ml-auto text-neutral-400" onClick={() => duplicate(t)}><Copy className="size-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="size-8 text-neutral-400 hover:text-red-600" onClick={() => remove(t.id)}><Trash2 className="size-3.5" /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TemplateDialog
        open={editing !== null}
        template={editing === "new" ? null : editing}
        onOpenChange={(v) => setEditing(v ? editing : null)}
        onSaved={() => { setEditing(null); load(); }}
      />
    </div>
  );
}

function TemplateDialog({ open, onOpenChange, template, onSaved }: { open: boolean; onOpenChange: (v: boolean) => void; template: Template | null; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name);
        setCategory(template.category);
        setSubject(template.subject);
        setContent(template.content);
      } else {
        setName("");
        setCategory("general");
        setSubject("");
        setContent("");
      }
    }
  }, [open, template]);

  const save = async () => {
    setBusy(true);
    try {
      if (template) {
        await api(`/api/templates/${template.id}`, { method: "PATCH", body: JSON.stringify({ name, category, subject, content }) });
        toast.success("Template saved");
      } else {
        await api("/api/templates", { method: "POST", body: JSON.stringify({ name, category, subject, content }) });
        toast.success("Template created");
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
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>HTML with personalization tokens. Tokens resolve per recipient at send time.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 md:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Monthly newsletter" /></div>
            <div className="space-y-1.5"><Label>Category</Label><Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="newsletter" /></div>
            <div className="space-y-1.5"><Label>Default subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Optional" /></div>
            <div className="space-y-1.5">
              <Label>HTML content</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-[13px] min-h-[300px] bg-neutral-50" placeholder="<h1>Hey {{first_name}},</h1>…" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="rounded-lg border border-neutral-200 overflow-hidden bg-white h-[380px]">
              <iframe
                title="Template preview"
                srcDoc={content.replace(/\{\{\s*first_name\s*\}\}/gi, "Alex").replace(/\{\{\s*unsubscribe\s*\}\}/gi, "#")}
                className="w-full h-full border-0"
                sandbox=""
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!name.trim() || !content.trim() || busy} onClick={save} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
