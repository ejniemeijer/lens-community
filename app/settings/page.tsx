"use client";

import * as React from "react";
import {
  Users2,
  ShieldCheck,
  Sparkles,
  DatabaseBackup,
  ScrollText,
  Lock,
  Check,
  Minus,
  Download,
  Plus,
  RotateCcw,
  UserX,
  FileSearch,
  Pencil,
  Trash2,
  Eraser,
  UserRound,
  KeyRound,
  Info,
  LayoutGrid,
  Telescope,
  ExternalLink,
  Cpu,
  Building2,
  AlertTriangle,
  Columns3,
  ChevronUp,
  ChevronDown,
  Search,
} from "lucide-react";
import {
  users,
  auditLogs,
  participants,
  projects as projectsDb,
  interviews as interviewsDb,
  insights as insightsDb,
  getUser,
  currentUser,
  currentUserId,
  fullName,
  consentFor,
  DEFAULT_PASSWORD,
} from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can, CAPABILITY_ROWS, CAPS, ROLE_LABELS, ROLE_ORDER, effectiveSeatLimit, consumesSeat, planHasFeature } from "@/lib/permissions";
import { runExport, downloadText, stamp, type ExportFormat } from "@/lib/export";
import { AI_PROVIDERS, aiEnvStatus, aiKeyStatus, aiUsage, saveAiKey, AiError, type AiProvider } from "@/lib/ai";
import { KANBAN_STAGES_PREF, parseStages, LANE_COLORS } from "@/lib/workflow";
import { logAudit, fetchAuditEvents, type AuditEvent } from "@/lib/audit";
import type { Role, KanbanColumn } from "@/lib/types";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/modal";
import { AddUserDialog } from "@/components/forms/add-user-dialog";
import { EditUserDialog } from "@/components/forms/edit-user-dialog";
import { cn, formatDate, relativeToNow, uid } from "@/lib/utils";

type SectionId = "account" | "team" | "permissions" | "ai" | "kanban" | "tabs" | "data" | "consent" | "audit" | "about";

const SECTIONS: { id: SectionId; label: string; icon: typeof Users2 }[] = [
  { id: "account", label: "My account", icon: UserRound },
  { id: "team", label: "Team & roles", icon: Users2 },
  { id: "permissions", label: "Permissions", icon: ShieldCheck },
  { id: "ai", label: "AI configuration", icon: Sparkles },
  { id: "kanban", label: "Kanban lanes", icon: Columns3 },
  { id: "tabs", label: "Project tabs", icon: LayoutGrid },
  { id: "data", label: "Data & backups", icon: DatabaseBackup },
  { id: "consent", label: "Consent & GDPR", icon: Lock },
  { id: "audit", label: "Audit log", icon: ScrollText },
  { id: "about", label: "About", icon: Info },
];

/** Admin-managed sections: viewers are blocked entirely; every other role sees
    the section read-only (a disabled fieldset neutralizes all its controls);
    admins get the editable version. */
function AdminGate({ children }: { children: React.ReactNode }) {
  const role = useApp((s) => s.role);
  if (role === "viewer") return <AdminOnly />;
  if (can(role, "admin")) return <>{children}</>;
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        Read-only view — only administrators can change these settings.
      </p>
      <fieldset disabled className="m-0 min-w-0 border-0 p-0">{children}</fieldset>
    </div>
  );
}

function AdminOnly() {
  return (
    <EmptyState
      icon={<Lock className="h-5 w-5" />}
      title="Administrators only"
      description="Sign in with an administrator account to manage this section."
    />
  );
}

/** Store-backed toggle switch. */
function Pref({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const value = useApp((s) => Boolean(s.prefs[id]));
  const setPref = useApp((s) => s.setPref);
  return (
    <button
      disabled={disabled}
      onClick={() => setPref(id, !value)}
      className="flex items-center gap-2.5 text-left disabled:opacity-50"
    >
      <span className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", value ? "bg-primary" : "border border-border bg-surface-2")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform", value ? "translate-x-4" : "translate-x-0.5")} />
      </span>
      <span className="text-[13px] text-foreground">{label}</span>
    </button>
  );
}

export default function SettingsPage() {
  const [section, setSection] = React.useState<SectionId>("account");

  return (
    <>
      <PageHeader title="Settings" description="Administer the workspace, permissions, AI, data, and governance." />
      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => setSection(s.id)}
                  className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] font-medium", section === s.id ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground")}
                >
                  <Icon className="h-4 w-4" /> {s.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {section === "account" && <AccountSection />}
            {section === "team" && <AdminGate><TeamSection /></AdminGate>}
            {section === "permissions" && <PermissionsSection />}
            {section === "ai" && <AdminGate><AiSection /></AdminGate>}
            {section === "kanban" && <AdminGate><KanbanSection /></AdminGate>}
            {section === "tabs" && <ProjectTabsSection />}
            {section === "data" && <AdminGate><DataSection /></AdminGate>}
            {section === "consent" && <ConsentSection />}
            {section === "audit" && <AdminGate><AuditSection /></AdminGate>}
            {section === "about" && <AboutSection />}
          </div>
        </div>
      </PageBody>
    </>
  );
}

