import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * GET → the signed-in user's running AI token usage:
 * { inputTokens, outputTokens, requests }. Read with the service role for the
 * caller's own profile (usage is written by the /api/ai proxy).
 */

const cleanEnv = (v?: string) => {
  const t = v?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0];
  return t || undefined;
};

const EMPTY = { inputTokens: 0, outputTokens: 0, requests: 0 };

export async function GET(req: Request) {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const service = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !anon || !service) return NextResponse.json(EMPTY); // local/dev mode — not tracked

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: u, error } = await authClient.auth.getUser(token);
  if (error || !u?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: prof } = await admin.from("profiles").select("id").eq("auth_id", u.user.id).limit(1);
  const profileId = prof?.[0]?.id as string | undefined;
  if (!profileId) return NextResponse.json(EMPTY);

  const { data } = await admin
    .from("ai_usage")
    .select("input_tokens, output_tokens, requests")
    .eq("profile_id", profileId)
    .maybeSingle();

  return NextResponse.json({
    inputTokens: Number(data?.input_tokens ?? 0),
    outputTokens: Number(data?.output_tokens ?? 0),
    requests: Number(data?.requests ?? 0),
  });
}
