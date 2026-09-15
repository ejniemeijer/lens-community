"use client";

import * as React from "react";
import Link from "next/link";
import {
  Search,
  Sparkles,
  Trash2,
  MessageSquarePlus,
  StickyNote,
  X,
  Highlighter,
  ArrowLeft,
  Link2,
} from "lucide-react";
import type { HighlightKind, Interview, Transcript, TranscriptComment } from "@/lib/types";
import { useApp } from "@/lib/store";
import { currentUserId, currentUser, getUser, getParticipant, fullName, interviewInsights } from "@/lib/db";
import { highlightKindMeta } from "@/components/domain/badges";
import { AccentPill } from "@/components/ui/accent";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Input, Textarea } from "@/components/ui/field";
import { cn, uid, formatTimestamp } from "@/lib/utils";
import { can } from "@/lib/permissions";

const KINDS = Object.keys(highlightKindMeta) as HighlightKind[];

interface ToolbarState {
  x: number;
  y: number;
  segmentId: string;
  text: string;
}

export function TranscriptWorkspace({
  interview,
  transcript,
}: {
  interview: Interview;
  transcript: Transcript;
}) {
  const highlights = useApp((s) => s.highlights[transcript.id] ?? []);
  const addHighlight = useApp((s) => s.addHighlight);
  const removeHighlight = useApp((s) => s.removeHighlight);
  const addTagToLibrary = useApp((s) => s.addTagToLibrary);
  const toast = useApp((s) => s.toast);
  const role = useApp((s) => s.role);
  const canCode = can(role, "manage-content");
  const canComment = can(role, "comment");
  const showAi = can(role, "use-ai") && currentUser().aiEnabled !== false;

  const [toolbar, setToolbar] = React.useState<ToolbarState | null>(null);
  const [query, setQuery] = React.useState("");
  const [panel, setPanel] = React.useState<"highlights" | "comments" | "ai">("highlights");
  const [kindFilter, setKindFilter] = React.useState<HighlightKind | "all">("all");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<TranscriptComment[]>(transcript.comments);
  const [newComment, setNewComment] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Selection → toolbar
  const onMouseUp = () => {
    if (!canCode) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length < 3) return;
    const anchor = (sel.anchorNode?.parentElement as HTMLElement | null)?.closest("[data-seg]");
    const focus = (sel.focusNode?.parentElement as HTMLElement | null)?.closest("[data-seg]");
    if (!anchor || anchor !== focus) return;
    const segmentId = anchor.getAttribute("data-seg")!;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    setToolbar({ x: rect.left + rect.width / 2, y: rect.top, segmentId, text });
  };

  React.useEffect(() => {
    const hide = () => setToolbar(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  const convert = (kind: HighlightKind) => {
    if (!toolbar) return;
    addHighlight({
      id: uid("hl"),
      transcriptId: transcript.id,
      segmentId: toolbar.segmentId,
      start: 0,
      end: toolbar.text.length,
      text: toolbar.text,
      kind,
      tagIds: [],
      createdById: currentUserId,
    });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    setPanel("highlights");
  };

  const shownHighlights = highlights.filter((h) => kindFilter === "all" || h.kind === kindFilter);
  const q = query.trim().toLowerCase();
  const insights = interviewInsights(interview);

  const addComment = () => {
    if (!newComment.trim()) return;
    setComments((c) => [
      ...c,
      { id: uid("cm"), segmentId: "", authorId: currentUserId, text: newComment.trim(), date: "2026-07-03" },
    ]);
    setNewComment("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-canvas px-5 py-3">
        <Link href={`/interviews/${interview.id}`} className="rounded-md p-1.5 text-muted hover:bg-surface-hover hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 truncate text-sm font-semibold text-foreground">
            <Highlighter className="h-4 w-4 text-primary" /> Transcript Workspace
          </h1>
          <p className="truncate text-xs text-subtle">{interview.title} · {transcript.language}</p>
        </div>
        <div className="relative hidden w-64 sm:block">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search transcript…" className="h-8 pl-8" />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Transcript */}
        <div className="min-w-0 flex-1 overflow-y-auto" ref={containerRef}>
          <div className="mx-auto max-w-3xl px-5 py-6" onMouseUp={onMouseUp}>
            {q && (
              <p className="mb-4 text-xs text-subtle">
                Showing segments matching “{query}” ·{" "}
                {transcript.segments.filter((s) => s.text.toLowerCase().includes(q)).length} results
              </p>
            )}
            <div className="flex flex-col gap-5">
              {transcript.segments.map((seg) => {
                const matches = !q || seg.text.toLowerCase().includes(q);
                const segHls = highlights.filter((h) => h.segmentId === seg.id);
                return (
                  <div
                    key={seg.id}
                    className={cn("flex gap-3 transition-opacity", !matches && "opacity-30")}
                  >
                    <div className="w-24 shrink-0 pt-0.5 text-right">
                      <p className={cn("text-xs font-medium", seg.speakerRole === "researcher" ? "text-primary" : "text-foreground")}>
                        {seg.speaker}
                      </p>
                      <p className="font-mono text-2xs text-subtle">{formatTimestamp(seg.startSeconds)}</p>
                    </div>
                    <p
                      data-seg={seg.id}
                      className="flex-1 select-text text-[15px] leading-relaxed text-foreground"
                    >
                      {renderSegment(seg.text, segHls, activeId, setActiveId)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="hidden w-[340px] shrink-0 flex-col border-l border-border bg-canvas md:flex">
          <div className="border-b border-border px-4 py-3">
            <Segmented<"highlights" | "comments" | "ai">
              value={panel}
              onChange={setPanel}
              size="sm"
              className="w-full"
              options={[
                { value: "highlights", label: `Highlights` },
                { value: "comments", label: "Comments" },
                ...(showAi ? [{ value: "ai" as const, label: "AI" }] : []),
              ]}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {panel === "highlights" && (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <FilterChip active={kindFilter === "all"} onClick={() => setKindFilter("all")}>
                    All {highlights.length}
                  </FilterChip>
                  {KINDS.filter((k) => highlights.some((h) => h.kind === k)).map((k) => (
                    <FilterChip key={k} active={kindFilter === k} onClick={() => setKindFilter(k)}>
                      {highlightKindMeta[k].label} {highlights.filter((h) => h.kind === k).length}
                    </FilterChip>
                  ))}
                </div>
                {shownHighlights.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted">
                    Select any text in the transcript to convert it into an insight, observation, or pain point.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {shownHighlights.map((h) => (
                      <div
                        key={h.id}
                        onClick={() => setActiveId(h.id)}
                        className={cn(
                          "group cursor-pointer rounded-lg border bg-surface p-3 shadow-xs transition-colors",
                          activeId === h.id ? "border-primary" : "border-border hover:border-border-strong",
                        )}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <AccentPill accent={highlightKindMeta[h.kind].accent}>{highlightKindMeta[h.kind].label}</AccentPill>
                          {canCode && (
                            <button
                              onClick={(e) => { e.stopPropagation(); removeHighlight(transcript.id, h.id); }}
                              className="rounded p-1 text-subtle opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                              aria-label="Remove highlight"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <p className="text-[13px] leading-snug text-foreground">“{h.text}”</p>
                        {h.note && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted">
                            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" /> {h.note}
                          </p>
                        )}
                        {h.linkedInsightId && (
                          <Link
                            href={`/insights/${h.linkedInsightId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Link2 className="h-3 w-3" /> Linked insight
                          </Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {panel === "comments" && (
              <div className="flex flex-col gap-3">
                {comments.map((c) => {
                  const author = getUser(c.authorId);
                  return (
                    <div key={c.id} className="rounded-lg border border-border bg-surface p-3">
                      <div className="mb-1 flex items-center gap-2">
                        {author && <Avatar name={author.name} accent={author.avatarColor} size="xs" />}
                        <span className="text-xs font-medium text-foreground">{author?.name}</span>
                        <span className="ml-auto text-2xs text-subtle">{c.date}</span>
                      </div>
                      <p className="text-[13px] text-muted">{c.text}</p>
                    </div>
                  );
                })}
                {canComment ? (
                  <div className="rounded-lg border border-border bg-surface p-2.5">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a comment…"
                      rows={2}
                      className="border-0 p-0 focus:ring-0"
                    />
                    <div className="mt-1.5 flex justify-end">
                      <Button size="sm" variant="primary" onClick={addComment}>
                        <MessageSquarePlus className="h-3.5 w-3.5" /> Comment
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted">
                    Your account has read-only access — commenting requires a collaborator role.
                  </p>
                )}
              </div>
            )}

            {panel === "ai" && showAi && (
              <div className="flex flex-col gap-4">
                <div className="rounded-lg border border-primary/25 bg-primary-soft/40 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-primary" /> Suggested to code
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Based on this conversation, these passages look like strong candidates for coding.
                  </p>
                </div>
                <div>
                  <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Insights generated</p>
                  <div className="flex flex-col gap-1.5">
                    {insights.map((ins) => (
                      <Link key={ins.id} href={`/insights/${ins.id}`} className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-2 text-xs text-foreground hover:bg-surface-hover">
                        <Sparkles className="h-3 w-3 shrink-0 text-primary" />
                        <span className="truncate">{ins.title}</span>
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Suggested tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["Workaround", "Offline", "Trust", "Time-on-task"].map((t) => (
                      <button
                        key={t}
                        disabled={!canCode}
                        onClick={() => {
                          addTagToLibrary(t, "general");
                          toast(`Tag “${t}” added to the library`);
                        }}
                        className="disabled:opacity-50"
                        title={canCode ? `Add “${t}” to the tag library` : "Read-only role"}
                      >
                        <AccentPill accent="slate" dot={false}>+ {t}</AccentPill>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating convert toolbar */}
      {toolbar && (
        <div
          className="fixed z-50 flex -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center gap-0.5 rounded-lg border border-border bg-overlay p-1 shadow-popover"
          style={{ left: toolbar.x, top: toolbar.y }}
        >
          {KINDS.map((k) => (
            <button
              key={k}
              onClick={() => convert(k)}
              className={cn(
                `accent-${highlightKindMeta[k].accent}`,
                "rounded px-2 py-1 text-2xs font-medium text-[hsl(var(--a-fg))] hover:bg-[hsl(var(--a-bg))]",
              )}
              title={`Convert to ${highlightKindMeta[k].label}`}
            >
              {highlightKindMeta[k].label}
            </button>
          ))}
          <button onClick={() => setToolbar(null)} className="ml-0.5 rounded p-1 text-subtle hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-2 py-0.5 text-2xs font-medium transition-colors",
        active ? "border-primary bg-primary-soft text-primary" : "border-border text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function renderSegment(
  text: string,
  hls: { id: string; text: string; kind: HighlightKind }[],
  activeId: string | null,
  setActiveId: (id: string) => void,
): React.ReactNode {
  const ranges: { start: number; end: number; h: (typeof hls)[number] }[] = [];
  for (const h of hls) {
    const idx = text.indexOf(h.text);
    if (idx >= 0) ranges.push({ start: idx, end: idx + h.text.length, h });
  }
  ranges.sort((a, b) => a.start - b.start);
  const clean: typeof ranges = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.start >= lastEnd) {
      clean.push(r);
      lastEnd = r.end;
    }
  }
  if (clean.length === 0) return text;

  const out: React.ReactNode[] = [];
  let cursor = 0;
  clean.forEach((r, i) => {
    if (r.start > cursor) out.push(<span key={`t${i}`}>{text.slice(cursor, r.start)}</span>);
    out.push(
      <mark
        key={r.h.id}
        data-hl
        onClick={() => setActiveId(r.h.id)}
        className={cn(
          `accent-${highlightKindMeta[r.h.kind].accent}`,
          activeId === r.h.id && "ring-2 ring-primary/40",
        )}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    cursor = r.end;
  });
  if (cursor < text.length) out.push(<span key="tail">{text.slice(cursor)}</span>);
  return out;
}
