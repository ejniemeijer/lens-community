import type { AffinityBoard, KanbanBoard } from "@/lib/types";
import { WORKFLOW_STAGES } from "@/lib/workflow";

/* Kanban boards are lenses over insights: a card's column comes from the
   insight's `workflowStage` (seeded in insights.ts), not from stored cards.
   `cards` holds only free "spike" notes (no insightId); the seed starts empty.
   `kb-triage` is unscoped (all insights); `kb-mobile` scopes to the mobile study. */
export const kanbanBoards: KanbanBoard[] = [
  {
    id: "kb-triage",
    name: "Insight Triage",
    columns: WORKFLOW_STAGES.map((c) => ({ ...c })),
    cards: [],
  },
  {
    id: "kb-mobile",
    projectId: "pr-mobile",
    name: "Mobile Study Board",
    columns: WORKFLOW_STAGES.map((c) => ({ ...c })),
    cards: [],
  },
];

export const affinityBoards: AffinityBoard[] = [
  {
    id: "af-mobile",
    projectId: "pr-mobile",
    name: "Mobile Study — Affinity Map",
    groups: [
      { id: "ag-offline", title: "Offline & Sync", accent: "blue" },
      { id: "ag-trust", title: "Trust & Confidence", accent: "violet" },
      { id: "ag-find", title: "Findability", accent: "cyan" },
      { id: "ag-notif", title: "Notifications", accent: "amber" },
      { id: "ag-onboard", title: "Learnability (AI-suggested)", accent: "green", aiSuggested: true },
    ],
    notes: [
      { id: "an-1", text: "App logs out during the climb; work order lost", kind: "pain-point", sourceParticipantId: "pt-lukas", groupId: "ag-offline" },
      { id: "an-2", text: "No signal at pump stations — paper as offline bridge", kind: "pain-point", sourceParticipantId: "pt-thomas", groupId: "ag-offline" },
      { id: "an-3", text: "Pages hang on the hospital ward", kind: "observation", sourceParticipantId: "pt-nadia", groupId: "ag-offline" },
      { id: "an-4", text: "Never sure an update actually saved", kind: "insight", sourceParticipantId: "pt-lukas", groupId: "ag-trust" },
      { id: "an-5", text: "Screenshots everything 'just in case'", kind: "observation", sourceParticipantId: "pt-lukas", groupId: "ag-trust" },
      { id: "an-6", text: "Re-keys from paper to feel safe", kind: "observation", sourceParticipantId: "pt-thomas", groupId: "ag-trust" },
      { id: "an-7", text: "Photographs nameplate instead of searching", kind: "pain-point", sourceParticipantId: "pt-lukas", groupId: "ag-find" },
      { id: "an-8", text: "Search wants exact codes he doesn't memorize", kind: "pain-point", sourceParticipantId: "pt-lukas", groupId: "ag-find" },
      { id: "an-9", text: "Team swipes notifications away unread", kind: "pain-point", sourceParticipantId: "pt-carlos", groupId: "ag-notif" },
      { id: "an-10", text: "Photo upload takes several retries", kind: "pain-point", sourceParticipantId: "pt-nadia", groupId: "ag-notif" },
      { id: "an-11", text: "Paper never crashed — trust in reliability", kind: "insight", sourceParticipantId: "pt-piet", groupId: "ag-onboard" },
      { id: "an-12", text: "Would adopt if the tool proved dependable", kind: "opportunity", sourceParticipantId: "pt-piet", groupId: "ag-onboard" },
      { id: "an-13", text: "Offline-first would be 'huge' with visible sync", kind: "opportunity", sourceParticipantId: "pt-lukas", groupId: null },
      { id: "an-14", text: "Wants to know before starting what a job needs", kind: "user-need", sourceParticipantId: "pt-nadia", groupId: null },
    ],
  },
];
