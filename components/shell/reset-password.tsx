"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";
import { useApp } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { currentUserId } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

function PasswordCard({
  title,
  description,
  submitLabel,
  onSave,
  onSkip,
}: {
  title: string;
  description: string;
  submitLabel: string;
  onSave: (password: string) => Promise<string | null>; // returns an error message or null
  onSkip?: () => void;
}) {
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    if (next.length < 8) return setError("The new password must be at least 8 characters.");
    if (next !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    try {
      const err = await onSave(next);
      if (err) setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-10">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-lg">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-sm">
          <KeyRound className="h-7 w-7" />
        </span>
        <h1 className="text-center text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-1 text-center text-[13px] text-muted">{description}</p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="reset-new">New password</Label>
            <Input
              id="reset-new"
              type="password"
              autoFocus
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="reset-confirm">Confirm new password</Label>
            <Input
              id="reset-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
          )}

          <Button type="submit" variant="primary" className="mt-1 w-full" disabled={busy}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </form>

        {onSkip && (
          <p className="mt-3 text-center text-xs text-muted">
            <button onClick={onSkip} className="font-medium text-primary hover:underline">
              Skip for now
            </button>{" "}
            — we&apos;ll ask again next time you sign in.
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Shown when the user lands here from a "reset password" email link — the
 * recovery session is already signed in; they just set the new password.
 */
export function ResetPasswordScreen() {
  const setRecovery = useApp((s) => s.setRecovery);
  const toast = useApp((s) => s.toast);

  return (
    <PasswordCard
      title="Set a new password"
      description="Choose a new password for your account to finish signing in."
      submitLabel="Set password & continue"
      onSave={async (password) => {
        try {
          const { error } = await supabase!.auth.updateUser({
            password,
            data: { must_change_password: false },
          });
          if (error) return error.message;
          setRecovery(false);
          toast("Password updated — you're signed in");
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : "Something went wrong.";
        }
      }}
    />
  );
}

/**
 * First sign-in on an admin-created account: the password is a temporary one
 * the admin knows, so offer to replace it right away. Skippable — the offer
 * returns on the next sign-in until the password is actually changed.
 */
export function FirstLoginScreen() {
  const backend = useApp((s) => s.backend);
  const setFirstLogin = useApp((s) => s.setFirstLogin);
  const updateUser = useApp((s) => s.updateUser);
  const toast = useApp((s) => s.toast);

  return (
    <PasswordCard
      title="Welcome to Lens"
      description="Your account was set up with a temporary password. Choose your own to keep the account private."
      submitLabel="Set my password"
      onSkip={() => setFirstLogin(false)}
      onSave={async (password) => {
        try {
          if (backend === "cloud") {
            const { error } = await supabase!.auth.updateUser({
              password,
              data: { must_change_password: false },
            });
            if (error) return error.message;
          } else {
            updateUser(currentUserId, { password, mustChangePassword: false });
          }
          setFirstLogin(false);
          toast("Password set — welcome aboard!");
          return null;
        } catch (e) {
          return e instanceof Error ? e.message : "Something went wrong.";
        }
      }}
    />
  );
}
