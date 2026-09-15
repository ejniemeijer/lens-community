"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, History, CornerDownLeft, ArrowRight, X } from "lucide-react";
import { useApp, useDb } from "@/lib/store";
import { search as globalSearch, type SearchResult } from "@/lib/db";
import type { EntityType } from "@/lib/types";
import { navItemsFor } from "./nav-config";
import { Kbd } from "@/components/ui/misc";
import { AccentDot } from "@/components/ui/accent";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  participant: "Participant",
  company: "Company",
  project: "Project",
  interview: "Interview",
  insight: "Insight",
  tag: "Tag",
  theme: "Theme",
  persona: "Persona",
};

/** Teams-style filter chips shown at the top of the popup. */
const CHIPS: { value: EntityType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "participant", label: "Participants" },
  { value: "project", label: "Projects" },
  { value: "interview", label: "Interviews" },
  { value: "insight", label: "Insights" },
];

interface Row {
  key: string;
  kind: "nav" | "result" | "recent" | "all";
  label: string;
  sublabel?: string;
  href?: string;
  accent?: string;
  icon?: React.ComponentType<{ className?: string }>;
  query?: string; // for recent rows
}

export function TopbarSearch() {
  useDb();
  const router = useRouter();
  const role = useApp((s) => s.role);
  const recentSearches = useApp((s) => s.recentSearches);
  const addRecentSearch = useApp((s) => s.addRecentSearch);
  const cmdkOpen = useApp((s) => s.cmdkOpen);
  const setCmdkOpen = useApp((s) => s.setCmdkOpen);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [chip, setChip] = React.useState<EntityType | "all">("all");
  const [active, setActive] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // ⌘K focuses the field.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCmdkOpen]);

  React.useEffect(() => {
    if (cmdkOpen) {
      inputRef.current?.focus();
      setOpen(true);
      setCmdkOpen(false);
    }
  }, [cmdkOpen, setCmdkOpen]);

  // Close on outside click.
  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const rows: Row[] = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: Row[] = [];

    if (!q) {
      for (const r of recentSearches.slice(0, 4)) {
        out.push({ key: `recent-${r}`, kind: "recent", label: r, icon: History, query: r });
      }
      for (const n of navItemsFor(role)) {
        out.push({ key: `nav-${n.href}`, kind: "nav", label: n.label, href: n.href, icon: n.icon });
      }
      return out;
    }

    for (const n of navItemsFor(role).filter((n) => n.label.toLowerCase().includes(q))) {
      out.push({ key: `nav-${n.href}`, kind: "nav", label: n.label, href: n.href, icon: n.icon });
    }
    const results = globalSearch(query).filter((r) => chip === "all" || r.type === chip);
    for (const r of results.slice(0, 10)) {
      out.push({
        key: `${r.type}-${r.id}`,
        kind: "result",
        label: r.title,
        sublabel: `${TYPE_LABEL[r.type]} · ${r.subtitle}`,
        href: r.href,
        accent: r.accent,
      });
    }
    out.push({ key: "see-all", kind: "all", label: `See all results for “${query.trim()}”` });
    return out;
  }, [query, chip, recentSearches, role]);

  React.useEffect(() => setActive(0), [query, chip]);

  const go = (row?: Row) => {
    const target = row ?? rows[active];
    if (!target) return;
    if (target.kind === "recent") {
      setQuery(target.query ?? "");
      inputRef.current?.focus();
      return;
    }
    if (query.trim()) addRecentSearch(query.trim());
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    if (target.kind === "all") {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    } else if (target.href) {
      router.push(target.href);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go();
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  let lastKind: Row["kind"] | null = null;
  const groupTitle = (kind: Row["kind"]) =>
    kind === "recent" ? "Recent" : kind === "nav" ? "Go to" : kind === "result" ? "Results" : null;

  return (
    <div ref={rootRef} className="relative w-full max-w-2xl">
      {/* Field */}
      <div
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg border bg-surface px-3 transition-colors",
          open ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-border-strong",
        )}
      >
        <Search className="h-4 w-4 shrink-0 text-subtle" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search participants, insights, interviews, and more"
          className="h-full w-full bg-transparent text-[13px] text-foreground placeholder:text-subtle focus:outline-none"
          role="combobox"
          aria-expanded={open}
          aria-label="Global search"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="rounded p-0.5 text-subtle hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          !open && <Kbd className="shrink-0">⌘K</Kbd>
        )}
      </div>

      {/* Anchored popup — pinned to the field's own edges (inset-x-0) so it
          can never drift; opacity-only animation avoids transform conflicts. */}
      {open && (
        <div className="absolute inset-x-0 top-full z-[90] mt-1.5 animate-fade-in overflow-hidden rounded-xl border border-border bg-overlay shadow-popover">
          {/* Type chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border px-3 py-2.5 no-scrollbar">
            {CHIPS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  setChip(c.value);
                  inputRef.current?.focus();
                }}
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  chip === c.value
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="max-h-[48vh] overflow-y-auto p-1.5">
            {rows.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-muted">Nothing found for “{query}”.</p>
            )}
            {rows.map((row, i) => {
              const title = row.kind !== lastKind ? groupTitle(row.kind) : null;
              lastKind = row.kind;
              const Icon = row.icon;
              return (
                <React.Fragment key={row.key}>
                  {title && (
                    <p className="px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-subtle">
                      {title}
                    </p>
                  )}
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(row)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left",
                      active === i && "bg-surface-hover",
                      row.kind === "all" && "text-primary",
                    )}
                  >
                    {Icon ? (
                      <Icon className="h-4 w-4 shrink-0 text-muted" />
                    ) : row.kind === "all" ? (
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    ) : (
                      <AccentDot accent={row.accent ?? "slate"} />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[13px]", row.kind === "all" ? "font-medium" : "text-foreground")}>
                        {row.label}
                      </span>
                      {row.sublabel && (
                        <span className="block truncate text-xs text-subtle">{row.sublabel}</span>
                      )}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-2xs text-subtle">
            <span className="flex items-center gap-1">↑↓ navigate</span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> open
            </span>
            <span className="ml-auto">Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}
