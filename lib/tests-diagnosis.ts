import type { TestBeaconEvent, TestBlock, TestBlockResult } from "@/lib/types";

/**
 * Behavioral analysis for app-task results — pure, no runtime imports, so it's
 * unit-testable and safe to import anywhere. Two jobs:
 *   1. aggregateClicks — per-element click/rage/nav stats (used by the results
 *      analytics UI and reused below).
 *   2. buildDiagnosisBrief — distills a task's telemetry into a compact,
 *      PII-light brief for the AI "why" diagnosis (see components/tests/
 *      ai-diagnosis.tsx, which runs it through the AI layer).
 */

/* ---------------- click aggregation ---------------- */

const RAGE_WINDOW_MS = 1200;
const RAGE_DISTANCE = 0.06; // normalized manhattan distance
const RAGE_RUN = 3;
const NAV_FOLLOW_MS = 1000;

export interface SelectorStat {
  sel: string;
  clicks: number;
  navigations: number; // clicks followed by a route change within NAV_FOLLOW_MS
  rage: number; // clicks that are part of a rage burst
}
export interface RouteStats {
  path: string;
  total: number;
  selectors: SelectorStat[];
}

/** Per-route, per-element click stats + rage detection across sessions. */
export function aggregateClicks(sessions: TestBlockResult[]): { routes: RouteStats[]; rageTotal: number } {
  const byRoute = new Map<string, Map<string, SelectorStat>>();
  let rageTotal = 0;

  for (const result of sessions) {
    const events = result.beaconEvents ?? [];
    const clicks = events.filter((e) => e.type === "click");

    // Rage detection: runs of ≥3 clicks on the same element in quick
    // succession, close together. Flags the whole run.
    const inRage = new Set<TestBeaconEvent>();
    let run: TestBeaconEvent[] = [];
    for (const c of clicks) {
      const prev = run[run.length - 1];
      const near =
        prev &&
        c.sel === prev.sel &&
        c.t - prev.t <= RAGE_WINDOW_MS &&
        Math.abs((c.x ?? 0) - (prev.x ?? 0)) + Math.abs((c.y ?? 0) - (prev.y ?? 0)) <= RAGE_DISTANCE;
      run = near ? [...run, c] : [c];
      if (run.length >= RAGE_RUN) run.forEach((e) => inRage.add(e));
    }
    rageTotal += inRage.size;

    for (const c of clicks) {
      const sel = c.sel || "(unknown)";
      const routes = byRoute.get(c.path) ?? new Map<string, SelectorStat>();
      const stat = routes.get(sel) ?? { sel, clicks: 0, navigations: 0, rage: 0 };
      stat.clicks++;
      if (inRage.has(c)) stat.rage++;
      if (events.some((e) => e.type === "page" && e.t > c.t && e.t - c.t <= NAV_FOLLOW_MS)) stat.navigations++;
      routes.set(sel, stat);
      byRoute.set(c.path, routes);
    }
  }

  const routes = [...byRoute.entries()]
    .map(([path, sels]) => {
      const selectors = [...sels.values()].sort((a, b) => b.clicks - a.clicks);
      return { path, selectors, total: selectors.reduce((n, s) => n + s.clicks, 0) };
    })
    .sort((a, b) => b.total - a.total);
  return { routes, rageTotal };
}

/* ---------------- diagnosis brief ---------------- */

/** Minimum attempts-with-click-data before diagnosis is offered — below this,
    a confident "why" would be noise. */
export const DIAGNOSIS_MIN_SESSIONS = 5;

export interface DiagnosisFinding {
  observation: string;
  evidence: string;
  hypothesis: string;
  fix: string;
  confidence: "high" | "medium" | "low";
}
export interface Diagnosis {
  summary: string;
  findings: DiagnosisFinding[];
  caveat?: string;
}

export interface DiagnosisBrief {
  task: string;
  successPattern: string | null;
  screens: string[];
  attempts: number;
  outcomes: Record<string, number>;
  pathsBySucceeded: { path: string; sessions: number }[];
  pathsByFailed: { path: string; sessions: number }[];
  topClicks: { path: string; element: string; clicks: number; rage: number; navigations: number }[];
  rageTotal: number;
  layoutMix: { desktop: number; mobile: number; unknown: number };
  verbatims: { prompt: string; outcome: string; text: string }[];
}

