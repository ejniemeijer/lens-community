import type {
  AffinityBoard,
  Company,
  EntityType,
  ID,
  Insight,
  Interview,
  KanbanBoard,
  Participant,
  Persona,
  ResearchProject,
  Tag,
  Theme,
  Transcript,
  UsabilityTest,
  User,
} from "@/lib/types";

import { personas } from "./data/personas";
import { tags, themes } from "./data/tags";
import { companies, users, currentUserId as seedUserId } from "./data/team";
import { participants } from "./data/participants";
import { projects } from "./data/projects";
import { interviews } from "./data/interviews";
import { transcripts } from "./data/transcripts";
import { insights } from "./data/insights";
import { kanbanBoards, affinityBoards } from "./data/boards";
import { consentRecords, auditLogs, aiSuggestions } from "./data/governance";
import { tests as seedTests } from "./data/tests";

export {
  personas,
  tags,
  themes,
  companies,
  users,
  participants,
  projects,
  interviews,
  transcripts,
  insights,
  kanbanBoards,
  affinityBoards,
  consentRecords,
  auditLogs,
  aiSuggestions,
};

/** Unmoderated tests — seeded with demo content (see data/tests.ts). */
export const tests: UsabilityTest[] = seedTests;

/* ---------------- active account ----------------
   A live module binding: the store's signInAs() switches it and bumps
   dataVersion, so `currentUserId` importers always see the new value. */

export let currentUserId = seedUserId;
export function setActiveUser(id: ID) {
  currentUserId = id;
}

/** Workspace default password (local prototype auth only) — applies to any
    account without an explicitly set password. Not used in cloud mode, which
    authenticates through Supabase. Override via NEXT_PUBLIC_DEMO_PASSWORD. */
export const DEFAULT_PASSWORD =
  process.env.NEXT_PUBLIC_DEMO_PASSWORD || "changeme";

/* ---------------- simple getters ----------------
   Live array lookups (not prebuilt maps) so records created at
   runtime through the store are always found. Collection sizes
   are small, so linear scans are effectively free. */

export const getParticipant = (id: ID) => participants.find((x) => x.id === id);
export const getCompany = (id: ID) => companies.find((x) => x.id === id);
export const getPersona = (id: ID) => personas.find((x) => x.id === id);
export const getTag = (id: ID) => tags.find((x) => x.id === id);
export const getTheme = (id: ID) => themes.find((x) => x.id === id);
export const getUser = (id: ID) => users.find((x) => x.id === id);
export const getProject = (id: ID) => projects.find((x) => x.id === id);
export const getInterview = (id: ID) => interviews.find((x) => x.id === id);
export const getInsight = (id: ID) => insights.find((x) => x.id === id);
export const getTest = (id: ID) => tests.find((x) => x.id === id);
export const getTranscript = (id: ID) => transcripts.find((x) => x.id === id);
export const getTranscriptByInterview = (interviewId: ID) =>
  transcripts.find((t) => t.interviewId === interviewId);

export const currentUser = () => getUser(currentUserId) ?? users[0];

/* ---------------- resolve-by-ids helpers ---------------- */

export const byIds = <T>(ids: ID[] | undefined, get: (id: ID) => T | undefined): T[] =>
  (ids ?? []).map(get).filter((x): x is T => Boolean(x));

export const getTags = (ids?: ID[]) => byIds(ids, getTag);
export const getThemes = (ids?: ID[]) => byIds(ids, getTheme);
export const getPersonas = (ids?: ID[]) => byIds(ids, getPersona);
export const getParticipants = (ids?: ID[]) => byIds(ids, getParticipant);
export const getInterviews = (ids?: ID[]) => byIds(ids, getInterview);
export const getInsights = (ids?: ID[]) => byIds(ids, getInsight);
export const getProjects = (ids?: ID[]) => byIds(ids, getProject);
export const getUsers = (ids?: ID[]) => byIds(ids, getUser);

/* ---------------- derived / relational ---------------- */

