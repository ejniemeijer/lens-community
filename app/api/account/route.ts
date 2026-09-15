import { NextResponse } from "next/server";
import { serviceClient, getAuthedUser } from "@/lib/server/owner";

/**
 * Tenant self-delete: an account ADMIN permanently deletes their OWN workspace.
 * DELETE { confirmName }  — confirmName must equal the account name (defense in
 * depth; the UI also requires typing it). Cascades all content + profiles, then
 * removes the members' auth users. The caller is signed out client-side after.
 */
export async function DELETE(req: Request) {
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Server is not configured." }, { status: 503 });

  // Resolve the caller's profile → account + role (by auth_id, then by email).
  let account_id: string | undefined;
  let role: string | undefined;
  const byAuth = await svc.from("profiles").select("account_id, role").eq("auth_id", user.id).maybeSingle();
  account_id = byAuth.data?.account_id;
  role = byAuth.data?.role;
  if (!account_id) {
    const byEmail = await svc.from("profiles").select("account_id, role").ilike("email", user.email).maybeSingle();
    account_id = byEmail.data?.account_id;
    role = byEmail.data?.role;
  }
  if (!account_id) return NextResponse.json({ error: "No workspace linked to your account." }, { status: 404 });
  if (role !== "admin") {
    return NextResponse.json({ error: "Only an account administrator can delete the workspace." }, { status: 403 });
  }

  const { data: acct } = await svc.from("accounts").select("id, name").eq("id", account_id).maybeSingle();
  if (!acct) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* body optional */
  }
  if (String(body.confirmName ?? "").trim() !== acct.name) {
    return NextResponse.json({ error: "The workspace name you typed doesn't match." }, { status: 400 });
  }

  const { data: profiles } = await svc.from("profiles").select("auth_id").eq("account_id", account_id);
  const authIds = ((profiles ?? []) as { auth_id: string | null }[]).map((p) => p.auth_id).filter(Boolean) as string[];

  const { error: delErr } = await svc.from("accounts").delete().eq("id", account_id);
  if (delErr) return NextResponse.json({ error: `Delete failed: ${delErr.message}` }, { status: 500 });

  for (const uid of authIds) {
    const { error } = await svc.auth.admin.deleteUser(uid);
    if (error) console.error(`[account] auth user ${uid} not deleted:`, error.message);
  }
  return NextResponse.json({ ok: true });
}
