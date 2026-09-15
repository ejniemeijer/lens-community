"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { tags, participants, insights } from "@/lib/db";
import type { TagKind } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody, PageIcon } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccentPill } from "@/components/ui/accent";
import { useListView, ListViewToggle } from "@/components/ui/list-view";
import { TagFormModal } from "@/components/forms/taxonomy-forms";

function usage(tagId: string) {
  const p = participants.filter(
    (x) => x.behaviourTagIds.includes(tagId) || x.painPointTagIds.includes(tagId),
  ).length;
  const i = insights.filter((x) => x.tagIds.includes(tagId)).length;
  return { participants: p, insights: i, total: p + i };
}

const SECTIONS: { kind: TagKind; title: string; description: string }[] = [
  { kind: "pain-point", title: "Pain point tags", description: "Recurring problems users encounter." },
  { kind: "behaviour", title: "Behaviour tags", description: "How participants tend to work and think." },
  { kind: "general", title: "General tags", description: "Workflow and triage labels." },
];
const KIND_LABEL: Record<TagKind, string> = { "pain-point": "Pain point", behaviour: "Behaviour", general: "General" };

export default function TagsPage() {
  useDb();
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const [showNew, setShowNew] = React.useState(false);
  const [view, setView] = useListView("tags");

  return (
    <>
      <PageHeader
        icon={<PageIcon icon={Tag} />}
        title="Tags"
        description="A shared vocabulary for coding research — click a tag to see the insights it's applied to."
        actions={
          canManage ? (
            <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" /> New tag
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          <span className="ml-auto text-xs text-subtle">{tags.length} tags</span>
          <ListViewToggle view={view} onChange={setView} />
        </div>
      </PageHeader>
      <PageBody>
        {view === "cards" ? (
          <div className="flex flex-col gap-5">
            {SECTIONS.map((section) => {
              const list = tags
                .filter((t) => t.kind === section.kind)
                .map((t) => ({ tag: t, count: usage(t.id).total }))
                .sort((a, b) => b.count - a.count);
              return (
                <Card key={section.kind} className="p-5">
                  <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                  <p className="mb-4 text-[13px] text-subtle">{section.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {list.map(({ tag, count }) => (
                      <Link key={tag.id} href={`/tags/${tag.id}`} title={`Open “${tag.label}”`}>
                        <AccentPill accent={tag.accent} size="md">
                          {tag.label}
                          <span className="ml-1 rounded-full bg-[hsl(var(--a-solid)/0.2)] px-1.5 text-2xs font-semibold">{count}</span>
                        </AccentPill>
                      </Link>
                    ))}
                    {list.length === 0 && (
                      <p className="text-xs text-subtle">No {section.title.toLowerCase()} yet.</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {[...tags]
              .map((t) => ({ tag: t, u: usage(t.id) }))
              .sort((a, b) => b.u.total - a.u.total)
              .map(({ tag, u }) => (
                <Link
                  key={tag.id}
                  href={`/tags/${tag.id}`}
                  className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 hover:bg-surface-hover"
                >
                  <AccentPill accent={tag.accent} size="sm">{tag.label}</AccentPill>
                  <span className="hidden text-2xs uppercase tracking-wide text-subtle sm:block">{KIND_LABEL[tag.kind]}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-3 text-2xs text-subtle">
                    <span>{u.participants} participants</span>
                    <span>{u.insights} insights</span>
                  </span>
                </Link>
              ))}
          </div>
        )}
      </PageBody>

      <TagFormModal open={showNew} onClose={() => setShowNew(false)} />
    </>
  );
}
