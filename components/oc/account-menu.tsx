"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/oc-client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { KeyRound, Loader2, LogOut } from "lucide-react";

export function initialsOf(user: { name: string; email: string }): string {
  const n = user.name.trim();
  if (n) {
    const parts = n.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() || "").join("") || "U";
  }
  return user.email.slice(0, 2).toUpperCase();
}

function Avatar({ user, className }: { user: { name: string; email: string }; className?: string }) {
  return (
    <span className={cn("size-8 rounded-full bg-neutral-900 text-amber-300 flex items-center justify-center text-xs font-bold shrink-0", className)}>
      {initialsOf(user)}
    </span>
  );
}

export function AccountMenu({
  user,
  compact,
  onSignedOut,
}: {
  user: { id: string; email: string; name: string };
  compact?: boolean;
  onSignedOut: () => void;
}) {
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const signOut = async () => {
    try {
      await api("/api/auth/signout", { method: "POST" });
    } finally {
      onSignedOut();
    }
  };

  const changePassword = async () => {
    setPwError(null);
    if (next !== confirm) {
      setPwError("New passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/auth/password", { method: "PUT", body: JSON.stringify({ currentPassword: current, newPassword: next }) });
      toast.success("Password updated");
      setPwOpen(false);
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setPwError(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {compact ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Account" className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
              <Avatar user={user} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="truncate text-sm font-medium">{user.name || "Account"}</p>
              <p className="truncate text-xs font-normal text-neutral-500">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setPwOpen(true)}><KeyRound className="size-4" /> Change password</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600"><LogOut className="size-4" /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-neutral-100 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400">
              <Avatar user={user} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-neutral-900 truncate leading-tight">{user.name || "Account"}</span>
                <span className="block text-xs text-neutral-500 truncate leading-tight">{user.email}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-56">
            <DropdownMenuItem onClick={() => setPwOpen(true)}><KeyRound className="size-4" /> Change password</DropdownMenuItem>
            <DropdownMenuItem onClick={signOut} className="text-red-600 focus:text-red-600"><LogOut className="size-4" /> Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
            <DialogDescription>Choose a password of at least 8 characters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current password</Label>
              <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Repeat new password</Label>
              <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            {pwError ? <p className="text-sm text-red-600">{pwError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword} disabled={busy || !current || !next} className="bg-neutral-900 hover:bg-neutral-800 text-white">
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
