"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Pencil,
  Share2,
  Users,
  FolderOpen,
  Sparkles,
  Link2,
  FileJson,
  Printer,
  X,
  Plus,
  MessageSquare,
  MousePointerClick,
} from "lucide-react";
import {
  getInsight,
  getInsights,
  getParticipants,
  getInterviews,
  getTest,
  getProjects,
  getThemes,
  getTags,
  getPersonas,
  getUser,
  insights as allInsights,
  interviews as allInterviews,
  themes as allThemes,
  tags as allTags,
  personas as allPersonas,
  projects as allProjects,
  aiSuggestions,
  fullName,
  currentUser,
} from "@/lib/db";
import type { HighlightKind, Severity, Impact, Confidence } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { downloadText, printReport, insightReportHtml, stamp } from "@/lib/export";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { MissingRecord } from "@/components/ui/missing-record";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel } from "@/components/ui/menu";
import { InsightFormModal } from "@/components/forms/insight-form";
import { InlineEditor } from "@/components/ui/inline-editor";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { MultiOption } from "@/components/ui/multi-check";
import { MultiSelect } from "@/components/ui/multi-select";
import { AccentPill } from "@/components/ui/accent";
import {
  HighlightKindBadge,
  SeverityBadge,
  ImpactBadge,
  ConfidenceBadge,
  ThemeChip,
  TagChip,
  PersonaChip,
  highlightKindMeta,
} from "@/components/domain/badges";
import { formatDate, accentFor } from "@/lib/utils";

const KINDS = Object.keys(highlightKindMeta) as HighlightKind[];

/**
 * Token-style picker for a large option set: shows only the selected items as
 * removable chips, plus a compact "Add…" dropdown — far tidier than a wall of
 * every possible toggle.
 */
