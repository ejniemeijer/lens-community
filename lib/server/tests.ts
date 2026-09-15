import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TestAnswerValue, TestBeaconEvent, TestBlock, TestBlockResult, TestOutcome } from "@/lib/types";

/**
 * Shared plumbing for the public participant API (/api/t/[token]/*).
 * These routes are unauthenticated by design: the share token selects the
 * test, and a per-session secret (returned once at session creation, stored
 * only as a sha-256 hash) authorizes every subsequent write. All access goes
 * through the service role — test_sessions has no client write policies.
 */

/* ---------------- session secrets ---------------- */

export const newSessionId = () => `ts_${randomBytes(8).toString("hex")}`;
export const newSessionToken = () => randomBytes(24).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Constant-time comparison of a presented token against the stored hash. */
export function tokenMatches(presented: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(presented));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ---------------- test lookup ---------------- */

export interface PublicTestRow {
  id: string;
  account_id: string;
  name: string;
  status: string;
  blocks: TestBlock[];
}

/** The test behind a share token, or null. The caller checks `status`. */
export async function testByToken(svc: SupabaseClient, token: string): Promise<PublicTestRow | null> {
  if (!token || token.length > 200) return null;
  const { data, error } = await svc
    .from("tests")
    .select("id, account_id, name, status, blocks")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return data as PublicTestRow;
}

/** Participant-facing view of the block list: the success pattern stays
    server-side (it's the answer key — the events route applies it), and
    route screenshots are researcher-only results tooling. */
export function sanitizeBlocks(blocks: TestBlock[]): TestBlock[] {
  return blocks.map((b) => {
    if (b.type === "app-task") {
      const { successUrlPattern: _hidden, routeScreenshots: _internal, ...rest } = b;
      return rest as TestBlock;
    }
    return b;
  });
}

/* ---------------- validation (length-capped, whitelisted) ---------------- */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
const num = (v: unknown, max: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : undefined;

const OUTCOMES: TestOutcome[] = ["success-auto", "success-reported", "gave-up", "skipped"];
const DAY_MS = 86_400_000;

/** Whitelist one block result from the runner. beaconEvents are deliberately
    NOT accepted here — only the events route appends those. */
export function cleanBlockResult(raw: unknown): TestBlockResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: TestBlockResult = {};
  if (OUTCOMES.includes(r.outcome as TestOutcome)) out.outcome = r.outcome as TestOutcome;
  const outcomeComment = str(r.outcomeComment, 1000)?.trim();
  if (outcomeComment) out.outcomeComment = outcomeComment;
  const durationMs = num(r.durationMs, DAY_MS);
  if (durationMs !== undefined) out.durationMs = durationMs;
  const timeToClickMs = num(r.timeToClickMs, DAY_MS);
  if (timeToClickMs !== undefined) out.timeToClickMs = timeToClickMs;
  const click = r.click as Record<string, unknown> | undefined;
  const cx = num(click?.x, 1);
  const cy = num(click?.y, 1);
  if (cx !== undefined && cy !== undefined) out.click = { x: cx, y: cy };
  const choice = str(r.choice, 60);
  if (choice) out.choice = choice;
  if (r.answers && typeof r.answers === "object") {
    const answers: Record<string, TestAnswerValue> = {};
    for (const [k, v] of Object.entries(r.answers as Record<string, unknown>).slice(0, 50)) {
      const key = k.slice(0, 60);
      if (typeof v === "number" && Number.isFinite(v)) answers[key] = v;
      else if (typeof v === "string") answers[key] = v.slice(0, 4000);
      else if (Array.isArray(v)) {
        // multi-select: option labels
        answers[key] = v.filter((x): x is string => typeof x === "string").slice(0, 20).map((x) => x.slice(0, 200));
      } else if (v && typeof v === "object") {
        // matrix: statement → rating
        const m: Record<string, number> = {};
        for (const [stmt, rating] of Object.entries(v as Record<string, unknown>).slice(0, 30)) {
          if (typeof rating === "number" && Number.isFinite(rating)) m[stmt.slice(0, 200)] = rating;
        }
        answers[key] = m;
      }
    }
    out.answers = answers;
  }
  return out;
}

export const MAX_EVENTS_PER_BATCH = 50;
export const MAX_EVENTS_PER_BLOCK = 2000;

