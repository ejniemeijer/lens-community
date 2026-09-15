"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, MoreHorizontal, Combine, Sparkles, GripVertical, Pencil, Trash2, Quote, Lightbulb, ArrowUpRight } from "lucide-react";
import type { AffinityBoard as AffinityBoardData, AffinityGroup, AffinityNote, HighlightKind, Insight } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { getParticipant, fullName, interviews, currentUserId, currentUser } from "@/lib/db";
import { askAIJson, aiEnabled, AiError } from "@/lib/ai";
import { highlightKindMeta, HighlightKindBadge } from "@/components/domain/badges";
import { AccentPill } from "@/components/ui/accent";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { can } from "@/lib/permissions";
import { cn, uid } from "@/lib/utils";

const PALETTE = ["blue", "indigo", "violet", "purple", "pink", "rose", "red", "orange", "amber", "lime", "green", "teal", "cyan", "slate"];
const KINDS = Object.keys(highlightKindMeta) as HighlightKind[];

/** The most frequent note kind in a cluster — the promoted insight's default type. */
function dominantKind(notes: AffinityNote[]): HighlightKind {
  const counts = new Map<HighlightKind, number>();
  for (const n of notes) counts.set(n.kind, (counts.get(n.kind) ?? 0) + 1);
  let best: HighlightKind = "insight";
  let max = 0;
  for (const [k, c] of counts) if (c > max) { max = c; best = k; }
  return best;
}

function NoteBody({ note }: { note: AffinityNote }) {
  const participant = note.sourceParticipantId ? getParticipant(note.sourceParticipantId) : undefined;
  return (
    <>
      <div className="mb-1.5">
        <AccentPill accent={highlightKindMeta[note.kind].accent} size="sm">
          {highlightKindMeta[note.kind].label}
        </AccentPill>
      </div>
      <p className="text-[13px] leading-snug text-foreground">{note.text}</p>
      {participant && <p className="mt-1.5 text-2xs text-subtle">— {fullName(participant)}</p>}
    </>
  );
}

function DraggableNote({
  note,
  readOnly,
  onEdit,
  onDelete,
}: {
  note: AffinityNote;
  readOnly?: boolean;
  onEdit: (note: AffinityNote) => void;
  onDelete: (note: AffinityNote) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: note.id,
    disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative touch-none rounded-lg border border-border bg-surface p-2.5 shadow-xs",
        !readOnly && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
    >
      <NoteBody note={note} />
      {!readOnly && (
        <div
          className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-md border border-border bg-surface opacity-0 shadow-xs transition-opacity group-hover:opacity-100"
          // Stop the drag sensor from claiming clicks on the action buttons.
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onEdit(note)}
            className="rounded p-1 text-subtle hover:bg-surface-hover hover:text-foreground"
            aria-label="Edit note"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={() => onDelete(note)}
            className="rounded p-1 text-subtle hover:bg-surface-hover hover:text-danger"
            aria-label="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Edit an affinity note's text and kind in place. */
function NoteEditDialog({
  note,
  boardId,
  onClose,
}: {
  note: AffinityNote | null;
  boardId: string;
  onClose: () => void;
}) {
  const updateNote = useApp((s) => s.updateAffinityNote);
  const toast = useApp((s) => s.toast);
  const [text, setText] = React.useState("");
  const [kind, setKind] = React.useState<HighlightKind>("observation");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!note) return;
    setText(note.text);
    setKind(note.kind);
    setError("");
  }, [note]);

  const save = () => {
    if (!note) return;
    if (!text.trim()) return setError("The note can't be empty.");
    updateNote(boardId, note.id, { text: text.trim(), kind });
    toast("Note updated");
    onClose();
  };

  return (
    <Modal
      open={!!note}
      onClose={onClose}
      title="Edit note"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>Save changes</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <Label>Note *</Label>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Type</Label>
          <Select value={kind} onChange={(e) => setKind(e.target.value as HighlightKind)}>
            {(Object.keys(highlightKindMeta) as HighlightKind[]).map((k) => (
              <option key={k} value={k}>{highlightKindMeta[k].label}</option>
            ))}
          </Select>
        </div>
      </div>
    </Modal>
  );
}

