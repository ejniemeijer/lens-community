"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import type { TestStatus, UsabilityTest } from "@/lib/types";
import { projects, getProject, currentUserId } from "@/lib/db";
import { useApp } from "@/lib/store";
import { cn, uid, randomToken, testShareUrl, formatDate } from "@/lib/utils";
import type { SessionTallies } from "@/lib/test-sessions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { SortTh, type SortState } from "@/components/ui/sort-table";
import type { ListView } from "@/components/ui/list-view";
import { DEFAULT_CONSENT_TEXT } from "@/components/tests/block-editors";

/**
 * The test list row and the create-test flow, shared between the standalone
 * /tests page and the project hub's Tests tab.
 *
 * Both live here rather than being copied: the row's status vocabulary and the
 * starter-block seeding (intro message + consent gate) are the kind of detail
 * that silently diverges between two copies, and a test created without a
 * consent gate can't be published.
 */

export const TEST_STATUS_META: Record<TestStatus, { label: string; tone: "neutral" | "success" | "warning" }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Live", tone: "success" },
  closed: { label: "Closed", tone: "warning" },
};

/* ---------------- sorting ---------------- */

export type TestSortKey = "name" | "project" | "status" | "blocks" | "responses" | "created";
/** Counts and dates read better "most/newest first" on the first click. */
export const TEST_DESC_FIRST: TestSortKey[] = ["blocks", "responses", "created"];

/** Live first, then draft, then closed — what's collecting now matters most. */
const STATUS_RANK: Record<TestStatus, number> = { active: 0, draft: 1, closed: 2 };

/** Comparable value per column. `tallies` is null when responses are unknown
    (local/demo has no sessions), in which case every row sorts equal rather
    than pretending to be zero. */
export function testSortValue(t: UsabilityTest, key: TestSortKey, tallies: SessionTallies | null): string | number {
  switch (key) {
    case "name": return t.name.toLowerCase();
    case "project": return (getProject(t.projectId)?.name ?? "").toLowerCase();
    case "status": return STATUS_RANK[t.status];
    case "blocks": return t.blocks.length;
    case "responses": return tallies?.[t.id]?.sessions ?? 0;
    case "created": return t.createdAt ?? "";
  }
}

/** "12" when known, "—" when this workspace has no session data at all. Never
    "0" for unknown: that would read as "nobody answered". */
const responseLabel = (t: UsabilityTest, tallies: SessionTallies | null) =>
  tallies ? String(tallies[t.id]?.sessions ?? 0) : "—";

/* ---------------- the three layouts ---------------- */

/**
 * Table / cards / list for the tests overview, matching the other list pages.
 * The list branch is TestList, which the project hub's Tests tab also uses on
 * its own.
 */
