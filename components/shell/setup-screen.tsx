"use client";

import * as React from "react";
import { Telescope } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

/**
 * First-run wizard for a fresh self-hosted instance: creates the workspace and
 * its first admin, then signs in. Only rendered when /api/setup reports the
 * instance still needs setup (see app-shell).
 */
export function SetupScreen() {
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const submit = async () => {
    setError(null);
    if (!workspaceName.trim()) return setError("Enter a workspace name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Enter a valid email.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceName: workspaceName.trim(), adminName: adminName.trim(), email: email.trim(), password }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? "Setup failed.");
        return;
      }
      // Sign in with the new admin — the store's auth listener takes over.
      const { error: signInErr } = (await supabase?.auth.signInWithPassword({ email: email.trim(), password })) ?? {};
      if (signInErr) setDone(true); // created, but auto sign-in failed — tell them to log in
    } catch {
      setError("Couldn't reach the server — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-lg">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-fg">
          <Telescope className="h-5 w-5" />
        </span>
        {done ? (
          <>
            <h1 className="text-lg font-semibold text-foreground">Workspace created</h1>
            <p className="mt-1 text-[13px] text-muted">Sign in with the email and password you just set.</p>
            <Button variant="primary" className="mt-5 w-full" onClick={() => window.location.reload()}>
              Go to sign in
            </Button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-foreground">Set up Lens</h1>
            <p className="mt-1 text-[13px] text-muted">Create your workspace and administrator account. This runs once.</p>
            {error && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label>Workspace name</Label>
                <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Research" />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Your name</Label>
                <Input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Password</Label>
                <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-subtle">At least 8 characters. You can change it later in Settings.</p>
              </div>
              <Button variant="primary" className="mt-1 w-full" onClick={submit} disabled={busy}>
                {busy ? "Creating…" : "Create workspace"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
