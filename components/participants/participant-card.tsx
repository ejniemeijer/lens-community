import { Building2, MessageSquare, CalendarClock } from "lucide-react";
import type { Participant } from "@/lib/types";
import { getCompany, getPersonas, getTags, fullName } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { PersonaChip, RecruitmentBadge, TagChip } from "@/components/domain/badges";
import { LinkCard } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export function ParticipantCard({ participant }: { participant: Participant }) {
  const company = getCompany(participant.companyId);
  const personas = getPersonas(participant.personaIds);
  const painTags = getTags(participant.painPointTagIds).slice(0, 3);

  return (
    <LinkCard href={`/participants/${participant.id}`} className="p-4">
      <div className="flex items-start gap-3">
        <Avatar name={fullName(participant)} accent={participant.avatarColor} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground group-hover:text-primary">
            {fullName(participant)}
          </p>
          <p className="truncate text-[13px] text-muted">{participant.jobTitle}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-subtle">
            <Building2 className="h-3 w-3" /> {company?.name} · {participant.country}
          </p>
        </div>
        <RecruitmentBadge status={participant.recruitmentStatus} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {personas.map((p) => (
          <PersonaChip key={p.id} persona={p} />
        ))}
      </div>

      {painTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {painTags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-border pt-3 text-xs text-subtle">
        <span className="flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> {participant.interviewCount} interviews
        </span>
        <span>·</span>
        <span className="capitalize">{participant.usageLevel} user</span>
        {participant.scheduledSession && (
          <span className="ml-auto flex items-center gap-1 font-medium text-primary">
            <CalendarClock className="h-3 w-3" />
            {formatDate(participant.scheduledSession.date, { year: undefined })} · {participant.scheduledSession.time}
          </span>
        )}
      </div>
    </LinkCard>
  );
}