export const fullName = (p: Participant) => `${p.firstName} ${p.lastName}`;

export const participantCompany = (p: Participant) => getCompany(p.companyId);

export const projectParticipants = (project: ResearchProject) =>
  getParticipants(project.participantIds);

export const projectInterviews = (projectId: ID) =>
  interviews.filter((iv) => iv.projectIds.includes(projectId));

/** Whether an interview is still upcoming. Explicit status wins; legacy rows
    fall back to the date (a future date means it hasn't happened yet). */
export const isScheduledInterview = (iv: Interview) =>
  iv.status ? iv.status === "scheduled" : iv.date > new Date().toISOString().slice(0, 10);

export const projectInsights = (projectId: ID) =>
  insights.filter((ins) => ins.projectIds.includes(projectId));

export const projectTests = (projectId: ID) =>
  tests.filter((t) => t.projectId === projectId);

export const participantInterviews = (participantId: ID) =>
  interviews.filter((iv) => iv.participantId === participantId);

export const participantProjects = (participantId: ID) =>
  projects.filter((pr) => pr.participantIds.includes(participantId));

export const participantInsights = (participantId: ID) =>
  insights.filter((ins) => ins.participantIds.includes(participantId));

export const interviewInsights = (interview: Interview) => getInsights(interview.insightIds);

export const themeInsights = (themeId: ID) =>
  insights.filter((ins) => ins.themeIds.includes(themeId));

export const personaParticipants = (personaId: ID) =>
  participants.filter((p) => p.personaIds.includes(personaId));

export const personaInsights = (personaId: ID) =>
  insights.filter((ins) => ins.personaIds.includes(personaId));

export const companyParticipants = (companyId: ID) =>
  participants.filter((p) => p.companyId === companyId);

export const kanbanBoardFor = (projectId?: ID) =>
  projectId
    ? kanbanBoards.find((b) => b.projectId === projectId) ?? kanbanBoards[0]
    : kanbanBoards[0];

export const affinityBoardFor = (projectId?: ID) =>
  projectId
    ? affinityBoards.find((b) => b.projectId === projectId) ?? affinityBoards[0]
    : affinityBoards[0];

export const consentFor = (participantId: ID) => {
  const existing = consentRecords.find((c) => c.participantId === participantId);
  if (existing) return existing;
  // Runtime-created participants have no seeded record — synthesize one
  // from the profile so governance views stay complete.
  const p = getParticipant(participantId);
  if (!p) return undefined;
  const granted = p.consentStatus === "granted" ? "2026-07-03" : undefined;
  return {
    id: `cr-${p.id}`,
    participantId: p.id,
    status: p.consentStatus,
    grantedDate: granted,
    expiryDate: granted ? "2028-07-03" : undefined,
    scope: [
      "Interview participation",
      p.recordingPermission ? "Audio/video recording" : "Notes only",
      "Storage of research data",
    ],
    retentionMonths: 24,
  };
};

/* ---------------- aggregate stats (dashboards) ---------------- */

export interface Counted {
  id: ID;
  label: string;
  count: number;
  accent?: string;
}

