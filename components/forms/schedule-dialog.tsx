"use client";

import * as React from "react";
import type { Participant } from "@/lib/types";
import { projects, currentUserId, fullName } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";

export function ScheduleDialog({
  open,
  onClose,
  participant,
}: {
  open: boolean;
  onClose: () => void;
  participant: Participant;
}) {
  const scheduleInterview = useApp((s) => s.scheduleInterview);
  const toast = useApp((s) => s.toast);
  const requireConsent = useApp((s) => Boolean(s.prefs["gdpr.requireConsent"]));
  // GDPR: block scheduling an interview when the workspace requires explicit
  // consent and this participant hasn't granted it.
  const consentBlocked = requireConsent && participant.consentStatus !== "granted";
  const active = projects.filter((p) => !["completed", "on-hold"].includes(p.status));
  const projectOptions = active.length ? active : projects;

  const [title, setTitle] = React.useState("");
  const [projectId, setProjectId] = React.useState("");
  const [date, setDate] = React.useState("2026-07-10");
  const [time, setTime] = React.useState("10:00");
  const [durationMinutes, setDurationMinutes] = React.useState(45);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setTitle(`Interview with ${fullName(participant)}`);
    setProjectId(projectOptions[0]?.id ?? "");
    setDate("2026-07-10");
    setTime("10:00");
    setDurationMinutes(45);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, participant]);

  const confirm = () => {
    if (!title.trim()) return setError("Give the session a title.");
    if (!projectId) return setError("Pick a project for this interview.");
    if (consentBlocked) {
      return setError(
        `${fullName(participant)} hasn't granted consent (status: ${participant.consentStatus}). Record consent on their profile, or turn off "Require explicit consent" in Settings → Consent & GDPR.`,
      );
    }
    scheduleInterview(participant.id, {
      title: title.trim(),
      projectId,
      date,
      time,
      durationMinutes: Number(durationMinutes) || 45,
      researcherId: currentUserId,
    });
    toast(`Interview with ${fullName(participant)} scheduled for ${date} at ${time} — added to Interviews`);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Schedule ${fullName(participant)}`}
      description="This books the session and creates a scheduled interview in the Interviews list, ready to fill in afterward."
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={confirm} disabled={consentBlocked}>Schedule interview</Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>Interview title *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label>Project *</Label>
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="" disabled>Select a project…</option>
            {projectOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <p className="text-xs text-subtle">The participant is added to this project automatically.</p>
        </div>
        <div className="flex flex-col gap-1">
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Time ({participant.timezone})</Label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>Duration (minutes)</Label>
          <Input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))} />
        </div>
        <div className="flex items-end">
          <p className="text-xs text-subtle">Researcher: you</p>
        </div>
        {consentBlocked && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger sm:col-span-2">
            {fullName(participant)} hasn&apos;t granted consent (status: {participant.consentStatus}). Record consent on
            their profile, or turn off &ldquo;Require explicit consent&rdquo; in Settings → Consent &amp; GDPR.
          </p>
        )}
        {!participant.recordingPermission && (
          <p className="rounded-md bg-warning-soft px-3 py-2 text-xs text-warning sm:col-span-2">
            This participant has not granted recording permission — plan for notes only.
          </p>
        )}
      </div>
    </Modal>
  );
}
