"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, GripVertical, Lightbulb, User, MoreHorizontal, Pencil, Trash2, ArrowUpRight, Link2Off, Sparkles, Check, X } from "lucide-react";
import type { KanbanCard, KanbanColumn, Insight } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { insights as allInsights, getInsight, getParticipant, getTags, getUser, fullName, users, currentUser } from "@/lib/db";
import { KANBAN_STAGES_PREF, parseStages, isStage, firstStageId } from "@/lib/workflow";
import { askAIJson, aiEnabled, redactIfEnabled, AiError } from "@/lib/ai";
import { AccentPill } from "@/components/ui/accent";
import { can } from "@/lib/permissions";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { HighlightKindBadge } from "@/components/domain/badges";
import { cn } from "@/lib/utils";

/** An AI-proposed move for an insight, pending the researcher's accept/dismiss. */
type LaneSuggestion = { laneId: string; laneTitle: string; reason: string };

/* ---------------- insight cards (the board's real content) ---------------- */

function InsightCardBody({ insight }: { insight: Insight }) {
  const tags = getTags(insight.tagIds);
  const participant = insight.participantIds[0] ? getParticipant(insight.participantIds[0]) : undefined;
  const quote = insight.evidence || insight.description;
  return (
    <>
      <p className="text-[13px] font-medium leading-snug text-foreground">{insight.title}</p>
      {quote && <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">{quote}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <HighlightKindBadge kind={insight.type} />
        {tags.slice(0, 2).map((t) => (
          <AccentPill key={t.id} accent={t.accent} size="sm">{t.label}</AccentPill>
        ))}
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2">
        <Link
          href={`/insights/${insight.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-2xs text-subtle hover:text-primary"
        >
          <Lightbulb className="h-3 w-3" /> Insight
        </Link>
        {participant && (
          <span className="flex items-center gap-1 text-2xs text-subtle">
            <User className="h-3 w-3" /> {fullName(participant).split(" ")[0]}
          </span>
        )}
      </div>
    </>
  );
}

function InsightCard({
  insight,
  readOnly,
  onRemove,
  suggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
}: {
  insight: Insight;
  readOnly?: boolean;
  onRemove: (insight: Insight) => void;
  suggestion?: LaneSuggestion;
  onAcceptSuggestion?: (insightId: string) => void;
  onDismissSuggestion?: (insightId: string) => void;
}) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `ins:${insight.id}`,
    disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("group rounded-lg border border-border bg-surface p-2.5 shadow-xs", isDragging && "opacity-40")}
    >
      <div className="flex items-start gap-1">
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-subtle opacity-0 hover:bg-surface-hover group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag insight"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <InsightCardBody insight={insight} />
        </div>
        {!readOnly && (
          <Menu>
            <MenuTrigger>
              <button
                className="rounded p-0.5 text-subtle opacity-0 hover:bg-surface-hover hover:text-foreground group-hover:opacity-100"
                aria-label={`Actions for ${insight.title}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<ArrowUpRight className="h-4 w-4" />} onSelect={() => router.push(`/insights/${insight.id}`)}>
                Open insight
              </MenuItem>
              <MenuItem icon={<Link2Off className="h-4 w-4" />} destructive onSelect={() => onRemove(insight)}>
                Remove from board
              </MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
      {suggestion && !readOnly && (
        <div className="mt-2 rounded-md border border-primary/30 bg-primary-soft px-2 py-1.5">
          <p className="flex items-center gap-1.5 text-2xs font-semibold text-primary">
            <Sparkles className="h-3 w-3 shrink-0" /> Suggested: {suggestion.laneTitle}
          </p>
          {suggestion.reason && <p className="mt-0.5 text-2xs leading-snug text-muted">{suggestion.reason}</p>}
          <div className="mt-1.5 flex items-center gap-1.5">
            <button
              onClick={() => onAcceptSuggestion?.(insight.id)}
              className="inline-flex items-center gap-1 rounded bg-primary px-1.5 py-0.5 text-2xs font-medium text-primary-fg transition-opacity hover:opacity-90"
            >
              <Check className="h-3 w-3" /> Move
            </button>
            <button
              onClick={() => onDismissSuggestion?.(insight.id)}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs font-medium text-muted transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" /> Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- spike cards (free notes, no insight) ---------------- */

function SpikeCardBody({ card }: { card: KanbanCard }) {
  const assignee = card.assigneeId ? getUser(card.assigneeId) : undefined;
  return (
    <>
      <p className="text-[13px] font-medium leading-snug text-foreground">{card.title}</p>
      {card.description && <p className="mt-1 line-clamp-2 text-xs leading-snug text-muted">{card.description}</p>}
      <div className="mt-2.5 flex items-center gap-2 border-t border-border pt-2">
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-2xs font-medium text-subtle">Spike</span>
        <span className="flex-1" />
        {assignee && <Avatar name={assignee.name} accent={assignee.avatarColor} size="xs" />}
      </div>
    </>
  );
}

function DraggableSpike({
  card,
  readOnly,
  onEdit,
  onDelete,
}: {
  card: KanbanCard;
  readOnly?: boolean;
  onEdit: (card: KanbanCard) => void;
  onDelete: (card: KanbanCard) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `spk:${card.id}`,
    disabled: readOnly,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("group rounded-lg border border-border bg-surface p-2.5 shadow-xs", isDragging && "opacity-40")}
    >
      <div className="flex items-start gap-1">
        {!readOnly && (
          <button
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab touch-none rounded p-0.5 text-subtle opacity-0 hover:bg-surface-hover group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Drag card"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <SpikeCardBody card={card} />
        </div>
        {!readOnly && (
          <Menu>
            <MenuTrigger>
              <button
                className="rounded p-0.5 text-subtle opacity-0 hover:bg-surface-hover hover:text-foreground group-hover:opacity-100"
                aria-label={`Card actions for ${card.title}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuItem icon={<Pencil className="h-4 w-4" />} onSelect={() => onEdit(card)}>Edit card</MenuItem>
              <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => onDelete(card)}>Delete card</MenuItem>
            </MenuContent>
          </Menu>
        )}
      </div>
    </div>
  );
}

/** Edit a spike card's title, description, and assignee in place. */
function CardEditDialog({ card, boardId, onClose }: { card: KanbanCard | null; boardId: string; onClose: () => void }) {
  const updateCard = useApp((s) => s.updateKanbanCard);
  const toast = useApp((s) => s.toast);
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!card) return;
    setTitle(card.title);
    setDescription(card.description ?? "");
    setAssigneeId(card.assigneeId ?? "");
    setError("");
  }, [card]);

  const save = () => {
    if (!card) return;
    if (!title.trim()) return setError("Title is required.");
    updateCard(boardId, card.id, {
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId: assigneeId || undefined,
    });
    toast("Card updated");
    onClose();
  };

  return (
    <Modal
      open={!!card}
      onClose={onClose}
      title="Edit card"
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
          <Label>Title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Description</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Add context for this card…" />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Assignee</Label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Unassigned</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </div>
      </div>
    </Modal>
  );
}

/** Pull existing insights onto the board (sets their workflow stage). */
function AddInsightsDialog({
  open,
  projectId,
  stages,
  defaultStage,
  onClose,
}: {
  open: boolean;
  projectId?: string;
  stages: KanbanColumn[];
  defaultStage: string;
  onClose: () => void;
}) {
  useDb();
  const updateInsight = useApp((s) => s.updateInsight);
  const toast = useApp((s) => s.toast);
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) { setQuery(""); setSelected(new Set()); }
  }, [open]);

  const scoped = projectId ? allInsights.filter((i) => i.projectIds.includes(projectId)) : allInsights;
  const available = scoped.filter((i) => !isStage(i.workflowStage, stages));
  const q = query.trim().toLowerCase();
  const filtered = q ? available.filter((i) => i.title.toLowerCase().includes(q)) : available;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const add = () => {
    selected.forEach((id) => updateInsight(id, { workflowStage: defaultStage }));
    toast(`Added ${selected.size} insight${selected.size === 1 ? "" : "s"} to the board`);
    onClose();
  };
  const firstLane = stages[0]?.title ?? "the first lane";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add insights to the board"
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
          New cards land in <strong>{firstLane}</strong>. Moving a card sets the insight&rsquo;s stage directly — the
          board is just a view of your insights.
        </p>
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search insights…" autoFocus />
        {filtered.length === 0 ? (
          <p className="rounded-md bg-surface-2 px-3 py-6 text-center text-[13px] text-subtle">
            {available.length === 0 ? "Every insight is already on the board." : "No insights match your search."}
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {filtered.map((i) => (
              <label
                key={i.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-2.5 hover:bg-surface-hover"
              >
                <input
                  type="checkbox"
                  checked={selected.has(i.id)}
                  onChange={() => toggle(i.id)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-snug text-foreground">{i.title}</span>
                  <span className="mt-1 inline-flex"><HighlightKindBadge kind={i.type} /></span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ---------------- columns & board ---------------- */

function Column({
  stage,
  insights,
  spikes,
  boardId,
  readOnly,
  onEditSpike,
  onDeleteSpike,
  onRemoveInsight,
  suggestions,
  onAcceptSuggestion,
  onDismissSuggestion,
}: {
  stage: KanbanColumn;
  insights: Insight[];
  spikes: KanbanCard[];
  boardId: string;
  readOnly?: boolean;
  onEditSpike: (card: KanbanCard) => void;
  onDeleteSpike: (card: KanbanCard) => void;
  onRemoveInsight: (insight: Insight) => void;
  suggestions: Record<string, LaneSuggestion>;
  onAcceptSuggestion: (insightId: string) => void;
  onDismissSuggestion: (insightId: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id, disabled: readOnly });
  const addCard = useApp((s) => s.addKanbanCard);
  const [adding, setAdding] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const count = insights.length + spikes.length;

  const submit = () => {
    if (title.trim()) addCard(boardId, stage.id, title.trim());
    setTitle("");
    setAdding(false);
  };

  return (
    <div className={cn(`accent-${stage.accent}`, "flex w-72 shrink-0 flex-col")}>
      <div
        className="mb-2 flex flex-col rounded-md border px-2.5 py-2"
        style={{ backgroundColor: "hsl(var(--a-bg))", borderColor: "hsl(var(--a-border))" }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[hsl(var(--a-solid))]" />
          <h3 className="min-w-0 truncate text-[13px] font-semibold text-[hsl(var(--a-fg))]">{stage.title}</h3>
          <span className="shrink-0 rounded-full bg-[hsl(var(--a-solid)/0.18)] px-1.5 py-0.5 text-2xs font-semibold tabular-nums text-[hsl(var(--a-fg))]">
            {count}
          </span>
          {!readOnly && (
            <button
              onClick={() => setAdding(true)}
              className="ml-auto shrink-0 rounded p-1 text-[hsl(var(--a-fg))] opacity-60 transition-opacity hover:opacity-100"
              aria-label={`Add a spike card to ${stage.title}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <p
          title={stage.description}
          className="mt-1 line-clamp-2 h-[2.7em] pl-[18px] text-2xs leading-[1.35] text-[hsl(var(--a-fg)/0.75)]"
        >
          {stage.description}
        </p>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[140px] flex-1 flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver && "!border-primary !bg-primary-soft/40",
        )}
        style={isOver ? undefined : { backgroundColor: "hsl(var(--a-bg) / 0.45)", borderColor: "hsl(var(--a-border) / 0.8)" }}
      >
        {insights.map((i) => (
          <InsightCard
            key={i.id}
            insight={i}
            readOnly={readOnly}
            onRemove={onRemoveInsight}
            suggestion={suggestions[i.id]}
            onAcceptSuggestion={onAcceptSuggestion}
            onDismissSuggestion={onDismissSuggestion}
          />
        ))}
        {spikes.map((c) => (
          <DraggableSpike key={c.id} card={c} readOnly={readOnly} onEdit={onEditSpike} onDelete={onDeleteSpike} />
        ))}
        {adding && (
          <div className="rounded-lg border border-border bg-surface p-2">
            <textarea
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } if (e.key === "Escape") setAdding(false); }}
              placeholder="Spike card title…"
              className="w-full resize-none bg-transparent text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
              rows={2}
            />
          </div>
        )}
        {!readOnly && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-transparent px-2 py-1.5 text-xs font-medium text-[hsl(var(--a-fg))] opacity-70 transition-all hover:border-[hsl(var(--a-border))] hover:bg-[hsl(var(--a-bg)/0.6)] hover:opacity-100"
          >
            <Plus className="h-3.5 w-3.5" /> Add card
          </button>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ boardId }: { boardId: string }) {
  useDb(); // re-render when an insight's stage changes
  const board = useApp((s) => s.kanban.find((b) => b.id === boardId));
  const stagesPref = useApp((s) => s.prefs[KANBAN_STAGES_PREF]);
  const moveSpike = useApp((s) => s.moveKanbanCard);
  const deleteSpike = useApp((s) => s.deleteKanbanCard);
  const updateInsight = useApp((s) => s.updateInsight);
  const toast = useApp((s) => s.toast);
  const role = useApp((s) => s.role);
  const readOnly = !can(role, "manage-content");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<KanbanCard | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Record<string, LaneSuggestion>>({});
  const [suggesting, setSuggesting] = React.useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const stages = parseStages(stagesPref);

  if (!board) return <p className="p-6 text-sm text-muted">Board not found.</p>;

  const scoped = board.projectId
    ? allInsights.filter((i) => i.projectIds.includes(board.projectId!))
    : allInsights;
  const staged = scoped.filter((i) => isStage(i.workflowStage, stages));
  const spikes = (board.cards ?? []).filter((c) => !c.insightId);
  const empty = staged.length === 0 && spikes.length === 0;

  // AI lane suggestions: triage the first lane's insights into later stages.
  // Gated on the workspace toggle + the caller's role + per-user AI access.
  const firstLane = stages[0];
  const inbox = staged.filter((i) => i.workflowStage === firstLane?.id);
  const canSuggest =
    !readOnly && stages.length > 1 && can(role, "use-ai") && aiEnabled("ai.triage") && currentUser().aiEnabled !== false;

  const dropSuggestion = (insightId: string) =>
    setSuggestions((prev) => {
      if (!(insightId in prev)) return prev;
      const next = { ...prev };
      delete next[insightId];
      return next;
    });

  const runSuggest = async () => {
    const targets = stages.slice(1);
    if (!inbox.length || !targets.length) return;
    setSuggesting(true);
    try {
      const laneList = targets
        .map((l) => `${l.id}: ${l.title}${l.description ? ` — ${l.description}` : ""}`)
        .join("\n");
      const insightList = inbox
        .map((i) => {
          const rating = [
            i.severity && `severity: ${i.severity}`,
            i.impact && `impact: ${i.impact}`,
            i.confidence && `confidence: ${i.confidence}`,
          ]
            .filter(Boolean)
            .join(", ");
          const quote = redactIfEnabled(i.evidence || i.description || "").slice(0, 300);
          return `${i.id}: [${i.type}] ${i.title}${rating ? ` (${rating})` : ""}${quote ? `\n  evidence: "${quote}"` : ""}`;
        })
        .join("\n");
      const result = await askAIJson<{ suggestions: { insightId: string; laneId: string; reason: string }[] }>({
        system:
          `You are a senior UX researcher triaging findings on a research-to-product Kanban board. For each insight currently in "${firstLane.title}", pick the most appropriate lane from the list — or skip it if it genuinely isn't ready to move. Judge by the strength of evidence and any ratings; do not invent facts. Return JSON: { "suggestions": [ { "insightId": "...", "laneId": "...", "reason": "why, max 15 words" } ] }. Use only the provided ids.`,
        messages: [{ role: "user", content: `Lanes:\n${laneList}\n\nInsights to triage:\n${insightList}` }],
        maxTokens: 1024,
      });
      const valid: Record<string, LaneSuggestion> = {};
      for (const s of result.suggestions ?? []) {
        const lane = targets.find((l) => l.id === s?.laneId);
        if (!lane || !inbox.some((i) => i.id === s.insightId)) continue;
        valid[s.insightId] = { laneId: lane.id, laneTitle: lane.title, reason: typeof s.reason === "string" ? s.reason : "" };
      }
      const n = Object.keys(valid).length;
      setSuggestions(valid);
      toast(
        n
          ? `${n} lane suggestion${n === 1 ? "" : "s"} — review them on the cards`
          : `Nothing to move yet — the AI would keep everything in ${firstLane.title}.`,
        n ? "success" : "info",
      );
    } catch (e) {
      toast(e instanceof AiError ? e.message : "Couldn't get lane suggestions.", "error");
    } finally {
      setSuggesting(false);
    }
  };

  const acceptSuggestion = (insightId: string) => {
    const s = suggestions[insightId];
    if (!s) return;
    updateInsight(insightId, { workflowStage: s.laneId });
    dropSuggestion(insightId);
  };
  const applyAllSuggestions = () => {
    const n = Object.keys(suggestions).length;
    Object.entries(suggestions).forEach(([id, s]) => updateInsight(id, { workflowStage: s.laneId }));
    setSuggestions({});
    toast(`Moved ${n} insight${n === 1 ? "" : "s"}`);
  };

  const onRemoveInsight = (insight: Insight) => {
    updateInsight(insight.id, { workflowStage: null });
    dropSuggestion(insight.id);
    toast(`“${insight.title}” removed from the board`, "info");
  };
  const onDeleteSpike = (card: KanbanCard) => {
    deleteSpike(board.id, card.id);
    toast(`Card “${card.title}” deleted`, "info");
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const overId = e.over?.id as string | undefined;
    if (!overId || !isStage(overId, stages)) return;
    const active = e.active.id as string;
    if (active.startsWith("ins:")) {
      updateInsight(active.slice(4), { workflowStage: overId });
      dropSuggestion(active.slice(4)); // placed by hand — the suggestion is moot
    } else if (active.startsWith("spk:")) {
      moveSpike(board.id, active.slice(4), overId);
    }
  };

  const activeInsight = activeId?.startsWith("ins:") ? getInsight(activeId.slice(4)) : undefined;
  const activeSpike = activeId?.startsWith("spk:") ? spikes.find((c) => c.id === activeId.slice(4)) : undefined;

  return (
    <DndContext
      id={`kanban-${board.id}`}
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      {!readOnly && (
        <div className="mb-3 flex items-center justify-end gap-2">
          {canSuggest && (
            <button
              onClick={runSuggest}
              disabled={suggesting || inbox.length === 0}
              title={inbox.length === 0 ? `No insights in ${firstLane?.title ?? "the first lane"} to triage` : undefined}
              className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 bg-primary-soft px-2.5 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary-soft/70 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {suggesting ? "Suggesting…" : "Suggest lanes"}
            </button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add insights
          </Button>
        </div>
      )}
      {Object.keys(suggestions).length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          <span className="text-[13px] text-foreground">
            {Object.keys(suggestions).length} lane suggestion{Object.keys(suggestions).length === 1 ? "" : "s"} — accept
            them per card, or all at once. Nothing moves until you say so.
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="primary" onClick={applyAllSuggestions}>Apply all</Button>
          <Button size="sm" variant="ghost" onClick={() => setSuggestions({})}>Dismiss all</Button>
        </div>
      )}
      {empty && (
        <p className="mb-3 rounded-lg border border-dashed border-border bg-surface-2 px-4 py-3 text-[13px] text-muted">
          No findings on the board yet.{" "}
          {readOnly ? "Ask a teammate to add insights." : "Use “Add insights” to pull insights into the workflow."}
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            boardId={board.id}
            readOnly={readOnly}
            insights={staged.filter((i) => i.workflowStage === stage.id)}
            spikes={spikes.filter((c) => c.columnId === stage.id)}
            onEditSpike={setEditing}
            onDeleteSpike={onDeleteSpike}
            onRemoveInsight={onRemoveInsight}
            suggestions={suggestions}
            onAcceptSuggestion={acceptSuggestion}
            onDismissSuggestion={dropSuggestion}
          />
        ))}
      </div>
      <DragOverlay>
        {activeInsight ? (
          <div className="w-72 rotate-1 rounded-lg border border-primary bg-surface p-2.5 shadow-lg">
            <InsightCardBody insight={activeInsight} />
          </div>
        ) : activeSpike ? (
          <div className="w-72 rotate-1 rounded-lg border border-primary bg-surface p-2.5 shadow-lg">
            <SpikeCardBody card={activeSpike} />
          </div>
        ) : null}
      </DragOverlay>
      <CardEditDialog card={editing} boardId={board.id} onClose={() => setEditing(null)} />
      <AddInsightsDialog
        open={adding}
        projectId={board.projectId}
        stages={stages}
        defaultStage={firstStageId(stages)}
        onClose={() => setAdding(false)}
      />
    </DndContext>
  );
}
