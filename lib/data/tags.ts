import type { Tag, TagKind, Theme } from "@/lib/types";

export const tags: Tag[] = [
  // Behaviour
  { id: "tag-early-adopter", label: "Early Adopter", kind: "behaviour", accent: "green" },
  { id: "tag-change-resistant", label: "Change Resistant", kind: "behaviour", accent: "red" },
  { id: "tag-analytical", label: "Analytical", kind: "behaviour", accent: "indigo" },
  { id: "tag-data-driven", label: "Data Driven", kind: "behaviour", accent: "blue" },
  { id: "tag-mobile-first", label: "Mobile First", kind: "behaviour", accent: "cyan" },
  { id: "tag-office-worker", label: "Office Worker", kind: "behaviour", accent: "slate" },
  { id: "tag-field-worker", label: "Field Worker", kind: "behaviour", accent: "amber" },
  { id: "tag-ai-enthusiast", label: "AI Enthusiast", kind: "behaviour", accent: "violet" },
  { id: "tag-pragmatic", label: "Pragmatic", kind: "behaviour", accent: "teal" },
  { id: "tag-power-user", label: "Power User", kind: "behaviour", accent: "purple" },

  // Pain points
  { id: "tag-search", label: "Search", kind: "pain-point", accent: "blue" },
  { id: "tag-navigation", label: "Navigation", kind: "pain-point", accent: "indigo" },
  { id: "tag-reporting", label: "Reporting", kind: "pain-point", accent: "violet" },
  { id: "tag-planning", label: "Planning", kind: "pain-point", accent: "purple" },
  { id: "tag-work-orders", label: "Work Orders", kind: "pain-point", accent: "orange" },
  { id: "tag-mobile-experience", label: "Mobile Experience", kind: "pain-point", accent: "cyan" },
  { id: "tag-performance", label: "Performance", kind: "pain-point", accent: "red" },
  { id: "tag-dashboards", label: "Dashboards", kind: "pain-point", accent: "teal" },
  { id: "tag-notifications", label: "Notifications", kind: "pain-point", accent: "amber" },
  { id: "tag-integrations", label: "Integrations", kind: "pain-point", accent: "rose" },
  { id: "tag-ai", label: "AI", kind: "pain-point", accent: "violet" },
  { id: "tag-usability", label: "Usability", kind: "pain-point", accent: "pink" },
  { id: "tag-onboarding", label: "Onboarding", kind: "pain-point", accent: "green" },
  { id: "tag-data-quality", label: "Data Quality", kind: "pain-point", accent: "lime" },

  // General
  { id: "tag-quick-win", label: "Quick Win", kind: "general", accent: "green" },
  { id: "tag-needs-validation", label: "Needs Validation", kind: "general", accent: "amber" },
  { id: "tag-high-value", label: "High Value", kind: "general", accent: "purple" },
];

/**
 * Starter-pack tag vocabulary, offered as one-click suggestions in the "New
 * tag" dialog on every workspace — not only the demo sandbox. Derived from
 * the demo tags above (ids stripped) rather than kept as a second list, so
 * they can't drift: a label or color a user sees in the sandbox is exactly
 * the suggestion a real account gets.
 */
export const TAG_CATALOG: { label: string; kind: TagKind; accent: string }[] = tags.map(
  ({ label, kind, accent }) => ({ label, kind, accent }),
);

export const themes: Theme[] = [
  {
    id: "th-mobile-field",
    name: "Mobile & Field Work",
    description: "How technicians work away from a desk, offline, and on the move.",
    accent: "cyan",
  },
  {
    id: "th-findability",
    name: "Findability & Search",
    description: "Locating assets, work orders, parts, and history quickly.",
    accent: "blue",
  },
  {
    id: "th-planning-scheduling",
    name: "Planning & Scheduling",
    description: "Balancing capacity, backlog, and preventive vs. corrective work.",
    accent: "indigo",
  },
  {
    id: "th-reporting-insight",
    name: "Reporting & Insight",
    description: "Turning maintenance data into decisions and KPIs.",
    accent: "violet",
  },
  {
    id: "th-onboarding-learn",
    name: "Onboarding & Learnability",
    description: "How new users get productive and discover capabilities.",
    accent: "green",
  },
  {
    id: "th-ai-assist",
    name: "AI Assistance",
    description: "Where AI can reduce manual effort and surface patterns.",
    accent: "purple",
  },
  {
    id: "th-integration",
    name: "Integrations & Ecosystem",
    description: "Connecting to ERP, IoT, and the wider enterprise landscape.",
    accent: "rose",
  },
  {
    id: "th-trust-data",
    name: "Data Trust & Quality",
    description: "Confidence in the accuracy and completeness of records.",
    accent: "lime",
  },
];
