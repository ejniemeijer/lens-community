import Link from "next/link";
import { Users, MessageSquare } from "lucide-react";
import type { Insight } from "@/lib/types";
import { getThemes } from "@/lib/db";
import { LinkCard } from "@/components/ui/card";
import {
  HighlightKindBadge,
  ConfidenceBadge,
  SeverityBadge,
  ImpactBadge,
  ThemeChip,
} from "@/components/domain/badges";

export function InsightCard({ insight }: { insight: Insight }) {
  const themes = getThemes(insight.themeIds);
  return (
    <LinkCard href={`/insights/${insight.id}`} className="flex flex-col p-4">
      <div className="mb-2 flex items-center gap-2">
        <HighlightKindBadge kind={insight.type} />
        <span className="ml-auto text-2xs text-subtle">{insight.productArea}</span>
      </div>
      <h3 className="font-medium leading-snug text-foreground group-hover:text-primary">
        {insight.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13px] text-muted">{insight.description}</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {themes.map((t) => (
          <ThemeChip key={t.id} theme={t} />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
        <SeverityBadge value={insight.severity} />
        <ImpactBadge value={insight.impact} />
        <ConfidenceBadge value={insight.confidence} />
        <div className="ml-auto flex items-center gap-3 text-2xs text-subtle">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{insight.participantIds.length}</span>
          <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{insight.interviewIds.length}</span>
        </div>
      </div>
    </LinkCard>
  );
}
