"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { SectionHeader } from "./shared";
import { api, type Settings } from "@/lib/oc-client";

export function SignupForms({ settings, account }: { settings: Settings | null; account: string }) {
  const [title, setTitle] = useState("Join the list");
  const [blurb, setBlurb] = useState("One email a month. No spam, ever.");
  const [buttonLabel, setButtonLabel] = useState("Subscribe");
  const [tag, setTag] = useState("newsletter");
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<string | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://your-domain.com";

  const embedCode = `<!-- OpenCampaign signup form -->
<div id="opencampaign-form" style="max-width:420px;margin:0 auto;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;">
  <h2 style="margin:0 0 6px;font-size:20px;color:#111;">${title}</h2>
  <p style="margin:0 0 16px;font-size:14px;color:#666;">${blurb}</p>
  <form onsubmit="ocSignup(event)" style="display:flex;gap:8px;">
    <input id="oc-email" type="email" required placeholder="you@example.com"
      style="flex:1;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;" />
    <button type="submit"
      style="padding:10px 18px;background:#111;color:#fff;border:0;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">${buttonLabel}</button>
  </form>
  <p id="oc-msg" style="margin:10px 0 0;font-size:13px;color:#059669;display:none;"></p>
</div>
<script>
function ocSignup(e){
  e.preventDefault();
  var msg=document.getElementById('oc-msg');
  fetch('${appUrl}/api/signup',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({email:document.getElementById('oc-email').value,tags:'${tag}',account:'${account}'})
  }).then(function(r){return r.json()}).then(function(d){
    if(d.error){msg.textContent=d.error;msg.style.color='#dc2626';}
    else{msg.textContent=d.message||"You're on the list.";msg.style.color='#059669';}
    msg.style.display='block';
  }).catch(function(){msg.textContent='Something went wrong. Try again.';msg.style.color='#dc2626';msg.style.display='block';});
}
</script>`;

  const copyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    toast.success("Embed code copied");
  };

  const testForm = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const d = await api<{ message?: string; error?: string }>("/api/signup", {
        method: "POST",
        body: JSON.stringify({ email: testEmail, tags: tag, account, hp: "" }),
      });
      setTestResult(d.message || d.error || "Done");
      toast.success("Signup went through — check your Audience list");
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <SectionHeader title="Signup forms" body="Collect subscribers anywhere. Copy the embed or share the hosted form." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border-neutral-200 shadow-none p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900">Form builder</h3>
          <div className="space-y-1.5"><Label>Heading</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Description</Label><Input value={blurb} onChange={(e) => setBlurb(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Button label</Label><Input value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Tag new signups with</Label><Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="newsletter" /></div>
          {settings ? (
            <div className="flex items-center justify-between rounded-lg border border-neutral-200 px-3.5 py-3">
              <div>
                <p className="text-sm font-medium text-neutral-800">Double opt-in</p>
                <p className="text-xs text-neutral-500">Signups land as pending until confirmed.</p>
              </div>
              <Switch checked={settings.doubleOptIn} disabled />
            </div>
          ) : null}
          <p className="text-xs text-neutral-400">Toggle double opt-in under Settings → Sending.</p>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-xl border-neutral-200 shadow-none p-5">
            <h3 className="font-semibold text-neutral-900 mb-4">Live preview</h3>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-6">
              <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
              <p className="text-sm text-neutral-500 mt-1 mb-4">{blurb}</p>
              <div className="flex gap-2">
                <Input placeholder="you@example.com" className="bg-white" />
                <Button className="bg-neutral-900 hover:bg-neutral-800 text-white shrink-0">{buttonLabel}</Button>
              </div>
            </div>
          </Card>

          <Card className="rounded-xl border-neutral-200 shadow-none p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-neutral-900">Embed code</h3>
              <Button variant="outline" size="sm" onClick={copyEmbed}><Copy className="size-3.5" /> Copy</Button>
            </div>
            <pre className="text-[11px] leading-relaxed bg-neutral-50 border border-neutral-200 rounded-lg p-3 overflow-x-auto max-h-52 oc-scroll text-neutral-600">{embedCode}</pre>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input type="email" placeholder="Test the endpoint with your email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <Button variant="outline" onClick={testForm} disabled={!testEmail.includes("@") || testing} className="shrink-0">
                {testing ? "Sending…" : "Test signup"}
              </Button>
            </div>
            {testResult ? <p className="text-xs text-emerald-700 mt-2">{testResult}</p> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
