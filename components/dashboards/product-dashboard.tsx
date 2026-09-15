import Link from "next/link";
import { Sparkles, GitPullRequest, LayoutGrid, Contact } from "lucide-react";
import {
  featureRequestsAndOpportunities,
  insightsByProductArea,
  insightsByPersona,
  insights,
  getPersonas,
} from "@/lib/db";
import type { Impact } from "@/lib/types";
import { Stat } from "@/components/ui/misc";
import { BarList } from "@/components/charts";
import { HighlightKindBadge, ImpactBadge, PersonaChip } from "@/components/domain/badges";
import { Panel } from "./shared";

const impactRank: Record<Impact, number> = { high: 3, medium: 2, low: 1 };

export function ProductDashboard() {
  const opportunities = insights.filter((i) => i.type === "opportunity");
  const requests = insights.filter((i) => i.type === "feature-request");
  const improvements = [...featureRequestsAndOpportunities()].sort(
    (a, b) => (b.impact ? impactRank[b.impact] : 0) - (a.impact ? impactRank[a.impact] : 0),
  );
  const areas = insightsByProductArea();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Opportunities" value={opportunities.length} hint="detected" icon={<Sparkles className="h-4 w-4" />} accent="blue" href="/insights?type=opportunity" />
        <Stat label="Feature requests" value={requests.length} hint="from research" icon={<GitPullRequest className="h-4 w-4" />} accent="violet" href="/insights?type=feature-request" />
        <Stat label="Product areas" value={areas.length} hint="with evidence" icon={<LayoutGrid className="h-4 w-4" />} accent="green" />
        <Stat label="Personas covered" value={insightsByPersona().length} hint="with insights" icon={<Contact className="h-4 w-4" />} accent="amber" href="/personas" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Panel title="Most requested improvements" subtitle="Opportunities & feature requests, by impact" href="/kanban" hrefLabel="Open board" className="lg:col-span-2">
          <div className="flex flex-col divide-y divide-border">
            {improvements.map((ins) => (
              <Link key={ins.id} href={`/insights/${ins.id}`} className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">{ins.title}</p>
                  <p className="text-xs text-subtle">{ins.productArea} · {ins.participantIds.length} participants</p>
                </div>
                <HighlightKindBadge kind={ins.type} />
                <ImpactBadge value={ins.impact} />
              </Link>
            ))}
          </div>
        </Panel>

        <Panel title="Insights by product area">
          <BarList items={areas} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Insights by persona" href="/personas">
          <BarList items={insightsByPersona()} />
        </Panel>
        <Panel title="Coverage gaps" subtitle="Personas with the least evidence">
          <div className="flex flex-wrap gap-2">
            {getPersonas(insightsByPersona().slice(-3).map((x) => x.id)).map((pe) => (
              <PersonaChip key={pe.id} persona={pe} href={`/personas`} size="md" />
            ))}
            <p className="mt-2 w-full text-xs text-muted">
              Consider prioritizing research for personas with thin evidence before making product bets.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
