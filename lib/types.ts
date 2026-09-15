/* ============================================================
   Domain model for the UX Research Repository.
   Relationships are expressed with id references so the same
   entity (a participant, an insight) can be reused across many
   projects — the many-to-many nature of the spec.
   ============================================================ */

export type Role = "admin" | "researcher" | "designer" | "product-owner" | "viewer";

export type ID = string;

export interface User {
  id: ID;
  name: string;
  email: string;
  role: Role;
  jobTitle: string;
  avatarColor?: string;
  /** Prototype-only: plain-text password; when unset, the workspace default applies. */
  password?: string;
  /** Set when an admin created the account with a temporary password — prompts on sign-in. */
  mustChangePassword?: boolean;
  /** Admin-controlled AI access. Undefined/true = allowed; false = AI is off for this user. */
  aiEnabled?: boolean;
}

/* ---------------- Participants & people ---------------- */

export type Seniority = "junior" | "mid" | "senior" | "lead" | "executive";
export type Proficiency = "beginner" | "intermediate" | "expert";
export type Frequency = "daily" | "weekly" | "monthly" | "rarely";
export type DeviceContext = "mobile" | "desktop" | "both" | "field-mobile";
export type CompanySize = "1-50" | "51-200" | "201-1000" | "1001-5000" | "5000+";

export type RecruitmentStatus =
  | "available"
  | "contacted"
  | "scheduled"
  | "interviewed"
  | "do-not-contact";

export type ConsentStatus = "granted" | "pending" | "expired" | "withdrawn";

export interface Company {
  id: ID;
  name: string;
  industry: string;
  /** Unset when nobody has said — companies created by typing a new name in
      the participant form used to be stamped "201-1000", which reads as a
      researched fact rather than a guess. Null (not undefined) clears it so
      the cloud sync persists the removal. */
  size?: CompanySize | null;
  country: string;
  logoAccent?: string;
}

export interface Persona {
  id: ID;
  name: string;
  description: string;
  accent: string;
  icon: string; // lucide icon name
}

export type TagKind = "behaviour" | "pain-point" | "general";

export interface Tag {
  id: ID;
  label: string;
  kind: TagKind;
  accent: string;
}

export interface Theme {
  id: ID;
  name: string;
  description: string;
  accent: string;
}

export interface Participant {
  id: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarColor?: string;

  companyId: ID;
  department: string;
  jobTitle: string;
  country: string;
  language: string;
  timezone: string;

  // Professional profile
  industry: string;
  /** Copy of the company's size at capture time; unset when unknown. */
  companySize?: CompanySize | null;
  yearsExperience: number;
  seniority: Seniority;
  responsibilities: string[];
  dailyTasks: string[];
  decisionInfluence: "low" | "medium" | "high";
  technicalProficiency: Proficiency;
  digitalMaturity: Proficiency;

  // Product usage
  productsUsed: string[];
  modulesUsed: string[];
  frequency: Frequency;
  device: DeviceContext;
  usageLevel: Proficiency;

  // Research profile
  personaIds: ID[];
  behaviourTagIds: ID[];
  painPointTagIds: ID[];
  consentStatus: ConsentStatus;
  ndaSigned: boolean;
  recordingPermission: boolean;
  preferredLanguage: string;
  lastInterviewDate?: string;
  interviewCount: number;
  availability: string;
  recruitmentStatus: RecruitmentStatus;
  /** Upcoming interview session, when one is scheduled. */
  scheduledSession?: ScheduledSession;

  notes?: string;
}

export interface ScheduledSession {
  date: string;
  time: string;
  projectId?: ID;
  /** The interview record auto-created for this session. */
  interviewId?: ID;
}

/* ---------------- Research projects ---------------- */

export type ProjectStatus =
  | "planning"
  | "recruiting"
  | "in-progress"
  | "analysis"
  | "completed"
  | "on-hold";

export interface ResearchQuestion {
  id: ID;
  text: string;
  answered: boolean;
}

export interface ResearchProject {
  id: ID;
  name: string;
  description: string;
  objective: string;
  productArea: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  ownerId: ID;
  memberIds: ID[];
  participantIds: ID[];
  researchQuestions: ResearchQuestion[];
  successCriteria: string[];
  methodology: string;
  /** Saved AI executive summary (generated on the AI Summary tab). */
  aiSummary?: string;
}

/* ---------------- Interviews & transcripts ---------------- */

