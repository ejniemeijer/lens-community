"use client";

import * as React from "react";
import { Search, ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-width searchable single-select that can also create a new value by
 * typing — e.g. the participant Company field: pick an existing company or type
 * a brand-new name. Matches the app's Input + SearchableSelect styling.
 */
export function ComboSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else setQuery("");
  }, [open]);

  const q = query.trim();
  const ql = q.toLowerCase();
  const filtered = ql ? options.filter((o) => o.toLowerCase().includes(ql)) : options;
  const exact = options.some((o) => o.toLowerCase() === ql);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-surface px-3 text-sm transition-colors",
          open ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-border-strong",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("truncate", !value && "text-subtle")}>{value || placeholder}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border bg-overlay shadow-popover">
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length) pick(filtered[0]);
                  else if (q) pick(q);
                }
              }}
              placeholder={placeholder}
              className="h-9 w-full bg-transparent text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {q && !exact && (
              <button
                type="button"
                onClick={() => pick(q)}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] text-primary hover:bg-surface-hover"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Create &ldquo;{q}&rdquo;</span>
              </button>
            )}
            {filtered.map((o) => {
              const active = o.toLowerCase() === value.trim().toLowerCase();
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => pick(o)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]",
                    active
                      ? "bg-surface-hover font-medium text-foreground"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
            {filtered.length === 0 && !q && (
              <p className="px-2.5 py-3 text-center text-xs text-muted">No companies yet — type to add one.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
