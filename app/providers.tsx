"use client";

import { useEffect } from "react";
import { useApp } from "@/lib/store";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { loadAll, loadAccount, loadPersonalPrefs, loadWorkspaceSettings } from "@/lib/supabase-sync";
import { isPlatformOwnerEmail } from "@/lib/owner";
import { touchLastSeen } from "@/lib/last-seen";

function readThemePref(): "light" | "dark" | "system" {
  try {
    const stored = localStorage.getItem("lens-theme");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "light"; // fixed default
}

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Local (no Supabase) mode: restore from localStorage and we're done.
    if (!isSupabaseConfigured || !supabase) {
      useApp.getState().hydrate();
      return;
    }

    const client = supabase;
    // The login screen needs the right theme before any data loads.
    useApp.getState().setTheme(readThemePref());

    // Demo sandbox: a session marker (set by the login screen's "Explore the
    // demo") boots the seeded local backend instead of Supabase — no cloud I/O.
    // The marker lives in sessionStorage, so a refresh re-enters a fresh demo
    // and closing the tab ends it.
    try {
      if (sessionStorage.getItem("lens-demo")) {
        useApp.getState().enterDemo();
        return;
      }
    } catch {}

    let active = true;

    const initFromSession = async (
      session: {
        user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
      } | null,
    ) => {
      if (!active) return;
      const store = useApp.getState();
      // A demo session was entered after this listener subscribed — leave it alone.
      if (store.demo) return;

      if (!session) {
        store.setSignedOut(true);
        store.setAuthChecked(true);
        return;
      }

      // Platform owner: not a tenant, so skip the workspace load and send them
      // to the standalone /admin console. The server still enforces ownership.
      if (isPlatformOwnerEmail(session.user.email)) {
        store.setSignedOut(false);
        store.setAuthChecked(true);
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/admin")) {
          window.location.replace("/admin");
        }
        return;
      }

      // Coarse activity stamp for the owner console (throttled to once a day).
      // Fire-and-forget: it must never delay or block the workspace load. This
      // runs on every auth event, TOKEN_REFRESHED included, so a tab left open
      // for days still registers.
      void touchLastSeen(session.user.id);

      try {
        const snap = await loadAll();
        if (!active) return;

        // Match the auth user to a profile: by auth_id first, then by email.
        let profileId: string | undefined;
        const { data: linked } = await client
          .from("profiles")
          .select("id")
          .eq("auth_id", session.user.id)
          .limit(1);
        profileId = linked?.[0]?.id as string | undefined;
        if (!profileId && session.user.email) {
          profileId = snap.profiles.find(
            (p) => p.email.toLowerCase() === session.user.email!.toLowerCase(),
          )?.id;
        }
        profileId ??= snap.profiles[0]?.id;

        if (!profileId) throw new Error("No profile found for this account.");
        // Record which auth user this tab's data belongs to BEFORE applying,
        // so the cross-tab session guard never races the first sync.
        useApp.setState({ authUid: session.user.id });
        useApp.getState().applyCloud(snap, profileId);

        // Layer in cloud settings + the account (tenant): workspace policy,
        // this user's personal prefs, and the account row (name/plan). All
        // non-fatal — the app works on defaults if any of these fail (e.g.
        // before the multi-tenancy migration is applied).
        try {
          const [personal, workspace, account] = await Promise.all([
            loadPersonalPrefs(profileId),
            loadWorkspaceSettings(),
            loadAccount(profileId),
          ]);
          if (active) {
            useApp.getState().applyCloudPrefs(personal, workspace);
            useApp.setState({ account });
          }
        } catch (prefErr) {
          console.error("Settings load failed:", prefErr);
          // Unblock pref-gated UI anyway — it falls back to on-device state.
          if (active) useApp.setState({ prefsLoaded: true });
        }
        // Admin-created accounts carry a temporary password until changed —
        // offer to set a personal one (skippable; re-offered until changed).
        if (session.user.user_metadata?.must_change_password === true) {
          useApp.getState().setFirstLogin(true);
        }
      } catch (e) {
        // Cloud load failed (schema missing / offline): fall back to local so
        // the app still works, and surface the error.
        console.error("Supabase load failed:", e);
        if (!active) return;
        useApp.getState().hydrate();
        useApp.setState({ syncState: "error", syncError: e instanceof Error ? e.message : "load failed" });
      }
    };

    // supabase-js warns against awaiting client calls directly inside the auth
    // callback (can deadlock); defer to the next tick. onAuthStateChange also
    // emits INITIAL_SESSION on subscribe, so we don't need a separate getSession.
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      // Arriving via a "reset password" email link: make the user set a new
      // password before the app opens (the recovery session is signed in).
      if (event === "PASSWORD_RECOVERY") useApp.getState().setRecovery(true);
      setTimeout(() => initFromSession(session), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
