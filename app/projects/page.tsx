"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, FolderOpen, Users, MessageSquare, Lightbulb } from "lucide-react";
import { projects, projectInterviews, projectInsights } from "@/lib/db";
import type { ProjectStatus, ResearchProject } from "@/lib/types";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { ProjectStatusBadge } from "@/components/domain/badges";
import { ProjectCard } from "@/components/projects/project-card";
import { ProjectFormModal } from "@/components/forms/project-form";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { SortTh, useSortState, sortRows, BLANK_LAST, type SortState } from "@/components/ui/sort-table";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/utils";

const STATUSES: ProjectStatus[] = ["planning", "recruiting", "in-progress", "analysis", "completed", "on-hold"];
const STATUS_ORDER: Record<string, number> = Object.fromEntries(STATUSES.map((s, i) => [s, i]));

/* ---------------- column sorting ---------------- */

type SortKey = "name" | "status" | "area" | "participants" | "interviews" | "insights" | "questions" | "end";
const DESC_FIRST: SortKey[] = ["participants", "interviews", "insights", "questions", "end"];

/** Comparable value per column; blanks sort to the end when ascending. */
function sortValue(p: ResearchProject, key: SortKey): string | number {
  switch (key) {
    case "name": return p.name.toLowerCase();
    case "status": return STATUS_ORDER[p.status] ?? 99;
    case "area": return p.productArea?.toLowerCase() || BLANK_LAST;
    case "participants": return p.participantIds.length;
    case "interviews": return projectInterviews(p.id).length;
    case "insights": return projectInsights(p.id).length;
    case "questions": return p.researchQuestions.length ? p.researchQuestions.filter((q) => q.answered).length / p.researchQuestions.length : -1;
    case "end": return p.endDate || BLANK_LAST;
  }
}

export default function ProjectsPage() {
  const version = useDb();
  const role = useApp((s) => s.role);
  const [status, setStatus] = React.useState("all");
  const [area, setArea] = React.useState("all");
  const [showNew, setShowNew] = React.useState(false);
  const [view, setView] = useListView("projects");
  const [sort, toggleSort] = useSortState<SortKey>({ key: "name", dir: 1 }, DESC_FIRST);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const areas = React.useMemo(() => [...new Set(projects.map((p) => p.productArea))], [version]);
  const filtered = projects.filter(
    (p) => (status === "all" || p.status === status) && (area === "all" || p.productArea === area),
  );
  const sorted = React.useMemo(() => sortRows(filtered, sort, sortValue), [filtered, sort]);

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={FolderOpen} />}
        title="Research Projects"
        description="Each study brings together participants, interviews, analysis, and the insights that come out of it."
        actions={
          can(role, "manage-content") ? (
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New project
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("-", " ")}</option>)}
          </Select>
          <Select value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="all">All product areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-subtle">{filtered.length} projects</span>
            <ListViewToggle view={view} onChange={setView} withTable />
          </div>
        </div>
      </PageHeader>

      {/* Stay at the wide (table) width for every view so switching
          table ↔ cards ↔ list never shifts the page layout. */}
      <PageBody wide>
        {filtered.length === 0 ? (
          <EmptyState icon={<FolderOpen className="h-5 w-5" />} title="No projects match" />
        ) : view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sorted.map((p) => <ProjectCard key={p.id} project={p} />)}
          </div>
        ) : view === "table" ? (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full min-w-[820px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-border text-2xs uppercase tracking-wide text-subtle">
                  <SortTh label="Project" k="name" sort={sort} onSort={toggleSort} />
                  <SortTh label="Status" k="status" sort={sort} onSort={toggleSort} />
                  <SortTh label="Product area" k="area" sort={sort} onSort={toggleSort} />
                  <SortTh label="Participants" k="participants" sort={sort} onSort={toggleSort} center />
                  <SortTh label="Interviews" k="interviews" sort={sort} onSort={toggleSort} center />
                  <SortTh label="Insights" k="insights" sort={sort} onSort={toggleSort} center />
                  <SortTh label="Questions" k="questions" sort={sort} onSort={toggleSort} center />
                  <SortTh label="Target date" k="end" sort={sort} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const answered = p.researchQuestions.filter((q) => q.answered).length;
                  return (
                    <tr key={p.id} className="group border-b border-border last:border-0 hover:bg-surface-hover">
                      <td className="max-w-xs px-4 py-2.5">
                        <Link href={`/projects/${p.id}`} className="block min-w-0">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">{p.name}</p>
                          <p className="truncate text-xs text-subtle">{p.methodology}</p>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5"><ProjectStatusBadge status={p.status} /></td>
                      <td className="px-4 py-2.5 text-muted">{p.productArea}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-muted">{p.participantIds.length}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-muted">{projectInterviews(p.id).length}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-muted">{projectInsights(p.id).length}</td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-muted">
                        {p.researchQuestions.length ? `${answered}/${p.researchQuestions.length}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-muted">{p.endDate ? formatDate(p.endDate) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {sorted.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="group flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-hover"
              >
                <span className="w-60 shrink-0 truncate text-[13px] font-medium text-foreground group-hover:text-primary">{p.name}</span>
                <ProjectStatusBadge status={p.status} />
                <span className="hidden flex-1 truncate text-2xs text-subtle md:block">{p.productArea} · {p.methodology}</span>
                <span className="flex shrink-0 items-center gap-3 text-2xs text-subtle">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" />{p.participantIds.length}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{projectInterviews(p.id).length}</span>
                  <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" />{projectInsights(p.id).length}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </PageBody>

      <ProjectFormModal open={showNew} onClose={() => setShowNew(false)} />
    </>
  );
}
