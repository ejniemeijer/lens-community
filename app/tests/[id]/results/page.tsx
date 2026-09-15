"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlignLeft,
  AppWindow,
  BarChart3,
  Check,
  ChevronDown,
  Copy,
  Download,
  Flame,
  Frame,
  Images,
  LayoutList,
  Lightbulb,
  MessageCircleQuestion,
  MessageSquareText,
  MousePointerClick,
  Play,
  RefreshCw,
  Sparkles,
  Timer,
  Trash2,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { getTest, getProject, currentUser, currentUserId } from "@/lib/db";
import { supabase } from "@/lib/supabase";
import { useApp, useDb } from "@/lib/store";
import { can, planHasFeature } from "@/lib/permissions";
import { HeatOverlay, ClickAnalytics, ReplayModal } from "@/components/tests/analytics";
import { AiDiagnosis } from "@/components/tests/ai-diagnosis";
import { TestReportModal } from "@/components/tests/test-report";
import { checkAiConfigured } from "@/lib/ai";
import { SessionDetail } from "@/components/tests/session-detail";
import { QuestionResults, type PromoteFn } from "@/components/tests/question-results";
import { blockEvidence } from "@/lib/tests-report";
import { BLOCK_ACCENTS, blockSummary } from "@/components/tests/block-editors";
import { exportTestResultsCsv, exportTestResultsJson } from "@/lib/test-export";
import { cn, globMatch, testShareUrl, uid } from "@/lib/utils";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import type { TestBlock, TestBlockResult, TestQuestion, TestSession } from "@/lib/types";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Label, Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm";
import { MissingRecord } from "@/components/ui/missing-record";

const BLOCK_ICONS: Record<TestBlock["type"], LucideIcon> = {
  message: AlignLeft,
  questions: MessageCircleQuestion,
  "first-click": MousePointerClick,
  "app-task": AppWindow,
  "figma-proto": Frame,
  preference: Images,
  "five-second": Timer,
  "design-feedback": MessageSquareText,
};


/* ---------------- data ---------------- */

interface SessionRow extends TestSession {
  device?: { viewportW?: number; viewportH?: number; pointer?: "touch" | "mouse" };
}

function fromDbRow(r: Record<string, unknown>): SessionRow {
  return {
    id: r.id as string,
    testId: r.test_id as string,
    status: r.status as SessionRow["status"],
    consentGivenAt: r.consent_given_at as string,
    device: (r.device ?? undefined) as SessionRow["device"],
    results: (r.results ?? {}) as Record<string, TestBlockResult>,
    startedAt: r.started_at as string,
    completedAt: (r.completed_at ?? undefined) as string | undefined,
  };
}

/* ---------------- formatting ---------------- */