export type AttachmentKind = "audio" | "video" | "document" | "transcript" | "image" | "report";

export interface Attachment {
  id: ID;
  name: string;
  kind: AttachmentKind;
  sizeLabel: string;
  addedDate: string;
}

export interface FollowUp {
  id: ID;
  text: string;
  done: boolean;
  assigneeId?: ID;
}

export type InterviewStatus = "scheduled" | "completed";

export interface Interview {
  id: ID;
  title: string;
  /** Lifecycle status. Absent on legacy rows → treated by date (future = scheduled). */
  status?: InterviewStatus;
  date: string;
  researcherId: ID;
  participantId: ID;
  projectIds: ID[];
  durationMinutes: number;
  meetingLink?: string;
  hasRecording: boolean;
  sentiment: Sentiment;
  aiSummary: string;
  keyObservations: string[];
  insightIds: ID[];
  attachments: Attachment[];
  followUps: FollowUp[];
  transcriptId?: ID;
  /** Free-text session notes / pasted transcript, edited inline on the interview page. */
  notes?: string;
}

export interface TranscriptSegment {
  id: ID;
  speaker: string;
  speakerRole: "researcher" | "participant";
  startSeconds: number;
  text: string;
}

export type HighlightKind =
  | "insight"
  | "observation"
  | "pain-point"
  | "opportunity"
  | "feature-request"
  | "user-need";

export interface TranscriptHighlight {
  id: ID;
  transcriptId: ID;
  segmentId: ID;
  /** character offsets within the segment text */
  start: number;
  end: number;
  text: string;
  kind: HighlightKind;
  note?: string;
  tagIds: ID[];
  createdById: ID;
  linkedInsightId?: ID;
}

export interface TranscriptComment {
  id: ID;
  segmentId: ID;
  authorId: ID;
  text: string;
  date: string;
}

export interface Transcript {
  id: ID;
  interviewId: ID;
  language: string;
  segments: TranscriptSegment[];
  highlights: TranscriptHighlight[];
  comments: TranscriptComment[];
}

/* ---------------- Insights ---------------- */

export type Confidence = "low" | "medium" | "high";
export type Severity = "low" | "medium" | "high" | "critical";
export type Impact = "low" | "medium" | "high";
export type Sentiment = "positive" | "neutral" | "negative" | "mixed";

export interface Insight {
  id: ID;
  title: string;
  description: string;
  evidence: string;
  type: HighlightKind;
  /** Priority ratings are set during triage — left undefined ("Unrated") on
      quick capture so the app never fabricates an assessment nobody made. */
  confidence?: Confidence;
  severity?: Severity;
  impact?: Impact;
  createdDate: string;
  createdById: ID;
  participantIds: ID[];
  interviewIds: ID[];
  /** Usability tests this insight was promoted from — the traceability link
      back to sessions/results, mirroring interviewIds. Optional: predates
      most insights. */
  testIds?: ID[];
  projectIds: ID[];
  themeIds: ID[];
  tagIds: ID[];
  productArea: string;
  personaIds: ID[];
  /** Insights the user has explicitly linked to this one (symmetric). */
  relatedInsightIds?: ID[];
  /** Research-to-product triage stage (a WORKFLOW_STAGES id). Set = the insight
      is on the Kanban board in that column; null/undefined = not on the board.
      Null (not undefined) is used to clear it so the cloud sync persists the
      removal. */
  workflowStage?: string | null;
}

/* ---------------- Kanban ---------------- */

export interface KanbanColumn {
  id: ID;
  title: string;
  accent: string;
  /** Optional lane subtitle shown on the board and editable in Settings. */
  description?: string;
}

export interface KanbanCard {
  id: ID;
  columnId: ID;
  title: string;
  description?: string;
  insightId?: ID;
  participantId?: ID;
  interviewId?: ID;
  tagIds: ID[];
  assigneeId?: ID;
}

