import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/server/owner";
import {
  beaconCors,
  cleanBeaconEvents,
  matchesSuccessPattern,
  MAX_EVENTS_PER_BLOCK,
  rateLimit,
  readJson,
  recordBeaconCheck,
  tokenMatches,
} from "@/lib/server/tests";
import type { AppTaskBlock, TestBlock, TestBlockResult } from "@/lib/types";

/**
 * Public beacon endpoint: the Lens snippet inside a researcher's prototype
 * (Figma Make app, deployed Claude Design export, staging build, …) POSTs
 * click + route-view batches here from an arbitrary origin.
 *
 * CORS is open BY DESIGN on this route only — the caller's origin is the
 * researcher's own app, unknowable in advance; authorization is the
 * per-session secret carried in the `session` field ("<id>.<secret>.<blockId>",
 * minted by the session route and passed via the ?lens= URL param). Bodies
 * arrive as text/plain (sendBeacon) or application/json — parsed either way.
 * Abuse guards: hard batch/size caps, per-block event cap, and writes are
 * refused once the session or test is closed.
 */

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: beaconCors(req) });
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const headers = beaconCors(req);
  const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

  const svc = serviceClient();
  if (!svc) return fail("Not configured.", 503);

  const body = await readJson(req);
  const session = typeof body?.session === "string" ? body.session.slice(0, 300) : "";
  const [sessionId, secret, blockId] = session.split(".");
  if (!body || !sessionId || !secret || !blockId) return fail("Invalid request.", 400);

  // Builder beacon check: ?lens=check.<checkId>.builder — record the ping and
  // stop. Nothing touches the database or any session.
  if (sessionId === "check") {
    if (!rateLimit(`ev-check:${secret}`, 30, 60_000)) return fail("Too many requests.", 429);
    recordBeaconCheck(secret);
    return NextResponse.json({ ok: true, check: true }, { headers });
  }

  // The beacon flushes every ~3s (≈20/min); 60/min leaves headroom without
  // letting a hostile client hammer the DB.
  if (!rateLimit(`ev:${sessionId}`, 60, 60_000)) return fail("Too many requests.", 429);

  const { data, error } = await svc
    .from("test_sessions")
    .select("id, status, results, session_token_hash, tests!inner(share_token, status, blocks)")
    .eq("id", sessionId)
    .maybeSingle();
  const test = (data as { tests?: { share_token: string; status: string; blocks: TestBlock[] } } | null)?.tests;
  if (error || !data || test?.share_token !== token) return fail("Unknown session.", 404);
  if (!tokenMatches(secret, data.session_token_hash)) return fail("Not allowed.", 403);
  if (data.status !== "started" || test.status !== "active") return fail("This session is closed.", 410);

  const block = (test.blocks ?? []).find((b) => b.id === blockId);
  if (!block || block.type !== "app-task") return fail("Unknown block.", 404);

  const incoming = cleanBeaconEvents(body.events);
  if (!incoming.length) return NextResponse.json({ ok: true }, { headers });

  const results = (data.results ?? {}) as Record<string, TestBlockResult>;
  const existing = results[blockId] ?? {};
  const events = [...(existing.beaconEvents ?? []), ...incoming].slice(0, MAX_EVENTS_PER_BLOCK);

  // Server-side success detection: the pattern never leaves the server, so
  // participants can't read the answer key out of the test definition.
  const pattern = (block as AppTaskBlock).successUrlPattern;
  const reachedSuccess = incoming.some((e) => e.type === "page" && matchesSuccessPattern(e.path, pattern));

  results[blockId] = {
    ...existing,
    beaconEvents: events,
    ...(reachedSuccess && !existing.outcome ? { outcome: "success-auto" as const } : {}),
    ...(reachedSuccess && existing.outcome === "success-reported" ? { outcome: "success-auto" as const } : {}),
  };

  const { error: updateError } = await svc.from("test_sessions").update({ results }).eq("id", sessionId);
  if (updateError) {
    console.error("[t/events] update failed:", updateError.message);
    return fail("Could not save.", 500);
  }
  return NextResponse.json({ ok: true }, { headers });
}