const isSuccess = (o?: string) => o === "success-auto" || o === "success-reported";
const MOBILE_MAX_VW = 768;

/** Redactor is injected so this module stays free of the client-only AI layer;
    the caller passes lib/ai's redactIfEnabled (identity is fine for tests). */
export function buildDiagnosisBrief(
  block: Extract<TestBlock, { type: "app-task" }>,
  results: TestBlockResult[],
  redact: (s: string) => string = (s) => s,
): DiagnosisBrief {
  const withBeacon = results.filter((r) => (r.beaconEvents?.length ?? 0) > 0);

  const outcomes: Record<string, number> = {};
  for (const r of results) if (r.outcome) outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;

  const aggPaths = (subset: TestBlockResult[]) => {
    const m = new Map<string, number>();
    for (const r of subset) {
      const key = (r.beaconEvents ?? []).filter((e) => e.type === "page").map((e) => e.path).join(" → ") || "—";
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([path, sessions]) => ({ path, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 6);
  };

  const { routes, rageTotal } = aggregateClicks(results);
  const topClicks = routes
    .flatMap((route) => route.selectors.map((s) => ({ path: route.path, element: s.sel, clicks: s.clicks, rage: s.rage, navigations: s.navigations })))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 12);

  // Layout per session from the first click that carries viewport width.
  const layoutMix = { desktop: 0, mobile: 0, unknown: 0 };
  for (const r of withBeacon) {
    const vw = (r.beaconEvents ?? []).find((e) => e.type === "click" && e.vw !== undefined)?.vw;
    if (vw === undefined) layoutMix.unknown++;
    else if (vw < MOBILE_MAX_VW) layoutMix.mobile++;
    else layoutMix.desktop++;
  }

  // Redacted free-text answers, tagged with the session's outcome so the model
  // can tie what people said to whether they succeeded.
  const openQs = block.followUpQuestions.filter((q) => q.type === "open" || q.type === "input");
  const verbatims: DiagnosisBrief["verbatims"] = [];
  for (const r of results) {
    // The built-in "why" field next to the outcome choice — prime signal.
    if (r.outcomeComment?.trim()) {
      verbatims.push({
        prompt: "Why did it go that way? (outcome comment)",
        outcome: r.outcome ?? "unknown",
        text: redact(r.outcomeComment.trim()).slice(0, 300),
      });
    }
    for (const q of openQs) {
      const a = r.answers?.[q.id];
      if (typeof a === "string" && a.trim()) {
        verbatims.push({
          prompt: q.prompt,
          outcome: r.outcome ?? "unknown",
          text: redact(a.trim()).slice(0, 300),
        });
      }
    }
  }

  return {
    task: block.instructions,
    successPattern: block.successUrlPattern ?? null,
    screens: (block.routeScreenshots ?? []).map((rs) => rs.pattern || "all pages"),
    attempts: results.filter((r) => r.outcome).length,
    outcomes,
    pathsBySucceeded: aggPaths(results.filter((r) => isSuccess(r.outcome))),
    pathsByFailed: aggPaths(results.filter((r) => r.outcome === "gave-up")),
    topClicks,
    rageTotal,
    layoutMix,
    verbatims: verbatims.slice(0, 40),
  };
}

/* ---------------- AI prompt ---------------- */

export const DIAGNOSIS_SYSTEM = [
  "You are a senior UX researcher diagnosing an unmoderated usability task from behavioral telemetry.",
  "You are given a compact brief: the task, outcome counts, the screen journeys of people who SUCCEEDED vs those who GAVE UP, the most-clicked elements (with rage-click and navigation counts), the desktop/mobile split, and redacted free-text comments.",
  "Diagnose WHY people struggled — contrast the failed journeys against the successful ones.",
  "Hard rules:",
  "- Use ONLY the numbers in the brief. Never invent screens, elements, or counts.",
  "- Every finding's `evidence` must cite specific numbers from the brief (e.g. \"8 of 11 who gave up…\").",
  "- If the data is thin or ambiguous, say so in `caveat` and lower each finding's `confidence`.",
  "- Prefer 2–4 findings, most important first. Each needs a concrete, actionable `fix`.",
].join("\n");

/** The user message payload for the AI call — the brief as JSON plus a nudge. */
export function diagnosisUserMessage(brief: DiagnosisBrief): string {
  return `Diagnose this task from the brief below.\n\n${JSON.stringify(brief, null, 2)}`;
}
