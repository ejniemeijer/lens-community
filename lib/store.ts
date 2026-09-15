"use client";

import { create } from "zustand";
import type {
  AffinityBoard,
  AffinityNote,
  Attachment,
  Company,
  FollowUp,
  HighlightKind,
  ID,
  Insight,
  Interview,
  KanbanBoard,
  KanbanCard,
  KanbanColumn,
  Participant,
  Persona,
  ResearchProject,
  Role,
  ScheduledSession,
  Tag,
  TagKind,
  Theme as ThemeEntity,
  TranscriptHighlight,
  UsabilityTest,
  User,
} from "@/lib/types";
import {
  participants,
  companies,
  projects,
  interviews,
  insights,
  users,
  tags,
  personas,
  themes,
  tests,
  kanbanBoards,
  affinityBoards,
  aiSuggestions,
  currentUserId,
  setActiveUser,
  getUser,
  fullName,
} from "@/lib/db";
// Fire-and-forget audit trail (cloud only). audit.ts reads this store lazily
// at call time, so the module cycle store → audit → store is harmless.
import { logAudit } from "@/lib/audit";
import { transcripts } from "@/lib/data/transcripts";
import { uid } from "@/lib/utils";
import { removeTestAssets } from "@/lib/test-assets";
import { KANBAN_STAGES_PREF, parseStages, firstStageId } from "@/lib/workflow";
import {
  syncAll,
  syncProfiles,
  primeSyncBaseline,
  upsertProfile,
  savePersonalPrefs,
  saveWorkspaceSettings,
  type AccountInfo,
  type CloudSnapshot,
} from "@/lib/supabase-sync";
import { supabase } from "@/lib/supabase";
import { can } from "@/lib/permissions";

type Theme = "light" | "dark";
/** The user's theme *preference*; "system" follows the OS setting. */
type ThemePref = Theme | "system";

const clone = <T>(v: T): T => structuredClone(v);

/** Pristine copy of the seed, captured at module load (before any mutation). */
const SEED = {
  participants: clone(participants),
  companies: clone(companies),
  projects: clone(projects),
  interviews: clone(interviews),
  insights: clone(insights),
  users: clone(users),
  tags: clone(tags),
  personas: clone(personas),
  themes: clone(themes),
  tests: clone(tests),
};

/** The mutable database — the same module arrays lib/db.ts helpers read. */
const DB = { participants, companies, projects, interviews, insights, users, tags, personas, themes, tests };

function replaceContents<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

function seedHighlights(): Record<string, TranscriptHighlight[]> {
  const out: Record<string, TranscriptHighlight[]> = {};
  for (const t of transcripts) out[t.id] = clone(t.highlights);
  return out;
}

/* ---------------- persisted settings / misc ---------------- */

export const DEFAULT_PREFS: Record<string, string | boolean> = {
  "ai.provider": "anthropic",
  "ai.model.anthropic": "claude-opus-4-8",
  "ai.model.openai": "gpt-4o",
  "ai.summaries": true,
  "ai.suggestions": true,
  "ai.triage": true,
  "ai.duplicates": true,
  "ai.opportunities": true,
  "ai.sentiment": true,
  "ai.gaps": true,
  "ai.transcribe": false,
  "ai.redact": true,
  "gdpr.requireConsent": true,
  "gdpr.retention": true,
  "gdpr.anonymizeExports": true,
  "gdpr.autoDelete": false,
  // Optional project tabs — toggle their visibility from Settings.
  // Affinity and Kanban are off by default; enable them per workspace.
  "tabs.affinity": false,
  "tabs.kanban": false,
  "tabs.ai": true,
  "tabs.reports": true,
};

export interface ExportLogEntry {
  id: string;
  name: string;
  date: string;
  by: string;
}

const SEED_EXPORT_LOG: ExportLogEntry[] = [
  { id: "ex-1", name: "Full study export (JSON)", date: "2026-06-30", by: "Maya Visser" },
  { id: "ex-2", name: "Executive report (PDF)", date: "2026-06-22", by: "Sanne de Vries" },
];

export interface Toast {
  id: string;
  msg: string;
  kind: "success" | "info" | "error";
}

/** Which content types to remove when clearing demo data. */
export interface ClearSelection {
  projects: boolean;
  participants: boolean;
  interviews: boolean;
  insights: boolean;
}

const PERSIST_KEY = "lens-db-v1";
const PREFS_KEY = "lens-prefs";
/** Session marker so a mid-demo page refresh re-enters the sandbox (fresh data). */
export const DEMO_SESSION_KEY = "lens-demo";

/* ---------------- store ---------------- */

export type Backend = "local" | "cloud";
export type SyncState = "idle" | "syncing" | "saved" | "error";

interface AppState {
  // Preferences
  /** The user's theme preference: light, dark, or follow the OS ("system"). */
  theme: ThemePref;
  /** The concrete theme currently applied (resolves "system" to light/dark). */
  resolvedTheme: Theme;
  role: Role;
  sidebarCollapsed: boolean;
  cmdkOpen: boolean;
  hydrated: boolean;
  /** True once this user's personal prefs have been applied (synchronously in
      local/demo mode, after the cloud fetch in cloud mode). Lets pref-gated UI
      like the welcome modal wait for the real values instead of defaults. */
  prefsLoaded: boolean;
  signedOut: boolean;
  /** The auth user id this tab's workspace was loaded for. Supabase auth is
      shared per browser, so another tab signing into a different workspace
      switches the token under this tab — cloud writes check this and skip
      instead of attributing this tab's data to the wrong tenant. */
  authUid?: string;

  // Backend / cloud
  backend: Backend;
  authChecked: boolean;
  syncState: SyncState;
  syncError?: string;
  /** True while the user arrived via a password-recovery link and must set a new password. */
  recovery: boolean;
  /** True right after signing in with an admin-set temporary password — offers a change first. */
  firstLogin: boolean;
  /** Demo sandbox: seeded data on the local backend, zero cloud I/O, nothing persisted.
      Entered from the login screen; ends on sign-out or when the tab closes. */
  demo: boolean;
  /** The signed-in user's account (tenant) — null in local/demo mode or until
      the multi-tenancy migration is applied. Set by providers on cloud load. */
  account: AccountInfo | null;

  setTheme: (t: ThemePref) => void;
  /** Cycle the preference: light → dark → system → light. */
  cycleTheme: () => void;
  toggleSidebar: () => void;
  setCmdkOpen: (open: boolean) => void;
  hydrate: () => void;
  signOut: () => void;
  /** Sign in as a real team account; role gating follows that user's role. */
  signInAs: (userId: ID) => void;
  setAuthChecked: (v: boolean) => void;
  setSignedOut: (v: boolean) => void;
  setRecovery: (v: boolean) => void;
  setFirstLogin: (v: boolean) => void;
  /** Enter the demo sandbox: fresh seed data, researcher account, no cloud connection. */
  enterDemo: () => void;
  /** Populate the in-memory cache from a Supabase snapshot and go cloud-mode. */
  applyCloud: (snapshot: CloudSnapshot, activeProfileId: ID) => void;
  /** Merge cloud-loaded settings into prefs: shared workspace settings + the
      signed-in user's personal prefs, over the built-in defaults. */
  applyCloudPrefs: (personal: Record<string, string | boolean>, workspace: Record<string, string | boolean>) => void;

  // Feedback
  toasts: Toast[];
  toast: (msg: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: string) => void;

  // Reactive data version — bumped on every DB mutation
  dataVersion: number;

  // Entity CRUD (mutates module arrays, bumps version)
  addParticipant: (p: Participant) => void;
  updateParticipant: (id: ID, patch: Partial<Participant>) => void;
  deleteParticipant: (id: ID) => void;
  anonymizeParticipant: (id: ID) => void;
  scheduleParticipant: (id: ID, session: ScheduledSession) => void;
  /** Schedule a participant AND create the linked (future-dated) interview record. */
  scheduleInterview: (
    participantId: ID,
    opts: { title: string; projectId: ID; date: string; time: string; durationMinutes: number; researcherId: ID },
  ) => ID;
  cancelScheduledSession: (id: ID) => void;
  addCompany: (c: Company) => void;
  /** Patch a company — shared across every participant linked to it. */
  updateCompany: (id: ID, patch: Partial<Company>) => void;
  /** Remove a company. False (no-op) while any participant still references
      it — companyId is required, so that would dangle. */
  deleteCompany: (id: ID) => boolean;
  /** Move every participant from `sourceId` to `targetId`, then delete the
      source. The fix for duplicates that "type a new company" leaves behind. */
  mergeCompanies: (sourceId: ID, targetId: ID) => boolean;
  addProject: (p: ResearchProject) => void;
  updateProject: (id: ID, patch: Partial<ResearchProject>) => void;
  deleteProject: (id: ID) => void;
  addInterview: (iv: Interview) => void;
  updateInterview: (id: ID, patch: Partial<Interview>) => void;
  deleteInterview: (id: ID) => void;
  /** Mark a scheduled interview as conducted — flips status and completes the participant's session. */
  markInterviewConducted: (id: ID) => void;
  toggleFollowUp: (interviewId: ID, followUpId: ID) => void;
  addFollowUp: (interviewId: ID, followUp: FollowUp) => void;
  updateFollowUp: (interviewId: ID, followUpId: ID, patch: Partial<FollowUp>) => void;
  removeFollowUp: (interviewId: ID, followUpId: ID) => void;
  addAttachments: (interviewId: ID, attachments: Attachment[]) => void;
  addInsight: (i: Insight) => void;
  updateInsight: (id: ID, patch: Partial<Insight>) => void;
  deleteInsight: (id: ID) => void;
  mergeInsights: (keepId: ID, removeId: ID) => void;
  /** Link/unlink a source interview to an insight (keeps both sides + participant/project links). */
  linkInsightInterview: (insightId: ID, interviewId: ID) => void;
  unlinkInsightInterview: (insightId: ID, interviewId: ID) => void;
  /** Symmetric explicit link between two insights. */
  linkRelatedInsights: (aId: ID, bId: ID) => void;
  unlinkRelatedInsights: (aId: ID, bId: ID) => void;
  // Unmoderated tests (definitions only — sessions are read directly from
  // Supabase on the results page, never through the store).
  addTest: (t: UsabilityTest) => void;
  updateTest: (id: ID, patch: Partial<UsabilityTest>) => void;
  deleteTest: (id: ID) => void;
  addTagToLibrary: (label: string, kind: TagKind, accent?: string) => Tag;
  updateTag: (id: ID, patch: Partial<Tag>) => void;
  deleteTag: (id: ID) => void;
  addPersona: (p: Persona) => void;
  updatePersona: (id: ID, patch: Partial<Persona>) => void;
  deletePersona: (id: ID) => void;
  addTheme: (t: ThemeEntity) => void;
  updateTheme: (id: ID, patch: Partial<ThemeEntity>) => void;
  deleteTheme: (id: ID) => void;
  addUser: (u: User) => void;
  updateUser: (id: ID, patch: Partial<User>) => void;
  deleteUser: (id: ID) => boolean;
  setUserRole: (id: ID, role: Role) => void;

