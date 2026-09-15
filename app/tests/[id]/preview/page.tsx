"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getTest } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { MissingRecord } from "@/components/ui/missing-record";
import { TestRunner } from "@/app/t/[token]/runner";

/**
 * Researcher preview: the exact participant flow, rendered from the store
 * (drafts included) with recording disabled — no session is ever created,
 * so trying your own test can't pollute the results.
 */
export default function TestPreviewPage() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useApp((s) => s.hydrated);
  // Remounts the runner to restart the walkthrough from the first block.
  const [run, setRun] = React.useState(0);

  const test = getTest(id);
  if (!test) return <MissingRecord hydrated={hydrated} />;

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-surface px-4 py-2">
        <Button variant="outline" size="sm" onClick={() => router.push(`/tests/${test.id}`)}>
          <ArrowLeft className="h-4 w-4" /> Back to builder
        </Button>
        <p className="min-w-0 flex-1 truncate text-xs text-muted">
          Previewing “{test.name}” — nothing is recorded
        </p>
        <Button variant="outline" size="sm" onClick={() => setRun((n) => n + 1)}>
          <RotateCcw className="h-4 w-4" /> Restart
        </Button>
      </div>
      <TestRunner key={run} token="preview" preview initialDefinition={{ name: test.name, blocks: test.blocks }} />
    </div>
  );
}
