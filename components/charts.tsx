import * as React from "react";
import { cn } from "@/lib/utils";
import type { Counted } from "@/lib/db";

/** Horizontal labelled bar list, scaled to the largest value. */
export function BarList({
  items,
  valueSuffix,
  className,
}: {
  items: Counted[];
  valueSuffix?: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <div className="w-36 shrink-0 truncate text-[13px] text-foreground" title={item.label}>
            {item.label}
          </div>
          <div className="relative h-6 flex-1 overflow-hidden rounded bg-surface-2">
            <div
              className={cn("h-full rounded", item.accent ? `accent-${item.accent}` : "")}
              style={{
                width: `${(item.count / max) * 100}%`,
                backgroundColor: item.accent ? "hsl(var(--a-bg))" : "hsl(var(--primary-soft))",
              }}
            />
            <span className="absolute inset-y-0 left-2 flex items-center text-2xs font-medium text-foreground/70" />
          </div>
          <span className="w-10 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground">
            {item.count}
            {valueSuffix}
          </span>
        </div>
      ))}
    </div>
  );
}

interface DonutSegment {
  label: string;
  value: number;
  color: string; // CSS color
}

/**
 * Sentiment ring with a legend that fills the available vertical space.
 * Designed for a panel that stretches when its grid neighbours grow: the ring
 * stays centred at the top and the legend rows distribute to absorb extra height.
 */
export function SentimentDonut({
  segments,
  size = 128,
  thickness = 14,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const denom = total || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const drawn = segments.filter((s) => s.value > 0).length;
  const gap = drawn > 1 ? 3 : 0; // px arc gap between neighbouring segments
  let offset = 0;

  return (
    <div className="flex flex-1 flex-col gap-4">
      {/* Ring */}
      <div className="flex items-center justify-center pt-1">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              strokeWidth={thickness}
              className="stroke-surface-2"
            />
            {segments.map((seg, i) => {
              if (seg.value === 0) return null;
              const len = (seg.value / denom) * c;
              const arc = Math.max(0, len - gap);
              const el = (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${arc} ${c - arc}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-foreground">{total}</span>
            <span className="text-2xs text-subtle">interviews</span>
          </div>
        </div>
      </div>

      {/* Legend — grows to fill the panel; rows spread evenly when it is tall */}
      <div className="flex flex-1 flex-col justify-around gap-2.5">
        {segments.map((seg, i) => {
          const pct = total ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
              <span className="w-14 shrink-0 text-[13px] text-muted">{seg.label}</span>
              <div className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: seg.color }} />
              </div>
              <span className="w-5 shrink-0 text-right text-[13px] font-semibold tabular-nums text-foreground">
                {seg.value}
              </span>
              <span className="w-9 shrink-0 text-right text-2xs tabular-nums text-subtle">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Segmented stacked bar (single row). */
export function StackBar({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      {segments.map((s, i) => (
        <div
          key={i}
          style={{ width: `${(s.value / total) * 100}%`, backgroundColor: s.color }}
          title={`${s.label}: ${s.value}`}
        />
      ))}
    </div>
  );
}