/** The signed-in user's own account: identity + self-service password change. */
function AccountSection() {
  useDb();
  const backend = useApp((s) => s.backend);
  const role = useApp((s) => s.role);
  const account = useApp((s) => s.account);
  const updateUser = useApp((s) => s.updateUser);
  const toast = useApp((s) => s.toast);
  const me = currentUser();

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async () => {
    setError("");
    if (!current || !next || !confirm) return setError("Fill in all three fields.");
    if (next.length < 8) return setError("The new password must be at least 8 characters.");
    if (next !== confirm) return setError("The new passwords don't match.");
    if (next === current) return setError("The new password must differ from the current one.");
    setBusy(true);
    try {
      if (backend === "cloud") {
        const { supabase } = await import("@/lib/supabase");
        if (!supabase) return setError("Cloud connection unavailable — try again later.");
        // Verify the current password before changing it (re-authenticates the same session).
        const { error: verifyErr } = await supabase.auth.signInWithPassword({
          email: me.email,
          password: current,
        });
        if (verifyErr) return setError("Current password is incorrect.");
        const { error: updErr } = await supabase.auth.updateUser({
          password: next,
          data: { must_change_password: false }, // clear any first-login prompt
        });
        if (updErr) return setError(updErr.message);
      } else {
        if (current !== (me.password ?? DEFAULT_PASSWORD)) return setError("Current password is incorrect.");
        updateUser(me.id, { password: next, mustChangePassword: false });
      }
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("Password updated");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Profile</h2>
        <div className="flex items-center gap-3">
          <Avatar name={me.name} accent={me.avatarColor} size="lg" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[15px] font-medium text-foreground">
              {me.name}
              <Badge tone="primary">{ROLE_LABELS[role]}</Badge>
            </p>
            <p className="truncate text-[13px] text-subtle">{me.email} · {me.jobTitle}</p>
          </div>
        </div>
      </Card>

      {account && (
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-foreground">Workspace</h2>
            <Badge tone={account.status === "active" ? "success" : "warning"} className="ml-auto capitalize">
              {account.status}
            </Badge>
          </div>
          <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <dt className="text-[13px] text-subtle">Name</dt>
              <dd className="text-[13px] font-medium text-foreground">{account.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-border py-2">
              <dt className="text-[13px] text-subtle">Plan</dt>
              <dd className="text-[13px] font-medium capitalize text-foreground">{account.plan}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 py-2 sm:col-span-2">
              <dt className="text-[13px] text-subtle">Account ID</dt>
              <dd className="font-mono text-[13px] text-muted">{account.id}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-subtle">
            Your organization&apos;s isolated Lens workspace. Everything you see and create belongs to this account.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <KeyRound className="h-4 w-4 text-muted" /> Change password
        </h2>
        <p className="mb-4 text-[13px] text-subtle">
          {backend === "cloud"
            ? "Your password is managed by Supabase Auth — the change applies everywhere you sign in."
            : "This account is local to this browser."}
        </p>
        <form
          className="flex max-w-sm flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-1">
            <Label htmlFor="pw-current">Current password</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pw-new">New password</Label>
            <Input
              id="pw-new"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input
              id="pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div>
            <Button type="submit" variant="primary" size="sm" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </div>
        </form>
      </Card>

      {backend === "cloud" && role === "admin" && account && (
        <DeleteWorkspaceCard accountName={account.name} />
      )}
    </div>
  );
}

/** Danger zone — an account admin permanently deletes their own workspace. */
function DeleteWorkspaceCard({ accountName }: { accountName: string }) {
  const signOut = useApp((s) => s.signOut);
  const [open, setOpen] = React.useState(false);
  const [typed, setTyped] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const match = typed.trim() === accountName;

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(null);
  };

  const confirmDelete = async () => {
    setError(null);
    setBusy(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      if (!supabase) return setError("Cloud connection unavailable — try again later.");
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return setError("Your session expired — sign in again.");
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: typed.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return setError(j.error ?? "Delete failed. Please try again.");
      }
      // Gone: end the session and return to the sign-in screen.
      await supabase.auth.signOut().catch(() => {});
      signOut();
      window.location.href = "/";
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-danger/30 p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-danger">
        <AlertTriangle className="h-4 w-4" /> Danger zone
      </h2>
      <p className="mb-4 text-[13px] text-subtle">
        Permanently delete this workspace and everything in it — participants, interviews, insights, boards, and every
        team member&apos;s login. This cannot be undone.
      </p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Delete workspace
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Delete this workspace?"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={!match || busy}>
              {busy ? "Deleting…" : "Delete permanently"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-[13px] text-muted">
          <p>
            This deletes <strong className="text-foreground">{accountName}</strong> and{" "}
            <strong className="text-foreground">all of its data</strong>, and signs out every member. There is no undo
            and no backup.
          </p>
          {error && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>}
          <div className="flex flex-col gap-1">
            <Label>Type the workspace name to confirm</Label>
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={accountName} />
          </div>
        </div>
      </Modal>
    </Card>
  );
}

function TeamSection() {
  useDb();
  const account = useApp((s) => s.account);
  const backend = useApp((s) => s.backend);
  // Team plan: per-member AI control (values persist; editing is gated).
  const aiGovernance = planHasFeature(account?.plan, "ai-governance");
  const setUserRole = useApp((s) => s.setUserRole);
  const updateUser = useApp((s) => s.updateUser);
  const deleteUser = useApp((s) => s.deleteUser);
  const toast = useApp((s) => s.toast);
  const [showInvite, setShowInvite] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  // Last sign-in per member — lives on Supabase auth, so it's fetched from a
  // service-role API (cloud/self-hosted only). null until loaded.
  const [lastLogin, setLastLogin] = React.useState<Record<string, string | null> | null>(null);
  React.useEffect(() => {
    if (backend !== "cloud") return;
    let cancelled = false;
    (async () => {
      try {
        const { supabase } = await import("@/lib/supabase");
        const token = (await supabase?.auth.getSession())?.data.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/team/last-login", { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const { lastLogin: map } = (await res.json()) as { lastLogin: Record<string, string | null> };
        if (!cancelled) setLastLogin(map);
      } catch {
        /* leave unshown — last-login is supplementary */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend]);
  // Gating happens in AdminGate: non-admins see this section read-only.

  // Seat usage — every non-viewer role uses a seat; viewers are free.
  const seatLimit = effectiveSeatLimit(account?.plan, account?.seatLimit);
  const seatsUsed = users.filter((u) => consumesSeat(u.role)).length;
  const seatsLabel = Number.isFinite(seatLimit)
    ? `${seatsUsed} of ${seatLimit} contributor seats used · viewers free`
    : `${seatsUsed} contributor seat${seatsUsed === 1 ? "" : "s"} · viewers free`;
  const overCap = Number.isFinite(seatLimit) && seatsUsed > seatLimit;

  const editingUser = users.find((u) => u.id === editing);
  const removingUser = users.find((u) => u.id === removing);

  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Team members</h2>
            <p className="text-[13px] text-subtle">{users.length} members</p>
            <p className={`text-xs ${overCap ? "text-danger" : "text-subtle"}`}>{seatsLabel}</p>
          </div>
          <Button size="sm" variant="primary" onClick={() => setShowInvite(true)}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {users.map((u) => {
            const isSelf = u.id === currentUserId;
            return (
              <div key={u.id} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0">
                <Avatar name={u.name} accent={u.avatarColor} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
                    {u.name}
                    {isSelf && <Badge tone="primary">You</Badge>}
                  </p>
                  <p className="truncate text-xs text-subtle">{u.email} · {u.jobTitle}</p>
                  {backend === "cloud" && lastLogin && (
                    <p
                      className="truncate text-2xs text-subtle"
                      title={lastLogin[u.id] ? formatDate(lastLogin[u.id]!, { hour: "2-digit", minute: "2-digit" }) : undefined}
                    >
                      {lastLogin[u.id] ? `Last login ${relativeToNow(lastLogin[u.id]!)}` : "Never signed in"}
                    </p>
                  )}
                </div>
                <Select
                  value={u.role}
                  onChange={(e) => {
                    const nextRole = e.target.value as Role;
                    // Promoting a viewer into a seat role would consume a seat — block at the cap.
                    if (consumesSeat(nextRole) && !consumesSeat(u.role) && seatsUsed >= seatLimit) {
                      toast(
                        `Your plan's ${seatLimit} contributor seats are all in use — free one up or keep this member a viewer.`,
                        "error",
                      );
                      return;
                    }
                    setUserRole(u.id, nextRole);
                    toast(`${u.name} is now ${ROLE_LABELS[nextRole]}`);
                  }}
                  className="h-8 text-xs"
                >
                  {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </Select>
                <label
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 text-xs",
                    can(u.role, "use-ai") && aiGovernance ? "text-muted" : "text-subtle opacity-50",
                  )}
                  title={
                    !aiGovernance
                      ? "Per-member AI control is part of the Team plan"
                      : can(u.role, "use-ai")
                        ? "Allow this member to use AI features"
                        : "Viewers don't get AI regardless"
                  }
                >
                  <input
                    type="checkbox"
                    checked={can(u.role, "use-ai") && u.aiEnabled !== false}
                    disabled={!can(u.role, "use-ai") || !aiGovernance}
                    onChange={(e) => {
                      updateUser(u.id, { aiEnabled: e.target.checked });
                      toast(`AI ${e.target.checked ? "enabled" : "disabled"} for ${u.name}`);
                    }}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  AI
                </label>
                <Button size="sm" variant="ghost" onClick={() => setEditing(u.id)} aria-label={`Edit ${u.name}`}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isSelf}
                  title={isSelf ? "You can't remove your own account" : `Remove ${u.name}`}
                  onClick={() => setRemoving(u.id)}
                  aria-label={`Remove ${u.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-danger" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
      <AddUserDialog open={showInvite} onClose={() => setShowInvite(false)} />
      {editingUser && (
        <EditUserDialog open={!!editing} onClose={() => setEditing(null)} user={editingUser} />
      )}
      {removingUser && (
        <ConfirmDialog
          open={!!removing}
          onClose={() => setRemoving(null)}
          title="Remove team member"
          danger
          body={
            <>
              <strong>{removingUser.name}</strong> loses access to this workspace and is removed from
              project teams. Their past contributions (interviews, insights) stay attributed to them.
            </>
          }
          confirmLabel="Remove member"
          onConfirm={() => {
            const ok = deleteUser(removingUser.id);
            toast(ok ? `${removingUser.name} removed from the workspace` : "You can't remove your own account", ok ? "info" : "error");
          }}
        />
      )}
    </>
  );
}

function PermissionsSection() {
  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Role permissions</h2>
      <p className="mb-4 text-[13px] text-subtle">
        These capabilities are enforced across every module, based on each member&apos;s role. Change roles in Team &amp; roles.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3 text-left align-bottom font-semibold text-subtle">Capability</th>
              {ROLE_ORDER.map((r) => (
                <th key={r} className="px-2 py-2 text-center align-bottom text-2xs font-semibold uppercase tracking-wide text-subtle">{ROLE_LABELS[r]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_ROWS.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-0">
                <td className="py-2 pr-3 text-foreground">{row.label}</td>
                {ROLE_ORDER.map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {CAPS[row.cap].includes(r) ? (
                      <Check className="mx-auto h-4 w-4 text-success" />
                    ) : (
                      <Minus className="mx-auto h-3.5 w-3.5 text-subtle/40" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/** API key input. Local mode keeps the key in the browser (via prefs); cloud
    mode stores it encrypted server-side and only ever reports whether one is set. */
function ApiKeyField({
  provider,
  config,
  hasEnvKey,
  cloudSaved,
  onChanged,
}: {
  provider: AiProvider;
  config: (typeof AI_PROVIDERS)[AiProvider];
  hasEnvKey: boolean;
  cloudSaved: boolean;
  onChanged: () => void;
}) {
  const backend = useApp((s) => s.backend);
  const prefs = useApp((s) => s.prefs);
  const setPref = useApp((s) => s.setPref);
  const toast = useApp((s) => s.toast);
  const keyPref = `ai.key.${provider}`;
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const providerName = config.label.split(" (")[0];

  // ---- Local mode: key lives only in this browser (original behaviour). ----
  if (backend !== "cloud") {
    const keyVal = String(prefs[keyPref] ?? "");
    return (
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>{config.label} API key</Label>
        <Input
          type="password"
          value={keyVal}
          autoComplete="off"
          spellCheck={false}
          placeholder={hasEnvKey ? "Using the server key — enter one to override" : config.keyHint}
          onChange={(e) => setPref(keyPref, e.target.value)}
          className="font-mono"
        />
        <div className="flex items-center gap-3">
          <a href={config.keyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> Get a key
          </a>
          {keyVal && (
            <button onClick={() => { setPref(keyPref, ""); toast("API key cleared", "info"); }} className="text-xs text-muted hover:text-danger">
              Clear key
            </button>
          )}
        </div>
        <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          This key is saved only on this device and used just to send your AI requests to {providerName} — it never
          becomes part of the shared workspace data. Teammates each add their own key, or leave this empty to use a
          shared key your administrator set up on the server.
        </p>
      </div>
    );
  }

  // ---- Cloud mode: encrypted per-user key, stored server-side. ----
  const submit = async (value: string) => {
    setBusy(true);
    try {
      await saveAiKey(provider, value);
      logAudit(value ? "set workspace AI key" : "cleared workspace AI key", config.label);
      toast(value ? "API key saved securely" : "API key cleared", value ? "success" : "info");
      setEditing(false);
      setDraft("");
      onChanged();
    } catch (e) {
      toast(e instanceof AiError ? e.message : "Couldn't save the key.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label>{config.label} API key</Label>
      {cloudSaved && !editing ? (
        <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-[13px]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
          <span className="text-foreground">Key saved</span>
          <span className="font-mono text-subtle">••••••••</span>
          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => { setEditing(true); setDraft(""); }} className="text-xs text-primary hover:underline">Replace</button>
            <button onClick={() => submit("")} disabled={busy} className="text-xs text-muted hover:text-danger">Clear</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            type="password"
            value={draft}
            autoComplete="off"
            spellCheck={false}
            placeholder={hasEnvKey ? "Using the server key — enter one to override" : config.keyHint}
            onChange={(e) => setDraft(e.target.value)}
            className="font-mono"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="primary" onClick={() => submit(draft.trim())} disabled={busy || !draft.trim()}>
              {busy ? "Saving…" : "Save key"}
            </Button>
            {cloudSaved && (
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setDraft(""); }} disabled={busy}>Cancel</Button>
            )}
            <a href={config.keyUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-xs text-primary hover:underline">
              <ExternalLink className="h-3 w-3" /> Get a key
            </a>
          </div>
        </div>
      )}
      <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
        One shared AI key for the whole workspace: stored safely in encrypted form, never shown again after saving, and
        used automatically by everyone you&apos;ve allowed to use AI. Only administrators can change it.
      </p>
    </div>
  );
}

const UsageStat = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border bg-surface-2 p-3">
    <p className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
    <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">{value}</p>
  </div>
);

function AiSection() {
  const role = useApp((s) => s.role);
  const backend = useApp((s) => s.backend);
  const account = useApp((s) => s.account);
  // Team plan: AI usage analytics (recording continues regardless).
  const aiGovernance = planHasFeature(account?.plan, "ai-governance");
  const prefs = useApp((s) => s.prefs);
  const setPref = useApp((s) => s.setPref);
  const toast = useApp((s) => s.toast);
  const [envStatus, setEnvStatus] = React.useState<Record<AiProvider, boolean> | null>(null);
  const [keyStatus, setKeyStatus] = React.useState<Record<AiProvider, boolean> | null>(null);
  const [usage, setUsage] = React.useState<{ inputTokens: number; outputTokens: number; requests: number } | null>(null);

  const recheck = React.useCallback(() => {
    setEnvStatus(null);
    aiEnvStatus().then(setEnvStatus);
    if (backend === "cloud") {
      aiKeyStatus().then(setKeyStatus);
      aiUsage().then(setUsage);
    }
  }, [backend]);
  React.useEffect(() => {
    recheck();
  }, [recheck]);

  // Gating happens in AdminGate: non-admins see this section read-only.
  const providerPref = prefs["ai.provider"];
  const provider: AiProvider =
    typeof providerPref === "string" && providerPref in AI_PROVIDERS
      ? (providerPref as AiProvider)
      : "anthropic";
  const config = AI_PROVIDERS[provider];
  const modelPref = `ai.model.${provider}`;
  const modelVal = String(prefs[modelPref] ?? config.models[0].id);
  const hasEnvKey = envStatus?.[provider] ?? false;
  const localKey = String(prefs[`ai.key.${provider}`] ?? "");
  const hasStoredKey = backend === "cloud" ? Boolean(keyStatus?.[provider]) : localKey.trim().length > 0;
  const connected = hasStoredKey || hasEnvKey;

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">AI provider</h2>
          <div className="flex items-center gap-2 text-[13px]">
            {connected ? (
              <><span className="h-2 w-2 rounded-full bg-success" /> <span className="text-foreground">Connected</span></>
            ) : (
              <><span className="h-2 w-2 rounded-full bg-warning" /> <span className="text-muted">Not configured</span></>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Provider</Label>
            <Select
              value={provider}
              onChange={(e) => {
                setPref("ai.provider", e.target.value);
                toast(`AI provider set to ${AI_PROVIDERS[e.target.value as AiProvider].label}`);
              }}
            >
              {(Object.keys(AI_PROVIDERS) as AiProvider[]).map((p) => (
                <option key={p} value={p}>{AI_PROVIDERS[p].label}</option>
              ))}
            </Select>
            <p className="text-xs text-subtle">Applies to the whole workspace — every member&apos;s AI features use this provider and its key.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Model</Label>
            <Select value={modelVal} onChange={(e) => setPref(modelPref, e.target.value)}>
              {config.models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </Select>
          </div>
          <ApiKeyField
            provider={provider}
            config={config}
            hasEnvKey={hasEnvKey}
            cloudSaved={backend === "cloud" ? Boolean(keyStatus?.[provider]) : false}
            onChanged={recheck}
          />
        </div>
      </Card>
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">Token usage</h2>
            {!aiGovernance && <Badge tone="primary">Team plan</Badge>}
          </div>
          {backend === "cloud" && aiGovernance && (
            <button
              onClick={() => aiUsage().then(setUsage)}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Refresh
            </button>
          )}
        </div>
        {!aiGovernance ? (
          <p className="text-[13px] text-muted">
            AI usage analytics are part of the <strong>Team</strong> plan. Usage is already being tracked, so the
            numbers are complete from day one if you upgrade.
          </p>
        ) : backend !== "cloud" ? (
          <p className="text-[13px] text-muted">Token usage is tracked in cloud mode.</p>
        ) : usage ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <UsageStat label="Total tokens" value={(usage.inputTokens + usage.outputTokens).toLocaleString()} />
              <UsageStat label="Input" value={usage.inputTokens.toLocaleString()} />
              <UsageStat label="Output" value={usage.outputTokens.toLocaleString()} />
              <UsageStat label="AI requests" value={usage.requests.toLocaleString()} />
            </div>
            <p className="mt-4 text-xs text-subtle">
              Reported by your provider across every AI call made on your key, cumulative since tracking began.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-subtle">Loading…</p>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Assisted features</h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Pref id="ai.summaries" label="Interview & executive summaries" />
          <Pref id="ai.suggestions" label="Suggested themes & tags" />
          <Pref id="ai.triage" label="Kanban lane suggestions" />
          <Pref id="ai.duplicates" label="Duplicate & similar detection" />
          <Pref id="ai.opportunities" label="Opportunity detection" />
          <Pref id="ai.sentiment" label="Sentiment analysis" />
          <Pref id="ai.gaps" label="Research gap analysis" />
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] text-subtle">Auto-transcribe uploads</span>
            <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-2xs font-medium text-subtle">Planned</span>
          </div>
          <Pref id="ai.redact" label="Redact PII before sending to AI" />
        </div>
        <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          Each toggle gates a real AI feature: <strong>summaries</strong> controls the &ldquo;Summarize with AI&rdquo;
          buttons; <strong>lane suggestions</strong> powers &ldquo;Suggest lanes&rdquo; on Kanban boards;{" "}
          <strong>duplicate &amp; similar</strong>, <strong>opportunity</strong>, and <strong>gap</strong>{" "}
          detection control which patterns the suggestions engine surfaces; <strong>sentiment analysis</strong> lets the
          summarizer set an interview&rsquo;s sentiment; and <strong>Redact PII</strong> strips emails and phone numbers
          before any text is sent to the model. Auto-transcribe needs an upload-transcription pipeline and is planned.
          AI always supports the researcher and never replaces human judgment; generated content is clearly labelled and
          editable.
        </p>
      </Card>
      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">How AI works &amp; your data</h2>
        <ul className="flex flex-col gap-2.5 text-[13px] text-muted">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span><strong className="font-medium text-foreground">Grounded, not trained.</strong> The model only sees a snapshot of the relevant repository data at request time. Your research is never used to train a model.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span><strong className="font-medium text-foreground">Runs on your key.</strong> AI uses the provider and key set above. In cloud mode the key stays server-side and is never sent from the browser.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span><strong className="font-medium text-foreground">PII is redacted.</strong> With <em>Redact PII</em> on, emails and phone numbers are stripped from the context before anything is sent to the model.</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span><strong className="font-medium text-foreground">You stay in control.</strong> Every feature can be switched off above, output is always editable, and viewer accounts have no AI access.</span>
          </li>
        </ul>
        <p className="mt-4 text-xs text-subtle">
          More detail:{" "}
          <a href="/blog/how-lens-uses-ai-in-ux-research" className="text-primary hover:underline" target="_blank" rel="noreferrer">
            How Lens uses AI in UX research
          </a>
          .
        </p>
      </Card>
    </div>
  );
}

/** A single color chip that opens a compact palette popover (closes on pick). */
function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(`accent-${value}`, "flex h-9 w-9 items-center justify-center rounded-lg border border-border transition hover:border-border-strong")}
        aria-label="Lane color"
        title="Lane color"
      >
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: "hsl(var(--a-solid))" }} />
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-1.5 grid animate-scale-in grid-cols-[repeat(7,1.5rem)] gap-1.5 rounded-lg border border-border bg-overlay p-2 shadow-popover">
          {LANE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => { onChange(c); setOpen(false); }}
              className={cn(
                `accent-${c}`,
                "flex h-6 w-6 items-center justify-center rounded-full ring-offset-1 ring-offset-overlay transition",
                value === c ? "ring-2 ring-[hsl(var(--a-solid))]" : "ring-1 ring-transparent hover:ring-border",
              )}
              style={{ backgroundColor: "hsl(var(--a-solid))" }}
              aria-label={`Color ${c}`}
              title={c}
            >
              {value === c && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Manage the shared Kanban workflow lanes for this workspace. */
function KanbanSection() {
  useDb();
  const role = useApp((s) => s.role);
  const stagesPref = useApp((s) => s.prefs[KANBAN_STAGES_PREF]);
  const setKanbanStages = useApp((s) => s.setKanbanStages);
  const deleteKanbanStage = useApp((s) => s.deleteKanbanStage);
  const account = useApp((s) => s.account);
  const toast = useApp((s) => s.toast);

  // Gating happens in AdminGate: non-admins see this section read-only.
  const stages = parseStages(stagesPref);

  // Plan gating: customizing the workflow lanes is a Team-plan feature —
  // Starter workspaces run the default research-to-product lanes.
  if (!planHasFeature(account?.plan, "custom-lanes")) {
    return (
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Kanban lanes</h2>
          <Badge tone="primary">Team plan</Badge>
        </div>
        <p className="mb-4 text-[13px] text-muted">
          Custom workflow lanes — rename, describe, recolor, reorder, add, and remove stages — are part of the{" "}
          <strong>Team</strong> plan. Your boards use the default research-to-product workflow below. Contact us to
          switch plans.
        </p>
        <div className="flex flex-col gap-1.5">
          {stages.map((stage) => (
            <div key={stage.id} className={cn(`accent-${stage.accent}`, "flex items-center gap-2.5 rounded-md border border-border px-3 py-2")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--a-solid))]" />
              <span className="text-[13px] font-medium text-foreground">{stage.title}</span>
              {stage.description && <span className="truncate text-xs text-subtle">— {stage.description}</span>}
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const update = (id: string, patch: Partial<KanbanColumn>) =>
    setKanbanStages(stages.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= stages.length) return;
    const next = stages.slice();
    [next[index], next[to]] = [next[to], next[index]];
    setKanbanStages(next);
  };
  const add = () => {
    setKanbanStages([...stages, { id: uid("c"), title: "New lane", accent: "slate" }]);
    toast("Lane added");
  };
  const remove = (stage: KanbanColumn) => {
    if (stages.length <= 1) return toast("Keep at least one lane.", "info");
    deleteKanbanStage(stage.id);
    toast(`Lane “${stage.title}” deleted`, "info");
  };
  const reset = () => {
    setKanbanStages(parseStages(undefined));
    toast("Lanes reset to defaults");
  };

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-foreground">Kanban lanes</h2>
          <button onClick={reset} className="text-[13px] font-medium text-primary hover:underline">Reset to defaults</button>
        </div>
        <p className="mb-4 text-[13px] text-muted">
          These lanes are the stages of your research-to-product workflow. They&rsquo;re shared across every Kanban board
          in this workspace, and each insight sits in exactly one lane. Rename, recolor, reorder, add, or remove stages to
          match how your team works.
        </p>
        <div className="flex flex-col gap-2">
          {stages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <ColorPicker value={stage.accent} onChange={(c) => update(stage.id, { accent: c })} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Input value={stage.title} onChange={(e) => update(stage.id, { title: e.target.value })} placeholder="Lane name" />
                <Input
                  value={stage.description ?? ""}
                  onChange={(e) => update(stage.id, { description: e.target.value || undefined })}
                  placeholder="Description (optional)"
                />
              </div>
              <div className="flex shrink-0 flex-col">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 text-subtle hover:bg-surface-hover hover:text-foreground disabled:opacity-30" aria-label="Move lane up">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === stages.length - 1} className="rounded p-1 text-subtle hover:bg-surface-hover hover:text-foreground disabled:opacity-30" aria-label="Move lane down">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => remove(stage)}
                disabled={stages.length <= 1}
                className="shrink-0 rounded p-1 text-subtle hover:bg-surface-hover hover:text-danger disabled:opacity-30"
                aria-label={`Delete ${stage.title}`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="secondary" size="sm" onClick={add}>
            <Plus className="h-4 w-4" /> Add lane
          </Button>
        </div>
        <p className="mt-4 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          Deleting a lane moves any insights and cards in it to the lane on its left. Changes apply to every board and to
          everyone in this workspace.
        </p>
      </Card>
    </div>
  );
}

/** Show/hide the optional tabs on every project detail page. */
function ProjectTabsSection() {
  const ROWS: { id: string; label: string; desc: string }[] = [
    { id: "tabs.affinity", label: "Affinity", desc: "Cluster observations into themes on a shared canvas." },
    { id: "tabs.kanban", label: "Kanban", desc: "Track follow-up work through a customizable workflow board." },
    { id: "tabs.ai", label: "AI Summary", desc: "Generate an executive summary of the project from its data." },
    { id: "tabs.reports", label: "Reports", desc: "Export the project and view its recent exports." },
  ];
  const role = useApp((s) => s.role);
  const backend = useApp((s) => s.backend);
  const isAdmin = can(role, "admin");
  const shared = backend === "cloud";
  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Project tabs</h2>
        <p className="mt-1 text-[13px] text-muted">
          Choose which optional tabs appear on every project. Overview, Participants, Interviews
          and Insights are always shown.{" "}
          {shared
            ? "This is a shared workspace setting — only admins can change it, and it applies to everyone."
            : "This preference is saved to this browser."}
        </p>
        <div className="mt-4 flex flex-col divide-y divide-border">
          {ROWS.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">{r.label}</p>
                <p className="text-xs text-subtle">{r.desc}</p>
              </div>
              <Pref id={r.id} label="" disabled={shared && !isAdmin} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function DataSection() {
  useDb();
  const role = useApp((s) => s.role);
  const backend = useApp((s) => s.backend);
  const demo = useApp((s) => s.demo);
  const resetDemoData = useApp((s) => s.resetDemoData);
  const logExport = useApp((s) => s.logExport);
  const toast = useApp((s) => s.toast);
  const anonymizeExports = useApp((s) => Boolean(s.prefs["gdpr.anonymizeExports"]));
  const [confirmReset, setConfirmReset] = React.useState(false);
  const [showClear, setShowClear] = React.useState(false);
  // Gating happens in AdminGate: non-admins see this section read-only.

  const doExport = (format: ExportFormat, label: string) => {
    const result = runExport(format, undefined, anonymizeExports);
    if (result === null) return toast("Pop-up blocked — allow pop-ups to export PDF", "error");
    logExport(`Full repository (${label})`, currentUser().name);
    toast(`${result} downloaded`);
  };

  return (
    <div className="flex flex-col gap-5">
      <CloudStatusCard />
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <DatabaseBackup className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Backups</h2>
        </div>
        <p className="mb-3 text-[13px] text-muted">
          {backend === "cloud"
            ? "Database backup and restore are handled by Supabase — automated backups and point-in-time recovery (if your plan includes them) are managed from your Supabase project dashboard, and that's where a restore is done. The snapshot below is a portable offline copy of all your data — the whole repository as one JSON file, for archiving or moving elsewhere (not a restore file)."
            : "This workspace runs on local browser data. Download a full snapshot to keep an offline copy of everything — the entire repository as a single JSON file you can archive or move elsewhere."}
        </p>
        <Button size="sm" variant="primary" onClick={() => doExport("json", "snapshot")}>
          <Download className="h-4 w-4" /> Download snapshot (JSON)
        </Button>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Data portability</h2>
        <p className="mb-3 text-[13px] text-muted">
          Your organization owns its research data — export it in the format you need, no vendor lock-in. The JSON
          snapshot above is a complete copy of the repository; the ZIP bundles that full graph with flat CSVs.
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            ["csv", "CSV"],
            ["excel", "Excel"],
            ["pdf", "PDF"],
            ["zip", "ZIP archive"],
          ] as [ExportFormat, string][]).map(([format, label]) => (
            <Button key={format} size="sm" variant="outline" onClick={() => doExport(format, label)}>
              <Download className="h-3.5 w-3.5" /> {label}
            </Button>
          ))}
        </div>
      </Card>

      {/* Demo-data tools are a LOCAL DEV convenience only. Hidden in the
          deployed (cloud) SaaS AND in the demo sandbox — there's no demo data
          to manage: the sandbox is the try-it path (just refresh to reset) and
          real accounts start empty. */}
      {backend !== "cloud" && !demo && (
        <Card className="border-danger/30 p-5">
          <h2 className="mb-1 text-sm font-semibold text-foreground">Demo data (local dev)</h2>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[13px] text-muted">
                <strong className="font-medium text-foreground">Start from scratch.</strong> Choose which demo
                content to remove — projects, participants, interviews, or insights. Your team, tags, themes,
                and personas are always kept.
              </p>
              <Button size="sm" variant="danger" onClick={() => setShowClear(true)}>
                <Eraser className="h-4 w-4" /> Remove demo data…
              </Button>
            </div>
            <div className="border-t border-border pt-4">
              <p className="mb-2 text-[13px] text-muted">
                <strong className="font-medium text-foreground">Reset to demo.</strong> Restore the original
                seeded example data. Everything you created or changed in this browser is discarded.
              </p>
              <Button size="sm" variant="outline" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="h-4 w-4" /> Reset demo data
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ClearDataDialog open={showClear} onClose={() => setShowClear(false)} />
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data"
        danger
        body="All participants, projects, interviews, insights, boards, and settings return to the original demo state. This cannot be undone."
        confirmLabel="Reset everything"
        onConfirm={() => {
          resetDemoData();
          toast("Demo data reset to the original seed", "info");
        }}
      />
    </div>
  );
}

/** Connection status for the Supabase cloud database (phase 1). */
function CloudStatusCard() {
  const backend = useApp((s) => s.backend);
  const account = useApp((s) => s.account);
  const [state, setState] = React.useState<
    | { kind: "unconfigured" }
    | { kind: "checking" }
    | { kind: "unreachable"; detail: string }
    | { kind: "schema-missing" }
    | { kind: "ready"; counts: Record<string, number> }
  >({ kind: "checking" });

  const check = React.useCallback(async () => {
    setState({ kind: "checking" });
    const { supabase, isSupabaseConfigured } = await import("@/lib/supabase");
    if (!isSupabaseConfigured || !supabase) return setState({ kind: "unconfigured" });
    try {
      const { data, error } = await supabase.rpc("setup_status");
      if (error) {
        // PGRST202 = function not found → schema.sql hasn't been run yet.
        if (error.code === "PGRST202" || /function|schema cache/i.test(error.message)) {
          return setState({ kind: "schema-missing" });
        }
        return setState({ kind: "unreachable", detail: error.message });
      }
      setState({ kind: "ready", counts: data as Record<string, number> });
    } catch (e) {
      setState({ kind: "unreachable", detail: e instanceof Error ? e.message : "Network error" });
    }
  }, []);

  React.useEffect(() => {
    check();
  }, [check]);

  const dot = (color: string) => <span className={cn("h-2 w-2 shrink-0 rounded-full", color)} />;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Cloud database
            <Badge tone="info">Supabase</Badge>
            {account && <Badge tone="primary">{account.name} · {account.plan}</Badge>}
          </h2>
          <div className="mt-1.5 flex items-center gap-2 text-[13px] text-muted">
            {state.kind === "checking" && (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
                Checking connection…
              </>
            )}
            {state.kind === "unconfigured" && (
              <>{dot("bg-subtle")} Not configured — add Supabase keys to <code className="font-mono text-xs">.env.local</code>.</>
            )}
            {state.kind === "unreachable" && (
              <>{dot("bg-danger")} Unreachable: {state.detail}</>
            )}
            {state.kind === "schema-missing" && (
              <>
                {dot("bg-warning")} Connected — schema not installed yet. Run{" "}
                <code className="font-mono text-xs">supabase/schema.sql</code> then{" "}
                <code className="font-mono text-xs">seed.sql</code> in the Supabase SQL Editor.
              </>
            )}
            {state.kind === "ready" && (
              <>
                {dot("bg-success")}
                {state.counts.participants > 0
                  ? `Connected — ${state.counts.participants} participants, ${state.counts.projects} projects, ${state.counts.interviews} interviews, ${state.counts.insights} insights in the cloud.`
                  : "Connected — schema installed, no data yet. Run seed.sql to load the demo data."}
              </>
            )}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={check}>Recheck</Button>
      </div>
      <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
        {backend === "cloud"
          ? "Live — you're signed in with Supabase Auth, and every change reads and writes this project. Data is shared across browsers and teammates."
          : "Not signed in through Supabase — the app is using local browser data. Sign in to work against the cloud."}
      </p>
    </Card>
  );
}

/** Per-content-type demo data removal, with counts and cascade notes. */
function ClearDataDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDb();
  const clearDataTypes = useApp((s) => s.clearDataTypes);
  const toast = useApp((s) => s.toast);
  const [sel, setSel] = React.useState({
    projects: true,
    participants: true,
    interviews: true,
    insights: true,
  });

  React.useEffect(() => {
    if (open) setSel({ projects: true, participants: true, interviews: true, insights: true });
  }, [open]);

  const companiesCount = [...new Set(participants.map((p) => p.companyId))].length;
  const rows: {
    key: keyof typeof sel;
    label: string;
    count: number;
    note: string;
  }[] = [
    {
      key: "projects",
      label: `Research projects (${projectsDb.length})`,
      count: projectsDb.length,
      note: "Project boards are removed with their projects.",
    },
    {
      key: "participants",
      label: `Participants & companies (${participants.length} + ${companiesCount})`,
      count: participants.length,
      note: "Their interviews and affinity notes are removed too.",
    },
    {
      key: "interviews",
      label: `Interviews (${interviewsDb.length})`,
      count: interviewsDb.length,
      note: "Transcript highlights are cleared with their interviews.",
    },
    {
      key: "insights",
      label: `Insights (${insightsDb.length})`,
      count: insightsDb.length,
      note: "Kanban cards linked to removed insights are dropped.",
    },
  ];

  const anySelected = rows.some((r) => sel[r.key] && r.count > 0);
  const allSelected = rows.every((r) => sel[r.key]);

  const run = () => {
    const removed = rows.filter((r) => sel[r.key] && r.count > 0).map((r) => r.label.split(" (")[0].toLowerCase());
    clearDataTypes(sel);
    toast(
      removed.length === 4
        ? "Repository cleared — you're starting from scratch"
        : `Removed ${removed.join(", ")}`,
      "info",
    );
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Remove demo data"
      description="Pick what to remove. Team members, tags, themes, and personas are always kept."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" disabled={!anySelected} onClick={run}>
            <Eraser className="h-4 w-4" /> Remove selected
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-hover">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) =>
              setSel({
                projects: e.target.checked,
                participants: e.target.checked,
                interviews: e.target.checked,
                insights: e.target.checked,
              })
            }
            className="h-4 w-4 accent-[hsl(var(--danger))]"
          />
          Everything — start completely from scratch
        </label>
        {rows.map((r) => (
          <label
            key={r.key}
            className={cn(
              "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors",
              sel[r.key] ? "border-danger/40 bg-danger-soft/30" : "border-border hover:bg-surface-hover",
              r.count === 0 && "opacity-50",
            )}
          >
            <input
              type="checkbox"
              checked={sel[r.key]}
              disabled={r.count === 0}
              onChange={(e) => setSel((s) => ({ ...s, [r.key]: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-[hsl(var(--danger))]"
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-medium text-foreground">{r.label}</span>
              <span className="block text-xs text-subtle">{r.count === 0 ? "Nothing to remove." : r.note}</span>
            </span>
          </label>
        ))}
        <p className="mt-1 text-xs text-subtle">
          Removal keeps the remaining data consistent — cross-references to removed records are cleaned up.
          This cannot be undone (Reset demo data restores the examples).
        </p>
      </div>
    </Modal>
  );
}

function ConsentSection() {
  useDb();
  const role = useApp((s) => s.role);
  const anonymizeParticipant = useApp((s) => s.anonymizeParticipant);
  const deleteParticipant = useApp((s) => s.deleteParticipant);
  const toast = useApp((s) => s.toast);
  const [dsrOpen, setDsrOpen] = React.useState(false);
  const [dsrParticipant, setDsrParticipant] = React.useState(participants[0]?.id ?? "");
  const [dsrAction, setDsrAction] = React.useState<"export" | "anonymize" | "delete">("export");
  const isAdmin = can(role, "admin");

  const counts = participants.reduce(
    (acc, p) => {
      acc[p.consentStatus] = (acc[p.consentStatus] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const runDsr = () => {
    const p = participants.find((x) => x.id === dsrParticipant);
    if (!p) return;
    if (dsrAction === "export") {
      downloadText(
        stamp(`dsr-${p.firstName.toLowerCase()}-${p.lastName.toLowerCase()}`, "json"),
        JSON.stringify({ participant: p, consent: consentFor(p.id) }, null, 2),
        "application/json",
      );
      toast(`Personal data for ${fullName(p)} exported`);
    } else if (dsrAction === "anonymize") {
      anonymizeParticipant(p.id);
      toast(`${fullName(p)} anonymized`);
    } else {
      deleteParticipant(p.id);
      toast(`${fullName(p)} and all their data deleted`, "info");
    }
    setDsrOpen(false);
  };

  const dataRows: { label: string; value: string }[] = [
    { label: "Hosting", value: "EU region — Supabase on AWS. Data stays in the EU." },
    { label: "Encryption", value: "At rest (AES-256) and in transit (TLS)." },
    { label: "Isolation", value: "Each account's data is sealed off by row-level security." },
    { label: "Data processor", value: "Supabase (EU), under a Data Processing Agreement." },
    { label: "Infrastructure", value: "SOC 2 Type II (Supabase) · ISO 27001 (AWS)." },
    { label: "Your controls", value: "Consent, anonymization, export & erasure, role-based access." },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted" />
          <h2 className="text-sm font-semibold text-foreground">Data protection</h2>
        </div>
        <dl className="flex flex-col divide-y divide-border">
          {dataRows.map((r) => (
            <div key={r.label} className="grid grid-cols-1 gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-4">
              <dt className="text-[13px] font-medium text-foreground">{r.label}</dt>
              <dd className="text-[13px] text-muted">{r.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
          Personal data is minimized (only essentials collected at creation) and every field is editable or
          erasable. Manage consent, retention, and data-subject requests below.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Consent overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Granted", value: counts.granted ?? 0, tone: "success" as const },
            { label: "Pending", value: counts.pending ?? 0, tone: "warning" as const },
            { label: "Expired", value: counts.expired ?? 0, tone: "danger" as const },
            { label: "Withdrawn", value: counts.withdrawn ?? 0, tone: "neutral" as const },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border p-3">
              <p className="text-2xl font-semibold text-foreground">{s.value}</p>
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">GDPR controls</h2>
        <div className="flex flex-col gap-3.5">
          <Pref id="gdpr.requireConsent" label="Require explicit consent before interviews" disabled={!isAdmin} />
          <Pref id="gdpr.anonymizeExports" label="Anonymize participant data in exports by default" disabled={!isAdmin} />
          {["Enforce data retention policy (24 months)", "Auto-delete expired-consent recordings"].map((label) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-[13px] text-muted">{label}</span>
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-2xs font-medium text-subtle">Planned</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-2xs text-subtle">
          Retention and auto-delete need scheduled server-side enforcement — planned, not yet active.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => { setDsrAction("export"); setDsrOpen(true); }}>
            <FileSearch className="h-4 w-4" /> Handle data subject request
          </Button>
          <Button size="sm" variant="outline" disabled={!isAdmin} onClick={() => { setDsrAction("anonymize"); setDsrOpen(true); }}>
            <UserX className="h-4 w-4" /> Anonymize participant
          </Button>
        </div>
        {!isAdmin && (
          <p className="mt-3 text-xs text-subtle">Only administrators can change GDPR controls.</p>
        )}
      </Card>

      <Modal
        open={dsrOpen}
        onClose={() => setDsrOpen(false)}
        title="Data subject request"
        description="Fulfil a GDPR request for a specific participant."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDsrOpen(false)}>Cancel</Button>
            <Button variant={dsrAction === "delete" ? "danger" : "primary"} onClick={runDsr}>
              {dsrAction === "export" ? "Export their data" : dsrAction === "anonymize" ? "Anonymize" : "Delete everything"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Label>Participant</Label>
            <Select value={dsrParticipant} onChange={(e) => setDsrParticipant(e.target.value)}>
              {participants.map((p) => <option key={p.id} value={p.id}>{fullName(p)}</option>)}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Request type</Label>
            {([
              ["export", "Right of access — export their personal data (JSON)"],
              ["anonymize", "Anonymize — remove direct identifiers, keep de-identified research (irreversible)"],
              ["delete", "Right to erasure — delete participant and all linked data"],
            ] as const).map(([value, label]) => (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                <input
                  type="radio"
                  name="dsr"
                  checked={dsrAction === value}
                  onChange={() => setDsrAction(value)}
                  className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                />
                {label}
              </label>
            ))}
          </div>
          <p className="text-2xs text-subtle">
            Anonymize and delete can&apos;t be undone. Anonymize clears name, email, phone and notes — but not quotes
            or transcript text, so use delete for a full right-to-erasure.
          </p>
        </div>
      </Modal>
    </div>
  );
}

const APP_VERSION = "1.0.0";
const RELEASE_DATE = "2026-07-03";
// Stamped at build time by next.config.mjs — changes with every deploy.
// Commit may be empty when the build host exposes neither env vars nor .git;
// the timestamp alone still uniquely identifies the build.
const BUILD_COMMIT = process.env.NEXT_PUBLIC_BUILD_COMMIT || "";
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME;
const TECH_STACK = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS"];

function AboutRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-0">
      <dt className="text-[13px] text-subtle">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

function AboutSection() {
  const backend = useApp((s) => s.backend);
  // Runtime fallback: if the build-time commit came out empty (host exposed
  // neither a commit env var nor .git at build), the running container may
  // still have it — /api/version reads it at request time.
  const [runtimeCommit, setRuntimeCommit] = React.useState("");
  React.useEffect(() => {
    if (BUILD_COMMIT) return;
    fetch("/api/version")
      .then((r) => r.json())
      .then((j) => setRuntimeCommit(j.commit || ""))
      .catch(() => {});
  }, []);
  const commit = BUILD_COMMIT || runtimeCommit;

  return (
    <div className="flex flex-col gap-5">
      {/* Hero */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col items-center gap-3 bg-primary-soft/40 px-6 py-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-sm">
            <Telescope className="h-8 w-8" />
          </span>
          <div>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Lens</h2>
              <Badge tone="primary">v{APP_VERSION}</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">UX Research Repository &amp; Participant Management</p>
          </div>
          <p className="max-w-md text-[13px] leading-relaxed text-subtle">
            A single source of truth for customer research — participants, interviews, insights, and the
            evidence that connects them.
          </p>
        </div>
      </Card>

      {/* Details */}
      <Card className="p-5">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Details</h3>
        <dl className="flex flex-col">
          <AboutRow label="Version">{APP_VERSION}</AboutRow>
          <AboutRow label="Build">
            {commit && <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">{commit}</code>}
            {BUILD_TIME ? (
              <span className={commit ? "ml-2 text-muted" : undefined}>
                {new Date(BUILD_TIME).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </span>
            ) : (
              !commit && "—"
            )}
          </AboutRow>
          <AboutRow label="Released">{formatDate(RELEASE_DATE)}</AboutRow>
          <AboutRow label="Created by">Erik Niemeijer</AboutRow>
          <AboutRow label="Environment">
            <Badge tone={backend === "cloud" ? "success" : "neutral"}>
              {backend === "cloud" ? "Cloud · Supabase" : "Local prototype"}
            </Badge>
          </AboutRow>
        </dl>
      </Card>

      {/* Tech stack */}
      <Card className="p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Cpu className="h-4 w-4 text-muted" /> Built with
        </h3>
        <div className="flex flex-wrap gap-1.5">
          {TECH_STACK.map((t) => (
            <span key={t} className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">
              {t}
            </span>
          ))}
        </div>
      </Card>

      <p className="px-1 text-center text-xs text-subtle">
        © {RELEASE_DATE.slice(0, 4)} Erik Niemeijer · Lens
      </p>
    </div>
  );
}

const AUDIT_PAGE = 50;

/** The controlled vocabulary of logged actions (from the logAudit call sites). */
const AUDIT_ACTIONS = [
  "exported data",
  "deleted participant (erasure)",
  "updated consent",
  "added team member",
  "removed team member",
  "changed role",
  "changed AI access",
  "set workspace AI key",
  "cleared workspace AI key",
  "changed GDPR policy",
  "cleared data",
];

function AuditSection() {
  // Cloud: real append-only events from public.audit_events (admin-read via
  // RLS), paged 50 at a time with server-side search + action filtering.
  // Local/demo: the seeded sample rows.
  const backend = useApp((s) => s.backend);
  const role = useApp((s) => s.role);
  const account = useApp((s) => s.account);
  const [events, setEvents] = React.useState<AuditEvent[] | null>(null);
  const [hasMore, setHasMore] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [action, setAction] = React.useState("all");

  const filters = React.useCallback(
    () => ({ search: query.trim() || undefined, action: action === "all" ? undefined : action }),
    [query, action],
  );

  const load = React.useCallback(() => {
    if (backend !== "cloud") return;
    setEvents(null);
    setHasMore(false);
    fetchAuditEvents({ limit: AUDIT_PAGE, ...filters() }).then((page) => {
      setEvents(page);
      setHasMore(page.length === AUDIT_PAGE);
    });
  }, [backend, filters]);

  // Reload when filters change — debounced while typing, instant otherwise.
  React.useEffect(() => {
    const t = setTimeout(load, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  // Keyset pagination: fetch the page before the oldest loaded entry,
  // with the same filters applied.
  const loadMore = async () => {
    if (!events?.length || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await fetchAuditEvents({ limit: AUDIT_PAGE, before: events[events.length - 1].createdAt, ...filters() });
      setEvents((prev) => [...(prev ?? []), ...more]);
      setHasMore(more.length === AUDIT_PAGE);
    } finally {
      setLoadingMore(false);
    }
  };
  const filtering = query.trim() !== "" || action !== "all";

  // Plan gating: the audit log is a Team-plan feature. Events are recorded
  // regardless — so history is complete from day one on upgrade — only the
  // viewing is gated here.
  if (backend === "cloud" && !planHasFeature(account?.plan, "audit-log")) {
    return (
      <Card className="p-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Audit log</h2>
          <Badge tone="primary">Team plan</Badge>
        </div>
        <p className="text-[13px] text-muted">
          The append-only audit trail — exports, participant erasure, consent changes, team, role, AI-key, and GDPR
          policy changes — is part of the <strong>Team</strong> plan. Your workspace is already recording these events,
          so the history is complete from day one if you upgrade. Contact us to switch plans.
        </p>
      </Card>
    );
  }

  // The audit trail itself is admin-only at the database level (RLS), so a
  // read-only list would just be misleadingly empty — explain instead.
  if (!can(role, "admin")) {
    return (
      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Audit log</h2>
        <p className="text-[13px] text-muted">
          This workspace keeps an append-only audit trail of security- and privacy-relevant actions — exports,
          participant erasure, consent changes, team and role changes, AI key and GDPR policy changes. The entries
          themselves are only visible to administrators.
        </p>
      </Card>
    );
  }

  const csvEscape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const downloadCsv = () => {
    const rows = [
      ["timestamp", "actor", "action", "target", "detail"],
      ...(events ?? []).map((e) => [e.createdAt, e.actorName, e.action, e.target, e.detail]),
    ];
    downloadText(stamp("lens-audit-log", "csv"), rows.map((r) => r.map(csvEscape).join(",")).join("\n"), "text/csv");
  };

  if (backend !== "cloud") {
    return (
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Audit log</h2>
          <Badge tone="warning">Sample data</Badge>
        </div>
        <p className="mb-3 text-[13px] text-muted">
          In cloud mode this shows the workspace&rsquo;s real, append-only audit trail. The rows below are sample data
          from the demo dataset.
        </p>
        <div className="flex flex-col">
          {auditLogs.map((log) => {
            const actor = getUser(log.actorId);
            return (
              <div key={log.id} className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0">
                {actor && <Avatar name={actor.name} accent={actor.avatarColor} size="xs" />}
                <span className="text-foreground">
                  <strong className="font-medium">{actor?.name}</strong> {log.action}{" "}
                  <span className="text-muted">{log.entityLabel}</span>
                </span>
                <span className="ml-auto shrink-0 text-xs text-subtle">{formatDate(log.date)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">Audit log</h2>
        <div className="flex items-center gap-3">
          {events && events.length > 0 && (
            <button onClick={downloadCsv} className="text-[13px] font-medium text-primary hover:underline">
              Download CSV
            </button>
          )}
          <button onClick={load} className="text-[13px] font-medium text-primary hover:underline">Refresh</button>
        </div>
      </div>
      <p className="mb-3 text-[13px] text-muted">
        Security- and privacy-relevant actions — exports, participant erasure, consent changes, team and role changes,
        AI key and GDPR policy changes. Entries are append-only and can&rsquo;t be edited or deleted.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actor, action, target…"
            className="pl-8"
          />
        </div>
        <Select value={action} onChange={(e) => setAction(e.target.value)}>
          <option value="all">All actions</option>
          {AUDIT_ACTIONS.map((a) => (
            <option key={a} value={a}>{a[0].toUpperCase() + a.slice(1)}</option>
          ))}
        </Select>
      </div>
      {events === null ? (
        <p className="py-8 text-center text-[13px] text-subtle">Loading…</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-subtle">
            <ScrollText className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-foreground">{filtering ? "No entries match" : "No audit entries yet"}</p>
          <p className="max-w-sm text-[13px] text-muted">
            {filtering
              ? "Try a different search term or action — the filter spans the entire log, not just recent entries."
              : "Events appear here as they happen. If the log stays empty after actions, run the audit-events migration in Supabase."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col">
            {events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-border py-2.5 text-[13px] last:border-0">
                <Avatar name={e.actorName || "?"} size="xs" />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  <strong className="font-medium">{e.actorName}</strong> {e.action}
                  {e.target && <span className="text-muted"> · {e.target}</span>}
                  {e.detail && <span className="text-subtle"> ({e.detail})</span>}
                </span>
                <span className="ml-auto shrink-0 tabular-nums text-xs text-subtle" title={e.createdAt}>
                  {formatDate(e.createdAt)} ·{" "}
                  {new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
