import type { AiSuggestion, AuditLog, ConsentRecord } from "@/lib/types";
import { participants } from "./participants";

/** Derive a consent record per participant from their profile. */
export const consentRecords: ConsentRecord[] = participants.map((p, i) => {
  const grantedDate =
    p.consentStatus === "granted"
      ? p.lastInterviewDate ?? "2026-05-01"
      : p.consentStatus === "expired"
        ? "2024-11-01"
        : undefined;
  return {
    id: `cr-${p.id}`,
    participantId: p.id,
    status: p.consentStatus,
    grantedDate,
    expiryDate: grantedDate
      ? `${Number(grantedDate.slice(0, 4)) + 2}${grantedDate.slice(4)}`
      : undefined,
    scope: [
      "Interview participation",
      p.recordingPermission ? "Audio/video recording" : "Notes only",
      "Storage of research data",
      i % 3 === 0 ? "Attribution (anonymized)" : "Named attribution",
    ],
    retentionMonths: 24,
  };
});

export const auditLogs: AuditLog[] = [
  { id: "al-1", actorId: "u-sanne", action: "created insight", entity: "insight", entityLabel: "Connectivity loss drops work orders", date: "2026-06-19" },
  { id: "al-2", actorId: "u-tom", action: "added interview", entity: "interview", entityLabel: "Planner workflow — the rescheduling problem", date: "2026-06-25" },
  { id: "al-3", actorId: "u-sanne", action: "added participant", entity: "participant", entityLabel: "David Chen", date: "2026-06-30" },
  { id: "al-4", actorId: "u-erik", action: "changed role", entity: "user", entityLabel: "Julia Kowalski → Designer", date: "2026-06-15" },
  { id: "al-5", actorId: "u-tom", action: "created highlight", entity: "transcript", entityLabel: "Fatima transcript · rescheduling cascade", date: "2026-06-26" },
  { id: "al-6", actorId: "u-sanne", action: "exported", entity: "project", entityLabel: "Search & Findability Study (JSON)", date: "2026-05-02" },
  { id: "al-7", actorId: "u-julia", action: "commented", entity: "transcript", entityLabel: "Lukas transcript · session timeout", date: "2026-06-19" },
  { id: "al-8", actorId: "u-erik", action: "ran backup", entity: "system", entityLabel: "Scheduled nightly backup", date: "2026-07-03" },
  { id: "al-9", actorId: "u-lena", action: "exported", entity: "insight", entityLabel: "AI proposes a re-plan to approve (PDF)", date: "2026-07-01" },
  { id: "al-10", actorId: "u-sanne", action: "updated consent", entity: "participant", entityLabel: "Emma Nováková (expired → follow-up)", date: "2026-06-28" },
];

/** Plausible AI suggestions surfaced across the app. */
export const aiSuggestions: AiSuggestion[] = [
  { id: "ai-dup-1", kind: "duplicate", title: "Possible duplicate insights", detail: "‘Sync uncertainty erodes trust’ and ‘Connectivity loss drops work orders’ share 2 participants and overlapping themes. Consider merging or linking.", confidence: "medium", relatedIds: ["in-offline-sync", "in-mobile-offline-trust"] },
  { id: "ai-theme-1", kind: "theme", title: "Emerging theme: Data Trust", detail: "12 highlights across 4 studies mention distrust of saved/synced data. This may warrant a dedicated theme.", confidence: "high", relatedIds: ["th-trust-data"] },
  { id: "ai-persona-1", kind: "persona", title: "Under-researched persona", detail: "Only 1 Purchaser interviewed vs. 5 Technicians. Consider recruiting more Purchasers for balance.", confidence: "high", relatedIds: ["pe-purchaser"] },
  { id: "ai-opp-1", kind: "opportunity", title: "High-impact opportunity detected", detail: "‘Offline-first with visible sync’ links to a critical, high-impact pain point cited by 3 participants across 2 industries.", confidence: "high", relatedIds: ["in-mobile-offline-trust", "in-offline-sync"] },
  { id: "ai-gap-1", kind: "gap", title: "Research gap: SMB context", detail: "Only Alpine Water Boards (<200 employees) represents SMB. Findings may skew enterprise.", confidence: "medium", relatedIds: ["co-alpine"] },
  { id: "ai-similar-1", kind: "similar", title: "Similar interviews", detail: "Lukas and Thomas describe near-identical offline workflows — good candidates for a combined narrative.", confidence: "high", relatedIds: ["iv-lukas-1", "iv-thomas-1"] },
  { id: "ai-topic-1", kind: "topic", title: "Frequently mentioned: ‘Power BI’", detail: "Mentioned in 4 reporting interviews as an escape hatch from native reports.", confidence: "high", relatedIds: ["in-report-export-bi"] },
  { id: "ai-tag-1", kind: "tag", title: "Suggested tag: ‘Workaround’", detail: "Screenshots, paper, and private spreadsheets recur as coping mechanisms — a ‘Workaround’ tag could track them.", confidence: "medium" },
];
