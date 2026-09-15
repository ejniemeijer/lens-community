"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  Target,
  Users,
  MessageSquare,
  Lightbulb,
  ListChecks,
  Network,
  Columns3,
  Sparkles,
  FileText,
  FileJson,
  FileSpreadsheet,
  FileArchive,
  Download,
  Calendar,
  Pencil,
  MousePointerClick,
  Plus,
  UserPlus,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import {
  getProject,
  getUser,
  getUsers,
  projectParticipants,
  projectInterviews,
  projectInsights,
  projectTests,
  getTheme,
  fullName,
  currentUser,
} from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { runExport, type ExportFormat } from "@/lib/export";
import type { ResearchProject } from "@/lib/types";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarGroup } from "@/components/ui/avatar";
import { DetailRow, Meter, Stat } from "@/components/ui/misc";
import { EditableCard } from "@/components/ui/editable-card";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { MissingRecord } from "@/components/ui/missing-record";
import { Tabs, useTabParam } from "@/components/ui/tabs";
import { ProjectFormModal } from "@/components/forms/project-form";
import { ParticipantFormModal } from "@/components/forms/participant-form";
import { InterviewFormModal } from "@/components/forms/interview-form";
import { InsightFormModal } from "@/components/forms/insight-form";
import { AddParticipantsDialog } from "@/components/forms/add-participants-dialog";
import {
  LiveTestsCard,
  NewTestModal,
  TestViews,
  testSortValue,
  TEST_DESC_FIRST,
  type TestSortKey,
} from "@/components/tests/test-views";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ProjectStatusBadge, ThemeChip, HighlightKindBadge } from "@/components/domain/badges";
import {
  ParticipantViews,
  participantSortValue,
  PARTICIPANT_DESC_FIRST,
  type ParticipantSortKey,
} from "@/components/participants/participant-views";
import {
  InterviewViews,
  interviewSortValue,
  INTERVIEW_DESC_FIRST,
  type InterviewSortKey,
} from "@/components/interviews/interview-views";
import {
  InsightViews,
  insightSortValue,
  INSIGHT_DESC_FIRST,
  type InsightSortKey,
} from "@/components/insights/insight-views";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { useSortState, sortRows } from "@/components/ui/sort-table";
import { AffinityBoard } from "@/components/boards/affinity-board";
import { KanbanBoard } from "@/components/boards/kanban-board";
import { AiProse } from "@/components/ui/ai-prose";
import { streamAI, aiEnabled, AiError } from "@/lib/ai";
import { projectSummaryContext } from "@/lib/ai-context";
import { fetchSessionTallies, useSessionTallies } from "@/lib/test-sessions";
import { formatDate, uid } from "@/lib/utils";

const linesOf = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

/* ---------------- inline-editable overview cards ---------------- */

function ObjectiveCard({ project, canManage }: { project: ResearchProject; canManage: boolean }) {
  const updateProject = useApp((s) => s.updateProject);
  const [objective, setObjective] = React.useState(project.objective);
  return (
    <EditableCard
      title="Objective"
      icon={<Target className="h-4 w-4" />}
      canEdit={canManage}
      onEdit={() => setObjective(project.objective)}
      onSave={() => updateProject(project.id, { objective: objective.trim() })}
      editor={
        <Textarea
          autoFocus
          rows={4}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="What is this study trying to learn or decide?"
        />
      }
    >
      {project.objective ? (
        <p className="text-[15px] leading-relaxed text-muted">{project.objective}</p>
      ) : (
        <p className="text-[13px] text-subtle">No objective set yet.</p>
      )}
    </EditableCard>
  );
}

