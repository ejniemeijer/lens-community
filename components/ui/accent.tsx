import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AccentPill / AccentDot consume the `.accent-<name>` classes defined in
 * globals.css, which expose --a-bg / --a-fg / --a-border / --a-solid and adapt
 * to dark mode automatically.
 */

export function AccentDot({ accent, className }: { accent: string; className?: string }) {
  return (
    <span
      className={cn(`accent-${accent}`, "inline-block h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--a-solid))]", className)}
    />
  );
}

export function AccentPill({
  accent,
  children,
  dot = true,
  onRemove,
  className,
  size = "md",
}: {
  accent: string;
  children: React.ReactNode;
  dot?: boolean;
  onRemove?: () => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        `accent-${accent}`,
        "inline-flex items-center gap-1.5 rounded-full border font-medium leading-none",
        "bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))] border-[hsl(var(--a-border))]",
        size === "sm" ? "px-2 py-0.5 text-2xs" : "px-2.5 py-1 text-xs",
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--a-solid))]" />}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-0.5 rounded-full p-0.5 hover:bg-[hsl(var(--a-solid)/0.2)]"
          aria-label="Remove"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export function AccentBar({ accent, className }: { accent: string; className?: string }) {
  return (
    <span className={cn(`accent-${accent}`, "block bg-[hsl(var(--a-solid))]", className)} />
  );
}
