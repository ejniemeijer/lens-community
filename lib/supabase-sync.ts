"use client";

/**
 * Bridges the app's in-memory (camelCase) data model to the Supabase
 * (snake_case) Postgres tables. The UI keeps reading the synchronous
 * in-memory cache; this module (a) loads the cloud snapshot on sign-in and
 * (b) mirrors the whole repository back on every change (small dataset, so a
 * debounced full upsert + delete-removed is simplest and cascade-proof).
 */

import { supabase } from "@/lib/supabase";
import { LOAD_ORDER, M, fromRow, toRow } from "@/lib/tenant-schema";
import type {
  AffinityBoard,
  Company,
  Insight,
  Interview,
  KanbanBoard,
  Participant,
  Persona,
  ResearchProject,
  Tag,
  Theme,
  Transcript,
  TranscriptHighlight,
  UsabilityTest,
  User,
} from "@/lib/types";

/* ---------------- snapshot shape (camelCase) ---------------- */

export interface CloudSnapshot {
  profiles: User[];
  companies: Company[];
  personas: Persona[];
  tags: Tag[];
  themes: Theme[];
  participants: Participant[];
  projects: ResearchProject[];
  interviews: Interview[];
  insights: Insight[];
  tests: UsabilityTest[];
  kanbanBoards: KanbanBoard[];
  affinityBoards: AffinityBoard[];
  transcripts: Transcript[];
  highlights: TranscriptHighlight[];
}


/* ---------------- load ---------------- */

export async function loadAll(): Promise<CloudSnapshot> {
  if (!supabase) throw new Error("Supabase not configured");
  const snap: Partial<CloudSnapshot> = {};
  for (const [table, key] of LOAD_ORDER) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`${table}: ${error.message}`);
    const map = M[table as keyof typeof M];
    const rows = (data ?? []).map((r) => fromRow(r as Record<string, unknown>, map));
    (snap as Record<string, unknown>)[key] = rows;
  }
  return snap as CloudSnapshot;
}

/* ---------------- write mirror ---------------- */

// Remembers which ids we last wrote per table, so we can delete removals
// without an extra read.
const lastIds: Record<string, Set<string>> = {};

interface SyncInput {
  profiles: User[];
  companies: Company[];
  personas: Persona[];
  tags: Tag[];
  themes: Theme[];
  participants: Participant[];
  projects: ResearchProject[];
  interviews: Interview[];
  insights: Insight[];
  tests: UsabilityTest[];
  kanbanBoards: KanbanBoard[];
  affinityBoards: AffinityBoard[];
  transcripts: Transcript[];
  highlights: TranscriptHighlight[];
}

/** Seed the last-synced id sets from the initial cloud load, so the first
    write mirror doesn't try to re-delete everything. */
export function primeSyncBaseline(snap: CloudSnapshot) {
  const s = snap as unknown as Record<string, { id: string }[]>;
  for (const [table, key] of LOAD_ORDER) {
    lastIds[table] = new Set((s[key] ?? []).map((r) => r.id));
  }
}

// `profiles` has admin-only write RLS, so it's NOT part of the general
// content mirror (a researcher's edit would otherwise trip RLS). Profile
// changes go through upsertProfile/deleteProfile, called by admin-only actions.
const WRITE_ORDER = LOAD_ORDER.filter(([table]) => table !== "profiles");

export async function upsertProfile(user: User): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  const { error } = await supabase.from("profiles").upsert(toRow(user as unknown as Record<string, unknown>, M.profiles));
  return error ? { ok: false, error: error.message } : { ok: true };
}
export async function deleteProfile(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
/** Bulk-upsert profiles (admin-only path). Ensures team/demo users referenced
    by content (owner/researcher/creator FKs) exist before the content rows are
    written — e.g. after a demo-data reset. Never deletes, and omits auth_id so
    an existing user's auth link is preserved. */
export async function syncProfiles(users: User[]): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  if (!users.length) return { ok: true };
  const { error } = await supabase
    .from("profiles")
    .upsert(users.map((u) => toRow(u as unknown as Record<string, unknown>, M.profiles)), { defaultToNull: false });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/* ---------------- account (tenant) ---------------- */

export interface AccountInfo {
  id: string;
  name: string;
  plan: string;
  status: string;
  /** Per-account seat-limit override; null = use the plan default. */
  seatLimit: number | null;
  /** Trial end (ISO); null = not on a trial (paying/converted). */
  trialEndsAt: string | null;
}

const DAY_MS = 86_400_000;

/** Whole days left in a trial (can be 0 on the last day, negative once past);
    null when the account isn't on a trial. */
export function trialDaysLeft(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  return Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / DAY_MS);
}