function GroupColumn({
  group,
  notes,
  boardId,
  allGroups,
  readOnly,
  onEdit,
  onDelete,
  onPromote,
}: {
  group: AffinityGroup;
  notes: AffinityNote[];
  boardId: string;
  allGroups: AffinityGroup[];
  readOnly?: boolean;
  onEdit: (note: AffinityNote) => void;
  onDelete: (note: AffinityNote) => void;
  onPromote: (group: AffinityGroup) => void;
}) {
  const router = useRouter();
  const { setNodeRef, isOver } = useDroppable({ id: group.id, disabled: readOnly });
  const rename = useApp((s) => s.renameAffinityGroup);
  const recolor = useApp((s) => s.recolorAffinityGroup);
  const merge = useApp((s) => s.mergeAffinityGroups);
  const addNote = useApp((s) => s.addAffinityNote);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(group.title);
  const [adding, setAdding] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");

  const submitNote = () => {
    if (noteText.trim()) addNote(boardId, group.id, noteText.trim(), "observation");
    setNoteText("");
    setAdding(false);
  };

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className={cn(`accent-${group.accent}`, "mb-2 flex items-center gap-2 rounded-md px-2 py-1.5")}
        style={{ backgroundColor: "hsl(var(--a-bg))" }}
      >
        <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--a-solid))]" />
        {editing && !readOnly ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { rename(boardId, group.id, draft.trim() || group.title); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { rename(boardId, group.id, draft.trim() || group.title); setEditing(false); } }}
            className="flex-1 bg-transparent text-[13px] font-semibold text-[hsl(var(--a-fg))] focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { if (!readOnly) { setDraft(group.title); setEditing(true); } }}
            className="flex-1 truncate text-left text-[13px] font-semibold text-[hsl(var(--a-fg))]"
          >
            {group.title}
          </button>
        )}
        {group.aiSuggested && <Sparkles className="h-3 w-3 text-[hsl(var(--a-fg))]" />}
        {group.insightId && (
          <Link
            href={`/insights/${group.insightId}`}
            title="Open the insight created from this cluster"
            className="text-[hsl(var(--a-fg))] opacity-80 hover:opacity-100"
          >
            <Lightbulb className="h-3 w-3" />
          </Link>
        )}
        <span className="text-2xs font-medium text-[hsl(var(--a-fg))] opacity-70">{notes.length}</span>
        {!readOnly && (
        <Menu>
          <MenuTrigger>
            <button className="rounded p-0.5 text-[hsl(var(--a-fg))] opacity-70 hover:opacity-100">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </MenuTrigger>
          <MenuContent>
            {group.insightId ? (
              <MenuItem icon={<ArrowUpRight className="h-4 w-4" />} onSelect={() => router.push(`/insights/${group.insightId}`)}>
                Open insight
              </MenuItem>
            ) : (
              notes.length > 0 && (
                <MenuItem icon={<Lightbulb className="h-4 w-4" />} onSelect={() => onPromote(group)}>
                  Create insight from cluster
                </MenuItem>
              )
            )}
            <MenuItem icon={<Plus className="h-4 w-4" />} onSelect={() => setAdding(true)}>Add note</MenuItem>
            <MenuLabel>Color</MenuLabel>
            <div className="grid grid-cols-7 gap-1 px-2.5 pb-1.5">
              {PALETTE.map((a) => (
                <button
                  key={a}
                  onClick={() => recolor(boardId, group.id, a)}
                  className={`accent-${a} h-5 w-5 rounded-full ring-1 ring-inset ring-black/10`}
                  style={{ backgroundColor: "hsl(var(--a-solid))" }}
                  title={a}
                />
              ))}
            </div>
            {allGroups.length > 1 && (
              <>
                <MenuSeparator />
                <MenuLabel>Merge into</MenuLabel>
                {allGroups.filter((g) => g.id !== group.id).map((g) => (
                  <MenuItem key={g.id} icon={<Combine className="h-4 w-4" />} onSelect={() => merge(boardId, group.id, g.id)}>
                    {g.title}
                  </MenuItem>
                ))}
              </>
            )}
          </MenuContent>
        </Menu>
        )}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-primary-soft/30" : "border-border bg-surface-2/40",
        )}
      >
        {notes.map((n) => (
          <DraggableNote key={n.id} note={n} readOnly={readOnly} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {adding && (
          <div className="rounded-lg border border-border bg-surface p-2">
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={submitNote}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNote(); } if (e.key === "Escape") setAdding(false); }}
              placeholder="New note…"
              rows={2}
              className="w-full resize-none bg-transparent text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
            />
          </div>
        )}
        {!readOnly && !adding && (
          <button
            onClick={() => setAdding(true)}
            className={cn(
              `accent-${group.accent}`,
              "flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparent px-2 py-1.5 text-xs font-medium text-[hsl(var(--a-fg))] opacity-70 transition-all hover:border-[hsl(var(--a-border))] hover:bg-[hsl(var(--a-bg)/0.6)] hover:opacity-100",
            )}
          >
            <Plus className="h-3.5 w-3.5" /> Add note
          </button>
        )}
      </div>
    </div>
  );
}

