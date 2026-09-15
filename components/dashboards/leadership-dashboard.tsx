import Link from "next/link";
import { CheckCircle2, Contact, Building2, Users } from "lucide-react";
import {
  projects,
  personas,
  companies,
  participants,
  personaCoverage,
  trendingThemes,
  insights,
} from "@/lib/db";
import { Stat } from "@/components/ui/misc";
import { BarList } from "@/components/charts";
import { SeverityBadge, ImpactBadge } from "@/components/domain/badges";
import { Panel } from "./shared";

export function LeadershipDashboard() {
  const completed = projects.filter((p) => p.status === "completed").length;
  const coveredPersonas = personaCoverage().filter((p) => p.count > 0).length;
  const roadmapEvidence = insights
    .filter((i) => i.impact === "high")
    .sort((a, b) => b.participantIds.length - a.participantIds.length)
    .slice(0, 6);
  const challenges = insights
    .filter((i) => i.severity === "critical" || i.severity === "high")
    .slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Studies completed" value={`${completed}/${projects.length}`} hint="research projects" icon={<CheckCircle2 className="h-4 w-4" />} accent="blue" href="/projects" />
        <Stat label="Personas covered" value={`${coveredPersonas}/${personas.length}`} hint="with participants" icon={<Contact className="h-4 w-4" />} accent="violet" href="/personas" />
        <Stat label="Customer orgs" value={companies.length} hint="represented" icon={<Building2 className="h-4 w-4" />} accent="green" />
        <Stat label="Participants" value={participants.length} hint="in the repository" icon={<Users className="h-4 w-4" />} accent="amber" href="/participants" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Evidence supporting the roadmap" subtitle="High-impact insights, most-cited first" href="/insights?impact=high" className="lg:col-span-2">
          <div className="flex flex-col divide-y divide-border">
            {roadmapEvidence.map((ins) => (
              <Link key={ins.id} href={`/insights/${ins.id}`} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{ins.title}</p>
                  <p className="text-xs text-subtle">
                    {ins.productArea} · backed by {ins.participantIds.length} participants, {ins.interviewIds.length} interviews
                  </p>
                </div>
                <ImpactBadge value={ins.impact} />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Strategic themes" subtitle="Where the signal is strongest" href="/themes">
          <BarList items={trendingThemes(6)} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Top customer challenges" subtitle="Critical & high-severity findings" href="/insights?severity=high">
          <div className="flex flex-col divide-y divide-border">
            {challenges.map((ins) => (
              <Link key={ins.id} href={`/insights/${ins.id}`} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate text-[13px] text-foreground group-hover:text-primary">{ins.title}</span>
                <SeverityBadge value={ins.severity} />
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Research coverage by persona" href="/personas">
          <BarList items={personaCoverage().slice(0, 7)} />
        </Panel>
      </div>
    </div>
  );
}
