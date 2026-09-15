"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Pencil,
  FileText,
  Video,
  AudioLines,
  Image as ImageIcon,
  FileBarChart,
  Clock,
  Calendar,
  CalendarClock,
  ExternalLink,
  CheckCircle2,
  Circle,
  Sparkles,
  Paperclip,
  MoreHorizontal,
  Trash2,
  Plus,
  FileEdit,
  Highlighter,
  X,
  Link2Off,
  ArrowUpRight,
  ChevronDown,
  ListChecks,
} from "lucide-react";
import {
  getInterview,
  getParticipant,
  getUser,
  getProjects,
  interviewInsights,
  getCompany,
  fullName,
  isScheduledInterview,
  currentUserId,
  currentUser,
  users,
} from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { AttachmentKind, HighlightKind, Insight, Sentiment } from "@/lib/types";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { AccentPill, AccentDot } from "@/components/ui/accent";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import { MissingRecord } from "@/components/ui/missing-record";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { InterviewFormModal } from "@/components/forms/interview-form";
import { AiProse } from "@/components/ui/ai-prose";
import { InlineEditor } from "@/components/ui/inline-editor";
import { askAIJson, aiEnabled, AiError } from "@/lib/ai";
import { interviewSummaryContext } from "@/lib/ai-context";
import { SentimentBadge, highlightKindMeta } from "@/components/domain/badges";
import { formatDate, formatDuration, cn, uid } from "@/lib/utils";

const attachmentIcon: Record<AttachmentKind, React.ComponentType<{ className?: string }>> = {
  audio: AudioLines,
  video: Video,
  document: FileText,
  transcript: FileText,
  image: ImageIcon,
  report: FileBarChart,
};

const KINDS = Object.keys(highlightKindMeta) as HighlightKind[];

