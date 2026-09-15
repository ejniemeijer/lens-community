import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { encryptSecret, aiKeySecretConfigured } from "@/lib/server/crypto";

/**
 * Shared per-workspace AI API key. One key per account, encrypted (AES-256-GCM)
 * server-side and written via the service role — the plaintext never touches the
 * database and is never returned to the client. Only an account admin may set it.
 *
 * GET  → { anthropic, openai, xai, google: boolean }  — whether the workspace has a key
 * POST → { provider, key }  — set (or clear, when key is blank) the workspace key (admin only)
 */

type Provider = "anthropic" | "openai" | "xai" | "google";
const PROVIDERS: Provider[] = ["anthropic", "openai", "xai", "google"];
const isProvider = (v: unknown): v is Provider => PROVIDERS.includes(v as Provider);

const cleanEnv = (v?: string) => {
  const t = v?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0];
  return t || undefined;
};

function env() {
  return {
    url: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anon: cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    service: cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

/** Safe, non-secret description of a key — enough to spot a wrong/truncated paste. */
function keyFingerprint(k: string): string {
  let role = "unreadable";
  try {
    role = JSON.parse(Buffer.from(k.split(".")[1], "base64url").toString()).role ?? "?";
  } catch {}
  return `length ${k.length}, role "${role}", ends "…${k.slice(-4)}"`;
}

type Caller = { accountId: string; role: string };

/** Validate the bearer token and resolve the caller's account id + app role. */
async function caller(
  req: Request,
): Promise<{ ctx?: Caller; admin?: SupabaseClient; error?: string; status?: number }> {
  const { url, anon, service } = env();
  if (!url || !anon) return { error: "Cloud mode isn't configured on the server.", status: 501 };
  if (!service) return { error: "Server key missing — add SUPABASE_SERVICE_ROLE_KEY to .env.local.", status: 501 };

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { error: "Not signed in.", status: 401 };

  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) return { error: "Not signed in.", status: 401 };

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const lookupFailed = (msg: string) => ({
    error:
      `Couldn't look up your profile — the server's SUPABASE_SERVICE_ROLE_KEY appears invalid (${msg}). ` +
      `The server sees: ${keyFingerprint(service)}. It must have role "service_role" and match the ` +
      `service_role key in Supabase → Project Settings → API.`,
    status: 500,
  });

  const { data: prof, error: profErr } = await admin
    .from("profiles")
    .select("account_id, role")
    .eq("auth_id", data.user.id)
    .limit(1);
  if (profErr) return lookupFailed(profErr.message);
  let row = prof?.[0] as { account_id: string; role: string } | undefined;

  // Fall back to the verified email and self-heal the missing auth link.
  if (!row && data.user.email) {
    const { data: byEmail, error: emailErr } = await admin
      .from("profiles")
      .select("id, auth_id, account_id, role")
      .ilike("email", data.user.email)
      .limit(1);
    if (emailErr) return lookupFailed(emailErr.message);
    const r = byEmail?.[0] as { id: string; auth_id: string | null; account_id: string; role: string } | undefined;
    if (r) {
      row = { account_id: r.account_id, role: r.role };
      if (!r.auth_id) await admin.from("profiles").update({ auth_id: data.user.id }).eq("id", r.id);
    }
  }

  if (!row) return { error: "No profile linked to this account.", status: 403 };
  return { ctx: { accountId: row.account_id, role: row.role }, admin };
}

export async function GET(req: Request) {
  const { ctx, admin, error, status } = await caller(req);
  if (error || !admin || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });

  const read = (cols: string) =>
    admin.from("account_ai_keys").select(cols).eq("account_id", ctx.accountId).maybeSingle();

  // Try all providers; if the xai/google columns aren't migrated yet, fall back
  // to the legacy pair so existing keys still report as configured.
  let { data, error: selErr } = await read("anthropic, openai, xai, google");
  if (selErr) ({ data } = await read("anthropic, openai"));
  const row = (data ?? {}) as Partial<Record<Provider, string | null>>;
  return NextResponse.json(Object.fromEntries(PROVIDERS.map((p) => [p, Boolean(row[p])])));
}

export async function POST(req: Request) {
  let body: { provider?: unknown; key?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!isProvider(body.provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  if (!aiKeySecretConfigured()) {
    return NextResponse.json(
      { error: "Encryption isn't configured — add AI_KEY_SECRET (16+ chars) to .env.local and restart." },
      { status: 501 },
    );
  }

  const { ctx, admin, error, status } = await caller(req);
  if (error || !admin || !ctx) return NextResponse.json({ error }, { status: status ?? 401 });
  if (ctx.role !== "admin") {
    return NextResponse.json({ error: "Only an admin can set the workspace AI key." }, { status: 403 });
  }

  const raw = typeof body.key === "string" ? body.key.trim() : "";
  const column = body.provider; // "anthropic" | "openai"
  const value = raw ? encryptSecret(raw) : null;

  const { error: upErr } = await admin
    .from("account_ai_keys")
    .upsert({ account_id: ctx.accountId, [column]: value, updated_at: new Date().toISOString() });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, saved: Boolean(value) });
}
