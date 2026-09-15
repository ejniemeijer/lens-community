"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
  title?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded font-medium transition-colors",
              size === "sm" ? "h-7 px-2 text-xs" : "h-8 px-2.5 text-[13px]",
              active
                ? "bg-surface text-foreground shadow-xs"
                : "text-muted hover:text-foreground",
            )}
          >
            {opt.icon}
            {opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
