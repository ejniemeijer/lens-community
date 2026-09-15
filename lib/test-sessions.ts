"use client";

import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/lib/store";

/**
 * Per-test participant-response counts.
 *
 * Sessions live only in Supabase (never in the local/demo backend), and every
 * surface that wants "how many responses does this test have?" needs the same
 * cheap two-column roll-up — the dashboard panel and the AI context both do.
 * One copy here rather than a query per caller.
 */

export interface SessionTally {
  sessions: number;
  completed: number;
}

/** id → tally for every test in the account. Null when sessions can't exist
    (local/demo backend, or Supabase unconfigured) — which callers must treat
    as "unknown", not "zero". */
export type SessionTallies = Record<string, SessionTally>;

export async function fetchSessionTallies(): Promise<SessionTallies | null> {
  if (useApp.getState().backend !== "cloud" || !supabase) return null;
  // Two columns only: RLS scopes the rows to the account, and the payload
  // stays small even for an account with thousands of sessions.
  const { data, error } = await supabase.from("test_sessions").select("test_id, status");
  if (error) return null;
  const out: SessionTallies = {};
  for (const r of (data ?? []) as { test_id: string; status: string }[]) {
    const cur = (out[r.test_id] ??= { sessions: 0, completed: 0 });
    cur.sessions++;
    if (r.status === "completed") cur.completed++;
  }
  return out;
}

/**
 * The tally, fetched once per mount. Null until it arrives — and permanently
 * null where sessions can't exist, which callers must render as "unknown"
 * rather than zero. Re-runs if the backend changes (e.g. on sign-in), which
 * is when a previously-null tally can become real.
 */
export function useSessionTallies(): SessionTallies | null {
  const backend = useApp((s) => s.backend);
  const [tallies, setTallies] = React.useState<SessionTallies | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    void fetchSessionTallies().then((t) => {
      if (!cancelled) setTallies(t);
    });
    return () => {
      cancelled = true;
    };
  }, [backend]);
  return tallies;
}
