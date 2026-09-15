import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Admin-only: fully remove a workspace member — the profile row AND the
 * Supabase auth user (their login/email). The client can delete the profile
 * row via RLS but NOT the auth user, which needs the service role; without this
 * the email stays registered and the login is orphaned.
 */
const cleanEnv = (v?: string) => {
  const t = v?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0];
  return t || undefined;
};

export async function POST(req: Request) {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 503 });
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // ---- Require a signed-in admin ----
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { data: requester, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !requester?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: me } = await admin
    .from("profiles")
    .select("id, role, account_id")
    .eq("auth_id", requester.user.id)
    .maybeSingle();
  if (me?.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can remove users." }, { status: 403 });
  }

  // ---- Input ----
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Missing user id." }, { status: 400 });
  if (id === me.id) return NextResponse.json({ error: "You can't remove your own account here." }, { status: 400 });

  // ---- Look up target; enforce same-tenant ----
  const { data: target } = await admin
    .from("profiles")
    .select("id, auth_id, account_id")
    .eq("id", id)
    .maybeSingle();
  if (!target) return NextResponse.json({ ok: true }); // already gone
  if (me.account_id && target.account_id && target.account_id !== me.account_id) {
    return NextResponse.json({ error: "That user isn't in your workspace." }, { status: 403 });
  }

  // ---- Delete the profile row, then the auth user (login/email) ----
  const { error: profErr } = await admin.from("profiles").delete().eq("id", id);
  if (profErr) return NextResponse.json({ error: `Profile delete failed: ${profErr.message}` }, { status: 500 });

  if (target.auth_id) {
    const { error: delErr } = await admin.auth.admin.deleteUser(target.auth_id);
    if (delErr && !/not.?found/i.test(delErr.message)) {
      return NextResponse.json({ error: `Login delete failed: ${delErr.message}` }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}
