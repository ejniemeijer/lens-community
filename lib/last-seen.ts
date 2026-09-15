"use client";

import { supabase } from "@/lib/supabase";

/**
 * Stamps profiles.last_seen_at so the owner console can tell "still using it"
 * from "hasn't re-authenticated in a while".
 *
 * Supabase's last_sign_in_at only moves when a new session is created, and the
 * browser client keeps a session alive indefinitely by refreshing its token —
 * so an active user can look dormant for months. This is the missing signal.
 *
 * Deliberately coarse: one write per user per browser per day, best-effort,
 * never blocking and never surfacing an error. It answers "is this account
 * alive?" and nothing more — it is not analytics, and there is no per-action
 * tracking anywhere behind it.
 */

const KEY = "lens-last-seen";

/** Scoped by auth_id, so a member can only ever stamp their own row. */
export async function touchLastSeen(authUid: string): Promise<void> {
  if (!supabase || !authUid) return;

  // Local date, not UTC: "once a day" should mean the user's day.
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  try {
    if (localStorage.getItem(`${KEY}:${authUid}`) === today) return;
    localStorage.setItem(`${KEY}:${authUid}`, today);
  } catch {
    // Private mode / storage disabled: fall through and write. Worst case is
    // one extra update per page load, which is still cheap.
  }

  // Errors are swallowed on purpose, including "column does not exist" before
  // the migration is applied — a missing activity stamp must never break login.
  try {
    await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("auth_id", authUid);
  } catch {
    /* non-fatal */
  }
}
