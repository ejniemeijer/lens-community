import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AccentPill } from "@/components/ui/accent";
import { DynamicIcon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type {
  Confidence,
  ConsentStatus,
  HighlightKind,
  Impact,
  Persona,
  ProjectStatus,
  RecruitmentStatus,
  Sentiment,
  Severity,
  Tag,
  Theme,
} from "@/lib/types";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const projectStatus: Record<ProjectStatus, { tone: Tone; label: string }> = {
  planning: { tone: "neutral", label: "Planning" },
  recruiting: { tone: "info", label: "Recruiting" },
  "in-progress": { tone: "primary", label: "In progress" },
  analysis: { tone: "warning", label: "Analysis" },
  completed: { tone: "success", label: "Completed" },
  "on-hold": { tone: "neutral", label: "On hold" },
};
export const ProjectStatusBadge = ({ status }: { status: ProjectStatus }) => {
  const s = projectStatus[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
};

const recruitment: Record<RecruitmentStatus, { tone: Tone; label: string }> = {
  available: { tone: "success", label: "Available" },
  contacted: { tone: "info", label: "Contacted" },
  scheduled: { tone: "primary", label: "Scheduled" },
  interviewed: { tone: "neutral", label: "Interviewed" },
  "do-not-contact": { tone: "danger", label: "Do not contact" },
};
export const RecruitmentBadge = ({ status }: { status: RecruitmentStatus }) => {
  const s = recruitment[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
};

const consent: Record<ConsentStatus, { tone: Tone; label: string }> = {
  granted: { tone: "success", label: "Consent granted" },
  pending: { tone: "warning", label: "Consent pending" },
  expired: { tone: "danger", label: "Consent expired" },
  withdrawn: { tone: "danger", label: "Consent withdrawn" },
};
export const ConsentBadge = ({ status }: { status: ConsentStatus }) => {
  const s = consent[status];
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
};

const confidenceTone: Record<Confidence, Tone> = { low: "neutral", medium: "info", high: "success" };
export const ConfidenceBadge = ({ value }: { value?: Confidence }) =>
  value ? <Badge tone={confidenceTone[value]}>{value} confidence</Badge> : null;

const severityTone: Record<Severity, Tone> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  critical: "danger",
};
export const SeverityBadge = ({ value }: { value?: Severity }) =>
  value ? (
    <Badge tone={severityTone[value]} dot className={value === "critical" ? "font-semibold" : ""}>
      {value}
    </Badge>
  ) : null;

const impactTone: Record<Impact, Tone> = { low: "neutral", medium: "info", high: "primary" };
export const ImpactBadge = ({ value }: { value?: Impact }) =>
  value ? <Badge tone={impactTone[value]}>{value} impact</Badge> : null;

const sentimentMeta: Record<Sentiment, { tone: Tone; label: string }> = {
  positive: { tone: "success", label: "Positive" },
  neutral: { tone: "neutral", label: "Neutral" },
  negative: { tone: "danger", label: "Negative" },
  mixed: { tone: "warning", label: "Mixed" },
};
export const SentimentBadge = ({ value }: { value: Sentiment }) => (
  <Badge tone={sentimentMeta[value].tone} dot>
    {sentimentMeta[value].label}
  </Badge>
);
export const sentimentAccent: Record<Sentiment, string> = {
  positive: "green",
  neutral: "slate",
  negative: "red",
  mixed: "amber",
};

/* ---------------- highlight / insight kinds ---------------- */

export const highlightKindMeta: Record<HighlightKind, { label: string; accent: string }> = {
  insight: { label: "Insight", accent: "violet" },
  observation: { label: "Observation", accent: "slate" },
  "pain-point": { label: "Pain Point", accent: "red" },
  opportunity: { label: "Opportunity", accent: "green" },
  "feature-request": { label: "Feature Request", accent: "teal" },
  "user-need": { label: "User Need", accent: "amber" },
};

export const HighlightKindBadge = ({
  kind,
  size = "sm",
}: {
  kind: HighlightKind;
  size?: "sm" | "md";
}) => {
  const m = highlightKindMeta[kind];
  return (
    <AccentPill accent={m.accent} size={size}>
      {m.label}
    </AccentPill>
  );
};

/* ---------------- entity chips ---------------- */

export function TagChip({ tag, href, onRemove, size = "sm" }: { tag: Tag; href?: string; onRemove?: () => void; size?: "sm" | "md" }) {
  const pill = <AccentPill accent={tag.accent} size={size} onRemove={onRemove}>{tag.label}</AccentPill>;
  return href ? <Link href={href}>{pill}</Link> : pill;
}

export function ThemeChip({ theme, href, size = "sm" }: { theme: Theme; href?: string; size?: "sm" | "md" }) {
  const pill = <AccentPill accent={theme.accent} size={size}>{theme.name}</AccentPill>;
  return href ? <Link href={href}>{pill}</Link> : pill;
}

export function PersonaChip({
  persona,
  href,
  size = "sm",
  withIcon = true,
}: {
  persona: Persona;
  href?: string;
  size?: "sm" | "md";
  withIcon?: boolean;
}) {
  const pill = (
    <span
      className={cn(
        `accent-${persona.accent}`,
        "inline-flex items-center gap-1.5 rounded-full border font-medium leading-none",
        "bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))] border-[hsl(var(--a-border))]",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
      )}
    >
      {withIcon ? (
        <DynamicIcon name={persona.icon} className="h-3 w-3" />
      ) : (
        <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--a-solid))]" />
      )}
      <span className="truncate">{persona.name}</span>
    </span>
  );
  return href ? <Link href={href}>{pill}</Link> : pill;
}
