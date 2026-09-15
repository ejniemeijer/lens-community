"use client";

import * as React from "react";
import type { Attachment, Interview } from "@/lib/types";
import { projects, users, currentUserId, getParticipant, fullName } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";
import { MultiSelect } from "@/components/ui/multi-select";
import { ParticipantPicker } from "@/components/forms/participant-picker";
import { uid, accentFor } from "@/lib/utils";
import { Paperclip } from "lucide-react";

const Field = ({ label, children, span }: { label: string; children: React.ReactNode; span?: boolean }) => (
  <div className={`flex flex-col gap-1 ${span ? "sm:col-span-2" : ""}`}>
    <Label>{label}</Label>
    {children}
  </div>
);

export function InterviewFormModal({
  open,
  onClose,
  interview,
  initialAttachments,
  initialParticipantId,
  initialProjectId,
}: {
  open: boolean;
  onClose: () => void;
  interview?: Interview;
  /** Prefilled when the flow starts from an upload. */
  initialAttachments?: Attachment[];
  /** Prefilled when starting an interview from a participant profile. */
  initialParticipantId?: string;
  /** Prefilled when starting an interview from a project. */
  initialProjectId?: string;
}) {
  const addInterview = useApp((s) => s.addInterview);
  const updateInterview = useApp((s) => s.updateInterview);
  const toast = useApp((s) => s.toast);
  const requireConsent = useApp((s) => Boolean(s.prefs["gdpr.requireConsent"]));

  const empty = React.useMemo(
    () => ({
      title: "",
      participantId: "",
      projectIds: [] as string[],
      researcherId: currentUserId,
      date: "2026-07-03",
      durationMinutes: 45,
      meetingLink: "",
      hasRecording: true,
    }),
    [],
  );

  const [f, setF] = React.useState(empty);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setError("");
    if (interview) {
      setF({
        title: interview.title,
        participantId: interview.participantId,
        projectIds: interview.projectIds,
        researcherId: interview.researcherId,
        date: interview.date,
        durationMinutes: interview.durationMinutes,
        meetingLink: interview.meetingLink ?? "",
        hasRecording: interview.hasRecording,
      });
    } else {
      setF({
        ...empty,
        participantId: initialParticipantId ?? "",
        projectIds: initialProjectId ? [initialProjectId] : [],
        researcherId: currentUserId,
        title: initialAttachments?.length
          ? `Session — ${initialAttachments[0].name.replace(/\.[^.]+$/, "")}`
          : "",
      });
    }
  }, [open, interview, initialAttachments, initialParticipantId, initialProjectId, empty]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    if (!f.title.trim()) return setError("Title is required.");
    if (!f.participantId) return setError("Pick a participant.");
    if (f.projectIds.length === 0) return setError("Link the interview to at least one project.");

    // GDPR: when the workspace requires explicit consent, block interviews for
    // participants who haven't granted it (toggle in Settings → Consent & GDPR).
    if (requireConsent && !interview) {
      const p = getParticipant(f.participantId);
      if (p && p.consentStatus !== "granted") {
        return setError(
          `${fullName(p)} hasn't granted consent (status: ${p.consentStatus}). Record consent on their profile, or turn off "Require explicit consent" in Settings → Consent & GDPR.`,
        );
      }
    }

    // Basic details only — summary, key observations, and notes are edited
    // directly on the interview page, so we never overwrite them here.
    const base = {
      title: f.title.trim(),
      participantId: f.participantId,
      projectIds: f.projectIds,
      researcherId: f.researcherId,
      date: f.date,
      durationMinutes: Number(f.durationMinutes) || 30,
      meetingLink: f.meetingLink.trim() || undefined,
      hasRecording: f.hasRecording,
    };

    if (interview) {
      updateInterview(interview.id, base);
      toast("Interview updated");
    } else {
      addInterview({
        ...base,
        id: uid("iv"),
        sentiment: "neutral", // set on the interview page after the session
        aiSummary: "",
        keyObservations: [],
        notes: "",
        insightIds: [],
        attachments: initialAttachments ?? [],
        followUps: [],
      });
      toast(
        initialAttachments?.length
          ? `Interview created with ${initialAttachments.length} attachment${initialAttachments.length > 1 ? "s" : ""}`
          : "Interview added — add your summary and notes on the next page",
      );
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={interview ? "Edit interview" : "New interview"}
      className="max-w-2xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{interview ? "Save changes" : "Add interview"}</Button>
        </>
      }
    >
      <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        <Field label="Title *" span><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Participant *" span>
          <ParticipantPicker value={f.participantId} onChange={(id) => set("participantId", id)} />
        </Field>
        <Field label="Researcher">
          <Select value={f.researcherId} onChange={(e) => set("researcherId", e.target.value)}>
            {users.filter((u) => u.role === "researcher" || u.role === "admin").map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Duration (minutes)"><Input type="number" min={5} value={f.durationMinutes} onChange={(e) => set("durationMinutes", Number(e.target.value))} /></Field>
        <Field label="Meeting link"><Input value={f.meetingLink} onChange={(e) => set("meetingLink", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Projects *" span>
          <MultiSelect
            options={projects.map((p) => ({ id: p.id, label: p.name, accent: accentFor(p.id) }))}
            value={f.projectIds}
            onChange={(v) => set("projectIds", v)}
            placeholder="Select projects…"
          />
        </Field>
        {!interview && (
          <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted sm:col-span-2">
            Just the basics for now — add the summary, key observations, notes/transcript, and insights on the
            interview page afterward.
          </p>
        )}
        {initialAttachments && initialAttachments.length > 0 && !interview && (
          <div className="sm:col-span-2">
            <Label>Attached files</Label>
            <div className="mt-1 flex flex-col gap-1.5">
              {initialAttachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px] text-foreground">
                  <Paperclip className="h-3.5 w-3.5 text-subtle" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="text-2xs text-subtle">{a.sizeLabel}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground sm:col-span-2">
          <input type="checkbox" checked={f.hasRecording} onChange={(e) => set("hasRecording", e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
          Recording available
        </label>
      </div>
    </Modal>
  );
}