  // Settings / governance
  prefs: Record<string, string | boolean>;
  setPref: (key: string, value: string | boolean) => void;
  exportLog: ExportLogEntry[];
  logExport: (name: string, by: string) => void;
  dismissedAi: string[];
  dismissSuggestion: (id: string) => void;
  /** Drop dismissals for suggestions that no longer exist. Generated ids are
      random per run, so without this the list grows forever with dead entries —
      and a regenerated set would arrive already-hidden. */
  forgetDismissed: (ids: string[]) => void;
  resetDemoData: () => void;
  /**
   * Selectively empty the repository per content type (team, tags, themes,
   * and personas are always kept). Cross-references are cleaned up so the
   * remaining data stays consistent.
   */
  clearDataTypes: (sel: ClearSelection) => void;

  // Recent searches
  recentSearches: string[];
  addRecentSearch: (q: string) => void;

  // Kanban
  kanban: KanbanBoard[];
  moveKanbanCard: (boardId: string, cardId: string, toColumnId: string) => void;
  addKanbanCard: (boardId: string, columnId: string, title: string) => void;
  updateKanbanCard: (boardId: string, cardId: string, patch: Partial<KanbanCard>) => void;
  deleteKanbanCard: (boardId: string, cardId: string) => void;
  /** Replace the account's shared Kanban lanes (persisted as a workspace pref). */
  setKanbanStages: (stages: KanbanColumn[]) => void;
  /** Delete a lane, reassigning any insights/cards in it to an adjacent lane. */
  deleteKanbanStage: (stageId: string) => void;
  createProjectBoard: (projectId: ID, kind: "kanban" | "affinity") => string;

  // Affinity
  affinity: AffinityBoard[];
  moveAffinityNote: (boardId: string, noteId: string, toGroupId: string | null) => void;
  updateAffinityNote: (boardId: string, noteId: string, patch: Partial<AffinityNote>) => void;
  deleteAffinityNote: (boardId: string, noteId: string) => void;
  renameAffinityGroup: (boardId: string, groupId: string, title: string) => void;
  recolorAffinityGroup: (boardId: string, groupId: string, accent: string) => void;
  addAffinityGroup: (boardId: string, title: string) => void;
  mergeAffinityGroups: (boardId: string, sourceId: string, targetId: string) => void;
  addAffinityNote: (boardId: string, groupId: string | null, text: string, kind: HighlightKind) => void;
  /** Bulk-import captured research (highlights, key takeaways) as unsorted notes. */
  importAffinityNotes: (boardId: string, items: Omit<AffinityNote, "id" | "groupId">[]) => void;
  /** Mark a cluster as promoted: link it to the insight it produced. */
  linkAffinityGroupInsight: (boardId: string, groupId: string, insightId: ID) => void;
  applyAffinityClusters: (boardId: string, clusters: { title: string; noteIds: string[] }[]) => void;

  // Transcript highlights
  highlights: Record<string, TranscriptHighlight[]>;
  addHighlight: (h: TranscriptHighlight) => void;
  removeHighlight: (transcriptId: string, id: string) => void;
}

const systemPrefersDark = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
/** Resolve a preference (which may be "system") to the concrete applied theme. */
const resolveThemePref = (pref: ThemePref): Theme =>
  pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
const applyTheme = (pref: ThemePref) => {
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", resolveThemePref(pref) === "dark");
  }
};

const DEFAULT_COLUMNS = [
  { id: "c-raw", title: "Raw Findings", accent: "slate" },
  { id: "c-review", title: "Needs Review", accent: "amber" },
  { id: "c-valid", title: "Validated", accent: "blue" },
  { id: "c-opp", title: "Opportunity", accent: "violet" },
  { id: "c-backlog", title: "Product Backlog", accent: "teal" },
  { id: "c-done", title: "Completed", accent: "green" },
];

