"use client";

import {
  insights,
  interviews,
  participants,
  projects,
  personas,
  themes,
  getPersonas,
  getThemes,
  getTheme,
  getPersona,
  getParticipant,
  getCompany,
  fullName,
  topPainPoints,
  trendingThemes,
  projectInsights,
  projectInterviews,
  projectTests,
  getProject,
  getTranscriptByInterview,
  tests,
} from "@/lib/db";
import type { Interview, ResearchProject, UsabilityTest } from "@/lib/types";
import { redactIfEnabled } from "@/lib/ai";
import type { SessionTallies } from "@/lib/test-sessions";
import { blockSummary } from "@/components/tests/block-editors";

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "…" : s);

/**
 * Unmoderated tests, for every AI surface that reasons over the repository.
 *
 * Two sources, deliberately: the test's own structure is in the local DB, but
 * results are not — sessions live only in Supabase. So counts come from an
 * optional tally (null = unknown, which is NOT the same as zero and must never
 * be reported as "no responses"), and findings come from a saved AI report's
 * `facts` when one exists. Facts, not the report's narrative: they're
 * code-computed from the raw sessions, so feeding them forward grounds the
 * model instead of compounding another model's prose.
 */
function testLines(rows: UsabilityTest[], tallies: SessionTallies | null, withFindings: boolean): string {
  return rows
    .map((t) => {
      const tally = tallies?.[t.id];
      const asks = t.blocks
        .filter((b) => b.type !== "message")
        .map((b) => blockSummary(b))
        .slice(0, 6);
      const head = [
        `- "${t.name}" [${t.status}]`,
        `project: ${getProject(t.projectId)?.name ?? "—"}`,
        // Only per-test when tallies exist at all: when the whole roll-up is
        // missing, the section header says so once instead of every line.
        ...(tallies
          ? [
              tally
                ? `${tally.sessions} response${tally.sessions === 1 ? "" : "s"}, ${tally.completed} completed`
                : "no responses yet",
            ]
          : []),
      ].join(" · ");
      const parts = [head];
      if (asks.length) parts.push(`  asks: ${asks.map((a) => cut(a, 90)).join(" | ")}`);
      // A saved report carries the computed results — the only findings
      // available without re-querying every session's jsonb.
      if (withFindings && t.report?.facts) {
        parts.push(
          `  results (from the report generated ${t.report.generatedAt.slice(0, 10)} over ${t.report.sessions} sessions):`,
          t.report.facts
            .split("\n")
            .filter((l) => l.trim())
            .map((l) => `    ${l}`)
            .join("\n"),
        );
      }
      return parts.join("\n");
    })
    .join("\n");
}

/** Workspace-level testing section. `withFindings` pulls in saved report
    facts, which are verbose — worth it for the chat, too much for a
    suggestion pass that only needs to know what exists. */
export function testsSection(tallies: SessionTallies | null, withFindings = true): string {
  if (tests.length === 0) return "Unmoderated tests: none created yet.";
  const live = tests.filter((t) => t.status === "active");
  const counts = `${tests.length} total — ${live.length} live, ${tests.filter((t) => t.status === "draft").length} draft, ${tests.filter((t) => t.status === "closed").length} closed`;
  // Live first (what's collecting now matters most), then the rest; capped so
  // a large account can't crowd out the insights section.
  const ordered = [...live, ...tests.filter((t) => t.status !== "active")].slice(0, 12);
  const caveat = tallies
    ? ""
    : "\nParticipant response counts are not available in this workspace — treat participation as unknown, not zero.";
  return `UNMODERATED TESTS (${counts}):${caveat}\n${testLines(ordered, tallies, withFindings)}${
    tests.length > 12 ? `\n(+${tests.length - 12} more not listed)` : ""
  }`;
}

/** Compact, grounded picture of the whole repository for the assistant.
    `tallies` (from fetchSessionTallies) adds per-test response counts; without
    it the tests section says counts are unavailable rather than implying none. */
export function workspaceSnapshot(tallies: SessionTallies | null = null): string {
  const pains = topPainPoints(6).map((p) => `${p.label} (${p.count})`).join(", ");
  const themeSignal = trendingThemes(6).map((t) => `${t.label} (${t.count})`).join(", ");
  const personaBalance = personas
    .map((p) => `${p.name}: ${participants.filter((pt) => pt.personaIds.includes(p.id)).length}`)
    .join(", ");
  const projectLines = projects
    .map(
      (p) =>
        `- ${p.name} [${p.status}] — ${p.productArea}; ${projectInsights(p.id).length} insights, ${projectInterviews(p.id).length} interviews, ${projectTests(p.id).length} tests`,
    )
    .join("\n");
  const topInsights = [...insights]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 25)
    .map((i) => `- [${i.type}/${i.severity ?? "unrated"}] ${i.title} — ${cut(i.description, 140)}`)
    .join("\n");

  return redactIfEnabled(
    `REPOSITORY SNAPSHOT
Totals: ${participants.length} participants, ${projects.length} projects, ${interviews.length} interviews, ${insights.length} insights, ${themes.length} themes, ${personas.length} personas, ${tests.length} unmoderated tests.

Top pain points (by references): ${pains || "n/a"}
Strongest themes (by references): ${themeSignal || "n/a"}
Persona coverage (participants each): ${personaBalance || "n/a"}

Projects:
${projectLines || "none"}

Notable insights:
${topInsights || "none"}

${testsSection(tallies)}`,
  );
}