function ResearchQuestionsCard({ project, canManage }: { project: ResearchProject; canManage: boolean }) {
  const updateProject = useApp((s) => s.updateProject);
  const [draft, setDraft] = React.useState("");
  const answered = project.researchQuestions.filter((q) => q.answered).length;

  const save = () => {
    const existing = project.researchQuestions;
    updateProject(project.id, {
      researchQuestions: linesOf(draft).map((text) => {
        const match = existing.find((q) => q.text === text);
        return match ?? { id: uid("rq"), text, answered: false };
      }),
    });
  };

  return (
    <EditableCard
      title="Research questions"
      canEdit={canManage}
      saveLabel="Save questions"
      hint="One question per line"
      onEdit={() => setDraft(project.researchQuestions.map((q) => q.text).join("\n"))}
      onSave={save}
      editor={
        <Textarea
          autoFocus
          rows={5}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={"How do planners recover from a breakdown?\nWhat blocks mobile adoption in the field?"}
        />
      }
    >
      {project.researchQuestions.length === 0 ? (
        <p className="text-[13px] text-subtle">No research questions yet.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2.5">
            {project.researchQuestions.map((q) => (
              <li key={q.id} className="flex items-start gap-2.5 text-[13px]">
                <button
                  type="button"
                  disabled={!canManage}
                  title={canManage ? (q.answered ? "Mark as unanswered" : "Mark as answered") : undefined}
                  aria-pressed={q.answered}
                  onClick={() =>
                    updateProject(project.id, {
                      researchQuestions: project.researchQuestions.map((rq) =>
                        rq.id === q.id ? { ...rq, answered: !rq.answered } : rq,
                      ),
                    })
                  }
                  className="shrink-0 rounded-full disabled:pointer-events-none"
                >
                  {q.answered ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 text-subtle hover:text-foreground" />
                  )}
                </button>
                <span className={q.answered ? "text-foreground" : "text-muted"}>{q.text}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4"><Meter value={answered / Math.max(1, project.researchQuestions.length)} /></div>
        </>
      )}
    </EditableCard>
  );
}

function SuccessCriteriaCard({ project, canManage }: { project: ResearchProject; canManage: boolean }) {
  const updateProject = useApp((s) => s.updateProject);
  const [draft, setDraft] = React.useState("");
  return (
    <EditableCard
      title="Success criteria"
      canEdit={canManage}
      hint="One per line"
      onEdit={() => setDraft(project.successCriteria.join("\n"))}
      onSave={() => updateProject(project.id, { successCriteria: linesOf(draft) })}
      editor={
        <Textarea
          autoFocus
          rows={4}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={"We can name the top 3 blockers to mobile adoption\nEvery research question has a supported answer"}
        />
      }
    >
      {project.successCriteria.length === 0 ? (
        <p className="text-[13px] text-subtle">No success criteria yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {project.successCriteria.map((c) => (
            <li key={c} className="flex items-start gap-2.5 text-[13px] text-muted">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />{c}
            </li>
          ))}
        </ul>
      )}
    </EditableCard>
  );
}

export default function ProjectDetail() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const createProjectBoard = useApp((s) => s.createProjectBoard);
  const deleteProject = useApp((s) => s.deleteProject);
  const toast = useApp((s) => s.toast);
  const kanbanBoards = useApp((s) => s.kanban);
  const affinityBoards = useApp((s) => s.affinity);
  const prefs = useApp((s) => s.prefs);
  const project = getProject(id);
  const [rawTab, setTab] = useTabParam("tab", "overview");
  const [showEdit, setShowEdit] = React.useState(false);
  const [showAddExisting, setShowAddExisting] = React.useState(false);
  const [showNewParticipant, setShowNewParticipant] = React.useState(false);
  const [showNewInterview, setShowNewInterview] = React.useState(false);
  const [showNewInsight, setShowNewInsight] = React.useState(false);
  const [showNewTest, setShowNewTest] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  // Same table/cards/list switcher as the standalone pages, remembered
  // separately per tab so the project hub can differ from the global lists.
  const [pView, setPView] = useListView("project-participants", "cards");
  const [ivView, setIvView] = useListView("project-interviews", "list");
  const [insView, setInsView] = useListView("project-insights", "cards");
  const [pSort, togglePSort] = useSortState<ParticipantSortKey>({ key: "name", dir: 1 }, PARTICIPANT_DESC_FIRST);
  const [ivSort, toggleIvSort] = useSortState<InterviewSortKey>({ key: "date", dir: -1 }, INTERVIEW_DESC_FIRST);
  const [insSort, toggleInsSort] = useSortState<InsightSortKey>({ key: "severity", dir: -1 }, INSIGHT_DESC_FIRST);
  const [tView, setTView] = useListView("project-tests", "list");
  const [tSort, toggleTSort] = useSortState<TestSortKey>({ key: "status", dir: 1 }, TEST_DESC_FIRST);

  if (!project) {
    if (leaving)
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      );
    return <MissingRecord hydrated={hydrated} />;
  }

  const owner = getUser(project.ownerId);
  const members = getUsers(project.memberIds);
  const participants = projectParticipants(project);
  const interviews = projectInterviews(project.id);
  const insights = projectInsights(project.id);
  const tests = projectTests(project.id);
  const sortedParticipants = sortRows(participants, pSort, participantSortValue);
  const sortedInterviews = sortRows(interviews, ivSort, interviewSortValue);
  const sortedInsights = sortRows(insights, insSort, insightSortValue);
  // Same shared sort as the /tests overview, so "live first, then newest" is
  // one definition rather than a hand-rolled comparator here.
  const tallies = useSessionTallies();
  const sortedTests = sortRows(tests, tSort, (t, k) => testSortValue(t, k, tallies));
  const answered = project.researchQuestions.filter((q) => q.answered).length;

  const affinity = affinityBoards.find((b) => b.projectId === project.id);
  const kanban = kanbanBoards.find((b) => b.projectId === project.id);

  const tabs = [
    { value: "overview", label: "Overview" },
    { value: "participants", label: "Participants", count: participants.length },
    { value: "interviews", label: "Interviews", count: interviews.length },
    { value: "insights", label: "Insights", count: insights.length },
    { value: "tests", label: "Tests", count: tests.length },
    ...(prefs["tabs.affinity"] !== false ? [{ value: "affinity", label: "Affinity" }] : []),
    ...(prefs["tabs.kanban"] !== false ? [{ value: "kanban", label: "Kanban" }] : []),
    ...(prefs["tabs.ai"] !== false ? [{ value: "ai", label: "AI Summary" }] : []),
    ...(prefs["tabs.reports"] !== false ? [{ value: "reports", label: "Reports" }] : []),
  ];
  // If the URL points at a hidden tab, fall back to Overview.
  const tab = tabs.some((t) => t.value === rawTab) ? rawTab : "overview";

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Projects", href: "/projects" }, { label: project.name }]}
        title={project.name}
        description={project.description}
        actions={
          <>
            <ProjectStatusBadge status={project.status} />
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Menu>
                  <MenuTrigger>
                    <Button variant="ghost" size="icon" aria-label="More project actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => setConfirmDelete(true)}>
                      Delete project
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </>
            )}
          </>
        }
      >
        <Tabs tabs={tabs} value={tab} onChange={setTab} className="border-b border-border" />
      </PageHeader>

      <PageBody
        // The list tabs stay at the wide (table) width for every view, so
        // switching table ↔ cards ↔ list never shifts the page layout.
        wide={
          tab === "affinity" ||
          tab === "kanban" ||
          tab === "participants" ||
          tab === "interviews" ||
          tab === "insights" ||
          tab === "tests"
        }
      >
        {tab === "overview" && (
          <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5">
              <ObjectiveCard project={project} canManage={canManage} />
              <ResearchQuestionsCard project={project} canManage={canManage} />
              <SuccessCriteriaCard project={project} canManage={canManage} />
            </div>
            <div className="flex flex-col gap-5">
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Details</h2>
                <dl className="grid grid-cols-1">
                  <DetailRow label="Product area">{project.productArea}</DetailRow>
                  <DetailRow label="Methodology">{project.methodology}</DetailRow>
                  <DetailRow label="Timeline">{formatDate(project.startDate)} – {formatDate(project.endDate)}</DetailRow>
                  <DetailRow label="Owner">{owner?.name}</DetailRow>
                </dl>
                <p className="mb-1.5 mt-2 text-2xs font-semibold uppercase tracking-wide text-subtle">Team</p>
                <div className="flex items-center gap-2">
                  <AvatarGroup names={members.map((m) => ({ name: m.name, accent: m.avatarColor }))} max={5} size="sm" />
                </div>
              </Card>
              {/* Renders nothing when the project has no tests. */}
              <LiveTestsCard rows={tests} projectId={project.id} />
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Participants" value={participants.length} icon={<Users className="h-4 w-4" />} accent="blue" />
                <Stat label="Interviews" value={interviews.length} icon={<MessageSquare className="h-4 w-4" />} accent="violet" />
                <Stat label="Insights" value={insights.length} icon={<Lightbulb className="h-4 w-4" />} accent="amber" />
                <Stat
                  label="Questions"
                  value={`${answered}/${project.researchQuestions.length}`}
                  icon={<ListChecks className="h-4 w-4" />}
                  accent="green"
                  hint={
                    project.researchQuestions.length > 0 ? (
                      <Meter value={answered / project.researchQuestions.length} accent="green" className="mt-1" />
                    ) : undefined
                  }
                />
              </div>
            </div>
          </div>
        )}

        {tab === "participants" && (
          <div className="flex flex-col gap-4">
            {participants.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowAddExisting(true)}>
                      <UserPlus className="h-4 w-4" /> Add existing
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowNewParticipant(true)}>
                      <Plus className="h-4 w-4" /> New participant
                    </Button>
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-subtle">{participants.length} in this project</span>
                  <ListViewToggle view={pView} onChange={setPView} withTable />
                </div>
              </div>
            )}
            {participants.length ? (
              <ParticipantViews rows={sortedParticipants} view={pView} sort={pSort} onSort={togglePSort} />
            ) : (
              <EmptyState
                icon={<Users className="h-5 w-5" />}
                title="No participants yet"
                description="Add people from your repository or create someone new to begin recruiting."
                action={
                  canManage ? (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowAddExisting(true)}>
                        <UserPlus className="h-4 w-4" /> Add existing
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => setShowNewParticipant(true)}>
                        <Plus className="h-4 w-4" /> New participant
                      </Button>
                    </div>
                  ) : undefined
                }
              />
            )}
          </div>
        )}

        {tab === "interviews" && (
          <div className="flex flex-col gap-4">
            {interviews.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <Button variant="primary" size="sm" onClick={() => setShowNewInterview(true)}>
                    <Plus className="h-4 w-4" /> New interview
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-subtle">{interviews.length} in this project</span>
                  <ListViewToggle view={ivView} onChange={setIvView} withTable />
                </div>
              </div>
            )}
            {interviews.length ? (
              <InterviewViews rows={sortedInterviews} view={ivView} sort={ivSort} onSort={toggleIvSort} />
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="No interviews yet"
                description="Start an interview with a participant to capture findings."
                action={
                  canManage ? (
                    <Button variant="primary" size="sm" onClick={() => setShowNewInterview(true)}>
                      <Plus className="h-4 w-4" /> New interview
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        )}

        {tab === "insights" && (
          <div className="flex flex-col gap-4">
            {insights.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <Button variant="primary" size="sm" onClick={() => setShowNewInsight(true)}>
                    <Plus className="h-4 w-4" /> New insight
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-subtle">{insights.length} in this project</span>
                  <ListViewToggle view={insView} onChange={setInsView} withTable />
                </div>
              </div>
            )}
            {insights.length ? (
              <InsightViews rows={sortedInsights} view={insView} sort={insSort} onSort={toggleInsSort} />
            ) : (
              <EmptyState
                icon={<Lightbulb className="h-5 w-5" />}
                title="No insights yet"
                description="Capture an evidence-backed finding and link it to this project."
                action={
                  canManage ? (
                    <Button variant="primary" size="sm" onClick={() => setShowNewInsight(true)}>
                      <Plus className="h-4 w-4" /> New insight
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        )}

        {tab === "tests" && (
          <div className="flex flex-col gap-4">
            {tests.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {canManage && (
                  <Button variant="primary" size="sm" onClick={() => setShowNewTest(true)}>
                    <Plus className="h-4 w-4" /> New test
                  </Button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-subtle">{tests.length} in this project</span>
                  <ListViewToggle view={tView} onChange={setTView} withTable />
                </div>
              </div>
            )}
            {tests.length ? (
              /* The project is the context here, so every row naming it would
                 be noise — hence showProject={false} in all three layouts. */
              <TestViews
                rows={sortedTests}
                view={tView}
                sort={tSort}
                onSort={toggleTSort}
                tallies={tallies}
                showProject={false}
              />
            ) : (
              <EmptyState
                icon={<MousePointerClick className="h-5 w-5" />}
                title="No tests yet"
                description="Put a prototype or a real build in front of participants and collect the results here."
                action={
                  canManage ? (
                    <Button variant="primary" size="sm" onClick={() => setShowNewTest(true)}>
                      <Plus className="h-4 w-4" /> New test
                    </Button>
                  ) : undefined
                }
              />
            )}
          </div>
        )}

        {tab === "affinity" && (
          affinity ? <AffinityBoard boardId={affinity.id} /> : (
            <EmptyState
              icon={<Network className="h-5 w-5" />}
              title="No affinity board yet"
              description="Affinity mapping usually starts once interviews are analyzed."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      createProjectBoard(project.id, "affinity");
                      toast("Affinity board created");
                    }}
                  >
                    Create board
                  </Button>
                ) : undefined
              }
            />
          )
        )}

        {tab === "kanban" && (
          kanban ? <KanbanBoard boardId={kanban.id} /> : (
            <EmptyState
              icon={<Columns3 className="h-5 w-5" />}
              title="No Kanban board yet"
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      createProjectBoard(project.id, "kanban");
                      toast("Kanban board created with the default workflow");
                    }}
                  >
                    Create board
                  </Button>
                ) : undefined
              }
            />
          )
        )}

        {tab === "ai" && <AiSummaryTab project={project} />}

        {tab === "reports" && <ReportsTab project={project} />}
      </PageBody>

      <ProjectFormModal open={showEdit} onClose={() => setShowEdit(false)} project={project} />
      <AddParticipantsDialog open={showAddExisting} onClose={() => setShowAddExisting(false)} projectId={project.id} />
      <ParticipantFormModal
        open={showNewParticipant}
        onClose={() => setShowNewParticipant(false)}
        addToProjectId={project.id}
      />
      <InterviewFormModal
        open={showNewInterview}
        onClose={() => setShowNewInterview(false)}
        initialProjectId={project.id}
      />
      <InsightFormModal
        open={showNewInsight}
        onClose={() => setShowNewInsight(false)}
        initialProjectId={project.id}
      />
      <NewTestModal open={showNewTest} onClose={() => setShowNewTest(false)} projectId={project.id} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete project"
        danger
        body={
          <>
            This permanently deletes <strong>{project.name}</strong> and its boards. The{" "}
            {participants.length} participant{participants.length === 1 ? "" : "s"},{" "}
            {interviews.length} interview{interviews.length === 1 ? "" : "s"}, and{" "}
            {insights.length} insight{insights.length === 1 ? "" : "s"}{" "}
            stay in the repository — they&apos;re just unlinked from this project.
            {tests.length > 0 && (
              /* Tests are project-owned, so they go with it — along with every
                 participant response recorded against them. Worth saying out
                 loud now that the Tests tab makes them look like project
                 content: nothing else here is actually destroyed. */
              <>
                {" "}
                Its {tests.length} test{tests.length === 1 ? "" : "s"} <strong>and every participant
                session recorded for them</strong> are deleted with it.
              </>
            )}{" "}
            This cannot be undone.
          </>
        }
        confirmLabel="Delete project"
        onConfirm={() => {
          const name = project.name;
          setLeaving(true);
          router.push("/projects");
          deleteProject(project.id);
          toast(`Project “${name}” deleted`, "info");
        }}
      />
    </>
  );
}