/** True when a trial end date is set and has passed. */
export function isTrialExpired(trialEndsAt: string | null | undefined): boolean {
  return !!trialEndsAt && new Date(trialEndsAt).getTime() <= Date.now();
}

/** The caller's account (tenant) — id, name, plan, status. Returns null when
    the multi-tenancy migration isn't applied yet (or on any error), so the app
    degrades to pre-tenant behavior. */
export async function loadAccount(profileId: string): Promise<AccountInfo | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("account_id, accounts(id, name, plan, status, seat_limit, trial_ends_at)")
    .eq("id", profileId)
    .maybeSingle();
  if (error || !data) return null;
  type AccountRow = {
    id: string; name: string; plan: string; status: string;
    seat_limit: number | null; trial_ends_at: string | null;
  };
  const acc = (data as { accounts?: AccountRow | AccountRow[] | null }).accounts;
  const row = Array.isArray(acc) ? acc[0] : acc;
  return row?.id
    ? {
        id: row.id, name: row.name, plan: row.plan, status: row.status,
        seatLimit: row.seat_limit ?? null, trialEndsAt: row.trial_ends_at ?? null,
      }
    : null;
}

/* ---------------- settings (per-user prefs + shared workspace) ---------------- */

type PrefMap = Record<string, string | boolean>;

/** A user's personal preferences (profiles.preferences jsonb). */
export async function loadPersonalPrefs(profileId: string): Promise<PrefMap> {
  if (!supabase) return {};
  const { data, error } = await supabase.from("profiles").select("preferences").eq("id", profileId).maybeSingle();
  if (error || !data) return {};
  return ((data as { preferences?: PrefMap }).preferences ?? {}) as PrefMap;
}

/** Persist a user's personal preferences (self-update via RLS). */
export async function savePersonalPrefs(profileId: string, prefs: PrefMap): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  const { error } = await supabase.from("profiles").update({ preferences: prefs }).eq("id", profileId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** The caller's workspace-settings row (GDPR policy + project-tab visibility).
    RLS scopes the read to the caller's account, so no explicit filter needed —
    and this also works pre-migration, where a single shared row exists. */
export async function loadWorkspaceSettings(): Promise<PrefMap> {
  if (!supabase) return {};
  const { data, error } = await supabase.from("workspace_settings").select("settings").limit(1).maybeSingle();
  if (error || !data) return {};
  return ((data as { settings?: PrefMap }).settings ?? {}) as PrefMap;
}

/** Persist the account's workspace settings (admin-only via RLS). With a known
    account, upsert per-account; otherwise (pre-migration) the legacy shared row. */
export async function saveWorkspaceSettings(
  accountId: string | undefined,
  settings: PrefMap,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  const updated_at = new Date().toISOString();
  const { error } = accountId
    ? await supabase
        .from("workspace_settings")
        .upsert({ id: accountId, account_id: accountId, settings, updated_at }, { onConflict: "account_id" })
    : await supabase.from("workspace_settings").upsert({ id: "default", settings, updated_at });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function syncAll(input: SyncInput): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "not configured" };
  const data = input as unknown as Record<string, Record<string, unknown>[]>;
  try {
    // 1. Upserts, parent → child.
    for (const [table, key] of WRITE_ORDER) {
      const rows = data[key] ?? [];
      if (rows.length) {
        const map = M[table as keyof typeof M];
        const { error } = await supabase
          .from(table)
          .upsert(rows.map((r) => toRow(r, map)), { defaultToNull: false });
        if (error) throw new Error(`${table}: ${error.message}`);
      }
    }
    // 2. Deletes, child → parent.
    for (let i = WRITE_ORDER.length - 1; i >= 0; i--) {
      const [table, key] = WRITE_ORDER[i];
      const currentIds = new Set((data[key] ?? []).map((r) => (r as { id: string }).id));
      const removed = [...(lastIds[table] ?? [])].filter((id) => !currentIds.has(id));
      if (removed.length) {
        const { error } = await supabase.from(table).delete().in("id", removed);
        if (error) throw new Error(`${table} delete: ${error.message}`);
      }
      lastIds[table] = currentIds;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "sync failed" };
  }
}
