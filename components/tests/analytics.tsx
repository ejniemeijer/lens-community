"use client";

import * as React from "react";
import { Pause, Play, X } from "lucide-react";
import type { TestBeaconEvent, TestBlock, TestBlockResult } from "@/lib/types";
import { globMatch } from "@/lib/utils";
import { aggregateClicks } from "@/lib/tests-diagnosis";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Test analytics built entirely from data the beacon already collects —
 * clicks (normalized viewport coords + element selector), route views, and
 * timestamps. No pixels, no DOM, no content: everything here stays inside
 * the privacy posture documented in docs/data-protection.md.
 */

/* ---------------- first-click heat rendering ---------------- */

// Cold → hot color ramp for the density map.
const RAMP: [number, number, number][] = [
  [37, 99, 235], // blue
  [6, 182, 212], // cyan
  [132, 204, 22], // lime
  [250, 204, 21], // yellow
  [239, 68, 68], // red
];
function rampColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (RAMP.length - 1);
  const i = Math.min(RAMP.length - 2, Math.floor(x));
  const f = x - i;
  return [0, 1, 2].map((k) => Math.round(RAMP[i][k] + (RAMP[i + 1][k] - RAMP[i][k]) * f)) as [number, number, number];
}

/** Gaussian-ish density map over normalized points, drawn onto a canvas that
    overlays the parent element (which must be position: relative). */
export function HeatOverlay({ points }: { points: { x: number; y: number }[] }) {
  const ref = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = ref.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const draw = () => {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (!w || !h) return;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      // Accumulate soft blobs in the alpha channel…
      const r = Math.max(20, Math.min(w, h) * 0.055);
      for (const p of points) {
        const g = ctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, r);
        g.addColorStop(0, "rgba(0,0,0,0.4)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // …then map accumulated density through the color ramp.
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3];
        if (!a) continue;
        const [cr, cg, cb] = rampColor(a / 180);
        d[i] = cr;
        d[i + 1] = cg;
        d[i + 2] = cb;
        d[i + 3] = Math.min(215, a * 1.5);
      }
      ctx.putImageData(img, 0, 0);
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [points]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0" />;
}

/* Click aggregation moved to lib/tests-diagnosis.ts (pure, shared with the AI
   diagnosis); imported above. */

const TOP_SELECTORS = 8;

