"use client";

import * as React from "react";
import { Plus, Search, Lightbulb, Sparkles, ListChecks } from "lucide-react";
import { insights, themes, personas, tags } from "@/lib/db";
import type { HighlightKind } from "@/lib/types";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { highlightKindMeta } from "@/components/domain/badges";
import {
  InsightViews,
  insightSortValue,
  INSIGHT_DESC_FIRST,
  type InsightSortKey,
} from "@/components/insights/insight-views";
import { InsightFormModal } from "@/components/forms/insight-form";
import { DuplicatesDialog } from "@/components/forms/duplicates-dialog";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useBulkSelect, BulkBar } from "@/components/ui/bulk-select";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { useSortState, sortRows } from "@/components/ui/sort-table";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";

const KINDS = Object.keys(highlightKindMeta) as HighlightKind[];

/** The quick-sort dropdown (cards/list views) maps onto the same sort state. */
const DROPDOWN_KEYS: { value: string; key: InsightSortKey; label: string }[] = [
  { value: "severity", key: "severity", label: "Sort: Severity" },
  { value: "impact", key: "impact", label: "Sort: Impact" },
  { value: "evidence", key: "evidence", label: "Sort: Evidence" },
  { value: "recent", key: "created", label: "Sort: Recent" },
];

export default function InsightsPage() {
  const version = useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const deleteInsight = useApp((s) => s.deleteInsight);
  const toast = useApp((s) => s.toast);
  const sel = useBulkSelect();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [view, setView] = useListView("insights");
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [theme, setTheme] = React.useState("all");
  const [persona, setPersona] = React.useState("all");
  const [tag, setTag] = React.useState("all");
  const [sort, toggleSort] = useSortState<InsightSortKey>({ key: "severity", dir: -1 }, INSIGHT_DESC_FIRST);
  const [showNew, setShowNew] = React.useState(false);
  const [showDupes, setShowDupes] = React.useState(false);

  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    for (const [key, set] of [
      ["type", setType],
      ["theme", setTheme],
      ["persona", setPersona],
      ["tag", setTag],
    ] as const) {
      const v = sp.get(key);
      if (v) set(v);
    }
  }, []);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return insights.filter((ins) => {
      if (type !== "all" && ins.type !== type) return false;
      if (theme !== "all" && !ins.themeIds.includes(theme)) return false;
      if (persona !== "all" && !ins.personaIds.includes(persona)) return false;
      if (tag !== "all" && !ins.tagIds.includes(tag)) return false;
      if (q && !`${ins.title} ${ins.description}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, type, theme, persona, tag, version]);

  // One sort state for every view: the dropdown drives it in cards/list,
  // clickable column headers drive it in the table.
  const sorted = React.useMemo(() => sortRows(filtered, sort, insightSortValue), [filtered, sort]);

  const filteredIds = filtered.map((ins) => ins.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => sel.isSelected(id));
  const runDelete = () => {
    const n = sel.count;
    sel.selected.forEach((id) => deleteInsight(id));
    sel.stop();
    toast(`Deleted ${n} insight${n === 1 ? "" : "s"}`, "info");
  };

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={Lightbulb} />}
        title="Insights"
        description="Reusable, evidence-backed findings that travel across projects and inform product decisions."
        actions={
          canManage ? (
            sel.selecting ? (
              <Button variant="outline" size="sm" onClick={sel.stop}>Cancel</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={sel.start}>
                  <ListChecks className="h-4 w-4" /> Select
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowDupes(true)}>
                  <Sparkles className="h-4 w-4 text-primary" /> Find duplicates
                </Button>
                <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
                  <Plus className="h-4 w-4" /> New insight
                </Button>
              </>
            )
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search insights…" className="pl-8" />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">All types</option>
            {KINDS.map((k) => <option key={k} value={k}>{highlightKindMeta[k].label}</option>)}
          </Select>
          <Select value={theme} onChange={(e) => setTheme(e.target.value)}>
            <option value="all">All themes</option>
            {themes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          <Select value={persona} onChange={(e) => setPersona(e.target.value)}>
            <option value="all">All personas</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={tag} onChange={(e) => setTag(e.target.value)}>
            <option value="all">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </Select>
          {view !== "table" && (
            <Select
              value={DROPDOWN_KEYS.find((d) => d.key === sort.key)?.value ?? "custom"}
              onChange={(e) => {
                const d = DROPDOWN_KEYS.find((x) => x.value === e.target.value);
                if (d) toggleSort(d.key); // all dropdown keys are desc-first
              }}
            >
              {DROPDOWN_KEYS.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
              {!DROPDOWN_KEYS.some((d) => d.key === sort.key) && (
                <option value="custom">Sort: {sort.key[0].toUpperCase() + sort.key.slice(1)}</option>
              )}
            </Select>
          )}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-subtle">{filtered.length} insights</span>
            <ListViewToggle view={view} onChange={setView} withTable />
          </div>
        </div>
      </PageHeader>

      {/* `wide` for every view, like the other list pages. It used to be
          wide={view === "table"}, which capped cards and list at 1400px here
          and nowhere else — so on a wide screen the same list was narrower on
          Insights than on Participants, Interviews, Projects or Tests. */}
      <PageBody wide>
        {filtered.length === 0 ? (
          <EmptyState icon={<Lightbulb className="h-5 w-5" />} title="No insights match" description="Adjust your filters to see more." />
        ) : (
          <InsightViews rows={sorted} view={view} sort={sort} onSort={toggleSort} sel={sel} />
        )}
      </PageBody>

      <BulkBar
        count={sel.count}
        noun="insight"
        allSelected={allSelected}
        onToggleAll={() => (allSelected ? sel.clear() : sel.selectOnly(filteredIds))}
        onClear={sel.clear}
        onCancel={sel.stop}
        onDelete={() => setConfirmDelete(true)}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={runDelete}
        danger
        title={`Delete ${sel.count} insight${sel.count === 1 ? "" : "s"}?`}
        confirmLabel="Delete"
        body={
          <>
            This permanently removes the selected insight{sel.count === 1 ? "" : "s"} and detaches
            {sel.count === 1 ? " it" : " them"} from interviews and boards. This can&apos;t be undone.
          </>
        }
      />

      <InsightFormModal open={showNew} onClose={() => setShowNew(false)} />
      <DuplicatesDialog open={showDupes} onClose={() => setShowDupes(false)} />
    </>
  );
}