export const useApp = create<AppState>((set, get) => {
  /** Bump the data version so every subscribed view recomputes. */
  const bump = () => set((s) => ({ dataVersion: s.dataVersion + 1 }));

  /** Mirror a profile change to Supabase (admin-only tables bypass the
      general content mirror). No-op in local mode. */
  const cloudProfileWrite = (u: User) => {
    if (get().backend !== "cloud") return;
    void upsertProfile(u).then((r) => {
      if (!r.ok) set({ syncState: "error", syncError: r.error });
    });
  };
  const cloudProfileDelete = (id: ID) => {
    if (get().backend !== "cloud") return;
    // Deletes the profile row AND the Supabase auth user (login/email) via the
    // service role — the client can only reach the profile row, which would
    // leave the login orphaned and the email still registered.
    void (async () => {
      try {
        const { data } = (await supabase?.auth.getSession()) ?? {};
        const token = data?.session?.access_token;
        if (!token) return set({ syncState: "error", syncError: "Your session expired — sign in again." });
        const res = await fetch("/api/admin/delete-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          set({ syncState: "error", syncError: j.error ?? "Couldn't remove the user." });
        }
      } catch {
        set({ syncState: "error", syncError: "Couldn't reach the server to remove the user." });
      }
    })();
  };

  const toast: AppState["toast"] = (msg, kind = "success") => {
    const id = uid("toast");
    set((s) => ({ toasts: [...s.toasts, { id, msg, kind }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4200);
  };

  /** Deep-replace the in-memory DB + boards + highlights from a snapshot. */
  const applySnapshot = (snap: {
    profiles?: unknown[];
    companies?: unknown[];
    personas?: unknown[];
    tags?: unknown[];
    themes?: unknown[];
    participants?: unknown[];
    projects?: unknown[];
    interviews?: unknown[];
    insights?: unknown[];
    tests?: unknown[];
    kanbanBoards?: KanbanBoard[];
    affinityBoards?: AffinityBoard[];
    highlights?: TranscriptHighlight[];
  }) => {
    replaceContents(DB.users, (snap.profiles ?? []) as never[]);
    replaceContents(DB.companies, (snap.companies ?? []) as never[]);
    replaceContents(DB.personas, (snap.personas ?? []) as never[]);
    replaceContents(DB.tags, (snap.tags ?? []) as never[]);
    replaceContents(DB.themes, (snap.themes ?? []) as never[]);
    replaceContents(DB.participants, (snap.participants ?? []) as never[]);
    replaceContents(DB.projects, (snap.projects ?? []) as never[]);
    replaceContents(DB.interviews, (snap.interviews ?? []) as never[]);
    replaceContents(DB.insights, (snap.insights ?? []) as never[]);
    replaceContents(DB.tests, (snap.tests ?? []) as never[]);
    const highlights: Record<string, TranscriptHighlight[]> = {};
    for (const h of snap.highlights ?? []) (highlights[h.transcriptId] ||= []).push(h);
    return {
      kanban: (snap.kanbanBoards ?? []) as KanbanBoard[],
      affinity: (snap.affinityBoards ?? []) as AffinityBoard[],
      highlights,
    };
  };

  return {
    theme: "light",
    resolvedTheme: "light",
    role: "admin", // synced to the signed-in account's role
    sidebarCollapsed: false,
    cmdkOpen: false,
    hydrated: false,
    prefsLoaded: false,
    signedOut: false,
    backend: "local",
    authChecked: false,
    syncState: "idle",
    recovery: false,
    firstLogin: false,
    demo: false,
    account: null,

    setTheme: (pref) => {
      applyTheme(pref);
      try {
        localStorage.setItem("lens-theme", pref);
      } catch {}
      set({ theme: pref, resolvedTheme: resolveThemePref(pref) });
    },
    cycleTheme: () => {
      const order: ThemePref[] = ["light", "dark", "system"];
      get().setTheme(order[(order.indexOf(get().theme) + 1) % order.length]);
    },
    toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    setCmdkOpen: (cmdkOpen) => set({ cmdkOpen }),
    signOut: () => {
      if (get().demo) {
        // Leave the sandbox: drop the session marker and reboot into the
        // normal login flow (a reload also discards all demo edits).
        try {
          sessionStorage.removeItem(DEMO_SESSION_KEY);
        } catch {}
        window.location.reload();
        return;
      }
      set({ signedOut: true, firstLogin: false, recovery: false, account: null, authUid: undefined });
      if (get().backend === "cloud" && supabase) {
        void supabase.auth.signOut();
      } else {
        // Local mode: forget the account so a reload shows the login screen
        // again instead of silently restoring the session.
        try {
          localStorage.removeItem("lens-user");
        } catch {}
      }
    },
    signInAs: (userId) => {
      const user = getUser(userId);
      if (!user) return;
      setActiveUser(user.id);
      try {
        localStorage.setItem("lens-user", user.id);
      } catch {}
      set((s) => ({ signedOut: false, role: user.role, dataVersion: s.dataVersion + 1 }));
    },
    setAuthChecked: (authChecked) => set({ authChecked }),
    setSignedOut: (signedOut) => set({ signedOut }),
    setRecovery: (recovery) => set({ recovery }),
    setFirstLogin: (firstLogin) => set({ firstLogin }),
    enterDemo: () => {
      // A fresh sandbox every time: seed data, default settings, a researcher
      // account (the app's editing flows are its strength), and NO cloud I/O —
      // the persistence subscriber and cloud writers all skip demo sessions.
      (Object.keys(DB) as (keyof typeof DB)[]).forEach((k) => {
        replaceContents(DB[k] as unknown[], clone(SEED[k]) as unknown[]);
      });
      const demoUser = DB.users.find((u) => u.role === "researcher") ?? DB.users[0];
      setActiveUser(demoUser.id);
      try {
        sessionStorage.setItem(DEMO_SESSION_KEY, "1");
      } catch {}
      set((s) => ({
        demo: true,
        account: null,
        backend: "local",
        signedOut: false,
        authChecked: true,
        hydrated: true,
        prefsLoaded: true,
        recovery: false,
        firstLogin: false,
        role: demoUser.role,
        kanban: clone(kanbanBoards),
        affinity: clone(affinityBoards),
        highlights: seedHighlights(),
        // The demo is a showcase: the optional board tabs (off by default for
        // real workspaces) are on so visitors see Kanban + Affinity.
        prefs: { ...DEFAULT_PREFS, "tabs.affinity": true, "tabs.kanban": true },
        exportLog: SEED_EXPORT_LOG,
        dismissedAi: [],
        syncState: "idle",
        syncError: undefined,
        dataVersion: s.dataVersion + 1,
      }));
    },
    applyCloud: (snapshot, activeProfileId) => {
      const boards = applySnapshot(snapshot);
      primeSyncBaseline(snapshot);
      setActiveUser(activeProfileId);
      const me = getUser(activeProfileId);
      set((s) => ({
        ...boards,
        backend: "cloud",
        signedOut: false,
        authChecked: true,
        hydrated: true,
        // Reset until this user's personal prefs arrive (applyCloudPrefs), so
        // pref-gated UI doesn't read the previous user's or default values.
        prefsLoaded: false,
        role: me?.role ?? "viewer",
        // Real workspace: no seeded demo exports — only exports done here appear.
        exportLog: [],
        syncState: "idle",
        dataVersion: s.dataVersion + 1,
      }));
    },
    applyCloudPrefs: (personal, workspace) =>
      // Defaults first, then any per-browser fallback (covers a not-yet-migrated
      // schema), then shared workspace policy, then the user's personal overrides.
      // The cloud values win whenever present, so the DB stays authoritative.
      set(() => {
        let cached: Record<string, string | boolean> = {};
        try {
          const raw = localStorage.getItem(PREFS_KEY);
          if (raw) cached = JSON.parse(raw);
        } catch {}
        // Personal values for workspace-owned keys are dropped, not merged.
        // ai.* only became workspace policy after they'd already been written
        // personally, and personal wins below — so without this a member's
        // stale ai.provider would keep shadowing the workspace's, which is
        // precisely the bug this move fixes. Self-healing: no data migration
        // needed, the leftover rows just stop being read.
        const ownPersonal = Object.fromEntries(
          Object.entries(personal).filter(([k]) => !isWorkspacePref(k)),
        );
        return { prefsLoaded: true, prefs: { ...DEFAULT_PREFS, ...cached, ...workspace, ...ownPersonal } };
      }),

    hydrate: () => {
      if (get().hydrated) return;
      // Fixed default: light. Only an explicit saved choice changes it; "system"
      // is opt-in and then follows the OS.
      let theme: ThemePref = "light";
      try {
        const stored = localStorage.getItem("lens-theme");
        if (stored === "light" || stored === "dark" || stored === "system") theme = stored;
      } catch {}
      applyTheme(theme);

      // Restore persisted data so user edits survive reloads.
      const patch: Partial<AppState> = {};
      try {
        const raw = localStorage.getItem(PERSIST_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          if (saved?.v === 1 && Array.isArray(saved.db?.participants)) {
            (Object.keys(DB) as (keyof typeof DB)[]).forEach((k) => {
              if (Array.isArray(saved.db[k])) replaceContents(DB[k] as unknown[], saved.db[k]);
            });
            if (Array.isArray(saved.kanban)) patch.kanban = saved.kanban;
            if (Array.isArray(saved.affinity)) patch.affinity = saved.affinity;
            if (saved.highlights) patch.highlights = saved.highlights;
            if (saved.prefs) patch.prefs = { ...DEFAULT_PREFS, ...saved.prefs };
            if (Array.isArray(saved.exportLog)) patch.exportLog = saved.exportLog;
            if (Array.isArray(saved.dismissedAi)) patch.dismissedAi = saved.dismissedAi;
            if (Array.isArray(saved.recentSearches)) patch.recentSearches = saved.recentSearches;
          }
        }
      } catch {
        try {
          localStorage.removeItem(PERSIST_KEY);
        } catch {}
      }

      // Preferences live in their own key so they persist in every mode.
      try {
        const rawPrefs = localStorage.getItem(PREFS_KEY);
        if (rawPrefs) patch.prefs = { ...DEFAULT_PREFS, ...JSON.parse(rawPrefs) };
      } catch {}

      // Restore the signed-in account (after the users array is restored).
      // Auto-opening as the seed admin is a convenience for local DEVELOPMENT
      // only — a deployed (production) build without Supabase must never
      // impersonate anyone, so it shows the login screen unless this browser
      // explicitly signed in before.
      let role: Role = "admin";
      let signedOut = false;
      try {
        const storedUser = localStorage.getItem("lens-user");
        const restored = storedUser ? getUser(storedUser) : undefined;
        const user = restored || getUser(currentUserId) || users[0];
        if (user) {
          setActiveUser(user.id);
          role = user.role;
        }
        if (process.env.NODE_ENV === "production" && !restored) signedOut = true;
      } catch {
        if (process.env.NODE_ENV === "production") signedOut = true;
      }

      set({
        ...patch,
        signedOut,
        theme,
        resolvedTheme: resolveThemePref(theme),
        role,
        hydrated: true,
        prefsLoaded: true,
        authChecked: true,
        backend: "local",
        dataVersion: get().dataVersion + 1,
      });
    },

    toasts: [],
    toast,
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

    dataVersion: 0,

    /* ---------------- participants ---------------- */

    addParticipant: (p) => {
      DB.participants.push(p);
      bump();
    },
    updateParticipant: (id, patch) => {
      const i = DB.participants.findIndex((x) => x.id === id);
      if (i < 0) return;
      const before = DB.participants[i];
      DB.participants[i] = { ...before, ...patch };
      if (patch.consentStatus && patch.consentStatus !== before.consentStatus) {
        logAudit("updated consent", fullName(before), `${before.consentStatus} → ${patch.consentStatus}`);
      }
      bump();
    },
    deleteParticipant: (id) => {
      // Cascade: interviews, references on insights, projects, and boards —
      // relationships stay consistent. If this was the last participant at their
      // company, the now-empty company is removed too (no orphaned companies).
      const gone = DB.participants.find((p) => p.id === id);
      if (gone) logAudit("deleted participant (erasure)", fullName(gone));
      const companyId = DB.participants.find((p) => p.id === id)?.companyId;
      const ivIds = new Set(DB.interviews.filter((iv) => iv.participantId === id).map((iv) => iv.id));
      replaceContents(DB.interviews, DB.interviews.filter((iv) => iv.participantId !== id));
      replaceContents(DB.participants, DB.participants.filter((p) => p.id !== id));
      if (companyId && !DB.participants.some((p) => p.companyId === companyId)) {
        replaceContents(DB.companies, DB.companies.filter((c) => c.id !== companyId));
      }
      DB.projects.forEach((pr, i) => {
        DB.projects[i] = { ...pr, participantIds: pr.participantIds.filter((x) => x !== id) };
      });
      DB.insights.forEach((ins, i) => {
        DB.insights[i] = {
          ...ins,
          participantIds: ins.participantIds.filter((x) => x !== id),
          interviewIds: ins.interviewIds.filter((x) => !ivIds.has(x)),
        };
      });
      set((s) => ({
        kanban: s.kanban.map((b) => ({
          ...b,
          cards: b.cards.map((c) => (c.participantId === id ? { ...c, participantId: undefined } : c)),
        })),
        affinity: s.affinity.map((b) => ({
          ...b,
          notes: b.notes.map((n) =>
            n.sourceParticipantId === id ? { ...n, sourceParticipantId: undefined } : n,
          ),
        })),
      }));
      bump();
    },
    anonymizeParticipant: (id) => {
      const i = DB.participants.findIndex((x) => x.id === id);
      if (i < 0) return;
      const n = i + 1;
      DB.participants[i] = {
        ...DB.participants[i],
        firstName: "Participant",
        lastName: `#${n.toString().padStart(2, "0")}`,
        email: `participant-${n}@redacted.invalid`,
        phone: undefined,
        notes: "Personal data removed on request (GDPR).",
        avatarColor: "slate",
      };
      bump();
    },
    scheduleParticipant: (id, session) => {
      const i = DB.participants.findIndex((x) => x.id === id);
      if (i >= 0)
        DB.participants[i] = {
          ...DB.participants[i],
          recruitmentStatus: "scheduled",
          scheduledSession: session,
        };
      bump();
    },
    scheduleInterview: (participantId, o) => {
      // Create the (not-yet-conducted) interview record.
      const iv: Interview = {
        id: uid("iv"),
        title: o.title,
        status: "scheduled",
        participantId,
        projectIds: [o.projectId],
        researcherId: o.researcherId,
        date: o.date,
        durationMinutes: o.durationMinutes,
        sentiment: "neutral",
        meetingLink: undefined,
        hasRecording: false,
        aiSummary: "",
        keyObservations: [],
        notes: "",
        insightIds: [],
        attachments: [],
        followUps: [],
      };
      DB.interviews.push(iv);
      // Mark the participant scheduled and remember the interview it created.
      const pi = DB.participants.findIndex((p) => p.id === participantId);
      if (pi >= 0)
        DB.participants[pi] = {
          ...DB.participants[pi],
          recruitmentStatus: "scheduled",
          scheduledSession: { date: o.date, time: o.time, projectId: o.projectId, interviewId: iv.id },
        };
      // Ensure the participant is a member of the project.
      const prj = DB.projects.findIndex((p) => p.id === o.projectId);
      if (prj >= 0 && !DB.projects[prj].participantIds.includes(participantId))
        DB.projects[prj] = {
          ...DB.projects[prj],
          participantIds: [...DB.projects[prj].participantIds, participantId],
        };
      bump();
      return iv.id;
    },
    cancelScheduledSession: (id) => {
      const i = DB.participants.findIndex((x) => x.id === id);
      if (i < 0) return;
      const p = DB.participants[i];
      // Remove the auto-created interview only if nothing was captured in it yet.
      const ivId = p.scheduledSession?.interviewId;
      if (ivId) {
        const iv = DB.interviews.find((x) => x.id === ivId);
        const untouched =
          iv &&
          !iv.notes?.trim() &&
          !iv.aiSummary?.trim() &&
          iv.keyObservations.length === 0 &&
          iv.insightIds.length === 0;
        if (untouched) replaceContents(DB.interviews, DB.interviews.filter((x) => x.id !== ivId));
      }
      DB.participants[i] = {
        ...p,
        scheduledSession: undefined,
        recruitmentStatus: p.interviewCount > 0 ? "interviewed" : "available",
      };
      bump();
    },
    addCompany: (c) => {
      DB.companies.push(c);
      bump();
    },
    updateCompany: (id, patch) => {
      const i = DB.companies.findIndex((x) => x.id === id);
      if (i >= 0) DB.companies[i] = { ...DB.companies[i], ...patch };
      bump();
    },
    deleteCompany: (id) => {
      // Refused while participants still reference it: Participant.companyId is
      // required, so removing the company would leave dangling references.
      // Merge (below) is the way to empty a company first.
      if (DB.participants.some((p) => p.companyId === id)) return false;
      replaceContents(DB.companies, DB.companies.filter((c) => c.id !== id));
      bump();
      return true;
    },
    mergeCompanies: (sourceId, targetId) => {
      if (sourceId === targetId) return false;
      const target = DB.companies.find((c) => c.id === targetId);
      if (!target || !DB.companies.some((c) => c.id === sourceId)) return false;
      // Participants carry denormalized copies of their company's industry and
      // size, so move those to the target's values too — otherwise a merged
      // participant would keep claiming the company they no longer belong to.
      DB.participants.forEach((p, i) => {
        if (p.companyId !== sourceId) return;
        DB.participants[i] = {
          ...p,
          companyId: targetId,
          ...(target.industry ? { industry: target.industry } : {}),
          companySize: target.size ?? null,
        };
      });
      replaceContents(DB.companies, DB.companies.filter((c) => c.id !== sourceId));
      bump();
      return true;
    },

    /* ---------------- projects ---------------- */

    addProject: (p) => {
      DB.projects.push(p);
      bump();
    },
    updateProject: (id, patch) => {
      const i = DB.projects.findIndex((x) => x.id === id);
      if (i >= 0) DB.projects[i] = { ...DB.projects[i], ...patch };
      bump();
    },
    deleteProject: (id) => {
      // Interviews and insights can belong to several projects, so unlink
      // rather than delete them. Participants keep their records. Boards
      // scoped to this project are removed.
      replaceContents(DB.projects, DB.projects.filter((p) => p.id !== id));
      // Tests are project-owned (NOT NULL FK) — they go with the project,
      // like its boards; the DB cascade removes their sessions, and their
      // uploaded screenshots are cleaned up best-effort.
      {
        const acc = get().account;
        if (acc) DB.tests.filter((t) => t.projectId === id).forEach((t) => void removeTestAssets(acc.id, t.id));
      }
      replaceContents(DB.tests, DB.tests.filter((t) => t.projectId !== id));
      DB.interviews.forEach((iv, i) => {
        if (iv.projectIds.includes(id))
          DB.interviews[i] = { ...iv, projectIds: iv.projectIds.filter((p) => p !== id) };
      });
      DB.insights.forEach((ins, i) => {
        if (ins.projectIds.includes(id))
          DB.insights[i] = { ...ins, projectIds: ins.projectIds.filter((p) => p !== id) };
      });
      DB.participants.forEach((p, i) => {
        if (p.scheduledSession?.projectId === id)
          DB.participants[i] = {
            ...p,
            scheduledSession: { ...p.scheduledSession, projectId: undefined },
          };
      });
      set((s) => ({
        kanban: s.kanban.filter((b) => b.projectId !== id),
        affinity: s.affinity.filter((b) => b.projectId !== id),
      }));
      bump();
    },

    /* ---------------- interviews ---------------- */

    addInterview: (iv) => {
      DB.interviews.push(iv);
      const pi = DB.participants.findIndex((p) => p.id === iv.participantId);
      if (pi >= 0) {
        const p = DB.participants[pi];
        DB.participants[pi] = {
          ...p,
          interviewCount: p.interviewCount + 1,
          lastInterviewDate: iv.date,
          recruitmentStatus: "interviewed",
        };
      }
      // Ensure the participant is linked to the interview's projects.
      iv.projectIds.forEach((prId) => {
        const idx = DB.projects.findIndex((pr) => pr.id === prId);
        if (idx >= 0 && !DB.projects[idx].participantIds.includes(iv.participantId)) {
          DB.projects[idx] = {
            ...DB.projects[idx],
            participantIds: [...DB.projects[idx].participantIds, iv.participantId],
          };
        }
      });
      bump();
    },
    updateInterview: (id, patch) => {
      const i = DB.interviews.findIndex((x) => x.id === id);
      if (i >= 0) DB.interviews[i] = { ...DB.interviews[i], ...patch };
      bump();
    },
    deleteInterview: (id) => {
      const iv = DB.interviews.find((x) => x.id === id);
      if (!iv) return;
      // Insights it fed keep existing but lose the link to it.
      replaceContents(DB.interviews, DB.interviews.filter((x) => x.id !== id));
      DB.insights.forEach((ins, i) => {
        DB.insights[i] = {
          ...ins,
          interviewIds: ins.interviewIds.filter((x) => x !== id),
        };
      });
      // Recompute the participant's interview stats from what remains.
      const pi = DB.participants.findIndex((p) => p.id === iv.participantId);
      if (pi >= 0) {
        const p = DB.participants[pi];
        const remaining = DB.interviews.filter((x) => x.participantId === p.id);
        DB.participants[pi] = {
          ...p,
          interviewCount: remaining.length,
          lastInterviewDate: remaining.map((r) => r.date).sort().at(-1),
          recruitmentStatus:
            remaining.length === 0 && p.recruitmentStatus === "interviewed"
              ? "available"
              : p.recruitmentStatus,
        };
      }
      // Board cards that pointed at this interview lose that link.
      set((s) => ({
        kanban: s.kanban.map((b) => ({
          ...b,
          cards: b.cards.map((c) => ({
            ...c,
            interviewId: c.interviewId === id ? undefined : c.interviewId,
          })),
        })),
        // Highlights are keyed by transcript; drop this interview's transcript.
        highlights: iv.transcriptId
          ? Object.fromEntries(Object.entries(s.highlights).filter(([tid]) => tid !== iv.transcriptId))
          : s.highlights,
      }));
      bump();
    },
    markInterviewConducted: (id) => {
      const vi = DB.interviews.findIndex((x) => x.id === id);
      if (vi < 0) return;
      const iv = DB.interviews[vi];
      const wasScheduled = iv.status === "scheduled";
      DB.interviews[vi] = { ...iv, status: "completed" };
      // Complete the participant's scheduled session and count it as conducted.
      const pi = DB.participants.findIndex((p) => p.id === iv.participantId);
      if (pi >= 0) {
        const p = DB.participants[pi];
        const clearsSession = p.scheduledSession?.interviewId === id;
        const latest = [p.lastInterviewDate, iv.date].filter(Boolean).sort().at(-1);
        DB.participants[pi] = {
          ...p,
          scheduledSession: clearsSession ? undefined : p.scheduledSession,
          recruitmentStatus: "interviewed",
          interviewCount: wasScheduled ? p.interviewCount + 1 : p.interviewCount,
          lastInterviewDate: latest,
        };
      }
      bump();
    },
    toggleFollowUp: (interviewId, followUpId) => {
      const i = DB.interviews.findIndex((x) => x.id === interviewId);
      if (i < 0) return;
      DB.interviews[i] = {
        ...DB.interviews[i],
        followUps: DB.interviews[i].followUps.map((f) =>
          f.id === followUpId ? { ...f, done: !f.done } : f,
        ),
      };
      bump();
    },
    addFollowUp: (interviewId, followUp) => {
      const i = DB.interviews.findIndex((x) => x.id === interviewId);
      if (i < 0) return;
      DB.interviews[i] = { ...DB.interviews[i], followUps: [...DB.interviews[i].followUps, followUp] };
      bump();
    },
    updateFollowUp: (interviewId, followUpId, patch) => {
      const i = DB.interviews.findIndex((x) => x.id === interviewId);
      if (i < 0) return;
      DB.interviews[i] = {
        ...DB.interviews[i],
        followUps: DB.interviews[i].followUps.map((f) => (f.id === followUpId ? { ...f, ...patch } : f)),
      };
      bump();
    },
    removeFollowUp: (interviewId, followUpId) => {
      const i = DB.interviews.findIndex((x) => x.id === interviewId);
      if (i < 0) return;
      DB.interviews[i] = {
        ...DB.interviews[i],
        followUps: DB.interviews[i].followUps.filter((f) => f.id !== followUpId),
      };
      bump();
    },
    addAttachments: (interviewId, attachments) => {
      const i = DB.interviews.findIndex((x) => x.id === interviewId);
      if (i < 0) return;
      DB.interviews[i] = {
        ...DB.interviews[i],
        attachments: [...DB.interviews[i].attachments, ...attachments],
      };
      bump();
    },

    /* ---------------- insights ---------------- */

    addInsight: (ins) => {
      DB.insights.push(ins);
      // Back-link from source interviews.
      ins.interviewIds.forEach((ivId) => {
        const i = DB.interviews.findIndex((x) => x.id === ivId);
        if (i >= 0 && !DB.interviews[i].insightIds.includes(ins.id)) {
          DB.interviews[i] = {
            ...DB.interviews[i],
            insightIds: [...DB.interviews[i].insightIds, ins.id],
          };
        }
      });
      bump();
    },
    updateInsight: (id, patch) => {
      const i = DB.insights.findIndex((x) => x.id === id);
      if (i >= 0) DB.insights[i] = { ...DB.insights[i], ...patch };
      bump();
    },
    deleteInsight: (id) => {
      if (!DB.insights.some((x) => x.id === id)) return;
      replaceContents(DB.insights, DB.insights.filter((x) => x.id !== id));
      // Source interviews keep existing but lose the back-link.
      DB.interviews.forEach((iv, i) => {
        if (iv.insightIds.includes(id))
          DB.interviews[i] = { ...iv, insightIds: iv.insightIds.filter((x) => x !== id) };
      });
      // Board cards and highlights that pointed at it lose that link.
      set((s) => ({
        kanban: s.kanban.map((b) => ({
          ...b,
          cards: b.cards.map((c) => (c.insightId === id ? { ...c, insightId: undefined } : c)),
        })),
        highlights: Object.fromEntries(
          Object.entries(s.highlights).map(([k, list]) => [
            k,
            list.map((h) => (h.linkedInsightId === id ? { ...h, linkedInsightId: undefined } : h)),
          ]),
        ),
      }));
      bump();
    },
    linkInsightInterview: (insightId, interviewId) => {
      const ii = DB.insights.findIndex((x) => x.id === insightId);
      const vi = DB.interviews.findIndex((x) => x.id === interviewId);
      if (ii < 0 || vi < 0) return;
      const iv = DB.interviews[vi];
      const ins = DB.insights[ii];
      const uniq = (a: ID[]) => [...new Set(a)];
      DB.insights[ii] = {
        ...ins,
        interviewIds: uniq([...ins.interviewIds, interviewId]),
        // Keep the insight's people/projects consistent with its sources.
        participantIds: uniq([...ins.participantIds, iv.participantId]),
        projectIds: uniq([...ins.projectIds, ...iv.projectIds]),
      };
      if (!iv.insightIds.includes(insightId))
        DB.interviews[vi] = { ...iv, insightIds: [...iv.insightIds, insightId] };
      bump();
    },
    unlinkInsightInterview: (insightId, interviewId) => {
      const ii = DB.insights.findIndex((x) => x.id === insightId);
      if (ii >= 0)
        DB.insights[ii] = {
          ...DB.insights[ii],
          interviewIds: DB.insights[ii].interviewIds.filter((x) => x !== interviewId),
        };
      const vi = DB.interviews.findIndex((x) => x.id === interviewId);
      if (vi >= 0)
        DB.interviews[vi] = {
          ...DB.interviews[vi],
          insightIds: DB.interviews[vi].insightIds.filter((x) => x !== insightId),
        };
      bump();
    },
    linkRelatedInsights: (aId, bId) => {
      if (aId === bId) return;
      const add = (id: ID, other: ID) => {
        const i = DB.insights.findIndex((x) => x.id === id);
        if (i < 0) return;
        const cur = DB.insights[i].relatedInsightIds ?? [];
        if (!cur.includes(other))
          DB.insights[i] = { ...DB.insights[i], relatedInsightIds: [...cur, other] };
      };
      add(aId, bId);
      add(bId, aId);
      bump();
    },
    unlinkRelatedInsights: (aId, bId) => {
      const remove = (id: ID, other: ID) => {
        const i = DB.insights.findIndex((x) => x.id === id);
        if (i < 0) return;
        DB.insights[i] = {
          ...DB.insights[i],
          relatedInsightIds: (DB.insights[i].relatedInsightIds ?? []).filter((x) => x !== other),
        };
      };
      remove(aId, bId);
      remove(bId, aId);
      bump();
    },
    mergeInsights: (keepId, removeId) => {
      const keep = DB.insights.find((x) => x.id === keepId);
      const remove = DB.insights.find((x) => x.id === removeId);
      if (!keep || !remove) return;
      const union = (a: ID[], b: ID[]) => [...new Set([...a, ...b])];
      const ki = DB.insights.findIndex((x) => x.id === keepId);
      DB.insights[ki] = {
        ...keep,
        participantIds: union(keep.participantIds, remove.participantIds),
        interviewIds: union(keep.interviewIds, remove.interviewIds),
        projectIds: union(keep.projectIds, remove.projectIds),
        themeIds: union(keep.themeIds, remove.themeIds),
        tagIds: union(keep.tagIds, remove.tagIds),
        personaIds: union(keep.personaIds, remove.personaIds),
        evidence: `${keep.evidence} Merged with “${remove.title}”: ${remove.evidence}`,
      };
      replaceContents(DB.insights, DB.insights.filter((x) => x.id !== removeId));
      DB.interviews.forEach((iv, i) => {
        if (iv.insightIds.includes(removeId)) {
          DB.interviews[i] = {
            ...iv,
            insightIds: union(iv.insightIds.filter((x) => x !== removeId), [keepId]),
          };
        }
      });
      set((s) => ({
        kanban: s.kanban.map((b) => ({
          ...b,
          cards: b.cards.map((c) => (c.insightId === removeId ? { ...c, insightId: keepId } : c)),
        })),
        highlights: Object.fromEntries(
          Object.entries(s.highlights).map(([k, list]) => [
            k,
            list.map((h) => (h.linkedInsightId === removeId ? { ...h, linkedInsightId: keepId } : h)),
          ]),
        ),
      }));
      bump();
    },

    /* ---------------- unmoderated tests ---------------- */

    addTest: (t) => {
      DB.tests.push(t);
      bump();
    },
    updateTest: (id, patch) => {
      const i = DB.tests.findIndex((x) => x.id === id);
      if (i >= 0) DB.tests[i] = { ...DB.tests[i], ...patch };
      bump();
    },
    deleteTest: (id) => {
      const gone = DB.tests.find((x) => x.id === id);
      if (!gone) return;
      // The DB cascade also removes the test's sessions — participant data.
      logAudit("deleted test", gone.name, "including all participant sessions");
      // Uploaded screenshots go too (best-effort, never blocks the delete).
      const acc = get().account;
      if (acc) void removeTestAssets(acc.id, id);
      replaceContents(DB.tests, DB.tests.filter((x) => x.id !== id));
      bump();
    },

    addTagToLibrary: (label, kind, accent = "slate") => {
      const existing = DB.tags.find((t) => t.label.toLowerCase() === label.toLowerCase());
      if (existing) return existing;
      const tag: Tag = { id: uid("tag"), label, kind, accent };
      DB.tags.push(tag);
      bump();
      return tag;
    },
    updateTag: (id, patch) => {
      const i = DB.tags.findIndex((x) => x.id === id);
      if (i >= 0) DB.tags[i] = { ...DB.tags[i], ...patch };
      bump();
    },
    deleteTag: (id) => {
      replaceContents(DB.tags, DB.tags.filter((t) => t.id !== id));
      // Cascade: strip the tag from everything that referenced it.
      DB.participants.forEach((p, i) => {
        DB.participants[i] = {
          ...p,
          behaviourTagIds: p.behaviourTagIds.filter((t) => t !== id),
          painPointTagIds: p.painPointTagIds.filter((t) => t !== id),
        };
      });
      DB.insights.forEach((ins, i) => {
        DB.insights[i] = { ...ins, tagIds: ins.tagIds.filter((t) => t !== id) };
      });
      set((s) => ({
        kanban: s.kanban.map((b) => ({
          ...b,
          cards: b.cards.map((c) => ({ ...c, tagIds: c.tagIds.filter((t) => t !== id) })),
        })),
        highlights: Object.fromEntries(
          Object.entries(s.highlights).map(([k, list]) => [
            k,
            list.map((h) => ({ ...h, tagIds: h.tagIds.filter((t) => t !== id) })),
          ]),
        ),
      }));
      bump();
    },

    /* ---------------- taxonomy: personas & themes ---------------- */

    addPersona: (p) => {
      DB.personas.push(p);
      bump();
    },
    updatePersona: (id, patch) => {
      const i = DB.personas.findIndex((x) => x.id === id);
      if (i >= 0) DB.personas[i] = { ...DB.personas[i], ...patch };
      bump();
    },
    deletePersona: (id) => {
      replaceContents(DB.personas, DB.personas.filter((p) => p.id !== id));
      // Cascade: strip the persona from everything that referenced it.
      DB.participants.forEach((p, i) => {
        DB.participants[i] = { ...p, personaIds: p.personaIds.filter((x) => x !== id) };
      });
      DB.insights.forEach((ins, i) => {
        DB.insights[i] = { ...ins, personaIds: ins.personaIds.filter((x) => x !== id) };
      });
      bump();
    },
    addTheme: (t) => {
      DB.themes.push(t);
      bump();
    },
    updateTheme: (id, patch) => {
      const i = DB.themes.findIndex((x) => x.id === id);
      if (i >= 0) DB.themes[i] = { ...DB.themes[i], ...patch };
      bump();
    },
    deleteTheme: (id) => {
      replaceContents(DB.themes, DB.themes.filter((t) => t.id !== id));
      // Cascade: strip the theme from every insight that referenced it.
      DB.insights.forEach((ins, i) => {
        DB.insights[i] = { ...ins, themeIds: ins.themeIds.filter((x) => x !== id) };
      });
      bump();
    },

    /* ---------------- users / profiles ----------------
       Profiles bypass the general mirror (admin-only RLS); write them
       directly here when signed into the cloud. */

    addUser: (u) => {
      DB.users.push(u);
      cloudProfileWrite(u);
      logAudit("added team member", u.name, u.role);
      bump();
    },
    updateUser: (id, patch) => {
      const i = DB.users.findIndex((x) => x.id === id);
      if (i < 0) return;
      const before = DB.users[i];
      DB.users[i] = { ...before, ...patch };
      if (id === currentUserId && patch.role) set({ role: patch.role });
      cloudProfileWrite(DB.users[i]);
      if (patch.role && patch.role !== before.role) logAudit("changed role", before.name, `${before.role} → ${patch.role}`);
      if (patch.aiEnabled !== undefined && patch.aiEnabled !== before.aiEnabled) {
        logAudit("changed AI access", before.name, patch.aiEnabled === false ? "disabled" : "enabled");
      }
      bump();
    },
    deleteUser: (id) => {
      if (id === currentUserId) return false; // can't delete the signed-in account
      const gone = DB.users.find((u) => u.id === id);
      replaceContents(DB.users, DB.users.filter((u) => u.id !== id));
      DB.projects.forEach((pr, i) => {
        DB.projects[i] = { ...pr, memberIds: pr.memberIds.filter((m) => m !== id) };
      });
      cloudProfileDelete(id);
      if (gone) logAudit("removed team member", gone.name);
      bump();
      return true;
    },
    setUserRole: (id, role) => {
      const i = DB.users.findIndex((x) => x.id === id);
      if (i >= 0) {
        if (DB.users[i].role !== role) logAudit("changed role", DB.users[i].name, `${DB.users[i].role} → ${role}`);
        DB.users[i] = { ...DB.users[i], role };
      }
      if (id === currentUserId) set({ role });
      if (i >= 0) cloudProfileWrite(DB.users[i]);
      bump();
    },

    /* ---------------- settings / governance ---------------- */

    prefs: { ...DEFAULT_PREFS },
    setPref: (key, value) =>
      set((s) => {
        const prefs = { ...s.prefs, [key]: value };
        // GDPR policy flips are compliance-relevant; other prefs are too noisy.
        if (key.startsWith("gdpr.") && s.prefs[key] !== value) logAudit("changed GDPR policy", key, String(value));
        if (s.demo) {
          // Demo sandbox: settings live only until the tab closes.
        } else if (s.backend === "cloud") {
          // Personal prefs follow the user's account; gdpr.*/tabs.* are shared
          // workspace policy (admin-writable). Debounced cloud writes; the API
          // key is never routed here in cloud mode (it goes through saveAiKey).
          schedulePrefSave(isWorkspacePref(key) ? "workspace" : "personal");
        } else {
          // Local mode: everything lives in this browser, in its own key so it
          // survives reloads independent of the data blob.
          try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
          } catch {}
        }
        return { prefs };
      }),

    exportLog: SEED_EXPORT_LOG,
    logExport: (name, by) => {
      logAudit("exported data", name);
      set((s) => ({
        exportLog: [
          { id: uid("ex"), name, date: new Date().toISOString().slice(0, 10), by },
          ...s.exportLog,
        ].slice(0, 20),
      }));
    },

    dismissedAi: [],
    dismissSuggestion: (id) => set((s) => ({ dismissedAi: [...new Set([...s.dismissedAi, id])] })),
    forgetDismissed: (ids) =>
      set((s) => ({ dismissedAi: s.dismissedAi.filter((x) => !ids.includes(x)) })),

    resetDemoData: () => {
      (Object.keys(DB) as (keyof typeof DB)[]).forEach((k) => {
        replaceContents(DB[k] as unknown[], clone(SEED[k]) as unknown[]);
      });
      try {
        localStorage.removeItem(PERSIST_KEY);
        localStorage.removeItem(PREFS_KEY);
      } catch {}
      // The signed-in account may not survive the reset (e.g. an invited user).
      if (!DB.users.some((u) => u.id === currentUserId)) {
        setActiveUser(DB.users[0].id);
        set({ role: DB.users[0].role });
      } else {
        set({ role: DB.users.find((u) => u.id === currentUserId)!.role });
      }
      set({
        kanban: clone(kanbanBoards),
        affinity: clone(affinityBoards),
        highlights: seedHighlights(),
        // Keep the board tabs on after a reset too (matches enterDemo).
        prefs: { ...DEFAULT_PREFS, "tabs.affinity": true, "tabs.kanban": true },
        exportLog: SEED_EXPORT_LOG,
        dismissedAi: [],
      });
      bump();
    },

    clearDataTypes: (sel) => {
      const cleared = (Object.keys(sel) as (keyof ClearSelection)[]).filter((k) => sel[k]).join(", ");
      if (cleared) logAudit("cleared data", cleared);
      // Resolve removal sets up front so cascades are consistent:
      // removing participants also removes their interviews.
      const removedParticipants = new Set(sel.participants ? DB.participants.map((p) => p.id) : []);
      const removedInterviews = new Set(
        DB.interviews
          .filter((iv) => sel.interviews || removedParticipants.has(iv.participantId))
          .map((iv) => iv.id),
      );
      const removedInsights = new Set(sel.insights ? DB.insights.map((i) => i.id) : []);
      const removedProjects = new Set(sel.projects ? DB.projects.map((p) => p.id) : []);

      if (sel.participants) {
        replaceContents(DB.participants, []);
        replaceContents(DB.companies, []);
      }
      replaceContents(DB.interviews, DB.interviews.filter((iv) => !removedInterviews.has(iv.id)));
      if (sel.insights) replaceContents(DB.insights, []);
      if (sel.projects) replaceContents(DB.projects, []);
      // Tests are project-owned: they go with their projects (FK NOT NULL),
      // uploaded screenshots included (best-effort).
      {
        const acc = get().account;
        if (acc) DB.tests.filter((t) => removedProjects.has(t.projectId)).forEach((t) => void removeTestAssets(acc.id, t.id));
      }
      replaceContents(DB.tests, DB.tests.filter((t) => !removedProjects.has(t.projectId)));

      // Scrub dangling references on whatever remains.
      DB.interviews.forEach((iv, i) => {
        DB.interviews[i] = {
          ...iv,
          projectIds: iv.projectIds.filter((id) => !removedProjects.has(id)),
          insightIds: iv.insightIds.filter((id) => !removedInsights.has(id)),
        };
      });
      DB.insights.forEach((ins, i) => {
        DB.insights[i] = {
          ...ins,
          projectIds: ins.projectIds.filter((id) => !removedProjects.has(id)),
          participantIds: ins.participantIds.filter((id) => !removedParticipants.has(id)),
          interviewIds: ins.interviewIds.filter((id) => !removedInterviews.has(id)),
        };
      });
      DB.projects.forEach((pr, i) => {
        DB.projects[i] = {
          ...pr,
          participantIds: pr.participantIds.filter((id) => !removedParticipants.has(id)),
        };
      });
      if (removedInterviews.size > 0) {
        DB.participants.forEach((p, i) => {
          const remaining = DB.interviews.filter((iv) => iv.participantId === p.id);
          DB.participants[i] = {
            ...p,
            interviewCount: remaining.length,
            lastInterviewDate: remaining.map((r) => r.date).sort().at(-1),
            recruitmentStatus:
              remaining.length === 0 && p.recruitmentStatus === "interviewed"
                ? "available"
                : p.recruitmentStatus,
          };
        });
      }

      set((s) => {
        // Project-scoped boards go with their projects; cards/notes that
        // pointed at removed records are dropped or unlinked.
        let kanban = s.kanban
          .filter((b) => !b.projectId || !removedProjects.has(b.projectId))
          .map((b) => ({
            ...b,
            cards: b.cards
              .filter((c) => !(c.insightId && removedInsights.has(c.insightId)))
              .map((c) => ({
                ...c,
                participantId:
                  c.participantId && removedParticipants.has(c.participantId) ? undefined : c.participantId,
                interviewId:
                  c.interviewId && removedInterviews.has(c.interviewId) ? undefined : c.interviewId,
              })),
          }));
        let affinity = s.affinity
          .filter((b) => !b.projectId || !removedProjects.has(b.projectId))
          .map((b) => ({
            ...b,
            notes: b.notes.filter(
              (n) => !(n.sourceParticipantId && removedParticipants.has(n.sourceParticipantId)),
            ),
          }));
        if (kanban.length === 0)
          kanban = [{ id: uid("kb"), name: "Insight Triage", columns: clone(DEFAULT_COLUMNS), cards: [] }];
        if (affinity.length === 0)
          affinity = [
            {
              id: uid("af"),
              name: "Affinity Map",
              groups: [
                { id: uid("ag"), title: "Cluster 1", accent: "blue" },
                { id: uid("ag"), title: "Cluster 2", accent: "amber" },
              ],
              notes: [],
            },
          ];

        const highlights =
          sel.interviews || sel.participants
            ? {}
            : Object.fromEntries(
                Object.entries(s.highlights).map(([k, list]) => [
                  k,
                  list.map((h) =>
                    h.linkedInsightId && removedInsights.has(h.linkedInsightId)
                      ? { ...h, linkedInsightId: undefined }
                      : h,
                  ),
                ]),
              );

        return {
          kanban,
          affinity,
          highlights,
          // Demo AI suggestions describe demo content — retire them all once
          // any content type is cleared.
          dismissedAi:
            sel.projects || sel.participants || sel.interviews || sel.insights
              ? aiSuggestions.map((x) => x.id)
              : s.dismissedAi,
        };
      });
      bump();
    },

    recentSearches: [],
    addRecentSearch: (q) =>
      set((s) => ({
        recentSearches: [q, ...s.recentSearches.filter((x) => x !== q)].slice(0, 6),
      })),

    /* ---------------- kanban ---------------- */

    kanban: clone(kanbanBoards),
    moveKanbanCard: (boardId, cardId, toColumnId) =>
      set((s) => ({
        kanban: s.kanban.map((b) => {
          if (b.id !== boardId) return b;
          const card = b.cards.find((c) => c.id === cardId);
          if (!card || card.columnId === toColumnId) return b;
          const rest = b.cards.filter((c) => c.id !== cardId);
          return { ...b, cards: [...rest, { ...card, columnId: toColumnId }] };
        }),
      })),
    addKanbanCard: (boardId, columnId, title) =>
      set((s) => ({
        kanban: s.kanban.map((b) =>
          b.id === boardId
            ? { ...b, cards: [...b.cards, { id: uid("kc"), columnId, title, tagIds: [] }] }
            : b,
        ),
      })),
    updateKanbanCard: (boardId, cardId, patch) =>
      set((s) => ({
        kanban: s.kanban.map((b) =>
          b.id === boardId
            ? { ...b, cards: b.cards.map((c) => (c.id === cardId ? { ...c, ...patch } : c)) }
            : b,
        ),
      })),
    deleteKanbanCard: (boardId, cardId) =>
      set((s) => ({
        kanban: s.kanban.map((b) =>
          b.id === boardId ? { ...b, cards: b.cards.filter((c) => c.id !== cardId) } : b,
        ),
      })),
    setKanbanStages: (stages) => {
      // Shared per account — rides the workspace-pref sync as a JSON string.
      get().setPref(KANBAN_STAGES_PREF, JSON.stringify(stages));
    },
    deleteKanbanStage: (stageId) => {
      const stages = parseStages(get().prefs[KANBAN_STAGES_PREF]);
      if (stages.length <= 1) return; // always keep at least one lane
      const idx = stages.findIndex((s) => s.id === stageId);
      if (idx < 0) return;
      const next = stages.filter((s) => s.id !== stageId);
      const fallback = (stages[idx - 1] ?? next[0]).id; // move to the lane on the left
      // Reassign insights and spike cards that lived in the removed lane.
      DB.insights.forEach((ins, i) => {
        if (ins.workflowStage === stageId) DB.insights[i] = { ...ins, workflowStage: fallback };
      });
      set((s) => ({
        kanban: s.kanban.map((b) => ({
          ...b,
          cards: b.cards.map((c) => (c.columnId === stageId ? { ...c, columnId: fallback } : c)),
        })),
      }));
      get().setPref(KANBAN_STAGES_PREF, JSON.stringify(next));
      bump();
    },
    createProjectBoard: (projectId, kind) => {
      const project = DB.projects.find((p) => p.id === projectId);
      const name = `${project?.name ?? "Project"} — ${kind === "kanban" ? "Board" : "Affinity Map"}`;
      const id = uid(kind === "kanban" ? "kb" : "af");
      if (kind === "kanban") {
        set((s) => ({
          kanban: [...s.kanban, { id, projectId, name, columns: clone(DEFAULT_COLUMNS), cards: [] }],
        }));
      } else {
        set((s) => ({
          affinity: [
            ...s.affinity,
            {
              id,
              projectId,
              name,
              groups: [
                { id: uid("ag"), title: "Cluster 1", accent: "blue" },
                { id: uid("ag"), title: "Cluster 2", accent: "amber" },
              ],
              notes: [],
            },
          ],
        }));
      }
      bump();
      return id;
    },

    /* ---------------- affinity ---------------- */

    affinity: clone(affinityBoards),
    moveAffinityNote: (boardId, noteId, toGroupId) =>
      set((s) => ({
        affinity: s.affinity.map((b) => {
          if (b.id !== boardId) return b;
          const note = b.notes.find((n) => n.id === noteId);
          if (!note) return b;
          const rest = b.notes.filter((n) => n.id !== noteId);
          return { ...b, notes: [...rest, { ...note, groupId: toGroupId }] };
        }),
      })),
    renameAffinityGroup: (boardId, groupId, title) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, groups: b.groups.map((g) => (g.id === groupId ? { ...g, title } : g)) }
            : b,
        ),
      })),
    recolorAffinityGroup: (boardId, groupId, accent) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, groups: b.groups.map((g) => (g.id === groupId ? { ...g, accent } : g)) }
            : b,
        ),
      })),
    addAffinityGroup: (boardId, title) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, groups: [...b.groups, { id: uid("ag"), title, accent: "slate" }] }
            : b,
        ),
      })),
    mergeAffinityGroups: (boardId, sourceId, targetId) =>
      set((s) => ({
        affinity: s.affinity.map((b) => {
          if (b.id !== boardId) return b;
          return {
            ...b,
            groups: b.groups.filter((g) => g.id !== sourceId),
            notes: b.notes.map((n) => (n.groupId === sourceId ? { ...n, groupId: targetId } : n)),
          };
        }),
      })),
    addAffinityNote: (boardId, groupId, text, kind) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, notes: [...b.notes, { id: uid("an"), text, kind, groupId }] }
            : b,
        ),
      })),
    importAffinityNotes: (boardId, items) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, notes: [...b.notes, ...items.map((n) => ({ ...n, id: uid("an"), groupId: null }))] }
            : b,
        ),
      })),
    linkAffinityGroupInsight: (boardId, groupId, insightId) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, groups: b.groups.map((g) => (g.id === groupId ? { ...g, insightId } : g)) }
            : b,
        ),
      })),
    applyAffinityClusters: (boardId, clusters) =>
      set((s) => ({
        affinity: s.affinity.map((b) => {
          if (b.id !== boardId) return b;
          const palette = ["blue", "violet", "teal", "amber", "rose", "green", "cyan", "orange"];
          const valid = clusters.filter((c) => c.title?.trim() && c.noteIds?.length);
          const noteIds = new Set(b.notes.map((n) => n.id));
          const groups = valid.map((c, i) => ({
            id: uid("ag"),
            title: c.title.trim(),
            accent: palette[i % palette.length],
            aiSuggested: true,
          }));
          const noteToGroup = new Map<string, string>();
          valid.forEach((c, i) =>
            c.noteIds.forEach((nid) => {
              if (noteIds.has(nid)) noteToGroup.set(nid, groups[i].id);
            }),
          );
          return {
            ...b,
            groups: [...b.groups, ...groups],
            notes: b.notes.map((n) =>
              noteToGroup.has(n.id) ? { ...n, groupId: noteToGroup.get(n.id)! } : n,
            ),
          };
        }),
      })),
    updateAffinityNote: (boardId, noteId, patch) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId
            ? { ...b, notes: b.notes.map((n) => (n.id === noteId ? { ...n, ...patch } : n)) }
            : b,
        ),
      })),
    deleteAffinityNote: (boardId, noteId) =>
      set((s) => ({
        affinity: s.affinity.map((b) =>
          b.id === boardId ? { ...b, notes: b.notes.filter((n) => n.id !== noteId) } : b,
        ),
      })),

    /* ---------------- transcript highlights ---------------- */

    highlights: seedHighlights(),
    addHighlight: (h) =>
      set((s) => ({
        highlights: {
          ...s.highlights,
          [h.transcriptId]: [...(s.highlights[h.transcriptId] ?? []), h],
        },
      })),
    removeHighlight: (transcriptId, id) =>
      set((s) => ({
        highlights: {
          ...s.highlights,
          [transcriptId]: (s.highlights[transcriptId] ?? []).filter((h) => h.id !== id),
        },
      })),
  };
});

