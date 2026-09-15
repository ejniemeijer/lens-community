"use client";

import * as React from "react";
import type { Participant, Proficiency } from "@/lib/types";
import { companies, getProject } from "@/lib/db";
import { useApp } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { ComboSelect } from "@/components/ui/combo-select";
import { uid, accentFor } from "@/lib/utils";

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    {children}
  </div>
);

/**
 * Slim create / header-edit form. Collects only the participant's identity and
 * contact basics — everything else (professional profile, product usage,
 * classification, research profile, notes) is edited inline on the detail page.
 * On edit it patches only these header fields, so inline edits are never touched.
 */
export function ParticipantFormModal({
  open,
  onClose,
  participant,
  addToProjectId,
}: {
  open: boolean;
  onClose: () => void;
  participant?: Participant;
  /** When creating, also link the new participant to this project. */
  addToProjectId?: string;
}) {
  const addParticipant = useApp((s) => s.addParticipant);
  const updateParticipant = useApp((s) => s.updateParticipant);
  const updateProject = useApp((s) => s.updateProject);
  const addCompany = useApp((s) => s.addCompany);
  const toast = useApp((s) => s.toast);

  const empty = React.useMemo(
    () => ({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      jobTitle: "",
      department: "",
      companyName: "",
      country: "",
      language: "English",
      timezone: "CET",
    }),
    [],
  );

  const [f, setF] = React.useState(empty);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    setError("");
    if (participant) {
      setF({
        firstName: participant.firstName,
        lastName: participant.lastName,
        email: participant.email,
        phone: participant.phone ?? "",
        jobTitle: participant.jobTitle,
        department: participant.department,
        companyName: companies.find((c) => c.id === participant.companyId)?.name ?? "",
        country: participant.country,
        language: participant.language,
        timezone: participant.timezone,
      });
    } else {
      setF(empty);
    }
  }, [open, participant, empty]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return setError("First and last name are required.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return setError("A valid email address is required.");
    if (!f.companyName.trim()) return setError("Company is required.");

    // Find or create the company by name.
    let company = companies.find((c) => c.name.toLowerCase() === f.companyName.trim().toLowerCase());
    if (!company) {
      company = {
        id: uid("co"),
        name: f.companyName.trim(),
        industry: "—",
        // Left unknown, not guessed: the form never asked how big it is.
        country: f.country || "—",
        logoAccent: accentFor(f.companyName),
      };
      addCompany(company);
    }

    // Header fields only — the profile fields are edited inline on the page.
    const header = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim() || undefined,
      jobTitle: f.jobTitle.trim() || "—",
      department: f.department.trim() || "—",
      companyId: company.id,
      country: f.country.trim() || company.country,
      language: f.language,
      timezone: f.timezone,
      industry: company.industry,
      companySize: company.size,
    };

    if (participant) {
      updateParticipant(participant.id, header);
      toast(`${header.firstName} ${header.lastName} updated`);
    } else {
      const id = uid("pt");
      // Start the detail fields blank/neutral rather than guessing — the
      // researcher fills them in on the participant page, so they're never
      // "correcting" an assumed value. (Enums require a value; they default to
      // their lowest/most-neutral option.) consentStatus "pending" and
      // recruitmentStatus "available" are the genuinely-correct state for a
      // brand-new participant, not guesses.
      addParticipant({
        ...header,
        id,
        avatarColor: accentFor(header.firstName + header.lastName),
        yearsExperience: 0,
        seniority: "junior",
        decisionInfluence: "low",
        technicalProficiency: "beginner" as Proficiency,
        digitalMaturity: "beginner" as Proficiency,
        responsibilities: [],
        dailyTasks: [],
        productsUsed: [],
        modulesUsed: [],
        frequency: "rarely",
        device: "desktop",
        usageLevel: "beginner" as Proficiency,
        personaIds: [],
        behaviourTagIds: [],
        painPointTagIds: [],
        consentStatus: "pending",
        ndaSigned: false,
        recordingPermission: false,
        preferredLanguage: f.language,
        availability: "",
        recruitmentStatus: "available",
        interviewCount: 0,
      });
      if (addToProjectId) {
        const project = getProject(addToProjectId);
        if (project)
          updateProject(addToProjectId, {
            participantIds: [...new Set([...project.participantIds, id])],
          });
      }
      toast(
        addToProjectId
          ? `${header.firstName} ${header.lastName} added to the project`
          : `${header.firstName} ${header.lastName} added to the repository`,
      );
    }
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={participant ? "Edit participant" : "New participant"}
      description={
        participant
          ? "Update the participant's identity and contact details."
          : "Just the essentials — add contact details, profile, usage, tags and consent on the participant page afterward."
      }
      className="max-w-xl"
      footer={
        <>
          {error && <p className="mr-auto text-xs text-danger">{error}</p>}
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save}>{participant ? "Save changes" : "Add participant"}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Row>
          {/* Essentials — always shown, enough to create a findable participant. */}
          <Field label="First name *"><Input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
          <Field label="Last name *"><Input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
          <Field label="Email *"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Job title"><Input value={f.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder="Optional" /></Field>
          <Field label="Company *">
            <ComboSelect
              value={f.companyName}
              onChange={(v) => set("companyName", v)}
              options={companies.map((c) => c.name)}
              placeholder="Pick or type a new one"
            />
          </Field>
          {/* Contact & locale — only when editing an existing participant; on
              create they're left out (add them later on the participant page). */}
          {participant && (
            <>
              <Field label="Phone"><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Department"><Input value={f.department} onChange={(e) => set("department", e.target.value)} /></Field>
              <Field label="Country"><Input value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
              <Field label="Language"><Input value={f.language} onChange={(e) => set("language", e.target.value)} /></Field>
              <Field label="Timezone"><Input value={f.timezone} onChange={(e) => set("timezone", e.target.value)} /></Field>
            </>
          )}
        </Row>
      </div>
    </Modal>
  );
}
