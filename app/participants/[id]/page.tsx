"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  Building2,
  Globe,
  Clock,
  CalendarPlus,
  Pencil,
  ShieldCheck,
  FileSignature,
  Video,
  Check,
  X,
  MoreHorizontal,
  EyeOff,
  Trash2,
  MessageSquare,
  Briefcase,
  Package,
  Tags as TagsIcon,
  StickyNote,
} from "lucide-react";
import {
  getParticipant,
  getCompany,
  getPersonas,
  getTags,
  getProject,
  participantInterviews,
  participantProjects,
  participantInsights,
  consentFor,
  fullName,
  personas as allPersonas,
  tags as allTags,
} from "@/lib/db";
import type { Company, CompanySize, Participant, Proficiency } from "@/lib/types";
import { useApp, useDb } from "@/lib/store";
import { can } from "@/lib/permissions";
import { PageHeader, PageBody } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { DetailRow, Divider } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { EditableCard } from "@/components/ui/editable-card";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { MultiCheck } from "@/components/ui/multi-check";
import { EmptyState } from "@/components/ui/empty";
import { MissingRecord } from "@/components/ui/missing-record";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { ConfirmDialog } from "@/components/ui/confirm";
import { ParticipantFormModal } from "@/components/forms/participant-form";
import { ScheduleDialog } from "@/components/forms/schedule-dialog";
import {
  PersonaChip,
  TagChip,
  RecruitmentBadge,
  ConsentBadge,
} from "@/components/domain/badges";
import { InterviewRow } from "@/components/interviews/interview-row";
import { InsightCard } from "@/components/domain/insight-card";
import { formatDate } from "@/lib/utils";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1">
    <Label>{label}</Label>
    {children}
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
);

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const commas = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function YesNo({ value }: { value: boolean }) {
  return value ? (
    <Badge tone="success"><Check className="h-3 w-3" /> Yes</Badge>
  ) : (
    <Badge tone="neutral"><X className="h-3 w-3" /> No</Badge>
  );
}

/** A profile attribute: small uppercase label above its value. */
function Attr({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{label}</dt>
      <dd className="mt-1 min-w-0 break-words text-[13px] font-medium text-foreground">{children}</dd>
    </div>
  );
}

const consentTone = { granted: "success", pending: "warning", expired: "danger", withdrawn: "danger" } as const;
const recruitTone = {
  available: "success",
  contacted: "info",
  scheduled: "primary",
  interviewed: "neutral",
  "do-not-contact": "danger",
} as const;

/* ---------------- inline-editable group-boxes ---------------- */

function ClassificationCard({ p, canManage }: { p: Participant; canManage: boolean }) {
  const update = useApp((s) => s.updateParticipant);
  const [personaIds, setPersonaIds] = React.useState(p.personaIds);
  const [behaviourTagIds, setBehaviour] = React.useState(p.behaviourTagIds);
  const [painPointTagIds, setPains] = React.useState(p.painPointTagIds);

  const seed = () => {
    setPersonaIds(p.personaIds);
    setBehaviour(p.behaviourTagIds);
    setPains(p.painPointTagIds);
  };

  const personas = getPersonas(p.personaIds);
  const behaviour = getTags(p.behaviourTagIds);
  const pains = getTags(p.painPointTagIds);
  const empty = personas.length === 0 && behaviour.length === 0 && pains.length === 0;

  return (
    <EditableCard
      title="Personas & tags"
      icon={<TagsIcon className="h-4 w-4" />}
      canEdit={canManage}
      onEdit={seed}
      onSave={() => update(p.id, { personaIds, behaviourTagIds, painPointTagIds })}
      editor={
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Personas</p>
            <MultiCheck
              options={allPersonas.map((pe) => ({ id: pe.id, label: pe.name, accent: pe.accent }))}
              value={personaIds}
              onChange={setPersonaIds}
            />
          </div>
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Behaviour tags</p>
            <MultiCheck
              options={allTags.filter((t) => t.kind === "behaviour").map((t) => ({ id: t.id, label: t.label, accent: t.accent }))}
              value={behaviourTagIds}
              onChange={setBehaviour}
            />
          </div>
          <div>
            <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Pain point tags</p>
            <MultiCheck
              options={allTags.filter((t) => t.kind === "pain-point").map((t) => ({ id: t.id, label: t.label, accent: t.accent }))}
              value={painPointTagIds}
              onChange={setPains}
            />
          </div>
        </div>
      }
    >
      {empty ? (
        <p className="text-[13px] text-subtle">No personas or tags assigned yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {personas.length > 0 && (
            <div>
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Personas</p>
              <div className="flex flex-wrap gap-1.5">
                {personas.map((pe) => <PersonaChip key={pe.id} persona={pe} size="md" />)}
              </div>
            </div>
          )}
          {behaviour.length > 0 && (
            <div>
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Behaviour</p>
              <div className="flex flex-wrap gap-1.5">{behaviour.map((t) => <TagChip key={t.id} tag={t} href="/tags" />)}</div>
            </div>
          )}
          {pains.length > 0 && (
            <div>
              <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Pain points</p>
              <div className="flex flex-wrap gap-1.5">{pains.map((t) => <TagChip key={t.id} tag={t} href="/tags" />)}</div>
            </div>
          )}
        </div>
      )}
    </EditableCard>
  );
}

