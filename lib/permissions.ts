import type { Role } from "@/lib/types";
import { isSelfHosted } from "@/lib/edition";

/**
 * Single source of truth for role-based access control.
 * The settings permission matrix renders from this, and the UI
 * enforces it (hidden/disabled controls per role).
 */
export type Capability =
  | "admin" // team, AI config, backups, system settings
  | "manage-content" // create/edit projects, participants, interviews, insights, boards
  | "export" // download findings & data
  | "comment" // collaborate on transcripts & insights
  | "use-ai" // use the AI assistant & AI-assisted features
  | "view"; // read-only access

const ALL: Role[] = ["admin", "researcher", "designer", "product-owner", "viewer"];

export const CAPS: Record<Capability, Role[]> = {
  admin: ["admin"],
  "manage-content": ["admin", "researcher"],
  export: ["admin", "researcher", "designer", "product-owner"],
  comment: ["admin", "researcher", "designer", "product-owner"],
  "use-ai": ["admin", "researcher", "designer", "product-owner"], // everyone except viewer
  view: ALL,
};

export function can(role: Role, cap: Capability): boolean {
  return CAPS[cap].includes(role);
}

/**
 * Billable-seat caps per plan. Hosted is a single per-researcher plan — no tier
 * caps. Each plan includes a number of contributor seats (viewers are always
 * free); additional contributors are sold per seat and provisioned via the
 * per-account override (`accounts.seat_limit`, set in the admin console),
 * which wins over the plan default. "business" is a legacy/enterprise plan
 * with no cap.
 */
export const PLAN_SEAT_LIMITS: Record<string, number> = {
  starter: 3, // €49/mo — extra contributors €15/mo via seat override
  team: 10, // €149/mo — extra contributors €12/mo via seat override
};

/** Concurrent live (published) unmoderated tests per plan. Drafts and closed
    tests never count. Unknown/absent plans (local mode, self-hosted, demo,
    legacy business) are uncapped, matching feature gating below. */
export const PLAN_LIVE_TEST_LIMITS: Record<string, number> = {
  starter: 1,
  team: 10,
};

export function liveTestLimitFor(plan: string | null | undefined): number {
  return plan && plan in PLAN_LIVE_TEST_LIMITS ? PLAN_LIVE_TEST_LIMITS[plan] : Infinity;
}

/* ---------------- plan feature gating ---------------- */

/** Features reserved for the Team plan (and legacy business / self-hosted). */
export type PlanFeature = "audit-log" | "ai-governance" | "custom-lanes" | "test-analytics";
const TEAM_FEATURES: PlanFeature[] = ["audit-log", "ai-governance", "custom-lanes", "test-analytics"];

/** Whether a plan includes a gated feature. Unknown/absent plans (local mode,
    self-hosted, demo) are never blocked — gating applies to cloud tenants on
    a known plan only. */
export function planHasFeature(plan: string | null | undefined, feature: PlanFeature): boolean {
  if (!plan || plan !== "starter") return true;
  return !TEAM_FEATURES.includes(feature);
}

/** Max billable seats for a plan; Infinity when uncapped or the plan is unknown/absent. */
export function seatLimitFor(plan: string | null | undefined): number {
  return plan && plan in PLAN_SEAT_LIMITS ? PLAN_SEAT_LIMITS[plan] : Infinity;
}

/**
 * Effective seat cap for an account: an explicit per-account override wins;
 * otherwise the plan default. A non-negative `override` is honored as-is
 * (including 0); null/undefined falls back to the plan.
 */
export function effectiveSeatLimit(plan: string | null | undefined, override?: number | null): number {
  if (isSelfHosted) return Infinity; // single-tenant perpetual license — no seat caps
  return typeof override === "number" && override >= 0 ? override : seatLimitFor(plan);
}

/** Viewers are free; every other role consumes a billable seat. */
export function consumesSeat(role: Role): boolean {
  return role !== "viewer";
}

/** Rows for the settings permission matrix, mapped to machine capabilities. */
export const CAPABILITY_ROWS: { label: string; cap: Capability }[] = [
  { label: "Manage users & permissions", cap: "admin" },
  { label: "Configure AI & integrations", cap: "admin" },
  { label: "Manage backups & exports", cap: "admin" },
  { label: "Create & edit projects", cap: "manage-content" },
  { label: "Manage participants", cap: "manage-content" },
  { label: "Upload & analyze interviews", cap: "manage-content" },
  { label: "Create insights & tags", cap: "manage-content" },
  // Tests were missing from this table entirely, which mattered more than the
  // other gaps: publishing one creates a public, unauthenticated link and
  // collects data from people outside the workspace, so "who can publish a
  // test?" is exactly what a reader comes here to find out.
  { label: "Create, publish & close usability tests", cap: "manage-content" },
  { label: "Manage Kanban & affinity boards", cap: "manage-content" },
  { label: "Comment & collaborate", cap: "comment" },
  { label: "Use AI assistant & features", cap: "use-ai" },
  { label: "Export findings", cap: "export" },
  // Test results are readable by viewers — a free seat can read them. Said in
  // this label rather than as its own row, which would be five checkmarks.
  { label: "View dashboards, repository & test results", cap: "view" },
];

export const ROLE_ORDER: Role[] = ["admin", "researcher", "designer", "product-owner", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  researcher: "UX Researcher",
  designer: "Product Designer",
  "product-owner": "Product Owner",
  viewer: "Viewer",
};
