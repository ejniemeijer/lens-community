"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Lightbulb, Sparkles, FolderOpen, ArrowRight, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useApp } from "@/lib/store";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { currentUser, currentUserId } from "@/lib/db";
import type { Role } from "@/lib/types";

type QuickLink = { icon: LucideIcon; label: string; desc: string; href: string; show: (r: Role) => boolean };

/* Role-aware "where to start" links: everyone browses; creators also contribute;
   AI only for roles that may use it. */
const LINKS: QuickLink[] = [
  { icon: LayoutDashboard, label: "Dashboards", desc: "The big picture across all your team's research.", href: "/dashboard", show: () => true },
  { icon: Lightbulb, label: "Insights", desc: "Reusable findings, each linked to its evidence.", href: "/insights", show: () => true },
  { icon: Sparkles, label: "AI assistant", desc: "Ask questions about the research in plain language.", href: "/ai", show: (r) => can(r, "use-ai") },
  { icon: FolderOpen, label: "Add research", desc: "Create projects, log interviews, capture insights.", href: "/projects", show: (r) => can(r, "manage-content") },
];

/**
 * One-time welcome shown on a user's first sign-in — a greeting plus role-aware
 * quick links. "Seen" is remembered two ways: a durable per-user synced pref
 * (`welcome.seen`) so it survives a cache clear or a new device, plus a
 * localStorage fast-path that's race-free (it doesn't wait on the cloud prefs
 * fetch and never flashes). Gated on `hydrated` + `prefsLoaded`. Append
 * `?welcome` to any in-app URL to preview it. Rendered once at the shell level.
 */
export function WelcomeModal() {
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const prefsLoaded = useApp((s) => s.prefsLoaded);
  const signedOut = useApp((s) => s.signedOut);
  const role = useApp((s) => s.role);
  const account = useApp((s) => s.account);
  const setPref = useApp((s) => s.setPref);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (signedOut || !hydrated) return;
    const force = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("welcome");
    if (force) return setOpen(true);

    const key = `lens-welcome:${currentUserId}`;
    const seenPref = () => useApp.getState().prefs["welcome.seen"] === true;

    // Fast path — already welcomed on this device. Race-free (no wait on the
    // prefs fetch). Backfill the durable pref for anyone welcomed before it existed.
    try {
      if (localStorage.getItem(key)) {
        if (prefsLoaded && !seenPref()) setPref("welcome.seen", true);
        return;
      }
    } catch {
      /* localStorage unavailable — fall through to the pref check */
    }

    // Durable path — the synced per-user pref survives cache clears and new
    // devices. Only trust it once this user's prefs have actually loaded.
    if (!prefsLoaded) return; // effect re-runs when prefs arrive
    const mark = () => {
      try { localStorage.setItem(key, "1"); } catch {}
    };
    if (seenPref()) return mark();
    // Genuinely first time on any device — record it and show.
    mark();
    setPref("welcome.seen", true);
    setOpen(true);
  }, [hydrated, prefsLoaded, signedOut, setPref]);

  if (!open) return null;
  const firstName = currentUser().name.split(" ")[0];
  const links = LINKS.filter((l) => l.show(role));
  const go = (href: string) => { setOpen(false); router.push(href); };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={`Welcome to Lens, ${firstName}`}
      description={
        account?.name
          ? `You've joined ${account.name}'s research repository — here's where to start.`
          : "Your team's shared home for research — here's where to start."
      }
      footer={<Button variant="primary" onClick={() => setOpen(false)}>Start exploring</Button>}
    >
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[13px] text-muted">
          You&apos;re signed in as <Badge tone="primary">{ROLE_LABELS[role]}</Badge>
        </p>
        <div className="flex flex-col gap-2">
          {links.map((l) => {
            const Icon = l.icon;
            return (
              <div key={l.href} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground">{l.label}</p>
                  <p className="text-xs text-subtle">{l.desc}</p>
                </div>
                <button
                  onClick={() => go(l.href)}
                  aria-label={`Go to ${l.label}`}
                  title={`Go to ${l.label}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-subtle transition-colors hover:border-border-strong hover:bg-surface-hover hover:text-primary"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
