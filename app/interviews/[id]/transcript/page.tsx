"use client";

import { useParams } from "next/navigation";
import { getInterview, getTranscriptByInterview } from "@/lib/db";
import { useApp, useDb } from "@/lib/store";
import { MissingRecord } from "@/components/ui/missing-record";
import { TranscriptWorkspace } from "@/components/transcript/transcript-workspace";

export default function TranscriptPage() {
  useDb();
  const { id } = useParams<{ id: string }>();
  const hydrated = useApp((s) => s.hydrated);
  const interview = getInterview(id);
  const transcript = interview ? getTranscriptByInterview(interview.id) : undefined;

  if (!interview || !transcript) return <MissingRecord hydrated={hydrated} />;

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <TranscriptWorkspace interview={interview} transcript={transcript} />
    </div>
  );
}
