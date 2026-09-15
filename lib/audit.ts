"use client";

import { supabase } from "@/lib/supabase";
import { currentUser } from "@/lib/db";
import { useApp } from "@/lib/store";

/**
 * Append-only audit trail of security- and GDPR-relevant actions, stored in
 * public.audit_events (cloud mode only — local/demo workspaces have nothing
 * durable to audit). Writes are fire-and-forget: recording an event must never
 * break or slow the action being recorded. Reads are admin-only via RLS.
 */

export type AuditEvent = {
  id: string;
  actorName: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
};

/** Record one audit event (no-op outside cloud mode; never throws). */
export function logAudit(action: string, target = "", detail = "") {
  try {
    const s = useApp.getState();
    if (s.demo || s.signedOut || s.backend !== "cloud" || !supabase) return;
    const me = currentUser();
    supabase
      .from("audit_events")
      .insert({ actor_id: me.id, actor_name: me.name, action, target, detail })
      .then(({ error }) => {
        // Pre-migration or RLS refusal: log locally, never surface to the user.
        if (error) console.warn("[audit] event not recorded:", error.message);
      });
  } catch {
    /* auditing must never break the audited action */
  }
}

/** A page of the account's audit events, newest first (admin-only via RLS).
    `before` (the oldest loaded created_at) fetches the next page — keyset
    pagination stays stable while new events keep arriving. `search` matches
    actor, action, target, and detail server-side, so it spans the whole log,
    and `action` narrows to one action type. All three combine. */
export async function fetchAuditEvents(
  opts: { limit?: number; before?: string; search?: string; action?: string } = {},
): Promise<AuditEvent[]> {
  if (!supabase) return [];
  const { limit = 50, before, search, action } = opts;
  let query = supabase
    .from("audit_events")
    .select("id, actor_name, action, target, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("created_at", before);
  if (action) query = query.eq("action", action);
  if (search) {
    // PostgREST or() syntax breaks on commas/parens; wildcards need escaping.
    const s = search.replace(/[,()]/g, " ").replace(/[%_]/g, "\\$&").trim();
    if (s) {
      query = query.or(
        ["actor_name", "action", "target", "detail"].map((c) => `${c}.ilike.%${s}%`).join(","),
      );
    }
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return (data as Record<string, string>[]).map((r) => ({
    id: r.id,
    actorName: r.actor_name ?? "",
    action: r.action ?? "",
    target: r.target ?? "",
    detail: r.detail ?? "",
    createdAt: r.created_at ?? "",
  }));
}
