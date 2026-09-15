"use client";

import * as React from "react";
import { Plus, Search, Upload, MessageSquare, ListChecks } from "lucide-react";
import { interviews, projects, users, isScheduledInterview } from "@/lib/db";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import {
  InterviewViews,
  interviewSortValue,
  INTERVIEW_DESC_FIRST,
  type InterviewSortKey,
} from "@/components/interviews/interview-views";
import { InterviewFormModal } from "@/components/forms/interview-form";
import { ConfirmDialog } from "@/components/ui/confirm";
import { useBulkSelect, BulkBar } from "@/components/ui/bulk-select";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { useSortState, sortRows } from "@/components/ui/sort-table";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Attachment, AttachmentKind } from "@/lib/types";
import { uid } from "@/lib/utils";

function attachmentKind(file: File): AttachmentKind {
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("image/")) return "image";
  if (/\.(txt|vtt|srt)$/i.test(file.name)) return "transcript";
  return "document";
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function InterviewsPage() {
  const version = useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const deleteInterview = useApp((s) => s.deleteInterview);
  const toast = useApp((s) => s.toast);
  const sel = useBulkSelect();
  const [view, setView] = useListView("interviews", "list");
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [project, setProject] = React.useState("all");
  const [researcher, setResearcher] = React.useState("all");
  const [sentiment, setSentiment] = React.useState("all");
  const [when, setWhen] = React.useState<"all" | "scheduled" | "done">("all");
  const [sort, toggleSort, setSort] = useSortState<InterviewSortKey>({ key: "date", dir: -1 }, INTERVIEW_DESC_FIRST);
  const [showNew, setShowNew] = React.useState(false);
  const [uploaded, setUploaded] = React.useState<Attachment[] | undefined>(undefined);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const onFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const attachments: Attachment[] = Array.from(files).map((f) => ({
      id: uid("at"),
      name: f.name,
      kind: attachmentKind(f),
      sizeLabel: humanSize(f.size),
      addedDate: new Date().toISOString().slice(0, 10),
    }));
    setUploaded(attachments);
    setShowNew(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return interviews.filter((iv) => {
      if (when !== "all" && isScheduledInterview(iv) !== (when === "scheduled")) return false;
      if (project !== "all" && !iv.projectIds.includes(project)) return false;
      if (researcher !== "all" && iv.researcherId !== researcher) return false;
      if (sentiment !== "all" && iv.sentiment !== sentiment) return false;
      if (q && !`${iv.title} ${iv.aiSummary}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, project, researcher, sentiment, when, version]);

  // One sort for every view; column headers drive it in the table.
  const sorted = React.useMemo(() => sortRows(filtered, sort, interviewSortValue), [filtered, sort]);

  const filteredIds = filtered.map((iv) => iv.id);
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => sel.isSelected(id));
  const runDelete = () => {
    const n = sel.count;
    sel.selected.forEach((id) => deleteInterview(id));
    sel.stop();
    toast(`Deleted ${n} interview${n === 1 ? "" : "s"}`, "info");
  };

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={MessageSquare} />}
        title="Interviews"
        description="Every recorded session — with AI summaries, notes, transcripts, and follow-ups in one place."
        actions={
          canManage ? (
            sel.selecting ? (
              <Button variant="outline" size="sm" onClick={sel.stop}>Cancel</Button>
            ) : (
              <>
                <Button variant="outline" size="sm" onClick={sel.start}>
                  <ListChecks className="h-4 w-4" /> Select
                </Button>
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="audio/*,video/*,image/*,.pdf,.doc,.docx,.txt,.vtt,.srt"
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setUploaded(undefined);
                    setShowNew(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> New interview
                </Button>
              </>
            )
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search interviews…" className="pl-8" />
          </div>
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="all">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Select value={researcher} onChange={(e) => setResearcher(e.target.value)}>
            <option value="all">All researchers</option>
            {users.filter((u) => u.role === "researcher" || u.role === "admin").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select value={sentiment} onChange={(e) => setSentiment(e.target.value)}>
            <option value="all">Any sentiment</option>
            <option value="positive">Positive</option>
            <option value="mixed">Mixed</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </Select>
          <Segmented
            value={when}
            onChange={(v) => {
              setWhen(v);
              // Scheduled reads soonest-first; the others most-recent-first.
              setSort({ key: "date", dir: v === "scheduled" ? 1 : -1 });
            }}
            size="sm"
            options={[
              { value: "all", label: "All" },
              { value: "scheduled", label: "Scheduled" },
              { value: "done", label: "Completed" },
            ]}
          />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-subtle">{filtered.length} interviews</span>
            <ListViewToggle view={view} onChange={setView} withTable />
          </div>
        </div>
      </PageHeader>

      <PageBody wide>
        {filtered.length === 0 ? (
          <EmptyState icon={<MessageSquare className="h-5 w-5" />} title="No interviews match" description="Try a different filter." />
        ) : (
          <InterviewViews rows={sorted} view={view} sort={sort} onSort={toggleSort} sel={sel} />
        )}
      </PageBody>

      <BulkBar
        count={sel.count}
        noun="interview"
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
        title={`Delete ${sel.count} interview${sel.count === 1 ? "" : "s"}?`}
        confirmLabel="Delete"
        body={
          <>
            This permanently removes the selected interview{sel.count === 1 ? "" : "s"} and detaches
            {sel.count === 1 ? " it" : " them"} from any insights and boards. This can&apos;t be undone.
          </>
        }
      />

      <InterviewFormModal
        open={showNew}
        onClose={() => {
          setShowNew(false);
          setUploaded(undefined);
        }}
        initialAttachments={uploaded}
      />
    </>
  );
}
