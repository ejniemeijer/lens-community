import {
  LayoutDashboard,
  FolderOpen,
  Users,
  MessageSquare,
  Lightbulb,
  MousePointerClick,
  Sparkles,
  Contact,
  Layers,
  Tag,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";
import { can, type Capability } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** match sub-routes as active */
  match?: (path: string) => boolean;
  /** only shown to administrators (e.g. features still in development) */
  adminOnly?: boolean;
  /** only shown to roles that have this capability */
  requiresCap?: Capability;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

const startsWith = (base: string) => (path: string) =>
  path === base || path.startsWith(base + "/");

/* Affinity mapping and Kanban live inside each project's tabs; they no
   longer clutter the global nav. */
export const navGroups: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboards", href: "/dashboard", icon: LayoutDashboard, match: startsWith("/dashboard") },
      { label: "Projects", href: "/projects", icon: FolderOpen, match: startsWith("/projects") },
      { label: "Participants", href: "/participants", icon: Users, match: startsWith("/participants") },
      { label: "Interviews", href: "/interviews", icon: MessageSquare, match: startsWith("/interviews") },
      { label: "Insights", href: "/insights", icon: Lightbulb, match: startsWith("/insights") },
      { label: "Tests", href: "/tests", icon: MousePointerClick, match: startsWith("/tests") },
    ],
  },
  {
    title: "Analysis",
    items: [
      { label: "AI Assistant", href: "/ai", icon: Sparkles, match: startsWith("/ai"), requiresCap: "use-ai" },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Personas", href: "/personas", icon: Contact, match: startsWith("/personas") },
      { label: "Themes", href: "/themes", icon: Layers, match: startsWith("/themes") },
      { label: "Tags", href: "/tags", icon: Tag, match: startsWith("/tags") },
    ],
  },
];

export const settingsItem: NavItem = {
  label: "Settings",
  href: "/settings",
  icon: Settings,
  match: startsWith("/settings"),
};

/** Nav groups visible to a given role (admin-only items filtered out). */
export function navGroupsFor(role: Role): NavGroup[] {
  return navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => (!i.adminOnly || role === "admin") && (!i.requiresCap || can(role, i.requiresCap)),
      ),
    }))
    .filter((g) => g.items.length > 0);
}

/** Flat list for search "go to" suggestions, filtered by role. */
export function navItemsFor(role: Role): NavItem[] {
  return [...navGroupsFor(role).flatMap((g) => g.items), settingsItem];
}

/** Unfiltered flat list (used for page titles). */
export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((g) => g.items),
  settingsItem,
];
