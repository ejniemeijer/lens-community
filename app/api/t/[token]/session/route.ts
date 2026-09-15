import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/owner";
import {
  cleanBlockResult,
  clientIp,
  newSessionId,
  newSessionToken,
  hashToken,
  rateLimit,
  readJson,
  testByToken,
  tokenMatches,
} from "@/lib/server/tests";
import type { TestBlockResult } from "@/lib/types";

/**
 * Public participant API: session lifecycle.
 *
 *  POST  — start a session. Only called after the participant accepts the
 *          consent gate; the row's existence IS the consent record
 *          (consent_given_at = now). Returns the one-time session secret.
 *  PATCH — merge one block's result / mark the session completed. Requires
 *          sessionId + sessionToken (compared against the stored hash).
 *          beaconEvents are never accepted here — the events route owns them.
 */

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  // Flood guard: per test link and per client — before any DB work.
  const ip = clientIp(req);
  if (!rateLimit(`sess:${token}`, 30, 60_000) || !rateLimit(`sess:${token}:${ip}`, 6, 60_000)) {
    return NextResponse.json({ error: "Too many sessions started — please try again in a minute." }, { status: 429 });
  }

  const test = await testByToken(svc, token);
  if (!test) return NextResponse.json({ error: "Unknown test link." }, { status: 404 });
  if (test.status !== "active") {
    return NextResponse.json({ error: "This test is no longer accepting responses." }, { status: 410 });
  }

  const body = (await readJson(req, 10_000)) ?? {};
  // Coarse device context only — nothing fingerprintable.
  const d = (body.device ?? {}) as Record<string, unknown>;
  const device = {
    viewportW: typeof d.viewportW === "number" ? Math.round(d.viewportW) : undefined,
    viewportH: typeof d.viewportH === "number" ? Math.round(d.viewportH) : undefined,
    pointer: d.pointer === "touch" || d.pointer === "mouse" ? d.pointer : undefined,
  };

  const sessionId = newSessionId();
  const sessionToken = newSessionToken();
  const { error } = await svc.from("test_sessions").insert({
    id: sessionId,
    account_id: test.account_id, // service role must stamp the tenant explicitly
    test_id: test.id,
    session_token_hash: hashToken(sessionToken),
    consent_given_at: new Date().toISOString(),
    device,
  });
  if (error) {
    console.error("[t/session] insert failed:", error.message);
    return NextResponse.json({ error: "Could not start the session." }, { status: 500 });
  }
  return NextResponse.json({ sessionId, sessionToken });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: "Not configured." }, { status: 503 });

  const body = await readJson(req);
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId.slice(0, 60) : "";
  const sessionToken = typeof body?.sessionToken === "string" ? body.sessionToken.slice(0, 200) : "";
  const blockId = typeof body?.blockId === "string" ? body.blockId.slice(0, 60) : "";
  if (!body || !sessionId || !sessionToken) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!rateLimit(`patch:${sessionId}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  // The join both authorizes (session belongs to this share token's test) and
  // fetches the test status in one round-trip.
  const { data, error } = await svc
    .from("test_sessions")
    .select("id, status, results, session_token_hash, tests!inner(share_token, status)")
    .eq("id", sessionId)
    .maybeSingle();
  const test = (data as { tests?: { share_token: string; status: string } } | null)?.tests;
  if (error || !data || test?.share_token !== token) {
    return NextResponse.json({ error: "Unknown session." }, { status: 404 });
  }
  if (!tokenMatches(sessionToken, data.session_token_hash)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }
  if (data.status !== "started" || test.status !== "active") {
    return NextResponse.json({ error: "This session is closed." }, { status: 410 });
  }

  const results = (data.results ?? {}) as Record<string, TestBlockResult>;
  if (blockId && body.result !== undefined) {
    const clean = cleanBlockResult(body.result);
    const existing = results[blockId] ?? {};
    // Auto-detected success (from beacon route matching) outranks the
    // participant's self-report — never downgrade it.
    if (existing.outcome === "success-auto" && clean.outcome === "success-reported") {
      delete clean.outcome;
    }
    results[blockId] = { ...existing, ...clean };
  }

  const patch: Record<string, unknown> = { results };
  if (body.complete === true) {
    patch.status = "completed";
    patch.completed_at = new Date().toISOString();
  }
  const { error: updateError } = await svc.from("test_sessions").update(patch).eq("id", sessionId);
  if (updateError) {
    console.error("[t/session] update failed:", updateError.message);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
