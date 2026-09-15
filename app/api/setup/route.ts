import { NextResponse } from "next/server";
import { randomBytes, randomInt } from "node:crypto";
import { serviceClient } from "@/lib/server/owner";
import { isSelfHosted } from "@/lib/edition";

/**
 * First-run bootstrap for the self-hosted edition.
 *   GET  → { needed }  — true only when self-hosted AND no login exists yet
 *   POST → create the workspace account + first admin login (one-time)
 *
 * Gated hard: POST refuses unless self-hosted and there are zero auth users, so
 * it's a single-use door — it can't be replayed to mint another root admin.
 * In cloud mode it's inert (GET → needed:false, POST → 404).
 */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** No login has been created yet (self-hosted only). */
async function needsSetup(): Promise<boolean> {
  if (!isSelfHosted) return false;
  const svc = serviceClient();
  if (!svc) return false;
  const { data } = await svc.auth.admin.listUsers({ page: 1, perPage: 1 });
  return (data?.users?.length ?? 0) === 0;
}

export async function GET() {
  return NextResponse.json({ needed: await needsSetup() });
}

export async function POST(req: Request) {
  if (!isSelfHosted) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ error: "Server is not configured (missing service-role key)." }, { status: 503 });
  }

  // One-time only — refuse once any login exists.
  const { data: existing } = await svc.auth.admin.listUsers({ page: 1, perPage: 1 });
  if ((existing?.users?.length ?? 0) > 0) {
    return NextResponse.json({ error: "This instance is already set up." }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const workspaceName = String(body.workspaceName ?? "").trim().slice(0, 120);
  const adminName = String(body.adminName ?? "").trim().slice(0, 120) || "Admin";
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(body.password ?? "");

  if (!workspaceName) return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const accountId = `acc_${randomInt(10_000_000, 100_000_000)}`;
  const profileId = `u_${randomBytes(5).toString("hex")}`;

  const { error: accErr } = await svc
    .from("accounts")
    .insert({ id: accountId, name: workspaceName, plan: "business" });
  if (accErr) return NextResponse.json({ error: `Account create failed: ${accErr.message}` }, { status: 500 });

  // Profile first, linked by email; the auth trigger attaches the login below.
  const { error: profErr } = await svc.from("profiles").insert({
    id: profileId, account_id: accountId, name: adminName, email, role: "admin", job_title: "",
  });
  if (profErr) {
    await svc.from("accounts").delete().eq("id", accountId);
    return NextResponse.json({ error: `Profile create failed: ${profErr.message}` }, { status: 500 });
  }

  const { error: authErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name: adminName },
  });
  if (authErr) {
    await svc.from("profiles").delete().eq("id", profileId);
    await svc.from("accounts").delete().eq("id", accountId);
    return NextResponse.json({ error: `Login create failed: ${authErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
