import type { ResearchProject } from "@/lib/types";

export const projects: ResearchProject[] = [
  {
    id: "pr-mobile",
    name: "Mobile Work Order Experience",
    description:
      "Understand how field technicians use Meridian Go to receive, execute, and close work orders — especially with poor connectivity.",
    objective:
      "Identify the top friction points in the mobile work order flow and validate concepts for an offline-first redesign.",
    productArea: "Mobile",
    status: "analysis",
    startDate: "2026-05-04",
    endDate: "2026-07-10",
    ownerId: "u-sanne",
    memberIds: ["u-sanne", "u-tom", "u-julia", "u-marco"],
    participantIds: ["pt-lukas", "pt-piet", "pt-nadia", "pt-thomas", "pt-carlos"],
    researchQuestions: [
      { id: "rq-m1", text: "Where do technicians lose the most time in the mobile flow?", answered: true },
      { id: "rq-m2", text: "How do they cope when connectivity drops mid-job?", answered: true },
      { id: "rq-m3", text: "What information do they need before starting a job?", answered: false },
      { id: "rq-m4", text: "Would an offline-first model change trust in the app?", answered: false },
    ],
    successCriteria: [
      "5+ technicians across 3 industries interviewed",
      "Prioritized list of top 5 mobile friction points",
      "Validated offline concept with ≥4 participants",
    ],
    methodology: "Contextual inquiry + moderated concept testing",
  },
  {
    id: "pr-planning",
    name: "Planning & Scheduling Deep Dive",
    description:
      "Explore how planners build and adjust schedules, and where the current scheduling board falls short.",
    objective:
      "Map the end-to-end planning workflow and uncover opportunities to reduce manual rescheduling effort.",
    productArea: "Planning",
    status: "in-progress",
    startDate: "2026-06-01",
    endDate: "2026-08-15",
    ownerId: "u-tom",
    memberIds: ["u-tom", "u-lena", "u-julia"],
    participantIds: ["pt-fatima", "pt-yusuf", "pt-carlos", "pt-david"],
    researchQuestions: [
      { id: "rq-p1", text: "What triggers a re-plan and how disruptive is it?", answered: true },
      { id: "rq-p2", text: "How do planners balance PM vs. corrective work?", answered: false },
      { id: "rq-p3", text: "Where could AI suggest schedule optimizations?", answered: false },
    ],
    successCriteria: [
      "Journey map of the weekly planning cycle",
      "Identify 3 automation opportunities",
    ],
    methodology: "Semi-structured interviews + task observation",
  },
  {
    id: "pr-reporting",
    name: "Reporting & Dashboards Needs",
    description:
      "Understand what managers, reliability engineers, and executives need from reporting and dashboards.",
    objective:
      "Define the reporting jobs-to-be-done across personas and prioritize dashboard improvements.",
    productArea: "Reporting",
    status: "in-progress",
    startDate: "2026-05-20",
    endDate: "2026-07-31",
    ownerId: "u-sanne",
    memberIds: ["u-sanne", "u-lena"],
    participantIds: ["pt-james", "pt-ingrid", "pt-amara", "pt-priya", "pt-anke", "pt-robert"],
    researchQuestions: [
      { id: "rq-r1", text: "Which KPIs matter most per persona?", answered: true },
      { id: "rq-r2", text: "How much do people export to Power BI and why?", answered: true },
      { id: "rq-r3", text: "What would make dashboards trustworthy enough to act on?", answered: false },
    ],
    successCriteria: [
      "Persona-specific KPI matrix",
      "Recommendations for default dashboards",
    ],
    methodology: "Interviews + artifact review",
  },
  {
    id: "pr-onboarding",
    name: "New User Onboarding",
    description:
      "Study how first-time users learn Meridian and where they get stuck in the first two weeks.",
    objective:
      "Reduce time-to-productivity for new technicians and administrators.",
    productArea: "Platform",
    status: "recruiting",
    startDate: "2026-06-25",
    endDate: "2026-09-01",
    ownerId: "u-tom",
    memberIds: ["u-tom", "u-julia"],
    participantIds: ["pt-piet", "pt-marie", "pt-emma", "pt-thomas"],
    researchQuestions: [
      { id: "rq-o1", text: "What are the first tasks new users attempt?", answered: false },
      { id: "rq-o2", text: "Where does the current onboarding break down?", answered: false },
    ],
    successCriteria: ["Onboarding friction inventory", "Concept for guided first-run"],
    methodology: "Diary study + first-use sessions",
  },
  {
    id: "pr-ai",
    name: "AI Assistance Opportunities",
    description:
      "Discover where AI could meaningfully reduce manual effort across maintenance roles.",
    objective:
      "Prioritize AI use-cases by desirability and feasibility, grounded in real workflows.",
    productArea: "AI",
    status: "planning",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    ownerId: "u-sanne",
    memberIds: ["u-sanne", "u-tom", "u-marco"],
    participantIds: ["pt-ingrid", "pt-priya", "pt-yusuf"],
    researchQuestions: [
      { id: "rq-a1", text: "Which manual tasks feel most automatable to users?", answered: false },
      { id: "rq-a2", text: "How much AI autonomy are users comfortable with?", answered: false },
    ],
    successCriteria: ["Ranked AI opportunity backlog"],
    methodology: "Concept workshops",
  },
  {
    id: "pr-search",
    name: "Search & Findability Study",
    description:
      "Completed study on how users locate assets, work orders, and parts across the product.",
    objective: "Establish a findability baseline and quick wins for global search.",
    productArea: "Platform",
    status: "completed",
    startDate: "2026-02-10",
    endDate: "2026-04-30",
    ownerId: "u-sanne",
    memberIds: ["u-sanne", "u-tom", "u-julia"],
    participantIds: ["pt-fatima", "pt-marie", "pt-sofia", "pt-lukas"],
    researchQuestions: [
      { id: "rq-s1", text: "How do users currently find records?", answered: true },
      { id: "rq-s2", text: "What are the biggest search frustrations?", answered: true },
    ],
    successCriteria: ["Findability baseline", "Top 5 search quick wins delivered"],
    methodology: "Tree testing + interviews",
  },
  {
    // Sample project holding the demo unmoderated tests (see data/tests.ts).
    // Deliberately an unrelated consumer product so the test content reads as
    // an example, not real research.
    id: "pr-pitstop",
    name: "PitStop — Car Service App (demo)",
    description:
      "Sample project showcasing unmoderated tests on a fictional car-repair booking app. Used to demonstrate the testing feature — not real research.",
    objective: "Demonstrate the unmoderated-testing block types with realistic content and screens.",
    productArea: "Mobile",
    status: "in-progress",
    startDate: "2026-07-10",
    endDate: "2026-08-15",
    ownerId: "u-sanne",
    memberIds: ["u-sanne", "u-tom"],
    participantIds: [],
    researchQuestions: [
      { id: "rq-ps1", text: "Can users book a service without guidance?", answered: false },
      { id: "rq-ps2", text: "Which garage card layout reads more clearly?", answered: false },
    ],
    successCriteria: ["Validated booking flow", "Preferred card layout chosen"],
    methodology: "Unmoderated usability testing",
  },
];
