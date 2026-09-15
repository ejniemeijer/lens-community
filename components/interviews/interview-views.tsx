"use client";

import * as React from "react";
import Link from "next/link";
import { getParticipant, getUser, fullName, isScheduledInterview } from "@/lib/db";
import type { Interview } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge } from "@/components/domain/badges";
import { InterviewRow } from "@/components/interviews/interview-row";
import { InterviewCard } from "@/components/interviews/interview-card";
import { SelectableItem, CheckBox } from "@/components/ui/bulk-select";
import { SortTh, BLANK_LAST, type SortState } from "@/components/ui/sort-table";
import type { ListView } from "@/components/ui/list-view";
import type { BulkSel } from "@/components/participants/participant-views";
import { cn, formatDate, formatDuration } from "@/lib/utils";

/**
 * The three interview layouts (table / cards / list), shared between the
 * standalone /interviews page and the project Interviews tab. Rows arrive
 * pre-sorted; sort state lives with the caller. `sel` is optional bulk
 * selection (standalone page only).
 */

export type InterviewSortKey = "title" | "participant" | "researcher" | "date" | "duration" | "insights" | "sentiment" | "status";
export const INTERVIEW_DESC_FIRST: InterviewSortKey[] = ["date", "duration", "insights"];

const SENTIMENT_ORDER: Record<string, number> = { positive: 3, mixed: 2, neutral: 1, negative: 0 };

/** Comparable value per column; blanks sort to the end when ascending. */
export function interviewSortValue(iv: Interview, key: InterviewSortKey): string | number {
  switch (key) {
    case "title": return iv.title.toLowerCase();
    case "participant": {
      const p = getParticipant(iv.participantId);
      return p ? fullName(p).toLowerCase() : BLANK_LAST;
    }
    case "researcher": return getUser(iv.researcherId)?.name.toLowerCase() ?? BLANK_LAST;
    case "date": return iv.date;
    case "duration": return iv.durationMinutes;
    case "insights": return iv.insightIds.length;
    case "sentiment": return SENTIMENT_ORDER[iv.sentiment] ?? -1;
    case "status": return isScheduledInterview(iv) ? 0 : 1; // scheduled first
  }
}

const NO_SEL: BulkSel = { selecting: false, isSelected: () => false, toggle: () => {} };

export function InterviewViews({
  rows,
  view,
  sort,
  onSort,
  sel = NO_SEL,
}: {
  rows: Interview[];
  view: ListView;
  sort: SortState<InterviewSortKey>;
  onSort: (key: InterviewSortKey) => void;
  sel?: BulkSel;
}) {
  if (view === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((iv) => (
          <SelectableItem
            key={iv.id}
            id={iv.id}
            variant="card"
            selecting={sel.selecting}
            selected={sel.isSelected(iv.id)}
            onToggle={sel.toggle}
          >
            <InterviewCard interview={iv} />
          </SelectableItem>
        ))}
      </div>
    );
  }
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {rows.map((iv) => (
          <SelectableItem
            key={iv.id}
            id={iv.id}
            selecting={sel.selecting}
            selected={sel.isSelected(iv.id)}
            onToggle={sel.toggle}
          >
            <InterviewRow interview={iv} />
          </SelectableItem>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[900px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-subtle">
            {sel.selecting && <th className="w-10 px-4 py-2.5" />}
            <SortTh label="Interview" k="title" sort={sort} onSort={onSort} />
            <SortTh label="Participant" k="participant" sort={sort} onSort={onSort} />
            <SortTh label="Researcher" k="researcher" sort={sort} onSort={onSort} />
            <SortTh label="Date" k="date" sort={sort} onSort={onSort} />
            <SortTh label="Duration" k="duration" sort={sort} onSort={onSort} />
            <SortTh label="Insights" k="insights" sort={sort} onSort={onSort} center />
            <SortTh label="Sentiment" k="sentiment" sort={sort} onSort={onSort} />
            <SortTh label="Status" k="status" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((iv) => {
            const participant = getParticipant(iv.participantId);
            const researcherUser = getUser(iv.researcherId);
            const scheduled = isScheduledInterview(iv);
            const checked = sel.isSelected(iv.id);
            return (
              <tr
                key={iv.id}
                onClick={sel.selecting ? () => sel.toggle(iv.id) : undefined}
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
                <td className="max-w-sm px-4 py-2.5">
                  <Link
                    href={`/interviews/${iv.id}`}
                    className={cn("block min-w-0", sel.selecting && "pointer-events-none")}
                  >
                    <p className="truncate font-medium text-foreground group-hover:text-primary">{iv.title}</p>
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-muted">{participant ? fullName(participant) : "—"}</td>
                <td className="px-4 py-2.5 text-muted">{researcherUser?.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-muted">{formatDate(iv.date)}</td>
                <td className="px-4 py-2.5 tabular-nums text-muted">{formatDuration(iv.durationMinutes)}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-muted">{iv.insightIds.length}</td>
                <td className="px-4 py-2.5">{scheduled ? <span className="text-subtle">—</span> : <SentimentBadge value={iv.sentiment} />}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={scheduled ? "info" : "success"}>{scheduled ? "Scheduled" : "Completed"}</Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
