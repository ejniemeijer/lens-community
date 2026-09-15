"use client";

import * as React from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A compact searchable dropdown (single-select) for filter bars — behaves like
 * a native <select> but with a type-to-filter search box in the popup.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  allLabel = "All",
  placeholder = "Search…",
  className,
}: {
  options: SelectOption[];
  value: string; // "all" or an option value
  onChange: (value: string) => void;
  allLabel?: string;
  placeholder?: string;
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
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  React.useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
    else setQuery("");
  }, [open]);

  const current = value === "all" ? allLabel : options.find((o) => o.value === value)?.label ?? allLabel;
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 items-center gap-2 rounded-md border bg-surface px-2.5 text-sm text-foreground transition-colors",
          open ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-border-strong",
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={cn("truncate", value === "all" && "text-muted")}>{current}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-subtle" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1 w-56 overflow-hidden rounded-lg border border-border bg-overlay shadow-popover">
          <div className="flex items-center gap-2 border-b border-border px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-subtle" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-9 w-full bg-transparent text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            <Option label={allLabel} active={value === "all"} onClick={() => pick("all")} />
            {filtered.map((o) => (
              <Option key={o.value} label={o.label} active={value === o.value} onClick={() => pick(o.value)} />
            ))}
            {filtered.length === 0 && (
              <p className="px-2.5 py-3 text-center text-xs text-muted">No matches.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]",
        active ? "bg-surface-hover font-medium text-foreground" : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
    </button>
  );
}
