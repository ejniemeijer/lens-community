"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Combine, X, CheckCircle2 } from "lucide-react";
import { aiSuggestions, getInsight } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/domain/badges";

export function DuplicatesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useDb();
  const dismissed = useApp((s) => s.dismissedAi);
  const dismiss = useApp((s) => s.dismissSuggestion);
  const merge = useApp((s) => s.mergeInsights);
  const toast = useApp((s) => s.toast);

  const candidates = aiSuggestions.filter(
    (s) =>
      s.kind === "duplicate" &&
      !dismissed.includes(s.id) &&
      (s.relatedIds ?? []).filter((id) => getInsight(id)).length >= 2,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Duplicate detection"
      description="AI compares titles, evidence, and participants across all insights."
      className="max-w-xl"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {candidates.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-success" />
          <p className="text-sm font-medium text-foreground">No duplicates detected</p>
          <p className="text-xs text-muted">Your insight repository looks clean.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {candidates.map((s) => {
            const [a, b] = (s.relatedIds ?? []).map((id) => getInsight(id));
            if (!a || !b) return null;
            return (
              <div key={s.id} className="rounded-lg border border-border p-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <Copy className="h-4 w-4 text-primary" />
                  <span className="text-[13px] font-medium text-foreground">{s.title}</span>
                  <ConfidenceBadge value={s.confidence} />
                </div>
                <p className="mb-3 text-xs text-muted">{s.detail}</p>
                <div className="mb-3 flex flex-col gap-1.5">
                  {[a, b].map((ins, i) => (
                    <Link
                      key={ins.id}
                      href={`/insights/${ins.id}`}
                      className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[13px] text-foreground hover:bg-surface-hover"
                    >
                      <span className="rounded bg-surface-2 px-1.5 text-2xs font-semibold text-subtle">
                        {i === 0 ? "KEEP" : "MERGE IN"}
                      </span>
                      <span className="truncate">{ins.title}</span>
                    </Link>
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      dismiss(s.id);
                      toast("Suggestion dismissed", "info");
                    }}
                  >
                    <X className="h-3.5 w-3.5" /> Not a duplicate
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      merge(a.id, b.id);
                      dismiss(s.id);
                      toast(`Merged “${b.title}” into “${a.title}”`);
                    }}
                  >
                    <Combine className="h-3.5 w-3.5" /> Merge
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
