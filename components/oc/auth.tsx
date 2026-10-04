"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/oc-client";
import { Eye, EyeOff, Loader2, Mail, ShieldCheck, Sparkles, Users, Zap } from "lucide-react";

type Mode = "signin" | "signup";

export function AuthScreen({ onAuthed }: { onAuthed: (user: { id: string; email: string; name: string }) => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ user: { id: string; email: string; name: string } }>(isSignup ? "/api/auth/signup" : "/api/auth/signin", {
        method: "POST",
        body: JSON.stringify(isSignup ? { name, email, password } : { email, password }),
      });
      onAuthed(d.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#fafaf8]">
      {/* Brand panel */}
      <div className="hidden lg:flex w-[46%] xl:w-[44%] shrink-0 flex-col justify-between bg-neutral-900 text-white p-12 relative overflow-hidden">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
            <span className="text-amber-300 font-extrabold text-lg leading-none">O</span>
          </span>
          <span className="font-semibold tracking-tight text-[15px]">OpenCampaign</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">
            Email campaigns,<br />without the hoops.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-neutral-400">
            Audiences, campaigns, automations, signup forms and reporting — self-hosted and under your control. Every campaign gets an AI review before it ships.
          </p>
          <ul className="mt-8 space-y-3.5 text-sm text-neutral-300">
            <li className="flex items-center gap-3"><Users className="size-4 text-amber-300 shrink-0" /> Import your list or collect signups with embeddable forms</li>
            <li className="flex items-center gap-3"><Mail className="size-4 text-amber-300 shrink-0" /> Send through your own SMTP — simulation mode by default</li>
            <li className="flex items-center gap-3"><Sparkles className="size-4 text-amber-300 shrink-0" /> AI review scores every draft before it goes out</li>
            <li className="flex items-center gap-3"><Zap className="size-4 text-amber-300 shrink-0" /> Welcome emails and tag triggers run on autopilot</li>
          </ul>
        </div>

        <p className="relative z-10 text-xs text-neutral-500 flex items-center gap-1.5">
          <ShieldCheck className="size-3.5" /> Your data stays on your server.
        </p>

        {/* decorative */}
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-white/5 blur-3xl" />
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-10">
            <span className="size-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <span className="text-amber-300 font-extrabold text-lg leading-none">O</span>
            </span>
            <span className="font-semibold tracking-tight text-[15px]">OpenCampaign</span>
          </div>

          <div className="flex rounded-lg bg-neutral-100 p-1 mb-7">
            {(["signin", "signup"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={cn(
                  "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                  mode === m ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800"
                )}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">
            {isSignup ? "Create your account" : "Welcome back"}
          </h2>
          <p className="text-sm text-neutral-500 mt-1 mb-6">
            {isSignup ? "Takes under a minute. Your workspace starts empty and stays yours." : "Sign in to your workspace."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {isSignup ? (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name">Name</Label>
                <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ava Chen" autoComplete="name" />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input id="auth-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <div className="relative">
                <Input
                  id="auth-password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isSignup ? "At least 8 characters" : "••••••••"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  aria-label={showPw ? "Hide password" : "Show password"}
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            ) : null}

            <Button type="submit" disabled={busy} className="w-full bg-neutral-900 hover:bg-neutral-800 text-white">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {isSignup ? "Create account" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