/** Subscribe to data changes — call in any component that reads db.ts helpers. */
export const useDb = () => useApp((s) => s.dataVersion);

/* ---------------- persistence (debounced, client only) ---------------- */

function persistAll(s: AppState) {
  try {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        v: 1,
        db: DB,
        kanban: s.kanban,
        affinity: s.affinity,
        highlights: s.highlights,
        prefs: s.prefs,
        exportLog: s.exportLog,
        dismissedAi: s.dismissedAi,
        recentSearches: s.recentSearches,
      }),
    );
  } catch {}
}

/* ---------------- settings buckets (per-user vs shared workspace) ---------------- */

/** Personal ai.* keys — everything else under ai.* is admin-set workspace
    policy (see below). The saved-suggestions blob is one user's generated set,
    and every role may write it, so it must not go to the admin-only bucket. */
const PERSONAL_AI_PREFS = ["ai.savedSuggestions"];

/**
 * gdpr.*, tabs.*, kanban.* and ai.* are shared workspace policy; everything
 * else is personal.
 *
 * ai.* belongs here because Settings → AI configuration sits behind AdminGate:
 * the provider, model, and every assisted-feature toggle are presented as
 * workspace configuration, and the API key they select against is genuinely
 * per-workspace (account_ai_keys, admin-only). Storing them personally meant
 * the admin's choices applied to nobody but the admin — a colleague whose
 * ai.provider still held the "anthropic" default saw every AI feature hidden
 * because the workspace key was for a different provider, and "Redact PII
 * before sending to AI" only redacted the admin's own calls.
 */
