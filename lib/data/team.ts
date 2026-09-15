import type { Company, User } from "@/lib/types";

/** Internal research team (the app's own users). */
export const users: User[] = [
  {
    id: "u-erik",
    name: "Maya Visser",
    email: "research.lead@example.com",
    role: "admin",
    jobTitle: "Head of UX Research",
    avatarColor: "indigo",
  },
  {
    id: "u-sanne",
    name: "Sanne de Vries",
    email: "sanne.devries@example.com",
    role: "researcher",
    jobTitle: "Senior UX Researcher",
    avatarColor: "violet",
  },
  {
    id: "u-tom",
    name: "Tom Bakker",
    email: "tom.bakker@example.com",
    role: "researcher",
    jobTitle: "UX Researcher",
    avatarColor: "teal",
  },
  {
    id: "u-julia",
    name: "Julia Kowalski",
    email: "julia.kowalski@example.com",
    role: "designer",
    jobTitle: "Product Designer",
    avatarColor: "pink",
  },
  {
    id: "u-marco",
    name: "Marco Rossi",
    email: "marco.rossi@example.com",
    role: "product-owner",
    jobTitle: "Product Owner, Mobile",
    avatarColor: "amber",
  },
  {
    id: "u-lena",
    name: "Lena Fischer",
    email: "lena.fischer@example.com",
    role: "product-owner",
    jobTitle: "Product Owner, Planning",
    avatarColor: "green",
  },
];

export const currentUserId = "u-erik";

export const companies: Company[] = [
  {
    id: "co-nordwind",
    name: "Nordwind Energy",
    industry: "Utilities & Energy",
    size: "1001-5000",
    country: "Germany",
    logoAccent: "blue",
  },
  {
    id: "co-valtech",
    name: "ValTech Manufacturing",
    industry: "Discrete Manufacturing",
    size: "201-1000",
    country: "Netherlands",
    logoAccent: "orange",
  },
  {
    id: "co-brightfoods",
    name: "BrightFoods Group",
    industry: "Food & Beverage",
    size: "5000+",
    country: "Belgium",
    logoAccent: "green",
  },
  {
    id: "co-riverside",
    name: "Riverside Health",
    industry: "Healthcare Facilities",
    size: "1001-5000",
    country: "United Kingdom",
    logoAccent: "rose",
  },
  {
    id: "co-portside",
    name: "Portside Logistics",
    industry: "Logistics & Ports",
    size: "201-1000",
    country: "Netherlands",
    logoAccent: "cyan",
  },
  {
    id: "co-alpine",
    name: "Alpine Water Boards",
    industry: "Water Management",
    size: "51-200",
    country: "Switzerland",
    logoAccent: "teal",
  },
  {
    id: "co-steelcore",
    name: "SteelCore Industries",
    industry: "Heavy Industry",
    size: "5000+",
    country: "Sweden",
    logoAccent: "slate",
  },
  {
    id: "co-lumen",
    name: "Lumen Pharma",
    industry: "Pharmaceutical",
    size: "1001-5000",
    country: "Ireland",
    logoAccent: "purple",
  },
];
