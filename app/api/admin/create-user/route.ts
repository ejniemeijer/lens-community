import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { effectiveSeatLimit } from "@/lib/permissions";

/**
 * Admin-only: create a workspace account directly (no invitation email).
 *
 * Uses the Supabase service_role key, which must live server-side only —
 * add `SUPABASE_SERVICE_ROLE_KEY=...` to `.env.local` (never NEXT_PUBLIC_).
 * The auth user is created with `email_confirm: true`, so the new member can
 * sign in immediately; the `handle_new_user` trigger links the profile row
 * we upsert here by email.
 */
/** Strip surrounding quotes, stray whitespace, and anything after the first
    token (URLs and keys never contain spaces, so accidentally pasted extra
    terminal lines are dropped safely). */
const cleanEnv = (v?: string) => {
  const t = v?.trim().replace(/^["']|["']$/g, "").trim().split(/\s+/)[0];
  return t || undefined;
};

export async function POST(req: Request) {
  const url = cleanEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server key missing — add SUPABASE_SERVICE_ROLE_KEY to .env.local and restart the app." },
      { status: 501 },
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Identify the requester and require the admin role ----
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { data: requester, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !requester?.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  // Read role + account (tenant). Fall back to role-only while the
  // multi-tenancy migration isn't applied yet (missing account_id column).
  let requesterProfile: { role?: string; account_id?: string } | null = null;
  const withAccount = await admin
    .from("profiles")
    .select("role, account_id")
    .eq("auth_id", requester.user.id)
    .maybeSingle();
  if (!withAccount.error) {
    requesterProfile = withAccount.data;
  } else {
    const legacy = await admin.from("profiles").select("role").eq("auth_id", requester.user.id).maybeSingle();
    requesterProfile = legacy.data;
  }
  if (requesterProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can add users." }, { status: 403 });
  }

  // ---- Validate input ----
  let body: {
    id?: string;
    name?: string;
    email?: string;
    password?: string;
    role?: string;
    jobTitle?: string;
    avatarColor?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { id, name, email, password, role, jobTitle, avatarColor } = body;
  if (!id || !name || !email || !password || !role) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  // ---- Enforce the account's seat limit (every non-viewer role uses a seat) ----
  if (requesterProfile.account_id && role !== "viewer") {
    const { data: acc } = await admin
      .from("accounts")
      .select("plan, seat_limit")
      .eq("id", requesterProfile.account_id)
      .maybeSingle();
    const limit = effectiveSeatLimit(acc?.plan, acc?.seat_limit);
    if (limit !== Infinity) {
      const { count } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", requesterProfile.account_id)
        .neq("role", "viewer");
      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          {
            error: `Your ${limit} contributor seats are all in use. Viewers are free and unlimited — or contact us to add seats.`,
          },
          { status: 403 },
        );
      }
    }
  }

  // ---- Create the profile first so the auth trigger links it by email ----
  // New members always join the requesting admin's account (tenant).
  const { error: profileErr } = await admin.from("profiles").upsert({
    id,
    name,
    email,
    role,
    job_title: jobTitle ?? "",
    avatar_color: avatarColor ?? null,
    ...(requesterProfile.account_id ? { account_id: requesterProfile.account_id } : {}),
  });
  if (profileErr) {
    return NextResponse.json({ error: `Profile write failed: ${profileErr.message}` }, { status: 500 });
  }

  // ---- Create the auth account, pre-confirmed (no email is sent) ----
  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // must_change_password → the app offers a password change on first sign-in.
    user_metadata: { name, must_change_password: true },
  });
  if (createErr) {
    // Roll the profile back so a failed attempt leaves nothing behind.
    await admin.from("profiles").delete().eq("id", id);
    const friendly = /already.*(registered|exists)/i.test(createErr.message)
      ? "An account with this email already exists."
      : createErr.message;
    return NextResponse.json({ error: friendly }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
