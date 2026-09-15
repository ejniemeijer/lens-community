"use client";

import * as React from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import type { TestAnswerValue, TestQuestion } from "@/lib/types";
import { askAIJson, redactIfEnabled, AiError } from "@/lib/ai";
import { SUMMARY_SYSTEM, summaryUserMessage, SUMMARY_MIN_ANSWERS, type AnswerSummary } from "@/lib/tests-ai";

/** Aggregated answer views per question type, shared by the results page. */

/** Opens the results page's promote-to-insight modal, prefilled. */
export type PromoteFn = (title: string, evidence: string) => void;

/** AI theme summary over a question's verbatim answers (all plans, gated by
    the caller on use-ai + a configured key). */
function OpenAnswerSummary({
  prompt,
  verbatims,
  onPromote,
}: {
  prompt: string;
  verbatims: string[];
  onPromote?: PromoteFn;
}) {
  const [status, setStatus] = React.useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = React.useState<AnswerSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    setStatus("running");
    setError(null);
    try {
      const redacted = verbatims.map((v) => redactIfEnabled(v));
      const r = await askAIJson<AnswerSummary>({
        system: SUMMARY_SYSTEM,
        messages: [{ role: "user", content: summaryUserMessage(prompt, redacted) }],
        maxTokens: 700,
      });
      setResult(r);
      setStatus("done");
    } catch (e) {
      setError(e instanceof AiError ? e.message : "Couldn't summarize. Please try again.");
      setStatus("error");
    }
  };

  if (status === "idle")
    return (
      <button className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline" onClick={run}>
        <Sparkles className="h-3.5 w-3.5" /> Summarize {verbatims.length} answers with AI
      </button>
    );
  if (status === "running")
    return (
      <p className="mt-2 flex items-center gap-2 text-xs text-muted">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" /> Summarizing…
      </p>
    );
  if (status === "error") return <p className="mt-2 text-xs font-medium text-danger">{error}</p>;
  if (!result) return null;
  return (
    <div className="mt-2 rounded-md border border-primary/25 bg-primary-soft/30 p-2.5">
      <p className="text-xs font-medium leading-relaxed text-foreground">{result.summary}</p>
      {result.themes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1.5">
          {result.themes.map((t, i) => (
            <li key={i} className="text-xs">
              <span className="font-semibold text-foreground">{t.label}</span>
              {typeof t.count === "number" && <span className="text-subtle"> · ~{t.count}</span>}
              {t.example && <span className="text-muted"> — “{t.example}”</span>}
              {onPromote && (
                /* One theme = one finding = the right grain for an insight. */
                <button
                  className="ml-2 inline-flex items-center gap-1 align-middle text-2xs font-medium text-primary hover:underline"
                  onClick={() =>
                    onPromote(
                      t.label,
                      [
                        `Q: ${prompt}`,
                        `~${t.count ?? "?"} of ${verbatims.length} answers touch this.`,
                        t.example ? `Example: “${t.example}”` : null,
                        "",
                        result.summary,
                      ]
                        .filter((l): l is string => l !== null)
                        .join("\n"),
                    )
                  }
                >
                  <Lightbulb className="h-3 w-3" /> Promote
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1.5 text-2xs text-subtle">AI-generated — verify against the answers.</p>
    </div>
  );
}

/** Diverging tint by score position — low red, mid neutral, high green. The
    numeric labels under each bar carry identity, so color is never alone. */
const scoreTint = (i: number, scale: number) => {
  const r = scale <= 1 ? 1 : i / (scale - 1);
  if (r < 0.34) return "bg-[hsl(356_64%_45%)] dark:bg-danger";
  if (r < 0.67) return "bg-subtle/50";
  return "bg-success";
};

function RatingBars({ scale, values }: { scale: number; values: number[] }) {
  const counts = Array.from({ length: scale }, (_, i) => values.filter((v) => v === i + 1).length);
  const max = Math.max(1, ...counts);
  const avg = values.length ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : "—";
  return (
    <div>
      <div className="flex items-end gap-1.5">
        {counts.map((c, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span className="text-2xs text-subtle">{c || ""}</span>
            <div
              className={`w-7 rounded-t ${scoreTint(i, scale)}`}
              style={{ height: `${8 + (c / max) * 48}px`, opacity: c === 0 ? 0.15 : 1 }}
            />
            <span className="text-2xs text-muted">{i + 1}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-subtle">
        Average <span className="font-medium text-foreground">{avg}</span> · {values.length} answer{values.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/** Horizontal option distribution (multiple choice, yes/no). Yes/no gets
    status colors (labels carry identity); choice emphasizes the leader in
    the single brand hue rather than a categorical rainbow. */
function OptionBars({ options, picks, yesNo = false }: { options: string[]; picks: string[]; yesNo?: boolean }) {
  const total = picks.length;
  const counts = options.map((o) => picks.filter((p) => p === o).length);
  const maxN = Math.max(0, ...counts);
  const fillFor = (option: string, n: number) => {
    if (yesNo) return option === "yes" ? "bg-success" : "bg-[hsl(356_64%_45%)] dark:bg-danger";
    return n === maxN && maxN > 0 ? "bg-primary" : "bg-primary/40";
  };
  return (
    <div className="flex flex-col gap-1.5">
      {options.map((option, i) => {
        const n = counts[i];
        const share = total ? n / total : 0;
        return (
          <div key={option} className="flex items-center gap-2">
            <span className="w-40 shrink-0 truncate text-xs text-foreground capitalize">{option}</span>
            <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${fillFor(option, n)}`} style={{ width: `${share * 100}%` }} />
            </div>
            <span className="w-16 shrink-0 text-right text-2xs text-subtle">
              {n} · {total ? Math.round(share * 100) : 0}%
            </span>
          </div>
        );
      })}
      <p className="text-2xs text-subtle">{total} selection{total === 1 ? "" : "s"}</p>
    </div>
  );
}

export function QuestionResults({
  questions,
  answers,
  aiReady = false,
  onPromote,
}: {
  questions: TestQuestion[];
  answers: Record<string, TestAnswerValue>[];
  /** Show "Summarize with AI" on open/input questions (use-ai + configured). */
  aiReady?: boolean;
  /** When set, each AI theme gets a promote-to-insight button (manage-content). */
  onPromote?: PromoteFn;
}) {
  return (
    <div className="flex flex-col gap-4">
      {questions.map((q) => {
        const values = answers.map((a) => a[q.id]).filter((v) => v !== undefined && v !== "");
        return (
          <div key={q.id}>
            <p className="text-[13px] font-medium text-foreground">{q.prompt}</p>
            <div className="mt-2">
              {values.length === 0 ? (
                <p className="text-xs text-subtle">No answers yet.</p>
              ) : q.type === "rating" ? (
                <RatingBars scale={q.scale ?? 5} values={values.filter((v): v is number => typeof v === "number")} />
              ) : q.type === "choice" ? (
                <OptionBars
                  options={(q.options ?? []).map((o) => o.trim()).filter(Boolean)}
                  picks={values.flatMap((v) => (Array.isArray(v) ? v : typeof v === "string" ? [v] : []))}
                />
              ) : q.type === "yes-no" ? (
                <OptionBars yesNo options={["yes", "no"]} picks={values.filter((v): v is string => typeof v === "string")} />
              ) : q.type === "matrix" ? (
                <div className="flex flex-col gap-1.5">
                  {(q.statements ?? [])
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((statement) => {
                      const ratings = values
                        .map((v) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>)[statement] : undefined))
                        .filter((n): n is number => typeof n === "number");
                      const avg = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
                      const scale = q.scale ?? 5;
                      return (
                        <div key={statement} className="flex items-center gap-2">
                          <span className="w-56 shrink-0 truncate text-xs text-foreground">{statement}</span>
                          <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(avg / scale) * 100}%` }} />
                          </div>
                          <span className="w-20 shrink-0 text-right text-2xs text-subtle">
                            {ratings.length ? `${avg.toFixed(1)} / ${scale} · ${ratings.length}` : "—"}
                          </span>
                        </div>
                      );
                    })}
                </div>
              ) : (
                // open text + input: verbatim answers
                (() => {
                  const verbatims = values.filter((v): v is string => typeof v === "string");
                  return (
                    <>
                      <ul className="flex flex-col gap-1.5">
                        {verbatims.map((v, i) => (
                          <li key={i} className="rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-muted">
                            “{v}”
                          </li>
                        ))}
                      </ul>
                      {aiReady && verbatims.length >= SUMMARY_MIN_ANSWERS && (
                        <OpenAnswerSummary prompt={q.prompt} verbatims={verbatims} onPromote={onPromote} />
                      )}
                    </>
                  );
                })()
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
