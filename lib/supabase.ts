"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase credentials are present in the environment. */
export const isSupabaseConfigured = Boolean(url && anonKey);

/**
 * Browser Supabase client (null when not configured, so the app keeps
 * working purely on local data). Phase 1 uses it for connection status;
 * auth + the live data layer land in the next phase.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!)
  : null;
