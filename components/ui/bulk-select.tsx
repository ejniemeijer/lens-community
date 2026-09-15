"use client";

import * as React from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared multi-select + bulk-delete plumbing for the list pages
 * (participants, interviews, insights). A page owns one `useBulkSelect()`,
 * wraps each item in `<SelectableItem>`, and renders a `<BulkBar>`.
 */
export function useBulkSelect() {
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());

  const toggle = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectOnly = React.useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clear = React.useCallback(() => setSelected(new Set()), []);
  const start = React.useCallback(() => setSelecting(true), []);
  const stop = React.useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);

  return {
    selecting,
    selected,
    count: selected.size,
    isSelected: (id: string) => selected.has(id),
    toggle,
    selectOnly,
    clear,
    start,
    stop,
  };
}

/** The little checkbox square used on rows and cards. */
export function CheckBox({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        checked ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface",
        className,
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </span>
  );
}

/**
 * Wraps a list row or card so it becomes a selection target while `selecting`.
 * When not selecting it renders the child untouched. While selecting, the
 * child's own links/buttons are disabled (pointer-events-none) and clicking
 * anywhere toggles selection.
 */
export function SelectableItem({
  id,
  selecting,
  selected,
  onToggle,
  variant = "row",
  children,
}: {
  id: string;
  selecting: boolean;
  selected: boolean;
  onToggle: (id: string) => void;
  variant?: "row" | "card";
  children: React.ReactNode;
}) {
  if (!selecting) return <>{children}</>;
  const activate = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(id);
  };
  return (
    <div
      role="checkbox"
      aria-checked={selected}
      tabIndex={0}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") activate(e);
      }}
      className={cn(
        "relative cursor-pointer",
        variant === "card"
          ? cn("rounded-xl", selected && "ring-2 ring-primary ring-offset-2 ring-offset-canvas")
          : cn("border-b border-border last:border-b-0", selected && "bg-primary-soft"),
      )}
    >
      <span
        className={cn(
          "absolute z-10",
          variant === "card" ? "left-3 top-3" : "left-3 top-1/2 -translate-y-1/2",
        )}
      >
        <CheckBox checked={selected} />
      </span>
      <div className={cn("pointer-events-none", variant === "row" && "pl-9")}>{children}</div>
    </div>
  );
}

/** Floating bar shown while one or more items are selected. */
export function BulkBar({
  count,
  noun,
  allSelected,
  onToggleAll,
  onClear,
  onCancel,
  onDelete,
}: {
  count: number;
  noun: string;
  allSelected: boolean;
  onToggleAll: () => void;
  onClear: () => void;
  /** Exit selection mode entirely (Clear only empties the selection). */
  onCancel: () => void;
  onDelete: () => void;
}) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-surface/95 py-2 pl-4 pr-2 shadow-lg backdrop-blur">
        <span className="mr-1 text-[13px] font-medium text-foreground">
          {count} {noun}
          {count === 1 ? "" : "s"} selected
        </span>
        <button
          onClick={onToggleAll}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <button
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground"
        >
          Clear
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground"
        >
          Cancel
        </button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>
    </div>
  );
}
