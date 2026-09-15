"use client";

import * as React from "react";
import Link from "next/link";
import { MousePointerClick, ArrowUpRight, Radio } from "lucide-react";
import { tests } from "@/lib/db";
import { useApp } from "@/lib/store";
import { useSessionTallies } from "@/lib/test-sessions";
import { StackBar } from "@/components/charts";
import { Panel } from "./shared";

/**
 * Unmoderated testing on the dashboard. Deliberately one compact row, not a
 * roster of every live test — this is a status glance ("is testing healthy?"),
 * and /tests is one click away for the full list. Only the single test that
 * most needs a look (the fewest responses so far, i.e. most likely stalled)
 * gets named; the rest are a count.
 *
 * Response counts come from test_sessions, which only exists in a cloud
 * workspace — the panel degrades to block counts in local/demo mode rather
 * than showing zeros that would read as "nobody responded".
 */

const STATUS_COLORS = {
  active: "hsl(var(--success))",
  draft: "hsl(var(--subtle))",
  closed: "hsl(var(--warning))",
} as const;

export function TestingPanel() {
  const backend = useApp((s) => s.backend);
  const tally = useSessionTallies();

  const live = tests.filter((t) => t.status === "active");
  const drafts = tests.filter((t) => t.status === "draft").length;
  const closed = tests.filter((t) => t.status === "closed").length;
  const totalSessions = tally ? Object.values(tally).reduce((n, t) => n + t.sessions, 0) : null;
  const totalCompleted = tally ? Object.values(tally).reduce((n, t) => n + t.completed, 0) : null;

  // The one test worth naming: fewest responses so far among the live ones —
  // that's the one most likely stalled and worth a look. Falls back to
  // "oldest live" (array order) when there's no session data to rank by.
  const spotlight = tally
    ? [...live].sort((a, b) => (tally[a.id]?.sessions ?? 0) - (tally[b.id]?.sessions ?? 0))[0]
    : live[0];
  const spotlightStats = spotlight ? tally?.[spotlight.id] : undefined;

  if (tests.length === 0)
    return (
      <Panel title="Unmoderated testing" href="/tests" hrefLabel="Create a test">
        <p className="text-sm text-muted">
          No tests yet. Put a prototype or a real build in front of participants and the results land here.
        </p>
      </Panel>
    );

  return (
    <Panel title="Unmoderated testing" subtitle={`${tests.length} test${tests.length === 1 ? "" : "s"}`} href="/tests">
      {/* One compact row — a status glance, not a roster. The full list is
          one click away at /tests, so this never needs to enumerate every
          live test; only the one likeliest to need attention is named. */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight text-foreground">{live.length}</span>
          <span className="text-xs text-muted">live</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-24">
            <StackBar
              segments={[
                { label: "Live", value: live.length, color: STATUS_COLORS.active },
                { label: "Draft", value: drafts, color: STATUS_COLORS.draft },
                { label: "Closed", value: closed, color: STATUS_COLORS.closed },
              ]}
            />
          </div>
          <span className="text-2xs text-subtle">
            {/* Zero terms dropped: "0 closed" is noise. */}
            {[drafts > 0 ? `${drafts} draft` : null, closed > 0 ? `${closed} closed` : null].filter(Boolean).join(" · ") || "all live"}
          </span>
        </div>

        {totalSessions !== null && totalSessions > 0 && (
          <span className="text-xs text-subtle">
            {totalSessions} response{totalSessions === 1 ? "" : "s"} ·{" "}
            {Math.round(((totalCompleted ?? 0) / totalSessions) * 100)}% completed
          </span>
        )}

        {/* The spotlight test, right-aligned so it reads as "here's the one to
            check" rather than another stat in the row. */}
        {spotlight ? (
          <Link
            /* Local/demo has no sessions, so the results page would be a dead
               end — send those to the test itself. */
            href={backend === "cloud" ? `/tests/${spotlight.id}/results` : `/tests/${spotlight.id}`}
            className="group ml-auto flex min-w-0 items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <Radio className="h-3 w-3 shrink-0" />
            <span className="max-w-[220px] truncate">{spotlight.name}</span>
            <span className="shrink-0 text-subtle">
              {spotlightStats
                ? `· ${spotlightStats.sessions} response${spotlightStats.sessions === 1 ? "" : "s"}`
                : `· ${spotlight.blocks.length} block${spotlight.blocks.length === 1 ? "" : "s"}`}
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ) : (
          <span className="ml-auto text-xs text-subtle">
            {drafts > 0
              ? `Nothing collecting — publish a draft to start.`
              : "Nothing collecting right now."}
          </span>
        )}
      </div>
      {backend !== "cloud" && (
        <p className="mt-2.5 flex items-start gap-1.5 text-2xs text-subtle">
          <MousePointerClick className="mt-0.5 h-3 w-3 shrink-0" />
          Participant responses are collected in a cloud workspace — this sandbox shows the tests only.
        </p>
      )}
    </Panel>
  );
}
