"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A group-box card that toggles between a read-only view and an inline editor.
 * The card owns the view/edit toggle + Save/Cancel chrome; the parent owns the
 * draft state and the store patch. For plain free-text use `InlineEditor` inside
 * `editor`; for structured fields render `Input`/`Select`/`MultiCheck` there.
 */
export function EditableCard({
  title,
  icon,
  canEdit = false,
  children,
  editor,
  onEdit,
  onSave,
  onCancel,
  saveLabel = "Save",
  hint,
  headerActions,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  canEdit?: boolean;
  /** Read-only view, shown when not editing. */
  children: React.ReactNode;
  /** Edit inputs, shown when editing (bound to the parent's draft state). */
  editor: React.ReactNode;
  /** Seed the parent's draft from the current value when entering edit mode. */
  onEdit?: () => void;
  /** Persist the parent's draft. Called before the card closes the editor. */
  onSave: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  hint?: string;
  /** Extra controls shown in the header (only while not editing). */
  headerActions?: React.ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);

  const open = () => {
    onEdit?.();
    setEditing(true);
  };
  const save = () => {
    onSave();
    setEditing(false);
  };
  const cancel = () => {
    onCancel?.();
    setEditing(false);
  };

  return (
    <Card className={cn("group p-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        {icon && <span className="text-muted">{icon}</span>}
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {!editing && (
          <div className="ml-auto flex items-center gap-1">
            {headerActions}
            {canEdit && (
              <button
                onClick={open}
                className="rounded-md p-1.5 text-subtle opacity-0 transition hover:bg-surface-hover hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Edit ${title}`}
                title={`Edit ${title.toLowerCase()}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {editing ? (
        <div
          className="flex flex-col gap-3"
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          }}
        >
          {editor}
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={save}>{saveLabel}</Button>
            <Button variant="ghost" size="sm" onClick={cancel}>Cancel</Button>
            <span className="text-2xs text-subtle">
              {hint ? `${hint} · ` : ""}⌘/Ctrl+Enter to save, Esc to cancel
            </span>
          </div>
        </div>
      ) : (
        children
      )}
    </Card>
  );
}