export function TestViews({
  rows,
  view,
  sort,
  onSort,
  tallies = null,
  showProject = true,
}: {
  rows: UsabilityTest[];
  view: ListView;
  sort: SortState<TestSortKey>;
  onSort: (key: TestSortKey) => void;
  tallies?: SessionTallies | null;
  showProject?: boolean;
}) {
  if (view === "list") return <TestList rows={rows} showProject={showProject} />;

  if (view === "cards") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((t) => {
          const meta = TEST_STATUS_META[t.status];
          return (
            <Link
              key={t.id}
              href={`/tests/${t.id}`}
              className="group flex flex-col rounded-lg border border-border bg-surface p-4 transition-shadow hover:border-border-strong hover:shadow-xs"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h3 className="min-w-0 font-semibold leading-snug text-foreground group-hover:text-primary">
                  {t.name}
                </h3>
                <Badge tone={meta.tone} dot>{meta.label}</Badge>
              </div>
              {showProject && (
                <p className="truncate text-[13px] text-muted">{getProject(t.projectId)?.name ?? "—"}</p>
              )}
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-3 text-2xs text-subtle">
                <span>{t.blocks.length} block{t.blocks.length === 1 ? "" : "s"}</span>
                {tallies && (
                  <span>
                    {tallies[t.id]?.sessions ?? 0} response{(tallies[t.id]?.sessions ?? 0) === 1 ? "" : "s"}
                  </span>
                )}
                {t.createdAt && <span className="ml-auto">{formatDate(t.createdAt)}</span>}
              </div>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-border text-2xs uppercase tracking-wide text-subtle">
            <SortTh label="Test" k="name" sort={sort} onSort={onSort} />
            {showProject && <SortTh label="Project" k="project" sort={sort} onSort={onSort} />}
            <SortTh label="Status" k="status" sort={sort} onSort={onSort} />
            <SortTh label="Blocks" k="blocks" sort={sort} onSort={onSort} center />
            <SortTh label="Responses" k="responses" sort={sort} onSort={onSort} center />
            <SortTh label="Created" k="created" sort={sort} onSort={onSort} />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const meta = TEST_STATUS_META[t.status];
            return (
              <tr key={t.id} className="group border-b border-border last:border-0 hover:bg-surface-hover">
                <td className="max-w-xs px-4 py-2.5">
                  <Link href={`/tests/${t.id}`} className="block min-w-0">
                    <p className="truncate font-medium text-foreground group-hover:text-primary">{t.name}</p>
                  </Link>
                </td>
                {showProject && (
                  <td className="max-w-[14rem] px-4 py-2.5 text-muted">
                    <span className="block truncate">{getProject(t.projectId)?.name ?? "—"}</span>
                  </td>
                )}
                <td className="px-4 py-2.5"><Badge tone={meta.tone} dot>{meta.label}</Badge></td>
                <td className="px-4 py-2.5 text-center tabular-nums text-muted">{t.blocks.length}</td>
                <td className={cn("px-4 py-2.5 text-center tabular-nums", tallies ? "text-muted" : "text-subtle")}>
                  {responseLabel(t, tallies)}
                </td>
                <td className="px-4 py-2.5 text-muted">{t.createdAt ? formatDate(t.createdAt) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Flat list of tests. `showProject` is off inside a project, where naming the
    project on every row says nothing. */
export function TestList({ rows, showProject = true }: { rows: UsabilityTest[]; showProject?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {rows.map((t) => {
        const meta = TEST_STATUS_META[t.status];
        return (
          <Link
            key={t.id}
            href={`/tests/${t.id}`}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 hover:border-border-strong hover:shadow-xs"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{t.name}</p>
              <p className="truncate text-xs text-subtle">
                {showProject ? `${getProject(t.projectId)?.name ?? "—"} · ` : ""}
                {t.blocks.length} block{t.blocks.length === 1 ? "" : "s"}
                {t.createdAt ? ` · created ${t.createdAt.slice(0, 10)}` : ""}
              </p>
            </div>
            <Badge tone={meta.tone} dot>
              {meta.label}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}

/**
 * What's collecting right now, for the project overview.
 *
 * A count of tests says nothing actionable; a live test's share link does. So
 * this leads with the links you'd actually reach for, and reduces everything
 * else to a line of counts. Renders nothing at all for a project with no
 * tests — an empty card on the overview would just be furniture.
 */
export function LiveTestsCard({ rows, projectId }: { rows: UsabilityTest[]; projectId: string }) {
  const toast = useApp((s) => s.toast);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  // Absolute URLs only exist client-side; resolve after mount so the markup
  // doesn't change during hydration.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  if (rows.length === 0) return null;

  const live = rows
    .filter((t) => t.status === "active")
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "")); // newest first
  const drafts = rows.filter((t) => t.status === "draft").length;
  const closed = rows.filter((t) => t.status === "closed").length;

  /** Confirm only what actually happened: browsers refuse clipboard writes in
      several situations, and a check-mark over a failed copy is worse than no
      feedback — you'd send someone a link you never copied. */
  const copy = (t: UsabilityTest) => {
    navigator.clipboard
      ?.writeText(testShareUrl(t.shareToken))
      .then(() => {
        setCopiedId(t.id);
        setTimeout(() => setCopiedId((cur) => (cur === t.id ? null : cur)), 1500);
      })
      .catch(() => toast("Couldn't copy the link — open the test to copy it there.", "error"));
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          {live.length ? `Collecting now (${live.length})` : "Tests"}
        </h2>
        <Link
          href={`/projects/${projectId}?tab=tests`}
          className="ml-auto text-xs font-medium text-primary hover:underline"
        >
          All {rows.length}
        </Link>
      </div>

      {live.length ? (
        <div className="flex flex-col gap-2.5">
          {live.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-surface-2 p-2.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                <Link
                  href={`/tests/${t.id}`}
                  className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground hover:text-primary"
                >
                  {t.name}
                </Link>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <code className="min-w-0 flex-1 truncate rounded border border-border bg-surface px-1.5 py-0.5 text-2xs text-muted">
                  {mounted ? testShareUrl(t.shareToken) : `/t/${t.shareToken}`}
                </code>
                <button
                  type="button"
                  onClick={() => copy(t)}
                  title="Copy the participant link"
                  aria-label={`Copy the participant link for ${t.name}`}
                  className="shrink-0 rounded p-1 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
                >
                  {copiedId === t.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-muted">
          No test is collecting right now — {drafts > 0 ? "publish a draft" : "the tests here are closed"} to start.
        </p>
      )}

      {(drafts > 0 || closed > 0) && (
        <p className="mt-3 text-2xs text-subtle">
          {[drafts > 0 ? `${drafts} draft${drafts === 1 ? "" : "s"}` : null, closed > 0 ? `${closed} closed` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      )}
    </Card>
  );
}

/**
 * New-test dialog. Pass `projectId` to pin the test to one project (the project
 * hub, where the project is already the context) — the picker is then omitted.
 * Creating always navigates to the new test's builder.
 */
export function NewTestModal({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId?: string;
}) {
  const router = useRouter();
  const addTest = useApp((s) => s.addTest);
  const [name, setName] = React.useState("");
  const [target, setTarget] = React.useState(projectId ?? projects[0]?.id ?? "");

  // Reopening should start clean, and a pinned project may have changed.
  React.useEffect(() => {
    if (!open) return;
    setName("");
    setTarget(projectId ?? projects[0]?.id ?? "");
  }, [open, projectId]);

  const create = () => {
    if (!name.trim() || !target) return;
    const id = uid("ut");
    addTest({
      id,
      projectId: target,
      name: name.trim(),
      status: "draft",
      shareToken: randomToken(),
      createdById: currentUserId,
      blocks: [
        {
          id: uid("b"),
          type: "message",
          title: "Welcome!",
          bodyMd:
            "Thanks for helping us out. This takes about 5 minutes — there are no wrong answers; we're testing the design, not you.",
          isConsentGate: true,
          consentText: DEFAULT_CONSENT_TEXT,
        },
      ],
    });
    router.push(`/tests/${id}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New test"
      description="Starts as a draft with an intro & consent block — add tasks, then publish to get the share link."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!name.trim() || !target} onClick={create}>
            Create test
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <Label>Name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Checkout flow — first usability round"
          />
        </div>
        {!projectId && (
          <div>
            <Label>Project</Label>
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
    </Modal>
  );
}
