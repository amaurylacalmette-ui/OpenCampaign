"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Upload, Download, Search, Trash2, Users, Loader2, X } from "lucide-react";
import { StatusBadge, EmptyState, SectionHeader, LoadingBlock } from "./shared";
import { api, fmtDate, type Contact } from "@/lib/oc-client";

export function Audience({ refreshKey }: { refreshKey: number }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [tags, setTags] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (q.trim()) params.set("q", q.trim());
      if (status !== "all") params.set("status", status);
      if (tag) params.set("tag", tag);
      const d = await api<{ contacts: Contact[]; total: number; pages: number; tags: string[] }>(`/api/contacts?${params}`);
      setContacts(d.contacts);
      setTotal(d.total);
      setPages(d.pages);
      setTags(d.tags);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [page, q, status, tag]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const deleteContact = async (id: string) => {
    if (!confirm("Remove this contact from your audience?")) return;
    await api(`/api/contacts/${id}`, { method: "DELETE" });
    toast.success("Contact removed");
    load();
  };

  return (
    <div>
      <SectionHeader
        title="Audience"
        body={`${total.toLocaleString()} contact${total === 1 ? "" : "s"} matching your filters.`}
        actions={
          <>
            <Button variant="outline" onClick={() => setShowImport(true)}><Upload className="size-4" /> Import</Button>
            <a href="/api/contacts/export" download><Button variant="outline"><Download className="size-4" /> Export</Button></a>
            <Button onClick={() => setShowAdd(true)} className="bg-neutral-900 hover:bg-neutral-800 text-white"><Plus className="size-4" /> Add contact</Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input
            placeholder="Search email, name, company…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="pl-9 w-64 bg-white"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="subscribed">Subscribed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="cleaned">Cleaned</SelectItem>
          </SelectContent>
        </Select>
        {tag ? (
          <button onClick={() => { setTag(""); setPage(1); }} className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-800">
            #{tag} <X className="size-3" />
          </button>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {tags.filter((t) => t !== tag).slice(0, 12).map((t) => (
            <button key={t} onClick={() => { setTag(t); setPage(1); }} className="rounded-full bg-neutral-100 hover:bg-amber-100 border border-neutral-200 hover:border-amber-200 px-2.5 py-1 text-xs text-neutral-600 transition-colors">
              #{t}
            </button>
          ))}
        </div>
      ) : null}

      {loading && contacts.length === 0 ? (
        <LoadingBlock rows={6} />
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="No contacts here"
          body="Add contacts one by one, import a CSV, or share your signup form link."
          action={<Button onClick={() => setShowAdd(true)} className="bg-neutral-900 hover:bg-neutral-800 text-white">Add your first contact</Button>}
        />
      ) : (
        <Card className="rounded-xl border-neutral-200 shadow-none overflow-hidden">
          <ScrollArea className="w-full">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="font-medium px-5 py-3">Contact</th>
                  <th className="font-medium px-5 py-3 hidden md:table-cell">Company</th>
                  <th className="font-medium px-5 py-3 hidden lg:table-cell">Tags</th>
                  <th className="font-medium px-5 py-3">Status</th>
                  <th className="font-medium px-5 py-3 hidden sm:table-cell">Joined</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-neutral-900">{c.firstName || c.lastName ? `${c.firstName} ${c.lastName}`.trim() : "—"}</p>
                      <p className="text-xs text-neutral-500">{c.email}</p>
                    </td>
                    <td className="px-5 py-3 text-neutral-600 hidden md:table-cell">{c.company || "—"}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {c.tags ? c.tags.split(",").slice(0, 3).map((t) => (
                          <span key={t} className="rounded bg-neutral-100 border border-neutral-200 px-1.5 py-0.5 text-[11px] text-neutral-500">#{t}</span>
                        )) : <span className="text-neutral-300 text-xs">—</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-neutral-500 text-xs hidden sm:table-cell">{fmtDate(c.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button variant="ghost" size="icon" className="size-8 text-neutral-300 hover:text-red-600" onClick={() => deleteContact(c.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-xs text-neutral-500">
            <span>Page {page} of {pages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      )}

      <AddContactDialog open={showAdd} onOpenChange={setShowAdd} onAdded={load} />
      <ImportDialog open={showImport} onOpenChange={setShowImport} onImported={() => { setPage(1); load(); }} />
    </div>
  );
}

function AddContactDialog({ open, onOpenChange, onAdded }: { open: boolean; onOpenChange: (v: boolean) => void; onAdded: () => void }) {
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", company: "", tags: "", status: "subscribed" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setForm({ email: "", firstName: "", lastName: "", company: "", tags: "", status: "subscribed" });
  }, [open]);

  const submit = async () => {
    setBusy(true);
    try {
      await api("/api/contacts", { method: "POST", body: JSON.stringify(form) });
      toast.success("Contact added — active automations will run for them");
      onOpenChange(false);
      onAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add contact");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
          <DialogDescription>Signup-triggered automations fire immediately for new contacts.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@example.com" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>First name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Last name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5"><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Tags <span className="text-neutral-400 font-normal">(comma separated)</span></Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="newsletter, vip" /></div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="subscribed">Subscribed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!form.email.includes("@") || busy} onClick={submit} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Add contact
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (v: boolean) => void; onImported: () => void }) {
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) setCsv("");
  }, [open]);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(file);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const d = await api<{ created: number; updated: number; skipped: number }>("/api/contacts/import", {
        method: "POST",
        body: JSON.stringify({ csv }),
      });
      toast.success(`Import done — ${d.created} added, ${d.updated} updated, ${d.skipped} skipped`);
      onOpenChange(false);
      onImported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            CSV with an <code className="text-[12px] bg-neutral-100 px-1 rounded">email</code> column — extras like first_name, last_name, company, tags and status are picked up automatically. Existing emails are updated.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            ref={fileRef}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) readFile(f); }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-neutral-300 bg-neutral-50 hover:bg-neutral-100 transition-colors py-8 text-sm text-neutral-500 flex flex-col items-center gap-2"
          >
            <Upload className="size-5 text-neutral-400" />
            Choose a CSV file, or paste it below
          </button>
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={"email,first_name,last_name,tags\nada@example.com,Ada,Lovelace,vip"}
            className="font-mono text-[13px] min-h-[140px] bg-neutral-50"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!csv.trim() || busy} onClick={submit} className="bg-neutral-900 hover:bg-neutral-800 text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : null} Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