const fmtMs = (ms?: number) => {
  if (ms === undefined) return "—";
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const median = (xs: number[]) => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const pct = (n: number, of: number) => (of === 0 ? "—" : `${Math.round((n / of) * 100)}%`);

/* ---------------- small viz ---------------- */

function Stat({
  label,
  value,
  hint,
  icon,
  accent,
  ringPct,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** Icon shown in a soft tinted bubble (accent-* class from globals). */
  icon?: React.ReactNode;
  accent?: string;
  /** Renders a completion ring instead of the icon bubble. */
  ringPct?: number;
}) {
  return (
    <div className={cn(accent ? `accent-${accent}` : "", "rounded-lg border border-border bg-surface p-4")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs text-subtle">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {hint && <p className="mt-0.5 truncate text-2xs text-subtle">{hint}</p>}
        </div>
        {ringPct !== undefined ? (
          <span
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: `conic-gradient(hsl(var(--success)) ${Math.max(0, Math.min(100, ringPct))}%, hsl(var(--surface-2)) 0)` }}
            aria-hidden
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-2xs font-semibold text-foreground">
              {Math.round(ringPct)}%
            </span>
          </span>
        ) : icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]" aria-hidden>
            {icon}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- per-block panels ---------------- */

function FirstClickResults({
  block,
  results,
  analytics,
  aiSummary = false,
  onPromote,
}: {
  block: Extract<TestBlock, { type: "first-click" }>;
  results: TestBlockResult[];
  analytics: boolean;
  aiSummary?: boolean;
  onPromote?: PromoteFn;
}) {
  const clicks = results.filter((r) => r.click);
  const times = clicks.map((r) => r.timeToClickMs).filter((t): t is number => t !== undefined);
  const [view, setView] = React.useState<"dots" | "heat">("dots");
  const [imgFailed, setImgFailed] = React.useState(false);
  return (
    <div className="flex flex-col gap-3">
      {analytics && clicks.length > 0 && !imgFailed && (
        <div className="flex gap-1.5">
          {(["dots", "heat"] as const).map((v) => (
            <Button key={v} variant={view === v ? "secondary" : "ghost"} size="sm" onClick={() => setView(v)}>
              {v === "dots" ? "Dots" : "Heatmap"}
            </Button>
          ))}
        </div>
      )}
      {imgFailed ? (
        <div className="flex max-w-xl flex-col items-center gap-1 rounded-lg border border-dashed border-border bg-surface-2 p-6 text-center">
          <p className="text-xs font-medium text-foreground">The image can&apos;t be displayed</p>
          <p className="text-2xs text-subtle">
            The link doesn&apos;t load as an image (expired, blocked, or not a direct image URL). Clicks are still
            recorded — edit the block and upload a screenshot to see them plotted.
          </p>
        </div>
      ) : (
        // w-full sizing (not w-fit) so SVGs without intrinsic dimensions still
        // render at a visible size instead of collapsing to 0×0.
        <div className="relative w-full max-w-xl overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.imageUrl}
            alt="First-click results"
            className="max-h-96 w-full select-none object-contain"
            draggable={false}
            onError={() => setImgFailed(true)}
          />
          {view === "heat" && analytics ? (
            <HeatOverlay points={clicks.map((r) => r.click!)} />
          ) : (
            clicks.map((r, i) => (
              <span
                key={i}
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary/75 shadow"
                style={{ left: `${r.click!.x * 100}%`, top: `${r.click!.y * 100}%` }}
              />
            ))
          )}
        </div>
      )}
      <p className="text-xs text-subtle">
        {clicks.length} click{clicks.length === 1 ? "" : "s"} · median time to click{" "}
        <span className="font-medium text-foreground">{fmtMs(median(times))}</span>
      </p>
      {block.followUpQuestions.length > 0 && (
        <QuestionResults questions={block.followUpQuestions} answers={results.map((r) => r.answers ?? {})} aiReady={aiSummary} onPromote={onPromote} />
      )}
    </div>
  );
}

function PreferenceResults({ block, results, aiSummary = false, onPromote }: { block: Extract<TestBlock, { type: "preference" }>; results: TestBlockResult[]; aiSummary?: boolean; onPromote?: PromoteFn }) {
  const votes = results.filter((r) => r.choice);
  // Highlight the winner (only when there's a unique leader with votes).
  const counts = block.options.map((o) => votes.filter((r) => r.choice === o.id).length);
  const max = Math.max(0, ...counts);
  const winnerId = max > 0 && counts.filter((n) => n === max).length === 1 ? block.options[counts.indexOf(max)].id : null;
  return (
    <div className="flex flex-col gap-3">
      <div className={`grid gap-3 ${block.options.length > 2 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2"}`}>
        {block.options.map((o, i) => {
          const n = votes.filter((r) => r.choice === o.id).length;
          const share = votes.length ? n / votes.length : 0;
          const isWinner = o.id === winnerId;
          return (
            <div key={o.id} className={cn("overflow-hidden rounded-lg border", isWinner ? "border-success ring-1 ring-success" : "border-border")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imageUrl} alt={o.label ?? `Option ${i + 1}`} className="max-h-48 w-full object-contain" />
              <div className="border-t border-border p-2.5">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  {o.label || `Option ${String.fromCharCode(65 + i)}`}
                  {isWinner && <Badge tone="success">Most preferred</Badge>}
                  <span className="ml-auto text-subtle">
                    {n} vote{n === 1 ? "" : "s"} · {pct(n, votes.length)}
                  </span>
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className={cn("h-full rounded-full", isWinner ? "bg-success" : "bg-primary/60")} style={{ width: `${share * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {block.followUpQuestions.length > 0 && (
        <QuestionResults questions={block.followUpQuestions} answers={results.map((r) => r.answers ?? {})} aiReady={aiSummary} onPromote={onPromote} />
      )}
    </div>
  );
}

/** Outcome mix for a task block as one stacked bar + legend. Traffic-light
    order (green · amber · red) keeps the poles apart — palette validated for
    CVD; legend labels carry identity, not color. Shared by the app-task and
    Figma-prototype panels. */
function OutcomeBar({ results }: { results: TestBlockResult[] }) {
  const outcomes = results.filter((r) => r.outcome);
  if (outcomes.length === 0) return <p className="text-xs text-subtle">No attempts yet.</p>;
  const auto = outcomes.filter((r) => r.outcome === "success-auto").length;
  const rep = outcomes.filter((r) => r.outcome === "success-reported").length;
  const gaveUp = outcomes.filter((r) => r.outcome === "gave-up").length;
  const skipped = outcomes.filter((r) => r.outcome === "skipped").length;
  const segments = [
    {
      key: "completed",
      n: auto + rep,
      cls: "bg-success",
      label: "Completed",
      note: auto && rep ? `${auto} detected · ${rep} self-reported` : auto ? "detected" : "self-reported",
    },
    { key: "skipped", n: skipped, cls: "bg-warning", label: "Skipped", note: null },
    { key: "gave-up", n: gaveUp, cls: "bg-[hsl(356_64%_45%)] dark:bg-danger", label: "Gave up", note: null },
  ].filter((s) => s.n > 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.key}
            className={cn(s.cls, "h-full rounded-[2px] first:rounded-l-full last:rounded-r-full")}
            style={{ width: `${(s.n / outcomes.length) * 100}%`, minWidth: 10 }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted">
            <span className={cn(s.cls, "h-2 w-2 rounded-full")} aria-hidden />
            <span className="font-medium text-foreground">{s.label}</span> {s.n}
            {s.note && <span className="text-subtle">({s.note})</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Participants' own words on their outcome, tinted by what they reported. */
function OutcomeComments({ results }: { results: TestBlockResult[] }) {
  const withComment = results.filter((r) => r.outcomeComment);
  if (withComment.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">In their words</p>
      {withComment.map((r, ci) => (
        <div key={ci} className="flex items-start gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
          <span
            className={cn(
              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
              r.outcome === "gave-up" ? "bg-[hsl(356_64%_45%)] dark:bg-danger" : "bg-success",
            )}
            title={r.outcome === "gave-up" ? "Gave up" : "Completed"}
          />
          <p className="text-[13px] text-muted">“{r.outcomeComment}”</p>
        </div>
      ))}
    </div>
  );
}

function FigmaProtoResults({
  block,
  results,
  aiSummary,
  onPromote,
}: {
  block: Extract<TestBlock, { type: "figma-proto" }>;
  results: TestBlockResult[];
  aiSummary: boolean;
  onPromote?: PromoteFn;
}) {
  const explore = block.taskType === "explore";
  const outcomes = results.filter((r) => r.outcome);
  const succeeded = outcomes.filter((r) => r.outcome === "success-auto" || r.outcome === "success-reported");
  const durations = results.map((r) => r.durationMs).filter((d): d is number => d !== undefined);
  return (
    <div className="flex flex-col gap-3">
      {/* Free explore records no outcome — showing an empty outcome bar would
          read as "nobody finished" rather than "there was nothing to finish". */}
      {explore ? (
        <p className="text-xs text-subtle">
          Free explore · {results.length} visit{results.length === 1 ? "" : "s"} · median time in the prototype{" "}
          <span className="font-medium text-foreground">{fmtMs(median(durations))}</span>
        </p>
      ) : (
        <>
          <OutcomeBar results={results} />
          {outcomes.length > 0 && (
            <p className="text-xs text-subtle">
              Success rate <span className="font-medium text-foreground">{pct(succeeded.length, outcomes.length)}</span> ·
              median time on task <span className="font-medium text-foreground">{fmtMs(median(durations))}</span>
            </p>
          )}
          <OutcomeComments results={results} />
        </>
      )}
      {block.followUpQuestions.length > 0 && (
        <QuestionResults questions={block.followUpQuestions} answers={results.map((r) => r.answers ?? {})} aiReady={aiSummary} onPromote={onPromote} />
      )}
      <p className="text-2xs text-subtle">
        Embedded prototypes report {explore ? "answers and time" : "outcome and answers"} only — Figma&apos;s click
        events don&apos;t fire for participants without a Figma account. Use an App task block for click-level data.
      </p>
    </div>
  );
}

function AppTaskResults({
  block,
  results,
  analytics,
  aiReady,
  aiSummary,
  onPromote,
}: {
  block: Extract<TestBlock, { type: "app-task" }>;
  results: TestBlockResult[];
  analytics: boolean;
  aiReady: boolean;
  aiSummary: boolean;
  onPromote?: PromoteFn;
}) {
  const outcomes = results.filter((r) => r.outcome);
  const succeeded = outcomes.filter((r) => r.outcome === "success-auto" || r.outcome === "success-reported");
  const withBeacon = results.filter((r) => (r.beaconEvents?.length ?? 0) > 0);
  const durations = results.map((r) => r.durationMs).filter((d): d is number => d !== undefined);
  const [showAllPaths, setShowAllPaths] = React.useState(false);
  const [tab, setTab] = React.useState<"overview" | "heatmaps" | "detail">("overview");
  const [zoomShot, setZoomShot] = React.useState<{ imageUrl: string; clicks: { x: number; y: number }[]; label: string } | null>(null);

  // Aggregate identical journeys instead of one row per session — with many
  // sessions the panel stays bounded.
  const pathRows = React.useMemo(() => {
    const agg = new Map<string, { sessions: number; clicks: number }>();
    for (const r of withBeacon) {
      const key = (r.beaconEvents ?? []).filter((e) => e.type === "page").map((e) => e.path).join(" → ") || "—";
      const clicks = (r.beaconEvents ?? []).filter((e) => e.type === "click").length;
      const cur = agg.get(key) ?? { sessions: 0, clicks: 0 };
      agg.set(key, { sessions: cur.sessions + 1, clicks: cur.clicks + clicks });
    }
    return [...agg.entries()].sort((a, b) => b[1].sessions - a[1].sessions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results]);
  const PATHS_SHOWN = 5;
  const visiblePaths = showAllPaths ? pathRows : pathRows.slice(0, PATHS_SHOWN);

  const hasBeacon = withBeacon.length > 0;
  const hasHeatmaps = analytics && (block.routeScreenshots ?? []).some((rs) => rs.imageUrl);
  const hasDetail = analytics && hasBeacon;
  const tabs = [
    { key: "overview" as const, label: "Overview", Icon: LayoutList },
    ...(hasHeatmaps ? [{ key: "heatmaps" as const, label: "Heatmaps", Icon: Flame }] : []),
    ...(hasDetail ? [{ key: "detail" as const, label: "Click detail", Icon: MousePointerClick }] : []),
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : "overview";

  // Shown in Overview, or standalone when there's no click data (comments
  // don't need the beacon).
  const commentsBlock = <OutcomeComments results={results} />;

  const pathsBlock = (
    <div className="flex flex-col gap-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">
        Screen paths <span className="normal-case">· {pathRows.length} unique</span>
      </p>
      {visiblePaths.map(([path, agg]) => (
        <div key={path} className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5">
          <p className="min-w-0 flex-1 truncate font-mono text-xs text-muted" title={path}>{path}</p>
          <span className="shrink-0 text-2xs text-subtle">
            ×{agg.sessions} session{agg.sessions === 1 ? "" : "s"} · {agg.clicks} click{agg.clicks === 1 ? "" : "s"}
          </span>
        </div>
      ))}
      {pathRows.length > PATHS_SHOWN && (
        <button className="self-start text-xs font-medium text-primary hover:underline" onClick={() => setShowAllPaths((v) => !v)}>
          {showAllPaths ? "Show fewer" : `Show all ${pathRows.length} paths`}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      {/* compact header: outcome bar + one-line stats */}
      <OutcomeBar results={results} />
      {outcomes.length > 0 && (
        <p className="text-xs text-subtle">
          Success rate <span className="font-medium text-foreground">{pct(succeeded.length, outcomes.length)}</span> · median
          time on task <span className="font-medium text-foreground">{fmtMs(median(durations))}</span> ·{" "}
          {withBeacon.length} of {results.length} session{results.length === 1 ? "" : "s"} include click data
        </p>
      )}

      {hasBeacon && (
        <>
          {tabs.length > 1 && (
            <div className="inline-flex self-start gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active === t.key
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  <t.Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {active === "overview" && (
            <div className="flex flex-col gap-3">
              {pathsBlock}
              {commentsBlock}
              {!analytics && (
                <p className="text-xs text-subtle">
                  Click maps, heatmaps, session replay, and AI diagnosis are a <Badge tone="primary">Team</Badge> feature.
                </p>
              )}
              {aiReady && <AiDiagnosis block={block} results={results} onPromote={onPromote} />}
            </div>
          )}

          {active === "heatmaps" && (
            <div className="flex flex-col gap-3">
              {(block.routeScreenshots ?? [])
                .filter((rs) => rs.imageUrl)
                .map((rs, rsIndex) => {
                  // Empty pattern = "all pages". Prefer v2 document-relative
                  // coords (scroll-corrected); fall back to viewport-relative.
                  const clicks = results
                    .flatMap((r) =>
                      (r.beaconEvents ?? []).filter(
                        (e) => e.type === "click" && (rs.pattern ? globMatch(e.path, rs.pattern) : true),
                      ),
                    )
                    .map((e) => ({ x: e.dx ?? e.x, y: e.dy ?? e.y }))
                    .filter((p): p is { x: number; y: number } => p.x !== undefined && p.y !== undefined);
                  const label = `${rs.pattern || "all pages"} · ${clicks.length} click${clicks.length === 1 ? "" : "s"}`;
                  return (
                    <div key={`${rs.pattern}-${rsIndex}`} className="flex flex-col gap-1.5">
                      <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">
                        <span className="font-mono normal-case">{rs.pattern || "all pages"}</span> · {clicks.length} click
                        {clicks.length === 1 ? "" : "s"}
                        <span className="ml-2 font-normal normal-case tracking-normal">click to enlarge</span>
                      </p>
                      <button
                        className="relative w-fit cursor-zoom-in overflow-hidden rounded-lg border border-border text-left transition-shadow hover:shadow-md"
                        onClick={() => setZoomShot({ imageUrl: rs.imageUrl, clicks, label })}
                        aria-label={`Enlarge heatmap for ${rs.pattern || "all pages"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={rs.imageUrl} alt={`Screenshot of ${rs.pattern}`} className="max-h-80 select-none" draggable={false} />
                        <HeatOverlay points={clicks} />
                      </button>
                    </div>
                  );
                })}
            </div>
          )}

          {active === "detail" && (
            <div className="flex flex-col gap-2">
              <p className="text-2xs text-subtle">Raw element clicks per screen — the selectors participants tapped.</p>
              <ClickAnalytics results={results} />
            </div>
          )}
        </>
      )}
      {!hasBeacon && commentsBlock}

      {block.followUpQuestions.length > 0 && (
        <QuestionResults questions={block.followUpQuestions} answers={results.map((r) => r.answers ?? {})} aiReady={aiSummary} onPromote={onPromote} />
      )}
      {zoomShot && (
        <div
          className="fixed inset-0 z-[110] flex cursor-zoom-out items-start justify-center bg-[hsl(224_40%_8%/0.85)] p-4 sm:p-8"
          onClick={() => setZoomShot(null)}
        >
          {/* Scroll (not letterbox) tall screenshots so the heat overlay stays
              aligned with the image box. */}
          <div className="max-h-full w-[min(1400px,94vw)] overflow-auto rounded-lg shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="relative w-full cursor-default">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoomShot.imageUrl} alt="Click heatmap (enlarged)" className="w-full select-none" draggable={false} />
              <HeatOverlay points={zoomShot.clicks} />
            </div>
          </div>
          <div className="pointer-events-none fixed left-1/2 top-3 -translate-x-1/2 rounded-full bg-surface px-3 py-1 font-mono text-xs text-muted shadow">
            {zoomShot.label}
          </div>
          <button
            className="fixed right-4 top-3 rounded-full bg-surface p-2.5 text-foreground shadow"
            onClick={() => setZoomShot(null)}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function TestResultsPage() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const backend = useApp((s) => s.backend);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const account = useApp((s) => s.account);
  const analytics = planHasFeature(account?.plan, "test-analytics");
  const addInsight = useApp((s) => s.addInsight);
  const logExport = useApp((s) => s.logExport);
  const toast = useApp((s) => s.toast);

  const [sessions, setSessions] = React.useState<SessionRow[] | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  // Collapsible block cards — all closed by default; header toggles.
  const [expandedBlocks, setExpandedBlocks] = React.useState<Set<string>>(new Set());
  const toggleBlock = (id: string) =>
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const [deleteSession, setDeleteSession] = React.useState<string | null>(null);
  const [replaySession, setReplaySession] = React.useState<SessionRow | null>(null);
  const [expandedSession, setExpandedSession] = React.useState<string | null>(null);
  const [showPromote, setShowPromote] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [insightTitle, setInsightTitle] = React.useState("");
  const [insightEvidence, setInsightEvidence] = React.useState("");
  const [linkCopied, setLinkCopied] = React.useState(false);
  // AI "why" diagnosis is offered only when analytics (Team) + this role may
  // use AI + a provider key is actually configured. Checked once on mount.
  const [aiConfigured, setAiConfigured] = React.useState(false);
  React.useEffect(() => {
    if (backend !== "cloud" || !can(role, "use-ai") || currentUser().aiEnabled === false) return;
    let cancelled = false;
    void checkAiConfigured().then((ok) => {
      if (!cancelled) setAiConfigured(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [backend, role]);
  // Text summary of open answers: any plan, needs only use-ai + a key. The
  // per-member AI switch is honoured here too — the AI Assistant page already
  // checked it, so without this an admin could disable AI for someone and
  // still leave them the AI report button.
  const aiAllowed = can(role, "use-ai") && currentUser().aiEnabled !== false;
  const aiUsable = aiAllowed && aiConfigured;
  // Behavioral diagnosis: additionally Team (analytics).
  const aiReady = analytics && aiUsable;

  // Open the promote-to-insight modal pre-filled (used by the AI diagnosis).
  const openPromote = React.useCallback((title: string, evidence: string) => {
    setInsightTitle(title.slice(0, 200));
    setInsightEvidence(evidence);
    setShowPromote(true);
  }, []);

  const test = getTest(id);

  const load = React.useCallback(async () => {
    if (!supabase) return setSessions([]);
    const { data, error } = await supabase
      .from("test_sessions")
      .select("*")
      .eq("test_id", id)
      .order("started_at", { ascending: false });
    if (error) return setLoadError(error.message);
    setLoadError(null);
    setSessions((data ?? []).map(fromDbRow));
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (!test) return <MissingRecord hydrated={hydrated} />;

  const project = getProject(test.projectId);
  const rows = sessions ?? [];
  const completed = rows.filter((s) => s.status === "completed");
  const durations = completed
    .filter((s) => s.completedAt)
    .map((s) => new Date(s.completedAt!).getTime() - new Date(s.startedAt).getTime());
  const shareUrl = testShareUrl(test.shareToken);

  // A block "reached" = the session recorded a result for it (blocks flush on
  // advance, so this measures completion of each step).
  const blockResults = (blockId: string) => rows.map((s) => s.results[blockId]).filter(Boolean) as TestBlockResult[];

  const taskBlocks = test.blocks.filter((b) => b.type === "app-task" || b.type === "first-click");
  const defaultEvidence = () => {
    const parts: string[] = [`${rows.length} sessions, ${completed.length} completed (${pct(completed.length, rows.length)}).`];
    for (const b of taskBlocks) {
      const res = blockResults(b.id);
      if (b.type === "app-task") {
        const withOutcome = res.filter((r) => r.outcome);
        const ok = res.filter((r) => r.outcome === "success-auto" || r.outcome === "success-reported");
        if (withOutcome.length)
          parts.push(`“${b.instructions}”: ${ok.length}/${withOutcome.length} succeeded, median ${fmtMs(median(res.map((r) => r.durationMs).filter((d): d is number => d !== undefined)))}.`);
      }
    }
    return parts.join(" ");
  };

  const promote = () => {
    const insight = {
      id: uid("in"),
      title: insightTitle.trim(),
      description: `Finding from unmoderated test “${test.name}”.`,
      evidence: insightEvidence.trim(),
      type: "observation" as const,
      createdDate: new Date().toISOString().slice(0, 10),
      createdById: currentUserId,
      participantIds: [],
      interviewIds: [],
      testIds: [test.id],
      projectIds: [test.projectId],
      themeIds: [],
      tagIds: [],
      productArea: project?.productArea ?? "Platform",
      personaIds: [],
    };
    addInsight(insight);
    setShowPromote(false);
    toast("Insight created from test results", "success");
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tests", href: "/tests" }, { label: test.name, href: `/tests/${test.id}` }, { label: "Results" }]}
        icon={
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <BarChart3 className="h-5 w-5" />
          </span>
        }
        title={`${test.name} — results`}
        description={`${project?.name ?? "—"} · ${rows.length} session${rows.length === 1 ? "" : "s"}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            {/* Shown disabled rather than hidden when the workspace has no key
                for its provider: a researcher who simply sees fewer buttons
                than an admin has no way to know it's a setup gap. */}
            {aiAllowed && rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                disabled={!aiConfigured}
                title={
                  aiConfigured
                    ? undefined
                    : "No AI key is set for this workspace's provider — an admin can add one in Settings → AI configuration."
                }
                onClick={() => setShowReport(true)}
              >
                {/* text-primary marks an AI action on an outline button, as on
                    "Find duplicates" and "Ask AI". */}
                <Sparkles className="h-4 w-4 text-primary" /> AI report
              </Button>
            )}
            {can(role, "export") && rows.length > 0 && (
              <Menu>
                <MenuTrigger>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4" /> Export
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem
                    onSelect={() => {
                      exportTestResultsCsv(test, rows);
                      logExport(`Test results (CSV) — ${test.name}`, currentUser().name);
                    }}
                  >
                    CSV — one row per session
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      exportTestResultsJson(test, project, rows);
                      logExport(`Test results (JSON) — ${test.name}`, currentUser().name);
                    }}
                  >
                    JSON — full sessions
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
            {canManage && rows.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setInsightTitle(`Usability test: ${test.name}`);
                  setInsightEvidence(defaultEvidence());
                  setShowPromote(true);
                }}
              >
                <Lightbulb className="h-4 w-4" /> Promote to insight
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        {backend !== "cloud" ? (
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="Results live in your cloud workspace"
            description="Participant sessions are stored in Supabase. Sign in to a cloud workspace to see them — the local sandbox doesn't collect sessions."
          />
        ) : loadError ? (
          <EmptyState icon={<X className="h-5 w-5" />} title="Couldn't load sessions" description={loadError} />
        ) : sessions === null ? (
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<BarChart3 className="h-5 w-5" />}
            title="No sessions yet"
            description={test.status === "active" ? "Share the link to start collecting responses." : "Publish the test, then share the link."}
            action={
              test.status === "active" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(shareUrl);
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 1500);
                  }}
                >
                  {linkCopied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />} Copy share link
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => router.push(`/tests/${test.id}`)}>
                  Open the builder
                </Button>
              )
            }
          />
        ) : (
          <div className="flex flex-col gap-6">
            {/* Headline stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Sessions" value={rows.length} hint="consented starts" accent="indigo" icon={<Users className="h-[18px] w-[18px]" />} />
              <Stat
                label="Completed"
                value={completed.length}
                hint="of all sessions"
                ringPct={rows.length ? (completed.length / rows.length) * 100 : 0}
              />
              <Stat label="Median duration" value={fmtMs(median(durations))} hint="completed sessions" accent="amber" icon={<Timer className="h-[18px] w-[18px]" />} />
              <Stat
                label="Click data"
                accent="blue"
                icon={<MousePointerClick className="h-[18px] w-[18px]" />}
                value={rows.filter((s) => Object.values(s.results).some((r) => (r.beaconEvents?.length ?? 0) > 0)).length}
                hint={(() => {
                  // Freshness signal: a live test that stops receiving beacon
                  // data (e.g. app republished without the snippet) shows up here.
                  const last = rows
                    .filter((s) => Object.values(s.results).some((r) => (r.beaconEvents?.length ?? 0) > 0))
                    .map((s) => s.startedAt)
                    .sort()
                    .at(-1);
                  return last ? `last received ${new Date(last).toLocaleString()}` : "sessions with beacon events";
                })()}
              />
            </div>

            {/* Per-block funnel + detail. Message blocks carry no data worth a
                section: consent is implied by the session existing at all. */}
            <div className="flex flex-col gap-4">
              {test.blocks.filter((b) => b.type !== "message").map((b, i) => {
                const res = blockResults(b.id);
                const Icon = BLOCK_ICONS[b.type];
                const open = expandedBlocks.has(b.id);
                return (
                  <div
                    key={b.id}
                    className={cn(
                      `accent-${BLOCK_ACCENTS[b.type]}`,
                      // Dashboard-style colored left edge instead of a progress
                      // line — one calm identity accent per card.
                      "rounded-lg border border-border border-l-[3px] border-l-[hsl(var(--a-solid))] bg-surface p-4",
                    )}
                  >
                    <button
                      className="flex w-full items-center gap-2.5 text-left"
                      onClick={() => toggleBlock(b.id)}
                      aria-expanded={open}
                    >
                      <ChevronDown className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", !open && "-rotate-90")} aria-hidden />
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--a-bg))]" aria-hidden>
                        <Icon className="h-4 w-4 text-[hsl(var(--a-fg))]" />
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                        {i + 1}. {blockSummary(b)}
                      </p>
                      <span className="shrink-0 text-xs text-subtle">
                        {res.length} of {rows.length} completed · {pct(res.length, rows.length)}
                      </span>
                    </button>
                    {/* Hidden, not unmounted — collapsing keeps panel state
                        (fetched AI diagnosis, selected tab). */}
                    {(
                      <div className={cn("mt-3", !open && "hidden")}>
                        {/* Promote at the block grain — one task/question's
                            results, prefilled with that block's facts (the
                            same lines the AI report's appendix carries). */}
                        {canManage && res.length > 0 && (
                          <button
                            className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            onClick={() => openPromote(blockSummary(b), blockEvidence(b, res, rows.length))}
                          >
                            <Lightbulb className="h-3.5 w-3.5" /> Promote this block&apos;s results to an insight
                          </button>
                        )}
                        {b.type === "questions" && <QuestionResults questions={b.questions} answers={res.map((r) => r.answers ?? {})} aiReady={aiUsable} onPromote={canManage ? openPromote : undefined} />}
                        {b.type === "first-click" && <FirstClickResults block={b} results={res} analytics={analytics} aiSummary={aiUsable} onPromote={canManage ? openPromote : undefined} />}
                        {b.type === "app-task" && <AppTaskResults block={b} results={res} analytics={analytics} aiReady={aiReady} aiSummary={aiUsable} onPromote={canManage ? openPromote : undefined} />}
                        {b.type === "figma-proto" && <FigmaProtoResults block={b} results={res} aiSummary={aiUsable} onPromote={canManage ? openPromote : undefined} />}
                        {b.type === "preference" && <PreferenceResults block={b} results={res} aiSummary={aiUsable} onPromote={canManage ? openPromote : undefined} />}
                        {b.type === "five-second" && (
                          <QuestionResults questions={b.questions} answers={res.map((r) => r.answers ?? {})} aiReady={aiUsable} onPromote={canManage ? openPromote : undefined} />
                        )}
                        {b.type === "design-feedback" && (
                          <div className="flex flex-col gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={b.imageUrl}
                              alt="Reviewed design"
                              className="max-h-48 w-fit max-w-full rounded-lg border border-border object-contain"
                            />
                            <QuestionResults questions={b.questions} answers={res.map((r) => r.answers ?? {})} aiReady={aiUsable} onPromote={canManage ? openPromote : undefined} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Session list */}
            <div>
              <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">Sessions</h2>
              <div className="flex flex-col gap-1.5">
                {rows.map((s) => {
                  const done = Object.keys(s.results).length;
                  const hasBeacon = Object.values(s.results).some((r) => (r.beaconEvents?.length ?? 0) > 0);
                  const expanded = expandedSession === s.id;
                  return (
                    <div key={s.id} className="overflow-hidden rounded-lg border border-border bg-surface">
                      <div
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-hover"
                        onClick={() => setExpandedSession(expanded ? null : s.id)}
                      >
                        {/* Same disclosure convention as the block cards: ▸ closed → ▾ open. */}
                        <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-subtle transition-transform", !expanded && "-rotate-90")} />
                        <Badge tone={s.status === "completed" ? "success" : s.status === "abandoned" ? "warning" : "neutral"} dot>
                          {s.status}
                        </Badge>
                        <span className="text-xs text-muted">{new Date(s.startedAt).toLocaleString()}</span>
                        <span className="text-xs text-subtle">
                          {done} of {test.blocks.length} steps
                          {s.device?.pointer ? ` · ${s.device.pointer}` : ""}
                          {s.completedAt
                            ? ` · ${fmtMs(new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime())}`
                            : ""}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          {analytics && hasBeacon && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setReplaySession(s);
                              }}
                            >
                              <Play className="h-3.5 w-3.5" /> Replay
                            </Button>
                          )}
                          {canManage && (
                            <button
                              className="rounded p-1 text-subtle hover:text-danger"
                              aria-label="Delete session"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteSession(s.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </div>
                      {expanded && <SessionDetail blocks={test.blocks} session={s} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </PageBody>

      <Modal
        open={showPromote}
        onClose={() => setShowPromote(false)}
        title="Promote to insight"
        description="Creates a repository insight linked to this test's project, with the stats as evidence."
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setShowPromote(false)}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!insightTitle.trim()} onClick={promote}>Create insight</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label>Title</Label>
            <Input value={insightTitle} onChange={(e) => setInsightTitle(e.target.value)} />
          </div>
          <div>
            <Label>Evidence</Label>
            <Textarea rows={4} value={insightEvidence} onChange={(e) => setInsightEvidence(e.target.value)} />
          </div>
        </div>
      </Modal>

      <ReplayModal
        open={replaySession !== null}
        onClose={() => setReplaySession(null)}
        blocks={test.blocks}
        results={replaySession?.results ?? {}}
        viewport={replaySession?.device}
      />

      <TestReportModal open={showReport} onClose={() => setShowReport(false)} test={test} project={project} sessions={rows} />

      <ConfirmDialog
        open={deleteSession !== null}
        onClose={() => setDeleteSession(null)}
        danger
        title="Delete this session?"
        body={<>Permanently removes this participant&apos;s recorded session (e.g. on an erasure request). This cannot be undone.</>}
        confirmLabel="Delete session"
        onConfirm={async () => {
          if (!supabase || !deleteSession) return;
          const { error } = await supabase.from("test_sessions").delete().eq("id", deleteSession);
          if (error) toast(`Couldn't delete: ${error.message}`, "error");
          else {
            toast("Session deleted", "info");
            void load();
          }
          setDeleteSession(null);
        }}
      />
    </>
  );
}
