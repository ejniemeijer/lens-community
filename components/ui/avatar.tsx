import * as React from "react";
import { cn, initials, accentFor } from "@/lib/utils";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-16 w-16 text-lg",
};

export function Avatar({
  name,
  accent,
  size = "md",
  className,
}: {
  name: string;
  accent?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const a = accent ?? accentFor(name);
  return (
    <span
      className={cn(
        `accent-${a}`,
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        "bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))] ring-1 ring-inset ring-[hsl(var(--a-border))]",
        sizes[size],
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarGroup({
  names,
  max = 4,
  size = "sm",
}: {
  names: { name: string; accent?: string }[];
  max?: number;
  size?: keyof typeof sizes;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((n, i) => (
        <Avatar
          key={i}
          name={n.name}
          accent={n.accent}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            sizes[size],
            "inline-flex items-center justify-center rounded-full bg-surface-2 font-semibold text-muted ring-2 ring-surface",
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
