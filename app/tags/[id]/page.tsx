"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, MoreHorizontal, Trash2, Users, Lightbulb } from "lucide-react";
import { getTag, participants, insights, fullName } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { AccentPill } from "@/components/ui/accent";
import { EmptyState } from "@/components/ui/empty";
import { MissingRecord } from "@/components/ui/missing-record";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { TagFormModal } from "@/components/forms/taxonomy-forms";
import { InsightCard } from "@/components/domain/insight-card";

const KIND_LABEL: Record<string, string> = {
  "pain-point": "Pain point",
  behaviour: "Behaviour",
  general: "General",
};

export default function TagDetail() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const deleteTag = useApp((s) => s.deleteTag);
  const toast = useApp((s) => s.toast);

  const [showEdit, setShowEdit] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

  const tag = getTag(id);
  if (!tag) {
    if (leaving)
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      );
    return <MissingRecord hydrated={hydrated} />;
  }

  const people = participants.filter(
    (p) => p.behaviourTagIds.includes(tag.id) || p.painPointTagIds.includes(tag.id),
  );
  const tagged = insights.filter((i) => i.tagIds.includes(tag.id));

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Tags", href: "/tags" }, { label: tag.label }]}
        title={tag.label}
        description={`${KIND_LABEL[tag.kind] ?? tag.kind} tag · ${people.length} participant${people.length === 1 ? "" : "s"} · ${tagged.length} insight${tagged.length === 1 ? "" : "s"}`}
        actions={
          canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Menu>
                <MenuTrigger>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => setConfirmDelete(true)}>
                    Delete tag
                  </MenuItem>
                </MenuContent>
              </Menu>
            </>
          ) : undefined
        }
      >
        <div className="flex items-center gap-2 pb-4">
          <AccentPill accent={tag.accent} size="md">{tag.label}</AccentPill>
        </div>
      </PageHeader>

      <PageBody>
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <div>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-muted" /> Participants <span className="text-subtle">({people.length})</span>
            </h2>
            {people.length ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {people.map((p) => (
                  <Link
                    key={p.id}
                    href={`/participants/${p.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 hover:border-border-strong hover:shadow-xs"
                  >
                    <Avatar name={fullName(p)} accent={p.avatarColor} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-foreground">{fullName(p)}</p>
                      <p className="truncate text-xs text-subtle">{p.jobTitle}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No participants" description="No participants carry this tag yet." />
            )}
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
              <Lightbulb className="h-4 w-4 text-muted" /> Insights <span className="text-subtle">({tagged.length})</span>
            </h2>
            {tagged.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {tagged.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
              </div>
            ) : (
              <EmptyState title="No insights" description="No insights are tagged with this yet." />
            )}
          </div>
        </div>
      </PageBody>

      <TagFormModal open={showEdit} onClose={() => setShowEdit(false)} tag={tag} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${tag.label}”`}
        danger
        body={
          people.length > 0 || tagged.length > 0 ? (
            <>
              This tag is used on <strong>{people.length}</strong> participant
              {people.length === 1 ? "" : "s"} and <strong>{tagged.length}</strong> insight
              {tagged.length === 1 ? "" : "s"}. Deleting removes it everywhere — the tagged records
              are kept. This cannot be undone.
            </>
          ) : (
            <>This tag isn&apos;t used anywhere. Deleting it cannot be undone.</>
          )
        }
        confirmLabel="Delete tag"
        onConfirm={() => {
          const label = tag.label;
          setLeaving(true);
          router.push("/tags");
          deleteTag(tag.id);
          toast(`Tag “${label}” deleted`, "info");
        }}
      />
    </>
  );
}
