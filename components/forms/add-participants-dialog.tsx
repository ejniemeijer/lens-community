"use client";

import * as React from "react";
import { Search, Check, Users } from "lucide-react";
import { participants as allParticipants, getCompany, getProject, fullName } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Link existing participants to a project (searchable, multi-select). */
export function AddParticipantsDialog({
  open,
  onClose,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const updateProject = useApp((s) => s.updateProject);
  const toast = useApp((s) => s.toast);
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setPicked(new Set());
    }
  }, [open]);

  const project = getProject(projectId);
  const inProject = new Set(project?.participantIds ?? []);
  const q = query.trim().toLowerCase();
  const candidates = allParticipants
    .filter((p) => !inProject.has(p.id))
    .filter((p) => {
      if (!q) return true;
      const company = getCompany(p.companyId)?.name ?? "";
      return `${fullName(p)} ${p.jobTitle} ${company}`.toLowerCase().includes(q);
    });

  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const add = () => {
    if (!project || picked.size === 0) return;
    updateProject(project.id, {
      participantIds: [...new Set([...project.participantIds, ...picked])],
    });
    toast(`Added ${picked.size} participant${picked.size === 1 ? "" : "s"} to ${project.name}`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add existing participants"
      description="Link people already in your repository to this project."
      className="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={picked.size === 0} onClick={add}>
            Add {picked.size > 0 ? `${picked.size} ` : ""}participant{picked.size === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role, or company…"
            className="pl-8"
          />
        </div>
        <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border">
          {candidates.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-4 py-10 text-center">
              <Users className="h-5 w-5 text-subtle" />
              <p className="text-[13px] text-muted">
                {allParticipants.length === 0
                  ? "No participants yet — create one below."
                  : "Everyone matching is already on this project."}
              </p>
            </div>
          ) : (
            candidates.map((p) => {
              const company = getCompany(p.companyId);
              const on = picked.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center gap-2.5 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-surface-hover"
                >
                  <Avatar name={fullName(p)} accent={p.avatarColor} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{fullName(p)}</span>
                    <span className="block truncate text-xs text-subtle">{p.jobTitle}{company ? ` · ${company.name}` : ""}</span>
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border",
                      on ? "border-primary bg-primary text-primary-fg" : "border-border-strong",
                    )}
                  >
                    {on && <Check className="h-3.5 w-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
