"use client";

import * as React from "react";
import type { ProjectStatus, ResearchProject } from "@/lib/types";
import { users, currentUserId } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { MultiCheck } from "@/components/ui/multi-check";
import { uid } from "@/lib/utils";

const Field = ({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) => (
  <div className={`flex flex-col gap-1 ${span ? "sm:col-span-2" : ""}`}>
    <Label>{label}</Label>
    {children}
  </div>
);

const STATUSES: ProjectStatus[] = ["planning", "recruiting", "in-progress", "analysis", "completed", "on-hold"];

export function ProjectFormModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project?: ResearchProject;
}) {
  const addProject = useApp((s) => s.addProject);
  const updateProject = useApp((s) => s.updateProject);
  const toast = useApp((s) => s.toast);

  const empty = React.useMemo(
    () => ({
      name: "",
      description: "",
      productArea: "",
      status: "planning" as ProjectStatus,
      startDate: "2026-07-06",
      endDate: "2026-09-30",
      ownerId: currentUserId,
      memberIds: [currentUserId] as string[],
      methodology: "Semi-structured interviews",
    }),
    [],
  );

  const [f, setF] = React.useState(empty);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setError("");
    if (project) {
      setF({
        name: project.name,
        description: project.description,
        productArea: project.productArea,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        ownerId: project.ownerId,
        memberIds: project.memberIds,
        methodology: project.methodology,
      });
    } else setF(empty);
  }, [open, project, empty]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    if (!f.name.trim()) return setError("Project name is required.");
    if (!f.productArea.trim()) return setError("Product area is required.");

    // Header / setup fields only — objective, research questions and success
    // criteria are edited inline on the project page.
    const base = {
      name: f.name.trim(),
      description: f.description.trim(),
      productArea: f.productArea.trim(),
      status: f.status,
      startDate: f.startDate,
      endDate: f.endDate,
      ownerId: f.ownerId,
      memberIds: f.memberIds.length ? f.memberIds : [f.ownerId],
      methodology: f.methodology.trim() || "Interviews",
    };

    if (project) {
      updateProject(project.id, base);
      toast(`“${base.name}” updated`);
    } else {
      addProject({
        ...base,
        id: uid("pr"),
        objective: "",
        researchQuestions: [],
        successCriteria: [],
        participantIds: [],
      });
      toast(`Project “${base.name}” created`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New research project"}
      description={
        project
          ? undefined
          : "Set up the essentials — add the objective, research questions and success criteria on the project page afterward."
      }
      className="max-w-2xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{project ? "Save changes" : "Create project"}</Button>
        </>
      }
    >
      <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        <Field label="Name *" span><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Description" span><Textarea rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Product area *"><Input value={f.productArea} onChange={(e) => set("productArea", e.target.value)} placeholder="e.g. Mobile" /></Field>
        <Field label="Status">
          <Select value={f.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("-", " ")}</option>)}
          </Select>
        </Field>
        <Field label="Start date"><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
        <Field label="End date"><Input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
        <Field label="Research owner">
          <Select value={f.ownerId} onChange={(e) => set("ownerId", e.target.value)}>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
        </Field>
        <Field label="Methodology"><Input value={f.methodology} onChange={(e) => set("methodology", e.target.value)} /></Field>
        <Field label="Team members" span>
          <MultiCheck
            options={users.map((u) => ({ id: u.id, label: u.name }))}
            value={f.memberIds}
            onChange={(v) => set("memberIds", v)}
          />
        </Field>
      </div>
    </Modal>
  );
}
