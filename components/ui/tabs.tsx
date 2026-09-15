"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabDef {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabDef[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("-mb-px flex items-center gap-1 overflow-x-auto no-scrollbar", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-2xs font-semibold tabular-nums",
                  active ? "bg-primary-soft text-primary" : "bg-surface-2 text-subtle",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Tab state backed by a URL query param so tabs are deep-linkable. */
export function useTabParam(param: string, def: string) {
  const [value, setValue] = React.useState(def);

  React.useEffect(() => {
    const url = new URL(window.location.href);
    const v = url.searchParams.get(param);
    if (v) setValue(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = React.useCallback(
    (v: string) => {
      setValue(v);
      const url = new URL(window.location.href);
      url.searchParams.set(param, v);
      window.history.replaceState(null, "", url.toString());
    },
    [param],
  );

  return [value, set] as const;
}
