"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getCompany, getPersonas, fullName } from "@/lib/db";
import type { Participant, RecruitmentStatus, ConsentStatus } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { PersonaChip, RecruitmentBadge, ConsentBadge } from "@/components/domain/badges";
import { ParticipantCard } from "@/components/participants/participant-card";
import { SelectableItem, CheckBox } from "@/components/ui/bulk-select";
import { SortTh, BLANK_LAST, type SortState } from "@/components/ui/sort-table";
import type { ListView } from "@/components/ui/list-view";
import { cn, formatDate } from "@/lib/utils";

/**
 * The three participant layouts (table / cards / list), shared between the
 * standalone /participants page and the project Participants tab. Callers own
 * filtering and sort STATE (so page-level controls can drive it) and pass rows
 * already sorted; column headers report clicks through onSort. Bulk selection
 * is optional — omit `sel` and the views render without checkboxes.
 */

export type ParticipantSortKey = "name" | "persona" | "company" | "country" | "interviews" | "status" | "consent";
export const PARTICIPANT_DESC_FIRST: ParticipantSortKey[] = ["interviews"];

// Lifecycle order beats alphabetical for the status-like columns.
const STATUS_ORDER: Record<RecruitmentStatus, number> = {
  available: 0, contacted: 1, scheduled: 2, interviewed: 3, "do-not-contact": 4,
};
const CONSENT_ORDER: Record<ConsentStatus, number> = { granted: 0, pending: 1, expired: 2, withdrawn: 3 };

/** Comparable value per column; blanks sort to the end when ascending. */
export function participantSortValue(p: Participant, key: ParticipantSortKey): string | number {
  switch (key) {
    case "name": return fullName(p).toLowerCase();
    case "persona": return getPersonas(p.personaIds)[0]?.name.toLowerCase() ?? BLANK_LAST;
    case "company": return getCompany(p.companyId)?.name.toLowerCase() ?? BLANK_LAST;
    case "country": return p.country?.toLowerCase() || BLANK_LAST;
    case "interviews": return p.interviewCount;
    case "status": return STATUS_ORDER[p.recruitmentStatus] ?? 99;
    case "consent": return CONSENT_ORDER[p.consentStatus] ?? 99;
  }
}

export type BulkSel = {
  selecting: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
};

const NO_SEL: BulkSel = { selecting: false, isSelected: () => false, toggle: () => {} };

export function ParticipantViews({
  rows,
  view,
  sort,
  onSort,
  sel = NO_SEL,
}: {
  rows: Participant[];
  view: ListView;
  sort: SortState<ParticipantSortKey>;
  onSort: (key: ParticipantSortKey) => void;
  sel?: BulkSel;
}) {
  if (view === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p) => (
          <SelectableItem
            key={p.id}
            id={p.id}
            variant="card"
            selecting={sel.selecting}
            selected={sel.isSelected(p.id)}
            onToggle={sel.toggle}
          >
            <ParticipantCard participant={p} />
          </SelectableItem>
        ))}
      </div>
    );
  }
  if (view === "list") {
    return (
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {rows.map((p) => (
          <SelectableItem
            key={p.id}
            id={p.id}
            selecting={sel.selecting}
            selected={sel.isSelected(p.id)}
            onToggle={sel.toggle}
          >
            <ListRow participant={p} />
          </SelectableItem>
        ))}
      </div>
    );
  }
  return <ParticipantTable rows={rows} sort={sort} onSort={onSort} sel={sel} />;
}

function ListRow({ participant: p }: { participant: Participant }) {
  const company = getCompany(p.companyId);
  return (
    <Link
      href={`/participants/${p.id}`}
      className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-hover"
    >
      <Avatar name={fullName(p)} accent={p.avatarColor} size="sm" />
      <span className="w-48 shrink-0 truncate text-[13px] font-medium text-foreground">{fullName(p)}</span>
      <span className="hidden w-52 shrink-0 truncate text-[13px] text-muted sm:block">{p.jobTitle}</span>
      <span className="hidden flex-1 truncate text-[13px] text-subtle md:block">{company?.name}</span>
      <RecruitmentBadge status={p.recruitmentStatus} />
    </Link>
  );
}

function ParticipantTable({
  rows,
  sort,
  onSort,
  sel,
}: {
  rows: Participant[];
  sort: SortState<ParticipantSortKey>;
  onSort: (key: ParticipantSortKey) => void;
  sel: BulkSel;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-subtle">
            {sel.selecting && <th className="w-10 px-4 py-2.5" />}
            <SortTh label="Participant" k="name" sort={sort} onSort={onSort} />
            <SortTh label="Persona" k="persona" sort={sort} onSort={onSort} />
            <SortTh label="Company" k="company" sort={sort} onSort={onSort} />
            <SortTh label="Country" k="country" sort={sort} onSort={onSort} />
            <SortTh label="Interviews" k="interviews" sort={sort} onSort={onSort} center />
            <SortTh label="Status" k="status" sort={sort} onSort={onSort} />
            <SortTh label="Consent" k="consent" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const company = getCompany(p.companyId);
            const personaList = getPersonas(p.personaIds);
            const checked = sel.isSelected(p.id);
            return (
              <tr
                key={p.id}
                onClick={sel.selecting ? () => sel.toggle(p.id) : undefined}
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
                <td className="px-4 py-2.5">
                  <Link
                    href={`/participants/${p.id}`}
                    className={cn("flex items-center gap-2.5", sel.selecting && "pointer-events-none")}
                  >
                    <Avatar name={fullName(p)} accent={p.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground group-hover:text-primary">{fullName(p)}</p>
                      <p className="truncate text-xs text-subtle">{p.jobTitle}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {personaList.slice(0, 2).map((pe) => (
                      <PersonaChip key={pe.id} persona={pe} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-muted">{company?.name}</td>
                <td className="px-4 py-2.5 text-muted">{p.country}</td>
                <td className="px-4 py-2.5 text-center tabular-nums text-muted">{p.interviewCount}</td>
                <td className="px-4 py-2.5">
                  <div className="flex flex-col items-start gap-1">
                    <RecruitmentBadge status={p.recruitmentStatus} />
                    {p.scheduledSession && (
                      <span className="flex items-center gap-1 text-2xs text-subtle">
                        <CalendarClock className="h-3 w-3" />
                        {formatDate(p.scheduledSession.date, { year: undefined })} · {p.scheduledSession.time}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2.5"><ConsentBadge status={p.consentStatus} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
