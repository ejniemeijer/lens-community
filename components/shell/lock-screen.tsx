"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Telescope, LogIn, Eye, EyeOff, MailQuestion, ArrowLeft, Compass } from "lucide-react";
import { useApp, useDb } from "@/lib/store";
import { users, DEFAULT_PASSWORD } from "@/lib/db";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isCloud } from "@/lib/edition";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";

/**
 * Cinematic looping video behind the login card. The file lives at
 * public/login-bg.mp4 — when it's absent (or the visitor prefers reduced
 * motion) the plain canvas background is kept, so the video is purely
 * progressive enhancement. A dark overlay keeps the card readable.
 */
function LoginBackdrop() {
  const [ready, setReady] = React.useState(false);
  const [disabled, setDisabled] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setDisabled(true);
        return;
      }
    } catch {}
    // Don't rely on events or the autoplay attribute alone — they're racy
    // across hydration timing and autoplay policies. Poll briefly: reveal as
    // soon as the video is decodable, and keep nudging play(). If a browser
    // still refuses, the revealed first frame is a fine static backdrop.
    const v = videoRef.current;
    if (!v) return;
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
      if (v.readyState >= 3) {
        setReady(true);
        if (v.paused) void v.play().catch(() => {});
        else clearInterval(timer);
      }
      if (ticks > 40) clearInterval(timer); // give up quietly after ~12s
    }, 300);
    void v.play().catch(() => {});
    // Browsers pause hidden-tab videos and don't always resume them — nudge
    // playback again whenever the tab becomes visible.
    const onVisible = () => {
      if (!document.hidden && v.paused) void v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (disabled) return null;
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden transition-opacity duration-1000 ${ready ? "opacity-100" : "opacity-0"}`}>
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src="/login-bg.mp4"
        autoPlay
        muted
        loop
        playsInline
        onError={() => setDisabled(true)}
      />
      {/* Readability scrim — darkens and slightly desaturates the footage. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/65" />
    </div>
  );
}

export function LockScreen() {
  useDb();
  const router = useRouter();
  const cloud = isSupabaseConfigured && !!supabase;
  const signInAs = useApp((s) => s.signInAs);
  const setFirstLogin = useApp((s) => s.setFirstLogin);
  const enterDemo = useApp((s) => s.enterDemo);
  const toast = useApp((s) => s.toast);

  const startDemo = () => {
    // Fire-and-forget demo-visit count (cloud only; route no-ops otherwise).
    if (isCloud) {
      fetch("/api/demo-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrer: document.referrer || null }),
      }).catch(() => {});
    }
    enterDemo();
    toast("Welcome to the demo — changes stay in this tab and are never saved");
    router.push("/dashboard");
  };

  const [mode, setMode] = React.useState<"signin" | "forgot">("signin");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  const switchMode = (m: "signin" | "forgot") => {
    setMode(m);
    setError("");
    setNotice("");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setNotice("");
    const trimmed = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return setError("Enter a valid email address.");

    // ---- Forgot password: send the reset link (accounts stay admin-created) ----
    if (mode === "forgot") {
      setBusy(true);
      try {
        const { error: err } = await supabase!.auth.resetPasswordForEmail(trimmed, {
          redirectTo: window.location.origin,
        });
        if (err) setError(err.message);
        else setNotice(`If an account exists for ${trimmed}, a reset link is on its way — check your inbox.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setBusy(false);
      }
      return;
    }

    if (password.length < 6) return setError("Enter a password (at least 6 characters).");

    // ---- Local prototype mode (no Supabase configured) ----
    if (!cloud) {
      const user = users.find((u) => u.email.toLowerCase() === trimmed);
      if (!user) return setError("No account found for this email. Ask an administrator to add you.");
      if (password !== (user.password ?? DEFAULT_PASSWORD)) return setError("Incorrect password.");
      signInAs(user.id);
      if (user.mustChangePassword) setFirstLogin(true);
      toast(`Welcome back, ${user.name.split(" ")[0]}`);
      router.push("/dashboard"); // always land on the dashboard after login
      return;
    }

    // ---- Supabase auth ----
    setBusy(true);
    try {
      const { error: err } = await supabase!.auth.signInWithPassword({ email: trimmed, password });
      if (err) {
        setError(
          /confirm/i.test(err.message)
            ? "Please confirm your email first (check your inbox)."
            : "Incorrect email or password.",
        );
      } else {
        // Success → auth listener loads the workspace; always land on the dashboard.
        router.push("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-10">
      <LoginBackdrop />
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-surface p-7 shadow-lg">
        <Link
          href="/"
          aria-label="Back to the Lens homepage"
          title="Back to the Lens homepage"
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-fg shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Telescope className="h-7 w-7" />
        </Link>
        <h1 className="text-center text-lg font-semibold text-foreground">
          {mode === "forgot" ? "Reset your password" : "Sign in to Lens"}
        </h1>
        <p className="mt-1 text-center text-[13px] text-muted">
          {mode === "forgot"
            ? "We'll email you a link to set a new password."
            : "Your team's research repository."}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          {mode === "signin" && (
            <div className="flex flex-col gap-1">
              <Label htmlFor="login-password">Password</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-subtle hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
          )}
          {notice && (
            <p className="rounded-md bg-info-soft px-3 py-2 text-xs text-info">{notice}</p>
          )}

          <Button type="submit" variant="primary" className="mt-1 w-full" disabled={busy}>
            {mode === "forgot" ? <MailQuestion className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : "Sign in"}
          </Button>
        </form>

        {cloud && mode === "signin" && (
          <>
            <p className="mt-3 text-center text-xs text-muted">
              <button onClick={() => switchMode("forgot")} className="font-medium text-primary hover:underline">
                Forgot password?
              </button>
            </p>
            <div className="mt-5 border-t border-border pt-4">
              <Button
                variant="outline"
                className="w-full border-primary/35 bg-primary-soft text-primary hover:border-primary/50 hover:bg-primary-soft/70"
                onClick={startDemo}
              >
                <Compass className="h-4 w-4" /> Explore the demo
              </Button>
              <p className="mt-2 text-center text-xs text-subtle">
                A sandbox with sample data — no account needed, nothing is saved or synced.
              </p>
            </div>
          </>
        )}
        {cloud && mode === "forgot" && (
          <p className="mt-3 text-center text-xs text-muted">
            <button
              onClick={() => switchMode("signin")}
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
