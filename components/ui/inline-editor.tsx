"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

/** In-place textarea editor with Save / Cancel — used for editable detail pages. */
export function InlineEditor({
  value,
  onChange,
  onSave,
  onCancel,
  rows = 5,
  placeholder,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  rows?: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Textarea
        autoFocus
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave();
        }}
      />
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={onSave}>Save</Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <span className="text-2xs text-subtle">{hint ? `${hint} · ` : ""}⌘/Ctrl+Enter to save, Esc to cancel</span>
      </div>
    </div>
  );
}
