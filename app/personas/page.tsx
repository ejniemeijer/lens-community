"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Lightbulb, Plus, Contact } from "lucide-react";
import { personas, personaParticipants, personaInsights } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/ui/icon";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { PersonaFormModal } from "@/components/forms/taxonomy-forms";

export default function PersonasPage() {
  useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const [showNew, setShowNew] = React.useState(false);
  const [view, setView] = useListView("personas");

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={Contact} />}
        title="Personas"
        description="The archetypes your research is built around. Each links to the people and insights that shape it."
        actions={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New persona
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <span className="ml-auto text-xs text-subtle">{personas.length} personas</span>
          <ListViewToggle view={view} onChange={setView} />
        </div>
      </PageHeader>
      <PageBody>
        {view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {personas.map((p) => {
              const people = personaParticipants(p.id);
              const ins = personaInsights(p.id);
              return (
                <Link
                  key={p.id}
                  href={`/personas/${p.id}`}
                  className={`accent-${p.accent} group relative flex flex-col rounded-lg border border-border bg-surface p-5 shadow-xs transition-all hover:border-border-strong hover:shadow-md`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]">
                      <DynamicIcon name={p.icon} className="h-5 w-5" />
                    </span>
                    <h3 className="font-semibold text-foreground group-hover:text-primary">{p.name}</h3>
                  </div>
                  <p className="flex-1 text-[13px] leading-relaxed text-muted">{p.description}</p>
                  <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-2xs text-subtle">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{people.length} participants</span>
                    <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" />{ins.length} insights</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {personas.map((p) => {
              const people = personaParticipants(p.id);
              const ins = personaInsights(p.id);
              return (
                <Link
                  key={p.id}
                  href={`/personas/${p.id}`}
                  className={`accent-${p.accent} group flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-hover`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]">
                    <DynamicIcon name={p.icon} className="h-4 w-4" />
                  </span>
                  <span className="w-44 shrink-0 truncate text-[13px] font-medium text-foreground group-hover:text-primary">{p.name}</span>
                  <span className="hidden flex-1 truncate text-[13px] text-muted sm:block">{p.description}</span>
                  <span className="flex shrink-0 items-center gap-3 text-2xs text-subtle">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{people.length}</span>
                    <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" />{ins.length}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>

      <PersonaFormModal open={showNew} onClose={() => setShowNew(false)} />
    </>
  );
}
