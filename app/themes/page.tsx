"use client";

import * as React from "react";
import Link from "next/link";
import { Lightbulb, ArrowRight, Plus, Layers } from "lucide-react";
import { themes, themeInsights } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccentBar } from "@/components/ui/accent";
import { HighlightKindBadge } from "@/components/domain/badges";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { ThemeFormModal } from "@/components/forms/taxonomy-forms";

export default function ThemesPage() {
  useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const [showNew, setShowNew] = React.useState(false);
  const [view, setView] = useListView("themes");

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={Layers} />}
        title="Themes"
        description="Cross-cutting patterns that connect insights across projects and personas."
        actions={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New theme
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <span className="ml-auto text-xs text-subtle">{themes.length} themes</span>
          <ListViewToggle view={view} onChange={setView} />
        </div>
      </PageHeader>
      <PageBody>
        {view === "cards" ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {themes.map((t) => {
              const ins = themeInsights(t.id);
              return (
                <Card key={t.id} className="group flex flex-col p-5">
                  <div className="mb-2 flex items-center gap-2.5">
                    <AccentBar accent={t.accent} className="h-5 w-1.5 rounded-full" />
                    <Link href={`/themes/${t.id}`} className="font-semibold text-foreground hover:text-primary">
                      {t.name}
                    </Link>
                  </div>
                  <p className="text-[13px] text-muted">{t.description}</p>
                  <div className="mt-3 flex items-center gap-4 text-2xs text-subtle">
                    <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" />{ins.length} insights</span>
                  </div>
                  {ins.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
                      {ins.slice(0, 3).map((i) => (
                        <Link key={i.id} href={`/insights/${i.id}`} className="group/row flex items-center gap-2 text-[13px]">
                          <HighlightKindBadge kind={i.type} />
                          <span className="min-w-0 flex-1 truncate text-muted group-hover/row:text-primary">{i.title}</span>
                          <ArrowRight className="h-3 w-3 shrink-0 text-subtle opacity-0 group-hover/row:opacity-100" />
                        </Link>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {themes.map((t) => {
              const ins = themeInsights(t.id);
              return (
                <Link
                  key={t.id}
                  href={`/themes/${t.id}`}
                  className="group flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-hover"
                >
                  <AccentBar accent={t.accent} className="h-5 w-1.5 shrink-0 rounded-full" />
                  <span className="w-52 shrink-0 truncate text-[13px] font-medium text-foreground group-hover:text-primary">{t.name}</span>
                  <span className="hidden flex-1 truncate text-[13px] text-muted sm:block">{t.description}</span>
                  <span className="flex shrink-0 items-center gap-1 text-2xs text-subtle">
                    <Lightbulb className="h-3 w-3" />{ins.length}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </PageBody>

      <ThemeFormModal open={showNew} onClose={() => setShowNew(false)} />
    </>
  );
}
