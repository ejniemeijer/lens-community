"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Telescope, Ban, Clock, LogOut } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { LockScreen } from "./lock-screen";
import { ResetPasswordScreen, FirstLoginScreen } from "./reset-password";
import { SetupScreen } from "./setup-screen";
import { WelcomeModal } from "./welcome-modal";
import { Toaster } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { isTrialExpired, trialDaysLeft, type AccountInfo } from "@/lib/supabase-sync";
import { isCloud, isSelfHosted } from "@/lib/edition";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-fg shadow-sm">
          <Telescope className="h-6 w-6 animate-pulse" />
        </span>
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    </div>
  );
}

/** Shown when the signed-in user's account (tenant) has been suspended. */
function SuspendedScreen({ name }: { name: string }) {
  const signOut = useApp((s) => s.signOut);
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-7 text-center shadow-lg">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft text-warning">
          <Ban className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">Workspace suspended</h1>
        <p className="mt-1 text-[13px] text-muted">
          {name ? `“${name}” is` : "This workspace is"} currently suspended. Contact your administrator or the Lens
          team to restore access.
        </p>
        <Button variant="outline" size="sm" className="mt-5" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

/** Shown when the signed-in user's account trial has ended (and not converted). */
function TrialEndedScreen({ name }: { name: string }) {
  const signOut = useApp((s) => s.signOut);
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-7 text-center shadow-lg">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Clock className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-semibold text-foreground">Your trial has ended</h1>
        <p className="mt-1 text-[13px] text-muted">
          The trial for {name ? `“${name}”` : "this workspace"} has ended. Contact the Lens team to keep your workspace
          and everything in it.
        </p>
        <Button variant="outline" size="sm" className="mt-5" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </div>
    </div>
  );
}

/** Slim countdown shown inside the app while a trial is still running. */
function TrialBanner({ account }: { account: AccountInfo }) {
  const left = trialDaysLeft(account.trialEndsAt);
  if (left === null || left < 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-primary/20 bg-primary-soft px-4 py-1.5 text-xs text-primary">
      <Clock className="h-3.5 w-3.5 shrink-0" />
      <span>
        {left <= 0 ? "Your trial ends today" : `${left} day${left === 1 ? "" : "s"} left in your trial`} — contact us to
        keep your workspace.
      </span>
    </div>
  );
}

/**
 * Routes that render standalone — no auth gate, splash, or app chrome.
 * "/" is included so the entry point (app/page.tsx) can decide where to send
 * signed-out visitors (the landing page) vs signed-in users (the dashboard);
 * without this the gate would show the login screen at the root instead.
 */
// "/t" is the public participant runner (unmoderated tests): token-validated
// server-side, so it renders standalone with no auth gate or app chrome.
const PUBLIC_ROUTES = ["/welcome", "/", "/admin", "/alternatives", "/compare", "/blog", "/privacy", "/terms", "/pricing", "/t"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  const authChecked = useApp((s) => s.authChecked);
  const signedOut = useApp((s) => s.signedOut);
  const recovery = useApp((s) => s.recovery);
  const firstLogin = useApp((s) => s.firstLogin);
  const account = useApp((s) => s.account);

  // Self-hosted first run: is there no admin login yet? (null = still checking)
  const [setupNeeded, setSetupNeeded] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    if (!isSelfHosted) return;
    fetch("/api/setup")
      .then((r) => r.json())
      .then((j) => setSetupNeeded(Boolean(j.needed)))
      .catch(() => setSetupNeeded(false));
  }, []);

  // Public marketing pages (e.g. the landing page) bypass the whole shell.
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`))) {
    return <>{children}</>;
  }

  // Cloud mode: wait for the session check before showing login or the app.
  if (!authChecked) return <Splash />;

  // Arrived via a password-reset email link: set the new password first.
  if (recovery && !signedOut) {
    return (
      <>
        <ResetPasswordScreen />
        <Toaster />
      </>
    );
  }

  // First sign-in with an admin-set temporary password: offer to change it.
  if (firstLogin && !signedOut) {
    return (
      <>
        <FirstLoginScreen />
        <Toaster />
      </>
    );
  }

  if (signedOut) {
    // Fresh self-hosted instance with no admin yet: run the first-time setup.
    if (isSelfHosted && setupNeeded === null) return <Splash />;
    if (isSelfHosted && setupNeeded) {
      return (
        <>
          <SetupScreen />
          <Toaster />
        </>
      );
    }
    return (
      <>
        <LockScreen />
        <Toaster />
      </>
    );
  }

  // A suspended account (tenant) can sign in but can't use the app.
  if (account?.status === "suspended") {
    return (
      <>
        <SuspendedScreen name={account.name} />
        <Toaster />
      </>
    );
  }

  // A trial that has run out locks the workspace until it's converted to paid.
  // Trials are a cloud-only concept; self-hosted licenses never expire.
  if (isCloud && isTrialExpired(account?.trialEndsAt)) {
    return (
      <>
        <TrialEndedScreen name={account?.name ?? ""} />
        <Toaster />
      </>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenMobile={() => setMobileOpen(true)} />
        {isCloud && account && <TrialBanner account={account} />}
        {/* stable gutter: short and tall pages align — no shift when the scrollbar appears */}
        <main className="flex-1 overflow-y-auto [scrollbar-gutter:stable]">{children}</main>
      </div>
      <WelcomeModal />
      <Toaster />
    </div>
  );
}
