"use client";

import * as React from "react";
import Link from "next/link";
import type { Insight } from "@/lib/types";
import {
  HighlightKindBadge,
  SeverityBadge,
  ImpactBadge,
  ConfidenceBadge,
  highlightKindMeta,
} from "@/components/domain/badges";
import { InsightCard } from "@/components/domain/insight-card";
import { SelectableItem, CheckBox } from "@/components/ui/bulk-select";
import { SortTh, type SortState } from "@/components/ui/sort-table";
import type { ListView } from "@/components/ui/list-view";
import type { BulkSel } from "@/components/participants/participant-views";
import { cn, formatDate } from "@/lib/utils";

/**
 * The three insight layouts (table / cards / list), shared between the
 * standalone /insights page and the project Insights tab. Rows arrive
 * pre-sorted; sort state lives with the caller. `sel` is optional bulk
 * selection (standalone page only).
 */

export type InsightSortKey = "title" | "type" | "severity" | "impact" | "confidence" | "evidence" | "created";
export const INSIGHT_DESC_FIRST: InsightSortKey[] = ["severity", "impact", "confidence", "evidence", "created"];

const rank = { critical: 4, high: 3, medium: 2, low: 1 } as const;

/** Comparable value per column. Unrated (0) sorts last in the desc default. */
export function insightSortValue(ins: Insight, key: InsightSortKey): string | number {
  switch (key) {
    case "title": return ins.title.toLowerCase();
    case "type": return highlightKindMeta[ins.type].label;
    case "severity": return ins.severity ? rank[ins.severity] : 0;
    case "impact": return ins.impact ? rank[ins.impact] : 0;
    case "confidence": return ins.confidence ? rank[ins.confidence] : 0;
    case "evidence": return ins.participantIds.length;
    case "created": return ins.createdDate;
  }
}

const NO_SEL: BulkSel = { selecting: false, isSelected: () => false, toggle: () => {} };

export function InsightViews({
  rows,
  view,
  sort,
  onSort,
  sel = NO_SEL,
}: {
  rows: Insight[];
  view: ListView;
  sort: SortState<InsightSortKey>;
  onSort: (key: InsightSortKey) => void;
  sel?: BulkSel;
}) {
  if (view === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((ins) => (
          <SelectableItem
            key={ins.id}
            id={ins.id}
            variant="card"
            selecting={sel.selecting}
            selected={sel.isSelected(ins.id)}
            onToggle={sel.toggle}
          >
            <InsightCard insight={ins} />
          </SelectableItem>
        ))}
      </div>
    );
  }
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {rows.map((ins) => (
          <SelectableItem
            key={ins.id}
            id={ins.id}
            selecting={sel.selecting}
            selected={sel.isSelected(ins.id)}
            onToggle={sel.toggle}
          >
            <Link href={`/insights/${ins.id}`} className="group flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-hover">
              <HighlightKindBadge kind={ins.type} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{ins.title}</p>
                <p className="truncate text-xs text-subtle">{ins.productArea} · {ins.participantIds.length} participants · {ins.interviewIds.length} interviews</p>
              </div>
              <div className="hidden items-center gap-1.5 sm:flex">
                <SeverityBadge value={ins.severity} />
                <ImpactBadge value={ins.impact} />
                <ConfidenceBadge value={ins.confidence} />
              </div>
            </Link>
          </SelectableItem>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[860px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-subtle">
            {sel.selecting && <th className="w-10 px-4 py-2.5" />}
            <SortTh label="Insight" k="title" sort={sort} onSort={onSort} />
            <SortTh label="Type" k="type" sort={sort} onSort={onSort} />
            <SortTh label="Severity" k="severity" sort={sort} onSort={onSort} />
            <SortTh label="Impact" k="impact" sort={sort} onSort={onSort} />
            <SortTh label="Confidence" k="confidence" sort={sort} onSort={onSort} />
            <SortTh label="Evidence" k="evidence" sort={sort} onSort={onSort} center />
            <SortTh label="Created" k="created" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((ins) => {
            const checked = sel.isSelected(ins.id);
            return (
              <tr
                key={ins.id}
                onClick={sel.selecting ? () => sel.toggle(ins.id) : undefined}
                className={cn(
                  "group border-b border-border last:border-0",
                  sel.selecting && "cursor-pointer",
                  checked ? "bg-primary-soft" : "hover:bg-surface-hover",
                )}
              >
                {sel.selecting && (
                  <td className="px-4 py-2.5">
                    <CheckBox checked={checked} />
                  </td>
                )}
                <td className="max-w-md px-4 py-2.5">
                  <Link
                    href={`/insights/${ins.id}`}
                    className={cn("block min-w-0", sel.selecting && "pointer-events-none")}
                  >
                    <p className="truncate font-medium text-foreground group-hover:text-primary">{ins.title}</p>
                    <p className="truncate text-xs text-subtle">{ins.productArea}</p>
                  </Link>
                </td>
                <td className="px-4 py-2.5"><HighlightKindBadge kind={ins.type} /></td>
                <td className="px-4 py-2.5"><SeverityBadge value={ins.severity} /></td>
                <td className="px-4 py-2.5"><ImpactBadge value={ins.impact} /></td>
                <td className="px-4 py-2.5"><ConfidenceBadge value={ins.confidence} /></td>
                <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                  {ins.participantIds.length}
                </td>
                <td className="px-4 py-2.5 text-muted">{formatDate(ins.createdDate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