const isWorkspacePref = (key: string) =>
  key.startsWith("gdpr.") ||
  key.startsWith("tabs.") ||
  key.startsWith("kanban.") ||
  (key.startsWith("ai.") && !PERSONAL_AI_PREFS.includes(key));

/** Split the flat prefs object into what goes where in cloud mode. API keys
    (ai.key.*) are excluded — they're stored encrypted via the /api/ai/key route. */
function splitPrefs(prefs: Record<string, string | boolean>) {
  const personal: Record<string, string | boolean> = {};
  const workspace: Record<string, string | boolean> = {};
  for (const [k, v] of Object.entries(prefs)) {
    if (k.startsWith("ai.key.")) continue;
    if (isWorkspacePref(k)) workspace[k] = v;
    else personal[k] = v;
  }
  return { personal, workspace };
}

let personalPrefTimer: ReturnType<typeof setTimeout> | undefined;
let workspacePrefTimer: ReturnType<typeof setTimeout> | undefined;

/** Debounced cloud write of the relevant settings bucket. */
function schedulePrefSave(kind: "personal" | "workspace") {
  if (typeof window === "undefined") return;
  const run = async () => {
    const s = useApp.getState();
    if (s.backend !== "cloud") return;
    if (await sessionSwitched()) {
      console.warn("[settings] auth session changed — save skipped; reload this tab.");
      return;
    }
    const { personal, workspace } = splitPrefs(s.prefs);
    // Keep a per-browser fallback so settings survive a reload even when the
    // cloud write can't land (e.g. the settings migration isn't applied yet).
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(s.prefs));
    } catch {}
    const res =
      kind === "personal"
        ? await savePersonalPrefs(currentUserId, personal)
        : await saveWorkspaceSettings(s.account?.id, workspace);
    // Settings sync is best-effort and deliberately separate from the content
    // "Sync error" pill — a not-yet-migrated schema shouldn't look like data loss.
    if (!res.ok) console.warn(`[settings] ${kind} not synced (kept in this browser): ${res.error}`);
  };
  if (kind === "personal") {
    clearTimeout(personalPrefTimer);
    personalPrefTimer = setTimeout(() => void run(), 500);
  } else {
    clearTimeout(workspacePrefTimer);
    workspacePrefTimer = setTimeout(() => void run(), 500);
  }
}

