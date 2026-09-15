import Link from "next/link";
import { FolderOpen, CalendarClock, UserCheck, Lightbulb, ArrowUpRight } from "lucide-react";
import {
  activeProjects,
  upcomingInterviews,
  availableParticipants,
  recentInsights,
  topPainPoints,
  trendingThemes,
  sentimentBreakdown,
  insights,
  getUser,
  getProject,
  fullName,
  projectInterviews,
} from "@/lib/db";
import { Stat, Meter } from "@/components/ui/misc";
import { Avatar } from "@/components/ui/avatar";
import { BarList, SentimentDonut } from "@/components/charts";
import { ProjectStatusBadge, HighlightKindBadge } from "@/components/domain/badges";
import { Panel } from "./shared";
import { TestingPanel } from "./testing-panel";
import { relativeTime, formatDate } from "@/lib/utils";

export function ResearchDashboard() {
  const active = activeProjects();
  const upcoming = upcomingInterviews();
  const available = availableParticipants();
  const recent = recentInsights(5);
  const s = sentimentBreakdown();

  return (
    <div className="flex flex-col gap-5">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Active projects" value={active.length} hint="in flight now" icon={<FolderOpen className="h-4 w-4" />} accent="blue" href="/projects" />
        <Stat label="Upcoming interviews" value={upcoming.length} hint="scheduled" icon={<CalendarClock className="h-4 w-4" />} accent="violet" href="/interviews" />
        <Stat label="Participants available" value={available.length} hint="ready to recruit" icon={<UserCheck className="h-4 w-4" />} accent="green" href="/participants" />
        <Stat label="Insights captured" value={insights.length} hint="across all studies" icon={<Lightbulb className="h-4 w-4" />} accent="amber" href="/insights" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Active projects */}
        <Panel title="Active projects" href="/projects" className="lg:col-span-2">
          <div className="flex flex-col divide-y divide-border">
            {active.map((p) => {
              const owner = getUser(p.ownerId);
              const ivCount = projectInterviews(p.id).length;
              const answered = p.researchQuestions.filter((q) => q.answered).length;
              return (
                <Link key={p.id} href={`/projects/${p.id}`} className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">
                        {p.name}
                      </span>
                      <ProjectStatusBadge status={p.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-subtle">
                      {p.productArea} · {ivCount} interviews · {p.participantIds.length} participants
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Meter value={answered / Math.max(1, p.researchQuestions.length)} className="max-w-[160px]" />
                      <span className="text-2xs text-subtle">
                        {answered}/{p.researchQuestions.length} questions answered
                      </span>
                    </div>
                  </div>
                  {owner && <Avatar name={owner.name} accent={owner.avatarColor} size="sm" />}
                </Link>
              );
            })}
          </div>
        </Panel>

        {/* Sentiment */}
        <Panel title="Interview sentiment" subtitle="Across all recorded sessions" bodyClassName="flex flex-col">
          <SentimentDonut
            segments={[
              { label: "Positive", value: s.positive, color: "hsl(152 55% 42%)" },
              { label: "Neutral", value: s.neutral, color: "hsl(220 12% 60%)" },
              { label: "Mixed", value: s.mixed, color: "hsl(32 88% 50%)" },
              { label: "Negative", value: s.negative, color: "hsl(356 64% 52%)" },
            ]}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Recent insights */}
        <Panel title="Recent insights" href="/insights" className="lg:col-span-2">
          <div className="flex flex-col divide-y divide-border">
            {recent.map((ins) => (
              <Link key={ins.id} href={`/insights/${ins.id}`} className="group flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="mt-1"><HighlightKindBadge kind={ins.type} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{ins.title}</p>
                  <p className="text-xs text-subtle">{ins.productArea} · {relativeTime(ins.createdDate)}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            ))}
          </div>
        </Panel>

        {/* Upcoming */}
        <Panel title="Upcoming interviews" href="/participants">
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">No interviews scheduled.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map(({ participant, projects }) => (
                <Link key={participant.id} href={`/participants/${participant.id}`} className="flex items-center gap-3">
                  <Avatar name={fullName(participant)} accent={participant.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">{fullName(participant)}</p>
                    <p className="truncate text-xs text-subtle">
                      {(participant.scheduledSession?.projectId &&
                        getProject(participant.scheduledSession.projectId)?.name) ??
                        projects[0]?.name ??
                        participant.jobTitle}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-primary">
                    {participant.scheduledSession
                      ? `${formatDate(participant.scheduledSession.date, { year: undefined })} · ${participant.scheduledSession.time}`
                      : participant.availability}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <TestingPanel />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Top pain points" subtitle="By number of supporting insights" href="/tags">
          <BarList items={topPainPoints(6)} />
        </Panel>
        <Panel title="Trending themes" subtitle="By insight references" href="/themes">
          <BarList items={trendingThemes(6)} />
        </Panel>
      </div>
    </div>
  );
}
