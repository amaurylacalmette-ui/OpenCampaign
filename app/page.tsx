"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Send, Users, LayoutTemplate, Zap, BarChart3, ClipboardList, Settings as SettingsIcon, Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dashboard } from "@/components/oc/dashboard";
import { Campaigns } from "@/components/oc/campaigns";
import { Audience } from "@/components/oc/audience";
import { Templates } from "@/components/oc/templates";
import { Automations } from "@/components/oc/automations";
import { Reports } from "@/components/oc/reports";
import { SignupForms } from "@/components/oc/forms";
import { Settings } from "@/components/oc/settings";
import { AuthScreen } from "@/components/oc/auth";
import { AccountMenu } from "@/components/oc/account-menu";
import { api, setUnauthorizedHandler, type AuthUser, type Settings } from "@/lib/oc-client";
import { toast } from "sonner";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "campaigns", label: "Campaigns", icon: Send },
  { id: "audience", label: "Audience", icon: Users },
  { id: "templates", label: "Templates", icon: LayoutTemplate },
  { id: "automations", label: "Automations", icon: Zap },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "forms", label: "Signup forms", icon: ClipboardList },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

type Phase = "loading" | "signed-out" | "signed-in";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [view, setView] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [openNew, setOpenNew] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<string | undefined>(undefined);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const d = await api<{ settings: Settings }>("/api/settings");
      setSettings(d.settings);
    } catch {
      // settings load is non-fatal
    }
  }, []);

  const bootstrap = useCallback(async () => {
    try {
      const d = await api<{ user: AuthUser }>("/api/auth/me");
      setUser(d.user);
      setPhase("signed-in");
      loadSettings();
    } catch {
      setUser(null);
      setPhase("signed-out");
    }
  }, [loadSettings]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // Any data request answered 401 means the session ended (expired, or
    // signed out in another tab) — return to the auth screen gracefully.
    setUnauthorizedHandler(() => {
      setUser(null);
      setPhase("signed-out");
      setView("dashboard");
      toast.info("Your session has ended. Please sign in again.");
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (phase !== "signed-in") return;
    // automation heartbeat — processes due jobs while the app is open
    const ping = () => {
      fetch("/api/automations/process", { method: "POST" }).catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60000);
    return () => clearInterval(t);
  }, [phase]);

  const navigate = (v: string) => {
    setView(v);
    setNavOpen(false);
  };

  const bump = () => setRefreshKey((k) => k + 1);

  const startCampaignFromTemplate = (templateId: string) => {
    setPendingTemplate(templateId);
    setOpenNew(true);
    setView("campaigns");
  };

  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafaf8]">
        <div className="flex items-center gap-2.5">
          <span className="size-8 rounded-lg bg-neutral-900 flex items-center justify-center animate-pulse">
            <span className="text-amber-300 font-extrabold text-lg leading-none">O</span>
          </span>
          <span className="font-semibold tracking-tight text-[15px] text-neutral-900">OpenCampaign</span>
        </div>
      </div>
    );
  }

  if (phase === "signed-out" || !user) {
    return (
      <AuthScreen
        onAuthed={(u) => {
          setUser({ ...u, createdAt: new Date().toISOString() });
          setPhase("signed-in");
          setView("dashboard");
          loadSettings();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex bg-[#fafaf8] text-neutral-900">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-white">
        <div className="px-5 py-5 border-b border-neutral-100">
          <Brand />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto oc-scroll">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                view === item.id
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              )}
            >
              <item.icon className={cn("size-4", view === item.id ? "text-amber-300" : "text-neutral-400")} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-neutral-100">
          <AccountMenu user={user} onSignedOut={() => { setUser(null); setPhase("signed-out"); }} />
        </div>
      </aside>

      {/* Mobile nav */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur px-4 py-3 flex items-center justify-between">
          <Brand />
          <div className="flex items-center gap-2">
            <AccountMenu compact user={user} onSignedOut={() => { setUser(null); setPhase("signed-out"); }} />
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menu"><Menu className="size-5" /></Button>
            </SheetTrigger>
          </div>
        </div>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="px-5 py-5 border-b border-neutral-100"><Brand /></div>
          <nav className="px-3 py-4 space-y-0.5">
            {NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  view === item.id ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                )}
              >
                <item.icon className={cn("size-4", view === item.id ? "text-amber-300" : "text-neutral-400")} />
                {item.label}
              </button>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

      {/* Main */}
      <main className="flex-1 min-w-0 pt-16 lg:pt-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-8">
          {view === "dashboard" ? (
            <Dashboard onNavigate={navigate} onNewCampaign={() => { setPendingTemplate(undefined); setOpenNew(true); setView("campaigns"); }} />
          ) : null}
          {view === "campaigns" ? (
            <Campaigns
              refreshKey={refreshKey}
              openNew={openNew}
              presetTemplateId={pendingTemplate}
              onNewDialogClosed={() => { setOpenNew(false); setPendingTemplate(undefined); }}
            />
          ) : null}
          {view === "audience" ? <Audience refreshKey={refreshKey} /> : null}
          {view === "templates" ? <Templates onUseInCampaign={startCampaignFromTemplate} /> : null}
          {view === "automations" ? <Automations refreshKey={refreshKey} /> : null}
          {view === "reports" ? <Reports /> : null}
          {view === "forms" ? <SignupForms settings={settings} account={user.id} /> : null}
          {view === "settings" ? <Settings settings={settings} onSaved={setSettings} /> : null}
        </div>
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="size-8 rounded-lg bg-neutral-900 flex items-center justify-center">
        <span className="text-amber-300 font-extrabold text-lg leading-none">O</span>
      </span>
      <span className="font-semibold tracking-tight text-[15px]">OpenCampaign</span>
    </div>
  );
}
