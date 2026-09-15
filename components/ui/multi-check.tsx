"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiOption {
  id: string;
  label: string;
  /** Optional accent name (e.g. tag/persona/theme color). */
  accent?: string;
}

/** Chip-style multi-select used in forms for tags / themes / personas / members. */
export function MultiCheck({
  options,
  value,
  onChange,
  emptyLabel,
}: {
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  if (options.length === 0)
    return <p className="text-xs text-subtle">{emptyLabel ?? "Nothing available yet."}</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const active = value.includes(opt.id);
        const accent = opt.accent;
        // Accent-aware chip: selected chips fill with the accent's soft
        // background/border/text; unselected still show a colored dot so the
        // tag colour is visible in both light and dark mode.
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => toggle(opt.id)}
            aria-pressed={active}
            className={cn(
              accent && `accent-${accent}`,
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? accent
                  ? "bg-[hsl(var(--a-bg))] text-[hsl(var(--a-fg))] border-[hsl(var(--a-border))]"
                  : "border-primary bg-primary-soft text-primary"
                : "border-border text-muted hover:border-border-strong hover:text-foreground",
            )}
          >
            {active ? (
              <Check className="h-3 w-3" />
            ) : accent ? (
              <span className="h-2 w-2 rounded-full bg-[hsl(var(--a-solid))]" />
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
