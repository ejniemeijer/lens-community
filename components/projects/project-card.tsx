import { Users, MessageSquare, Calendar } from "lucide-react";
import type { ResearchProject } from "@/lib/types";
import { getUser, getUsers, projectInterviews, projectInsights, fullName } from "@/lib/db";
import { LinkCard } from "@/components/ui/card";
import { Meter } from "@/components/ui/misc";
import { AvatarGroup } from "@/components/ui/avatar";
import { ProjectStatusBadge } from "@/components/domain/badges";
import { formatDate } from "@/lib/utils";

export function ProjectCard({ project }: { project: ResearchProject }) {
  const owner = getUser(project.ownerId);
  const members = getUsers(project.memberIds);
  const answered = project.researchQuestions.filter((q) => q.answered).length;
  const total = project.researchQuestions.length;
  const ivs = projectInterviews(project.id).length;
  const ins = projectInsights(project.id).length;

  return (
    <LinkCard href={`/projects/${project.id}`} className="flex flex-col p-5">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug text-foreground group-hover:text-primary">
          {project.name}
        </h3>
        <ProjectStatusBadge status={project.status} />
      </div>
      <p className="line-clamp-2 text-[13px] text-muted">{project.description}</p>

      <div className="mt-3 flex items-center gap-2 text-2xs text-subtle">
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">{project.productArea}</span>
        <span>{project.methodology}</span>
      </div>

      <div className="mt-3.5">
        <div className="mb-1 flex items-center justify-between text-2xs text-subtle">
          <span>Research questions</span>
          <span>{answered}/{total} answered</span>
        </div>
        <Meter value={total ? answered / total : 0} />
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-2xs text-subtle">
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{project.participantIds.length}</span>
        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{ivs}</span>
        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(project.endDate, { month: "short", day: undefined })}</span>
        <span className="ml-auto"><AvatarGroup names={members.map((m) => ({ name: m.name, accent: m.avatarColor }))} max={3} size="xs" /></span>
      </div>
    </LinkCard>
  );
}
