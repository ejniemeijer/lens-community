"use client";

import * as React from "react";
import { Download, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import type { ResearchProject, TestSession, UsabilityTest } from "@/lib/types";
import {
  assembleReportMarkdown,
  buildReportFacts,
  REPORT_MIN_SESSIONS,
  REPORT_SYSTEM,
  reportUserMessage,
  type SavedTestReport,
} from "@/lib/tests-report";
import { streamAI, redactIfEnabled, AiError } from "@/lib/ai";
import { downloadText, stamp } from "@/lib/export";
import { useApp } from "@/lib/store";
import { currentUser } from "@/lib/db";
import { can } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { AiProse } from "@/components/ui/ai-prose";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "test";

/**
 * The whole-test AI report: streams a narrative (executive summary, findings,
 * recommendations, caveats) over the deterministic facts document, then offers
 * the assembled Markdown as a download. The numbers in the download come from
 * code, not the model — the AI only writes the interpretation, and the file
 * says so. Gating (use-ai + configured key + sessions exist) is the caller's.
 *
 * A generated report is saved on the test (tests.report), so reopening it is
 * free — generation costs tokens exactly once, and "Regenerate" is the
 * explicit way to spend them again when new sessions have arrived.
 */
export function TestReportModal({
  open,
  onClose,
  test,
  project,
  sessions,
}: {
  open: boolean;
  onClose: () => void;
  test: UsabilityTest;
  project?: ResearchProject;
  sessions: TestSession[];
}) {
  const role = useApp((s) => s.role);
  const updateTest = useApp((s) => s.updateTest);
  const logExport = useApp((s) => s.logExport);
  const toast = useApp((s) => s.toast);
  const [status, setStatus] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [streaming, setStreaming] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // A fresh (unsaved) result, for members whose role can't write tests —
  // they still get the report and the download for this visit.
  const [local, setLocal] = React.useState<SavedTestReport | null>(null);

  // What's shown: the freshly generated report wins, else the saved one.
  const report = local ?? test.report ?? null;

  const run = async () => {
    setStatus("running");
    setError(null);
    setStreaming("");
    try {
      const facts = buildReportFacts(test, sessions, redactIfEnabled);
      const narrative = await streamAI(
        {
          system: REPORT_SYSTEM,
          messages: [{ role: "user", content: reportUserMessage(test.name, facts) }],
          maxTokens: 1600,
        },
        (delta) => setStreaming((prev) => prev + delta),
      );
      const next: SavedTestReport = {
        narrative,
        facts,
        generatedAt: new Date().toISOString(),
        sessions: sessions.length,
        completed: sessions.filter((s) => s.status === "completed").length,
      };
      setLocal(next);
      // Persist so the next open is token-free. tests' RLS only lets
      // manage-content roles write, so others keep it session-local.
      if (can(role, "manage-content")) updateTest(test.id, { report: next });
      setStatus("done");
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Couldn't generate the report. Please try again.");
      setStatus("error");
    }
  };

  // First open: reuse the saved report if there is one; only generate when
  // nothing is saved (that's the token-saving point of persisting it).
  React.useEffect(() => {
    if (!open || status !== "idle") return;
    if (report) setStatus("done");
    else void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const download = () => {
    if (!report) return;
    const md = assembleReportMarkdown({ test, project, report });
    downloadText(stamp(`${slugify(test.name)}-report`, "md"), md, "text/markdown");
    logExport(`Test report (Markdown) — ${test.name}`, currentUser().name);
    toast("Report downloaded", "success");
  };

  const newSessions = report ? sessions.length - report.sessions : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="AI report"
      description="An AI-written narrative over the full results. The downloaded file carries every number and answer as a code-generated appendix — the AI only writes the interpretation."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={() => void run()} disabled={status === "running"}>
            <RefreshCw className="h-4 w-4" /> {report ? "Regenerate" : "Generate"}
          </Button>
          <Button variant="primary" size="sm" onClick={download} disabled={status === "running" || !report}>
            <Download className="h-4 w-4" /> Download report (.md)
          </Button>
        </>
      }
    >
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
        {sessions.length < REPORT_MIN_SESSIONS && (
          <p className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-soft/40 px-3 py-2 text-xs text-foreground">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            Only {sessions.length} session{sessions.length === 1 ? "" : "s"} so far — with this little data the
            report can't say much beyond restating the answers.
          </p>
        )}
        {status === "running" ? (
          streaming === "" ? (
            <p className="flex items-center gap-2 py-6 text-sm text-subtle">
              <Sparkles className="h-4 w-4 animate-pulse text-primary" /> Reading {sessions.length} session
              {sessions.length === 1 ? "" : "s"}…
            </p>
          ) : (
            <AiProse text={streaming} className="text-[13px]" />
          )
        ) : status === "error" ? (
          <p className="text-sm text-danger">{error}</p>
        ) : report ? (
          <>
            <div className="flex flex-wrap items-center gap-x-2 text-2xs text-subtle">
              <span>
                Generated {report.generatedAt.slice(0, 10)} from {report.sessions} session
                {report.sessions === 1 ? "" : "s"} — saved, reopening is free.
              </span>
              {newSessions > 0 && (
                <span className="font-medium text-warning">
                  {newSessions} new session{newSessions === 1 ? "" : "s"} since — regenerate to include them.
                </span>
              )}
            </div>
            <AiProse text={report.narrative} className="text-[13px]" />
            <p className="text-2xs text-subtle">
              AI-generated — verify against the appendix in the download, which is computed from the raw sessions.
            </p>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
