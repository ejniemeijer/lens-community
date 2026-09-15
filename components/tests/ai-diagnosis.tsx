"use client";

import * as React from "react";
import { Sparkles, Lightbulb, TriangleAlert, RefreshCw } from "lucide-react";
import type { TestBlock, TestBlockResult } from "@/lib/types";
import {
  buildDiagnosisBrief,
  diagnosisUserMessage,
  DIAGNOSIS_SYSTEM,
  DIAGNOSIS_MIN_SESSIONS,
  type Diagnosis,
} from "@/lib/tests-diagnosis";
import { askAIJson, redactIfEnabled, AiError } from "@/lib/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const CONF_TONE = { high: "success", medium: "primary", low: "warning" } as const;

/**
 * "Diagnose with AI" for an app-task block: reads the behavioral telemetry
 * (not just the answers) and explains *why* people struggled. Gated by the
 * caller (Team analytics + use-ai + a configured key); here we only guard the
 * data floor and drive the call.
 */
export function AiDiagnosis({
  block,
  results,
  onPromote,
}: {
  block: Extract<TestBlock, { type: "app-task" }>;
  results: TestBlockResult[];
  onPromote?: (title: string, evidence: string) => void;
}) {
  const [status, setStatus] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [diagnosis, setDiagnosis] = React.useState<Diagnosis | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const withBeacon = results.filter((r) => (r.beaconEvents?.length ?? 0) > 0).length;
  const enough = withBeacon >= DIAGNOSIS_MIN_SESSIONS;

  const run = async () => {
    setStatus("running");
    setError(null);
    try {
      const brief = buildDiagnosisBrief(block, results, redactIfEnabled);
      const d = await askAIJson<Diagnosis>({
        system: DIAGNOSIS_SYSTEM,
        messages: [{ role: "user", content: diagnosisUserMessage(brief) }],
        maxTokens: 1100,
      });
      setDiagnosis(d);
      setStatus("done");
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Couldn't generate a diagnosis. Please try again.");
      setStatus("error");
    }
  };

  return (
    <div className="rounded-lg border border-primary/25 bg-primary-soft/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-semibold text-foreground">Behavioral diagnosis</span>
        </div>
        {enough && status !== "running" && (
          <Button size="sm" variant={status === "done" ? "outline" : "primary"} onClick={run}>
            {status === "done" ? <><RefreshCw className="h-3.5 w-3.5" /> Re-run</> : <><Sparkles className="h-3.5 w-3.5" /> Diagnose with AI</>}
          </Button>
        )}
      </div>

      {!enough ? (
        <p className="mt-1.5 text-xs text-subtle">
          Need {DIAGNOSIS_MIN_SESSIONS}+ sessions with click data to diagnose — {withBeacon} so far.
        </p>
      ) : status === "idle" ? (
        <p className="mt-1.5 text-xs text-muted">
          Reads the click paths, rage clicks, and outcomes across {withBeacon} sessions to explain why people
          struggled. Uses your configured AI provider.
        </p>
      ) : status === "running" ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Analyzing behavior across {withBeacon} sessions…
        </p>
      ) : status === "error" ? (
        <p className="mt-2 text-xs font-medium text-danger">{error}</p>
      ) : diagnosis ? (
        <div className="mt-2.5 flex flex-col gap-2.5">
          <p className="text-[13px] font-medium leading-relaxed text-foreground">{diagnosis.summary}</p>
          {diagnosis.findings.map((f, i) => (
            <div key={i} className="rounded-md border border-border bg-surface p-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-foreground">{f.observation}</p>
                <Badge tone={CONF_TONE[f.confidence] ?? "neutral"}>{f.confidence}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{f.evidence}</p>
              <p className="mt-1.5 text-xs text-foreground"><span className="text-subtle">Likely cause: </span>{f.hypothesis}</p>
              <p className="mt-1 text-xs text-foreground"><span className="text-subtle">Suggested fix: </span>{f.fix}</p>
              {onPromote && (
                <button
                  className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                  onClick={() =>
                    onPromote(
                      f.observation,
                      `${f.evidence}\n\nLikely cause: ${f.hypothesis}\n\nSuggested fix: ${f.fix}`,
                    )
                  }
                >
                  <Lightbulb className="h-3.5 w-3.5" /> Promote to insight
                </button>
              )}
            </div>
          ))}
          {diagnosis.caveat && (
            <p className="flex items-start gap-1.5 text-xs text-warning">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {diagnosis.caveat}
            </p>
          )}
          <p className="text-2xs text-subtle">AI-generated from behavioral data — verify against the sessions before acting.</p>
        </div>
      ) : null}
    </div>
  );
}
