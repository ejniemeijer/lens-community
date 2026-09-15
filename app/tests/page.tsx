"use client";

import * as React from "react";
import { Plus, MousePointerClick } from "lucide-react";
import { tests, projects } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import {
  NewTestModal,
  TestViews,
  testSortValue,
  TEST_DESC_FIRST,
  type TestSortKey,
} from "@/components/tests/test-views";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { useSortState, sortRows } from "@/components/ui/sort-table";
import { useSessionTallies } from "@/lib/test-sessions";

export default function TestsPage() {
  useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const [project, setProject] = React.useState("all");
  const [showNew, setShowNew] = React.useState(false);
  const [view, setView] = useListView("tests", "list");
  const [sort, toggleSort] = useSortState<TestSortKey>({ key: "status", dir: 1 }, TEST_DESC_FIRST);

  // Null means "unknown" (no session data in this workspace), which the views
  // render as "—" rather than zero.
  const tallies = useSessionTallies();

  const filtered = tests.filter((t) => project === "all" || t.projectId === project);
  const rows = sortRows(filtered, sort, (t, k) => testSortValue(t, k, tallies));

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={MousePointerClick} />}
        title="Tests"
        description="Unmoderated usability tests: share a link, participants complete tasks in a prototype, results land here."
        actions={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New test
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-subtle">
              {rows.length} test{rows.length === 1 ? "" : "s"}
            </span>
            <ListViewToggle view={view} onChange={setView} withTable />
          </div>
        </div>
      </PageHeader>

      <PageBody wide>
        {rows.length === 0 ? (
          <EmptyState
            icon={<MousePointerClick className="h-5 w-5" />}
            title="No tests yet"
            description={
              canManage
                ? "Create a test, add task blocks, and share the link with participants."
                : "No usability tests have been created yet."
            }
            action={
              canManage ? (
                <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
                  <Plus className="h-4 w-4" /> New test
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TestViews rows={rows} view={view} sort={sort} onSort={toggleSort} tallies={tallies} />
        )}
      </PageBody>

      <NewTestModal open={showNew} onClose={() => setShowNew(false)} />
    </>
  );
}