/** True when this tab's auth session no longer matches the workspace it
    loaded — e.g. another tab signed into a different account (the session is
    shared per browser). Writing now would target the wrong tenant; RLS blocks
    it server-side, but we skip client-side instead of surfacing scary errors. */
async function sessionSwitched(): Promise<boolean> {
  const expected = useApp.getState().authUid;
  if (!expected || !supabase) return false;
  const { data } = await supabase.auth.getSession(); // local read, no network
  const uid = data.session?.user?.id;
  return Boolean(uid && uid !== expected);
}

/** Push the whole in-memory repository to Supabase (debounced). */
async function syncCloud(s: AppState) {
  // A sync scheduled just before logout must not run once the session is gone:
  // the write would be unauthenticated and trip row-level security.
  if (useApp.getState().signedOut) return;
  if (await sessionSwitched()) {
    console.warn("[sync] auth session changed (another tab signed in?) — write skipped; reload this tab.");
    useApp.setState({ syncState: "error", syncError: "Signed-in account changed — reload this tab." });
    return;
  }
  useApp.setState({ syncState: "syncing" });
  // Admins also mirror profiles first: content references team/demo users as
  // owner/researcher/creator (nullable FKs to profiles), and those rows must
  // exist before the content is written — chiefly after a demo-data reset,
  // which restores seed users the cloud may not have. profiles are otherwise
  // excluded from the mirror (RLS lets only admins write them).
  if (can(s.role, "admin")) {
    const pr = await syncProfiles(DB.users);
    if (!pr.ok) {
      console.error("[sync] profiles write failed:", pr.error);
      return void useApp.setState({ syncState: "error", syncError: `profiles: ${pr.error}` });
    }
  }
  // Transcript parent rows must be written before their highlights, whose
  // transcript_id is a NOT NULL FK. Transcripts are static seed data, so only
  // include those whose interview is actually present (transcript.interview_id
  // is itself a NOT NULL FK to interviews) — and only highlights whose parent
  // transcript is being written. This keeps every FK satisfied in all states.
  const interviewIds = new Set(DB.interviews.map((iv) => iv.id));
  const scopedTranscripts = transcripts.filter((t) => interviewIds.has(t.interviewId));
  const transcriptIds = new Set(scopedTranscripts.map((t) => t.id));
  const flatHighlights = Object.values(s.highlights)
    .flat()
    .filter((h) => transcriptIds.has(h.transcriptId));
  const res = await syncAll({
    profiles: DB.users,
    companies: DB.companies,
    personas: DB.personas,
    tags: DB.tags,
    themes: DB.themes,
    participants: DB.participants,
    projects: DB.projects,
    interviews: DB.interviews,
    insights: DB.insights,
    tests: DB.tests,
    kanbanBoards: s.kanban,
    affinityBoards: s.affinity,
    transcripts: scopedTranscripts,
    highlights: flatHighlights,
  });
  if (!res.ok) console.error("[sync] write failed:", res.error);
  useApp.setState(
    res.ok ? { syncState: "saved", syncError: undefined } : { syncState: "error", syncError: res.error },
  );
}

if (typeof window !== "undefined") {
  // When the preference is "system", track live OS light/dark changes.
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    if (useApp.getState().theme !== "system") return;
    applyTheme("system");
    useApp.setState({ resolvedTheme: systemPrefersDark() ? "dark" : "light" });
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  useApp.subscribe((s, prev) => {
    if (!s.hydrated) return; // never persist before the initial restore/load
    if (s.demo) return; // demo sandbox: nothing persists, nothing syncs
    // Only react to actual data changes — not to syncState/toast/etc updates,
    // otherwise the sync's own status write would loop.
    const dataChanged =
      s.dataVersion !== prev.dataVersion ||
      s.kanban !== prev.kanban ||
      s.affinity !== prev.affinity ||
      s.highlights !== prev.highlights;
    if (!dataChanged) return;
    clearTimeout(timer);
    if (s.backend === "cloud") {
      // Only content-managers write; viewers/designers can't (RLS-gated), and
      // this also avoids a false "sync error" from the post-load re-sync.
      if (s.signedOut || !can(s.role, "manage-content")) return;
      timer = setTimeout(() => void syncCloud(useApp.getState()), 700);
    } else {
      timer = setTimeout(() => persistAll(s), 300);
    }
  });
}