function AiSummaryTab({ project }: { project: ResearchProject }) {
  const projectId = project.id;
  const insights = projectInsights(projectId);
  const interviews = projectInterviews(projectId);
  const tests = projectTests(projectId);
  const themeCounts = new Map<string, number>();
  for (const ins of insights) for (const t of ins.themeIds) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  const topThemes = [...themeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const critical = insights.filter((i) => i.severity === "critical" || i.severity === "high");
  const opps = insights.filter((i) => i.type === "opportunity" || i.type === "feature-request");
  const toast = useApp((s) => s.toast);
  const role = useApp((s) => s.role);
  const updateProject = useApp((s) => s.updateProject);

  const [aiSummary, setAiSummary] = React.useState(project.aiSummary ?? "");
  const [generating, setGenerating] = React.useState(false);
  const showGenerate = aiEnabled("ai.summaries") && can(role, "use-ai") && currentUser().aiEnabled !== false;

  const generate = async () => {
    if (insights.length === 0 && interviews.length === 0 && tests.length === 0) {
      toast("Add interviews, insights, or a test first — there's nothing to summarize yet.", "info");
      return;
    }
    setGenerating(true);
    setAiSummary("");
    try {
      const full = await streamAI(
        {
          system:
            "You are a senior UX researcher writing a crisp executive summary for a research project (the product being researched is enterprise asset-management / maintenance software). Use only the data provided. Structure it as: a 2–3 sentence overview, then a short **Key findings** list, then **Recommended next steps**. Reference insight and test names where useful, and say what unmoderated test results add to (or contradict in) the interview evidence. Be specific and avoid filler.",
          messages: [{ role: "user", content: projectSummaryContext(project, await fetchSessionTallies()) }],
          maxTokens: 1000,
        },
        (delta) => setAiSummary((prev) => prev + delta),
      );
      if (full.trim()) {
        updateProject(project.id, { aiSummary: full });
        toast("AI summary saved to the project");
      }
    } catch (e) {
      toast(e instanceof AiError ? e.message : "Couldn't generate the summary.", "error");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Card className="border-primary/25 bg-primary-soft/30 p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">AI executive summary</h2>
          {showGenerate && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={generate}
              disabled={generating}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {generating ? "Generating…" : aiSummary ? "Regenerate" : "Generate with AI"}
            </Button>
          )}
        </div>
        {aiSummary ? (
          <AiProse text={aiSummary} />
        ) : (
          <p className="text-[15px] leading-relaxed text-muted">
            Across <strong className="text-foreground">{interviews.length} interviews</strong>, this study surfaced{" "}
            <strong className="text-foreground">{insights.length} insights</strong>, of which{" "}
            <strong className="text-foreground">{critical.length}</strong> are high-severity. The strongest signal centers on{" "}
            {topThemes.map((t, i) => (
              <span key={t[0]}>
                {i > 0 ? (i === topThemes.length - 1 ? " and " : ", ") : ""}
                <strong className="text-foreground">{getTheme(t[0])?.name}</strong>
              </span>
            ))}
            . There {opps.length === 1 ? "is" : "are"} <strong className="text-foreground">{opps.length}</strong>{" "}
            clear {opps.length === 1 ? "opportunity" : "opportunities"} ready to feed into product planning.
            {showGenerate && <span className="mt-2 block text-[13px] text-subtle">Generate a full narrative summary with AI ↑</span>}
          </p>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Dominant themes</h3>
        <div className="flex flex-wrap gap-2">
          {topThemes.map(([tid]) => {
            const theme = getTheme(tid);
            return theme ? <ThemeChip key={tid} theme={theme} size="md" /> : null;
          })}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Key findings</h3>
        <div className="flex flex-col gap-2">
          {critical.slice(0, 5).map((ins) => (
            <Link key={ins.id} href={`/insights/${ins.id}`} className="group flex items-center gap-2.5 rounded-md border border-border px-3 py-2 hover:bg-surface-hover">
              <HighlightKindBadge kind={ins.type} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground group-hover:text-primary">{ins.title}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ReportsTab({ project }: { project: ResearchProject }) {
  const role = useApp((s) => s.role);
  const exportLog = useApp((s) => s.exportLog);
  const logExport = useApp((s) => s.logExport);
  const toast = useApp((s) => s.toast);
  const anonymizeExports = useApp((s) => Boolean(s.prefs["gdpr.anonymizeExports"]));
  const allowed = can(role, "export");

  const formats: { label: string; format: ExportFormat; icon: typeof FileText; note: string }[] = [
    { label: "CSV", format: "csv", icon: FileText, note: "Insights as a flat table" },
    { label: "JSON", format: "json", icon: FileJson, note: "Full relational graph" },
    { label: "Excel", format: "excel", icon: FileSpreadsheet, note: "Multi-sheet workbook" },
    { label: "PDF", format: "pdf", icon: FileText, note: "Formatted report (print to PDF)" },
    { label: "ZIP archive", format: "zip", icon: FileArchive, note: "JSON + CSVs bundled" },
  ];

  const doExport = (format: ExportFormat, label: string) => {
    const result = runExport(format, project, anonymizeExports);
    if (result === null) {
      toast("Pop-up blocked — allow pop-ups to export PDF", "error");
      return;
    }
    logExport(`${project.name} (${label})`, currentUser().name);
    toast(`${result} downloaded`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Card className="p-5">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Export “{project.name}”</h2>
        <p className="mb-4 text-[13px] text-muted">
          Exports preserve every relationship between participants, interviews, insights, and themes — so your data stays portable and free of lock-in.
        </p>
        {!allowed && (
          <p className="mb-3 rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
            Your account&apos;s role can&apos;t export data. Ask an administrator to update your role.
          </p>
        )}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {formats.map((f) => (
            <button
              key={f.label}
              disabled={!allowed}
              onClick={() => doExport(f.format, f.label)}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left hover:border-border-strong hover:bg-surface-hover disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-2 text-muted"><f.icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{f.label}</p>
                <p className="text-xs text-subtle">{f.note}</p>
              </div>
              <Download className="h-4 w-4 text-subtle" />
            </button>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Recent exports</h3>
        <div className="flex flex-col divide-y divide-border">
          {exportLog.slice(0, 6).map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 text-[13px]">
              <FileText className="h-4 w-4 text-subtle" />
              <span className="flex-1 truncate text-foreground">{r.name}</span>
              <span className="flex items-center gap-1 text-xs text-subtle"><Calendar className="h-3 w-3" />{formatDate(r.date)}</span>
              <span className="hidden text-xs text-subtle sm:block">{r.by}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