function ChipPicker({
  label,
  addLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  addLabel: string;
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const selected = options.filter((o) => value.includes(o.id));
  return (
    <div>
      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</p>
      <MultiSelect
        options={options}
        value={value}
        onChange={onChange}
        placeholder={addLabel}
        summaryMode="static"
        className="sm:max-w-xs"
      />
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((o) => (
            <AccentPill
              key={o.id}
              accent={o.accent ?? "slate"}
              size="sm"
              onRemove={() => onChange(value.filter((x) => x !== o.id))}
            >
              {o.label}
            </AccentPill>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InsightDetail() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const toast = useApp((s) => s.toast);
  const logExport = useApp((s) => s.logExport);
  const updateInsight = useApp((s) => s.updateInsight);
  const linkInterview = useApp((s) => s.linkInsightInterview);
  const unlinkInterview = useApp((s) => s.unlinkInsightInterview);
  const linkRelated = useApp((s) => s.linkRelatedInsights);
  const unlinkRelated = useApp((s) => s.unlinkRelatedInsights);
  const [showEdit, setShowEdit] = React.useState(false);
  const [editing, setEditing] = React.useState<null | "description" | "evidence">(null);
  const [draft, setDraft] = React.useState("");

  const ins = getInsight(id);
  if (!ins) return <MissingRecord hydrated={hydrated} />;

  const participants = getParticipants(ins.participantIds);
  const interviews = getInterviews(ins.interviewIds);
  const sourceTests = (ins.testIds ?? []).map((id) => ({ id, test: getTest(id) }));
  const projects = getProjects(ins.projectIds);
  const themes = getThemes(ins.themeIds);
  const tags = getTags(ins.tagIds);
  const personaList = getPersonas(ins.personaIds);
  const author = getUser(ins.createdById);

  // Explicitly linked insights (user-controlled).
  const related = getInsights(ins.relatedInsightIds ?? []);
  const relatedIdSet = new Set([ins.id, ...(ins.relatedInsightIds ?? [])]);
  // Suggestions: share a theme but aren't linked yet.
  const suggestions = allInsights
    .filter((x) => !relatedIdSet.has(x.id) && x.themeIds.some((t) => ins.themeIds.includes(t)))
    .slice(0, 5);
  const aiNotes = aiSuggestions.filter((s) => s.relatedIds?.includes(ins.id));

  const startEdit = (which: "description" | "evidence") => {
    setDraft(which === "description" ? ins.description : ins.evidence);
    setEditing(which);
  };
  const saveEdit = () => {
    if (editing === "description") updateInsight(ins.id, { description: draft.trim() });
    else if (editing === "evidence") updateInsight(ins.id, { evidence: draft.trim() });
    setEditing(null);
    toast("Saved");
  };

  const slug = ins.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
  const doExport = (kind: "json" | "pdf") => {
    if (kind === "json") {
      downloadText(
        stamp(slug, "json"),
        JSON.stringify({ insight: ins, participants, interviews, projects }, null, 2),
        "application/json",
      );
      toast("Insight exported as JSON");
    } else {
      const ok = printReport(ins.title, insightReportHtml(ins));
      if (!ok) return toast("Pop-up blocked — allow pop-ups to export PDF", "error");
      toast("Report opened — use your browser's Save as PDF");
    }
    logExport(`${ins.title} (${kind.toUpperCase()})`, currentUser().name);
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Insights", href: "/insights" }, { label: ins.title }]}
        title={ins.title}
        actions={
          <>
            {can(role, "export") && (
              <Menu>
                <MenuTrigger>
                  <Button variant="outline" size="sm">
                    <Share2 className="h-4 w-4" /> Export
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuLabel>Download as</MenuLabel>
                  <MenuItem icon={<FileJson className="h-4 w-4" />} onSelect={() => doExport("json")}>
                    JSON (full relations)
                  </MenuItem>
                  <MenuItem icon={<Printer className="h-4 w-4" />} onSelect={() => doExport("pdf")}>
                    PDF report
                  </MenuItem>
                </MenuContent>
              </Menu>
            )}
            {can(role, "manage-content") && (
              <Button variant="primary" size="sm" onClick={() => setShowEdit(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5 pb-4">
          <HighlightKindBadge kind={ins.type} size="md" />
          <SeverityBadge value={ins.severity} />
          <ImpactBadge value={ins.impact} />
          <ConfidenceBadge value={ins.confidence} />
          <span className="text-xs text-subtle">
            · {ins.productArea} · added {formatDate(ins.createdDate)}{author ? ` by ${author.name}` : ""}
          </span>
        </div>
      </PageHeader>

      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-5">
            {/* Overview (description) — editable */}
            <Card className="group p-5">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Overview</h2>
                {canManage && editing !== "description" && (
                  <Button variant="ghost" size="sm" className="ml-auto opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" onClick={() => startEdit("description")} aria-label="Edit overview">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {editing === "description" ? (
                <InlineEditor
                  value={draft}
                  onChange={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  rows={3}
                  placeholder="A one or two sentence summary of the finding…"
                />
              ) : ins.description ? (
                <p className="text-[15px] leading-relaxed text-muted">{ins.description}</p>
              ) : (
                <p className="text-[13px] text-subtle">No overview yet.{canManage ? " Click the pencil to add one." : ""}</p>
              )}
            </Card>

            {/* Evidence — editable */}
            <Card className="group p-5">
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Evidence</h2>
                {canManage && editing !== "evidence" && (
                  <Button variant="ghost" size="sm" className="ml-auto opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" onClick={() => startEdit("evidence")} aria-label="Edit evidence">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {editing === "evidence" ? (
                <InlineEditor
                  value={draft}
                  onChange={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  rows={6}
                  placeholder="What did you observe, and where? The data that backs this insight…"
                />
              ) : ins.evidence ? (
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{ins.evidence}</p>
              ) : (
                <p className="text-[13px] text-subtle">No evidence documented yet.{canManage ? " Click the pencil to add it." : ""}</p>
              )}
            </Card>

            {/* Attributes — edited in place; the dialog only carries title + description */}
            {canManage && (
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Attributes</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Severity</span>
                    <Select
                      value={ins.severity ?? ""}
                      onChange={(e) => updateInsight(ins.id, { severity: (e.target.value || undefined) as Severity | undefined })}
                      className="h-9 text-[13px]"
                      aria-label="Severity"
                    >
                      <option value="">Unrated</option>
                      {["low", "medium", "high", "critical"].map((x) => <option key={x} value={x}>{x}</option>)}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Impact</span>
                    <Select
                      value={ins.impact ?? ""}
                      onChange={(e) => updateInsight(ins.id, { impact: (e.target.value || undefined) as Impact | undefined })}
                      className="h-9 text-[13px]"
                      aria-label="Impact"
                    >
                      <option value="">Unrated</option>
                      {["low", "medium", "high"].map((x) => <option key={x} value={x}>{x}</option>)}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Confidence</span>
                    <Select
                      value={ins.confidence ?? ""}
                      onChange={(e) => updateInsight(ins.id, { confidence: (e.target.value || undefined) as Confidence | undefined })}
                      className="h-9 text-[13px]"
                      aria-label="Confidence"
                    >
                      <option value="">Unrated</option>
                      {["low", "medium", "high"].map((x) => <option key={x} value={x}>{x}</option>)}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Type</span>
                    <Select
                      value={ins.type}
                      onChange={(e) => updateInsight(ins.id, { type: e.target.value as HighlightKind })}
                      className="h-9 text-[13px]"
                      aria-label="Insight type"
                    >
                      {KINDS.map((k) => <option key={k} value={k}>{highlightKindMeta[k].label}</option>)}
                    </Select>
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">Product area</span>
                    <Input
                      key={ins.id}
                      defaultValue={ins.productArea}
                      onBlur={(e) => {
                        const v = e.target.value.trim() || "Platform";
                        if (v !== ins.productArea) updateInsight(ins.id, { productArea: v });
                      }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      className="h-9 text-[13px]"
                      placeholder="e.g. Mobile"
                      aria-label="Product area"
                    />
                  </label>
                </div>
              </Card>
            )}

            {/* Classification — personas / themes / tags, editable in place */}
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Classification</h2>
              {canManage ? (
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ChipPicker
                    label="Personas"
                    addLabel="Add persona…"
                    options={allPersonas.map((p) => ({ id: p.id, label: p.name, accent: p.accent }))}
                    value={ins.personaIds}
                    onChange={(v) => updateInsight(ins.id, { personaIds: v })}
                  />
                  <ChipPicker
                    label="Themes"
                    addLabel="Add theme…"
                    options={allThemes.map((t) => ({ id: t.id, label: t.name, accent: t.accent }))}
                    value={ins.themeIds}
                    onChange={(v) => updateInsight(ins.id, { themeIds: v })}
                  />
                  <ChipPicker
                    label="Tags"
                    addLabel="Add tag…"
                    options={allTags.filter((t) => t.kind !== "behaviour").map((t) => ({ id: t.id, label: t.label, accent: t.accent }))}
                    value={ins.tagIds}
                    onChange={(v) => updateInsight(ins.id, { tagIds: v })}
                  />
                </div>
              ) : personaList.length > 0 || themes.length > 0 || tags.length > 0 ? (
                <>
                  {personaList.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Personas</p>
                      <div className="flex flex-wrap gap-1.5">{personaList.map((pe) => <PersonaChip key={pe.id} persona={pe} />)}</div>
                    </div>
                  )}
                  {themes.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Themes</p>
                      <div className="flex flex-wrap gap-1.5">{themes.map((t) => <ThemeChip key={t.id} theme={t} href={`/themes`} />)}</div>
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Tags</p>
                      <div className="flex flex-wrap gap-1.5">{tags.map((t) => <TagChip key={t.id} tag={t} href={`/tags`} />)}</div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[13px] text-subtle">No classification yet.</p>
              )}
            </Card>

            {/* Source tests — set by "promote to insight" on a test's results.
                Read-only besides unlink: the link is created by promoting, not
                by browsing for a test here. A deleted test leaves the insight
                intact but is named as gone rather than silently dropped. */}
            {sourceTests.length > 0 && (
              <Card className="p-5">
                <div className="mb-1 flex items-center gap-2">
                  <MousePointerClick className="h-4 w-4 text-muted" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Source tests <span className="text-subtle">({sourceTests.length})</span>
                  </h2>
                </div>
                <p className="mb-3 text-xs text-subtle">This insight was promoted from these usability test results.</p>
                <div className="flex flex-col gap-2">
                  {sourceTests.map(({ id, test }) => (
                    <div key={id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      {test ? (
                        <Link href={`/tests/${id}/results`} className="group flex min-w-0 flex-1 items-center gap-2">
                          <MousePointerClick className="h-3.5 w-3.5 shrink-0 text-subtle" />
                          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground group-hover:text-primary">{test.name}</span>
                          <span className="shrink-0 text-2xs text-subtle">results</span>
                        </Link>
                      ) : (
                        <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] text-subtle">
                          <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                          Test deleted — the evidence text above is what remains
                        </span>
                      )}
                      {canManage && (
                        <button
                          onClick={() => {
                            updateInsight(ins.id, { testIds: (ins.testIds ?? []).filter((t) => t !== id) });
                            toast("Test unlinked", "info");
                          }}
                          className="shrink-0 rounded p-1 text-subtle hover:bg-surface-hover hover:text-danger"
                          aria-label="Unlink test"
                          title="Unlink"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Source interviews — the interviews this insight came from */}
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted" />
                <h2 className="text-sm font-semibold text-foreground">
                  Source interviews <span className="text-subtle">({interviews.length})</span>
                </h2>
              </div>
              <p className="mb-3 text-xs text-subtle">The interviews this finding is based on. Linking one also adds its participant and projects here.</p>
              {interviews.length > 0 ? (
                <div className="mb-3 flex flex-col gap-2">
                  {interviews.map((iv) => (
                    <div key={iv.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      <Link href={`/interviews/${iv.id}`} className="group flex min-w-0 flex-1 items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-subtle" />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground group-hover:text-primary">{iv.title}</span>
                        <span className="shrink-0 text-2xs text-subtle">{formatDate(iv.date)}</span>
                      </Link>
                      {canManage && (
                        <button
                          onClick={() => { unlinkInterview(ins.id, iv.id); toast("Interview unlinked", "info"); }}
                          className="shrink-0 rounded p-1 text-subtle hover:bg-surface-hover hover:text-danger"
                          aria-label={`Unlink ${iv.title}`}
                          title="Unlink"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-[13px] text-subtle">Not linked to any interview yet.</p>
              )}
              {canManage && (
                <SearchableSelect
                  value="all"
                  onChange={(ivId) => { if (ivId !== "all") { linkInterview(ins.id, ivId); toast("Interview linked"); } }}
                  allLabel="+ Link a source interview"
                  placeholder="Search interviews…"
                  options={allInterviews
                    .filter((iv) => !ins.interviewIds.includes(iv.id))
                    .map((iv) => ({ value: iv.id, label: iv.title }))}
                />
              )}
            </Card>

            {/* Related insights — explicit, user-controlled links */}
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted" />
                <h2 className="text-sm font-semibold text-foreground">
                  Related insights <span className="text-subtle">({related.length})</span>
                </h2>
              </div>
              <p className="mb-3 text-xs text-subtle">
                Insights you&apos;ve deliberately connected to this one — reinforcing findings, causes, or consequences. Linking is two-way, so it shows on both insights.
              </p>
              {related.length > 0 ? (
                <div className="mb-3 flex flex-col gap-2">
                  {related.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
                      <Link href={`/insights/${r.id}`} className="group flex min-w-0 flex-1 items-center gap-2">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-subtle" />
                        <span className="min-w-0 flex-1 truncate text-[13px] text-foreground group-hover:text-primary">{r.title}</span>
                        <HighlightKindBadge kind={r.type} />
                      </Link>
                      {canManage && (
                        <button
                          onClick={() => { unlinkRelated(ins.id, r.id); toast("Insight unlinked", "info"); }}
                          className="shrink-0 rounded p-1 text-subtle hover:bg-surface-hover hover:text-danger"
                          aria-label={`Unlink ${r.title}`}
                          title="Unlink"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mb-3 text-[13px] text-subtle">No linked insights yet.</p>
              )}
              {canManage && (
                <SearchableSelect
                  value="all"
                  onChange={(insId) => { if (insId !== "all") { linkRelated(ins.id, insId); toast("Insight linked"); } }}
                  allLabel="+ Link an insight"
                  placeholder="Search insights…"
                  options={allInsights
                    .filter((x) => !relatedIdSet.has(x.id))
                    .map((x) => ({ value: x.id, label: x.title }))}
                />
              )}

              {canManage && suggestions.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
                    <Sparkles className="h-3 w-3" /> Shares a theme with
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                        <Link href={`/insights/${s.id}`} className="min-w-0 flex-1 truncate text-[13px] text-muted hover:text-primary">{s.title}</Link>
                        <button
                          onClick={() => { linkRelated(ins.id, s.id); toast("Insight linked"); }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-0.5 text-2xs font-medium text-muted hover:border-border-strong hover:text-foreground"
                        >
                          <Plus className="h-3 w-3" /> Link
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">
            {aiNotes.length > 0 && (
              <Card className="border-primary/30 bg-primary-soft/40 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">AI notes</h2>
                </div>
                <div className="flex flex-col gap-2">
                  {aiNotes.map((n) => (
                    <p key={n.id} className="text-[13px] text-muted">
                      <span className="font-medium text-foreground">{n.title}.</span> {n.detail}
                    </p>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">Reusable across</h2>
              <div className="mb-3 flex items-center gap-2 text-[13px] text-muted">
                <FolderOpen className="h-4 w-4" />
                Linked to <span className="font-semibold text-foreground">{projects.length}</span> projects
              </div>
              <div className="flex flex-col gap-2">
                {projects.map((pr) => (
                  <Link key={pr.id} href={`/projects/${pr.id}`} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px] hover:bg-surface-hover">
                    <span className="truncate text-foreground">{pr.name}</span>
                    <span className="shrink-0 text-2xs text-subtle">{pr.status}</span>
                  </Link>
                ))}
              </div>
              {canManage && (
                <div className="mt-3">
                  <MultiSelect
                    options={allProjects.map((p) => ({ id: p.id, label: p.name, accent: accentFor(p.id) }))}
                    value={ins.projectIds}
                    onChange={(v) => updateInsight(ins.id, { projectIds: v })}
                    placeholder="Add or remove projects…"
                    summaryMode="count"
                  />
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-muted" /> Participants ({participants.length})
              </h2>
              <div className="flex flex-col gap-2">
                {participants.map((p) => (
                  <Link key={p.id} href={`/participants/${p.id}`} className="flex items-center gap-2.5 hover:opacity-80">
                    <Avatar name={fullName(p)} accent={p.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{fullName(p)}</p>
                      <p className="truncate text-xs text-subtle">{p.jobTitle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

          </div>
        </div>
      </PageBody>

      <InsightFormModal open={showEdit} onClose={() => setShowEdit(false)} insight={ins} />
    </>
  );
}