export interface KanbanBoard {
  id: ID;
  projectId?: ID;
  name: string;
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

/* ---------------- Affinity mapping ---------------- */

export interface AffinityNote {
  id: ID;
  text: string;
  kind: HighlightKind;
  sourceParticipantId?: ID;
  /** Provenance when imported from captured research ("Add from research") —
      keeps the quote traceable and prevents importing the same item twice. */
  sourceInterviewId?: ID;
  sourceHighlightId?: ID;
  groupId: ID | null;
}

export interface AffinityGroup {
  id: ID;
  title: string;
  accent: string;
  aiSuggested?: boolean;
  /** Set when the cluster was promoted into a repository insight. */
  insightId?: ID;
}

export interface AffinityBoard {
  id: ID;
  projectId?: ID;
  name: string;
  groups: AffinityGroup[];
  notes: AffinityNote[];
}

/* ---------------- Unmoderated testing ----------------
   A test is an ordered list of blocks a participant walks through on the
   public /t/<token> runner (docs/unmoderated-testing.md). Test definitions
   are content (synced through the store mirror); sessions are captured
   server-side only and read back on the results page — never mirrored. */

export type TestStatus = "draft" | "active" | "closed";

export interface TestQuestion {
  id: ID;
  type: "rating" | "open" | "choice" | "yes-no" | "input" | "matrix";
  prompt: string;
  /** Participant must answer before continuing (runner blocks Continue). */
  required?: boolean;
  /** rating + matrix: the scale maximum (answers are 1..scale). */
  scale?: number;
  /** choice: the selectable options. */
  options?: string[];
  /** choice: allow selecting more than one option. */
  multiple?: boolean;
  /** input: expected format, rendered as the matching HTML input type. */
  inputFormat?: "text" | "email" | "number" | "date";
  /** matrix: the statements rated on the shared scale. */
  statements?: string[];
}

/** What one question's answer can be: rating/yes-no/open/input are
    string|number, multi-select is string[], matrix maps statement → rating. */
export type TestAnswerValue = string | number | string[] | Record<string, number>;

export interface MessageBlock {
  id: ID;
  type: "message";
  title: string;
  bodyMd: string;
  /** The intro block doubles as the consent gate; nothing is recorded until accepted. */
  isConsentGate?: boolean;
  consentText?: string;
}

export interface QuestionsBlock {
  id: ID;
  type: "questions";
  questions: TestQuestion[];
}

export interface FirstClickBlock {
  id: ID;
  type: "first-click";
  instructions: string;
  /** Optional supporting context shown under the task. */
  description?: string;
  imageUrl: string;
  /** Natural image size — click coordinates are normalized against it. */
  imageWidth?: number;
  imageHeight?: number;
  followUpQuestions: TestQuestion[];
}

export interface AppTaskBlock {
  id: ID;
  type: "app-task";
  instructions: string;
  /** Optional supporting context shown under the task. */
  description?: string;
  /** Opened in a new tab with ?lens=<sessionId>.<token> appended — a Figma
      Make app, a deployed prototype, staging, or the live product. */
  url: string;
  /** Optional screenshot shown to the participant *before* they open the
      app, so they recognize what the new tab will look like. */
  previewImageUrl?: string;
  /** Beacon route match that auto-upgrades the outcome to success (e.g. "/confirmation*"). */
  successUrlPattern?: string;
  /** Screenshots of the app's routes — beacon clicks are painted over them
      on the results page (route pattern → image). */
  routeScreenshots?: { pattern: string; imageUrl: string }[];
  followUpQuestions: TestQuestion[];
}

export interface FigmaProtoBlock {
  id: ID;
  type: "figma-proto";
  /** "goal" (default): a task with a completed / couldn't-do-it outcome.
      "explore": no success framing — the participant looks around and answers
      questions, which is the honest shape for exploratory review. Detecting
      *which* screen they reached would need Figma's Embed API (signed-in
      viewers only), so a goal-screen variant isn't offered — see
      docs/unmoderated-testing.md. */
  taskType?: "goal" | "explore";
  instructions: string;
  /** Optional supporting context shown under the task. */
  description?: string;
  /** The prototype link the researcher pasted (figma.com/proto|design/…) —
      normalized to an embed.figma.com iframe URL at render time. The prototype
      must be shared as "anyone with the link can view". */
  url: string;
  /** Stage aspect in the runner — prototypes range from phone to desktop. */
  frame?: "phone" | "tablet" | "desktop";
  followUpQuestions: TestQuestion[];
}

export interface PreferenceBlock {
  id: ID;
  type: "preference";
  instructions: string;
  /** Optional supporting context shown under the question. */
  description?: string;
  /** 2–4 designs to choose between. */
  options: { id: ID; label?: string; imageUrl: string }[];
  followUpQuestions: TestQuestion[];
}

export interface FiveSecondBlock {
  id: ID;
  type: "five-second";
  instructions?: string;
  imageUrl: string;
  /** How long the image stays visible (default 5). */
  seconds?: number;
  /** Recall questions asked after the image disappears. */
  questions: TestQuestion[];
}

export interface DesignFeedbackBlock {
  id: ID;
  type: "design-feedback";
  /** The main question, e.g. "What do you think of this design?" */
  instructions: string;
  /** Optional supporting context shown under the question. */
  description?: string;
  /** Shown large in the runner, with a fullscreen lightbox for detail. */
  imageUrl: string;
  questions: TestQuestion[];
}

export type TestBlock =
  | MessageBlock
  | QuestionsBlock
  | FirstClickBlock
  | AppTaskBlock
  | FigmaProtoBlock
  | PreferenceBlock
  | FiveSecondBlock
  | DesignFeedbackBlock;

export interface UsabilityTest {
  id: ID;
  projectId: ID;
  name: string;
  status: TestStatus;
  /** Secret in the public link (/t/<token>); rotating it kills the old link. */
  shareToken: string;
  blocks: TestBlock[];
  createdById?: ID;
  /** Set by the DB on insert; present after a cloud load. */
  createdAt?: string;
  /** Null (not undefined) clears it on reopen, so the cloud sync persists the removal. */
  closedAt?: string | null;
  /** Saved AI report — generated once, kept so reopening it costs no tokens.
      Regenerating overwrites. The facts half is code-computed; see lib/tests-report. */
  report?: {
    narrative: string;
    facts: string;
    generatedAt: string;
    /** Session counts at generation time, so the report stays internally
        consistent even after more sessions arrive. */
    sessions: number;
    completed: number;
  };
}

/* ---- session results (read-only on the client; written via service role) ---- */

export type TestSessionStatus = "started" | "completed" | "abandoned";
export type TestOutcome = "success-auto" | "success-reported" | "gave-up" | "skipped";

/** One beacon event from an app-task block (clicks + route views only). */
export interface TestBeaconEvent {
  /** ms since the app-task tab opened */
  t: number;
  type: "page" | "click";
  path: string;
  sel?: string;
  /** click position, normalized 0–1 against the viewport */
  x?: number;
  y?: number;
  /** click position, normalized 0–1 against the full document (beacon v2) —
      scroll-corrected, so it lines up with a screenshot of the whole page */
  dx?: number;
  dy?: number;
  /** participant's viewport size in px at click time (beacon v3) — enables
      breakpoint segmentation of heatmaps */
  vw?: number;
  vh?: number;
  /** full document size in px at click time (beacon v3) — enables rendering
      a size-faithful live-app overlay (iframe sized so it never scrolls) */
  dw?: number;
  dh?: number;
}

export interface TestBlockResult {
  outcome?: TestOutcome;
  /** App task: the participant's own words on why it went that way (optional). */
  outcomeComment?: string;
  durationMs?: number;
  /** questionId → answer */
  answers?: Record<string, TestAnswerValue>;
  /** first-click: position normalized 0–1 against the image */
  click?: { x: number; y: number };
  timeToClickMs?: number;
  /** preference: the chosen option's id */
  choice?: string;
  beaconEvents?: TestBeaconEvent[];
}

export interface TestSession {
  id: ID;
  testId: ID;
  status: TestSessionStatus;
  consentGivenAt: string;
  /** Coarse only (viewport, pointer type) — deliberately non-fingerprintable. */
  device?: { viewportW?: number; viewportH?: number; pointer?: "touch" | "mouse" };
  /** blockId → result, merged per block server-side */
  results: Record<ID, TestBlockResult>;
  startedAt: string;
  completedAt?: string | null;
}

/* ---------------- Governance ---------------- */

export interface ConsentRecord {
  id: ID;
  participantId: ID;
  status: ConsentStatus;
  grantedDate?: string;
  expiryDate?: string;
  scope: string[];
  retentionMonths: number;
}

export interface AuditLog {
  id: ID;
  actorId: ID;
  action: string;
  entity: string;
  entityLabel: string;
  date: string;
}

/* ---------------- Search & AI ---------------- */

export type EntityType =
  | "participant"
  | "company"
  | "project"
  | "interview"
  | "insight"
  | "tag"
  | "theme"
  | "persona";

export interface AiSuggestion {
  id: ID;
  kind:
    | "theme"
    | "persona"
    | "tag"
    | "duplicate"
    | "similar"
    | "opportunity"
    | "gap"
    | "topic";
  title: string;
  detail: string;
  confidence: Confidence;
  relatedIds?: ID[];
}
