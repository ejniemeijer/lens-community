"use client";

import * as React from "react";
import type { Insight } from "@/lib/types";
import { interviews, currentUserId, getInterview } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { uid } from "@/lib/utils";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    {children}
  </div>
);

/**
 * Basic create/edit dialog — just title, description, and (for new insights) an
 * optional source interview. Everything else (type, priority, product area,
 * themes, tags, personas, projects, evidence) is edited inline on the insight
 * page, so capturing a finding stays fast and the detail work happens in place.
 */
export function InsightFormModal({
  open,
  onClose,
  insight,
  initialText,
  initialProjectId,
  initialInterviewId,
}: {
  open: boolean;
  onClose: () => void;
  insight?: Insight;
  /** Optional seed text, e.g. from a transcript highlight. */
  initialText?: string;
  /** Pre-link the new insight to this project (e.g. created from a project's Insights tab). */
  initialProjectId?: string;
  /** Pre-link the new insight to this source interview (links its participant + projects too). */
  initialInterviewId?: string;
}) {
  const addInsight = useApp((s) => s.addInsight);
  const updateInsight = useApp((s) => s.updateInsight);
  const toast = useApp((s) => s.toast);

  const empty = React.useMemo(() => ({ title: "", description: "", interviewId: "" }), []);
  const [f, setF] = React.useState(empty);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setError("");
    if (insight) {
      setF({ title: insight.title, description: insight.description, interviewId: "" });
    } else {
      setF({ title: "", description: initialText ?? "", interviewId: initialInterviewId ?? "" });
    }
  }, [open, insight, initialText, initialInterviewId, empty]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    if (!f.title.trim()) return setError("Title is required.");
    if (!f.description.trim()) return setError("Description is required.");

    if (insight) {
      updateInsight(insight.id, { title: f.title.trim(), description: f.description.trim() });
      toast("Insight updated");
    } else {
      const sourceIv = f.interviewId ? getInterview(f.interviewId) : undefined;
      addInsight({
        id: uid("in"),
        title: f.title.trim(),
        description: f.description.trim(),
        evidence: "",
        type: "insight",
        // Priority left unrated; classification/links added on the insight page.
        productArea: "Platform",
        themeIds: [],
        tagIds: [],
        personaIds: [],
        createdDate: new Date().toISOString().slice(0, 10),
        createdById: currentUserId,
        participantIds: sourceIv ? [sourceIv.participantId] : [],
        interviewIds: sourceIv ? [sourceIv.id] : [],
        projectIds: [
          ...new Set([
            ...(initialProjectId ? [initialProjectId] : []),
            ...(sourceIv ? sourceIv.projectIds : []),
          ]),
        ],
      });
      toast(`Insight “${f.title.trim()}” captured`);
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={insight ? "Edit insight" : "New insight"}
      description={
        insight
          ? "Edit the title and description. Set type, priority, tags and links on the page."
          : "Capture the finding. Set type, priority, tags and links on the page afterward."
      }
      className="max-w-lg"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{insight ? "Save changes" : "Create insight"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Title *">
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </Field>
        <Field label="Description *">
          <Textarea
            rows={3}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="A one or two sentence summary of the finding…"
          />
        </Field>
        {!insight && (
          <Field label="Source interview (optional)">
            <Select value={f.interviewId} onChange={(e) => set("interviewId", e.target.value)}>
              <option value="">None</option>
              {interviews.map((iv) => (
                <option key={iv.id} value={iv.id}>{iv.title}</option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
