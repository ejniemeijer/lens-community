/**
 * Generates supabase/seed.sql from the app's demo data.
 * Run: npx tsx scripts/generate-seed.ts > supabase/seed.sql
 */
import {
  users,
  companies,
  personas,
  tags,
  themes,
  participants,
  projects,
  interviews,
  insights,
  transcripts,
  kanbanBoards,
  affinityBoards,
} from "../lib/db";

type Val = string | number | boolean | null | undefined;

const esc = (v: Val): string => {
  if (v === undefined || v === null) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const arr = (a?: string[]): string =>
  a && a.length ? `array[${a.map(esc).join(",")}]::text[]` : "'{}'::text[]";
const jsonb = (v: unknown): string => `${esc(JSON.stringify(v ?? null))}::jsonb`;

/** All seed data belongs to Account #1 (created by schema.sql). */
const ACCOUNT_ID = "acc_northwind";

function insert(table: string, columns: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const cols = ["account_id", ...columns];
  const values = rows.map((r) => `  (${[esc(ACCOUNT_ID), ...r].join(", ")})`).join(",\n");
  return `insert into public.${table} (${cols.join(", ")}) values\n${values}\non conflict (id) do nothing;\n`;
}

const out: string[] = [
  "-- Generated from the app's demo data by scripts/generate-seed.ts",
  "-- Run AFTER schema.sql in the Supabase SQL Editor.",
  `-- Every row belongs to Account #1 ('${ACCOUNT_ID}').`,
  "",
];

out.push(
  insert(
    "profiles",
    ["id", "name", "email", "role", "job_title", "avatar_color"],
    users.map((u) => [esc(u.id), esc(u.name), esc(u.email), esc(u.role), esc(u.jobTitle), esc(u.avatarColor)]),
  ),
);

out.push(
  insert(
    "companies",
    ["id", "name", "industry", "size", "country", "logo_accent"],
    companies.map((c) => [esc(c.id), esc(c.name), esc(c.industry), esc(c.size), esc(c.country), esc(c.logoAccent)]),
  ),
);

out.push(
  insert(
    "personas",
    ["id", "name", "description", "accent", "icon"],
    personas.map((p) => [esc(p.id), esc(p.name), esc(p.description), esc(p.accent), esc(p.icon)]),
  ),
);

out.push(
  insert(
    "tags",
    ["id", "label", "kind", "accent"],
    tags.map((t) => [esc(t.id), esc(t.label), esc(t.kind), esc(t.accent)]),
  ),
);

out.push(
  insert(
    "themes",
    ["id", "name", "description", "accent"],
    themes.map((t) => [esc(t.id), esc(t.name), esc(t.description), esc(t.accent)]),
  ),
);

out.push(
  insert(
    "participants",
    [
      "id","first_name","last_name","email","phone","avatar_color","company_id","department","job_title",
      "country","language","timezone","industry","company_size","years_experience","seniority",
      "responsibilities","daily_tasks","decision_influence","technical_proficiency","digital_maturity",
      "products_used","modules_used","frequency","device","usage_level","persona_ids","behaviour_tag_ids",
      "pain_point_tag_ids","consent_status","nda_signed","recording_permission","preferred_language",
      "last_interview_date","interview_count","availability","recruitment_status","scheduled_session","notes",
    ],
    participants.map((p) => [
      esc(p.id), esc(p.firstName), esc(p.lastName), esc(p.email), esc(p.phone), esc(p.avatarColor),
      esc(p.companyId), esc(p.department), esc(p.jobTitle), esc(p.country), esc(p.language), esc(p.timezone),
      esc(p.industry), esc(p.companySize), esc(p.yearsExperience), esc(p.seniority),
      arr(p.responsibilities), arr(p.dailyTasks), esc(p.decisionInfluence), esc(p.technicalProficiency),
      esc(p.digitalMaturity), arr(p.productsUsed), arr(p.modulesUsed), esc(p.frequency), esc(p.device),
      esc(p.usageLevel), arr(p.personaIds), arr(p.behaviourTagIds), arr(p.painPointTagIds),
      esc(p.consentStatus), esc(p.ndaSigned), esc(p.recordingPermission), esc(p.preferredLanguage),
      esc(p.lastInterviewDate), esc(p.interviewCount), esc(p.availability), esc(p.recruitmentStatus),
      p.scheduledSession ? jsonb(p.scheduledSession) : "null", esc(p.notes),
    ]),
  ),
);

out.push(
  insert(
    "projects",
    [
      "id","name","description","objective","product_area","status","start_date","end_date","owner_id",
      "member_ids","participant_ids","research_questions","success_criteria","methodology",
    ],
    projects.map((p) => [
      esc(p.id), esc(p.name), esc(p.description), esc(p.objective), esc(p.productArea), esc(p.status),
      esc(p.startDate), esc(p.endDate), esc(p.ownerId), arr(p.memberIds), arr(p.participantIds),
      jsonb(p.researchQuestions), arr(p.successCriteria), esc(p.methodology),
    ]),
  ),
);

out.push(
  insert(
    "interviews",
    [
      "id","title","date","researcher_id","participant_id","project_ids","duration_minutes","meeting_link",
      "has_recording","sentiment","ai_summary","key_observations","insight_ids","attachments",
      "follow_ups","transcript_id",
    ],
    interviews.map((iv) => [
      esc(iv.id), esc(iv.title), esc(iv.date), esc(iv.researcherId), esc(iv.participantId), arr(iv.projectIds),
      esc(iv.durationMinutes), esc(iv.meetingLink), esc(iv.hasRecording), esc(iv.sentiment), esc(iv.aiSummary),
      arr(iv.keyObservations), arr(iv.insightIds), jsonb(iv.attachments), jsonb(iv.followUps),
      esc(iv.transcriptId),
    ]),
  ),
);

out.push(
  insert(
    "insights",
    [
      "id","title","description","evidence","type","confidence","severity","impact","created_date","created_by",
      "participant_ids","interview_ids","project_ids","theme_ids","tag_ids","product_area","persona_ids",
    ],
    insights.map((i) => [
      esc(i.id), esc(i.title), esc(i.description), esc(i.evidence), esc(i.type), esc(i.confidence),
      esc(i.severity), esc(i.impact), esc(i.createdDate), esc(i.createdById),
      arr(i.participantIds), arr(i.interviewIds), arr(i.projectIds), arr(i.themeIds), arr(i.tagIds),
      esc(i.productArea), arr(i.personaIds),
    ]),
  ),
);

out.push(
  insert(
    "transcripts",
    ["id", "interview_id", "language", "segments", "comments"],
    transcripts.map((t) => [esc(t.id), esc(t.interviewId), esc(t.language), jsonb(t.segments), jsonb(t.comments)]),
  ),
);

out.push(
  insert(
    "transcript_highlights",
    ["id","transcript_id","segment_id","start_pos","end_pos","text","kind","note","tag_ids","created_by","linked_insight_id"],
    transcripts.flatMap((t) =>
      t.highlights.map((h) => [
        esc(h.id), esc(h.transcriptId), esc(h.segmentId), esc(h.start), esc(h.end), esc(h.text), esc(h.kind),
        esc(h.note), arr(h.tagIds), esc(h.createdById), esc(h.linkedInsightId),
      ]),
    ),
  ),
);

out.push(
  insert(
    "kanban_boards",
    ["id", "project_id", "name", "columns", "cards"],
    kanbanBoards.map((b) => [esc(b.id), esc(b.projectId), esc(b.name), jsonb(b.columns), jsonb(b.cards)]),
  ),
);

out.push(
  insert(
    "affinity_boards",
    ["id", "project_id", "name", "groups", "notes"],
    affinityBoards.map((b) => [esc(b.id), esc(b.projectId), esc(b.name), jsonb(b.groups), jsonb(b.notes)]),
  ),
);

process.stdout.write(out.filter(Boolean).join("\n"));
