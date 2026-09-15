"use client";

import * as React from "react";
import type { Role } from "@/lib/types";
import { users, DEFAULT_PASSWORD } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";
import { ROLE_LABELS, ROLE_ORDER, effectiveSeatLimit, consumesSeat } from "@/lib/permissions";
import { uid, accentFor } from "@/lib/utils";

/**
 * Admin-only: create a team member's account directly — no invitation email.
 * Cloud mode calls the server route (Supabase Admin API, pre-confirmed email);
 * local mode simply adds the account to the browser workspace.
 */
export function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const backend = useApp((s) => s.backend);
  const account = useApp((s) => s.account);
  const addUser = useApp((s) => s.addUser);
  const toast = useApp((s) => s.toast);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [jobTitle, setJobTitle] = React.useState("");
  const [role, setRole] = React.useState<Role>("researcher");
  const [password, setPassword] = React.useState(DEFAULT_PASSWORD);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setName("");
      setEmail("");
      setJobTitle("");
      setRole("researcher");
      setPassword(DEFAULT_PASSWORD);
      setBusy(false);
      setError("");
    }
  }, [open]);

  const submit = async () => {
    setError("");
    if (!name.trim()) return setError("Name is required.");
    const mail = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return setError("A valid email is required.");
    if (users.some((u) => u.email.toLowerCase() === mail))
      return setError("A team member with this email already exists.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    // Seat limit — every non-viewer role consumes a billable seat; viewers are free.
    // Only bites on plans with a cap (cloud); local/demo has no account/plan.
    const seatLimit = effectiveSeatLimit(account?.plan, account?.seatLimit);
    if (consumesSeat(role) && seatLimit !== Infinity) {
      const used = users.filter((u) => consumesSeat(u.role)).length;
      if (used >= seatLimit)
        return setError(
          `Your ${seatLimit} contributor seats are all in use. Viewers are free and unlimited — or contact us to add seats.`,
        );
    }

    const user = {
      id: uid("u"),
      name: name.trim(),
      email: mail,
      role,
      jobTitle: jobTitle.trim() || ROLE_LABELS[role],
      avatarColor: accentFor(name),
    };

    if (backend === "cloud") {
      setBusy(true);
      try {
        const { supabase } = await import("@/lib/supabase");
        const { data } = (await supabase?.auth.getSession()) ?? {};
        const token = data?.session?.access_token;
        if (!token) return setError("Your session expired — sign in again.");
        const res = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...user, password }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as { error?: string } | null;
          return setError(payload?.error ?? `Could not create the account (HTTP ${res.status}).`);
        }
        // The route wrote the profile; this keeps the in-memory cache in step.
        addUser(user);
        toast(`${user.name} added — they can sign in right away`);
        onClose();
      } catch {
        setError("Could not reach the server — try again.");
      } finally {
        setBusy(false);
      }
    } else {
      addUser({
        ...user,
        password: password === DEFAULT_PASSWORD ? undefined : password,
        mustChangePassword: true, // offer a password change on their first sign-in
      });
      toast(`${user.name} added — they can sign in with the password you set`);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add team member"
      description="Creates the account directly — no invitation email is sent. Share the password with them yourself; they can change it under Settings → My account."
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Add user"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>Name *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Email *</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Job title</Label>
          <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Role</Label>
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </Select>
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>Initial password *</Label>
          <Input value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-subtle">At least 8 characters. The new member signs in with this immediately.</p>
        </div>
      </div>
    </Modal>
  );
}
