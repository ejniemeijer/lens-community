"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, MoreHorizontal, Trash2, Users, Lightbulb } from "lucide-react";
import { getPersona, personaParticipants, personaInsights, fullName } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { DynamicIcon } from "@/components/ui/icon";
import { EditableCard } from "@/components/ui/editable-card";
import { Textarea } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/empty";
import { MissingRecord } from "@/components/ui/missing-record";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { PersonaFormModal } from "@/components/forms/taxonomy-forms";
import { InsightCard } from "@/components/domain/insight-card";

export default function PersonaDetail() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const updatePersona = useApp((s) => s.updatePersona);
  const deletePersona = useApp((s) => s.deletePersona);
  const toast = useApp((s) => s.toast);

  const [showEdit, setShowEdit] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);
  const [description, setDescription] = React.useState("");

  const persona = getPersona(id);
  if (!persona) {
    if (leaving)
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      );
    return <MissingRecord hydrated={hydrated} />;
  }

  const people = personaParticipants(persona.id);
  const insights = personaInsights(persona.id);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Personas", href: "/personas" }, { label: persona.name }]}
        icon={
          <span className={`accent-${persona.accent} flex h-11 w-11 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]`}>
            <DynamicIcon name={persona.icon} className="h-5 w-5" />
          </span>
        }
        title={persona.name}
        description={`${people.length} participant${people.length === 1 ? "" : "s"} · ${insights.length} insight${insights.length === 1 ? "" : "s"}`}
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
                    Delete persona
                  </MenuItem>
                </MenuContent>
              </Menu>
            </>
          ) : undefined
        }
      />

      <PageBody>
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          <EditableCard
            title="Description"
            canEdit={canManage}
            onEdit={() => setDescription(persona.description)}
            onSave={() => updatePersona(persona.id, { description: description.trim() })}
            editor={
              <Textarea
                autoFocus
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who is this person, and what do they care about?"
              />
            }
          >
            {persona.description ? (
              <p className="text-[13px] leading-relaxed text-muted">{persona.description}</p>
            ) : (
              <p className="text-[13px] text-subtle">No description yet.</p>
            )}
          </EditableCard>

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
              <EmptyState title="No participants" description="No participants are assigned this persona yet." />
            )}
          </div>

          {insights.length > 0 && (
            <div>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                <Lightbulb className="h-4 w-4 text-muted" /> Insights <span className="text-subtle">({insights.length})</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {insights.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
              </div>
            </div>
          )}
        </div>
      </PageBody>

      <PersonaFormModal open={showEdit} onClose={() => setShowEdit(false)} persona={persona} />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${persona.name}”`}
        danger
        body={
          people.length > 0 || insights.length > 0 ? (
            <>
              This persona is linked to <strong>{people.length}</strong> participant
              {people.length === 1 ? "" : "s"} and <strong>{insights.length}</strong> insight
              {insights.length === 1 ? "" : "s"}. Deleting removes it everywhere — those records are
              kept. This cannot be undone.
            </>
          ) : (
            <>This persona isn&apos;t used anywhere. Deleting it cannot be undone.</>
          )
        }
        confirmLabel="Delete persona"
        onConfirm={() => {
          const name = persona.name;
          setLeaving(true);
          router.push("/personas");
          deletePersona(persona.id);
          toast(`Persona “${name}” deleted`, "info");
        }}
      />
    </>
  );
}