function UngroupedColumn({
  notes,
  boardId,
  readOnly,
  onEdit,
  onDelete,
}: {
  notes: AffinityNote[];
  boardId: string;
  readOnly?: boolean;
  onEdit: (note: AffinityNote) => void;
  onDelete: (note: AffinityNote) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "ungrouped", disabled: readOnly });
  const addNote = useApp((s) => s.addAffinityNote);
  const [adding, setAdding] = React.useState(false);
  const [noteText, setNoteText] = React.useState("");

  const submitNote = () => {
    if (noteText.trim()) addNote(boardId, null, noteText.trim(), "observation");
    setNoteText("");
    setAdding(false);
  };

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-2 py-1.5">
        <GripVertical className="h-3.5 w-3.5 text-subtle" />
        <h3 className="flex-1 text-[13px] font-semibold text-muted">Unsorted</h3>
        <span className="text-2xs font-medium text-subtle">{notes.length}</span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-primary-soft/30" : "border-border bg-surface-2/40",
        )}
      >
        {notes.map((n) => (
          <DraggableNote key={n.id} note={n} readOnly={readOnly} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {adding && (
          <div className="rounded-lg border border-border bg-surface p-2">
            <textarea
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={submitNote}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNote(); } if (e.key === "Escape") setAdding(false); }}
              placeholder="New note…"
              rows={2}
              className="w-full resize-none bg-transparent text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
            />
          </div>
        )}
        {!readOnly && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparent px-2 py-1.5 text-xs font-medium text-muted opacity-80 transition-all hover:border-border-strong hover:bg-surface-hover hover:text-foreground hover:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add note
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- import captured research as notes ---------------- */

type ImportItem = {
  key: string; // stable dedup key (highlight id, or interview + quote text)
  text: string;
  kind: HighlightKind;
  participantId?: string;
  interviewId: string;
  highlightId?: string;
};

/** Pull real evidence — transcript highlights and interview key takeaways —
    onto the board as unsorted notes, each keeping its source. Items already
    on the board are hidden, so the picker can be reopened as research lands. */
function ImportNotesDialog({
  open,
  board,
  onClose,
}: {
  open: boolean;
  board: AffinityBoardData;
  onClose: () => void;
}) {
  useDb();
  const storeHighlights = useApp((s) => s.highlights);
  const importNotes = useApp((s) => s.importAffinityNotes);
  const toast = useApp((s) => s.toast);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const scoped = board.projectId
    ? interviews.filter((iv) => iv.projectIds.includes(board.projectId!))
    : interviews;
  const onBoard = new Set(
    board.notes.map((n) =>
      n.sourceHighlightId ? `h:${n.sourceHighlightId}` : n.sourceInterviewId ? `t:${n.sourceInterviewId}:${n.text}` : "",
    ),
  );
  const sections = scoped
    .map((iv) => {
      const highlights: ImportItem[] = (iv.transcriptId ? (storeHighlights[iv.transcriptId] ?? []) : []).map((h) => ({
        key: `h:${h.id}`,
        text: h.text,
        kind: h.kind,
        participantId: iv.participantId,
        interviewId: iv.id,
        highlightId: h.id,
      }));
      const takeaways: ImportItem[] = (iv.keyObservations ?? []).map((q) => ({
        key: `t:${iv.id}:${q}`,
        text: q,
        kind: "observation" as HighlightKind,
        participantId: iv.participantId,
        interviewId: iv.id,
      }));
      return { iv, items: [...highlights, ...takeaways].filter((it) => it.text.trim() && !onBoard.has(it.key)) };
    })
    .filter((s) => s.items.length > 0);
  const allItems = sections.flatMap((s) => s.items);

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const add = () => {
    const items = allItems.filter((it) => selected.has(it.key));
    importNotes(
      board.id,
      items.map((it) => ({
        text: it.text,
        kind: it.kind,
        sourceParticipantId: it.participantId,
        sourceInterviewId: it.interviewId,
        sourceHighlightId: it.highlightId,
      })),
    );
    toast(`Added ${items.length} note${items.length === 1 ? "" : "s"} to Unsorted`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add notes from research"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={add} disabled={selected.size === 0}>
            Add {selected.size || ""} to board
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-muted">
          Highlights and key takeaways from {board.projectId ? "this project's" : "your"} interviews — imported notes
          keep their participant and interview, so every quote on the wall stays traceable.
        </p>
        {allItems.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] text-subtle">
            Nothing new to import — everything captured is already on the board.
          </p>
        ) : (
          <>
            <button
              onClick={() => setSelected(new Set(allItems.map((it) => it.key)))}
              className="self-start text-xs font-medium text-primary hover:underline"
            >
              Select all ({allItems.length})
            </button>
            <div className="flex max-h-96 flex-col gap-3 overflow-y-auto">
              {sections.map(({ iv, items }) => {
                const participant = getParticipant(iv.participantId);
                return (
                  <div key={iv.id}>
                    <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">
                      {iv.title}
                      {participant && <span className="normal-case"> · {fullName(participant)}</span>}
                    </p>
                    <div className="flex flex-col gap-1">
                      {items.map((it) => (
                        <label
                          key={it.key}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:bg-surface-hover"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(it.key)}
                            onChange={() => toggle(it.key)}
                            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] leading-snug text-foreground">{it.text}</span>
                            <span className="mt-1 inline-flex"><HighlightKindBadge kind={it.kind} /></span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- promote a cluster into a repository insight ---------------- */

/** A named cluster with evidence behind it is a candidate insight: prefill a
    claim from the cluster, carry the strongest quote as evidence, and link the
    union of the notes' participants and interviews. The cluster stays on the
    board, marked as promoted. */
function PromoteClusterDialog({
  group,
  notes,
  board,
  onClose,
}: {
  group: AffinityGroup | null;
  notes: AffinityNote[];
  board: AffinityBoardData;
  onClose: () => void;
}) {
  const addInsight = useApp((s) => s.addInsight);
  const linkGroup = useApp((s) => s.linkAffinityGroupInsight);
  const toast = useApp((s) => s.toast);
  const [title, setTitle] = React.useState("");
  const [type, setType] = React.useState<HighlightKind>("insight");
  const [evidence, setEvidence] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!group) return;
    setTitle(group.title);
    setType(dominantKind(notes));
    // The longest note usually carries the most quotable evidence.
    setEvidence([...notes].sort((a, b) => b.text.length - a.text.length)[0]?.text ?? "");
    setDescription("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group]);

  if (!group) return null;

  const participantIds = [...new Set(notes.map((n) => n.sourceParticipantId).filter(Boolean))] as string[];
  const interviewIds = [...new Set(notes.map((n) => n.sourceInterviewId).filter(Boolean))] as string[];

  const create = () => {
    if (!title.trim()) return setError("Give the insight a title — write it as a claim.");
    const insight: Insight = {
      id: uid("in"),
      title: title.trim(),
      description: description.trim(),
      evidence: evidence.trim(),
      type,
      createdDate: new Date().toISOString().slice(0, 10),
      createdById: currentUserId,
      participantIds,
      interviewIds,
      projectIds: board.projectId ? [board.projectId] : [],
      themeIds: [],
      tagIds: [],
      personaIds: [],
      productArea: "Platform",
    };
    addInsight(insight);
    linkGroup(board.id, group.id, insight.id);
    toast(`Insight created from “${group.title}”`);
    onClose();
  };

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title="Create insight from cluster"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={create}>Create insight</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="rounded-md bg-surface-2 px-3 py-2 text-[13px] text-muted">
          From <strong className="text-foreground">{group.title}</strong> — {notes.length} note{notes.length === 1 ? "" : "s"}
          {participantIds.length > 0 && <>, linking {participantIds.length} participant{participantIds.length === 1 ? "" : "s"}</>}
          {interviewIds.length > 0 && <> and {interviewIds.length} interview{interviewIds.length === 1 ? "" : "s"}</>}.
          The cluster stays on the board, marked as promoted.
        </p>
        <div className="flex flex-col gap-1">
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Write it as a claim — “technicians distrust offline sync”" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as HighlightKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{highlightKindMeta[k].label}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Evidence (strongest quote)</Label>
          <Textarea rows={3} value={evidence} onChange={(e) => setEvidence(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Description</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the pattern means and why it matters (optional)…" />
        </div>
      </div>
    </Modal>
  );
}

export function AffinityBoard({ boardId }: { boardId: string }) {
  const board = useApp((s) => s.affinity.find((b) => b.id === boardId));
  const move = useApp((s) => s.moveAffinityNote);
  const addGroup = useApp((s) => s.addAffinityGroup);
  const deleteNote = useApp((s) => s.deleteAffinityNote);
  const applyClusters = useApp((s) => s.applyAffinityClusters);
  const toast = useApp((s) => s.toast);
  const role = useApp((s) => s.role);
  const readOnly = !can(role, "manage-content");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<AffinityNote | null>(null);
  const [clustering, setClustering] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [promoting, setPromoting] = React.useState<AffinityGroup | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  if (!board) return <p className="p-6 text-sm text-muted">Board not found.</p>;

  const onDelete = (note: AffinityNote) => {
    deleteNote(board.id, note.id);
    toast("Note deleted", "info");
  };

  const runAiClustering = async () => {
    const notes = board.notes;
    if (notes.length < 3) {
      toast("Add at least 3 notes before clustering with AI.", "info");
      return;
    }
    setClustering(true);
    try {
      const noteList = notes.map((n) => `${n.id}: ${n.text}`).join("\n");
      const result = await askAIJson<{ clusters: { title: string; noteIds: string[] }[] }>({
        system:
          "You are a UX researcher doing affinity mapping. Group the notes into 3–6 meaningful themes. Return JSON: { \"clusters\": [ { \"title\": \"short theme name\", \"noteIds\": [\"id\", ...] } ] }. Every note id must appear in exactly one cluster. Use only the ids provided.",
        messages: [{ role: "user", content: `Notes:\n${noteList}` }],
        maxTokens: 1200,
      });
      const clusters = (result.clusters ?? []).filter((c) => c.title && c.noteIds?.length);
      if (clusters.length === 0) {
        toast("The AI couldn't find clear clusters — try adding more notes.", "info");
      } else {
        applyClusters(board.id, clusters);
        toast(`Created ${clusters.length} AI-suggested cluster${clusters.length === 1 ? "" : "s"}`);
      }
    } catch (e) {
      toast(e instanceof AiError ? e.message : "Couldn't cluster the notes.", "error");
    } finally {
      setClustering(false);
    }
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    if (!overId) return;
    const target = overId === "ungrouped" ? null : overId;
    if (target === null || board.groups.some((g) => g.id === target)) {
      move(board.id, e.active.id as string, target);
    }
  };
  const activeNote = board.notes.find((n) => n.id === activeId);
  const ungrouped = board.notes.filter((n) => n.groupId === null);

  return (
    <DndContext
      id={`affinity-${board.id}`}
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => setActiveId(e.active.id as string)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {!readOnly && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-hover"
          >
            <Quote className="h-3.5 w-3.5 text-primary" />
            Add from research
          </button>
          {aiEnabled("ai.suggestions") && can(role, "use-ai") && currentUser().aiEnabled !== false && (
            <>
              <button
                onClick={runAiClustering}
                disabled={clustering}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary-soft px-2.5 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary-soft/70 disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                {clustering ? "Clustering…" : "AI cluster notes"}
              </button>
              <span className="text-xs text-subtle">Groups your notes into themes automatically</span>
            </>
          )}
        </div>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {board.groups.map((g) => (
          <GroupColumn
            key={g.id}
            group={g}
            boardId={board.id}
            allGroups={board.groups}
            readOnly={readOnly}
            notes={board.notes.filter((n) => n.groupId === g.id)}
            onEdit={setEditing}
            onDelete={onDelete}
            onPromote={setPromoting}
          />
        ))}
        <UngroupedColumn notes={ungrouped} boardId={board.id} readOnly={readOnly} onEdit={setEditing} onDelete={onDelete} />
        {!readOnly && (
          <button
            onClick={() => addGroup(board.id, "New cluster")}
            className="flex h-10 w-40 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-[13px] text-muted hover:border-border-strong hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add cluster
          </button>
        )}
      </div>
      <DragOverlay>
        {activeNote ? (
          <div className="w-72 rotate-2 rounded-lg border border-primary bg-surface p-2.5 shadow-lg">
            <NoteBody note={activeNote} />
          </div>
        ) : null}
      </DragOverlay>
      <NoteEditDialog note={editing} boardId={board.id} onClose={() => setEditing(null)} />
      <ImportNotesDialog open={importing} board={board} onClose={() => setImporting(false)} />
      <PromoteClusterDialog
        group={promoting}
        notes={promoting ? board.notes.filter((n) => n.groupId === promoting.id) : []}
        board={board}
        onClose={() => setPromoting(null)}
      />
    </DndContext>
  );
}
