"use client";

import { downloadText, stamp, toCsv } from "@/lib/export";
import type { ResearchProject, TestBlock, TestQuestion, TestSession, UsabilityTest } from "@/lib/types";
import { blockSummary } from "@/components/tests/block-editors";

/**
 * Test-results export. Sessions are anonymous by design (no participant
 * identifiers exist to scrub), so unlike the repository exports there is no
 * pseudonymization pass — the only personal data that can appear is what a
 * participant volunteered inside an open-text answer.
 */

export const questionsOf = (b: TestBlock): TestQuestion[] =>
  b.type === "questions" || b.type === "five-second" || b.type === "design-feedback"
    ? b.questions
    : b.type === "message"
      ? []
      : b.followUpQuestions;

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "test";

const secs = (ms?: number | null) => (ms === undefined || ms === null ? "" : Math.round(ms / 1000));

/** One flat row per session — uniform keys across all rows (toCsv reads
    headers from the first row), wide format so it opens cleanly in Excel. */
export function testSessionRows(test: UsabilityTest, sessions: TestSession[]): Record<string, unknown>[] {
  return sessions.map((s) => {
    const row: Record<string, unknown> = {
      session: s.id,
      status: s.status,
      started: s.startedAt,
      completed: s.completedAt ?? "",
      duration_s: s.completedAt ? secs(new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) : "",
      device: s.device?.pointer ?? "",
    };
    test.blocks.forEach((b, i) => {
      const label = `${i + 1}. ${blockSummary(b)}`;
      const r = s.results[b.id];
      row[`${label} — completed`] = r ? "yes" : "no";
      row[`${label} — duration_s`] = secs(r?.durationMs);
      if (b.type === "app-task" || b.type === "first-click") {
        row[`${label} — outcome`] = r?.outcome ?? "";
      }
      if (b.type === "first-click") {
        row[`${label} — click_xy`] = r?.click ? `${r.click.x};${r.click.y}` : "";
        row[`${label} — time_to_click_s`] = secs(r?.timeToClickMs);
      }
      if (b.type === "preference") {
        const i = b.options.findIndex((o) => o.id === r?.choice);
        row[`${label} — choice`] = i >= 0 ? b.options[i].label || `Option ${String.fromCharCode(65 + i)}` : "";
      }
      if (b.type === "app-task") {
        row[`${label} — outcome_comment`] = r?.outcomeComment ?? "";
        const events = r?.beaconEvents ?? [];
        row[`${label} — path`] = events.filter((e) => e.type === "page").map((e) => e.path).join(" → ");
        row[`${label} — clicks`] = events.length ? events.filter((e) => e.type === "click").length : "";
      }
      for (const q of questionsOf(b)) {
        const v = r?.answers?.[q.id];
        row[`${label} — ${q.prompt || q.id}`] =
          v === undefined
            ? ""
            : Array.isArray(v)
              ? v.join("; ")
              : typeof v === "object"
                ? Object.entries(v).map(([stmt, n]) => `${stmt}: ${n}`).join("; ")
                : v;
      }
    });
    return row;
  });
}

export function exportTestResultsCsv(test: UsabilityTest, sessions: TestSession[]) {
  downloadText(stamp(`${slugify(test.name)}-results`, "csv"), toCsv(testSessionRows(test, sessions)), "text/csv");
}

export function exportTestResultsJson(test: UsabilityTest, project: ResearchProject | undefined, sessions: TestSession[]) {
  const payload = {
    exportedAt: new Date().toISOString(),
    test: { id: test.id, name: test.name, status: test.status, project: project?.name ?? null, blocks: test.blocks },
    sessions,
  };
  downloadText(stamp(`${slugify(test.name)}-results`, "json"), JSON.stringify(payload, null, 2), "application/json");
}
