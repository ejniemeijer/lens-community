import Link from "next/link";
import { Clock, Video, FileText, Lightbulb, CalendarClock } from "lucide-react";
import type { Interview } from "@/lib/types";
import { getParticipant, getUser, fullName, isScheduledInterview } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge } from "@/components/domain/badges";
import { formatDate, formatDuration } from "@/lib/utils";

export function InterviewRow({ interview }: { interview: Interview }) {
  const participant = getParticipant(interview.participantId);
  const researcher = getUser(interview.researcherId);
  const scheduled = isScheduledInterview(interview);
  return (
    <Link
      href={`/interviews/${interview.id}`}
      className="group flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-hover"
    >
      {participant && <Avatar name={fullName(participant)} accent={participant.avatarColor} size="sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">
          {interview.title}
        </p>
        <p className="truncate text-xs text-subtle">
          {participant ? fullName(participant) : "—"} · {formatDate(interview.date)}
          {researcher ? ` · by ${researcher.name.split(" ")[0]}` : ""}
        </p>
      </div>
      <div className="hidden items-center gap-3 text-2xs text-subtle sm:flex">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(interview.durationMinutes)}</span>
        {interview.hasRecording && <Video className="h-3 w-3" />}
        {interview.transcriptId && <FileText className="h-3 w-3" />}
        <span className="flex items-center gap-1"><Lightbulb className="h-3 w-3" />{interview.insightIds.length}</span>
      </div>
      {scheduled ? (
        <Badge tone="info">
          <CalendarClock className="h-3 w-3" /> Scheduled
        </Badge>
      ) : (
        <SentimentBadge value={interview.sentiment} />
      )}
    </Link>
  );
}