/** Top pain points by how many insights carry each pain-point tag. */
export function topPainPoints(limit = 6): Counted[] {
  const counts = new Map<ID, number>();
  for (const ins of insights) {
    for (const t of ins.tagIds) {
      const tag = getTag(t);
      if (tag?.kind === "pain-point") counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => {
      const tag = getTag(id)!;
      return { id, label: tag.label, count, accent: tag.accent };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Themes ranked by how many insights reference each. */
export function trendingThemes(limit = 6): Counted[] {
  return themes
    .map((th) => ({
      id: th.id,
      label: th.name,
      accent: th.accent,
      count: themeInsights(th.id).length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function personaCoverage(): Counted[] {
  return personas
    .map((pe) => ({
      id: pe.id,
      label: pe.name,
      accent: pe.accent,
      count: personaParticipants(pe.id).length,
    }))
    .sort((a, b) => b.count - a.count);
}

export function insightsByProductArea(): Counted[] {
  const counts = new Map<string, number>();
  for (const ins of insights) counts.set(ins.productArea, (counts.get(ins.productArea) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ id: label, label, count }))
    .sort((a, b) => b.count - a.count);
}

export function insightsByPersona(): Counted[] {
  return personas
    .map((pe) => ({
      id: pe.id,
      label: pe.name,
      accent: pe.accent,
      count: personaInsights(pe.id).length,
    }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
}

export function sentimentBreakdown() {
  const out = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
  for (const iv of interviews) out[iv.sentiment]++;
  return out;
}

export function availableParticipants() {
  return participants.filter(
    (p) => p.recruitmentStatus === "available" || p.recruitmentStatus === "contacted",
  );
}

export function upcomingInterviews() {
  return participants
    .filter((p) => p.recruitmentStatus === "scheduled")
    .map((p) => ({ participant: p, projects: participantProjects(p.id) }));
}

export function featureRequestsAndOpportunities() {
  return insights.filter((i) => i.type === "opportunity" || i.type === "feature-request");
}

export const activeProjects = () =>
  projects.filter((p) => !["completed", "on-hold"].includes(p.status));

export const recentInsights = (limit = 5) =>
  [...insights].sort((a, b) => b.createdDate.localeCompare(a.createdDate)).slice(0, limit);

/* ---------------- global search ---------------- */

export interface SearchResult {
  id: ID;
  type: EntityType;
  title: string;
  subtitle: string;
  href: string;
  accent?: string;
}

export function search(raw: string, types?: EntityType[]): SearchResult[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  const wants = (t: EntityType) => !types || types.includes(t);
  const results: SearchResult[] = [];
  const hit = (s?: string) => s?.toLowerCase().includes(q);

  if (wants("participant"))
    for (const p of participants)
      if (hit(fullName(p)) || hit(p.jobTitle) || hit(p.email) || hit(p.department))
        results.push({
          id: p.id,
          type: "participant",
          title: fullName(p),
          subtitle: `${p.jobTitle} · ${getCompany(p.companyId)?.name ?? ""}`,
          href: `/participants/${p.id}`,
          accent: p.avatarColor,
        });

  if (wants("company"))
    for (const c of companies)
      if (hit(c.name) || hit(c.industry))
        results.push({ id: c.id, type: "company", title: c.name, subtitle: c.industry, href: `/participants?company=${c.id}`, accent: c.logoAccent });

  if (wants("project"))
    for (const pr of projects)
      if (hit(pr.name) || hit(pr.description) || hit(pr.productArea))
        results.push({ id: pr.id, type: "project", title: pr.name, subtitle: `${pr.productArea} · ${pr.status}`, href: `/projects/${pr.id}` });

  if (wants("interview"))
    for (const iv of interviews)
      if (hit(iv.title) || hit(iv.aiSummary))
        results.push({ id: iv.id, type: "interview", title: iv.title, subtitle: iv.date, href: `/interviews/${iv.id}` });

  if (wants("insight"))
    for (const ins of insights)
      if (hit(ins.title) || hit(ins.description))
        results.push({ id: ins.id, type: "insight", title: ins.title, subtitle: ins.productArea, href: `/insights/${ins.id}` });

  if (wants("theme"))
    for (const th of themes)
      if (hit(th.name) || hit(th.description))
        results.push({ id: th.id, type: "theme", title: th.name, subtitle: "Theme", href: `/insights?theme=${th.id}`, accent: th.accent });

  if (wants("tag"))
    for (const t of tags)
      if (hit(t.label))
        results.push({ id: t.id, type: "tag", title: t.label, subtitle: `${t.kind} tag`, href: `/insights?tag=${t.id}`, accent: t.accent });

  if (wants("persona"))
    for (const pe of personas)
      if (hit(pe.name) || hit(pe.description))
        results.push({ id: pe.id, type: "persona", title: pe.name, subtitle: "Persona", href: `/participants?persona=${pe.id}`, accent: pe.accent });

  return results;
}
