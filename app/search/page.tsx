"use client";

import * as React from "react";
import Link from "next/link";
import { Search as SearchIcon } from "lucide-react";
import { search, type SearchResult } from "@/lib/db";
import { useDb } from "@/lib/store";
import type { EntityType } from "@/lib/types";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Input } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { AccentDot } from "@/components/ui/accent";
import { cn } from "@/lib/utils";

const TYPES: { value: EntityType; label: string }[] = [
  { value: "participant", label: "Participants" },
  { value: "insight", label: "Insights" },
  { value: "interview", label: "Interviews" },
  { value: "project", label: "Projects" },
  { value: "company", label: "Companies" },
  { value: "theme", label: "Themes" },
  { value: "tag", label: "Tags" },
  { value: "persona", label: "Personas" },
];

const TYPE_LABEL: Record<EntityType, string> = {
  participant: "Participant",
  company: "Company",
  project: "Project",
  interview: "Interview",
  insight: "Insight",
  tag: "Tag",
  theme: "Theme",
  persona: "Persona",
};

export default function SearchPage() {
  const version = useDb();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<Set<EntityType>>(new Set());

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setQuery(q);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const all = React.useMemo(() => search(query), [query, version]);
  const typeCounts = React.useMemo(() => {
    const m = new Map<EntityType, number>();
    for (const r of all) m.set(r.type, (m.get(r.type) ?? 0) + 1);
    return m;
  }, [all]);
  const results = active.size ? all.filter((r) => active.has(r.type)) : all;

  const toggle = (t: EntityType) =>
    setActive((s) => {
      const next = new Set(s);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });

  return (
    <>
      <PageHeader icon={<PageIcon icon={SearchIcon} />} title="Search" description="One search across participants, interviews, transcripts, insights, tags, and themes.">
        <div className="pb-4">
          <div className="relative max-w-xl">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search everything…"
              className="h-11 pl-9 text-[15px]"
            />
          </div>
        </div>
      </PageHeader>

      <PageBody>
        {query.trim() === "" ? (
          <EmptyState icon={<SearchIcon className="h-5 w-5" />} title="Start typing to search" description="Results update as you type. Use the filters to narrow by type." />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_1fr]">
            <div className="flex flex-row flex-wrap gap-1.5 lg:flex-col">
              <button
                onClick={() => setActive(new Set())}
                className={cn("rounded-md px-2.5 py-1.5 text-left text-[13px]", active.size === 0 ? "bg-surface font-medium text-foreground shadow-xs" : "text-muted hover:text-foreground")}
              >
                All results <span className="text-subtle">({all.length})</span>
              </button>
              {TYPES.filter((t) => typeCounts.get(t.value)).map((t) => (
                <button
                  key={t.value}
                  onClick={() => toggle(t.value)}
                  className={cn("flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]", active.has(t.value) ? "bg-surface font-medium text-foreground shadow-xs" : "text-muted hover:text-foreground")}
                >
                  {t.label} <span className="text-subtle">{typeCounts.get(t.value)}</span>
                </button>
              ))}
            </div>

            <div>
              {results.length === 0 ? (
                <EmptyState title={`No results for “${query}”`} description="Try a different term or clear the filters." />
              ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  {results.map((r) => <ResultRow key={`${r.type}-${r.id}`} result={r} label={TYPE_LABEL[r.type]} />)}
                </div>
              )}
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

function ResultRow({ result, label }: { result: SearchResult; label: string }) {
  return (
    <Link href={result.href} className="group flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-hover">
      <AccentDot accent={result.accent ?? "slate"} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{result.title}</p>
        <p className="truncate text-xs text-subtle">{result.subtitle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-2xs font-medium text-subtle">{label}</span>
    </Link>
  );
}
