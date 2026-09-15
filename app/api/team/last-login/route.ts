import { NextResponse } from "next/server";
import { serviceClient, verifyAccountAdmin } from "@/lib/server/owner";
import { rateLimit } from "@/lib/server/tests";

/**
 * GET — last sign-in time per team member, for the calling admin's own
 * account only. `last_sign_in_at` lives on Supabase `auth.users`, which is
 * only reachable with the service role, so this can't be a client read.
 *
 * Strictly account-scoped: we look up the caller's account via
 * verifyAccountAdmin, fetch only that account's profiles, and resolve each
 * one's auth row individually — no other tenant's data is ever touched, and
 * the response exposes only profile-id → timestamp (never auth ids).
 */
export async function GET(req: Request) {
  const admin = await verifyAccountAdmin(req);
  if (!admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  if (!rateLimit(`last-login:${admin.id}`, 30, 60_000))
    return NextResponse.json({ error: "Too many requests — try again shortly." }, { status: 429 });

  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Unavailable." }, { status: 503 });

  const { data: profiles, error } = await svc
    .from("profiles")
    .select("id, auth_id")
    .eq("account_id", admin.accountId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lastLogin: Record<string, string | null> = {};
  await Promise.all(
    (profiles ?? []).map(async (p: { id: string; auth_id: string | null }) => {
      lastLogin[p.id] = null; // no auth row yet ⇒ never signed in
      if (!p.auth_id) return;
      try {
        const { data } = await svc.auth.admin.getUserById(p.auth_id);
        lastLogin[p.id] = data?.user?.last_sign_in_at ?? null;
      } catch {
        /* leave null — a single lookup failure shouldn't fail the whole list */
      }
    }),
  );

  return NextResponse.json({ lastLogin });
}
