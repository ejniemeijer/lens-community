import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/owner";
import { isCloud } from "@/lib/edition";

/**
 * Records one "Explore the demo" start (first-party, cloud only). Public — the
 * demo isn't authenticated — and fire-and-forget from the client. No cookies,
 * no third party; the row lives in our own Supabase and is read by /admin.
 * Self-hosted is a no-op so a customer's instance never phones home.
 */
export async function POST(req: Request) {
  if (!isCloud) return NextResponse.json({ ok: true });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ ok: true }); // tracking is best-effort

  let referrer: string | null = null;
  try {
    const body = (await req.json()) as { referrer?: unknown };
    if (typeof body.referrer === "string") referrer = body.referrer.slice(0, 300);
  } catch {
    /* no body is fine */
  }

  await svc.from("demo_visits").insert({ referrer });
  return NextResponse.json({ ok: true });
}