/** Whitelist a beacon batch (clicks + route views only). */
export function cleanBeaconEvents(raw: unknown): TestBeaconEvent[] {
  if (!Array.isArray(raw)) return [];
  const out: TestBeaconEvent[] = [];
  for (const item of raw.slice(0, MAX_EVENTS_PER_BATCH)) {
    const e = (item ?? {}) as Record<string, unknown>;
    if (e.type !== "page" && e.type !== "click") continue;
    const t = num(e.t, DAY_MS);
    const path = str(e.path, 200);
    if (t === undefined || path === undefined) continue;
    const ev: TestBeaconEvent = { t, type: e.type, path };
    const sel = str(e.sel, 200);
    if (sel !== undefined) ev.sel = sel;
    const x = num(e.x, 1);
    const y = num(e.y, 1);
    if (x !== undefined && y !== undefined) {
      ev.x = x;
      ev.y = y;
    }
    // beacon v2: document-relative (scroll-corrected) coordinates
    const dx = num(e.dx, 1);
    const dy = num(e.dy, 1);
    if (dx !== undefined && dy !== undefined) {
      ev.dx = dx;
      ev.dy = dy;
    }
    // beacon v3: participant layout in px — viewport and full document size.
    const vw = num(e.vw, 20_000);
    const vh = num(e.vh, 20_000);
    if (vw !== undefined && vh !== undefined) {
      ev.vw = Math.round(vw);
      ev.vh = Math.round(vh);
    }
    const dw = num(e.dw, 200_000);
    const dh = num(e.dh, 200_000);
    if (dw !== undefined && dh !== undefined) {
      ev.dw = Math.round(dw);
      ev.dh = Math.round(dh);
    }
    out.push(ev);
  }
  return out;
}

/** Glob-ish success match (shared matcher in lib/utils — "*" wildcard,
    anchored at the start, e.g. "/job-created*"). */
export { globMatch as matchesSuccessPattern } from "@/lib/utils";

/* ---------------- rate limiting ---------------- */

// In-memory sliding window — per server process, resets on restart. That's
// deliberate MVP scope: it stops accidental floods and casual abuse; a
// multi-instance deployment would need a shared store to be airtight.
const hits = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

/** True when the call is allowed; false when the key exceeded max per window. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  if (hits.size >= MAX_TRACKED_KEYS && !hits.has(key)) hits.clear(); // memory backstop
  hits.set(key, recent);
  return true;
}

/** Best-effort client IP (first x-forwarded-for hop). */
export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/* ---------------- beacon check pings ---------------- */

// Live beacon checks: the builder opens the researcher's app with
// ?lens=check.<checkId>.builder; the snippet POSTs to the events route,
// which records the ping here instead of touching any session. In-memory
// (same single-instance scope as the rate limiter) — a check is a
// seconds-long interaction, so process-local state is fine.
const checkPings = new Map<string, number>();
const CHECK_TTL_MS = 10 * 60_000;

export function recordBeaconCheck(checkId: string) {
  const now = Date.now();
  for (const [id, at] of checkPings) if (now - at > CHECK_TTL_MS) checkPings.delete(id);
  if (checkPings.size >= MAX_TRACKED_KEYS) checkPings.clear(); // memory backstop
  checkPings.set(checkId.slice(0, 100), now);
}

export function beaconCheckSeen(checkId: string): boolean {
  const at = checkPings.get(checkId);
  return at !== undefined && Date.now() - at <= CHECK_TTL_MS;
}

/* ---------------- request plumbing ---------------- */

/** Read a JSON body regardless of content type (sendBeacon posts text/plain),
    with a hard size cap. Returns null on oversize or parse failure. */
export async function readJson(req: Request, maxBytes = 100_000): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > maxBytes) return null;
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** CORS headers for the beacon endpoint — open by design: the caller is the
    researcher's own prototype on an arbitrary origin, and authorization is
    the per-session token, not the origin. Includes the private-network
    preflight answer so localhost dev receivers work from public pages. */
export function beaconCors(req: Request): HeadersInit {
  const h: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
  if (req.headers.get("access-control-request-private-network")) {
    h["Access-Control-Allow-Private-Network"] = "true";
  }
  return h;
}
