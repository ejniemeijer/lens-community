import { Clock, Video, FileText, Lightbulb, CalendarClock, Calendar } from "lucide-react";
import type { Interview } from "@/lib/types";
import { getParticipant, getUser, fullName, isScheduledInterview } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LinkCard } from "@/components/ui/card";
import { SentimentBadge } from "@/components/domain/badges";
import { formatDate, formatDuration } from "@/lib/utils";

/** Card layout for an interview (the grid/Cards view on the interviews list). */
export function InterviewCard({ interview }: { interview: Interview }) {
  const participant = getParticipant(interview.participantId);
  const researcher = getUser(interview.researcherId);
  const scheduled = isScheduledInterview(interview);
  return (
    <LinkCard href={`/interviews/${interview.id}`} className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 text-[14px] font-medium leading-snug text-foreground group-hover:text-primary line-clamp-2">
          {interview.title}
        </p>
        {scheduled ? (
          <Badge tone="info"><CalendarClock className="h-3 w-3" /> Scheduled</Badge>
        ) : (
          <SentimentBadge value={interview.sentiment} />
        )}
      </div>
      {participant && (
        <div className="flex items-center gap-2">
          <Avatar name={fullName(participant)} accent={participant.avatarColor} size="xs" />
          <span className="min-w-0 truncate text-[13px] text-muted">
            {fullName(participant)}
            {researcher ? ` · by ${researcher.name.split(" ")[0]}` : ""}
          </span>
        </div>
      )}
      <div className="mt-auto flex items-center gap-3 border-t border-border pt-2.5 text-2xs text-subtle">
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(interview.date)}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(interview.durationMinutes)}</span>
        {interview.hasRecording && <Video className="h-3 w-3" />}
        {interview.transcriptId && <FileText className="h-3 w-3" />}
        <span className="ml-auto flex items-center gap-1"><Lightbulb className="h-3 w-3" />{interview.insightIds.length}</span>
      </div>
    </LinkCard>
  );
}
