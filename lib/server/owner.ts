import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side platform-owner + tenant-admin auth helpers for the admin API
 * routes. The platform owner is identified by email allowlist (env
 * PLATFORM_OWNER_EMAILS, comma-separated) — owners are NOT tenants, so they're
 * matched by email rather than a profile row. All privileged reads/writes use
 * the service role; every route verifies the caller first.
 */

// Strip classic paste artifacts (quotes / whitespace / trailing pasted lines).
const cleanEnv = (v?: string) =>
  v?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0] || undefined;

/**
 * The most recent of a set of ISO timestamps (nulls ignored, null if none).
 *
 * Compared as dates rather than strings on purpose: activity stamps come from
 * two sources with different formats — PostgREST renders timestamptz as
 * "…+00:00" while GoTrue returns "…Z" — so a lexicographic sort is not
 * reliably chronological.
 */
export function latestIso(...values: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const v of values) {
    if (!v) continue;
    const ms = new Date(v).getTime();
    if (Number.isNaN(ms) || ms <= bestMs) continue;
    best = v;
    bestMs = ms;
  }
  return best;
}

export function ownerEmails(): string[] {
  const raw = process.env.PLATFORM_OWNER_EMAILS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Service-role Supabase client (bypasses RLS). Null if env is missing. */
export function serviceClient(): SupabaseClient | null {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Validate the request's `Authorization: Bearer <access_token>` and return the
 *  authenticated user, or null. The token is verified against Supabase Auth. */
export async function getAuthedUser(
  req: Request,
): Promise<{ id: string; email: string } | null> {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const svc = serviceClient();
  if (!svc) return null;
  const { data, error } = await svc.auth.getUser(token);
  const user = data?.user;
  if (error || !user?.email) return null;
  return { id: user.id, email: user.email.toLowerCase() };
}

/** True when the caller is a platform owner (email in the allowlist). */
export async function verifyOwner(req: Request): Promise<{ id: string; email: string } | null> {
  const user = await getAuthedUser(req);
  if (!user) return null;
  return ownerEmails().includes(user.email) ? user : null;
}

/** Validate the caller and, if they are an admin of a tenant account, return
 *  their account id alongside the user. Used by account-scoped admin APIs
 *  (e.g. team last-login) — every such route must scope its reads to this
 *  `accountId` so one tenant can never see another's data. */
export async function verifyAccountAdmin(
  req: Request,
): Promise<{ id: string; email: string; accountId: string } | null> {
  const user = await getAuthedUser(req);
  if (!user) return null;
  const svc = serviceClient();
  if (!svc) return null;
  const { data } = await svc
    .from("profiles")
    .select("account_id, role")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!data || data.role !== "admin" || !data.account_id) return null;
  return { ...user, accountId: data.account_id as string };
}
