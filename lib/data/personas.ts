import type { Persona } from "@/lib/types";

export const personas: Persona[] = [
  {
    id: "pe-technician",
    name: "Maintenance Technician",
    description:
      "Hands-on on the shop floor. Executes work orders, logs findings, and needs fast mobile access between jobs.",
    accent: "blue",
    icon: "Wrench",
  },
  {
    id: "pe-planner",
    name: "Maintenance Planner",
    description:
      "Schedules preventive and corrective work, balances technician capacity, and keeps the backlog under control.",
    accent: "indigo",
    icon: "CalendarClock",
  },
  {
    id: "pe-manager",
    name: "Maintenance Manager",
    description:
      "Owns team performance and maintenance KPIs. Lives in dashboards and reports to operations leadership.",
    accent: "violet",
    icon: "HardHat",
  },
  {
    id: "pe-reliability",
    name: "Reliability Engineer",
    description:
      "Analyzes failure patterns, drives RCA, and optimizes maintenance strategy from asset history data.",
    accent: "teal",
    icon: "Gauge",
  },
  {
    id: "pe-warehouse",
    name: "Warehouse Employee",
    description:
      "Manages spare parts stock, issues materials to work orders, and handles goods receipt.",
    accent: "amber",
    icon: "Warehouse",
  },
  {
    id: "pe-purchaser",
    name: "Purchaser",
    description:
      "Converts requisitions to orders, manages suppliers, and tracks delivery of critical parts.",
    accent: "orange",
    icon: "ShoppingCart",
  },
  {
    id: "pe-operations",
    name: "Operations Manager",
    description:
      "Owns plant uptime. Cares about how maintenance impacts production throughput and safety.",
    accent: "green",
    icon: "Factory",
  },
  {
    id: "pe-asset",
    name: "Asset Manager",
    description:
      "Manages the asset register and lifecycle, capital planning, and long-term replacement strategy.",
    accent: "cyan",
    icon: "Boxes",
  },
  {
    id: "pe-admin",
    name: "Administrator",
    description:
      "Configures the system, manages users and permissions, and maintains master data quality.",
    accent: "slate",
    icon: "ShieldCheck",
  },
  {
    id: "pe-executive",
    name: "Executive",
    description:
      "C-level sponsor. Wants evidence that maintenance investments reduce risk and cost.",
    accent: "purple",
    icon: "Briefcase",
  },
  {
    id: "pe-it",
    name: "IT Manager",
    description:
      "Responsible for integrations, security, SSO, and how the platform fits the enterprise landscape.",
    accent: "rose",
    icon: "Server",
  },
];
