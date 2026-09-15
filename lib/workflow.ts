import type { KanbanColumn } from "@/lib/types";

/**
 * The research-to-product workflow lanes. These are the Kanban columns AND the
 * values stored in `Insight.workflowStage` — the board is a lens over insights,
 * so an insight's stage is the single source of truth for where its card sits.
 *
 * Lanes are editable per account (Settings → Kanban) and shared across every
 * board in that workspace. They persist as a JSON string under the workspace
 * pref `kanban.stages`; this array is the fallback/default when none is set.
 * Lane ids match the historical seed columns so existing boards migrate cleanly.
 */
export const WORKFLOW_STAGES: KanbanColumn[] = [
  { id: "c-raw", title: "Raw Findings", accent: "slate", description: "Fresh, unsorted insights waiting to be triaged." },
  { id: "c-review", title: "Needs Review", accent: "amber", description: "Being assessed — evidence and severity under discussion." },
  { id: "c-valid", title: "Validated", accent: "blue", description: "Confirmed findings backed by solid evidence." },
  { id: "c-opp", title: "Opportunity", accent: "violet", description: "A validated finding framed as something to act on." },
  { id: "c-backlog", title: "Product Backlog", accent: "teal", description: "Handed to product — queued for delivery." },
  { id: "c-done", title: "Completed", accent: "green", description: "Acted on and shipped." },
];

/** The workspace pref key holding the (JSON-encoded) lane list. */
export const KANBAN_STAGES_PREF = "kanban.stages";

/** Accent color names offered by the lane color picker (match the accent system). */
export const LANE_COLORS = [
  "slate", "blue", "cyan", "teal", "green", "lime", "amber",
  "orange", "red", "rose", "pink", "purple", "violet", "indigo",
];

/** Resolve the account's lanes from the stored pref, falling back to defaults. */
export function parseStages(raw: unknown): KanbanColumn[] {
  if (typeof raw === "string" && raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length && arr.every((s) => s && typeof s.id === "string" && typeof s.title === "string")) {
        return arr.map((s) => ({
          id: s.id,
          title: s.title,
          accent: typeof s.accent === "string" ? s.accent : "slate",
          description: typeof s.description === "string" && s.description ? s.description : undefined,
        }));
      }
    } catch {
      /* fall through to defaults */
    }
  }
  return WORKFLOW_STAGES;
}

/** Whether a value is one of the given lanes (i.e. "on the board"). */
export const isStage = (id: string | null | undefined, stages: KanbanColumn[]): id is string =>
  !!id && stages.some((s) => s.id === id);

/** Where a freshly added insight lands on the board (the first lane). */
export const firstStageId = (stages: KanbanColumn[]): string => stages[0]?.id ?? "c-raw";
