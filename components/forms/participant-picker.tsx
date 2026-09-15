"use client";

import * as React from "react";
import { Search, X, Building2 } from "lucide-react";
import { participants, getCompany, fullName } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * Searchable participant combobox — filters on name, job title, AND company.
 * Used wherever a participant needs to be chosen (e.g. new interview).
 */
export function ParticipantPicker({
  value,
  onChange,
  autoFocus,
  restrictToIds,
}: {
  value: string; // participant id or ""
  onChange: (id: string) => void;
  autoFocus?: boolean;
  /** When set, only these participants are selectable (e.g. a project's members). */
  restrictToIds?: string[];
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const pool = React.useMemo(
    () => (restrictToIds ? participants.filter((p) => restrictToIds.includes(p.id)) : participants),
    [restrictToIds],
  );
  const selected = participants.find((p) => p.id === value);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? pool.filter((p) => {
          const company = getCompany(p.companyId)?.name ?? "";
          return `${fullName(p)} ${p.jobTitle} ${company}`.toLowerCase().includes(q);
        })
      : pool;
    return list.slice(0, 8);
  }, [query, pool]);

  React.useEffect(() => setActive(0), [query]);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  if (selected) {
    const company = getCompany(selected.companyId);
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-2">
        <Avatar name={fullName(selected)} accent={selected.avatarColor} size="xs" />
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {fullName(selected)}
          <span className="text-subtle"> · {company?.name}</span>
        </span>
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(true);
          }}
          className="rounded p-0.5 text-subtle hover:text-foreground"
          aria-label="Change participant"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
        <input
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (matches[active]) pick(matches[active].id);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search by name, role, or company…"
          className="h-9 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
          role="combobox"
          aria-expanded={open}
        />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-border bg-overlay p-1 shadow-popover">
          {matches.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-xs text-muted">
              {pool.length === 0
                ? restrictToIds
                  ? "No participants in this project yet — add some on the Participants tab first."
                  : "No participants yet — add one in the Participants section first."
                : `No matches for “${query}”.`}
            </p>
          ) : (
            matches.map((p, i) => {
              const company = getCompany(p.companyId);
              return (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(p.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
                    i === active && "bg-surface-hover",
                  )}
                >
                  <Avatar name={fullName(p)} accent={p.avatarColor} size="xs" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-foreground">{fullName(p)}</span>
                    <span className="flex items-center gap-1 truncate text-2xs text-subtle">
                      {p.jobTitle}
                      {company && (
                        <>
                          <span>·</span>
                          <Building2 className="h-2.5 w-2.5" />
                          {company.name}
                        </>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
