/**
 * The tenant data model's column mapping — the single place that knows how the
 * app's camelCase entities correspond to Postgres columns.
 *
 * Deliberately free of any Supabase client import so it can be used from both
 * sides: the browser mirror (lib/supabase-sync.ts) and server routes that read
 * a tenant's data with the service role (the owner export). Two copies of these
 * maps would drift, and a drifted export is worse than no export.
 */

/** camelCase (app) → snake_case (db) field maps. jsonb/array values pass
    through untouched — PostgREST maps JS arrays↔text[] and objects↔jsonb. */
export type FieldMap = Record<string, string>;

export const M = {
  profiles: {
    id: "id", name: "name", email: "email", role: "role",
    jobTitle: "job_title", avatarColor: "avatar_color", aiEnabled: "ai_enabled",
  } as FieldMap,
  companies: {
    id: "id", name: "name", industry: "industry", size: "size",
    country: "country", logoAccent: "logo_accent",
  } as FieldMap,
  personas: { id: "id", name: "name", description: "description", accent: "accent", icon: "icon" } as FieldMap,
  tags: { id: "id", label: "label", kind: "kind", accent: "accent" } as FieldMap,
  themes: { id: "id", name: "name", description: "description", accent: "accent" } as FieldMap,
  participants: {
    id: "id", firstName: "first_name", lastName: "last_name", email: "email", phone: "phone",
    avatarColor: "avatar_color", companyId: "company_id", department: "department", jobTitle: "job_title",
    country: "country", language: "language", timezone: "timezone", industry: "industry",
    companySize: "company_size", yearsExperience: "years_experience", seniority: "seniority",
    responsibilities: "responsibilities", dailyTasks: "daily_tasks", decisionInfluence: "decision_influence",
    technicalProficiency: "technical_proficiency", digitalMaturity: "digital_maturity",
    productsUsed: "products_used", modulesUsed: "modules_used", frequency: "frequency", device: "device",
    usageLevel: "usage_level", personaIds: "persona_ids", behaviourTagIds: "behaviour_tag_ids",
    painPointTagIds: "pain_point_tag_ids", consentStatus: "consent_status", ndaSigned: "nda_signed",
    recordingPermission: "recording_permission", preferredLanguage: "preferred_language",
    lastInterviewDate: "last_interview_date", interviewCount: "interview_count", availability: "availability",
    recruitmentStatus: "recruitment_status", scheduledSession: "scheduled_session", notes: "notes",
  } as FieldMap,
  projects: {
    id: "id", name: "name", description: "description", objective: "objective", productArea: "product_area",
    status: "status", startDate: "start_date", endDate: "end_date", ownerId: "owner_id",
    memberIds: "member_ids", participantIds: "participant_ids", researchQuestions: "research_questions",
    successCriteria: "success_criteria", methodology: "methodology", aiSummary: "ai_summary",
  } as FieldMap,
  interviews: {
    id: "id", title: "title", status: "status", date: "date", researcherId: "researcher_id", participantId: "participant_id",
    projectIds: "project_ids", durationMinutes: "duration_minutes", meetingLink: "meeting_link",
    hasRecording: "has_recording", sentiment: "sentiment", aiSummary: "ai_summary",
    keyObservations: "key_observations", insightIds: "insight_ids",
    attachments: "attachments", followUps: "follow_ups", transcriptId: "transcript_id",
    notes: "notes",
  } as FieldMap,
  insights: {
    id: "id", title: "title", description: "description", evidence: "evidence", type: "type",
    confidence: "confidence", severity: "severity", impact: "impact", createdDate: "created_date",
    createdById: "created_by", participantIds: "participant_ids",
    interviewIds: "interview_ids", testIds: "test_ids", projectIds: "project_ids", themeIds: "theme_ids", tagIds: "tag_ids",
    productArea: "product_area", personaIds: "persona_ids", relatedInsightIds: "related_insight_ids",
    workflowStage: "workflow_stage",
  } as FieldMap,
  tests: {
    id: "id", projectId: "project_id", name: "name", status: "status",
    shareToken: "share_token", blocks: "blocks", createdById: "created_by",
    createdAt: "created_at", closedAt: "closed_at", report: "report",
  } as FieldMap,
  // test_sessions are deliberately NOT mirrored: participants write them
  // concurrently via the service-role /api/t routes, and a full-mirror upsert
  // + delete-removed would clobber those writes. The results page reads them
  // directly (RLS select).
  kanban_boards: {
    id: "id", projectId: "project_id", name: "name", columns: "columns", cards: "cards",
  } as FieldMap,
  affinity_boards: {
    id: "id", projectId: "project_id", name: "name", groups: "groups", notes: "notes",
  } as FieldMap,
  // Only the transcript's own columns — highlights live in their own table.
  transcripts: {
    id: "id", interviewId: "interview_id", language: "language",
    segments: "segments", comments: "comments",
  } as FieldMap,
  transcript_highlights: {
    id: "id", transcriptId: "transcript_id", segmentId: "segment_id", start: "start_pos", end: "end_pos",
    text: "text", kind: "kind", note: "note", tagIds: "tag_ids", createdById: "created_by",
    linkedInsightId: "linked_insight_id",
  } as FieldMap,
};

export function toRow(obj: Record<string, unknown>, map: FieldMap) {
  const row: Record<string, unknown> = {};
  for (const [appKey, col] of Object.entries(map)) {
    // Omit undefined fields (rather than forcing null) so the column's DB
    // default applies on insert — paired with { defaultToNull: false } on the
    // bulk upserts. This keeps optional fields with NOT NULL defaults (e.g. the
    // insights array columns, default '{}') from tripping their constraint.
    // Explicit nulls are preserved so intentional clears still work.
    if (obj[appKey] !== undefined) row[col] = obj[appKey];
  }
  return row;
}
export function fromRow<T>(row: Record<string, unknown>, map: FieldMap): T {
  const obj: Record<string, unknown> = {};
  for (const [appKey, col] of Object.entries(map)) {
    const v = row[col];
    obj[appKey] = v === null ? undefined : v;
  }
  return obj as T;
}


// Upsert parent → child; delete child → parent (FK-safe).
export const LOAD_ORDER = [
  ["profiles", "profiles"],
  ["companies", "companies"],
  ["personas", "personas"],
  ["tags", "tags"],
  ["themes", "themes"],
  ["participants", "participants"],
  // tests reference projects (NOT NULL FK), so projects must precede them.
  ["projects", "projects"],
  ["tests", "tests"],
  ["interviews", "interviews"],
  ["insights", "insights"],
  ["kanban_boards", "kanbanBoards"],
  ["affinity_boards", "affinityBoards"],
  // transcripts must precede transcript_highlights: highlights.transcript_id
  // is a NOT NULL FK to transcripts(id), so the parent rows must exist first.
  ["transcripts", "transcripts"],
  ["transcript_highlights", "highlights"],
] as const;