function ProfessionalProfileCard({ p, canManage }: { p: Participant; canManage: boolean }) {
  const update = useApp((s) => s.updateParticipant);
  const [seniority, setSeniority] = React.useState(p.seniority);
  const [yearsExperience, setYears] = React.useState(String(p.yearsExperience));
  const [decisionInfluence, setDecision] = React.useState(p.decisionInfluence);
  const [technicalProficiency, setTech] = React.useState(p.technicalProficiency);
  const [digitalMaturity, setDigital] = React.useState(p.digitalMaturity);
  const [responsibilities, setResp] = React.useState(p.responsibilities.join("\n"));
  const [dailyTasks, setTasks] = React.useState(p.dailyTasks.join("\n"));

  const seed = () => {
    setSeniority(p.seniority);
    setYears(String(p.yearsExperience));
    setDecision(p.decisionInfluence);
    setTech(p.technicalProficiency);
    setDigital(p.digitalMaturity);
    setResp(p.responsibilities.join("\n"));
    setTasks(p.dailyTasks.join("\n"));
  };

  return (
    <EditableCard
      title="Professional profile"
      icon={<Briefcase className="h-4 w-4" />}
      canEdit={canManage}
      onEdit={seed}
      onSave={() =>
        update(p.id, {
          seniority,
          yearsExperience: Number(yearsExperience) || 0,
          decisionInfluence,
          technicalProficiency,
          digitalMaturity,
          responsibilities: lines(responsibilities),
          dailyTasks: lines(dailyTasks),
        })
      }
      editor={
        <div className="flex flex-col gap-3">
          <Row>
            <Field label="Seniority">
              <Select value={seniority} onChange={(e) => setSeniority(e.target.value as Participant["seniority"])}>
                {["junior", "mid", "senior", "lead", "executive"].map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Years of experience"><Input type="number" min={0} value={yearsExperience} onChange={(e) => setYears(e.target.value)} /></Field>
            <Field label="Decision influence">
              <Select value={decisionInfluence} onChange={(e) => setDecision(e.target.value as Participant["decisionInfluence"])}>
                {["low", "medium", "high"].map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Technical proficiency">
              <Select value={technicalProficiency} onChange={(e) => setTech(e.target.value as Proficiency)}>
                {["beginner", "intermediate", "expert"].map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Digital maturity">
              <Select value={digitalMaturity} onChange={(e) => setDigital(e.target.value as Proficiency)}>
                {["beginner", "intermediate", "expert"].map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
          </Row>
          <Row>
            <Field label="Responsibilities (one per line)"><Textarea rows={3} value={responsibilities} onChange={(e) => setResp(e.target.value)} /></Field>
            <Field label="Daily tasks (one per line)"><Textarea rows={3} value={dailyTasks} onChange={(e) => setTasks(e.target.value)} /></Field>
          </Row>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Attr label="Experience">{p.yearsExperience} {p.yearsExperience === 1 ? "year" : "years"}</Attr>
        <Attr label="Seniority"><span className="capitalize">{p.seniority}</span></Attr>
        <Attr label="Decision influence"><span className="capitalize">{p.decisionInfluence}</span></Attr>
        <Attr label="Technical prof."><span className="capitalize">{p.technicalProficiency}</span></Attr>
        <Attr label="Digital maturity"><span className="capitalize">{p.digitalMaturity}</span></Attr>
      </dl>
      {(p.responsibilities.length > 0 || p.dailyTasks.length > 0) && (
        <>
          <Divider className="my-3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {p.responsibilities.length > 0 && (
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Responsibilities</p>
                <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted">
                  {p.responsibilities.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}
            {p.dailyTasks.length > 0 && (
              <div>
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-subtle">Daily tasks</p>
                <ul className="list-disc space-y-1 pl-4 text-[13px] text-muted">
                  {p.dailyTasks.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </EditableCard>
  );
}

function ProductUsageCard({ p, canManage }: { p: Participant; canManage: boolean }) {
  const update = useApp((s) => s.updateParticipant);
  const [productsUsed, setProducts] = React.useState(p.productsUsed.join(", "));
  const [modulesUsed, setModules] = React.useState(p.modulesUsed.join(", "));
  const [frequency, setFrequency] = React.useState(p.frequency);
  const [device, setDevice] = React.useState(p.device);
  const [usageLevel, setUsage] = React.useState(p.usageLevel);

  const seed = () => {
    setProducts(p.productsUsed.join(", "));
    setModules(p.modulesUsed.join(", "));
    setFrequency(p.frequency);
    setDevice(p.device);
    setUsage(p.usageLevel);
  };

  return (
    <EditableCard
      title="Product usage"
      icon={<Package className="h-4 w-4" />}
      canEdit={canManage}
      onEdit={seed}
      onSave={() =>
        update(p.id, {
          productsUsed: commas(productsUsed),
          modulesUsed: commas(modulesUsed),
          frequency,
          device,
          usageLevel,
        })
      }
      editor={
        <Row>
          <Field label="Products (comma separated)"><Input value={productsUsed} onChange={(e) => setProducts(e.target.value)} /></Field>
          <Field label="Modules (comma separated)"><Input value={modulesUsed} onChange={(e) => setModules(e.target.value)} /></Field>
          <Field label="Frequency">
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value as Participant["frequency"])}>
              {["daily", "weekly", "monthly", "rarely"].map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Primary device">
            <Select value={device} onChange={(e) => setDevice(e.target.value as Participant["device"])}>
              {["desktop", "mobile", "both", "field-mobile"].map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
          <Field label="Skill level">
            <Select value={usageLevel} onChange={(e) => setUsage(e.target.value as Proficiency)}>
              {["beginner", "intermediate", "expert"].map((x) => <option key={x} value={x}>{x}</option>)}
            </Select>
          </Field>
        </Row>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Attr label="Products">{p.productsUsed.join(", ") || "—"}</Attr>
        <Attr label="Modules">{p.modulesUsed.join(", ") || "—"}</Attr>
        <Attr label="Frequency"><span className="capitalize">{p.frequency}</span></Attr>
        <Attr label="Primary device"><span className="capitalize">{p.device.replace("-", " ")}</span></Attr>
        <Attr label="Skill level"><span className="capitalize">{p.usageLevel}</span></Attr>
      </dl>
    </EditableCard>
  );
}

function ResearchProfileCard({ p, canManage }: { p: Participant; canManage: boolean }) {
  const update = useApp((s) => s.updateParticipant);
  const [consentStatus, setConsent] = React.useState(p.consentStatus);
  const [recruitmentStatus, setRecruit] = React.useState(p.recruitmentStatus);
  const [preferredLanguage, setPref] = React.useState(p.preferredLanguage);
  const [availability, setAvail] = React.useState(p.availability);
  const [recordingPermission, setRec] = React.useState(p.recordingPermission);
  const [ndaSigned, setNda] = React.useState(p.ndaSigned);

  const seed = () => {
    setConsent(p.consentStatus);
    setRecruit(p.recruitmentStatus);
    setPref(p.preferredLanguage);
    setAvail(p.availability);
    setRec(p.recordingPermission);
    setNda(p.ndaSigned);
  };

  return (
    <EditableCard
      title="Research profile"
      icon={<ShieldCheck className="h-4 w-4" />}
      canEdit={canManage}
      onEdit={seed}
      onSave={() =>
        update(p.id, {
          consentStatus,
          recruitmentStatus,
          preferredLanguage: preferredLanguage.trim() || "English",
          availability: availability.trim(),
          recordingPermission,
          ndaSigned,
        })
      }
      editor={
        <div className="flex flex-col gap-3">
          <Row>
            <Field label="Consent status">
              <Select value={consentStatus} onChange={(e) => setConsent(e.target.value as Participant["consentStatus"])}>
                {["granted", "pending", "expired", "withdrawn"].map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Recruitment status">
              <Select value={recruitmentStatus} onChange={(e) => setRecruit(e.target.value as Participant["recruitmentStatus"])}>
                {["available", "contacted", "scheduled", "interviewed", "do-not-contact"].map((x) => <option key={x} value={x}>{x}</option>)}
              </Select>
            </Field>
            <Field label="Preferred language"><Input value={preferredLanguage} onChange={(e) => setPref(e.target.value)} /></Field>
            <Field label="Availability"><Input value={availability} onChange={(e) => setAvail(e.target.value)} placeholder="e.g. Tue/Thu mornings" /></Field>
          </Row>
          <div className="flex items-center gap-5">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input type="checkbox" checked={recordingPermission} onChange={(e) => setRec(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              Recording permitted
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
              <input type="checkbox" checked={ndaSigned} onChange={(e) => setNda(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
              NDA signed
            </label>
          </div>
        </div>
      }
    >
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Attr label="Consent">
          <Badge tone={consentTone[p.consentStatus]} dot><span className="capitalize">{p.consentStatus}</span></Badge>
        </Attr>
        <Attr label="Recruitment">
          <Badge tone={recruitTone[p.recruitmentStatus]} dot><span className="capitalize">{p.recruitmentStatus.replace("-", " ")}</span></Badge>
        </Attr>
        <Attr label="Preferred language">{p.preferredLanguage}</Attr>
        <Attr label="Availability">{p.availability || "—"}</Attr>
        <Attr label="Recording"><YesNo value={p.recordingPermission} /></Attr>
        <Attr label="NDA signed"><YesNo value={p.ndaSigned} /></Attr>
      </dl>
    </EditableCard>
  );
}

function NotesCard({ p, canManage }: { p: Participant; canManage: boolean }) {
  const update = useApp((s) => s.updateParticipant);
  const [notes, setNotes] = React.useState(p.notes ?? "");

  return (
    <EditableCard
      title="Notes"
      icon={<StickyNote className="h-4 w-4" />}
      canEdit={canManage}
      onEdit={() => setNotes(p.notes ?? "")}
      onSave={() => update(p.id, { notes: notes.trim() || undefined })}
      editor={
        <Textarea
          autoFocus
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything the next researcher should know…"
        />
      }
    >
      {p.notes ? (
        <p className="whitespace-pre-wrap text-[13px] text-muted">{p.notes}</p>
      ) : (
        <p className="text-[13px] text-subtle">No notes yet.</p>
      )}
    </EditableCard>
  );
}

const COMPANY_SIZES: CompanySize[] = ["1-50", "51-200", "201-1000", "1001-5000", "5000+"];

/** Company details — a shared record, so edits here apply to every participant
    linked to this company (there is no standalone company page). */
function CompanyCard({ company, canManage }: { company: Company; canManage: boolean }) {
  const update = useApp((s) => s.updateCompany);
  const [name, setName] = React.useState(company.name);
  const [industry, setIndustry] = React.useState(company.industry);
  const [size, setSize] = React.useState<CompanySize | null>(company.size ?? null);
  const [country, setCountry] = React.useState(company.country);

  const seed = () => {
    setName(company.name);
    setIndustry(company.industry);
    setSize(company.size ?? null);
    setCountry(company.country);
  };

  return (
    <EditableCard
      title="Company"
      canEdit={canManage}
      onEdit={seed}
      onSave={() =>
        update(company.id, {
          name: name.trim() || company.name,
          industry: industry.trim() || "—",
          // Explicit null (not undefined) so clearing it back to unknown
          // actually persists through the cloud mirror.
          size: size || null,
          country: country.trim() || "—",
        })
      }
      hint="Applies to everyone at this company"
      editor={
        <div className="flex flex-col gap-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Industry"><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></Field>
          <Field label="Size">
            <Select value={size ?? ""} onChange={(e) => setSize((e.target.value || null) as CompanySize | null)}>
              <option value="">Unknown</option>
              {COMPANY_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Country"><Input value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
        </div>
      }
    >
      <div className="flex items-center gap-3">
        <span className={`accent-${company.logoAccent ?? "slate"} flex h-10 w-10 items-center justify-center rounded-lg bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))]`}>
          <Building2 className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <Link href={`/participants?company=${company.id}`} className="block truncate font-medium text-foreground hover:text-primary">
            {company.name}
          </Link>
          <p className="truncate text-xs text-subtle">{company.industry}</p>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-1">
        <DetailRow label="Size">{company.size ?? "Unknown"}</DetailRow>
        <DetailRow label="Country">{company.country}</DetailRow>
      </dl>
    </EditableCard>
  );
}

/* ---------------- page ---------------- */

export default function ParticipantDetail() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  const role = useApp((s) => s.role);
  const canManage = can(role, "manage-content");
  const deleteParticipant = useApp((s) => s.deleteParticipant);
  const anonymize = useApp((s) => s.anonymizeParticipant);
  const cancelScheduledSession = useApp((s) => s.cancelScheduledSession);
  const toast = useApp((s) => s.toast);

  const [showEdit, setShowEdit] = React.useState(false);
  const [showSchedule, setShowSchedule] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [confirmAnon, setConfirmAnon] = React.useState(false);
  // Set while we delete + navigate away, so the vanished record doesn't 404.
  const [leaving, setLeaving] = React.useState(false);

  const p = getParticipant(id);
  if (!p) {
    if (leaving)
      return (
        <div className="flex h-[60vh] items-center justify-center">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      );
    return <MissingRecord hydrated={hydrated} />;
  }

  const company = getCompany(p.companyId);
  const personas = getPersonas(p.personaIds);
  const interviews = participantInterviews(p.id);
  const projects = participantProjects(p.id);
  const insights = participantInsights(p.id);
  const consent = consentFor(p.id);

  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Participants", href: "/participants" }, { label: fullName(p) }]}
        icon={<Avatar name={fullName(p)} accent={p.avatarColor} size="xl" />}
        title={fullName(p)}
        description={`${p.jobTitle} · ${company?.name ?? ""} · ${p.country}`}
        actions={
          canManage ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEdit(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowSchedule(true)}>
                <CalendarPlus className="h-4 w-4" /> Schedule
              </Button>
              <Menu>
                <MenuTrigger>
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem icon={<EyeOff className="h-4 w-4" />} onSelect={() => setConfirmAnon(true)}>
                    Anonymize (GDPR)
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<Trash2 className="h-4 w-4" />} destructive onSelect={() => setConfirmDelete(true)}>
                    Delete participant
                  </MenuItem>
                </MenuContent>
              </Menu>
            </>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 pb-4">
          {personas.map((pe) => <PersonaChip key={pe.id} persona={pe} size="md" />)}
          <span className="mx-1 h-4 w-px bg-border" />
          <RecruitmentBadge status={p.recruitmentStatus} />
          <ConsentBadge status={p.consentStatus} />
        </div>
      </PageHeader>

      <PageBody>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          {/* Main */}
          <div className="flex flex-col gap-5">
            {projects.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">In projects</h2>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {projects.map((pr) => (
                    <Link
                      key={pr.id}
                      href={`/projects/${pr.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[13px] hover:bg-surface-hover"
                    >
                      <span className="truncate text-foreground">{pr.name}</span>
                      <span className="shrink-0 text-2xs text-subtle">{pr.productArea}</span>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            <ClassificationCard p={p} canManage={canManage} />
            <ProfessionalProfileCard p={p} canManage={canManage} />
            <ProductUsageCard p={p} canManage={canManage} />
            <ResearchProfileCard p={p} canManage={canManage} />
            <NotesCard p={p} canManage={canManage} />

            <div>
              <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">
                Interviews <span className="text-subtle">({interviews.length})</span>
              </h2>
              {interviews.length ? (
                <div className="overflow-hidden rounded-lg border border-border bg-surface">
                  {interviews.map((iv) => <InterviewRow key={iv.id} interview={iv} />)}
                </div>
              ) : (
                <EmptyState title="No interviews yet" description="This participant hasn't been interviewed." />
              )}
            </div>

            {insights.length > 0 && (
              <div>
                <h2 className="mb-2 px-1 text-sm font-semibold text-foreground">
                  Contributed insights <span className="text-subtle">({insights.length})</span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {insights.map((ins) => <InsightCard key={ins.id} insight={ins} />)}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5">
            {p.scheduledSession && (
              <Card className="border-primary/30 bg-primary-soft/30 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <CalendarPlus className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Scheduled session</h2>
                </div>
                <p className="text-[15px] font-medium text-foreground">
                  {formatDate(p.scheduledSession.date, { weekday: "long" })}
                </p>
                <p className="text-[13px] text-muted">
                  {p.scheduledSession.time} {p.timezone}
                  {p.scheduledSession.projectId && getProject(p.scheduledSession.projectId) && (
                    <> · <Link href={`/projects/${p.scheduledSession.projectId}`} className="text-primary hover:underline">{getProject(p.scheduledSession.projectId)!.name}</Link></>
                  )}
                </p>
                {p.scheduledSession.interviewId && (
                  <Link
                    href={`/interviews/${p.scheduledSession.interviewId}`}
                    className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Open the scheduled interview
                  </Link>
                )}
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full text-danger hover:border-danger/50"
                    onClick={() => {
                      cancelScheduledSession(p.id);
                      toast("Scheduled session cancelled", "info");
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Cancel session
                  </Button>
                )}
              </Card>
            )}

            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">At a glance</h2>
              <div className="flex flex-col gap-2.5 text-[13px]">
                <a href={`mailto:${p.email}`} className="flex items-center gap-2 text-muted hover:text-primary">
                  <Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{p.email}</span>
                </a>
                {p.phone && (
                  <span className="flex items-center gap-2 text-muted"><Phone className="h-4 w-4 shrink-0" /> {p.phone}</span>
                )}
                <span className="flex items-center gap-2 text-muted"><Globe className="h-4 w-4 shrink-0" /> {p.language} · {p.preferredLanguage} preferred</span>
                <span className="flex items-center gap-2 text-muted"><Clock className="h-4 w-4 shrink-0" /> {p.timezone}{p.availability ? ` · ${p.availability}` : ""}</span>
              </div>
              <Divider className="my-3.5" />
              <dl className="grid grid-cols-1">
                <DetailRow label="Interviews">{p.interviewCount}</DetailRow>
                <DetailRow label="Last interview">{p.lastInterviewDate ? formatDate(p.lastInterviewDate) : "—"}</DetailRow>
              </dl>
            </Card>

            {company && <CompanyCard company={company} canManage={canManage} />}

            {consent && (
              <Card className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-muted" />
                  <h2 className="text-sm font-semibold text-foreground">Consent & governance</h2>
                </div>
                <div className="mb-3"><ConsentBadge status={consent.status} /></div>
                <dl className="grid grid-cols-1">
                  <DetailRow label="Granted">{consent.grantedDate ? formatDate(consent.grantedDate) : "—"}</DetailRow>
                  <DetailRow label="Expires">{consent.expiryDate ? formatDate(consent.expiryDate) : "—"}</DetailRow>
                  <DetailRow label="Retention">{consent.retentionMonths} months</DetailRow>
                </dl>
                <p className="mb-1.5 mt-2 text-2xs font-semibold uppercase tracking-wide text-subtle">Scope</p>
                <ul className="flex flex-col gap-1 text-[13px] text-muted">
                  {consent.scope.map((s) => (
                    <li key={s} className="flex items-center gap-2">
                      {s.includes("recording") ? <Video className="h-3.5 w-3.5" /> : <FileSignature className="h-3.5 w-3.5" />}
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        </div>
      </PageBody>

      <ParticipantFormModal open={showEdit} onClose={() => setShowEdit(false)} participant={p} />
      <ScheduleDialog open={showSchedule} onClose={() => setShowSchedule(false)} participant={p} />
      <ConfirmDialog
        open={confirmAnon}
        onClose={() => setConfirmAnon(false)}
        title="Anonymize participant"
        body={
          <>
            This removes <strong>{fullName(p)}</strong>&apos;s direct identifiers (name, email, phone) and clears
            their free-text notes, keeping the de-identified research. <strong>It can&apos;t be undone.</strong>
            <br />
            <br />
            Quotes and transcript details aren&apos;t scrubbed — if those could still identify them, use{" "}
            <strong>Delete</strong> for a full erasure instead. Consider exporting their data first (Settings →
            Consent &amp; GDPR → data subject request).
          </>
        }
        confirmLabel="Anonymize"
        onConfirm={() => {
          anonymize(p.id);
          toast("Personal data anonymized");
        }}
      />
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete participant"
        danger
        body={
          <>
            This permanently removes <strong>{fullName(p)}</strong> and their {interviews.length} interview
            {interviews.length === 1 ? "" : "s"}, and unlinks them from all projects and insights. This cannot be undone.
          </>
        }
        confirmLabel="Delete permanently"
        onConfirm={() => {
          const name = fullName(p);
          setLeaving(true);
          router.push("/participants");
          deleteParticipant(p.id);
          toast(`${name} deleted from the repository`, "info");
        }}
      />
    </>
  );
}
