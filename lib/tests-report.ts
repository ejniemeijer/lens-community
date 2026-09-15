"use client";

import type { ResearchProject, TestAnswerValue, TestBlock, TestBlockResult, TestSession, UsabilityTest } from "@/lib/types";
import { blockSummary } from "@/components/tests/block-editors";
import { questionsOf } from "@/lib/test-export";

/**
 * The overall test report: one downloadable Markdown document for a whole
 * test's results.
 *
 * Split deliberately in two:
 *   1. buildReportFacts — deterministic. Every number, distribution and
 *      verbatim is computed here, in code, from the sessions. This section is
 *      the appendix of the report and is never touched by the model.
 *   2. The AI narrative — the model reads the facts document and writes the
 *      executive summary / findings / recommendations on top of it.
 *
 * That split is the point: a report whose numbers come from an LLM can't be
 * trusted or audited; a report that's only numbers doesn't get read. The
 * assembled file states which half is which.
 */

/* ---------------- small stat helpers ---------------- */

const fmtMs = (ms?: number) => {
  if (ms === undefined || Number.isNaN(ms)) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const median = (xs: number[]) => {
  if (xs.length === 0) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const pct = (n: number, of: number) => (of === 0 ? "—" : `${Math.round((n / of) * 100)}%`);

/** Cap on verbatims quoted per open question — enough to see the range,
    without one chatty question flooding the prompt and the appendix. */
export const REPORT_VERBATIM_CAP = 30;

const OUTCOME_LABELS: Record<string, string> = {
  "success-auto": "Completed (detected)",
  "success-reported": "Completed (self-reported)",
  failure: "Couldn't do it",
  "gave-up": "Gave up",
  skipped: "Skipped",
};

/* ---------------- the deterministic facts document ---------------- */

/**
 * Markdown facts for a whole test. `redact` is injected the same way as the
 * diagnosis brief's, so this module stays importable without the AI layer;
 * pass lib/ai's redactIfEnabled in real use.
 */
export function buildReportFacts(
  test: UsabilityTest,
  sessions: TestSession[],
  redact: (s: string) => string = (s) => s,
): string {
  const completed = sessions.filter((s) => s.status === "completed");
  const durations = completed
    .filter((s) => s.completedAt)
    .map((s) => new Date(s.completedAt!).getTime() - new Date(s.startedAt).getTime());
  const devices = { mouse: 0, touch: 0, unknown: 0 };
  for (const s of sessions) {
    if (s.device?.pointer === "mouse") devices.mouse++;
    else if (s.device?.pointer === "touch") devices.touch++;
    else devices.unknown++;
  }

  const lines: string[] = [
    `Sessions: ${sessions.length} started, ${completed.length} completed (${pct(completed.length, sessions.length)} completion)`,
    `Median completed duration: ${fmtMs(median(durations))}`,
    `Devices: ${devices.mouse} desktop, ${devices.touch} touch${devices.unknown ? `, ${devices.unknown} unknown` : ""}`,
    "",
  ];

  const resultsFor = (blockId: string) =>
    sessions.map((s) => s.results[blockId]).filter(Boolean) as TestBlockResult[];

  test.blocks.forEach((b, i) => {
    if (b.type === "message") return; // intro/consent — nothing measured
    const res = resultsFor(b.id);
    lines.push(`## ${i + 1}. ${blockSummary(b)}`);
    lines.push(...blockFactLines(b, res, sessions.length, redact));
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * The facts for one block — the report's per-block section, also the evidence
 * a block-level "promote to insight" prefills (via blockEvidence below).
 * One source: the report and the promoted evidence can't disagree.
 */
export function blockFactLines(
  b: TestBlock,
  res: TestBlockResult[],
  totalSessions: number,
  redact: (s: string) => string = (s) => s,
): string[] {
  const lines: string[] = [];
  {
    lines.push(`Reached by ${res.length}/${totalSessions} sessions.`);

    // Task outcomes (app task, and goal-based Figma prototypes — the two
    // block types whose runner records an outcome).
    if (b.type === "app-task" || (b.type === "figma-proto" && b.taskType !== "explore")) {
      const withOutcome = res.filter((r) => r.outcome);
      if (withOutcome.length) {
        const counts = new Map<string, number>();
        for (const r of withOutcome) counts.set(r.outcome!, (counts.get(r.outcome!) ?? 0) + 1);
        lines.push(
          `Outcomes: ${[...counts.entries()].map(([o, n]) => `${OUTCOME_LABELS[o] ?? o} ${n}/${withOutcome.length}`).join(", ")}`,
        );
      }
      const times = res.map((r) => r.durationMs).filter((d): d is number => d !== undefined);
      if (times.length) lines.push(`Median time on task: ${fmtMs(median(times))}`);
      const comments = res
        .map((r) => r.outcomeComment?.trim())
        .filter((c): c is string => Boolean(c))
        .slice(0, REPORT_VERBATIM_CAP);
      if (comments.length) {
        lines.push(`Participant comments on the outcome:`);
        for (const c of comments) lines.push(`> ${redact(c)}`);
      }
    }

    if (b.type === "first-click") {
      const times = res.map((r) => r.timeToClickMs).filter((t): t is number => t !== undefined);
      if (times.length) lines.push(`Median time to first click: ${fmtMs(median(times))} (${times.length} clicks recorded)`);
    }

    if (b.type === "preference") {
      const counts = b.options.map((o, idx) => ({
        label: o.label || `Option ${String.fromCharCode(65 + idx)}`,
        n: res.filter((r) => r.choice === o.id).length,
      }));
      const total = counts.reduce((s, c) => s + c.n, 0);
      if (total) lines.push(`Preference: ${counts.map((c) => `${c.label} ${c.n}/${total}`).join(", ")}`);
    }

    // Questions — followUps or the block's own.
    for (const q of questionsOf(b)) {
      const answers = res.map((r) => r.answers?.[q.id]).filter((v): v is TestAnswerValue => v !== undefined);
      if (answers.length === 0) continue;
      const head = `**Q: ${q.prompt || "(untitled question)"}** — ${answers.length} answer${answers.length === 1 ? "" : "s"}`;

      if (q.type === "rating") {
        const nums = answers.filter((v): v is number => typeof v === "number");
        const avg = nums.length ? (nums.reduce((a, v) => a + v, 0) / nums.length).toFixed(1) : "—";
        const scale = q.scale ?? 5;
        const dist = Array.from({ length: scale }, (_, k) => `${k + 1}:${nums.filter((v) => v === k + 1).length}`).join(" ");
        lines.push(`${head}. Average ${avg} on a 1–${scale} scale. Distribution: ${dist}`);
      } else if (q.type === "yes-no") {
        const yes = answers.filter((v) => v === "yes").length;
        lines.push(`${head}. Yes ${yes}/${answers.length} (${pct(yes, answers.length)}), No ${answers.length - yes}/${answers.length}`);
      } else if (q.type === "choice") {
        const picks = answers.flatMap((v) => (Array.isArray(v) ? v : [String(v)]));
        const counts = new Map<string, number>();
        for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
        lines.push(`${head}. ${[...counts.entries()].sort((a, c) => c[1] - a[1]).map(([o, n]) => `${o}: ${n}`).join(", ")}`);
      } else if (q.type === "matrix") {
        lines.push(head);
        const byStmt = new Map<string, number[]>();
        for (const v of answers) {
          if (typeof v !== "object" || Array.isArray(v)) continue;
          for (const [stmt, n] of Object.entries(v)) byStmt.set(stmt, [...(byStmt.get(stmt) ?? []), n]);
        }
        for (const [stmt, ns] of byStmt)
          lines.push(`- "${stmt}": average ${(ns.reduce((a, n) => a + n, 0) / ns.length).toFixed(1)} (1–${q.scale ?? 5}, n=${ns.length})`);
      } else {
        // open / input — verbatims, capped and redacted.
        const texts = answers.map((v) => String(v).trim()).filter(Boolean);
        lines.push(head);
        for (const t of texts.slice(0, REPORT_VERBATIM_CAP)) lines.push(`> ${redact(t)}`);
        if (texts.length > REPORT_VERBATIM_CAP) lines.push(`(+${texts.length - REPORT_VERBATIM_CAP} more answers not shown)`);
      }
    }
  }
  return lines;
}

/** Plain-text form of one block's facts, for an insight's evidence field —
    markdown emphasis stripped, quoted verbatims kept as quotes. No redaction:
    evidence stays inside the repository, same as typing it by hand. */
export function blockEvidence(b: TestBlock, res: TestBlockResult[], totalSessions: number): string {
  return blockFactLines(b, res, totalSessions)
    .map((l) => l.replace(/\*\*/g, "").replace(/^> (.*)$/, "“$1”"))
    .join("\n");
}

/* ---------------- the AI narrative ---------------- */

export const REPORT_SYSTEM = [
  "You are a senior UX researcher writing the findings report for an unmoderated usability test. You are given the complete factual results; the reader will see those same facts as an appendix, so never restate long lists — interpret.",
  "Use ONLY the data provided. Every claim must be checkable against the facts, and quantitative claims must carry their numbers (e.g. \"4 of 6 participants…\"). Do not invent sentiment, themes, or causes the data doesn't support.",
  "Structure, in Markdown: ## Executive summary (2–3 sentences), ## Key findings (numbered, most important first, each grounded in specific numbers or quotes), ## Recommendations (short, concrete, tied to a finding), ## Caveats (sample size, self-selection, anything the data can't tell us).",
  "If the sample is small, say so plainly in the caveats and soften the findings accordingly. Admitting weak evidence is part of the job.",
].join("\n");

export const reportUserMessage = (testName: string, facts: string) =>
  `Test: ${testName}\n\nFull results:\n\n${facts}`;

/** Fewer sessions than this and a narrative adds nothing over reading the
    answers — the UI still allows it, but shows a caveat up front. */
export const REPORT_MIN_SESSIONS = 3;

/* ---------------- assembly ---------------- */

/** The saved form of a generated report (persisted on the test, jsonb). */
export interface SavedTestReport {
  narrative: string;
  facts: string;
  generatedAt: string;
  sessions: number;
  completed: number;
}

/** Assembles the downloadable file from a (saved or fresh) report. Counts and
    date come from the report itself, not the current sessions — the header
    must describe the data the narrative was written over. */
export function assembleReportMarkdown(opts: {
  test: UsabilityTest;
  project?: ResearchProject;
  report: SavedTestReport;
}): string {
  const { test, project, report } = opts;
  const { narrative, facts } = report;
  return [
    `# Usability test report — ${test.name}`,
    "",
    [
      project ? `Project: ${project.name}` : null,
      `Generated: ${report.generatedAt.slice(0, 10)}`,
      `Sessions: ${report.sessions} (${report.completed} completed)`,
    ]
      .filter(Boolean)
      .join(" · "),
    "",
    narrative.trim(),
    "",
    "---",
    "",
    "*The narrative above was AI-generated from the results below — verify claims against them.*",
    "",
    "# Appendix — full results",
    "",
    facts.trim(),
    "",
  ].join("\n");
}
