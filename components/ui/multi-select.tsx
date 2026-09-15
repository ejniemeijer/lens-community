"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MultiOption } from "./multi-check";

type PopPlacement = { left: number; width: number; maxH: number; top?: number; bottom?: number };

/**
 * A multi-select rendered as a compact dropdown — the same portaled popover as
 * {@link Select} (flips near the viewport edge, repositions on scroll, sits
 * above modals) but each option toggles instead of closing, so several can be
 * picked. Each option appears exactly once. Use in place of {@link MultiCheck}
 * when the option list is long enough that an always-open checklist is unwieldy.
 */
export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  emptyLabel,
  disabled,
  className,
  summaryMode = "names",
}: {
  options: MultiOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  /** "names" lists up to two selected labels; "count" always shows "N selected";
      "static" always shows the placeholder (for an "Add…" control whose
      selection is displayed elsewhere, e.g. as chips). */
  summaryMode?: "names" | "count" | "static";
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [place, setPlace] = React.useState<PopPlacement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const popRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  const selected = options.filter((o) => value.includes(o.id));
  const showPlaceholder = selected.length === 0 || summaryMode === "static";
  const summary = showPlaceholder
    ? placeholder
    : summaryMode === "count" || selected.length > 2
      ? `${selected.length} selected`
      : selected.map((o) => o.label).join(", ");

  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;
    const flipUp = spaceBelow < 280 && spaceAbove > spaceBelow;
    setPlace(
      flipUp
        ? { left: r.left, width: r.width, bottom: window.innerHeight - r.top + 4, maxH: Math.min(280, spaceAbove - 8) }
        : { left: r.left, width: r.width, top: r.bottom + 4, maxH: Math.min(280, spaceBelow - 8) },
    );
  }, []);

  React.useLayoutEffect(() => {
    if (open) measure();
    else setPlace(null);
  }, [open, measure]);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    let raf = 0;
    const reposition = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, measure]);

  if (options.length === 0)
    return <p className="text-xs text-subtle">{emptyLabel ?? "Nothing available yet."}</p>;

  return (
    <div className={cn("relative grid w-full", className)}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "col-start-1 row-start-1 flex h-9 w-full items-center rounded-md border bg-surface pl-2.5 pr-8 text-left text-sm transition-colors",
          "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          open ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-border-strong",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", showPlaceholder && "text-subtle")}>{summary}</span>
      </button>
      <ChevronDown className="pointer-events-none col-start-1 row-start-1 mr-2.5 h-3.5 w-3.5 self-center justify-self-end text-subtle" />

      {open && mounted && place &&
        createPortal(
          <div
            ref={popRef}
            style={{
              position: "fixed",
              left: place.left,
              minWidth: place.width,
              maxHeight: place.maxH,
              top: place.top,
              bottom: place.bottom,
            }}
            className="z-[110] overflow-auto rounded-lg border border-border bg-overlay p-1 shadow-popover"
            role="listbox"
            aria-multiselectable
          >
            {options.map((o) => {
              const active = value.includes(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => toggle(o.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]",
                    active
                      ? "bg-surface-hover font-medium text-foreground"
                      : "text-muted hover:bg-surface-hover hover:text-foreground",
                  )}
                >
                  {o.accent && (
                    <span className={cn(`accent-${o.accent}`, "h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--a-solid))]")} />
                  )}
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {active && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