export function ClickAnalytics({ results }: { results: TestBlockResult[] }) {
  const { routes, rageTotal } = React.useMemo(() => aggregateClicks(results), [results]);
  if (!routes.length) return null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <p className="text-2xs font-semibold uppercase tracking-wider text-subtle">Click map</p>
        {rageTotal > 0 && <Badge tone="danger">{rageTotal} rage click{rageTotal === 1 ? "" : "s"}</Badge>}
      </div>
      {routes.map((r) => (
        <div key={r.path} className="rounded-lg border border-border bg-surface-2 p-3">
          <p className="mb-2 font-mono text-xs text-foreground">
            {r.path} <span className="text-subtle">· {r.total} click{r.total === 1 ? "" : "s"}</span>
          </p>
          <div className="flex flex-col gap-1">
            {r.selectors.slice(0, TOP_SELECTORS).map((s) => (
              <div key={s.sel} className="flex items-center gap-2 text-xs">
                <code className="min-w-0 flex-1 truncate text-muted">{s.sel}</code>
                <span className="w-14 shrink-0 text-right text-foreground">{s.clicks}×</span>
                <span className="w-24 shrink-0 text-right text-subtle">
                  {s.navigations > 0 ? `${Math.round((s.navigations / s.clicks) * 100)}% → nav` : "no nav"}
                </span>
                <span className="w-16 shrink-0 text-right">
                  {s.rage > 0 ? <span className="text-danger">rage ×{s.rage}</span> : null}
                </span>
              </div>
            ))}
            {r.selectors.length > TOP_SELECTORS && (
              <p className="text-2xs text-subtle">+ {r.selectors.length - TOP_SELECTORS} more elements</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- session replay (timeline scrubber) ---------------- */

interface ReplayEvent extends TestBeaconEvent {
  /** offset into the unified timeline (blocks are concatenated in order) */
  at: number;
  blockLabel: string;
  blockId: string;
}

/** Concatenate a session's app-task beacon streams into one timeline. */
function buildTimeline(blocks: TestBlock[], results: Record<string, TestBlockResult>): ReplayEvent[] {
  const out: ReplayEvent[] = [];
  let offset = 0;
  for (const b of blocks) {
    if (b.type !== "app-task") continue;
    const events = results[b.id]?.beaconEvents ?? [];
    if (!events.length) continue;
    const label = b.instructions || "App task";
    for (const e of events) out.push({ ...e, at: offset + e.t, blockLabel: label, blockId: b.id });
    offset += (events[events.length - 1]?.t ?? 0) + 1500;
  }
  return out.sort((a, b) => a.at - b.at);
}

const TICK_MS = 50;
const CLICK_LINGER_MS = 1400;

export function ReplayModal({
  open,
  onClose,
  blocks,
  results,
  viewport,
}: {
  open: boolean;
  onClose: () => void;
  blocks: TestBlock[];
  results: Record<string, TestBlockResult>;
  viewport?: { viewportW?: number; viewportH?: number };
}) {
  const events = React.useMemo(() => buildTimeline(blocks, results), [blocks, results]);
  const total = events.length ? events[events.length - 1].at + 800 : 0;
  const [now, setNow] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);

  React.useEffect(() => {
    if (!open) return;
    setNow(0);
    setPlaying(true);
  }, [open]);

  React.useEffect(() => {
    if (!playing || !open) return;
    const t = setInterval(() => {
      setNow((n) => {
        const next = n + TICK_MS * speed;
        if (next >= total) {
          setPlaying(false);
          return total;
        }
        return next;
      });
    }, TICK_MS);
    return () => clearInterval(t);
  }, [playing, speed, total, open]);

  if (!open) return null;

  const currentPage = [...events].reverse().find((e) => e.type === "page" && e.at <= now);
  const visibleClicks = events.filter((e) => e.type === "click" && e.at <= now && now - e.at <= CLICK_LINGER_MS);
  const current = [...events].reverse().find((e) => e.at <= now) ?? events[0];
  const currentBlock = current?.blockLabel;
  // Show the researcher-attached screenshot of the route the participant was
  // on at this moment — the "see the page" backdrop, no proxy infra needed.
  const activeBlock = blocks.find((b) => b.id === (currentPage?.blockId ?? current?.blockId));
  // Most-specific pattern wins: "/" is a prefix match for every path, so sort
  // matching patterns by literal length ("/jobs/new*" beats "/").
  const screenshot =
    activeBlock?.type === "app-task" && currentPage
      ? (activeBlock.routeScreenshots ?? [])
          // Empty pattern = "all pages" (naturally lowest specificity below).
          .filter((rs) => rs.imageUrl && (rs.pattern ? globMatch(currentPage.path, rs.pattern) : true))
          .sort((a, b) => b.pattern.replace(/\*/g, "").length - a.pattern.replace(/\*/g, "").length)[0]
      : undefined;
  const hasAnyScreenshots = blocks.some((b) => b.type === "app-task" && (b.routeScreenshots ?? []).some((rs) => rs.imageUrl));
  const aspect = (viewport?.viewportH ?? 800) / (viewport?.viewportW ?? 1280);
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

  const clickMarker = (c: ReplayEvent, i: number, top: string, left: string) => {
    const age = (now - c.at) / CLICK_LINGER_MS;
    return (
      <span
        key={`${c.at}-${i}`}
        className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary"
        style={{
          left,
          top,
          opacity: 1 - age,
          transform: `translate(-50%,-50%) scale(${0.6 + age * 0.9})`,
          background: "hsl(var(--primary) / 0.25)",
        }}
        title={c.sel}
      />
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div className="fixed inset-0 animate-fade-in bg-[hsl(224_40%_8%/0.5)] backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 mt-[6vh] w-full max-w-2xl animate-slide-up rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground">Session replay</h2>
            <p className="truncate text-xs text-muted">{currentBlock ?? "No click data in this session"}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="flex h-8 items-center rounded-t-lg border border-b-0 border-border bg-surface-2 px-3">
            <code className="truncate text-xs text-muted">{currentPage?.path ?? "…"}</code>
          </div>
          {screenshot ? (
            // Route screenshot backdrop — the page as the researcher captured
            // it, with clicks plotted at their document-relative positions
            // (v2 dx/dy; viewport-relative fallback for older sessions).
            <div className="relative w-full overflow-hidden rounded-b-lg border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={screenshot.imageUrl} alt={`Screenshot of ${currentPage?.path}`} className="w-full select-none" draggable={false} />
              {visibleClicks.map((c, i) =>
                clickMarker(c, i, `${(c.dy ?? c.y ?? 0.5) * 100}%`, `${(c.dx ?? c.x ?? 0.5) * 100}%`),
              )}
            </div>
          ) : (
            // Abstract viewport fallback: proportional frame, clicks ripple in
            // at their recorded positions. Honest about what it is — events,
            // not pixels.
            <div className="relative w-full overflow-hidden rounded-b-lg border border-border bg-canvas" style={{ paddingBottom: `${Math.min(85, aspect * 100)}%` }}>
              {visibleClicks.map((c, i) => clickMarker(c, i, `${(c.y ?? 0.5) * 100}%`, `${(c.x ?? 0.5) * 100}%`))}
            </div>
          )}
          {!hasAnyScreenshots && (
            <p className="mt-2 text-2xs text-subtle">
              Tip: attach route screenshots to the app-task block (builder → Route screenshots) and the replay shows
              the actual pages behind the clicks.
            </p>
          )}

          <div className="mt-3 flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => setPlaying((p) => (now >= total ? (setNow(0), true) : !p))} aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <input
              type="range"
              min={0}
              max={total}
              step={TICK_MS}
              value={now}
              onChange={(e) => setNow(Number(e.target.value))}
              className="min-w-0 flex-1 accent-[hsl(var(--primary))]"
            />
            <span className="w-20 shrink-0 text-right font-mono text-xs text-muted">
              {fmt(now)} / {fmt(total)}
            </span>
            <Button variant="outline" size="sm" onClick={() => setSpeed((s) => (s === 1 ? 4 : 1))}>
              {speed}×
            </Button>
          </div>

          <p className="mt-2 text-2xs text-subtle">
            Reconstructed from click and navigation events — positions are relative to the participant&apos;s viewport
            {viewport?.viewportW ? ` (${viewport.viewportW}×${viewport.viewportH})` : ""}. No screen recording is made.
          </p>
        </div>
      </div>
    </div>
  );
}