function severityRank(s: string | undefined): number {
  return s ? ({ critical: 3, high: 2, medium: 1, low: 0 }[s] ?? 0) : 0;
}

/** Everything the model needs to write a project executive summary. */
export function projectSummaryContext(project: ResearchProject, tallies: SessionTallies | null = null): string {
  const ivs = projectInterviews(project.id);
  const ins = projectInsights(project.id);
  const tsts = projectTests(project.id);
  const questions = project.researchQuestions
    .map((q) => `- ${q.answered ? "[answered]" : "[open]"} ${q.text}`)
    .join("\n");
  const insightLines = ins
    .map((i) => `- [${i.type}/${i.severity}] ${i.title} — ${cut(i.description, 160)}`)
    .join("\n");
  const themeCounts = new Map<string, number>();
  for (const i of ins) for (const t of i.themeIds) themeCounts.set(t, (themeCounts.get(t) ?? 0) + 1);
  const topThemes = [...themeCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([id, n]) => `${getTheme(id)?.name ?? id} (${n})`)
    .join(", ");

  return redactIfEnabled(
    `PROJECT: ${project.name}
Objective: ${project.objective}
Product area: ${project.productArea} · Methodology: ${project.methodology} · Status: ${project.status}
Interviews: ${ivs.length} · Insights: ${ins.length} · Unmoderated tests: ${tsts.length}
Dominant themes: ${topThemes || "n/a"}

Research questions:
${questions || "none"}

Success criteria:
${project.successCriteria.map((c) => `- ${c}`).join("\n") || "none"}

Insights:
${insightLines || "none"}

Unmoderated tests:
${tsts.length ? testLines(tsts, tallies, true) : "none"}`,
  );
}

/** Transcript (or fallback) + participant context for summarizing one interview. */
export function interviewSummaryContext(iv: Interview): string {
  const participant = getParticipant(iv.participantId);
  const company = participant ? getCompany(participant.companyId) : undefined;
  const transcript = iv.transcriptId ? getTranscriptByInterview(iv.id) : undefined;
  const personaNames = participant ? getPersonas(participant.personaIds).map((p) => p.name).join(", ") : "";

  const bodyText = transcript
    ? transcript.segments
        .map((s) => `${s.speakerRole === "researcher" ? "Researcher" : "Participant"}: ${s.text}`)
        .join("\n")
    : [iv.aiSummary, ...iv.keyObservations.map((o) => `- ${o}`), iv.notes ?? ""]
        .filter(Boolean)
        .join("\n");

  return redactIfEnabled(
    `INTERVIEW: ${iv.title}
Participant role: ${participant?.jobTitle ?? "unknown"}${personaNames ? ` (persona: ${personaNames})` : ""}${company ? ` · ${company.name} (${company.size ?? "?"}, ${company.industry ?? "?"})` : ""}
Duration: ${iv.durationMinutes} min

${transcript ? "TRANSCRIPT" : "AVAILABLE NOTES"}:
${cut(bodyText, 9000)}`,
  );
}

/** Compact repository picture for generating AI suggestions. */
export function suggestionsContext(tallies: SessionTallies | null = null): string {
  const insightLines = insights
    .map((i) => `${i.id} | ${i.type}/${i.severity} | ${i.title} | ${cut(i.description, 120)}`)
    .join("\n");
  const interviewLines = interviews
    .map((iv) => `${iv.id} | ${iv.title} | ${cut(iv.aiSummary, 120)}`)
    .join("\n");
  const personaBalance = personas
    .map((p) => `${p.id} ${p.name}: ${participants.filter((pt) => pt.personaIds.includes(p.id)).length} participants`)
    .join("\n");
  const themeList = themes.map((t) => `${t.id} ${t.name}`).join(", ");

  return redactIfEnabled(
    `INSIGHTS (id | type/severity | title | description):
${insightLines}

INTERVIEWS (id | title | summary):
${interviewLines}

PERSONA COVERAGE:
${personaBalance}

EXISTING THEMES: ${themeList}

${/* Structure only: a suggestion pass needs to know what's being tested and
      whether anyone has responded, not every recorded number. */ ""}
${testsSection(tallies, false)}`,
  );
}