/** A compact label/value pair for the horizontal Details strip at the top. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</span>
      <div className="text-[13px] text-foreground">{children}</div>
    </div>
  );
}

export default function InterviewDetail() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const toggleFollowUp = useApp((s) => s.toggleFollowUp);
  const addFollowUp = useApp((s) => s.addFollowUp);
  const updateFollowUp = useApp((s) => s.updateFollowUp);
  const removeFollowUp = useApp((s) => s.removeFollowUp);
  const deleteInterview = useApp((s) => s.deleteInterview);
  const markConducted = useApp((s) => s.markInterviewConducted);
  const updateInterview = useApp((s) => s.updateInterview);
  const addInsight = useApp((s) => s.addInsight);
  const updateInsight = useApp((s) => s.updateInsight);
  const deleteInsight = useApp((s) => s.deleteInsight);
  const unlinkInsightInterview = useApp((s) => s.unlinkInsightInterview);
  const toast = useApp((s) => s.toast);
  const [showEdit, setShowEdit] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [insightToDelete, setInsightToDelete] = React.useState<Insight | null>(null);
  const [summarizing, setSummarizing] = React.useState(false);
  const [quickTitle, setQuickTitle] = React.useState("");
  const [newFollowUp, setNewFollowUp] = React.useState("");
  const [editing, setEditing] = React.useState<null | "summary" | "notes">(null);
  const [draft, setDraft] = React.useState("");
  const [leaving, setLeaving] = React.useState(false);

  // Select-to-capture in the notes area: turn any highlighted sentence into an
  // insight, pain point, or key observation — the free-text counterpart of the
  // transcript workspace's highlight→insight flow.
  const notesRef = React.useRef<HTMLParagraphElement>(null);
  const [notesSel, setNotesSel] = React.useState<{ x: number; y: number; text: string } | null>(null);
  const [flashKey, setFlashKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    const hide = () => setNotesSel(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  // Highlights rail → jump to the marked passage in the notes and flash it.
  const jumpToMark = (key: string) => {
    const el = notesRef.current?.querySelector(`[data-hlid="${CSS.escape(key)}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashKey(key);
    window.setTimeout(() => setFlashKey((k) => (k === key ? null : k)), 1400);
  };

  const onNotesMouseUp = () => {
    if (!canManage) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return setNotesSel(null);
    const text = sel.toString().trim();
    if (text.length < 3) return setNotesSel(null);
    const el = notesRef.current;
    if (!el || !sel.anchorNode || !el.contains(sel.anchorNode)) return setNotesSel(null);
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setNotesSel({ x: rect.left + rect.width / 2, y: rect.top, text });
  };

  const iv = getInterview(id);
  if (!iv) {
    if (leaving)
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      );
    return <MissingRecord hydrated={hydrated} />;
  }

  const participant = getParticipant(iv.participantId);
  const company = participant ? getCompany(participant.companyId) : undefined;
  const researcher = getUser(iv.researcherId);
  const projects = getProjects(iv.projectIds);
  const insights = interviewInsights(iv);
  const canSummarize = canManage && aiEnabled("ai.summaries") && currentUser().aiEnabled !== false;

  // Each insight carries the quote as its evidence, so it's re-marked in place.
  // (Description is a fallback match for insights captured before the quote
  // moved to evidence.) Observations are a *type* of insight now — the panel is
  // insights only; the interview's "key takeaways" live with the Summary.
  const noteMarks: NoteMark[] = insights.flatMap((ins) => [
    { key: `ins-${ins.id}-e`, text: ins.evidence, kind: ins.type, insightId: ins.id },
    { key: `ins-${ins.id}-d`, text: ins.description, kind: ins.type, insightId: ins.id },
  ]);
  // Positions of every captured passage in the notes, top-to-bottom — shared by
  // the in-text marks and the highlights rail beside the notes.
  const noteRanges = matchNoteRanges(iv.notes ?? "", noteMarks);
  // Linked insights that don't map to a notes passage (quick-captured or notes
  // edited since) — still listed in the rail so nothing is hidden.
  const railMatchedIds = new Set(noteRanges.map((r) => r.m.insightId).filter(Boolean) as string[]);
  // Self-added insights (no notes passage) surface newest-first at the top,
  // right by the capture box; highlight-anchored ones stay in reading order.
  const railExtraInsights = insights.filter((i) => !railMatchedIds.has(i.id)).reverse();
  const railCount = noteRanges.length + railExtraInsights.length;

  const summarize = async () => {
    setSummarizing(true);
    const withSentiment = aiEnabled("ai.sentiment");
    try {
      const result = await askAIJson<{
        summary: string;
        sentiment: "positive" | "neutral" | "negative" | "mixed";
        keyObservations: string[];
      }>({
        system:
          "You are a UX researcher analyzing an interview about an enterprise asset-management / maintenance software product. From the material provided, produce a JSON object with: \"summary\" (2–3 sentence plain-text summary)" +
          (withSentiment
            ? ", \"sentiment\" (one of: positive, neutral, negative, mixed — the participant's overall sentiment)"
            : "") +
          ", and \"keyObservations\" (3–5 short bullet strings of the most important takeaways). Base everything strictly on the material.",
        messages: [{ role: "user", content: interviewSummaryContext(iv) }],
        maxTokens: 900,
      });
      updateInterview(iv.id, {
        aiSummary: result.summary?.trim() || iv.aiSummary,
        ...(withSentiment && ["positive", "neutral", "negative", "mixed"].includes(result.sentiment)
          ? { sentiment: result.sentiment }
          : {}),
        keyObservations: Array.isArray(result.keyObservations) && result.keyObservations.length
          ? result.keyObservations.map((o) => String(o))
          : iv.keyObservations,
      });
      toast(withSentiment ? "Summary, sentiment & key takeaways updated" : "Summary & key takeaways updated");
    } catch (e) {
      toast(e instanceof AiError ? e.message : "Couldn't summarize this interview.", "error");
    } finally {
      setSummarizing(false);
    }
  };

  const startEdit = (which: "summary" | "notes") => {
    setDraft(which === "summary" ? iv.aiSummary : iv.notes ?? "");
    setEditing(which);
  };
  const saveEdit = () => {
    if (editing === "summary") updateInterview(iv.id, { aiSummary: draft.trim() });
    else if (editing === "notes") updateInterview(iv.id, { notes: draft });
    setEditing(null);
    toast("Saved");
  };

  const quickAddInsight = () => {
    const title = quickTitle.trim();
    if (!title) return;
    addInsight({
      id: uid("in"),
      title,
      description: `Captured during “${iv.title}”. Add detail.`,
      evidence: "Captured during the interview.",
      type: "insight",
      // Priority is left unrated until someone triages it.
      productArea: "Platform",
      themeIds: [],
      tagIds: [],
      personaIds: [],
      createdDate: new Date().toISOString().slice(0, 10),
      createdById: currentUserId,
      participantIds: iv.participantId ? [iv.participantId] : [],
      interviewIds: [iv.id],
      projectIds: iv.projectIds,
    });
    setQuickTitle("");
    toast(`Insight “${title}” captured`);
  };

  // ---- Select-to-capture from the notes text ----
  // The highlight is a verbatim quote, so it becomes the *evidence*. Title is a
  // short derived label and the description is left for the researcher — then,
  // when AI is on, both are upgraded to a real summary + one-line finding.
  const captureInsightFromNotes = (raw: string, kind: HighlightKind = "insight") => {
    const quote = raw.replace(/\s+/g, " ").trim();
    const id = uid("in");
    addInsight({
      id,
      title: deriveTitle(quote),
      description: "",
      evidence: quote,
      type: kind, // defaults to "insight"; the toolbar chevron picks another
      productArea: "Platform",
      themeIds: [],
      tagIds: [],
      personaIds: [],
      createdDate: new Date().toISOString().slice(0, 10),
      createdById: currentUserId,
      participantIds: iv.participantId ? [iv.participantId] : [],
      interviewIds: [iv.id],
      projectIds: iv.projectIds,
    });
    window.getSelection()?.removeAllRanges();
    setNotesSel(null);
    toast(`${highlightKindMeta[kind].label} captured from the notes`);
    if (canSummarize) void refineInsightWithAI(id, quote);
  };

  /** Best-effort: draft a concise title + one-sentence finding from the quote.
      Silent no-op if AI is off, unconfigured, or errors — the derived title
      and quote-as-evidence already stand. */
  const refineInsightWithAI = async (id: string, quote: string) => {
    try {
      const result = await askAIJson<{ title: string; description: string }>({
        system:
          `You are a UX researcher reviewing notes from an interview about enterprise asset-management / maintenance software. ` +
          `From a verbatim quote, return a JSON object with "title" (a concise insight label, at most 8 words, no quotation marks) ` +
          `and "description" (one sentence, at most 25 words, stating the finding in your own words — do not just repeat the quote). Base both strictly on the quote.`,
        messages: [{ role: "user", content: `Interview: ${iv.title}\nQuote: "${quote}"` }],
        maxTokens: 200,
      });
      const patch: Partial<Insight> = {};
      const title = result.title?.trim().replace(/^["'“”]+|["'“”]+$/g, "");
      const description = result.description?.trim();
      if (title) patch.title = title;
      if (description) patch.description = description;
      if (Object.keys(patch).length) {
        updateInsight(id, patch);
        toast("Insight titled with AI");
      }
    } catch {
      /* AI off / unconfigured / failed — keep the derived title + evidence. */
    }
  };

  const removeObservation = (o: string) => {
    updateInterview(iv.id, { keyObservations: iv.keyObservations.filter((x) => x !== o) });
    toast("Takeaway removed");
  };

  const addNewFollowUp = () => {
    const text = newFollowUp.trim();
    if (!text) return;
    addFollowUp(iv.id, { id: uid("fu"), text, done: false });
    setNewFollowUp("");
  };

  // ---- Insights & highlights panel: shared pieces, laid out two ways ----
  // Compact input + inline "+" so it reads as a capture field, not an add-card.
  const quickCaptureField = canManage ? (
    <div className="relative">
      <Input
        value={quickTitle}
        onChange={(e) => setQuickTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && quickAddInsight()}
        placeholder="Quick-capture an insight…"
        className="h-9 pr-9 text-[13px]"
      />
      <button
        onClick={quickAddInsight}
        disabled={!quickTitle.trim()}
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-primary transition-colors hover:bg-primary-soft disabled:pointer-events-none disabled:opacity-40"
        aria-label="Capture insight"
        title="Capture insight"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  ) : null;

  // Colored pill that matches the type, with the standard dropdown popover for
  // picking (capture makes a plain "insight" — set the real kind here).
  const typeControl = (ins: Insight) => {
    const meta = highlightKindMeta[ins.type];
    if (!canManage) return <AccentPill accent={meta.accent}>{meta.label}</AccentPill>;
    return (
      <Menu>
        <MenuTrigger>
          <button
            className={cn(
              `accent-${meta.accent}`,
              "inline-flex items-center gap-1 rounded-full border border-[hsl(var(--a-border))] bg-[hsl(var(--a-bg))] py-0.5 pl-2 pr-1.5 text-2xs font-medium text-[hsl(var(--a-fg))]",
            )}
            aria-label="Change insight type"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--a-solid))]" />
            {meta.label}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </button>
        </MenuTrigger>
        <MenuContent align="start">
          {KINDS.map((k) => (
            <MenuItem
              key={k}
              icon={<AccentDot accent={highlightKindMeta[k].accent} />}
              active={k === ins.type}
              onSelect={() => updateInsight(ins.id, { type: k })}
            >
              {highlightKindMeta[k].label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
    );
  };
  // Actions sit behind a kebab menu so unlink/delete are never a stray click.
  const insightMenu = (ins: Insight) => (
    <Menu className="ml-auto shrink-0">
      <MenuTrigger>
        <button
          className="rounded p-1 text-subtle transition-colors hover:bg-surface-hover hover:text-foreground"
          aria-label="Insight actions"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuItem icon={<ArrowUpRight className="h-4 w-4" />} onSelect={() => router.push(`/insights/${ins.id}`)}>
          Open insight
        </MenuItem>
        <MenuItem
          icon={<Link2Off className="h-4 w-4" />}
          onSelect={() => { unlinkInsightInterview(ins.id, iv.id); toast("Insight unlinked from this interview"); }}
        >
          Unlink from this interview
        </MenuItem>
        <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => setInsightToDelete(ins)}>
          Delete insight
        </MenuItem>
      </MenuContent>
    </Menu>
  );
  const cardClass = "group/rail rounded-lg border border-border bg-surface p-2.5 shadow-xs transition-colors hover:border-border-strong";

  const railCards = [
    // Self-added insights (no passage) — newest first, right below the capture box.
    ...railExtraInsights.map((ins) => (
      <div key={ins.id} className={cardClass}>
        <div className="mb-1.5 flex items-center gap-1.5">
          {typeControl(ins)}
          {canManage && insightMenu(ins)}
        </div>
        <button onClick={() => router.push(`/insights/${ins.id}`)} className="block w-full text-left" title="Open insight">
          <p className="line-clamp-1 text-xs font-medium text-foreground">{ins.title}</p>
          {ins.description && <p className="line-clamp-2 text-xs text-muted">{ins.description}</p>}
        </button>
      </div>
    )),
    // Highlight-anchored insights — in the notes' reading order; click to jump.
    ...noteRanges.map((r) => {
      const ins = r.m.insightId ? insights.find((x) => x.id === r.m.insightId) : undefined;
      if (!ins) return null;
      return (
        <div key={r.m.key} className={cardClass}>
          <div className="mb-1.5 flex items-center gap-1.5">
            {typeControl(ins)}
            {canManage && insightMenu(ins)}
          </div>
          <button onClick={() => jumpToMark(r.m.key)} className="block w-full text-left" title="Jump to this passage">
            <p className="line-clamp-3 text-xs leading-snug text-foreground">{iv.notes!.slice(r.start, r.end)}</p>
          </button>
        </div>
      );
    }),
  ].filter(Boolean);

  const panelHeading = (
    <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
      <Highlighter className="h-3 w-3" /> Insights &amp; highlights{railCount > 0 ? ` (${railCount})` : ""}
    </p>
  );
  const panelEmpty = (
    <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-subtle">
      {canManage
        ? "Highlight a sentence in the notes, or quick-capture above — it'll show up here."
        : "No insights yet."}
    </p>
  );

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Interviews", href: "/interviews" }, { label: iv.title }]}
        title={iv.title}
        description={`${participant ? fullName(participant) : ""} · ${formatDate(iv.date)} · ${formatDuration(iv.durationMinutes)}`}
        actions={
          <>
            {canManage && isScheduledInterview(iv) && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => { markConducted(iv.id); toast("Marked as conducted — fill in the summary and notes"); }}
              >
                <CheckCircle2 className="h-4 w-4" /> Mark as conducted
              </Button>
            )}
            {iv.transcriptId && (
              <Link href={`/interviews/${iv.id}/transcript`}>
                <Button variant={isScheduledInterview(iv) ? "outline" : "primary"} size="sm"><FileText className="h-4 w-4" /> Open transcript</Button>
              </Link>
            )}
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Menu>
                  <MenuTrigger>
                    <Button variant="ghost" size="icon" aria-label="More interview actions">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => setConfirmDelete(true)}>
                      Delete interview
                    </MenuItem>
                  </MenuContent>
                </Menu>
              </>
            )}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          {isScheduledInterview(iv) ? (
            <Badge tone="info">
              <CalendarClock className="h-3 w-3" /> Scheduled
            </Badge>
          ) : (
            <SentimentBadge value={iv.sentiment} />
          )}
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-2xs font-medium text-muted hover:border-border-strong hover:text-foreground">
              {p.name}
            </Link>
          ))}
        </div>
      </PageHeader>

      <PageBody>
        <div className="flex flex-col gap-5">
            {/* Details — a compact strip at the top so the notes span the full width */}
            <Card className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-8">
                {participant && (
                  <Link href={`/participants/${participant.id}`} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 hover:bg-surface-hover lg:min-w-[220px]">
                    <Avatar name={fullName(participant)} accent={participant.avatarColor} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{fullName(participant)}</p>
                      <p className="truncate text-xs text-subtle">{participant.jobTitle}{company ? ` · ${company.name}` : ""}</p>
                    </div>
                  </Link>
                )}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  {!isScheduledInterview(iv) && (
                    <Fact label="Sentiment">
                      {canManage ? (
                        <Select
                          value={iv.sentiment}
                          onChange={(e) => updateInterview(iv.id, { sentiment: e.target.value as Sentiment })}
                          className="h-8 py-0 text-[13px]"
                          aria-label="Interview sentiment"
                        >
                          <option value="positive">Positive</option>
                          <option value="mixed">Mixed</option>
                          <option value="neutral">Neutral</option>
                          <option value="negative">Negative</option>
                        </Select>
                      ) : (
                        <SentimentBadge value={iv.sentiment} />
                      )}
                    </Fact>
                  )}
                  <Fact label="Date"><span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-subtle" />{formatDate(iv.date)}</span></Fact>
                  <Fact label="Duration"><span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-subtle" />{formatDuration(iv.durationMinutes)}</span></Fact>
                  <Fact label="Researcher">{researcher?.name ?? "—"}</Fact>
                  <Fact label="Recording">{iv.hasRecording ? "Available" : "None"}</Fact>
                  {iv.meetingLink && (
                    <Fact label="Meeting">
                      <a href={iv.meetingLink} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Join
                      </a>
                    </Fact>
                  )}
                </div>
              </div>
            </Card>

            {/* Summary — editable, with AI generation */}
            <Card className="group border-primary/25 bg-primary-soft/30 p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Summary</h2>
                {canManage && editing !== "summary" && (
                  <div className="ml-auto flex items-center gap-2">
                    {canSummarize && (
                      <Button variant="outline" size="sm" onClick={summarize} disabled={summarizing}>
                        <Sparkles className="h-3.5 w-3.5" />
                        {summarizing ? "Summarizing…" : "Summarize with AI"}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100" onClick={() => startEdit("summary")} aria-label="Edit summary">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              {editing === "summary" ? (
                <InlineEditor
                  value={draft}
                  onChange={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  rows={5}
                  placeholder="Summarize what happened in this session…"
                />
              ) : iv.aiSummary ? (
                <AiProse text={iv.aiSummary} />
              ) : (
                <p className="text-[15px] leading-relaxed text-muted">
                  No summary yet.{canManage ? " Write one, or generate it with AI." : ""}
                </p>
              )}

              {/* Key takeaways — the interview's headline points (from AI summary or seed) */}
              {editing !== "summary" && iv.keyObservations.length > 0 && (
                <div className="mt-4 border-t border-primary/15 pt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
                    <ListChecks className="h-3 w-3" /> Key takeaways
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {iv.keyObservations.map((o) => (
                      <li key={o} className="group/kt flex items-start gap-2 text-[13px] text-muted">
                        <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                        <span className="min-w-0 flex-1">{o}</span>
                        {canManage && (
                          <button
                            onClick={() => removeObservation(o)}
                            className="shrink-0 rounded p-0.5 text-subtle opacity-0 transition-opacity hover:text-danger group-hover/kt:opacity-100 focus-visible:opacity-100"
                            aria-label="Remove takeaway"
                            title="Remove takeaway"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            {/* Notes & transcript — the big editable capture area */}
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <FileEdit className="h-4 w-4 text-muted" />
                <h2 className="text-sm font-semibold text-foreground">Notes &amp; transcript</h2>
                {canManage && editing !== "notes" && iv.notes && (
                  <Button variant="ghost" size="sm" className="ml-auto" onClick={() => startEdit("notes")}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>
              {editing === "notes" ? (
                <InlineEditor
                  value={draft}
                  onChange={setDraft}
                  onSave={saveEdit}
                  onCancel={() => setEditing(null)}
                  rows={16}
                  placeholder="Capture the session here — type notes live, or paste the full transcript. Everything you write is saved to this interview."
                />
              ) : iv.notes ? (
                /* Reading mode — notes on the left, sticky insights rail on the right. */
                <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
                  <div className="min-w-0">
                    <p
                      ref={notesRef}
                      onMouseUp={onNotesMouseUp}
                      className="select-text whitespace-pre-wrap text-[14px] leading-relaxed text-muted"
                    >
                      {renderNotes(iv.notes, noteRanges, flashKey)}
                    </p>
                    {canManage && (
                      <p className="mt-3 flex items-center gap-1.5 text-2xs text-subtle">
                        <Highlighter className="h-3 w-3" /> Select any sentence to capture it as an insight — then set its type on the card.
                      </p>
                    )}
                  </div>

                  <aside className="self-start border-t border-border pt-4 xl:sticky xl:top-4 xl:border-l xl:border-t-0 xl:pl-4 xl:pt-0">
                    <div className="mb-2 shrink-0">{panelHeading}</div>
                    {quickCaptureField && <div className="mb-3 shrink-0">{quickCaptureField}</div>}
                    {railCards.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {railCards}
                      </div>
                    ) : (
                      panelEmpty
                    )}
                  </aside>
                </div>
              ) : (
                /* No notes yet — insights take the full width in a grid, and the
                   notes prompt is a slim bar so there's no big empty column. */
                <div className="flex flex-col gap-5">
                  <button
                    disabled={!canManage}
                    onClick={() => canManage && startEdit("notes")}
                    className="w-full rounded-lg border border-dashed border-border px-4 py-3 text-left text-[13px] text-subtle hover:border-border-strong hover:text-muted disabled:pointer-events-none"
                  >
                    {canManage
                      ? "Nothing captured yet — click to write notes or paste a transcript."
                      : "No notes yet."}
                  </button>
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      {panelHeading}
                      {quickCaptureField && <div className="w-full sm:ml-auto sm:w-72">{quickCaptureField}</div>}
                    </div>
                    {railCards.length > 0 ? (
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{railCards}</div>
                    ) : (
                      panelEmpty
                    )}
                  </div>
                </div>
              )}
            </Card>

          {/* Attachments & follow-ups — secondary, below the content */}
          {(iv.attachments.length > 0 || canManage || iv.followUps.length > 0) && (
            <div className="grid gap-5 md:grid-cols-2">
              {iv.attachments.length > 0 && (
                <Card className="p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Paperclip className="h-4 w-4 text-muted" /> Attachments
                  </h2>
                  <div className="flex flex-col gap-1.5">
                    {iv.attachments.map((a) => {
                      const Icon = attachmentIcon[a.kind];
                      return (
                        <div
                          key={a.id}
                          className="flex items-center gap-2.5 rounded-md border border-border px-2.5 py-2 text-[13px]"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-muted" />
                          <span className="min-w-0 flex-1 truncate text-foreground">{a.name}</span>
                          <span className="shrink-0 text-2xs text-subtle">{a.sizeLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-2xs text-subtle">Preview &amp; download aren&apos;t available in this demo.</p>
                </Card>
              )}

              {(canManage || iv.followUps.length > 0) && (
                <Card className="p-5">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">Follow-up actions</h2>
                  <div className="flex flex-col gap-1">
                    {iv.followUps.map((f) => {
                      const assignee = f.assigneeId ? getUser(f.assigneeId) : undefined;
                      return (
                        <div key={f.id} className="group/fu flex items-start gap-2.5 rounded-md p-1">
                          <button
                            disabled={!canManage}
                            onClick={() => toggleFollowUp(iv.id, f.id)}
                            className="mt-0.5 shrink-0 disabled:pointer-events-none"
                            title={canManage ? "Toggle done" : undefined}
                            aria-label={f.done ? "Mark not done" : "Mark done"}
                          >
                            {f.done ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <Circle className="h-4 w-4 text-subtle" />
                            )}
                          </button>
                          <div className="min-w-0 flex-1">
                            {canManage ? (
                              <input
                                defaultValue={f.text}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== f.text) updateFollowUp(iv.id, f.id, { text: v });
                                  else if (!v) e.target.value = f.text;
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                className={cn(
                                  "w-full bg-transparent text-[13px] focus:outline-none",
                                  f.done ? "text-subtle line-through" : "text-foreground",
                                )}
                                aria-label="Follow-up text"
                              />
                            ) : (
                              <span className={cn("block text-[13px]", f.done ? "text-subtle line-through" : "text-foreground")}>{f.text}</span>
                            )}
                            {canManage ? (
                              <select
                                value={f.assigneeId ?? ""}
                                onChange={(e) => updateFollowUp(iv.id, f.id, { assigneeId: e.target.value || undefined })}
                                className="-ml-0.5 mt-0.5 cursor-pointer rounded bg-transparent text-2xs text-subtle focus:outline-none focus:ring-1 focus:ring-primary/30"
                                aria-label="Assignee"
                              >
                                <option value="">Unassigned</option>
                                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                            ) : (
                              assignee && <span className="block text-2xs text-subtle">{assignee.name}</span>
                            )}
                          </div>
                          {canManage && (
                            <button
                              onClick={() => removeFollowUp(iv.id, f.id)}
                              className="mt-0.5 shrink-0 rounded p-0.5 text-subtle opacity-0 transition-opacity hover:text-danger group-hover/fu:opacity-100 focus-visible:opacity-100"
                              aria-label="Remove follow-up"
                              title="Remove follow-up"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {iv.followUps.length === 0 && !canManage && (
                      <p className="text-[13px] text-subtle">No follow-up actions.</p>
                    )}
                  </div>
                  {canManage && (
                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                      <Input
                        value={newFollowUp}
                        onChange={(e) => setNewFollowUp(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") addNewFollowUp(); }}
                        placeholder="Add a follow-up…"
                        className="h-8 flex-1 text-[13px]"
                      />
                      <Button size="sm" variant="outline" onClick={addNewFollowUp} disabled={!newFollowUp.trim()}>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </PageBody>

      {/* Floating capture toolbar for a notes selection */}
      {notesSel && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-1 rounded-lg border border-border bg-overlay p-1.5 shadow-popover"
          style={{ left: notesSel.x, top: notesSel.y }}
        >
          <div className="flex items-center">
            <button
              onClick={() => captureInsightFromNotes(notesSel.text)}
              className="flex items-center gap-1.5 rounded-l-md py-1.5 pl-3 pr-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft"
              title="Capture as an insight"
            >
              <Plus className="h-4 w-4" /> Insight
            </button>
            <Menu>
              <MenuTrigger>
                <button
                  className="flex h-8 items-center rounded-r-md border-l border-primary/20 px-1.5 text-primary hover:bg-primary-soft"
                  aria-label="Capture as a specific type"
                  title="Choose a type"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </MenuTrigger>
              <MenuContent align="start">
                {KINDS.map((k) => (
                  <MenuItem
                    key={k}
                    icon={<AccentDot accent={highlightKindMeta[k].accent} />}
                    onSelect={() => captureInsightFromNotes(notesSel.text, k)}
                  >
                    {highlightKindMeta[k].label}
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          </div>
          <button
            onClick={() => { window.getSelection()?.removeAllRanges(); setNotesSel(null); }}
            className="flex h-8 w-8 items-center justify-center rounded-md text-subtle hover:bg-surface-hover hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <InterviewFormModal open={showEdit} onClose={() => setShowEdit(false)} interview={iv} />
      <ConfirmDialog
        open={!!insightToDelete}
        onClose={() => setInsightToDelete(null)}
        title="Delete insight"
        danger
        body={
          insightToDelete ? (
            <>
              This permanently deletes <strong>“{insightToDelete.title}”</strong> from the repository and
              removes its highlight from the notes.
              {insightToDelete.interviewIds.length > 1 && (
                <> It&apos;s linked to {insightToDelete.interviewIds.length} interviews, so it disappears from those too.</>
              )}{" "}
              This can&apos;t be undone — to keep the insight but drop it from this interview, use{" "}
              <strong>Unlink</strong> instead.
            </>
          ) : null
        }
        confirmLabel="Delete insight"
        onConfirm={() => {
          if (!insightToDelete) return;
          const title = insightToDelete.title;
          deleteInsight(insightToDelete.id);
          setInsightToDelete(null);
          toast(`Insight “${title}” deleted`, "info");
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete interview"
        danger
        body={
          <>
            This permanently deletes <strong>{iv.title}</strong>. Any insights that referenced it stay in
            the repository — they&apos;re just unlinked from this interview. This cannot be undone.
          </>
        }
        confirmLabel="Delete interview"
        onConfirm={() => {
          const title = iv.title;
          setLeaving(true);
          router.push("/interviews");
          deleteInterview(iv.id);
          toast(`Interview “${title}” deleted`, "info");
        }}
      />
    </>
  );
}

type NoteMark = { key: string; text: string; kind: HighlightKind; insightId?: string };
type NoteRange = { start: number; end: number; m: NoteMark };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A short human label from a verbatim quote — the placeholder title until AI
    (when enabled) replaces it with a real summary. First sentence, ~64 chars. */
function deriveTitle(quote: string): string {
  const s = quote.replace(/\s+/g, " ").trim().replace(/^["'“”]+|["'“”]+$/g, "");
  let label = s.split(/(?<=[.!?])\s/)[0] || s;
  if (label.length > 64) label = `${label.slice(0, 60).replace(/\s+\S*$/, "")}…`;
  label = label.replace(/[\s.,;:—-]+$/, "");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Insight from notes";
}

/**
 * Locate each captured passage in the notes and return them ordered top-to-
 * bottom, non-overlapping. Shared by the in-text marks and the highlights rail
 * so both agree on what and where. Matching is whitespace-flexible, so a
 * selection that spanned a line break still lines up against the original text.
 */
function matchNoteRanges(notes: string, marks: NoteMark[]): NoteRange[] {
  const ranges: NoteRange[] = [];
  for (const m of marks) {
    const norm = m.text.replace(/\s+/g, " ").trim();
    if (norm.length < 3) continue;
    const pattern = norm.split(" ").map(escapeRegExp).join("\\s+");
    let match: RegExpExecArray | null = null;
    try {
      match = new RegExp(pattern).exec(notes);
    } catch {
      continue; // unusable pattern — skip rather than break rendering
    }
    if (match) ranges.push({ start: match.index, end: match.index + match[0].length, m });
  }
  ranges.sort((a, b) => a.start - b.start);
  const clean: NoteRange[] = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start >= lastEnd) {
      clean.push(r);
      lastEnd = r.end;
    }
  }
  return clean;
}

/**
 * Render the notes with each matched passage wrapped in a <mark>. Insight and
 * pain-point marks link to the insight; observations are shown but inert.
 * `flashKey` briefly rings the passage the highlights rail just jumped to.
 */
function renderNotes(notes: string, ranges: NoteRange[], flashKey: string | null): React.ReactNode {
  if (ranges.length === 0) return notes;
  const out: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((r, i) => {
    if (r.start > cursor) out.push(<span key={`t${i}`}>{notes.slice(cursor, r.start)}</span>);
    const meta = highlightKindMeta[r.m.kind];
    const mark = (
      <mark
        data-hl
        data-hlid={r.m.key}
        className={cn(`accent-${meta.accent}`, r.m.key === flashKey && "ring-2 ring-primary")}
        style={r.m.insightId ? undefined : { cursor: "default" }}
        title={r.m.insightId ? `${meta.label} — open` : meta.label}
      >
        {notes.slice(r.start, r.end)}
      </mark>
    );
    out.push(
      r.m.insightId ? (
        <Link key={r.m.key} href={`/insights/${r.m.insightId}`} className="[color:inherit] no-underline">
          {mark}
        </Link>
      ) : (
        <span key={r.m.key}>{mark}</span>
      ),
    );
    cursor = r.end;
  });
  if (cursor < notes.length) out.push(<span key="tail">{notes.slice(cursor)}</span>);
  return out;
}
