"use client";

import * as React from "react";
import type { TestBlock, TestBlockResult, TestQuestion, TestSession } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { blockSummary } from "@/components/tests/block-editors";

/** Read-only per-block drill-down for one session (results page). */

const OUTCOME_META: Record<string, { label: string; tone: "success" | "danger" | "warning" }> = {
  "success-auto": { label: "Completed (detected)", tone: "success" },
  "success-reported": { label: "Completed (self-reported)", tone: "success" },
  "gave-up": { label: "Gave up", tone: "danger" },
  skipped: { label: "Skipped", tone: "warning" },
};

const questionsOf = (b: TestBlock): TestQuestion[] =>
  b.type === "questions" || b.type === "five-second" || b.type === "design-feedback"
    ? b.questions
    : b.type === "message"
      ? []
      : b.followUpQuestions;

const fmtMs = (ms?: number) => {
  if (ms === undefined) return null;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

function BlockLine({ block, index, result }: { block: TestBlock; index: number; result?: TestBlockResult }) {
  const outcome = result?.outcome ? OUTCOME_META[result.outcome] : undefined;
  const questions = questionsOf(block);
  const pages = (result?.beaconEvents ?? []).filter((e) => e.type === "page");
  const clicks = (result?.beaconEvents ?? []).filter((e) => e.type === "click").length;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {index + 1}. {blockSummary(block)}
        </p>
        {outcome && <Badge tone={outcome.tone}>{outcome.label}</Badge>}
        {result?.durationMs !== undefined && <span className="text-2xs text-subtle">{fmtMs(result.durationMs)}</span>}
        {/* The consent gate stores no result — the session existing IS the consent. */}
        {!result &&
          (block.type === "message" && block.isConsentGate ? (
            <Badge tone="success">Consented</Badge>
          ) : (
            <span className="text-2xs text-subtle">not reached</span>
          ))}
      </div>
      {result?.click && (
        <p className="mt-1 text-2xs text-subtle">
          Clicked at {Math.round(result.click.x * 100)}%, {Math.round(result.click.y * 100)}%
          {result.timeToClickMs !== undefined ? ` after ${fmtMs(result.timeToClickMs)}` : ""}
        </p>
      )}
      {result?.outcomeComment && (
        <p className="mt-1 text-2xs text-muted">
          <span className="text-subtle">In their words:</span> “{result.outcomeComment}”
        </p>
      )}
      {result?.choice && block.type === "preference" && (
        <p className="mt-1 text-2xs text-muted">
          <span className="text-subtle">Chose:</span>{" "}
          {(() => {
            const i = block.options.findIndex((o) => o.id === result.choice);
            return i >= 0 ? block.options[i].label || `Option ${String.fromCharCode(65 + i)}` : result.choice;
          })()}
        </p>
      )}
      {pages.length > 0 && (
        <p className="mt-1 truncate font-mono text-2xs text-subtle">
          {pages.map((e) => e.path).join(" → ")} · {clicks} click{clicks === 1 ? "" : "s"}
        </p>
      )}
      {questions.length > 0 && result?.answers && (
        <div className="mt-1.5 flex flex-col gap-1">
          {questions.map((q) => {
            const v = result.answers?.[q.id];
            if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return null;
            const text =
              typeof v === "number"
                ? `${v} / ${q.scale ?? 5}`
                : Array.isArray(v)
                  ? v.join(", ")
                  : typeof v === "object"
                    ? Object.entries(v).map(([stmt, n]) => `${stmt}: ${n}/${q.scale ?? 5}`).join(" · ")
                    : `“${v}”`;
            return (
              <p key={q.id} className="text-2xs text-muted">
                <span className="text-subtle">{q.prompt}:</span> {text}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SessionDetail({ blocks, session }: { blocks: TestBlock[]; session: TestSession }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border bg-surface-2/50 p-2.5">
      {blocks.map((b, i) => (
        <BlockLine key={b.id} block={b} index={i} result={session.results[b.id]} />
      ))}
    </div>
  );
}
